/**
 * Core domain types for the post-purchase comms tool.
 *
 * The shape here is the contract between the UI, the pure logic modules
 * (plan generation, reschedule, import) and the data layer. Phase 1 backs it
 * with an in-memory mock; phase 2 swaps in Postgres behind the same interface.
 *
 * Dates: calendar-day values (promise dates, scheduled send dates) are ISO
 * `YYYY-MM-DD` strings. Instants (audit timestamps) are full ISO datetimes.
 */

export type Role = 'operator' | 'admin';

/**
 * Which side of a handoff somebody sits on.
 *
 * Not a second permissions axis — `role` is still the only thing the data
 * layer gates on. A team is an ADDRESS: work raised by one team and owed by
 * another has to be addressed to a standing group rather than a person,
 * because a person goes on holiday and the delay notice does not wait.
 */
export type Team = 'crm' | 'ops';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  team: Team;
}

export type ReleaseStatus = 'active' | 'completed';

/** Drives which milestone sequence a plan uses. */
export type ProductKind = 'print' | 'sculpture';

/**
 * Release-level copy override for one email. Absent fields fall back to the
 * master template. Stored with tokens intact — patching happens when a send
 * is generated, so overrides apply to every batch, whatever its dates.
 */
export interface ReleaseTemplateOverride {
  subject?: string;
  headline?: string;
  body?: string;
}

/**
 * Image slots a release fills for its emails.
 *
 * A milestone email has one slot. The on-track email has AS MANY as the
 * release's longest dispatch window needs — a five-month window sends more
 * "still on track" updates than a two-month one, and each gets its own
 * picture rather than cycling three round, so no collector sees the same
 * image twice on one release. `onTrackSlotsNeeded` in `logic/templates.ts`
 * is where the count comes from; it is a function of the dates, which is why
 * the number is not fixed here.
 *
 * Phase 1 stores a picked image name; phase 2 swaps in HubSpot image URLs.
 */
export type OnTrackSlot = `pp-ontrack-${number}`;

export type ImageSlot =
  | 'pp-printing'
  | 'pp-signing'
  | 'pp-framing'
  | 'pp-dispatch'
  | 'pp-delay'
  | OnTrackSlot;

/**
 * One image in the library the email picker chooses from.
 *
 * `url` is absent for the names the HubSpot masters already carry — phase 1
 * has no file for those, and the picker says so with a hatch rather than
 * drawing a broken thumbnail.
 */
export interface LibraryImage {
  name: string;
  url?: string;
  /** True for something a person added here rather than a seeded name. */
  uploaded?: boolean;
}

/**
 * Which Shopify line-item titles a release claims — the join key, and the one
 * thing in this app that must match an external system exactly.
 *
 * It used to be the release TITLE, typed into a form and explained in a
 * tooltip: get a character wrong and the import succeeded with nothing in it.
 * Now it is the set of exact strings an operator TICKED off the file itself,
 * so the string that has to be right is one nobody typed — and it is the same
 * string the Shopify sync will match on, which is why the title is free to be
 * a display name again.
 *
 * Claimed EXCLUSIVELY: no two releases may claim the same string, which is
 * what stops two people importing the same export into two releases.
 */
export interface ProductMatch {
  lineItemTitles: string[];
  /** A second correlate for sync day. Never the matcher. */
  skus: string[];
  /** Empty until the sync writes it; then it is the join and titles the fallback. */
  shopifyProductIds: string[];
  confirmedAt: string | null;
  confirmedBy: string | null;
}

/** Where a batch of orders came in from. CSV today, the API later. */
export interface IntakeSource {
  kind: 'csv_upload' | 'shopify_sync';
  /** A file name, or "Shopify". Reported, never drawn in a page head. */
  label: string;
}

/**
 * One arrival of orders. The record that makes an import undoable — and the
 * reason the flow can afford to create a release and 294 orders in one press.
 */
