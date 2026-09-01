import { describe, expect, it } from 'vitest';
import { emptyProductMatch } from '../intake';
import type { Batch, Order, Release, ScheduledSend, User } from '../../types';
import {
  buildDefaultDelayEmail,
  inheritedSentStory,
  nextBatchName,
  planReschedule,
  sentStoryForBatch,
} from '../reschedule';
import type { RescheduleContext } from '../reschedule';

const NOW_DAY = '2026-08-27';
const NOW_ISO = '2026-08-27T10:00:00.000Z';

const release: Release = {
  id: 'rel-1',
  title: 'Falling Light',
  artist: 'Jenny Marlowe',
  productMatch: emptyProductMatch(),
  editionSize: 150,
  status: 'active',
  productKind: 'print',
  disabledTemplates: [],
  templateOverrides: {},
  templateImages: {},
  approverId: 'user-approver',
  createdAt: '2026-05-01T00:00:00.000Z',
};

const user: User = {
  id: 'u-1',
  name: 'Priya N',
  email: 'priya@avantarte.com',
  role: 'operator',
  team: 'ops',
};

function makeBatch(overrides: Partial<Batch> = {}): Batch {
  return {
    id: 'batch-1',
    releaseId: 'rel-1',
    name: 'Batch 1',
    promiseDate: '2026-09-15',
    isDefault: true,
    createdAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeOrder(id: string, overrides: Partial<Order> = {}): Order {
  return {
    id,
    releaseId: 'rel-1',
    batchId: 'batch-1',
    shopifyOrderName: `#AA${id}`,
    lineItemTitle: 'Falling Light - Framed',
    collectorName: `Collector ${id}`,
    email: `${id}@example.com`,
    hubspotContactId: `hs-${id}`,
    variant: 'Framed',
    orderDate: '2026-05-02',
    intakeId: 'intake-1',
    importedAt: '2026-05-02T00:00:00.000Z',
    quantity: 1,
    sku: 'FL-FR',
    financialStatus: 'paid',
    fulfillmentStatus: 'unfulfilled',
    sourceOrderRef: `csv:#AA${id}`,
    country: 'United Kingdom',
    shopifyTags: [],
    removed: false,
    ...overrides,
  };
}

function makeSend(id: string, overrides: Partial<ScheduledSend> = {}): ScheduledSend {
  return {
    id,
    releaseId: 'rel-1',
    batchId: 'batch-1',
    type: 'milestone',
    templateRef: 'pp-signing',
    scheduledDate: '2026-09-01',
    status: 'draft',
    subject: 'subject',
    body: 'body',
    createdAt: '2026-05-01T00:00:00.000Z',
    createdBy: 'u-1',
    ...overrides,
  };
}

function makeCtx(overrides: Partial<RescheduleContext> = {}): RescheduleContext {
  let n = 0;
  return {
    release,
    batch: makeBatch(),
    batchOrders: [makeOrder('o1'), makeOrder('o2'), makeOrder('o3')],
    batchSends: [],
    inheritedSentSends: [],
    allBatchNames: ['Batch 1'],
    nowDay: NOW_DAY,
    nowIso: NOW_ISO,
    user,
    newId: (prefix: string) => `${prefix}-${++n}`,
    ...overrides,
  };
}

function makeInput(orderIds: string[]) {
  return {
    releaseId: 'rel-1',
    batchId: 'batch-1',
    orderIds,
    newPromiseDate: '2026-11-20',
    reason: 'Framing supplier delay',
    userId: 'u-1',
  };
}

describe('planReschedule — subset selection (split)', () => {
  const ctx = makeCtx({
    batchSends: [makeSend('s1', { status: 'pending_approval' }), makeSend('s2', { status: 'sent' })],
  });
  const result = planReschedule(makeInput(['o1', 'o2']), ctx);

  it('creates a new batch carrying the new promise date and its lineage', () => {
    expect(result.splitOccurred).toBe(true);
    expect(result.newBatch).not.toBeNull();
    expect(result.newBatch!.name).toBe('Batch 2');
    expect(result.newBatch!.promiseDate).toBe('2026-11-20');
    expect(result.newBatch!.sourceBatchId).toBe('batch-1');
    expect(result.targetBatchId).toBe(result.newBatch!.id);
    expect(result.movedOrderIds).toEqual(['o1', 'o2']);
  });

  it('leaves the source batch plan untouched', () => {
    expect(result.cancelledSendIds).toEqual([]);
  });

  it('puts the delay send first, scheduled today, waiting to be written', () => {
    const delay = result.newSends[0];
    expect(delay.type).toBe('delay');
    expect(delay.templateRef).toBe('pp-delay');
    expect(delay.scheduledDate).toBe(NOW_DAY);
    /* The whole point of the 29 Aug change: the rescheduler does not write
       this, so it must not arrive in front of an approver. */
    expect(delay.status).toBe('awaiting_copy');
    expect(delay.batchId).toBe(result.targetBatchId);
  });

  it('drafts the delay email rather than leaving the writer a blank page', () => {
    const delay = result.newSends[0];
    expect(delay.subject.length).toBeGreaterThan(0);
    // The reason patched into the generated body — the brief, made visible.
    expect(delay.body).toContain('Framing supplier delay');
  });

  it('attaches the brief the writer works from', () => {
    const { brief } = result.newSends[0];
    expect(brief).toBeDefined();
    expect(brief!.oldPromiseDate).toBe('2026-09-15');
    expect(brief!.newPromiseDate).toBe('2026-11-20');
    expect(brief!.reason).toBe('Framing supplier delay');
    expect(brief!.requestedBy).toBe('u-1');
  });

  it('raises exactly one notification, addressed to CRM and to the delay send', () => {
    expect(result.notifications).toHaveLength(1);
    const [n] = result.notifications;
    expect(n.kind).toBe('delay_copy_requested');
    /* A team, not a person — a person goes on holiday and the delay notice
       does not wait. */
    expect(n.team).toBe('crm');
    expect(n.sendId).toBe(result.newSends[0].id);
    expect(n.detail).toContain('Framing supplier delay');
    expect(n.readAt).toBeUndefined();
  });

  it('gives the delay send the regenerated plan as its next steps', () => {
    const delay = result.newSends[0];
    const milestoneRefs = result.newSends.slice(1).map((s) => s.templateRef);
    expect(delay.nextSteps!.length).toBeGreaterThan(0);
    for (const step of delay.nextSteps!) {
      expect(milestoneRefs).toContain(step.templateRef);
    }
  });

  it('regenerates milestones against the new date, all pending approval', () => {
    const milestones = result.newSends.slice(1);
    expect(milestones.length).toBeGreaterThan(0);
    for (const send of milestones) {
      expect(send.type).toBe('milestone');
      expect(send.status).toBe('pending_approval');
      expect(send.batchId).toBe(result.targetBatchId);
    }
    expect(milestones[milestones.length - 1].templateRef).toBe('pp-dispatch');
    // Patched copy carries the new promise date (as the ship window start).
    expect(milestones[0].body).toContain('20 November 2026');
    // Each milestone's "what happens next" covers the steps after it.
    expect(milestones[milestones.length - 1].nextSteps).toEqual([]);
  });

  it('records batch_created, orders_split and reschedule events with the full story', () => {
    const types = result.events.map((e) => e.type);
    expect(types).toEqual(['batch_created', 'orders_split', 'copy_requested', 'reschedule']);
    const reschedule = result.events[3];
    expect(reschedule.batchId).toBe(result.targetBatchId);
    expect(reschedule.by).toBe('u-1');
    expect(reschedule.data.oldDate).toBe('2026-09-15');
    expect(reschedule.data.newDate).toBe('2026-11-20');
    expect(reschedule.data.reason).toBe('Framing supplier delay');
    const split = result.events[1];
    expect(split.batchId).toBe('batch-1');
  });
});

describe('planReschedule — whole batch', () => {
  const ctx = makeCtx({
    batchSends: [
      makeSend('s1', { status: 'pending_approval' }),
      makeSend('s2', { status: 'approved' }),
      makeSend('s3', { status: 'sent' }),
      makeSend('s4', { status: 'cancelled' }),
    ],
  });
  const result = planReschedule(makeInput(['o1', 'o2', 'o3']), ctx);

  it('does not split and keeps the batch id', () => {
    expect(result.splitOccurred).toBe(false);
    expect(result.newBatch).toBeNull();
    expect(result.targetBatchId).toBe('batch-1');
    expect(result.movedOrderIds).toEqual([]);
  });

  it('cancels unsent sends but preserves sent history', () => {
    expect(result.cancelledSendIds.sort()).toEqual(['s1', 's2']);
  });

  it('records the handoff and the reschedule on the same batch', () => {
    expect(result.events.map((e) => e.type)).toEqual(['copy_requested', 'reschedule']);
    for (const event of result.events) expect(event.batchId).toBe('batch-1');
  });
});

describe('planReschedule — regenerated plan skips milestones already sent', () => {
  it('does not repeat stages the batch has been told about, except dispatch', () => {
    const ctx = makeCtx({
      batchSends: [
        makeSend('s1', { status: 'sent', templateRef: 'pp-printing' }),
        makeSend('s2', { status: 'sent', templateRef: 'pp-signing' }),
        makeSend('s3', { status: 'sent', templateRef: 'pp-dispatch' }),
        makeSend('s4', { status: 'pending_approval', templateRef: 'pp-framing' }),
      ],
    });
    const result = planReschedule(makeInput(['o1', 'o2', 'o3']), ctx);
    const refs = result.newSends.slice(1).map((s) => s.templateRef);
    expect(refs).not.toContain('pp-printing');
    expect(refs).not.toContain('pp-signing');
    // Framing was only pending, never sent — it survives regeneration.
    expect(refs).toContain('pp-framing');
    // Dispatch legitimately repeats at the new date.
    expect(refs[refs.length - 1]).toBe('pp-dispatch');
  });

  it('also skips stages inherited from the source batch (second reschedule of a split)', () => {
    // Batch 2 was split from Batch 1 after printing and signing went out.
    // Batch 2 then sent its own framing. Rescheduling Batch 2 again must
    // regenerate only dispatch (plus fillers) — nothing they already got.
    const batch2 = makeBatch({ id: 'batch-2', name: 'Batch 2', sourceBatchId: 'batch-1' });
    const ctx = makeCtx({
      batch: batch2,
      batchOrders: [
        makeOrder('o1', { batchId: 'batch-2' }),
        makeOrder('o2', { batchId: 'batch-2' }),
      ],
      batchSends: [
        makeSend('s10', { batchId: 'batch-2', status: 'sent', templateRef: 'pp-framing' }),
        makeSend('s11', { batchId: 'batch-2', status: 'pending_approval', templateRef: 'pp-dispatch' }),
      ],
      inheritedSentSends: [
        makeSend('s1', { status: 'sent', templateRef: 'pp-printing' }),
        makeSend('s2', { status: 'sent', templateRef: 'pp-signing' }),
      ],
      allBatchNames: ['Batch 1', 'Batch 2'],
    });
    const result = planReschedule({ ...makeInput(['o1', 'o2']), batchId: 'batch-2' }, ctx);
    const refs = result.newSends.slice(1).map((s) => s.templateRef);
    expect(refs).not.toContain('pp-printing');
    expect(refs).not.toContain('pp-signing');
    expect(refs).not.toContain('pp-framing');
    expect(refs[refs.length - 1]).toBe('pp-dispatch');
  });
});

describe('lineage — inheritedSentStory / sentStoryForBatch', () => {
  const batch1 = makeBatch();
  const batch2 = makeBatch({
    id: 'batch-2',
    name: 'Batch 2',
    sourceBatchId: 'batch-1',
    createdAt: '2026-08-10T09:00:00.000Z',
  });
  const batch3 = makeBatch({
    id: 'batch-3',
    name: 'Batch 3',
    sourceBatchId: 'batch-2',
    createdAt: '2026-08-20T09:00:00.000Z',
  });
  const sends = [
    makeSend('printing', { status: 'sent', templateRef: 'pp-printing', sentAt: '2026-07-01T08:00:00.000Z' }),
    // Sent by Batch 1 AFTER Batch 2 split off — batch 2 never received it.
    makeSend('framing', { status: 'sent', templateRef: 'pp-framing', sentAt: '2026-08-15T08:00:00.000Z' }),
    makeSend('b2-delay', {
      id: 'b2-delay',
      batchId: 'batch-2',
      type: 'delay',
      templateRef: 'pp-delay',
      status: 'sent',
      sentAt: '2026-08-11T08:00:00.000Z',
    }),
  ];
  const batches = [batch1, batch2, batch3];

  it('inherits only what was sent before the orders left each ancestor', () => {
    const inherited = inheritedSentStory(batch2, batches, sends);
    expect(inherited.map((s) => s.id)).toEqual(['printing']);
  });

  it('walks grandparent lineage with the right cutoffs', () => {
    const inherited = inheritedSentStory(batch3, batches, sends);
    // From batch-2: the delay (sent before batch-3 split at 08-20). From
    // batch-1: printing (sent before batch-2 split at 08-10) — but NOT the
    // framing sent 08-15, after these collectors had left batch 1.
    expect(inherited.map((s) => s.id)).toEqual(['printing', 'b2-delay']);
  });

  it('sentStoryForBatch appends the batch’s own sent sends in order', () => {
    const story = sentStoryForBatch(batch2, batches, sends);
    expect(story.map((s) => s.id)).toEqual(['printing', 'b2-delay']);
  });
});

describe('planReschedule — selection excluding removed orders', () => {
  it('treats "all remaining active orders" as a whole-batch reschedule', () => {
    const ctx = makeCtx({
      batchOrders: [makeOrder('o1'), makeOrder('o2'), makeOrder('o3', { removed: true })],
    });
    const result = planReschedule(makeInput(['o1', 'o2']), ctx);
    expect(result.splitOccurred).toBe(false);
  });

  it('rejects selections including removed orders', () => {
    const ctx = makeCtx({
      batchOrders: [makeOrder('o1'), makeOrder('o2', { removed: true })],
    });
    expect(() => planReschedule(makeInput(['o1', 'o2']), ctx)).toThrow(/not an active order/);
  });
});

describe('planReschedule — validation', () => {
  it('rejects an empty selection', () => {
    expect(() => planReschedule(makeInput([]), makeCtx())).toThrow(/at least one order/);
  });

  it('rejects orders from another batch', () => {
    expect(() => planReschedule(makeInput(['stranger']), makeCtx())).toThrow(/not an active order/);
  });

  it('requires a reason', () => {
    const input = { ...makeInput(['o1']), reason: '   ' };
    expect(() => planReschedule(input, makeCtx())).toThrow(/reason is required/);
  });

  it('rejects a new date that is today or in the past', () => {
    expect(() =>
      planReschedule({ ...makeInput(['o1', 'o2', 'o3']), newPromiseDate: NOW_DAY }, makeCtx()),
    ).toThrow(/must be in the future/);
    expect(() =>
      planReschedule({ ...makeInput(['o1', 'o2', 'o3']), newPromiseDate: '2026-08-01' }, makeCtx()),
    ).toThrow(/must be in the future/);
  });

  it('rejects a batch with no promise date — nothing has been promised yet', () => {
    const ctx = makeCtx({ batch: makeBatch({ promiseDate: null }) });
    expect(() => planReschedule(makeInput(['o1', 'o2', 'o3']), ctx)).toThrow(/no promise date/);
  });

  it('deduplicates repeated order ids — a duplicated subset must still split', () => {
    // o1 twice + o2 = 3 ids but only 2 distinct orders of 3 → split, and the
    // source batch's plan must survive.
    const ctx = makeCtx({
      batchSends: [makeSend('s1', { status: 'pending_approval' })],
    });
    const result = planReschedule(makeInput(['o1', 'o1', 'o2']), ctx);
    expect(result.splitOccurred).toBe(true);
    expect(result.movedOrderIds).toEqual(['o1', 'o2']);
    expect(result.cancelledSendIds).toEqual([]);
  });
});

describe('nextBatchName', () => {
  it('increments past the highest existing batch number', () => {
    expect(nextBatchName(['Batch 1'])).toBe('Batch 2');
    expect(nextBatchName(['Batch 1', 'Batch 3'])).toBe('Batch 4');
    expect(nextBatchName(['Launch batch'])).toBe('Batch 2');
  });

  it('counts within a fulfilment flow when given a prefix', () => {
    expect(nextBatchName(['Framed', 'Unframed'], 'Framed')).toBe('Framed 2');
    expect(nextBatchName(['Framed', 'Framed 2', 'Unframed'], 'Framed')).toBe('Framed 3');
    expect(nextBatchName(['Framed', 'Framed 2'], 'Unframed')).toBe('Unframed 2');
  });
});

describe('planReschedule — framed/unframed flows', () => {
  it('a split from a framed batch stays framed and is named within the flow', () => {
    const framedBatch = makeBatch({ name: 'Framed', fulfilment: 'framed' });
    const ctx = makeCtx({
      batch: framedBatch,
      allBatchNames: ['Framed', 'Unframed'],
    });
    const result = planReschedule(makeInput(['o1', 'o2']), ctx);
    expect(result.newBatch!.name).toBe('Framed 2');
    expect(result.newBatch!.fulfilment).toBe('framed');
  });

  it('an unframed batch is never promised a framing email', () => {
    const unframedBatch = makeBatch({ name: 'Unframed', fulfilment: 'unframed' });
    const ctx = makeCtx({ batch: unframedBatch, allBatchNames: ['Framed', 'Unframed'] });
    const result = planReschedule(makeInput(['o1', 'o2', 'o3']), ctx);
    const refs = result.newSends.slice(1).map((s) => s.templateRef);
    expect(refs).not.toContain('pp-framing');
    expect(refs[refs.length - 1]).toBe('pp-dispatch');
    for (const send of result.newSends) {
      expect(send.nextSteps?.some((s) => s.templateRef === 'pp-framing') ?? false).toBe(false);
    }
  });
});

describe('buildDefaultDelayEmail', () => {
  it('pre-fills a shippable delay email from the master', () => {
    const { subject, body } = buildDefaultDelayEmail(
      release,
      '2026-09-15',
      '2026-11-20',
      'The framing run failed quality checks',
    );
    expect(subject).toContain('Falling Light');
    expect(body).toContain('The framing run failed quality checks.');
    expect(body).toContain('15 September 2026');
    expect(body).toContain('20 November 2026');
  });

  it('honours a release-level custom delay body', () => {
    const custom: Release = {
      ...release,
      templateOverrides: {
        'pp-delay': { body: 'Bespoke delay for {{release_title}}: {{reason_line}}' },
      },
    };
    const { body } = buildDefaultDelayEmail(custom, null, '2026-11-20', 'Kiln failure');
    expect(body).toBe('Bespoke delay for Falling Light: Kiln failure.');
  });

  it('handles a missing previous promise date', () => {
    const { body } = buildDefaultDelayEmail(release, null, '2026-11-20', 'Supplier delay');
    expect(body).toContain('the original date');
  });
});
