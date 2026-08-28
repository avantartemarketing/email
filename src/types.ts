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

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
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
 * Image slots a release fills for its emails. Milestone emails have one
 * slot each; the on-track email has three, cycled across a plan's filler
 * sends so collectors never get the same picture twice in a row. Phase 1
 * stores a picked image name; phase 2 swaps in HubSpot image URLs.
 */
export type ImageSlot =
  | 'pp-printing'
  | 'pp-signing'
  | 'pp-framing'
  | 'pp-dispatch'
  | 'pp-ontrack-1'
  | 'pp-ontrack-2'
  | 'pp-ontrack-3'
  | 'pp-delay';

export interface Release {
  id: string;
  title: string;
  artist: string;
  shopifyProductIds: string[];
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
  /** Warehouse edition allocation rows, set by the allocation CSV import. */
  allocations?: OrderAllocation[];
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
  | 'pending_approval'
  | 'approved'
  | 'sent'
  | 'held'
  | 'cancelled';

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
  createdAt: string;
  createdBy: string;
  approvedAt?: string;
  approvedBy?: string;
  heldAt?: string;
  heldBy?: string;
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
  | 'order_removed'
  | 'plan_edited'
  | 'release_emails_edited'
  | 'send_approved'
  | 'send_held'
  | 'send_released'
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

export interface ImportRowIssue {
  row: number;
  reason: string;
}

export interface ImportSummary {
  rowsParsed: number;
  newOrders: number;
  duplicatesSkipped: number;
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

/** Everything the release detail screen needs in one fetch. */
export interface ReleaseDetail {
  release: Release;
  batches: Batch[];
  orders: Order[];
  sends: ScheduledSend[];
  events: BatchEvent[];
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

export interface RescheduleInput {
  releaseId: string;
  batchId: string;
  /** Orders the operator selected. Subset of the batch → split. */
  orderIds: string[];
  newPromiseDate: string;
  reason: string;
  delaySubject: string;
  delayBody: string;
  userId: string;
}

export interface RescheduleResult {
  /** The batch the selection ended up in (new one if a split happened). */
  batch: Batch;
  splitOccurred: boolean;
  delaySend: ScheduledSend;
  regeneratedSends: ScheduledSend[];
}
