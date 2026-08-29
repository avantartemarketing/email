import type {
  Batch,
  BatchEvent,
  Notification,
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
  imageSlotsForPlan,
  patchTokens,
  releaseFillerTemplate,
  renderReleaseTemplate,
  sequenceForBatch,
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
 *  3. a delay send (reason required) goes to the front of the plan, scheduled
 *     for today — UNWRITTEN, with a brief attached and a notification raised
 *     for the CRM team;
 *  4. remaining milestones are regenerated against the new date;
 *  5. the regenerated milestones land in the approval queue as pending; the
 *     delay email joins them only once somebody has written it.
 *
 * ## Why the delay email is not written here
 *
 * The owner, 29 Aug 2026: "When someone schedules a delay, the job of writing
 * the email goes to the CRM team. So we need it to trigger a notification to
 * them and appear in a view where they can see the reason for the delay and
 * write the email."
 *
 * The person who knows the delay is real is a producer or a warehouse lead;
 * the person who should write to two hundred collectors about it is not. The
 * old flow made the rescheduler do both in one dialogue, which meant the copy
 * was written by whoever happened to be holding the news. Splitting the act
 * costs a state (`awaiting_copy`) and buys the right author.
 *
 * The DRAFT is still generated here, from the release's delay template with
 * the reason patched in. That is not the same as writing it: it is the
 * starting point CRM edits, and it means a delay notice is never one blank
 * page away from going out.
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
  /**
   * Delay send first (awaiting copy), then the regenerated milestones
   * (pending approval).
   */
  newSends: ScheduledSend[];
  /** Raised for the team that owes the work — CRM writes the delay email. */
  notifications: Notification[];
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

/**
 * Name for a split batch. Fulfilment batches count within their own flow:
 * splitting "Framed" yields "Framed 2", then "Framed 3". Batches without a
 * fulfilment keep the plain "Batch N" numbering.
 */
export function nextBatchName(existingNames: string[], prefix?: string): string {
  if (prefix) {
    let max = 0;
    for (const name of existingNames) {
      const m = new RegExp(`^${prefix}(?:\\s+(\\d+))?$`, 'i').exec(name.trim());
      if (m) max = Math.max(max, m[1] ? Number(m[1]) : 1);
    }
    return `${prefix} ${Math.max(max, 1) + 1}`;
  }
  let max = 0;
  for (const name of existingNames) {
    const m = /batch\s+(\d+)/i.exec(name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `Batch ${Math.max(max, existingNames.length) + 1}`;
}

const FULFILMENT_PREFIX: Record<string, string> = {
  framed: 'Framed',
  unframed: 'Unframed',
};

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
      name: nextBatchName(
        ctx.allBatchNames,
        batch.fulfilment ? FULFILMENT_PREFIX[batch.fulfilment] : undefined,
      ),
      promiseDate: input.newPromiseDate,
      isDefault: false,
      // The split stays inside its flow: framed orders split into another
      // framed batch, and its plan keeps (or keeps skipping) framing.
      ...(batch.fulfilment ? { fulfilment: batch.fulfilment } : {}),
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
    sequence: remainingSequence(sequenceForBatch(release, batch), [
      ...inheritedSentSends,
      ...batchSends,
    ]),
    fillerTemplate: releaseFillerTemplate(release),
  });
  const imageSlots = imageSlotsForPlan(plannedSteps.map((s) => s.templateRef));

  const delayTemplate = effectiveTemplate(release, 'pp-delay');
  /* The starting point, not the email. Generated from the release's delay
     template with this reschedule's reason patched in, so the writer opens on
     something true rather than on a blank page — and so a delay notice is
     never blocked on prose alone. */
  const draft = buildDefaultDelayEmail(release, oldPromiseDate, input.newPromiseDate, input.reason);
  const delaySend: ScheduledSend = {
    id: ctx.newId('send'),
    releaseId: release.id,
    batchId: targetBatch.id,
    type: 'delay',
    templateRef: 'pp-delay',
    scheduledDate: nowDay,
    /* NOT pending_approval. Nobody has written this yet, and putting an
       auto-drafted email in front of an approver is how a template goes out
       under a human's name. It joins the approval queue when CRM hands it
       back. */
    status: 'awaiting_copy',
    subject: draft.subject,
    headline: patchTokens(delayTemplate.headline, fields),
    imageSlot: 'pp-delay',
    imageName: release.templateImages['pp-delay'],
    body: draft.body,
    // After a delay notice, "what happens next" is the regenerated plan.
    nextSteps: buildNextSteps(plannedSteps.map((s) => s.templateRef), fields),
    brief: {
      oldPromiseDate,
      newPromiseDate: input.newPromiseDate,
      reason: input.reason.trim(),
      requestedBy: user.id,
      requestedAt: nowIso,
    },
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
      imageSlot: imageSlots[idx],
      imageName: release.templateImages[imageSlots[idx]],
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
  const recipientCount = splitOccurred ? orderIds.length : activeIds.size;
  /* The notification, built here rather than by the data layer, so both
     implementations of `DataLayer` raise the same one with the same words —
     and so a reschedule that fails to notify anybody fails a test rather than
     a collector. Phase 2 delivers this to Slack and email; phase 1 delivers
     it to the rail badge and the copy queue, which is the same event with a
     shorter wire. */
  const notifications: Notification[] = [
    {
      id: ctx.newId('notif'),
      kind: 'delay_copy_requested',
      team: 'crm',
      sendId: delaySend.id,
      releaseId: release.id,
      batchId: targetBatch.id,
      /* Same convention as every other surface: a release that never split
         has no batch language anywhere, so the notification must not be where
         "Batch 1" is introduced. */
      title: `${release.title}${
        splitOccurred || ctx.allBatchNames.length > 1 ? ` — ${targetBatch.name}` : ''
      }: delay email to write`,
      detail: `${formatDay(oldPromiseDate)} → ${formatDay(input.newPromiseDate)} for ${recipientCount} collector${recipientCount === 1 ? '' : 's'}. ${input.reason.trim()}`,
      createdAt: nowIso,
      createdBy: user.id,
    },
  ];

  events.push({
    id: ctx.newId('event'),
    releaseId: release.id,
    batchId: targetBatch.id,
    type: 'copy_requested',
    at: nowIso,
    by: user.id,
    byName: user.name,
    description: `Delay email handed to the CRM team to write — ${recipientCount} collector${recipientCount === 1 ? '' : 's'}`,
    data: { sendId: delaySend.id, reason: input.reason.trim() },
  });
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
    notifications,
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