export interface Intake {
  id: string;
  releaseId: string;
  source: IntakeSource;
  at: string;
  by: string;
  summary: ImportSummary;
  newestOrderDate: string | null;
}

export type IntakeNoteKind =
  | 'duplicate_row'
  | 'no_email'
  | 'no_collector_name'
  | 'both_batches'
  | 'other_release'
  | 'quantity'
  | 'not_paid'
  | 'frame_without_print';

/**
 * Something in the file worth knowing before the write, in three short cells.
 *
 * Never a sentence: `Cap` is 27 characters and the house rule is that a cell
 * is never two lines, so "#AA10418 — framed and unframed, two dates, two email
 * streams" renders as an ellipsis and the point is lost on every row.
 */
export interface IntakeNote {
  kind: IntakeNoteKind;
  /** "#AA10418" */
  order: string;
  /** A fixed vocabulary word: "Two batches", "No email". */
  what: string;
  /** A few words: "Framed + Unframed". */
  detail: string;
}

export interface Release {
  id: string;
  title: string;
  artist: string;
  /** The Shopify join. Empty until an operator confirms one. */
  productMatch: ProductMatch;
  editionSize: number | null;
  status: ReleaseStatus;
  productKind: ProductKind;
  /**
   * Milestones switched off for this release (e.g. no framing email for an
   * unframed-only release). `pp-dispatch` can never be disabled — it anchors
   * every plan.
   */
  disabledTemplates: TemplateRef[];
  /** Release-level custom copy, keyed by template. Applies to every batch. */
  templateOverrides: Partial<Record<TemplateRef, ReleaseTemplateOverride>>;
  /** Hero image picked per slot; unset slots use the HubSpot master's image. */
  templateImages: Partial<Record<ImageSlot, string>>;
  /**
   * Who approves this release's emails — a user id, always set. The owner,
   * 1 Sep 2026: "for each release we should be able to set the approver. For
   * the time being, it's Elani for every one." Naming is not gating: any
   * admin can still approve (a named approver goes on holiday and the delay
   * notice does not wait) — this says whose list the work sits on.
   */
  approverId: string;
  createdAt: string;
}

/**
 * One warehouse allocation row for an order: what is physically being made
 * and which edition number it received. Mirrors the warehouse edition
 * allocation sheet (Order Number / Print Name / Fulfilment / Frame Finish /
 * Glass / Mounting Type / Set_Size / Edition No.). An order has one entry
 * per print — multi-print releases have several.
 */
export interface OrderAllocation {
  printName: string;
  /** "Framed" / "Print Only" — as the warehouse tracks it. */
  fulfilment: string;
  frameFinish: string | null;
  glass: string | null;
  mountingType: string | null;
  setSize: number | null;
  /** Kept as text: numbered editions ("34") and proofs ("AP") both occur. */
  editionNumber: string | null;
}

export interface Order {
  id: string;
  releaseId: string;
  batchId: string;
  /** Shopify order name, e.g. "#AA10412" — half of the dedupe key. */
  shopifyOrderName: string;
  /** Full line item title from the export, e.g. "Falling Light - Framed" — the other half. */
  lineItemTitle: string;
  collectorName: string;
  email: string | null;
  /** Resolved from email at import time; null means "flagged, no contact found". */
  hubspotContactId: string | null;
  /** Parsed variant, e.g. "Framed" / "Unframed" / "Sculpture". */
  variant: string;
  orderDate: string;
  /** Shipping country from the export, falling back to billing. */
  country: string | null;
  /** Shopify order tags, as exported (comma-separated there, split here). */
  shopifyTags: string[];
  /** Warehouse edition allocation rows, set by the allocation CSV import. */
  allocations?: OrderAllocation[];
  /** The arrival that created it — what `undoIntake` unwinds. */
  intakeId: string;
  /** When this tool created it. `orderDate` is when it was bought. */
  importedAt: string;
  quantity: number;
  sku: string | null;
  /** The frame line this print absorbed at intake, as the FILE's facts. A
      frame is its own Shopify line item and is not stored as an order, so its
      title and SKU are kept here — they are what the edition allocator derives
      the finish and glass from. Null on an unframed order, and on orders
      imported before frames were absorbed. */
  frameLineItemTitle?: string | null;
  frameSku?: string | null;
  /** Read from the export, refreshed on re-import, never acted on. */
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  /** "csv:#AA10412" now, "shopify:5312…" after the sync. Namespaced on purpose. */
  sourceOrderRef: string;
  removed: boolean;
  removedAt?: string;
  removedBy?: string;
  removedReason?: string;
}

