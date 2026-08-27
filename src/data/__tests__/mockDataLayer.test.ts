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

describe('real email format, allocation and lineage behaviours', () => {
  it('generated sends carry the structured email content', async () => {
    const { release } = await releaseByTitle('Falling Light');
    const detail = await layer.getRelease(release.id);
    const printing = detail.sends.find((s) => s.templateRef === 'pp-printing')!;
    expect(printing.headline).toBe('Printing in progress');
    expect(printing.body).toContain('ship your edition between');
    expect(printing.nextSteps!.map((s) => s.title)).toEqual(['Signing', 'Framing', 'Dispatching']);
  });

  it('release-level custom copy applies when plans are generated (Vessel VIII)', async () => {
    const { release } = await releaseByTitle('Vessel VIII');
    expect(release.templateOverrides['pp-ontrack']).toBeDefined();
    const detail = await layer.getRelease(release.id);
    const ontrack = detail.sends.filter((s) => s.templateRef === 'pp-ontrack');
    expect(ontrack.length).toBeGreaterThan(0);
    expect(ontrack[0].headline).toBe('Casting in progress');
  });

  it('warehouse allocation lands on the customer-by-customer view', async () => {
    const { release } = await releaseByTitle('Falling Light');
    const detail = await layer.getRelease(release.id);
    const byName = (name: string) => detail.orders.filter((o) => o.shopifyOrderName === name);
    const jane = byName('#AA10412')[0];
    expect(jane.allocations).toHaveLength(1);
    expect(jane.allocations![0].editionNumber).toBe('1');
    expect(jane.allocations![0].frameFinish).toBe('BLACK');
    // Artist's proofs keep their non-numeric edition "number".
    expect(byName('#AA10427')[0].allocations![0].editionNumber).toBe('AP');
    // #AA10418 has a framed and an unframed line item; each line item gets
    // the sheet row matching its fulfilment.
    const priya = byName('#AA10418');
    expect(priya).toHaveLength(2);
    const framed = priya.find((o) => o.variant === 'Framed')!;
    const unframed = priya.find((o) => o.variant === 'Unframed')!;
    expect(framed.allocations![0].fulfilment).toBe('Framed');
    expect(unframed.allocations![0].fulfilment).toBe('Print Only');
    // Orders the sheet doesn't cover yet stay visibly unallocated.
    expect(byName('#AA10448')[0].allocations ?? []).toHaveLength(0);
    // The refunded order is on the sheet, but removed orders take nothing.
    expect(byName('#AA10442')[0].removed).toBe(true);
    expect(byName('#AA10442')[0].allocations ?? []).toHaveLength(0);
  });

  it('reviewers see the last email collectors received, across splits', async () => {
    const { release } = await releaseByTitle('Falling Light');
    const detail = await layer.getRelease(release.id);
    const batch3 = detail.batches[2];
    expect(batch3.sourceBatchId).toBe(detail.batches[0].id);
    const b3Delay = detail.sends.find((s) => s.batchId === batch3.id && s.type === 'delay')!;
    const view = await layer.getSendDetail(b3Delay.id);
    // These collectors sat in Batch 1 until two days ago — the last thing
    // they received is Batch 1's framing email, not nothing.
    expect(view.lastSent).not.toBeNull();
    expect(view.lastSent!.templateRef).toBe('pp-framing');
    expect(view.lastSent!.batchName).toBe('Batch 1');
    expect(view.releaseBatchCount).toBe(3);

    const queue = await layer.listApprovalQueue();
    const flItem = queue.find((i) => i.release.title === 'Falling Light');
    expect(flItem?.lastSent).not.toBeNull();
  });

  it('a second reschedule of a split batch never repeats milestones its collectors received', async () => {
    const { release } = await releaseByTitle('Falling Light');
    const before = await layer.getRelease(release.id);
    const batch2 = before.batches[1];
    const activeOrders = before.orders.filter((o) => !o.removed && o.batchId === batch2.id);
    await layer.setCurrentUser('user-pm');
    const result = await layer.reschedule({
      releaseId: release.id,
      batchId: batch2.id,
      orderIds: activeOrders.map((o) => o.id),
      newPromiseDate: addDays(today(), 90),
      reason: 'Replacement moulding delayed again',
      delaySubject: 'An update on your Falling Light delivery date',
      delayBody: 'Hi {{first_name}}, delay body.',
      userId: 'user-pm',
    });
    await layer.setCurrentUser('user-tom');
    const refs = result.regeneratedSends.map((s) => s.templateRef);
    // Printing and signing were sent while these collectors sat in Batch 1;
    // framing was sent by Batch 2 itself. None may repeat.
    expect(refs).not.toContain('pp-printing');
    expect(refs).not.toContain('pp-signing');
    expect(refs).not.toContain('pp-framing');
    expect(refs[refs.length - 1]).toBe('pp-dispatch');
  });

  it('editing release copy re-renders upcoming sends but not hand-edited ones', async () => {
    const { release } = await releaseByTitle('Falling Light');
    const result = await layer.updateReleaseEmail(release.id, 'pp-dispatch', {
      subject: 'On its way soon — {{release_title}}',
    });
    expect(result.updatedSendCount).toBeGreaterThan(0);
    const after = await layer.getRelease(release.id);
    // The Batch 1 dispatch send was edited by hand earlier — it keeps its words.
    const handEdited = after.sends.find((s) => s.body.includes('PS: edited.'));
    expect(handEdited).toBeDefined();
    expect(handEdited!.subject).not.toContain('On its way soon');
    // Untouched upcoming dispatch sends got the new subject, tokens patched.
    const rerendered = after.sends.filter(
      (s) => s.templateRef === 'pp-dispatch' && s.subject === 'On its way soon — Falling Light',
    );
    expect(rerendered.length).toBeGreaterThan(0);
  });

  it('switching a milestone off cancels its upcoming sends; dispatch is protected', async () => {
    const { release } = await releaseByTitle('Night Garden');
    const before = await layer.getRelease(release.id);
    const framingBefore = before.sends.filter(
      (s) => s.templateRef === 'pp-framing' && s.status === 'draft',
    );
    expect(framingBefore.length).toBeGreaterThan(0);
    const result = await layer.updateReleaseEmail(release.id, 'pp-framing', { enabled: false });
    expect(result.cancelledSendCount).toBe(framingBefore.length);
    const after = await layer.getRelease(release.id);
    expect(after.release.disabledTemplates).toContain('pp-framing');
    expect(
      after.sends.filter((s) => s.templateRef === 'pp-framing' && s.status !== 'cancelled'),
    ).toHaveLength(0);
    // No other upcoming email may keep promising the switched-off stage in
    // its "What happens next?" card.
    for (const send of after.sends) {
      if (send.status === 'cancelled' || send.status === 'sent') continue;
      expect(send.nextSteps?.some((s) => s.templateRef === 'pp-framing') ?? false).toBe(false);
    }
    await expect(
      layer.updateReleaseEmail(release.id, 'pp-dispatch', { enabled: false }),
    ).rejects.toThrow(/cannot be switched off/);
  });

  it('a release with the on-track email switched off gets no filler sends', async () => {
    await layer.setCurrentUser('user-crm');
    const release = await layer.createRelease({
      title: 'Quiet Harbour',
      artist: 'Ama Sarpong',
      editionSize: 40,
      productKind: 'print',
      disabledTemplates: ['pp-ontrack'],
    });
    const detail = await layer.getRelease(release.id);
    await layer.setPromiseDate(detail.batches[0].id, addDays(today(), 240));
    const planned = await layer.getRelease(release.id);
    const refs = planned.sends.map((s) => s.templateRef);
    expect(refs).not.toContain('pp-ontrack');
    expect(refs[refs.length - 1]).toBe('pp-dispatch');
    await layer.setCurrentUser('user-tom');
  });

  it('a date-only edit does not opt a send out of release copy propagation', async () => {
    const { release } = await releaseByTitle('Falling Light');
    const detail = await layer.getRelease(release.id);
    const pending = detail.sends.find(
      (s) => s.status === 'pending_approval' && s.type === 'milestone' && !s.copyEdited,
    )!;
    const moved = await layer.updateSend(pending.id, {
      subject: pending.subject,
      headline: pending.headline,
      body: pending.body,
      nextSteps: pending.nextSteps,
      scheduledDate: addDays(today(), 33),
    });
    expect(moved.scheduledDate).toBe(addDays(today(), 33));
    expect(moved.copyEdited ?? false).toBe(false);
  });
});

// Type-level assertion that the mock stays swappable: the screens only ever
// see DataLayer, and MockDataLayer must keep satisfying it.
const _interfaceCheck: DataLayer = null as unknown as MockDataLayer;
void _interfaceCheck;
