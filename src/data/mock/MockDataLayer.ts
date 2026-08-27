import type {
  AllocationImportSummary,
  Batch,
  BatchEvent,
  BatchEventType,
  ImportSummary,
  LastSentInfo,
  Order,
  PendingSendItem,
  Release,
  ReleaseDetail,
  ReleaseSummary,
  RescheduleInput,
  RescheduleResult,
  ScheduledSend,
  SendStatus,
  TemplateRef,
  User,
} from '../../types';
import type {
  CreateReleaseInput,
  DataLayer,
  ImportOptions,
  ReleaseEmailPatch,
  ReleaseEmailUpdateResult,
  SendDetailView,
  SendPatch,
} from '../DataLayer';
import { formatDay, toDay } from '../../logic/dates';
import { allocationOrderKey, parseEditionAllocationCsv } from '../../logic/allocation';
import { filterItemsForRelease, orderDedupeKey, parseShopifyOrderExport } from '../../logic/importer';
import { generateMilestonePlan } from '../../logic/plan';
import { inheritedSentStory, planReschedule, sentStoryForBatch } from '../../logic/reschedule';
import {
  MASTER_TEMPLATES,
  buildNextSteps,
  buildTemplateFields,
  effectiveTemplate,
  releaseFillerTemplate,
  releaseSequenceFor,
  renderReleaseTemplate,
} from '../../logic/templates';

/**
 * In-memory implementation of DataLayer for phase 1.
 *
 * All the decision logic lives in src/logic — this class only stores state
 * and joins objects together, which is exactly the shape the phase-2
 * Postgres implementation will have. Internal members prefixed with `_` are
 * for the seed script and tests, not the UI.
 */

interface Store {
  users: User[];
  currentUserId: string;
  releases: Map<string, Release>;
  batches: Map<string, Batch>;
  orders: Map<string, Order>;
  sends: Map<string, ScheduledSend>;
  events: BatchEvent[];
}

const UNSENT: SendStatus[] = ['draft', 'pending_approval', 'approved', 'held'];

export class MockDataLayer implements DataLayer {
  readonly _store: Store;
  /** email → HubSpot contact id; stands in for the HubSpot contacts API. */
  private hubspotDirectory: Record<string, string>;
  private counter = 0;
  private clockOverride: Date | null = null;
  /** Simulated network delay so loading states are honest; 0 while seeding. */
  simulatedLatencyMs = 0;

  constructor(users: User[], currentUserId: string, hubspotDirectory: Record<string, string>) {
    this._store = {
      users,
      currentUserId,
      releases: new Map(),
      batches: new Map(),
      orders: new Map(),
      sends: new Map(),
      events: [],
    };
    this.hubspotDirectory = hubspotDirectory;
  }

  // --- internals ---------------------------------------------------------

  _setClock(date: Date | null): void {
    this.clockOverride = date;
  }