/**
 * Print orders ship on separate framed/unframed timelines: framing adds
 * weeks and its own milestone email. Print batches therefore always carry a
 * fulfilment; sculpture batches don't split this way.
 */
export type BatchFulfilment = 'framed' | 'unframed';

export interface Batch {
  id: string;
  releaseId: string;
  name: string;
  /** ISO date or null while unset; setting it triggers plan generation. */
  promiseDate: string | null;
  isDefault: boolean;
  /** Set for print batches; unframed batches skip the framing email. */
  fulfilment?: BatchFulfilment;
  /**
   * The batch this one was split from, when it was created by a reschedule
   * split. Lineage matters: a split batch's collectors received everything
   * its source batch sent before the split, and reschedules must not repeat
   * those milestones.
   */
  sourceBatchId?: string;
  createdAt: string;
}

export type SendType = 'milestone' | 'delay';

export type TemplateRef =
  | 'pp-printing'
  | 'pp-signing'
  | 'pp-framing'
  | 'pp-dispatch'
  | 'pp-ontrack'
  | 'pp-delay';

export type SendStatus =
  | 'draft'
  /**
   * Written by nobody yet.
   *
   * The owner, 29 Aug 2026: "When someone schedules a delay, the job of
   * writing the email goes to the CRM team." Before this there was no state
   * between "a delay was scheduled" and "an email is waiting for approval",
   * because the person scheduling the delay wrote the copy on the spot. Now
   * the two acts belong to two teams, and the gap between them is a state
   * something can sit in — visibly, and with a clock on it.
   */
  | 'awaiting_copy'
  | 'pending_approval'
  | 'approved'
  | 'sent'
  | 'cancelled';

/**
 * Why a delay email exists, handed to whoever has to write it.
 *
 * Every fact here was already in the reschedule event log, and reading it
 * back out of the log to brief a copywriter meant joining a send to an event
 * by batch and timestamp. Carrying it ON the send is not duplication — it is
 * the brief, and a brief belongs to the job it briefs.
 */
export interface DelayBrief {
  /** What collectors had been promised. Null if the batch had no date. */
  oldPromiseDate: string | null;
  newPromiseDate: string;
  /** The rescheduler's own words. Required at the door, so never empty. */
  reason: string;
  requestedBy: string;
  requestedAt: string;
}

/**
 * One row of the "What happens next?" card in the real email format —
 * an upcoming milestone with its explanation, already patched with dates.
 */
export interface SendStep {
  templateRef: TemplateRef;
  title: string;
  text: string;
}

export interface SendRecipient {
  orderId: string;
  collectorName: string;
  email: string;
  hubspotContactId: string | null;
  /** HubSpot single-send API send ID, recorded per recipient. */
  hubspotSendId: string | null;
  status: 'sent' | 'failed';
  error?: string;
}

