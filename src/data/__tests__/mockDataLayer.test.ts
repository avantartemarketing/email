import { beforeAll, describe, expect, it } from 'vitest';
import type { DataLayer } from '../DataLayer';
import type { MockDataLayer } from '../mock/MockDataLayer';
import { createSeededMockDataLayer } from '../mock/seed';
import { NIGHT_GARDEN_CSV } from '../mock/fixtures';
import { addDays, today } from '../../logic/dates';

/**
 * Integration tests over the seeded mock world — every assertion goes
 * through the public DataLayer interface the screens use. If these hold,
 * the five screens have a coherent world to render.
 */

let layer: DataLayer;

beforeAll(async () => {
  const mock = await createSeededMockDataLayer();
  mock.simulatedLatencyMs = 0; // keep tests fast
  layer = mock;
});

async function releaseByTitle(title: string) {
  const summaries = await layer.listReleases();
  const summary = summaries.find((s) => s.release.title === title);
  if (!summary) throw new Error(`Seed missing release: ${title}`);
  return summary;
}

describe('seeded world — releases index', () => {
  it('contains the four seeded releases', async () => {
    const titles = (await layer.listReleases()).map((s) => s.release.title);
    expect(titles).toEqual(['Blue Interval', 'Falling Light', 'Night Garden', 'Vessel VIII']);
  });

  it('Falling Light is the delayed release with three batches and an overdue send', async () => {
    const fl = await releaseByTitle('Falling Light');
    expect(fl.batchCount).toBe(3);
    expect(fl.orderCount).toBe(25); // 26 imported, 1 refunded
    expect(fl.pendingApprovalCount).toBeGreaterThan(0);
    expect(fl.overdueCount).toBeGreaterThan(0);
    expect(fl.nextScheduledSend).not.toBeNull();
  });

  it('Blue Interval is completed with nothing scheduled', async () => {
    const bi = await releaseByTitle('Blue Interval');
    expect(bi.release.status).toBe('completed');
    expect(bi.pendingApprovalCount).toBe(0);
    expect(bi.overdueCount).toBe(0);
    expect(bi.nextScheduledSend).toBeNull();
  });

  it('Night Garden has orders but no plan yet', async () => {
    const ng = await releaseByTitle('Night Garden');
    expect(ng.orderCount).toBe(7);
    expect(ng.batchCount).toBe(1);
    expect(ng.nextScheduledSend).toBeNull();
  });
});

describe('seeded world — Falling Light detail', () => {
  it('tells each batch a consistent story', async () => {
    const { release } = await releaseByTitle('Falling Light');
    const detail = await layer.getRelease(release.id);
    expect(detail.batches.map((b) => b.name)).toEqual(['Batch 1', 'Batch 2', 'Batch 3']);

    const [b1, b2, b3] = detail.batches;
    expect(b1.promiseDate).toBe(addDays(today(), 20));
    expect(b2.promiseDate).toBe(addDays(today(), 45));
    expect(b3.promiseDate).toBe(addDays(today(), 75));

    // Batch 1: printing/signing/framing sent, dispatch approved and queued.
    const b1Sends = detail.sends.filter((s) => s.batchId === b1.id);
    expect(b1Sends.map((s) => [s.templateRef, s.status])).toEqual([
      ['pp-printing', 'sent'],
      ['pp-signing', 'sent'],
      ['pp-framing', 'sent'],
      ['pp-dispatch', 'approved'],
    ]);

    // Batch 2: delay + framing sent; regenerated plan never repeats
    // printing/signing (those collectors already got them in Batch 1).
    const b2Sends = detail.sends.filter((s) => s.batchId === b2.id);
    expect(b2Sends.find((s) => s.type === 'delay')?.status).toBe('sent');
    expect(b2Sends.map((s) => s.templateRef)).not.toContain('pp-printing');
    expect(b2Sends.map((s) => s.templateRef)).not.toContain('pp-signing');
    expect(b2Sends.some((s) => s.status === 'pending_approval')).toBe(true);

    // Batch 3: the delay notice is still pending, scheduled two days ago.
    const b3Delay = detail.sends.find((s) => s.batchId === b3.id && s.type === 'delay');
    expect(b3Delay?.status).toBe('pending_approval');
    expect(b3Delay!.scheduledDate < today()).toBe(true);
  });

  it('keeps the full reschedule story in batch history', async () => {
    const { release } = await releaseByTitle('Falling Light');
    const detail = await layer.getRelease(release.id);
    const reschedules = detail.events.filter((e) => e.type === 'reschedule');
    expect(reschedules).toHaveLength(2);
    for (const event of reschedules) {
      expect(event.data.oldDate).toBeTruthy();
      expect(event.data.newDate).toBeTruthy();
      expect(event.data.reason).toBeTruthy();
      expect(event.byName).toBeTruthy();
    }
    expect(detail.events.some((e) => e.type === 'orders_split')).toBe(true);
    expect(detail.events.some((e) => e.type === 'order_removed')).toBe(true);
  });

  it('froze recipients on sent sends, including failures', async () => {
    const { release } = await releaseByTitle('Falling Light');
    const detail = await layer.getRelease(release.id);
    const signing = detail.sends.find((s) => s.templateRef === 'pp-signing')!;
    expect(signing.recipients).toBeDefined();
    const failed = signing.recipients!.filter((r) => r.status === 'failed');
    // One order with no email, one with no HubSpot contact.
    expect(failed).toHaveLength(2);
    const sent = signing.recipients!.filter((r) => r.status === 'sent');
    expect(sent.every((r) => r.hubspotSendId)).toBe(true);
    expect(signing.hubspotEmailId).toBeTruthy();
  });
});

