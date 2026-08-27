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

export interface Release {
  id: string;
  title: string;
  artist: string;
  shopifyProductIds: string[];
  editionSize: number | null;
  status: ReleaseStatus;
  productKind: ProductKind;
  createdAt: string;
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
  removed: boolean;
  removedAt?: string;
  removedBy?: string;
  removedReason?: string;
}

export interface Batch {
  id: string;
  releaseId: string;
  name: string;
  /** ISO date or null while unset; setting it triggers plan generation. */
  promiseDate: string | null;
  isDefault: boolean;
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
  /** Editable body copy, pre-filled from the master template with fields patched. */
  body: string;
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
  | 'order_removed'
  | 'plan_edited'
  | 'send_approved'
  | 'send_held'
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

/** Denormalised row for the releases index screen. */
export interface ReleaseSummary {
  release: Release;
  orderCount: number;
  batchCount: number;
  nextScheduledSend: ScheduledSend | null;
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