  _newId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${String(this.counter).padStart(4, '0')}`;
  }

  private now(): Date {
    return this.clockOverride ?? new Date();
  }

  private nowDay(): string {
    // Respect a seeded clock; otherwise use the local calendar day.
    if (this.clockOverride) return toDay(this.clockOverride);
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private async settle<T>(value: T): Promise<T> {
    if (this.simulatedLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.simulatedLatencyMs));
    }
    return structuredClone(value);
  }

  private currentUser(): User {
    const user = this._store.users.find((u) => u.id === this._store.currentUserId);
    if (!user) throw new Error('No signed-in user');
    return user;
  }

  private mustGet<T>(map: Map<string, T>, id: string, kind: string): T {
    const value = map.get(id);
    if (!value) throw new Error(`Unknown ${kind}: ${id}`);
    return value;
  }

  _addEvent(
    releaseId: string,
    batchId: string,
    type: BatchEventType,
    description: string,
    data: BatchEvent['data'] = {},
    by?: { id: string; name: string },
    atIso?: string,
  ): void {
    const user = by ?? this.currentUser();
    this._store.events.push({
      id: this._newId('event'),
      releaseId,
      batchId,
      type,
      at: atIso ?? this.now().toISOString(),
      by: user.id,
      byName: user.name,
      description,
      data,
    });
  }

  private releaseSends(releaseId: string): ScheduledSend[] {
    return [...this._store.sends.values()].filter((s) => s.releaseId === releaseId);
  }

  private batchSends(batchId: string): ScheduledSend[] {
    return [...this._store.sends.values()].filter((s) => s.batchId === batchId);
  }

  private releaseBatches(releaseId: string): Batch[] {
    return [...this._store.batches.values()].filter((b) => b.releaseId === releaseId);
  }

  private activeBatchOrders(batchId: string): Order[] {
    return [...this._store.orders.values()].filter((o) => o.batchId === batchId && !o.removed);
  }

  private defaultBatch(releaseId: string): Batch {
    const batch = this.releaseBatches(releaseId).find((b) => b.isDefault);
    if (!batch) throw new Error(`Release ${releaseId} has no default batch`);
    return batch;
  }

  /** The last email a batch's collectors received, walking split lineage. */
  private lastSentInfo(batchId: string): LastSentInfo | null {
    const batch = this.mustGet(this._store.batches, batchId, 'batch');
    const story = sentStoryForBatch(
      batch,
      this.releaseBatches(batch.releaseId),
      this.releaseSends(batch.releaseId),
    );
    const last = story[story.length - 1];
    if (!last || !last.sentAt) return null;
    return {
      sendId: last.id,
      subject: last.subject,
      templateRef: last.templateRef,
      type: last.type,
      sentAt: last.sentAt,
      batchName: this._store.batches.get(last.batchId)?.name ?? '',
    };
  }

  // --- session -----------------------------------------------------------

  async getCurrentUser(): Promise<User> {
    return this.settle(this.currentUser());
  }

  async listUsers(): Promise<User[]> {
    return this.settle(this._store.users);
  }

  async setCurrentUser(userId: string): Promise<User> {
    const user = this._store.users.find((u) => u.id === userId);
    if (!user) throw new Error(`Unknown user: ${userId}`);
    this._store.currentUserId = userId;
    return this.settle(user);
  }

  // --- releases and import ----------------------------------------------

  async listReleases(): Promise<ReleaseSummary[]> {
    const today = this.nowDay();
    const summaries = [...this._store.releases.values()].map((release): ReleaseSummary => {
      const sends = this.releaseSends(release.id);
      const upcoming = sends
        .filter((s) => UNSENT.includes(s.status) && s.status !== 'held')
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
      const overdue = sends.filter(
        (s) =>
          (s.status === 'pending_approval' || s.status === 'approved') && s.scheduledDate < today,
      );
      const orders = [...this._store.orders.values()].filter(
        (o) => o.releaseId === release.id && !o.removed,
      );
      return {
        release,
        orderCount: orders.length,
        batchCount: this.releaseBatches(release.id).length,
        nextScheduledSend: upcoming[0] ?? null,
        pendingApprovalCount: sends.filter((s) => s.status === 'pending_approval').length,
        overdueCount: overdue.length,
      };
    });
    summaries.sort((a, b) => a.release.title.localeCompare(b.release.title));
    return this.settle(summaries);
  }

  async getRelease(releaseId: string): Promise<ReleaseDetail> {
    const release = this.mustGet(this._store.releases, releaseId, 'release');
    const batches = this.releaseBatches(releaseId).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    const orders = [...this._store.orders.values()]
      .filter((o) => o.releaseId === releaseId)
      .sort((a, b) => a.orderDate.localeCompare(b.orderDate) || a.shopifyOrderName.localeCompare(b.shopifyOrderName));
    const sends = this.releaseSends(releaseId).sort((a, b) =>
      a.scheduledDate.localeCompare(b.scheduledDate) || a.createdAt.localeCompare(b.createdAt),
    );
    const events = this._store.events
      .filter((e) => e.releaseId === releaseId)
      .sort((a, b) => b.at.localeCompare(a.at));
    return this.settle({ release, batches, orders, sends, events });
  }

  async createRelease(input: CreateReleaseInput): Promise<Release> {
    const nowIso = this.now().toISOString();
    // Dispatch anchors every plan and the delay notice is not a plan
    // milestone — neither can be switched off.
    const disabledTemplates = (input.disabledTemplates ?? []).filter(
      (ref) => ref !== 'pp-dispatch' && ref !== 'pp-delay',
    );
    const release: Release = {
      id: this._newId('release'),
      title: input.title.trim(),
      artist: input.artist.trim(),
      shopifyProductIds: input.shopifyProductIds ?? [],
      editionSize: input.editionSize,
      status: 'active',
      productKind: input.productKind,
      disabledTemplates,
      templateOverrides: {},
      createdAt: nowIso,
    };
    if (!release.title) throw new Error('Release title is required');
    if (!release.artist) throw new Error('Artist is required');
    this._store.releases.set(release.id, release);
    const batch: Batch = {
      id: this._newId('batch'),
      releaseId: release.id,
      name: 'Batch 1',
      promiseDate: null,
      isDefault: true,
      createdAt: nowIso,
    };
    this._store.batches.set(batch.id, batch);
    this._addEvent(release.id, batch.id, 'batch_created', 'Batch 1 created (default batch)');
    return this.settle(release);
  }

  async importOrders(
    releaseId: string,
    csvText: string,
    options: ImportOptions = {},
  ): Promise<ImportSummary> {
    const release = this.mustGet(this._store.releases, releaseId, 'release');
    const defaultBatch = this.defaultBatch(releaseId);

    const parsed = parseShopifyOrderExport(csvText);
    const matchers = options.titleMatchers?.length ? options.titleMatchers : [release.title];
    const { matched, filteredOut } = filterItemsForRelease(parsed.items, matchers);

    // Dedupe against every order ever imported for this release — including
    // removed ones, so a cancelled order in a re-uploaded export stays gone.
    const seen = new Set(
      [...this._store.orders.values()]
        .filter((o) => o.releaseId === releaseId)
        .map((o) => orderDedupeKey(o.shopifyOrderName, o.lineItemTitle)),
    );

    let newOrders = 0;
    let duplicatesSkipped = 0;
    let missingEmail = 0;
    let missingHubspotContact = 0;
    const createdIds: string[] = [];

    for (const item of matched) {
      const key = orderDedupeKey(item.shopifyOrderName, item.lineItemTitle);
      if (seen.has(key)) {
        duplicatesSkipped += 1;
        continue;
      }
      seen.add(key);
      const hubspotContactId = item.email ? (this.hubspotDirectory[item.email] ?? null) : null;
      const order: Order = {
        id: this._newId('order'),
        releaseId,
        batchId: defaultBatch.id,
        shopifyOrderName: item.shopifyOrderName,
        lineItemTitle: item.lineItemTitle,
        collectorName: item.collectorName,
        email: item.email,
        hubspotContactId,
        variant: item.variant || (release.productKind === 'sculpture' ? 'Sculpture' : ''),
        orderDate: item.orderDate,
        removed: false,
      };
      this._store.orders.set(order.id, order);
      createdIds.push(order.id);
      newOrders += 1;
      if (!item.email) missingEmail += 1;
      else if (!hubspotContactId) missingHubspotContact += 1;
    }

    if (newOrders > 0) {
      this._addEvent(
        releaseId,
        defaultBatch.id,
        'orders_imported',
        `${newOrders} order${newOrders === 1 ? '' : 's'} imported from Shopify export`,
        { orderIds: createdIds },
      );
    }

    return this.settle({
      rowsParsed: parsed.rowsParsed,
      newOrders,
      duplicatesSkipped,
      filteredOut,
      missingHubspotContact,
      missingEmail,
      issues: parsed.issues,
    });
  }

  async importAllocations(releaseId: string, csvText: string): Promise<AllocationImportSummary> {
    this.mustGet(this._store.releases, releaseId, 'release');
    const defaultBatch = this.defaultBatch(releaseId);
    const parsed = parseEditionAllocationCsv(csvText);

    const releaseOrders = [...this._store.orders.values()].filter(
      (o) => o.releaseId === releaseId,
    );
    // Removed orders still count as "known" (their sheet rows aren't
    // unmatched), but they receive no allocation and aren't counted matched.
    const ordersByKey = new Map<string, Order[]>();
    for (const order of releaseOrders) {
      const key = allocationOrderKey(order.shopifyOrderName);
      const list = ordersByKey.get(key) ?? [];
      list.push(order);
      ordersByKey.set(key, list);
    }

    const rowsByKey = new Map<string, typeof parsed.rows>();
    for (const row of parsed.rows) {
      const key = allocationOrderKey(row.orderNumber);
      const list = rowsByKey.get(key) ?? [];
      list.push(row);
      rowsByKey.set(key, list);
    }

    const matchedOrderIds: string[] = [];
    let allocationsApplied = 0;
    const unmatchedOrderNumbers: string[] = [];

    for (const [key, rows] of rowsByKey) {
      const orders = ordersByKey.get(key);
      if (!orders || orders.length === 0) {
        unmatchedOrderNumbers.push(rows[0].orderNumber);
        continue;
      }
      const activeOrders = orders.filter((o) => !o.removed);
      if (activeOrders.length === 0) continue;
      allocationsApplied += rows.length;
      for (const order of activeOrders) {
        // Multi-line-item orders: prefer the sheet rows whose fulfilment
        // matches this line item's variant (Framed ↔ Framed, everything
        // else ↔ Print Only); fall back to the whole order's rows.
        const wantFramed = /framed/i.test(order.variant) && !/unframed/i.test(order.variant);
        const variantRows =
          activeOrders.length > 1
            ? rows.filter((r) =>
                wantFramed ? /framed/i.test(r.allocation.fulfilment) : !/framed/i.test(r.allocation.fulfilment),
              )
            : rows;
        const chosen = variantRows.length > 0 ? variantRows : rows;
        order.allocations = chosen.map((r) => structuredClone(r.allocation));
        matchedOrderIds.push(order.id);
      }
    }

    const ordersWithoutAllocation = releaseOrders.filter(
      (o) => !o.removed && (!o.allocations || o.allocations.length === 0),
    ).length;

    if (matchedOrderIds.length > 0) {
      this._addEvent(
        releaseId,
        defaultBatch.id,
        'allocation_imported',
        `Warehouse allocation imported — ${matchedOrderIds.length} order${matchedOrderIds.length === 1 ? '' : 's'} matched`,
        { orderIds: matchedOrderIds },
      );
    }

    return this.settle({
      rowsParsed: parsed.rowsParsed,
      matchedOrders: matchedOrderIds.length,
      allocationsApplied,
      unmatchedOrderNumbers,
      ordersWithoutAllocation,
      issues: parsed.issues,
    });
  }

  async updateReleaseEmail(
    releaseId: string,
    templateRef: TemplateRef,
    patch: ReleaseEmailPatch,
  ): Promise<ReleaseEmailUpdateResult> {
    const release = this.mustGet(this._store.releases, releaseId, 'release');
    const defaultBatch = this.defaultBatch(releaseId);
    const templateName = MASTER_TEMPLATES[templateRef].name;
    let updatedSendCount = 0;
    let cancelledSendCount = 0;
    // A release-level edit is logged on every batch it actually touched, so
    // each batch's history explains its own cancelled/reset sends. With no
    // sends touched, the default batch carries the record.
    const emitTo = (batchIds: Set<string>, description: string): void => {
      const targets = batchIds.size > 0 ? [...batchIds] : [defaultBatch.id];
      for (const batchId of targets) {
        this._addEvent(releaseId, batchId, 'release_emails_edited', description, { templateRef });
      }
    };

    if (patch.enabled === false) {
      if (templateRef === 'pp-dispatch') {
        throw new Error('The dispatch email anchors every plan and cannot be switched off');
      }
      if (templateRef === 'pp-delay') {
        throw new Error('The delay notice cannot be switched off — every reschedule sends one');
      }
      if (!release.disabledTemplates.includes(templateRef)) {
        release.disabledTemplates = [...release.disabledTemplates, templateRef];
      }
      // The milestone leaves every batch's upcoming plan — including the
      // "What happens next?" rows of other unsent sends, which would
      // otherwise keep promising a stage that no longer exists.
      const touchedBatches = new Set<string>();
      for (const send of this.releaseSends(releaseId)) {
        if (!UNSENT.includes(send.status)) continue;
        if (send.templateRef === templateRef) {
          send.status = 'cancelled';
          cancelledSendCount += 1;
          touchedBatches.add(send.batchId);
        } else if (send.nextSteps?.some((s) => s.templateRef === templateRef)) {
          send.nextSteps = send.nextSteps.filter((s) => s.templateRef !== templateRef);
        }
      }
      emitTo(
        touchedBatches,
        `“${templateName}” switched off for this release${cancelledSendCount > 0 ? ` — ${cancelledSendCount} upcoming send${cancelledSendCount === 1 ? '' : 's'} cancelled` : ''}`,
      );
    } else if (patch.enabled === true) {
      release.disabledTemplates = release.disabledTemplates.filter((r) => r !== templateRef);
      this._addEvent(
        releaseId,
        defaultBatch.id,
        'release_emails_edited',
        `“${templateName}” switched back on for this release — future plans will include it`,
        { templateRef },
      );
    }

    // A save that changes nothing (same copy re-saved, or a reset with no
    // override stored) must be a no-op: no "Customised" badge, no approval
    // resets, no history noise.
    const before = effectiveTemplate(release, templateRef);
    const copyChanged = patch.resetToDefault
      ? release.templateOverrides[templateRef] !== undefined
      : (patch.subject !== undefined && patch.subject !== before.subject) ||
        (patch.headline !== undefined && patch.headline !== before.headline) ||
        (patch.body !== undefined && patch.body !== before.body);
    if (copyChanged) {
      if (patch.resetToDefault) {
        delete release.templateOverrides[templateRef];
      } else {
        release.templateOverrides[templateRef] = {
          ...release.templateOverrides[templateRef],
          ...(patch.subject !== undefined ? { subject: patch.subject } : {}),
          ...(patch.headline !== undefined ? { headline: patch.headline } : {}),
          ...(patch.body !== undefined ? { body: patch.body } : {}),
        };
      }

      // Re-render every batch's upcoming sends from the new copy. Delay
      // sends are bespoke per reschedule and individually edited sends are
      // someone's deliberate words — both are left alone.
      const touchedBatches = new Set<string>();
      if (templateRef !== 'pp-delay') {
        for (const send of this.releaseSends(releaseId)) {
          if (send.templateRef !== templateRef) continue;
          if (!UNSENT.includes(send.status)) continue;
          if (send.copyEdited) continue;
          const batch = this._store.batches.get(send.batchId);
          if (!batch?.promiseDate) continue;
          const rendered = renderReleaseTemplate(
            release,
            templateRef,
            buildTemplateFields(release, batch.promiseDate),
          );
          send.subject = rendered.subject;
          send.headline = rendered.headline;
          send.body = rendered.body;
          if (send.status === 'approved') {
            send.status = 'pending_approval';
            send.approvedAt = undefined;
            send.approvedBy = undefined;
          }
          updatedSendCount += 1;
          touchedBatches.add(send.batchId);
        }
      }
      emitTo(
        touchedBatches,
        patch.resetToDefault
          ? `“${templateName}” reset to the default copy${updatedSendCount > 0 ? ` — ${updatedSendCount} upcoming send${updatedSendCount === 1 ? '' : 's'} updated` : ''}`
          : `“${templateName}” copy customised for this release${updatedSendCount > 0 ? ` — ${updatedSendCount} upcoming send${updatedSendCount === 1 ? '' : 's'} updated` : ''}`,
      );
    }

    return this.settle({ release, updatedSendCount, cancelledSendCount });
  }

  // --- batches and plans -------------------------------------------------

  async setPromiseDate(batchId: string, promiseDate: string): Promise<void> {
    const batch = this.mustGet(this._store.batches, batchId, 'batch');
    const release = this.mustGet(this._store.releases, batch.releaseId, 'release');
    const existingPlan = this.batchSends(batchId).filter((s) => s.status !== 'cancelled');
    if (batch.promiseDate || existingPlan.length > 0) {
      throw new Error(
        `${batch.name} already has a promise date — use “Change delivery date” so collectors are told about the change`,
      );
    }
    batch.promiseDate = promiseDate;

    const nowIso = this.now().toISOString();
    const user = this.currentUser();
    const fields = buildTemplateFields(release, promiseDate);
    const steps = generateMilestonePlan(this.nowDay(), promiseDate, release.productKind, {
      sequence: releaseSequenceFor(release),
      fillerTemplate: releaseFillerTemplate(release),
    });
    steps.forEach((step, idx) => {
      const rendered = renderReleaseTemplate(release, step.templateRef, fields);
      const send: ScheduledSend = {
        id: this._newId('send'),
        releaseId: release.id,
        batchId,
        type: 'milestone',
        templateRef: step.templateRef,
        scheduledDate: step.scheduledDate,
        status: 'draft',
        subject: rendered.subject,
        headline: rendered.headline,
        body: rendered.body,
        nextSteps: buildNextSteps(
          steps.slice(idx + 1).map((s) => s.templateRef),
          fields,
        ),
        createdAt: nowIso,
        createdBy: user.id,
      };
      this._store.sends.set(send.id, send);
    });
    this._addEvent(
      release.id,
      batchId,
      'promise_date_set',
      `Promise date set to ${formatDay(promiseDate)} — ${steps.length} milestone send${steps.length === 1 ? '' : 's'} drafted`,
      { newDate: promiseDate },
    );
    await this.settle(undefined);
  }

  async addSend(
    batchId: string,
    templateRef: TemplateRef,
    scheduledDate: string,
  ): Promise<ScheduledSend> {
    const batch = this.mustGet(this._store.batches, batchId, 'batch');
    const release = this.mustGet(this._store.releases, batch.releaseId, 'release');
    if (!batch.promiseDate) {
      throw new Error(`${batch.name} has no promise date yet — set one before adding sends`);
    }
    const rendered = renderReleaseTemplate(
      release,
      templateRef,
      buildTemplateFields(release, batch.promiseDate, {
        old_promise_date: 'the original date',
        reason_line: 'Production is taking longer than planned.',
      }),
    );
    const send: ScheduledSend = {
      id: this._newId('send'),
      releaseId: release.id,
      batchId,
      type: templateRef === 'pp-delay' ? 'delay' : 'milestone',
      templateRef,
      scheduledDate,
      status: 'draft',
      subject: rendered.subject,
      headline: rendered.headline,
      body: rendered.body,
      createdAt: this.now().toISOString(),
      createdBy: this.currentUser().id,
    };
    this._store.sends.set(send.id, send);
    this._addEvent(release.id, batchId, 'plan_edited', `${send.subject} added to the plan`, {
      sendId: send.id,
    });
    return this.settle(send);
  }

  async updateSend(sendId: string, patch: SendPatch): Promise<ScheduledSend> {
    const send = this.mustGet(this._store.sends, sendId, 'send');
    if (send.status === 'sent' || send.status === 'cancelled') {
      throw new Error('Sent and cancelled sends are immutable');
    }
    const wasApproved = send.status === 'approved';
    let copyTouched = false;
    if (patch.subject !== undefined && patch.subject !== send.subject) {
      send.subject = patch.subject;
      copyTouched = true;
    }
    if (patch.headline !== undefined && patch.headline !== send.headline) {
      send.headline = patch.headline;
      copyTouched = true;
    }
    if (patch.body !== undefined && patch.body !== send.body) {
      send.body = patch.body;
      copyTouched = true;
    }
    if (
      patch.nextSteps !== undefined &&
      JSON.stringify(patch.nextSteps) !== JSON.stringify(send.nextSteps ?? [])
    ) {
      send.nextSteps = patch.nextSteps;
      copyTouched = true;
    }
    if (patch.scheduledDate !== undefined) send.scheduledDate = patch.scheduledDate;
    // Direct edits pin this send's copy: release-level template edits skip it.
    if (copyTouched) send.copyEdited = true;
    // Editing an approved send invalidates its approval.
    if (wasApproved) {
      send.status = 'pending_approval';
      send.approvedAt = undefined;
      send.approvedBy = undefined;
    }
    this._addEvent(
      send.releaseId,
      send.batchId,
      'plan_edited',
      `“${send.subject}” edited${wasApproved ? ' (approval reset)' : ''}`,
      { sendId: send.id },
    );
    return this.settle(send);
  }

  async cancelSend(sendId: string): Promise<ScheduledSend> {
    const send = this.mustGet(this._store.sends, sendId, 'send');
    if (send.status === 'sent') throw new Error('Sent sends cannot be cancelled');
    send.status = 'cancelled';
    this._addEvent(send.releaseId, send.batchId, 'plan_edited', `“${send.subject}” cancelled`, {
      sendId: send.id,
    });
    return this.settle(send);
  }

  async submitBatchPlanForApproval(batchId: string): Promise<number> {
    const batch = this.mustGet(this._store.batches, batchId, 'batch');
    const drafts = this.batchSends(batchId).filter((s) => s.status === 'draft');
    for (const send of drafts) send.status = 'pending_approval';
    if (drafts.length > 0) {
      this._addEvent(
        batch.releaseId,
        batchId,
        'plan_edited',
        `${drafts.length} send${drafts.length === 1 ? '' : 's'} submitted for approval`,
      );
    }
    return this.settle(drafts.length);
  }

  async reschedule(input: RescheduleInput): Promise<RescheduleResult> {
    const release = this.mustGet(this._store.releases, input.releaseId, 'release');
    const batch = this.mustGet(this._store.batches, input.batchId, 'batch');
    const releaseBatches = this.releaseBatches(release.id);
    const releaseSends = this.releaseSends(release.id);
    const changes = planReschedule(input, {
      release,
      batch,
      batchOrders: [...this._store.orders.values()].filter((o) => o.batchId === batch.id),
      batchSends: this.batchSends(batch.id),
      inheritedSentSends: inheritedSentStory(batch, releaseBatches, releaseSends),
      allBatchNames: releaseBatches.map((b) => b.name),
      nowDay: this.nowDay(),
      nowIso: this.now().toISOString(),
      user: this.currentUser(),
      newId: (prefix) => this._newId(prefix),
    });

    if (changes.newBatch) this._store.batches.set(changes.newBatch.id, changes.newBatch);
    if (!changes.splitOccurred) {
      batch.promiseDate = changes.newPromiseDate;
    }
    for (const orderId of changes.movedOrderIds) {
      const order = this.mustGet(this._store.orders, orderId, 'order');
      order.batchId = changes.targetBatchId;
    }
    for (const sendId of changes.cancelledSendIds) {
      const send = this.mustGet(this._store.sends, sendId, 'send');
      send.status = 'cancelled';
    }
    for (const send of changes.newSends) this._store.sends.set(send.id, send);
    this._store.events.push(...changes.events);

    const targetBatch = this.mustGet(this._store.batches, changes.targetBatchId, 'batch');
    return this.settle({
      batch: targetBatch,
      splitOccurred: changes.splitOccurred,
      delaySend: changes.newSends[0],
      regeneratedSends: changes.newSends.slice(1),
    });
  }

  async removeOrder(orderId: string, reason: string): Promise<void> {
    const order = this.mustGet(this._store.orders, orderId, 'order');
    if (order.removed) throw new Error('Order is already removed');
    const user = this.currentUser();
    order.removed = true;
    order.removedAt = this.now().toISOString();
    order.removedBy = user.id;
    order.removedReason = reason.trim() || 'Removed';
    this._addEvent(
      order.releaseId,
      order.batchId,
      'order_removed',
      `${order.shopifyOrderName} (${order.collectorName}) removed — ${order.removedReason}`,
      { orderIds: [order.id], reason: order.removedReason },
    );
    await this.settle(undefined);
  }

  // --- approval queue ----------------------------------------------------

  async listApprovalQueue(): Promise<PendingSendItem[]> {
    const items = [...this._store.sends.values()]
      .filter((s) => s.status === 'pending_approval' || s.status === 'held')
      .sort(
        (a, b) =>
          a.scheduledDate.localeCompare(b.scheduledDate) || a.createdAt.localeCompare(b.createdAt),
      )
      .map((send): PendingSendItem => {
        const release = this.mustGet(this._store.releases, send.releaseId, 'release');
        const batch = this.mustGet(this._store.batches, send.batchId, 'batch');
        return {
          send,
          release,
          batch,
          recipientCount: this.activeBatchOrders(send.batchId).length,
          releaseBatchCount: this.releaseBatches(release.id).length,
          lastSent: this.lastSentInfo(send.batchId),
        };
      });
    return this.settle(items);
  }

  private requireAdmin(): User {
    const user = this.currentUser();
    if (user.role !== 'admin') {
      throw new Error('Only admins can approve or hold sends');
    }
    return user;
  }

  async approveSend(sendId: string): Promise<ScheduledSend> {
    const user = this.requireAdmin();
    const send = this.mustGet(this._store.sends, sendId, 'send');
    if (send.status !== 'pending_approval') {
      throw new Error(`Only pending sends can be approved (this one is ${send.status})`);
    }
    send.status = 'approved';
    send.approvedAt = this.now().toISOString();
    send.approvedBy = user.id;
    this._addEvent(
      send.releaseId,
      send.batchId,
      'send_approved',
      `“${send.subject}” approved — queued for ${formatDay(send.scheduledDate)}`,
      { sendId: send.id },
    );
    return this.settle(send);
  }

  async holdSend(sendId: string): Promise<ScheduledSend> {
    const user = this.requireAdmin();
    const send = this.mustGet(this._store.sends, sendId, 'send');
    if (send.status !== 'pending_approval') {
      throw new Error(`Only pending sends can be held (this one is ${send.status})`);
    }
    send.status = 'held';
    send.heldAt = this.now().toISOString();
    send.heldBy = user.id;
    this._addEvent(send.releaseId, send.batchId, 'send_held', `“${send.subject}” held`, {
      sendId: send.id,
    });
    return this.settle(send);
  }

  async unholdSend(sendId: string): Promise<ScheduledSend> {
    this.requireAdmin();
    const send = this.mustGet(this._store.sends, sendId, 'send');
    if (send.status !== 'held') {
      throw new Error(`Only held sends can be released (this one is ${send.status})`);
    }
    send.status = 'pending_approval';
    send.heldAt = undefined;
    send.heldBy = undefined;
    this._addEvent(
      send.releaseId,
      send.batchId,
      'send_released',
      `“${send.subject}” released from hold — back in the pending queue`,
      { sendId: send.id },
    );
    return this.settle(send);
  }

  // --- send detail -------------------------------------------------------

  async getSendDetail(sendId: string): Promise<SendDetailView> {
    const send = this.mustGet(this._store.sends, sendId, 'send');
    const release = this.mustGet(this._store.releases, send.releaseId, 'release');
    const batch = this.mustGet(this._store.batches, send.batchId, 'batch');
    return this.settle({
      send,
      release,
      batch,
      prospectiveRecipients: this.activeBatchOrders(send.batchId),
      releaseBatchCount: this.releaseBatches(release.id).length,
      lastSent: this.lastSentInfo(send.batchId),
    });
  }
}