describe('seeded world — approval queue', () => {
  it('lists pending and held sends across releases, soonest first', async () => {
    const queue = await layer.listApprovalQueue();
    expect(queue.length).toBeGreaterThan(4);
    const dates = queue.map((i) => i.send.scheduledDate);
    expect([...dates].sort()).toEqual(dates);
    expect(queue.some((i) => i.send.status === 'held')).toBe(true);
    expect(queue.some((i) => i.release.title === 'Falling Light')).toBe(true);
    expect(queue.some((i) => i.release.title === 'Vessel VIII')).toBe(true);
    for (const item of queue) {
      expect(item.recipientCount).toBeGreaterThan(0);
    }
  });
});

describe('live behaviour through the interface', () => {
  it('re-importing the same CSV creates no duplicates', async () => {
    const { release } = await releaseByTitle('Night Garden');
    const summary = await layer.importOrders(release.id, NIGHT_GARDEN_CSV);
    expect(summary.newOrders).toBe(0);
    expect(summary.duplicatesSkipped).toBe(8); // 7 orders + in-file dupe row
    expect((await releaseByTitle('Night Garden')).orderCount).toBe(7);
  });

  it('operators cannot approve; admins can', async () => {
    const queue = await layer.listApprovalQueue();
    const pending = queue.find((i) => i.send.status === 'pending_approval')!;
    await layer.setCurrentUser('user-pm');
    await expect(layer.approveSend(pending.send.id)).rejects.toThrow(/Only admins/);
    await layer.setCurrentUser('user-tom');
    const approved = await layer.approveSend(pending.send.id);
    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe('user-tom');
  });

  it('editing an approved send resets it to pending', async () => {
    const { release } = await releaseByTitle('Falling Light');
    const detail = await layer.getRelease(release.id);
    const dispatch = detail.sends.find(
      (s) => s.templateRef === 'pp-dispatch' && s.status === 'approved',
    )!;
    const updated = await layer.updateSend(dispatch.id, { body: `${dispatch.body}\n\nPS: edited.` });
    expect(updated.status).toBe('pending_approval');
    expect(updated.approvedBy).toBeUndefined();
  });

  it('a full-batch reschedule cancels unsent sends and preserves sent history', async () => {
    const { release } = await releaseByTitle('Vessel VIII');
    const before = await layer.getRelease(release.id);
    const batch = before.batches[0];
    const activeOrders = before.orders.filter((o) => !o.removed && o.batchId === batch.id);
    const sentBefore = before.sends.filter((s) => s.status === 'sent').map((s) => s.id);

    await layer.setCurrentUser('user-warehouse');
    const result = await layer.reschedule({
      releaseId: release.id,
      batchId: batch.id,
      orderIds: activeOrders.map((o) => o.id),
      newPromiseDate: addDays(today(), 210),
      reason: 'Foundry moved the casting slot',
      delaySubject: 'An update on your Vessel VIII delivery date',
      delayBody: 'Hi {{first_name}}, delay body.',
      userId: 'user-warehouse',
    });
    expect(result.splitOccurred).toBe(false);

    const after = await layer.getRelease(release.id);
    expect(after.batches).toHaveLength(1);
    expect(after.batches[0].promiseDate).toBe(addDays(today(), 210));
    for (const id of sentBefore) {
      expect(after.sends.find((s) => s.id === id)?.status).toBe('sent');
    }
    // Old pending/held plan cancelled; new plan pending, delay first.
    expect(
      after.sends.filter((s) => s.status === 'held' || s.status === 'approved'),
    ).toHaveLength(0);
    const pending = after.sends.filter((s) => s.status === 'pending_approval');
    expect(pending.some((s) => s.type === 'delay')).toBe(true);
    await layer.setCurrentUser('user-tom');
  });

  it('setPromiseDate generates a draft plan once, then demands the reschedule flow', async () => {
    const { release } = await releaseByTitle('Night Garden');
    const detail = await layer.getRelease(release.id);
    const batch = detail.batches[0];
    await layer.setPromiseDate(batch.id, addDays(today(), 60));
    const planned = await layer.getRelease(release.id);
    const drafts = planned.sends.filter((s) => s.status === 'draft');
    expect(drafts.length).toBeGreaterThanOrEqual(3);
    expect(drafts[drafts.length - 1].templateRef).toBe('pp-dispatch');
    await expect(layer.setPromiseDate(batch.id, addDays(today(), 90))).rejects.toThrow(
      /Change delivery date/,
    );
  });

  it('flags imported orders with no HubSpot contact instead of dropping them', async () => {
    const { release } = await releaseByTitle('Night Garden');
    const detail = await layer.getRelease(release.id);
    const flagged = detail.orders.filter((o) => o.email && !o.hubspotContactId);
    expect(flagged.map((o) => o.email)).toEqual(['charles.whitmore@example.net']);
    const noEmail = detail.orders.filter((o) => !o.email);
    expect(noEmail).toHaveLength(1);
  });
});

// Type-level assertion that the mock stays swappable: the screens only ever
// see DataLayer, and MockDataLayer must keep satisfying it.
const _interfaceCheck: DataLayer = null as unknown as MockDataLayer;
void _interfaceCheck;