export interface ScheduledSend {
  id: string;
  releaseId: string;
  batchId: string;
  type: SendType;
  templateRef: TemplateRef;
  /** ISO date the cron worker should fire it. */
  scheduledDate: string;
  status: SendStatus;
  subject: string;
  /** The email's H1, pre-filled from the master and editable. */
  headline?: string;
  /** Which release image slot this send draws its hero image from. */
  imageSlot?: ImageSlot;
  /** The picked image for that slot at generation time; master default if unset. */
  imageName?: string;
  /** Editable body copy, pre-filled from the master template with fields patched. */
  body: string;
  /** "What happens next?" rows — the milestones still ahead of this send. */
  nextSteps?: SendStep[];
  /** True once someone edited this send's copy directly — release-level
   *  template edits then leave it alone. */
  copyEdited?: boolean;
  /** Set on a delay send: the brief for whoever writes it. */
  brief?: DelayBrief;
  /** Set when the copy was handed back in and the send left `awaiting_copy`. */
  copyWrittenAt?: string;
  copyWrittenBy?: string;
  createdAt: string;
  createdBy: string;
  approvedAt?: string;
  approvedBy?: string;
  /** Set once sent; from then on the record is immutable log. */
  sentAt?: string;
  /** ID of the cloned-and-published HubSpot email used for this send. */
  hubspotEmailId?: string;
  recipients?: SendRecipient[];
}

export type BatchEventType =
  | 'batch_created'
  | 'promise_date_set'
  | 'reschedule'
  | 'orders_split'
  | 'orders_imported'
  | 'allocation_imported'
  | 'allocation_committed'
  | 'allocation_cleared'
  | 'order_removed'
  | 'plan_edited'
  | 'release_emails_edited'
  | 'copy_requested'
  | 'copy_written'
  | 'send_approved'
  | 'send_sent';

export interface BatchEvent {
  id: string;
  releaseId: string;
  batchId: string;
  type: BatchEventType;
  at: string;
  /** User id, or "system" for cron/import actions. */
  by: string;
  byName: string;
  description: string;
  data: {
    oldDate?: string | null;
    newDate?: string;
    reason?: string;
    sendId?: string;
    orderIds?: string[];
    fromBatchId?: string;
    [key: string]: unknown;
  };
}

/**
 * What one team raises for another. Today there is exactly one kind, and the
 * type is a union of one on purpose: the second kind will want its own copy,
 * its own destination and its own count, and a `kind: string` invites all
 * three to be invented at the call site.
 */
export type NotificationKind = 'delay_copy_requested';

export interface Notification {
  id: string;
  kind: NotificationKind;
  /** Addressed to a team, never a person — see `Team`. */
  team: Team;
  sendId: string;
  releaseId: string;
  batchId: string;
  /** One line, already written — phase 2 puts this in a Slack message. */
  title: string;
  detail: string;
  createdAt: string;
  createdBy: string;
  readAt?: string;
  readBy?: string;
}

/**
 * Something wrong with the FILE rather than with a row in it.
 *
 * The two used to share a channel, so an empty file was drawn as "1 row could
 * not be read" over the body "Everything else was imported." A fault is not a
 * row: it stops the flow before anything is written, and it is said in its own
 * words rather than counted.
 *
 * The design this came from also proposed an `all_rows_failed` fault, for a
 * file whose every row carries the same unreadable date. It is deliberately
 * NOT here: the parser's stated philosophy is that a row with a missing field
 * is "imported and flagged, never dropped", and a fault would drop a whole
 * file of otherwise-good collectors over a date column nothing plans against.
 * The real complaint was 296 copies of one sentence in a dialogue, which is a
 * reporting problem and is fixed by collapsing identical issues where they are
 * drawn.
 */
export interface ParseFault {
  kind: 'empty' | 'wrong_separator' | 'not_an_export' | 'no_rows';
  detail: string;
  /** The columns the file DID have — what identifies a file dropped by mistake. */
  columnsFound?: string[];
}

export interface ImportRowIssue {
  row: number;
  reason: string;
}

