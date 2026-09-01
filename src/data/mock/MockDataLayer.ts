import type {
  AllocationImportSummary,
  Batch,
  BatchEvent,
  BatchListItem,
  BatchEventType,
  BatchFulfilment,
  CopyJobItem,
  ImageSlot,
  ImportSummary,
  Intake,
  IntakeSource,
  LastSentInfo,
  LibraryImage,
  Notification,
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
  AllocationPlanView,
  CreateReleaseInput,
  DataLayer,
  IntakeInput,
  Claim,
  CreateReleaseResult,
  ReleaseEmailPatch,
  ReleaseEmailUpdateResult,
  SendDetailView,
  SendPatch,
} from '../DataLayer';
import { formatDay, toDay } from '../../logic/dates';
import { allocationOrderKey, parseEditionAllocationCsv } from '../../logic/allocation';
import { DEFAULT_APPROVER_ID } from './fixtures';
import {
  classifyFulfilment,
  orderDedupeKey,
} from '../../logic/importer';
import { generateMilestonePlan } from '../../logic/plan';
import { emptyProductMatch, planIntake } from '../../logic/intake';
import {
  DEFAULT_RULE,
  planAllocation,
  toAllocationInput,
  warehouseCsv,
} from '../../logic/editions';
import type { AllocationOrderInput, AllocationPlan } from '../../logic/editions';
import type { ParsedLineItem } from '../../logic/importer';
import { inheritedSentStory, planReschedule, sentStoryForBatch } from '../../logic/reschedule';
import {
  MASTER_TEMPLATES,
  NOT_WRITTEN_YET,
  NO_IMAGE_YET,
  UNSENT_STATUSES,
  buildNextSteps,
  buildTemplateFields,
  effectiveTemplate,
  imageSlotsForPlan,
  onTrackSlot,
  releaseFillerTemplate,
  renderReleaseTemplate,
  sequenceForBatch,
  IMAGE_OPTIONS,
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
  /** What one team has raised for another, oldest first. */
  notifications: Notification[];
  /** Every arrival of orders, oldest first. What `undoIntake` unwinds. */
  intakes: Intake[];
  /** The email picker's library — seeded names, plus anything uploaded. */
  images: LibraryImage[];
}

/* One list, in the logic layer, so the slot predicate and this class cannot
   disagree about which sends are still changeable. */
