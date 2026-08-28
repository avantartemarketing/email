import type {
  AllocationImportSummary,
  Batch,
  ImageSlot,
  ImportSummary,
  LastSentInfo,
  LibraryImage,
  Order,
  PendingSendItem,
  ProductKind,
  Release,
  ReleaseDetail,
  ReleaseSummary,
  RescheduleInput,
  RescheduleResult,
  ScheduledSend,
  SendStep,
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
  /** Milestones switched off for this release (dispatch can't be). */
  disabledTemplates?: TemplateRef[];
}

export interface ImportOptions {
  /** Line-item title matchers; defaults to the release title. */
  titleMatchers?: string[];
}

export interface SendPatch {
  subject?: string;
  headline?: string;
  body?: string;
  nextSteps?: SendStep[];
  scheduledDate?: string;
}

/**
 * Release-level email edit. Copy fields keep their `{{tokens}}` — they are
 * patched per batch when sends are generated or updated. `resetToDefault`
 * drops the release's override for this template entirely.
 */
export interface ReleaseEmailPatch {
  enabled?: boolean;
  subject?: string;
  headline?: string;
  body?: string;
  resetToDefault?: boolean;
}

export interface ReleaseEmailUpdateResult {
  release: Release;
  /** Upcoming sends across all batches re-rendered from the new copy. */
  updatedSendCount: number;
  /** Unsent sends cancelled because the milestone was disabled. */
  cancelledSendCount: number;
}

/** Everything the send detail screen needs in one fetch. */
export interface SendDetailView {
  send: ScheduledSend;
  release: Release;
  batch: Batch;
  /** For unsent sends: the active orders that would receive it today. */
  prospectiveRecipients: Order[];
  /** How many batches the release has — 1 means "don't talk about batches". */
  releaseBatchCount: number;
  /** The last email these collectors received (lineage-aware). */
  lastSent: LastSentInfo | null;
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
  /**
   * Parse the warehouse edition-allocation sheet and attach allocation rows
   * (print, spec, edition number) to this release's orders by order number.
   * Re-importing replaces each matched order's allocations.
   */
  importAllocations(releaseId: string, csvText: string): Promise<AllocationImportSummary>;
  /**
   * Edit the release's email set: toggle a milestone on/off or override its
   * copy. Copy changes re-render every batch's upcoming sends built from
   * that template (individually edited sends are left alone; approved sends
   * return to pending). Disabling cancels the milestone's unsent sends and
   * keeps it out of future plans.
   */
  updateReleaseEmail(
    releaseId: string,
    templateRef: TemplateRef,
    patch: ReleaseEmailPatch,
  ): Promise<ReleaseEmailUpdateResult>;
  /**
   * Pick the hero image for one of the release's email slots (null clears
   * it back to the master's image). Upcoming sends drawing on that slot are
   * updated in place — an image pick never resets approvals.
   */
  setReleaseEmailImage(
    releaseId: string,
    slot: ImageSlot,
    imageName: string | null,
  ): Promise<Release>;
  /**
   * The image library the picker chooses from.
   *
   * Phase 1 seeds it with the names the HubSpot masters already use, which
   * have no file behind them here — `url` is undefined for those and the
   * picker draws the system's "nothing chosen yet" hatch rather than a broken
   * thumbnail. An uploaded image has a real `url` and shows the picture.
   * Phase 2 replaces the whole list with HubSpot's own library.
   */
  listImages(): Promise<LibraryImage[]>;
  /**
   * Add an image to the library and return the whole list.
   *
   * `dataUrl` rather than a file: phase 1 has nowhere to put a file, and a
   * data URI is a real image the picker and the preview can both draw, which
   * is what makes the interaction worth reviewing.
   */
  addImage(name: string, dataUrl: string): Promise<LibraryImage[]>;

  /**
   * Mark several orders cancelled at once, with one reason.
   *
   * The same act as `removeOrder` and the same rules — the collector stops
   * receiving anything, sent emails stay in the log, nothing is refunded in
   * Shopify — done to a selection. A refund run usually arrives as a list, and
   * doing it one row at a time is where a row gets missed.
   */
  removeOrders(orderIds: string[], reason: string): Promise<number>;
  /**
   * Move orders into another batch of the same release.
   *
   * Not a reschedule: the target batch's promise date and comms plan already
   * exist and are not touched. It is the answer to "this collector asked to go
   * with the framed run" — a correction, where a reschedule is a new promise.
   */
  moveOrdersToBatch(orderIds: string[], batchId: string): Promise<number>;

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
  /** Every send waiting on an approver, soonest first. */
  listApprovalQueue(): Promise<PendingSendItem[]>;
  approveSend(sendId: string): Promise<ScheduledSend>;

  // --- send detail -------------------------------------------------------
  getSendDetail(sendId: string): Promise<SendDetailView>;
}
