import type {
  Batch,
  ImportSummary,
  Order,
  PendingSendItem,
  ProductKind,
  Release,
  ReleaseDetail,
  ReleaseSummary,
  RescheduleInput,
  RescheduleResult,
  ScheduledSend,
  TemplateRef,
  User,
} from '../types';

/**
 * The single seam between the UI and storage.
 *
 * Phase 1 backs this with `MockDataLayer` (in-memory, seeded from a Shopify
 * export fixture). Phase 2 replaces it with an implementation that calls the
 * server (Postgres + magic-link auth) — the screens don't change. Keep
 * anything smart out of implementations of this interface: plan generation,
 * reschedule semantics and import parsing live in `src/logic` and are shared
 * by both.
 */

export interface CreateReleaseInput {
  title: string;
  artist: string;
  editionSize: number | null;
  productKind: ProductKind;
  shopifyProductIds?: string[];
}

export interface ImportOptions {
  /** Line-item title matchers; defaults to the release title. */
  titleMatchers?: string[];
}

export interface SendPatch {
  subject?: string;
  body?: string;
  scheduledDate?: string;
}

/** Everything the send detail screen needs in one fetch. */
export interface SendDetailView {
  send: ScheduledSend;
  release: Release;
  batch: Batch;
  /** For unsent sends: the active orders that would receive it today. */
  prospectiveRecipients: Order[];
}

export interface DataLayer {
  // --- session -----------------------------------------------------------
  getCurrentUser(): Promise<User>;
  listUsers(): Promise<User[]>;
  /** Demo affordance in phase 1; replaced by magic-link auth in phase 2. */
  setCurrentUser(userId: string): Promise<User>;

  // --- releases and import ----------------------------------------------
  listReleases(): Promise<ReleaseSummary[]>;
  getRelease(releaseId: string): Promise<ReleaseDetail>;
  createRelease(input: CreateReleaseInput): Promise<Release>;
  /**
   * Parse a Shopify order export, filter to this release's line items,
   * dedupe on order name + line item, resolve HubSpot contacts by email,
   * and create the new orders in the release's default batch. Re-uploading
   * the same or a fresher export is always safe.
   */
  importOrders(releaseId: string, csvText: string, options?: ImportOptions): Promise<ImportSummary>;

  // --- batches and plans -------------------------------------------------
  /**
   * First-time promise date: stores it and generates the milestone plan as
   * drafts. Batches that already have a plan must go through `reschedule`.
   */
  setPromiseDate(batchId: string, promiseDate: string): Promise<void>;
  addSend(batchId: string, templateRef: TemplateRef, scheduledDate: string): Promise<ScheduledSend>;
  updateSend(sendId: string, patch: SendPatch): Promise<ScheduledSend>;
  cancelSend(sendId: string): Promise<ScheduledSend>;
  /** Move a batch's draft sends into the approval queue. Returns how many. */
  submitBatchPlanForApproval(batchId: string): Promise<number>;
  reschedule(input: RescheduleInput): Promise<RescheduleResult>;
  /** Mark an order removed (cancellation/refund): drops out of future sends. */
  removeOrder(orderId: string, reason: string): Promise<void>;

  // --- approval queue ----------------------------------------------------
  /** Pending and held sends across all releases, soonest first. */
  listApprovalQueue(): Promise<PendingSendItem[]>;
  approveSend(sendId: string): Promise<ScheduledSend>;
  holdSend(sendId: string): Promise<ScheduledSend>;
  /** Put a held send back into the pending queue. */
  unholdSend(sendId: string): Promise<ScheduledSend>;

  // --- send detail -------------------------------------------------------
  getSendDetail(sendId: string): Promise<SendDetailView>;
}