export interface ImportSummary {
  rowsParsed: number;
  newOrders: number;
  /**
   * Distinct Shopify order names behind `newOrders` — a DIFFERENT quantity,
   * because an order is one row per print. One Shopify order buying a framed
   * and an unframed print is two orders here and one there, so the two totals
   * are stated rather than one of them guessed at.
   */
  shopifyOrders: number;
  /** Distinct people. Not orders, and not rows. */
  collectors: number;
  /** Existing orders this file re-states. A repeat WITHIN the file is a note. */
  duplicatesSkipped: number;
  /** Cancelled here, offered again by a fresher export, and not resurrected. */
  stillCancelled: number;
  /** Batches this arrival brought into existence. */
  batchesCreated: { batchId: string; name: string }[];
  /** Everything worth knowing before the write. None of it blocks. */
  notes: IntakeNote[];
  /** Line-item rows that didn't match this release's products. */
  filteredOut: number;
  /** Orders created without a HubSpot contact match — flagged, not dropped. */
  missingHubspotContact: number;
  /** Orders created with no email address at all. */
  missingEmail: number;
  issues: ImportRowIssue[];
}

/** Result of importing the warehouse edition allocation CSV. */
export interface AllocationImportSummary {
  rowsParsed: number;
  /** Orders in this release that received allocation data. */
  matchedOrders: number;
  /** Allocation rows applied across those orders. */
  allocationsApplied: number;
  /** Order numbers in the CSV with no matching order in this release. */
  unmatchedOrderNumbers: string[];
  /** Active orders still without any allocation after the import. */
  ordersWithoutAllocation: number;
  issues: ImportRowIssue[];
}

/** The last email a batch's collectors actually received (lineage-aware). */
export interface LastSentInfo {
  sendId: string;
  subject: string;
  templateRef: TemplateRef;
  type: SendType;
  sentAt: string;
  /** Batch the send went out on — the source batch, for splits. */
  batchName: string;
}

/** One upcoming send, summarised for the releases index popover. */
export interface UpcomingSendInfo {
  sendId: string;
  scheduledDate: string;
  templateRef: TemplateRef;
  type: SendType;
  batchName: string;
  recipientCount: number;
}

/** Denormalised row for the releases index screen. */
export interface ReleaseSummary {
  release: Release;
  orderCount: number;
  batchCount: number;
  nextScheduledSend: ScheduledSend | null;
  /** The next few scheduled sends (soonest first), for the index popover. */
  upcomingSends: UpcomingSendInfo[];
  pendingApprovalCount: number;
  /** Any send pending/approved whose scheduled date is in the past. */
  overdueCount: number;
}

/** Row for the batches overview: one batch joined with its release. */
export interface BatchListItem {
  release: Release;
  batch: Batch;
  /** Active (not removed) orders in the batch. */
  collectorCount: number;
  /** 1 means "don't talk about batches" — same convention as the queue. */
  releaseBatchCount: number;
}

/** Everything the release detail screen needs in one fetch. */
export interface ReleaseDetail {
  release: Release;
  batches: Batch[];
  orders: Order[];
  sends: ScheduledSend[];
  events: BatchEvent[];
  /** Newest first. What "Undo this import" acts on. */
  intakes: Intake[];
}

/** Row for the global approval queue, joined with display context. */
export interface PendingSendItem {
  send: ScheduledSend;
  release: Release;
  batch: Batch;
  recipientCount: number;
  /** How many batches the release has — 1 means "don't talk about batches". */
  releaseBatchCount: number;
  /** The last email these collectors received, for reviewer context. */
  lastSent: LastSentInfo | null;
}

/**
 * One delay email waiting to be written, joined with the context its writer
 * needs before they can write a word of it.
 */
export interface CopyJobItem {
  send: ScheduledSend;
  release: Release;
  batch: Batch;
  recipientCount: number;
  /** 1 means "don't talk about batches" — same convention as the queue. */
  releaseBatchCount: number;
  /** The notification that raised it; null once somebody has read it. */
  notification: Notification | null;
}

export interface RescheduleInput {
  releaseId: string;
  batchId: string;
  /** Orders the operator selected. Subset of the batch → split. */
  orderIds: string[];
  newPromiseDate: string;
  reason: string;
  userId: string;
}

export interface RescheduleResult {
  /** The batch the selection ended up in (new one if a split happened). */
  batch: Batch;
  splitOccurred: boolean;
  delaySend: ScheduledSend;
  regeneratedSends: ScheduledSend[];
}