const UNSENT: SendStatus[] = UNSENT_STATUSES;

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
      notifications: [],
      intakes: [],
      images: IMAGE_OPTIONS.map((name) => ({ name })),
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

  /**
   * How many PEOPLE an email reaches, which is not how many orders are in the
   * batch. A collector who bought two artworks from one release has two orders
   * and receives one email; an order with no email address receives none. The
   * field is drawn as "N collectors", so it counts collectors.
   */
  private batchRecipientCount(batchId: string): number {
    return new Set(
      this.activeBatchOrders(batchId)
        .map((o) => o.email)
        .filter((e): e is string => Boolean(e)),
    ).size;
  }

  /**
   * Where release-level events land when no more specific batch applies:
   * the oldest batch, or null while a print release has no orders yet.
   */
  private anchorBatch(releaseId: string): Batch | null {
    const batches = this.releaseBatches(releaseId).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    return batches[0] ?? null;
  }

  /**
   * The batch new print orders of a fulfilment land in: the release's
   * "Framed"/"Unframed" batch, created on first use. Sculpture releases
   * keep their single default batch.
   */
  private intakeBatch(release: Release, fulfilment: BatchFulfilment | null): Batch {
    if (release.productKind !== 'print' || fulfilment === null) {
      const existing = this.releaseBatches(release.id).find((b) => b.isDefault);
      if (existing) return existing;
      throw new Error(`Release ${release.id} has no default batch`);
    }
    const existing = this.releaseBatches(release.id).find((b) => b.fulfilment === fulfilment);
    if (existing) return existing;
    const batch: Batch = {
      id: this._newId('batch'),
      releaseId: release.id,
      name: fulfilment === 'framed' ? 'Framed' : 'Unframed',
      promiseDate: null,
      isDefault: true,
      fulfilment,
      createdAt: this.now().toISOString(),
    };
    this._store.batches.set(batch.id, batch);
    this._addEvent(
      release.id,
      batch.id,
      'batch_created',
      `${batch.name} batch created — print orders ship on separate ${fulfilment} timelines`,
    );
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
        .filter((s) => UNSENT.includes(s.status))
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
      const overdue = sends.filter(
        (s) =>
          /* An unwritten delay notice that should have gone out on Tuesday is
             as late as an unapproved one: the collector is owed an email
             either way, and which queue it is stuck in is our problem. */
          (s.status === 'pending_approval' ||
            s.status === 'approved' ||
            s.status === 'awaiting_copy') &&
          s.scheduledDate < today,
      );
      const orders = [...this._store.orders.values()].filter(
        (o) => o.releaseId === release.id && !o.removed,
      );
      return {
        release,
        orderCount: orders.length,
        batchCount: this.releaseBatches(release.id).length,
        nextScheduledSend: upcoming[0] ?? null,
        upcomingSends: upcoming.slice(0, 3).map((s) => ({
          sendId: s.id,
          scheduledDate: s.scheduledDate,
          templateRef: s.templateRef,
          type: s.type,
          batchName: this._store.batches.get(s.batchId)?.name ?? '',
          recipientCount: this.batchRecipientCount(s.batchId),
        })),
        pendingApprovalCount: sends.filter((s) => s.status === 'pending_approval').length,
        overdueCount: overdue.length,
      };
    });
    summaries.sort((a, b) => a.release.title.localeCompare(b.release.title));
    return this.settle(summaries);
  }

  async listBatches(): Promise<BatchListItem[]> {
    /* Same order the releases index reads in — releases by title, a release's
       batches by creation — so the two screens tell one story. */
    const releases = [...this._store.releases.values()].sort((a, b) =>
      a.title.localeCompare(b.title),
    );
    const rows: BatchListItem[] = [];
    for (const release of releases) {
      const batches = this.releaseBatches(release.id).sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      );
      for (const batch of batches) {
        rows.push({
          release,
          batch,
          collectorCount: this.activeBatchOrders(batch.id).length,
          releaseBatchCount: batches.length,
        });
      }
    }
    return this.settle(rows);
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
    const intakes = this._store.intakes
      .filter((i) => i.releaseId === releaseId)
      .sort((a, b) => b.at.localeCompare(a.at));
    return this.settle({ release, batches, orders, sends, events, intakes });
  }

  async createRelease(
    input: CreateReleaseInput,
    intake?: IntakeInput,
  ): Promise<CreateReleaseResult> {
    const nowIso = this.now().toISOString();
    // Dispatch anchors every plan and the delay notice is not a plan
    // milestone — neither can be switched off.
    const disabledTemplates = (input.disabledTemplates ?? []).filter(
      (ref) => ref !== 'pp-dispatch' && ref !== 'pp-delay',
    );
    const claimed = input.productMatch?.lineItemTitles ?? [];
    if (claimed.length > 0) this.refuseClaimed(claimed, null);

    const release: Release = {
      id: this._newId('release'),
      title: input.title.trim(),
      artist: input.artist.trim(),
      productMatch:
        claimed.length > 0
          ? {
              lineItemTitles: claimed,
              skus: input.productMatch?.skus ?? [],
              shopifyProductIds: [],
              confirmedAt: nowIso,
              confirmedBy: this.currentUser().id,
            }
          : emptyProductMatch(),
      editionSize: input.editionSize,
      status: 'active',
      productKind: input.productKind,
      disabledTemplates,
      templateOverrides: {},
      templateImages: {},
      /* "It's Elani for every one" — the standing default until somebody
         names a different admin on the release. */
      approverId: input.approverId ?? DEFAULT_APPROVER_ID,
      createdAt: nowIso,
    };
    if (!release.title) throw new Error('Release title is required');
    if (!release.artist) throw new Error('Artist is required');
    this._store.releases.set(release.id, release);
    // Prints get no batch up front: their Framed/Unframed batches are
    // created by the arrival, from what was actually ordered.
    if (release.productKind !== 'print') {
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
    }

    const record = intake ? this.takeIn(release, intake.items, intake.source) : null;
    return this.settle({ release, intake: record });
  }

  async addOrders(
    releaseId: string,
    items: ParsedLineItem[],
    source: IntakeSource,
  ): Promise<Intake> {
    const release = this.mustGet(this._store.releases, releaseId, 'release');
    /* The first arrival on a release set up without a file is what confirms
       its product match — the fields the create door would otherwise have
       written. Without this the release claims nothing for ever, and a claim
       on nothing now matches nothing. */
    if (release.productMatch.lineItemTitles.length === 0 && items.length > 0) {
      const titles = [...new Set(items.map((i) => i.lineItemTitle))];
      this.refuseClaimed(titles, release.id);
      release.productMatch = {
        ...release.productMatch,
        lineItemTitles: titles,
        confirmedAt: this.now().toISOString(),
        confirmedBy: this.currentUser().id,
      };
    }
    return this.settle(this.takeIn(release, items, source));
  }

  /**
   * The one write path for orders, whatever brought them.
   *
   * The ITEMS are the write. No matcher is consulted and no CSV is parsed here
   * — the caller ticked the products off the file and this stores that
   * decision. It is also the seam the Shopify sync slides into: the same
   * array, built from JSON.
   */
  private takeIn(release: Release, items: ParsedLineItem[], source: IntakeSource): Intake {
    const nowIso = this.now().toISOString();
    const intakeId = this._newId('intake');
    const existing = [...this._store.orders.values()].filter((o) => o.releaseId === release.id);
    const claimed = release.productMatch.lineItemTitles;
    const plan = planIntake(
      items,
      claimed.length > 0 ? claimed : [...new Set(items.map((i) => i.lineItemTitle))],
      existing,
      release.productKind,
    );

    const batchesBefore = new Set(this.releaseBatches(release.id).map((b) => b.id));
    const createdByBatch = new Map<string, string[]>();
    let missingEmail = 0;
    let missingHubspotContact = 0;

    for (const item of plan.create) {
      const hubspotContactId = item.email ? (this.hubspotDirectory[item.email] ?? null) : null;
      const batch = this.intakeBatch(
        release,
        /* The plan's answer, never re-derived here. Framing is a JOIN — a
           frame is its own Shopify line item beside the print — so no reading
           of this item's own title can produce it, and computing it twice is
           how the preview and the write drift apart. */
        release.productKind === 'print'
          ? (plan.fulfilmentByOrder.get(
              orderDedupeKey(item.shopifyOrderName, item.lineItemTitle),
            ) ?? classifyFulfilment(item.lineItemTitle))
          : null,
      );
      const frame = plan.frameLineByOrder.get(
        orderDedupeKey(item.shopifyOrderName, item.lineItemTitle),
      );
      const order: Order = {
        id: this._newId('order'),
        releaseId: release.id,
        batchId: batch.id,
        shopifyOrderName: item.shopifyOrderName,
        lineItemTitle: item.lineItemTitle,
        frameLineItemTitle: frame?.lineItemTitle ?? null,
        frameSku: frame?.sku ?? null,
        collectorName: item.collectorName,
        email: item.email,
        hubspotContactId,
        variant: item.variant || (release.productKind === 'sculpture' ? 'Sculpture' : ''),
        orderDate: item.orderDate,
        country: item.country,
        shopifyTags: item.shopifyTags,
        intakeId,
        importedAt: nowIso,
        quantity: item.quantity,
        sku: item.sku,
        financialStatus: item.financialStatus,
        fulfillmentStatus: item.fulfillmentStatus,
        sourceOrderRef: `csv:${item.shopifyOrderName}`,
        removed: false,
      };
      this._store.orders.set(order.id, order);
      const list = createdByBatch.get(batch.id) ?? [];
      list.push(order.id);
      createdByBatch.set(batch.id, list);
      if (!item.email) missingEmail += 1;
      else if (!hubspotContactId) missingHubspotContact += 1;
    }

    /* A re-import refreshes what Shopify now says about an order it already
       gave us. Read, stored, reported — never acted on: cancellations are
       marked by hand in this tool and never inferred from a file. */
    for (const item of items) {
      const key = orderDedupeKey(item.shopifyOrderName, item.lineItemTitle);
      const order = existing.find(
        (o) => orderDedupeKey(o.shopifyOrderName, o.lineItemTitle) === key,
      );
      if (order && item.financialStatus) order.financialStatus = item.financialStatus;
      if (order && item.fulfillmentStatus) order.fulfillmentStatus = item.fulfillmentStatus;
    }

    const batchesCreated = this.releaseBatches(release.id)
      .filter((b) => !batchesBefore.has(b.id))
      .map((b) => ({ batchId: b.id, name: b.name }));

    for (const [batchId, orderIds] of createdByBatch) {
      this._addEvent(
        release.id,
        batchId,
        'orders_imported',
        `${orderIds.length} order${orderIds.length === 1 ? '' : 's'} added from ${source.label}`,
        { orderIds, intakeId },
      );
    }

    const summary: ImportSummary = {
      rowsParsed: items.length,
      newOrders: plan.create.length,
      shopifyOrders: plan.shopifyOrders,
      collectors: plan.collectors,
      duplicatesSkipped: plan.alreadyHere,
      stillCancelled: plan.stillCancelled,
      batchesCreated,
      notes: plan.notes,
      filteredOut: items.length - plan.create.length - plan.alreadyHere - plan.stillCancelled,
      missingHubspotContact,
      missingEmail,
      issues: [],
    };
    const record: Intake = {
      id: intakeId,
      releaseId: release.id,
      source,
      at: nowIso,
      by: this.currentUser().id,
      summary,
      newestOrderDate: plan.newestOrderDate,
    };
    this._store.intakes.push(record);
    return record;
  }

  /** Refuses a line-item title another release already claims. */
  private refuseClaimed(titles: string[], exceptReleaseId: string | null): void {
    for (const release of this._store.releases.values()) {
      if (release.id === exceptReleaseId) continue;
      const clash = titles.find((t) => release.productMatch.lineItemTitles.includes(t));
      if (clash) {
        throw new Error(`“${clash}” is already claimed by ${release.title}`);
      }
    }
  }

  async claimantsOf(lineItemTitles: string[]): Promise<Claim[]> {
    const claims: Claim[] = [];
    for (const release of this._store.releases.values()) {
      for (const title of lineItemTitles) {
        if (!release.productMatch.lineItemTitles.includes(title)) continue;
        claims.push({
          lineItemTitle: title,
          releaseId: release.id,
          releaseTitle: release.title,
          orderCount: [...this._store.orders.values()].filter(
            (o) => o.releaseId === release.id && !o.removed,
          ).length,
          createdAt: release.createdAt,
          createdBy: release.productMatch.confirmedBy ?? '',
        });
      }
    }
    return this.settle(claims);
  }

  async setProductMatch(
    releaseId: string,
    match: { lineItemTitles: string[]; skus: string[] },
  ): Promise<Release> {
    const release = this.mustGet(this._store.releases, releaseId, 'release');
    this.refuseClaimed(match.lineItemTitles, releaseId);
    release.productMatch = {
      ...release.productMatch,
      lineItemTitles: match.lineItemTitles,
      skus: match.skus,
      confirmedAt: this.now().toISOString(),
      confirmedBy: this.currentUser().id,
    };
    return this.settle(release);
  }

  async setApprover(releaseId: string, userId: string): Promise<Release> {
    const release = this.mustGet(this._store.releases, releaseId, 'release');
    const user = this._store.users.find((u) => u.id === userId);
    if (!user) throw new Error(`Unknown user: ${userId}`);
    if (user.role !== 'admin') {
      throw new Error(`${user.name} can't approve sends — the approver must be an admin`);
    }
    release.approverId = userId;
    return this.settle(release);
  }

  /**
   * Unwind one arrival.
   *
   * HARD-deletes, and the reason is the dedupe set: a soft-removed order still
   * counts as known (`removed` orders are deliberately kept in it so a
   * cancelled order in a re-uploaded export stays gone), so "removing" the 294
   * orders of a mis-dropped file would silently poison the import of the
   * correct one. Refused the moment anything has sent, because then the
   * collector's inbox is the record and it cannot be unwound.
   */
  async undoIntake(intakeId: string): Promise<void> {
    const intake = this._store.intakes.find((i) => i.id === intakeId);
    if (!intake) throw new Error(`Unknown intake: ${intakeId}`);
    const orders = [...this._store.orders.values()].filter((o) => o.intakeId === intakeId);
    const batchIds = new Set(orders.map((o) => o.batchId));
    const sent = this.releaseSends(intake.releaseId).filter(
      (s) => s.status === 'sent' && batchIds.has(s.batchId),
    );
    if (sent.length > 0) {
      throw new Error(
        `${sent.length} email${sent.length === 1 ? ' has' : 's have'} already gone out to these collectors — this import cannot be undone`,
      );
    }
    for (const order of orders) this._store.orders.delete(order.id);
    for (const { batchId } of intake.summary.batchesCreated) {
      const stillUsed = [...this._store.orders.values()].some((o) => o.batchId === batchId);
      if (stillUsed) continue;
      for (const send of this.batchSends(batchId)) this._store.sends.delete(send.id);
      this._store.batches.delete(batchId);
    }
    this._store.events = this._store.events.filter((e) => e.data.intakeId !== intakeId);
    this._store.intakes = this._store.intakes.filter((i) => i.id !== intakeId);
    await this.settle(undefined);
  }

  async deleteRelease(releaseId: string): Promise<void> {
    const release = this.mustGet(this._store.releases, releaseId, 'release');
    const sent = this.releaseSends(releaseId).filter((s) => s.status === 'sent');
    if (sent.length > 0) {
      throw new Error(
        `${release.title} has sent ${sent.length} email${sent.length === 1 ? '' : 's'} — it cannot be deleted`,
      );
    }
    for (const o of [...this._store.orders.values()]) {
      if (o.releaseId === releaseId) this._store.orders.delete(o.id);
    }
    for (const s of [...this._store.sends.values()]) {
      if (s.releaseId === releaseId) this._store.sends.delete(s.id);
    }
    for (const b of [...this._store.batches.values()]) {
      if (b.releaseId === releaseId) this._store.batches.delete(b.id);
    }
    this._store.events = this._store.events.filter((e) => e.releaseId !== releaseId);
    this._store.intakes = this._store.intakes.filter((i) => i.releaseId !== releaseId);
    this._store.notifications = this._store.notifications.filter(
      (n) => n.releaseId !== releaseId,
    );
    this._store.releases.delete(releaseId);
    await this.settle(undefined);
  }


  async importAllocations(releaseId: string, csvText: string): Promise<AllocationImportSummary> {
    this.mustGet(this._store.releases, releaseId, 'release');
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
        /* The order's OWN recorded fulfilment, via its batch — not a reading of
           its variant. The variant of a real framed order is "Draw" or
           "Pre-order" (the sales channel), so the old test was false for every
           framed order ever imported and both line items of a framed purchase
           fell through to the whole order's rows. */
        const wantFramed =
          this._store.batches.get(order.batchId)?.fulfilment === 'framed' ||
          classifyFulfilment(order.variant) === 'framed';
        // Multi-line-item detection looks at ALL of the order's line items,
        // removed ones included: the sheet reflects the order as placed, so
        // a surviving line item must still take only its own rows.
        const variantRows =
          orders.length > 1
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

    const anchor = this.anchorBatch(releaseId);
    if (matchedOrderIds.length > 0 && anchor) {
      this._addEvent(
        releaseId,
        anchor.id,
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

  /** The allocator's inputs: every active order, framed by its BATCH — the
      recorded routing decision, never a fresh reading of a string. */
  private allocationInputs(releaseId: string): AllocationOrderInput[] {
    return [...this._store.orders.values()]
      .filter((o) => o.releaseId === releaseId && !o.removed)
      .map((o) =>
        toAllocationInput(o, this._store.batches.get(o.batchId)?.fulfilment === 'framed'),
      );
  }

  private allocationView(plan: AllocationPlan): AllocationPlanView {
    return {
      numbered: plan.numbered,
      kept: plan.kept,
      artworks: plan.artworks,
      notes: plan.notes,
      faults: plan.faults,
    };
  }

  async previewAllocation(releaseId: string): Promise<AllocationPlanView> {
    const release = this.mustGet(this._store.releases, releaseId, 'release');
    const plan = planAllocation(this.allocationInputs(releaseId), DEFAULT_RULE, release.editionSize);
    return this.settle(this.allocationView(plan));
  }

  async commitAllocation(releaseId: string): Promise<AllocationPlanView> {
    const release = this.mustGet(this._store.releases, releaseId, 'release');
    const inputs = this.allocationInputs(releaseId);
    const plan = planAllocation(inputs, DEFAULT_RULE, release.editionSize);
    if (plan.faults.length > 0) {
      /* The whole point of the audit. The workbook's checks passed over
         broken data; this one stops the write and says why. */
      throw new Error(`Allocation refused — ${plan.faults[0]}`);
    }
    for (const input of inputs) {
      if (input.existing.length > 0) continue; // a number never moves
      const order = this.mustGet(this._store.orders, input.orderId, 'order');
      order.allocations = structuredClone(plan.byOrder.get(input.orderId) ?? []);
    }
    const anchor = this.anchorBatch(releaseId);
    if (anchor) {
      this._addEvent(
        releaseId,
        anchor.id,
        'allocation_committed',
        `Edition numbers allocated — ${plan.numbered} order${plan.numbered === 1 ? '' : 's'} numbered` +
          (plan.kept > 0 ? `, ${plan.kept} kept` : ''),
      );
    }
    return this.settle(this.allocationView(plan));
  }

  async undoAllocation(releaseId: string): Promise<number> {
    this.mustGet(this._store.releases, releaseId, 'release');
    const holders = [...this._store.orders.values()].filter(
      (o) => o.releaseId === releaseId && (o.allocations?.length ?? 0) > 0,
    );
    for (const order of holders) delete order.allocations;
    const anchor = this.anchorBatch(releaseId);
    if (holders.length > 0 && anchor) {
      this._addEvent(
        releaseId,
        anchor.id,
        'allocation_cleared',
        `Edition numbers cleared — ${holders.length} order${holders.length === 1 ? '' : 's'}`,
      );
    }
    return this.settle(holders.length);
  }

  async allocationCsv(releaseId: string): Promise<{ fileName: string; csv: string }> {
    const release = this.mustGet(this._store.releases, releaseId, 'release');
    /* The STORED rows, never a fresh plan: the file must say what the orders
       say, and an uncommitted preview has no business leaving the building. */
    const inputs = this.allocationInputs(releaseId).filter((i) => i.existing.length > 0);
    const byOrder = new Map(inputs.map((i) => [i.orderId, i.existing]));
    const csv = warehouseCsv(inputs, {
      byOrder,
      numbered: 0,
      kept: inputs.length,
      artworks: [],
      notes: [],
      faults: [],
    });
    const safeTitle = release.title.replace(/[^\w()\- ]+/g, '').trim() || 'release';
    return this.settle({ fileName: `${safeTitle} - Edition Allocation.csv`, csv });
  }

  async updateReleaseEmail(
    releaseId: string,
    templateRef: TemplateRef,
    patch: ReleaseEmailPatch,
  ): Promise<ReleaseEmailUpdateResult> {
    const release = this.mustGet(this._store.releases, releaseId, 'release');
    const templateName = MASTER_TEMPLATES[templateRef].name;
    let updatedSendCount = 0;
    let cancelledSendCount = 0;
    // A release-level edit is logged on every batch it actually touched, so
    // each batch's history explains its own cancelled/reset sends. With no
    // sends touched, the oldest batch carries the record (none exist only
    // while a print release awaits its first import — nothing to log on).
    const emitTo = (batchIds: Set<string>, description: string): void => {
      const anchor = this.anchorBatch(releaseId);
      const targets = batchIds.size > 0 ? [...batchIds] : anchor ? [anchor.id] : [];
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
      emitTo(
        new Set(),
        `“${templateName}” switched back on for this release — future plans will include it`,
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

  async setReleaseEmailImage(
    releaseId: string,
    slot: ImageSlot,
    imageName: string | null,
  ): Promise<Release> {
    const release = this.mustGet(this._store.releases, releaseId, 'release');
    /* A name that is not in the library satisfies no gate — the send would go
       out pointing at nothing. Now that a picked image is the ONLY image an
       email has, an unchecked string is a silent blank hero. */
    if (imageName && !this._store.images.some((i) => i.name === imageName)) {
      throw new Error(`“${imageName}” is not in the image library`);
    }
    if (imageName) release.templateImages[slot] = imageName;
    else delete release.templateImages[slot];
    // Upcoming sends drawing on this slot pick up the new image in place.
    // An image choice is not a copy change: no approval resets, no
    // copyEdited pinning.
    for (const send of this.releaseSends(releaseId)) {
      if (send.imageSlot !== slot) continue;
      if (!UNSENT.includes(send.status)) continue;
      send.imageName = imageName ?? undefined;
    }
    return this.settle(release);
  }

  /**
   * The image library.
   *
   * Seeded from the names the HubSpot masters already use — those have no file
   * behind them in phase 1, so they carry no `url` and the picker draws a
   * hatch. Anything added here is a real data URI and draws the picture.
   */
  async listImages(): Promise<LibraryImage[]> {
    await this.settle(null);
    return this._store.images.map((img) => ({ ...img }));
  }

  async addImage(name: string, dataUrl: string): Promise<LibraryImage[]> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('An image needs a name');
    if (!dataUrl.startsWith('data:image/')) throw new Error('That file is not an image');
    /* A second image with the same name would make the picked name ambiguous
       — `templateImages` stores the NAME, so two files called "Artist
       portrait" are one slot pointing at either. Numbered rather than
       refused: somebody uploading a second studio shot should not have to
       invent a filename to get it in. */
    let unique = trimmed;
    for (let n = 2; this._store.images.some((i) => i.name === unique); n += 1) {
      unique = `${trimmed} (${n})`;
    }
    this._store.images.push({ name: unique, url: dataUrl, uploaded: true });
    return this.listImages();
  }

  async removeOrders(orderIds: string[], reason: string): Promise<number> {
    const user = this.currentUser();
    const why = reason.trim() || 'Removed';
    const touched: Order[] = [];
    for (const id of orderIds) {
      const order = this._store.orders.get(id);
      /* Already removed is not an error: a selection can include a row
         somebody else cancelled while this one was being made. */
      if (!order || order.removed) continue;
      order.removed = true;
      order.removedAt = this.now().toISOString();
      order.removedBy = user.id;
      order.removedReason = why;
      touched.push(order);
    }
    /* One event per batch touched, not one per order: a batch's history is
       read as a story, and forty lines saying the same thing is not one. */
    const byBatch = new Map<string, Order[]>();
    for (const o of touched) {
      const list = byBatch.get(o.batchId);
      if (list) list.push(o);
      else byBatch.set(o.batchId, [o]);
    }
    for (const [batchId, orders] of byBatch) {
      this._addEvent(
        orders[0].releaseId,
        batchId,
        'order_removed',
        `${orders.length} order${orders.length === 1 ? '' : 's'} cancelled — ${why}`,
        { orderIds: orders.map((o) => o.id), reason: why },
      );
    }
    return this.settle(touched.length);
  }

  async moveOrdersToBatch(orderIds: string[], batchId: string): Promise<number> {
    const target = this.mustGet(this._store.batches, batchId, 'batch');
    const moved: Order[] = [];
    const fromCounts = new Map<string, number>();
    for (const id of orderIds) {
      const order = this._store.orders.get(id);
      if (!order || order.removed || order.batchId === batchId) continue;
      if (order.releaseId !== target.releaseId) {
        throw new Error('An order can only move between batches of its own release');
      }
      fromCounts.set(order.batchId, (fromCounts.get(order.batchId) ?? 0) + 1);
      order.batchId = batchId;
      moved.push(order);
    }
    if (moved.length > 0) {
      for (const [from, count] of fromCounts) {
        this._addEvent(
          target.releaseId,
          from,
          'orders_split',
          `${count} order${count === 1 ? '' : 's'} moved to ${target.name}`,
          { orderIds: moved.map((o) => o.id) },
        );
      }
      this._addEvent(
        target.releaseId,
        batchId,
        'orders_split',
        `${moved.length} order${moved.length === 1 ? '' : 's'} moved in`,
        { orderIds: moved.map((o) => o.id) },
      );
    }
    return this.settle(moved.length);
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
      sequence: sequenceForBatch(release, batch),
      fillerTemplate: releaseFillerTemplate(release),
    });
    const imageSlots = imageSlotsForPlan(steps.map((s) => s.templateRef));
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
        imageSlot: imageSlots[idx],
        imageName: release.templateImages[imageSlots[idx]],
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
    /* The next free on-track slot, not always the first. A hand-added on-track
       send used to claim `pp-ontrack-1` whatever the plan was already on,
       which meant two emails shared one picture — and, now that a refusal to
       approve names the slot to go and fix, it would have named the wrong one. */
    const imageSlot: ImageSlot =
      templateRef === 'pp-ontrack'
        ? onTrackSlot(
            this.batchSends(batchId).filter(
              (s) => s.templateRef === 'pp-ontrack' && s.status !== 'cancelled',
            ).length + 1,
          )
        : templateRef;
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
      imageSlot,
      imageName: release.templateImages[imageSlot],
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
    this._store.notifications.push(...changes.notifications);
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

  // --- writing the delay copy --------------------------------------------

  async listCopyQueue(): Promise<CopyJobItem[]> {
    const unread = new Map(
      this._store.notifications
        .filter((n) => n.kind === 'delay_copy_requested' && !n.readAt)
        .map((n) => [n.sendId, n]),
    );
    const items = [...this._store.sends.values()]
      .filter((s) => s.status === 'awaiting_copy')
      /* Soonest-needed first, and an overdue one is the soonest of all —
         the same ordering the approval queue uses, for the same reason. */
      .sort(
        (a, b) =>
          a.scheduledDate.localeCompare(b.scheduledDate) || a.createdAt.localeCompare(b.createdAt),
      )
      .map((send): CopyJobItem => {
        const release = this.mustGet(this._store.releases, send.releaseId, 'release');
        const batch = this.mustGet(this._store.batches, send.batchId, 'batch');
        return {
          send,
          release,
          batch,
          recipientCount: this.batchRecipientCount(send.batchId),
          releaseBatchCount: this.releaseBatches(release.id).length,
          notification: unread.get(send.id) ?? null,
        };
      });
    return this.settle(items);
  }

  async submitDelayCopy(
    sendId: string,
    copy: { subject: string; body: string },
    options: { hold?: boolean } = {},
  ): Promise<ScheduledSend> {
    const user = this.currentUser();
    const send = this.mustGet(this._store.sends, sendId, 'send');
    if (send.status !== 'awaiting_copy') {
      throw new Error(
        `This email is not waiting to be written (it is ${send.status.replace('_', ' ')})`,
      );
    }
    const subject = copy.subject.trim();
    const body = copy.body.trim();
    /* The draft is generated, so both fields always arrive filled — but a
       writer can empty one, and an empty subject line is a send that reaches
       an inbox as a blank row. Refused here rather than only in the dialogue,
       because the dialogue is not the only thing that will ever call this. */
    if (!subject || !body) throw new Error('A delay email needs both a subject and a body');
    send.subject = subject;
    send.body = body;
    /* Written by hand now, whoever started it: release-level template edits
       must leave these words alone from here on. */
    send.copyEdited = true;
    if (options.hold) return this.settle(send);

    send.status = 'pending_approval';
    send.copyWrittenAt = this.now().toISOString();
    send.copyWrittenBy = user.id;
    /* The notification is answered by the work being done, not by the row
       being looked at — so anything still unread on this send closes here
       too, and the badge cannot outlive the job it counted. */
    for (const n of this._store.notifications) {
      if (n.sendId === send.id && !n.readAt) {
        n.readAt = this.now().toISOString();
        n.readBy = user.id;
      }
    }
    this._addEvent(
      send.releaseId,
      send.batchId,
      'copy_written',
      `Delay email written — “${send.subject}” now waiting for approval`,
      { sendId: send.id },
    );
    return this.settle(send);
  }

  async listNotifications(): Promise<Notification[]> {
    const { team } = this.currentUser();
    const items = this._store.notifications
      .filter((n) => n.team === team)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return this.settle(items);
  }

  async markNotificationRead(notificationId: string): Promise<Notification> {
    const notification = this._store.notifications.find((n) => n.id === notificationId);
    if (!notification) throw new Error(`Unknown notification: ${notificationId}`);
    if (!notification.readAt) {
      notification.readAt = this.now().toISOString();
      notification.readBy = this.currentUser().id;
    }
    return this.settle(notification);
  }

  // --- approval queue ----------------------------------------------------

  async listApprovalQueue(): Promise<PendingSendItem[]> {
    const items = [...this._store.sends.values()]
      .filter((s) => s.status === 'pending_approval')
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
          recipientCount: this.batchRecipientCount(send.batchId),
          releaseBatchCount: this.releaseBatches(release.id).length,
          lastSent: this.lastSentInfo(send.batchId),
        };
      });
    return this.settle(items);
  }

  private requireAdmin(): User {
    const user = this.currentUser();
    if (user.role !== 'admin') {
      throw new Error('Only admins can approve sends');
    }
    return user;
  }

  async approveSend(sendId: string): Promise<ScheduledSend> {
    const user = this.requireAdmin();
    const send = this.mustGet(this._store.sends, sendId, 'send');
    /* Named before the generic refusal, because "this one is awaiting_copy"
       tells an approver the state and not the remedy — and the remedy is a
       different team, not a different click. */
    if (send.status === 'awaiting_copy') throw new Error(NOT_WRITTEN_YET);
    if (send.status !== 'pending_approval') {
      throw new Error(`Only pending sends can be approved (this one is ${send.status})`);
    }
    /* THE image gate, and the only one.
     *
     * There is no default any more, so an email with no picture cannot go out
     * — but the refusal belongs here rather than at any of the three places a
     * send is BORN. Approval is where the choice stops being reversible;
     * everything before it is fixable in one click, because
     * `setReleaseEmailImage` backfills every unsent send on the slot and
     * deliberately resets no approvals.
     *
     * Gating plan generation instead was tried on paper and rejected: the
     * number of on-track slots is derived from the date being typed, so a
     * refusal there can demand a slot whose ROW does not exist until the date
     * is saved — an operator picks every image the tab offers and is still
     * refused. It would also refuse to record a slipped delivery date over a
     * missing picture, and the person who pays for that is the collector owed
     * a delay notice.
     *
     * Approval is also the one funnel all three creation paths converge on:
     * reschedule mints its sends already `pending_approval`, so a gate on
     * submit-for-approval would never see them. */
    if (!send.imageName) throw new Error(NO_IMAGE_YET);
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
