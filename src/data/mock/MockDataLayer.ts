import type {
  Batch,
  BatchEvent,
  BatchEventType,
  ImportSummary,
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
  SendDetailView,
  SendPatch,
} from '../DataLayer';
import { formatDay, toDay } from '../../logic/dates';
import { filterItemsForRelease, orderDedupeKey, parseShopifyOrderExport } from '../../logic/importer';
import { generateMilestonePlan } from '../../logic/plan';
import { planReschedule } from '../../logic/reschedule';
import { renderTemplate } from '../../logic/templates';

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

  private activeBatchOrders(batchId: string): Order[] {
    return [...this._store.orders.values()].filter((o) => o.batchId === batchId && !o.removed);
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
      const batches = [...this._store.batches.values()].filter(
        (b) => b.releaseId === release.id,
      );
      return {
        release,
        orderCount: orders.length,
        batchCount: batches.length,
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
    const batches = [...this._store.batches.values()]
      .filter((b) => b.releaseId === releaseId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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
    const release: Release = {
      id: this._newId('release'),
      title: input.title.trim(),
      artist: input.artist.trim(),
      shopifyProductIds: input.shopifyProductIds ?? [],
      editionSize: input.editionSize,
      status: 'active',
      productKind: input.productKind,
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
    const defaultBatch = [...this._store.batches.values()].find(
      (b) => b.releaseId === releaseId && b.isDefault,
    );
    if (!defaultBatch) throw new Error(`Release ${releaseId} has no default batch`);

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
    const steps = generateMilestonePlan(this.nowDay(), promiseDate, release.productKind);
    for (const step of steps) {
      const rendered = renderTemplate(step.templateRef, {
        artist: release.artist,
        release_title: release.title,
        promise_date: formatDay(promiseDate),
      });
      const send: ScheduledSend = {
        id: this._newId('send'),
        releaseId: release.id,
        batchId,
        type: 'milestone',
        templateRef: step.templateRef,
        scheduledDate: step.scheduledDate,
        status: 'draft',
        subject: rendered.subject,
        body: rendered.body,
        createdAt: nowIso,
        createdBy: user.id,
      };
      this._store.sends.set(send.id, send);
    }
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
    const rendered = renderTemplate(templateRef, {
      artist: release.artist,
      release_title: release.title,
      promise_date: formatDay(batch.promiseDate),
      old_promise_date: 'the original date',
      reason_line: 'Production is taking longer than planned.',
    });
    const send: ScheduledSend = {
      id: this._newId('send'),
      releaseId: release.id,
      batchId,
      type: templateRef === 'pp-delay' ? 'delay' : 'milestone',
      templateRef,
      scheduledDate,
      status: 'draft',
      subject: rendered.subject,
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
    if (patch.subject !== undefined) send.subject = patch.subject;
    if (patch.body !== undefined) send.body = patch.body;
    if (patch.scheduledDate !== undefined) send.scheduledDate = patch.scheduledDate;
    // Editing an approved send invalidates its approval.
    if (send.status === 'approved') {
      send.status = 'pending_approval';
      send.approvedAt = undefined;
      send.approvedBy = undefined;
    }
    this._addEvent(
      send.releaseId,
      send.batchId,
      'plan_edited',
      `“${send.subject}” edited${send.status === 'pending_approval' ? ' (approval reset)' : ''}`,
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
    const changes = planReschedule(input, {
      release,
      batch,
      batchOrders: [...this._store.orders.values()].filter((o) => o.batchId === batch.id),
      batchSends: this.batchSends(batch.id),
      allBatchNames: [...this._store.batches.values()]
        .filter((b) => b.releaseId === release.id)
        .map((b) => b.name),
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
    });
  }
}
