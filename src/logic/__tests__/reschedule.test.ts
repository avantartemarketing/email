import { describe, expect, it } from 'vitest';
import type { Batch, Order, Release, ScheduledSend, User } from '../../types';
import { buildDefaultDelayEmail, nextBatchName, planReschedule } from '../reschedule';
import type { RescheduleContext } from '../reschedule';

const NOW_DAY = '2026-08-27';
const NOW_ISO = '2026-08-27T10:00:00.000Z';

const release: Release = {
  id: 'rel-1',
  title: 'Falling Light',
  artist: 'Jenny Marlowe',
  shopifyProductIds: ['1111'],
  editionSize: 150,
  status: 'active',
  productKind: 'print',
  createdAt: '2026-05-01T00:00:00.000Z',
};

const user: User = { id: 'u-1', name: 'Priya N', email: 'priya@avantarte.com', role: 'operator' };

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
    delaySubject: 'An update on your Falling Light delivery date',
    delayBody: 'Delay body copy',
    userId: 'u-1',
  };
}

describe('planReschedule — subset selection (split)', () => {
  const ctx = makeCtx({
    batchSends: [makeSend('s1', { status: 'pending_approval' }), makeSend('s2', { status: 'sent' })],
  });
  const result = planReschedule(makeInput(['o1', 'o2']), ctx);

  it('creates a new batch carrying the new promise date', () => {
    expect(result.splitOccurred).toBe(true);
    expect(result.newBatch).not.toBeNull();
    expect(result.newBatch!.name).toBe('Batch 2');
    expect(result.newBatch!.promiseDate).toBe('2026-11-20');
    expect(result.targetBatchId).toBe(result.newBatch!.id);
    expect(result.movedOrderIds).toEqual(['o1', 'o2']);
  });

  it('leaves the source batch plan untouched', () => {
    expect(result.cancelledSendIds).toEqual([]);
  });

  it('puts the delay send first, scheduled today, pending approval', () => {
    const delay = result.newSends[0];
    expect(delay.type).toBe('delay');
    expect(delay.templateRef).toBe('pp-delay');
    expect(delay.scheduledDate).toBe(NOW_DAY);
    expect(delay.status).toBe('pending_approval');
    expect(delay.subject).toBe('An update on your Falling Light delivery date');
    expect(delay.body).toBe('Delay body copy');
    expect(delay.batchId).toBe(result.targetBatchId);
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
    // Patched copy carries the new promise date.
    expect(milestones[0].body).toContain('20 November 2026');
  });

  it('records batch_created, orders_split and reschedule events with the full story', () => {
    const types = result.events.map((e) => e.type);
    expect(types).toEqual(['batch_created', 'orders_split', 'reschedule']);
    const reschedule = result.events[2];
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

  it('records a reschedule event on the same batch', () => {
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe('reschedule');
    expect(result.events[0].batchId).toBe('batch-1');
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
});

describe('nextBatchName', () => {
  it('increments past the highest existing batch number', () => {
    expect(nextBatchName(['Batch 1'])).toBe('Batch 2');
    expect(nextBatchName(['Batch 1', 'Batch 3'])).toBe('Batch 4');
    expect(nextBatchName(['Launch batch'])).toBe('Batch 2');
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

  it('handles a missing previous promise date', () => {
    const { body } = buildDefaultDelayEmail(release, null, '2026-11-20', 'Supplier delay');
    expect(body).toContain('the original date');
  });
});
