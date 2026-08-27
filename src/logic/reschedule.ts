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
import { daysBetween, formatDay } from './dates';
import { generateMilestonePlan } from './plan';
import {
  buildNextSteps,
  buildTemplateFields,
  effectiveTemplate,
  patchTokens,
  releaseFillerTemplate,
  releaseSequenceFor,
  renderReleaseTemplate,
  shipWindowText,
} from './templates';

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
  /**
   * Sent sends this batch's collectors received while they sat in ancestor
   * batches (before each split). Use `inheritedSentStory` to compute it.
   * Without this, a second reschedule of a split batch would repeat
   * milestones its collectors already received.
   */
  inheritedSentSends: ScheduledSend[];
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
 * The sent sends a batch's collectors received while they belonged to
 * ancestor batches. Walks the `sourceBatchId` lineage: an ancestor's send
 * counts only if it went out before the orders left that ancestor (i.e.
 * before the child batch was created).
 */
export function inheritedSentStory(
  batch: Batch,
  allBatches: Batch[],
  allSends: ScheduledSend[],
): ScheduledSend[] {
  const byId = new Map(allBatches.map((b) => [b.id, b]));
  const inherited: ScheduledSend[] = [];
  let child = batch;
  const visited = new Set<string>([batch.id]);
  while (child.sourceBatchId) {
    const parent = byId.get(child.sourceBatchId);
    if (!parent || visited.has(parent.id)) break;
    visited.add(parent.id);
    const leftAt = child.createdAt;
    for (const send of allSends) {
      if (send.batchId === parent.id && send.status === 'sent' && send.sentAt && send.sentAt < leftAt) {
        inherited.push(send);
      }
    }
    child = parent;
  }
  inherited.sort((a, b) => (a.sentAt ?? '').localeCompare(b.sentAt ?? ''));
  return inherited;
}

/**
 * Everything a batch's collectors have actually received, oldest first:
 * ancestors' sends from before each split, then the batch's own sent sends.
 */
export function sentStoryForBatch(
  batch: Batch,
  allBatches: Batch[],
  allSends: ScheduledSend[],
): ScheduledSend[] {
  const own = allSends.filter(
    (s) => s.batchId === batch.id && s.status === 'sent' && s.sentAt,
  );
  const story = [...inheritedSentStory(batch, allBatches, allSends), ...own];
  story.sort((a, b) => (a.sentAt ?? '').localeCompare(b.sentAt ?? ''));
  return story;
}

/**
 * "Regenerate the REMAINING milestone schedule": stages this batch has
 * already been told about must not repeat. A split batch inherits the source
 * batch's sent story — those collectors received the same emails — so pass
 * inherited sends alongside the batch's own. The dispatch step is the one
 * legitimate repeat (a delayed batch gets a fresh dispatch email at the new
 * date).
 */
export function remainingSequence(
  baseSequence: TemplateRef[],
  batchSends: Pick<ScheduledSend, 'status' | 'type' | 'templateRef'>[],
): TemplateRef[] {
  const sentRefs = new Set(
    batchSends
      .filter((s) => s.status === 'sent' && s.type === 'milestone')
      .map((s) => s.templateRef),
  );
  const sequence = baseSequence.filter(
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
  const { release, batch, batchOrders, batchSends, inheritedSentSends, nowDay, nowIso, user } = ctx;

  const orderIds = [...new Set(input.orderIds)];
  if (orderIds.length === 0) {
    throw new Error('Select at least one order to reschedule');
  }
  const activeIds = new Set(batchOrders.filter((o) => !o.removed).map((o) => o.id));
  for (const id of orderIds) {
    if (!activeIds.has(id)) {
      throw new Error(`Order ${id} is not an active order in ${batch.name}`);
    }
  }
  if (!input.reason.trim()) {
    throw new Error('A reason is required for every reschedule');
  }
  if (!batch.promiseDate) {
    throw new Error(
      `${batch.name} has no promise date yet — set one first so there is a promise to change`,
    );
  }
  if (daysBetween(nowDay, input.newPromiseDate) < 1) {
    throw new Error('The new delivery date must be in the future');
  }

  const splitOccurred = orderIds.length < activeIds.size;
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
      sourceBatchId: batch.id,
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

  const fields = buildTemplateFields(release, input.newPromiseDate);
  const plannedSteps = generateMilestonePlan(nowDay, input.newPromiseDate, release.productKind, {
    sequence: remainingSequence(releaseSequenceFor(release), [
      ...inheritedSentSends,
      ...batchSends,
    ]),
    fillerTemplate: releaseFillerTemplate(release),
  });

  const delayTemplate = effectiveTemplate(release, 'pp-delay');
  const delaySend: ScheduledSend = {
    id: ctx.newId('send'),
    releaseId: release.id,
    batchId: targetBatch.id,
    type: 'delay',
    templateRef: 'pp-delay',
    scheduledDate: nowDay,
    status: 'pending_approval',
    subject: input.delaySubject,
    headline: patchTokens(delayTemplate.headline, fields),
    body: input.delayBody,
    // After a delay notice, "what happens next" is the regenerated plan.
    nextSteps: buildNextSteps(plannedSteps.map((s) => s.templateRef), fields),
    createdAt: nowIso,
    createdBy: user.id,
  };

  const milestoneSends: ScheduledSend[] = plannedSteps.map((step, idx) => {
    const rendered = renderReleaseTemplate(release, step.templateRef, fields);
    return {
      id: ctx.newId('send'),
      releaseId: release.id,
      batchId: targetBatch.id,
      type: 'milestone' as const,
      templateRef: step.templateRef,
      scheduledDate: step.scheduledDate,
      status: 'pending_approval' as const,
      subject: rendered.subject,
      headline: rendered.headline,
      body: rendered.body,
      nextSteps: buildNextSteps(
        plannedSteps.slice(idx + 1).map((s) => s.templateRef),
        fields,
      ),
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
      description: `${newBatch.name} created from ${batch.name} (${orderIds.length} order${orderIds.length === 1 ? '' : 's'})`,
      data: { fromBatchId: batch.id, orderIds },
    });
    events.push({
      id: ctx.newId('event'),
      releaseId: release.id,
      batchId: batch.id,
      type: 'orders_split',
      at: nowIso,
      by: user.id,
      byName: user.name,
      description: `${orderIds.length} order${orderIds.length === 1 ? '' : 's'} split out to ${newBatch.name} for reschedule`,
      data: { toBatchId: newBatch.id, orderIds },
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
    movedOrderIds: splitOccurred ? orderIds : [],
    cancelledSendIds,
    newSends: [delaySend, ...milestoneSends],
    events,
  };
}

/**
 * Default delay email for the reschedule modal — editable per send, but good
 * enough to ship untouched in the common case. Honours the release's custom
 * delay copy when one is set.
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
  const template = effectiveTemplate(release, 'pp-delay');
  const fields = buildTemplateFields(release, newPromiseDate, {
    old_promise_date: oldPromiseDate ? formatDay(oldPromiseDate) : 'the original date',
    reason_line: reasonLine,
    ship_window: shipWindowText(newPromiseDate),
  });
  return {
    subject: patchTokens(template.subject, fields),
    body: patchTokens(template.body, fields),
  };
}
