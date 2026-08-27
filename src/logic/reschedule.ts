import type {
  Batch,
  BatchEvent,
  Order,
  Release,
  RescheduleInput,
  ScheduledSend,
  TemplateRef,
  User,
} from '../types';
import { formatDay } from './dates';
import { defaultSequenceFor, generateMilestonePlan } from './plan';
import { renderTemplate } from './templates';

/**
 * The reschedule flow, as a pure change-set builder.
 *
 * Given the operator's input and a snapshot of the affected batch, produce
 * everything that must change — new batch (if the selection was a subset),
 * moved orders, cancelled sends, the delay send, the regenerated milestone
 * plan, and history events. The data layer applies the change-set
 * atomically; keeping the decision logic pure makes it testable and reusable
 * verbatim when Postgres replaces the mock in phase 2.
 *
 * Semantics (from the brief):
 *  1. subset of a batch selected → split into a new batch;
 *  2. the new batch gets the new promise date;
 *  3. a delay send (reason required, editable body) goes to the front of the
 *     plan, scheduled for today;
 *  4. remaining milestones are regenerated against the new date;
 *  5. every new send lands in the approval queue as pending.
 */

export interface RescheduleContext {
  release: Release;
  /** The batch the selected orders currently belong to. */
  batch: Batch;
  /** Active (non-removed) orders in that batch. */
  batchOrders: Order[];
  /** All sends currently attached to that batch. */
  batchSends: ScheduledSend[];
  /** Names of every batch in the release, for naming a split batch. */
  allBatchNames: string[];
  nowDay: string;
  nowIso: string;
  user: User;
  /** ID factory — injected so the function stays pure. */
  newId: (prefix: string) => string;
}

export interface RescheduleChangeSet {
  splitOccurred: boolean;
  /** Present only when a split happened. */
  newBatch: Batch | null;
  /** Batch that ends up owning the selection and the new plan. */
  targetBatchId: string;
  newPromiseDate: string;
  movedOrderIds: string[];
  /** Unsent sends superseded by the regenerated plan (whole-batch case only). */
  cancelledSendIds: string[];
  /** Delay send first, then regenerated milestones — all pending approval. */
  newSends: ScheduledSend[];
  events: BatchEvent[];
}

/**
 * "Regenerate the REMAINING milestone schedule": stages this batch has
 * already been told about must not repeat. A split batch inherits the source
 * batch's sent story — those collectors received the same emails. The
 * dispatch step is the one legitimate repeat (a delayed batch gets a fresh
 * dispatch email at the new date).
 */
export function remainingSequence(
  kind: Release['productKind'],
  batchSends: Pick<ScheduledSend, 'status' | 'type' | 'templateRef'>[],
): TemplateRef[] {
  const sentRefs = new Set(
    batchSends
      .filter((s) => s.status === 'sent' && s.type === 'milestone')
      .map((s) => s.templateRef),
  );
  const sequence = defaultSequenceFor(kind).filter(
    (ref) => ref === 'pp-dispatch' || !sentRefs.has(ref),
  );
  return sequence.includes('pp-dispatch') ? sequence : [...sequence, 'pp-dispatch'];
}

