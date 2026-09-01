import type { ArtworkSummary, EditionNote } from '../logic/editions';
import type { ParsedLineItem } from '../logic/importer';
import type {
  AllocationImportSummary,
  Batch,
  BatchListItem,
  CopyJobItem,
  ImageSlot,
  Intake,
  IntakeSource,
  LastSentInfo,
  LibraryImage,
  Notification,
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
  /** The Shopify line-item titles this release claims, ticked off the file. */
  productMatch?: { lineItemTitles: string[]; skus: string[] };
  /** Milestones switched off for this release (dispatch can't be). */
  disabledTemplates?: TemplateRef[];
  /** Who approves this release's emails. Unset takes the standing default. */
  approverId?: string;
}

/**
 * Orders arriving with a release, so creating one from a file is a single act.
 *
 * The ITEMS are the write. There is no matcher argument and no CSV text: the
 * caller has already read the file and decided which products are this
 * release's, and the layer's job is to store that decision, not to re-derive
 * it. It is also the seam the Shopify sync slides into — the same array, built
 * from JSON instead of from a file.
 */
export interface IntakeInput {
  items: ParsedLineItem[];
  source: IntakeSource;
}

export interface CreateReleaseResult {
  release: Release;
  /** Null when the release was set up without a file. */
  intake: Intake | null;
}

/** Which release, if any, already claims a line-item title. */
export interface Claim {
  lineItemTitle: string;
  releaseId: string;
  releaseTitle: string;
  orderCount: number;
  createdAt: string;
  createdBy: string;
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
  /** Every batch across every release, for the batches overview. */
  listBatches(): Promise<BatchListItem[]>;
  getRelease(releaseId: string): Promise<ReleaseDetail>;
  /**
   * Create a release, optionally with the orders that arrived with it.
   *
   * One call, because it is one decision: the operator dropped a file, ticked
   * the products in it and pressed a button. Splitting it would leave a
   * release that exists with no orders if the second half failed — and the
   * flow has no way to tell them apart from a deliberately empty one.
   */
  createRelease(input: CreateReleaseInput, intake?: IntakeInput): Promise<CreateReleaseResult>;
  /**
   * Add orders to a release, from wherever they came.
   *
   * Deduped on Shopify order + line item, so re-adding the same or a fresher
   * export is always safe. The items are the write: no matcher is consulted,
   * because the caller decided which products belong to this release when it
   * ticked them.
   */
  addOrders(releaseId: string, items: ParsedLineItem[], source: IntakeSource): Promise<Intake>;
  /**
   * Set which Shopify line-item titles this release claims. Refuses a title
   * another release already claims — the check that stops two operators
   * importing one export into two releases.
   */
  setProductMatch(releaseId: string, match: { lineItemTitles: string[]; skus: string[] }): Promise<Release>;
  /**
   * Name who approves this release's emails. Must be an admin — the same
   * standing `approveSend` checks, so the name on the list is always a person
   * who can actually clear it.
   */
  setApprover(releaseId: string, userId: string): Promise<Release>;
  /** Which releases already claim any of these titles. Empty means free. */
  claimantsOf(lineItemTitles: string[]): Promise<Claim[]>;
  /**
   * Unwind one arrival: HARD-deletes the orders it created and any batch it
   * brought into existence. Refused once a send on those batches has fired.
   *
   * Hard, not `removed: true`, deliberately — a soft-removed order stays in
   * the dedupe set (a cancelled order in a re-uploaded export must stay gone),
   * so "removing" 294 orders would poison the re-import of the correct file.
   */
  undoIntake(intakeId: string): Promise<void>;
  /** Refused once any send on the release has fired. */
  deleteRelease(releaseId: string): Promise<void>;
  /**
   * Parse the warehouse edition-allocation sheet and attach allocation rows
   * (print, spec, edition number) to this release's orders by order number.
   * Re-importing replaces each matched order's allocations.
   */
  importAllocations(releaseId: string, csvText: string): Promise<AllocationImportSummary>;
  /**
   * What allocating edition numbers would do, without doing it. Orders that
   * already hold allocation rows — imported from the warehouse sheet or
   * committed here — are PINS: their numbers never move, and a run numbers
   * only the unnumbered around them. Preview and commit run the same pure
   * plan, so they cannot disagree.
   */
  previewAllocation(releaseId: string): Promise<AllocationPlanView>;
  /** Write the previewed numbers. Refused while the plan's audit has faults. */
  commitAllocation(releaseId: string): Promise<AllocationPlanView>;
  /** Clear every allocation row on the release — the ONLY way a number moves.
      Returns how many orders were cleared. */
  undoAllocation(releaseId: string): Promise<number>;
  /** The warehouse file: the sheet's exact eight columns, importable by
      `importAllocations` — the export is proven against the import. */
  allocationCsv(releaseId: string): Promise<{ fileName: string; csv: string }>;
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

  // --- writing the delay copy --------------------------------------------
  /**
   * Every delay email waiting to be written, soonest-needed first.
   *
   * A reschedule mints its delay send `awaiting_copy`, not `pending_approval`
   * — the owner, 29 Aug 2026: "the job of writing the email goes to the CRM
   * team". This is that team's worklist, and it is deliberately NOT filtered
   * by who is asking: the queue belongs to a team, and anybody looking at it
   * should see all of it, including the piece nobody has picked up.
   */
  listCopyQueue(): Promise<CopyJobItem[]>;
  /**
   * Hand the written copy back: saves it and moves the send into the approval
   * queue. `hold: true` saves the words without submitting, for copy that is
   * half-written.
   */
  submitDelayCopy(
    sendId: string,
    copy: { subject: string; body: string },
    options?: { hold?: boolean },
  ): Promise<ScheduledSend>;
  /** What has been raised for the signed-in user's team, newest first. */
  listNotifications(): Promise<Notification[]>;
  /** Mark one read — happens when somebody opens the job it points at. */
  markNotificationRead(notificationId: string): Promise<Notification>;

  // --- approval queue ----------------------------------------------------
  /** Every send waiting on an approver, soonest first. */
  listApprovalQueue(): Promise<PendingSendItem[]>;
  approveSend(sendId: string): Promise<ScheduledSend>;

  // --- send detail -------------------------------------------------------
  getSendDetail(sendId: string): Promise<SendDetailView>;
}

/** The allocation plan as screens read it. The row-level detail stays in the
    data layer; a screen states totals and evidence, and All orders is where
    the numbers themselves are read. */
export interface AllocationPlanView {
  /** Orders this run numbers (or numbered, after a commit). */
  numbered: number;
  /** Orders whose existing numbers were kept — a number never moves. */
  kept: number;
  artworks: ArtworkSummary[];
  notes: EditionNote[];
  /** From the audit. Empty, or the plan cannot be committed. */
  faults: string[];
}