export function nextBatchName(existingNames: string[]): string {
  let max = 0;
  for (const name of existingNames) {
    const m = /batch\s+(\d+)/i.exec(name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `Batch ${Math.max(max, existingNames.length) + 1}`;
}

export function planReschedule(
  input: RescheduleInput,
  ctx: RescheduleContext,
): RescheduleChangeSet {
  const { release, batch, batchOrders, batchSends, nowDay, nowIso, user } = ctx;

  if (input.orderIds.length === 0) {
    throw new Error('Select at least one order to reschedule');
  }
  const activeIds = new Set(batchOrders.filter((o) => !o.removed).map((o) => o.id));
  for (const id of input.orderIds) {
    if (!activeIds.has(id)) {
      throw new Error(`Order ${id} is not an active order in ${batch.name}`);
    }
  }
  if (!input.reason.trim()) {
    throw new Error('A reason is required for every reschedule');
  }

  const splitOccurred = input.orderIds.length < activeIds.size;
  const oldPromiseDate = batch.promiseDate;

  let targetBatch: Batch;
  let newBatch: Batch | null = null;
  if (splitOccurred) {
    newBatch = {
      id: ctx.newId('batch'),
      releaseId: release.id,
      name: nextBatchName(ctx.allBatchNames),
      promiseDate: input.newPromiseDate,
      isDefault: false,
      createdAt: nowIso,
    };
    targetBatch = newBatch;
  } else {
    targetBatch = { ...batch, promiseDate: input.newPromiseDate };
  }

  // Whole-batch reschedule supersedes that batch's unsent sends. On a split
  // the source batch keeps its plan untouched — its remaining orders are
  // still on the old story.
  const cancelledSendIds = splitOccurred
    ? []
    : batchSends.filter((s) => s.status !== 'sent' && s.status !== 'cancelled').map((s) => s.id);

  const delaySend: ScheduledSend = {
    id: ctx.newId('send'),
    releaseId: release.id,
    batchId: targetBatch.id,
    type: 'delay',
    templateRef: 'pp-delay',
    scheduledDate: nowDay,
    status: 'pending_approval',
    subject: input.delaySubject,
    body: input.delayBody,
    createdAt: nowIso,
    createdBy: user.id,
  };

  const milestoneFields = {
    artist: release.artist,
    release_title: release.title,
    promise_date: formatDay(input.newPromiseDate),
  };
  const plannedSteps = generateMilestonePlan(nowDay, input.newPromiseDate, release.productKind, {
    sequence: remainingSequence(release.productKind, batchSends),
  });
  const milestoneSends: ScheduledSend[] = plannedSteps.map((step) => {
    const rendered = renderTemplate(step.templateRef, milestoneFields);
    return {
      id: ctx.newId('send'),
      releaseId: release.id,
      batchId: targetBatch.id,
      type: 'milestone' as const,
      templateRef: step.templateRef,
      scheduledDate: step.scheduledDate,
      status: 'pending_approval' as const,
      subject: rendered.subject,
      body: rendered.body,
      createdAt: nowIso,
      createdBy: user.id,
    };
  });

  const events: BatchEvent[] = [];
  if (splitOccurred && newBatch) {
    events.push({
      id: ctx.newId('event'),
      releaseId: release.id,
      batchId: newBatch.id,
      type: 'batch_created',
      at: nowIso,
      by: user.id,
      byName: user.name,
      description: `${newBatch.name} created from ${batch.name} (${input.orderIds.length} order${input.orderIds.length === 1 ? '' : 's'})`,
      data: { fromBatchId: batch.id, orderIds: input.orderIds },
    });
    events.push({
      id: ctx.newId('event'),
      releaseId: release.id,
      batchId: batch.id,
      type: 'orders_split',
      at: nowIso,
      by: user.id,
      byName: user.name,
      description: `${input.orderIds.length} order${input.orderIds.length === 1 ? '' : 's'} split out to ${newBatch.name} for reschedule`,
      data: { toBatchId: newBatch.id, orderIds: input.orderIds },
    });
  }
  events.push({
    id: ctx.newId('event'),
    releaseId: release.id,
    batchId: targetBatch.id,
    type: 'reschedule',
    at: nowIso,
    by: user.id,
    byName: user.name,
    description: `Delivery rescheduled from ${formatDay(oldPromiseDate)} to ${formatDay(input.newPromiseDate)} — ${input.reason.trim()}`,
    data: {
      oldDate: oldPromiseDate,
      newDate: input.newPromiseDate,
      reason: input.reason.trim(),
    },
  });

  return {
    splitOccurred,
    newBatch,
    targetBatchId: targetBatch.id,
    newPromiseDate: input.newPromiseDate,
    movedOrderIds: splitOccurred ? [...input.orderIds] : [],
    cancelledSendIds,
    newSends: [delaySend, ...milestoneSends],
    events,
  };
}

/**
 * Default delay email for the reschedule modal — editable per send, but good
 * enough to ship untouched in the common case.
 */
export function buildDefaultDelayEmail(
  release: Release,
  oldPromiseDate: string | null,
  newPromiseDate: string,
  reason: string,
): { subject: string; body: string } {
  const reasonLine = reason.trim()
    ? reason.trim().replace(/\.?\s*$/, '.')
    : 'Production is taking longer than planned.';
  return renderTemplate('pp-delay', {
    artist: release.artist,
    release_title: release.title,
    promise_date: formatDay(newPromiseDate),
    old_promise_date: oldPromiseDate ? formatDay(oldPromiseDate) : 'the original date',
    reason_line: reasonLine,
  });
}
