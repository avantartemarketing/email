import { beforeAll, describe, expect, it } from 'vitest';
import type { DataLayer } from '../DataLayer';
import type { MockDataLayer } from '../mock/MockDataLayer';
import { createSeededMockDataLayer } from '../mock/seed';
import { FALLING_LIGHT_ALLOCATION_CSV, NIGHT_GARDEN_CSV } from '../mock/fixtures';
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

  it('Falling Light is the delayed release with four batches and an overdue send', async () => {
    const fl = await releaseByTitle('Falling Light');
    // Framed + Unframed flows, plus two splits from the framed flow.
    expect(fl.batchCount).toBe(4);
    /* A real release runs to hundreds of collectors, and the fixture does too.
       The count is asserted as an INVARIANT rather than as a number: the total
       is the active orders, so the refunded one is excluded and nothing else
       is. A magic number here breaks every time the world grows, which teaches
       people to update the number rather than read the assertion. */
    const flDetail = await layer.getRelease(fl.release.id);
    expect(fl.orderCount).toBe(flDetail.orders.filter((o) => !o.removed).length);
    expect(flDetail.orders.some((o) => o.removed)).toBe(true);
    expect(fl.orderCount).toBeGreaterThan(200);
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

  it('Night Garden has orders in framed/unframed batches but no plan yet', async () => {
    const ng = await releaseByTitle('Night Garden');
    const ngDetail = await layer.getRelease(ng.release.id);
    expect(ng.orderCount).toBe(ngDetail.orders.filter((o) => !o.removed).length);
    expect(ng.orderCount).toBeGreaterThan(100);
    expect(ng.batchCount).toBe(2);
    expect(ng.nextScheduledSend).toBeNull();
  });
});

describe('seeded world — Falling Light detail', () => {
  it('tells each batch a consistent story', async () => {
    const { release } = await releaseByTitle('Falling Light');
    const detail = await layer.getRelease(release.id);
    expect(detail.batches.map((b) => b.name)).toEqual([
      'Framed',
      'Unframed',
      'Framed 2',
      'Framed 3',
    ]);

    const [framed, unframed, framed2, framed3] = detail.batches;
    expect(framed.fulfilment).toBe('framed');
    expect(unframed.fulfilment).toBe('unframed');
    expect(framed2.fulfilment).toBe('framed');
    expect(framed.promiseDate).toBe(addDays(today(), 20));
    expect(unframed.promiseDate).toBe(addDays(today(), 10));
    expect(framed2.promiseDate).toBe(addDays(today(), 45));
    expect(framed3.promiseDate).toBe(addDays(today(), 75));

    // Framed flow: printing/signing/framing sent, dispatch approved.
    const framedSends = detail.sends.filter((s) => s.batchId === framed.id);
    expect(framedSends.map((s) => [s.templateRef, s.status])).toEqual([
      ['pp-printing', 'sent'],
      ['pp-signing', 'sent'],
      ['pp-framing', 'sent'],
      ['pp-dispatch', 'approved'],
    ]);

    // Unframed flow: its own earlier date, and never a framing email.
    const unframedSends = detail.sends.filter((s) => s.batchId === unframed.id);
    expect(unframedSends.map((s) => s.templateRef)).not.toContain('pp-framing');
    expect(unframedSends[unframedSends.length - 1].templateRef).toBe('pp-dispatch');
    expect(unframedSends.filter((s) => s.status === 'sent').length).toBeGreaterThanOrEqual(2);

    // Framed 2: delay + framing sent; regenerated plan never repeats
    // printing/signing (those collectors already got them in Framed).
    const f2Sends = detail.sends.filter((s) => s.batchId === framed2.id);
    expect(f2Sends.find((s) => s.type === 'delay')?.status).toBe('sent');
    expect(f2Sends.map((s) => s.templateRef)).not.toContain('pp-printing');
    expect(f2Sends.map((s) => s.templateRef)).not.toContain('pp-signing');
    expect(f2Sends.some((s) => s.status === 'pending_approval')).toBe(true);

    // Framed 3: the delay notice is still pending, scheduled two days ago.
    const f3Delay = detail.sends.find((s) => s.batchId === framed3.id && s.type === 'delay');
    expect(f3Delay?.status).toBe('pending_approval');
    expect(f3Delay!.scheduledDate < today()).toBe(true);
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
    const signings = detail.sends.filter(
      (s) => s.templateRef === 'pp-signing' && s.status === 'sent',
    );
    // One signing email per flow: framed and unframed.
    expect(signings).toHaveLength(2);
    const failed = signings.flatMap((s) => s.recipients!.filter((r) => r.status === 'failed'));
    // One order with no email (unframed), one with no HubSpot contact (framed).
    expect(failed).toHaveLength(2);
    for (const signing of signings) {
      const sent = signing.recipients!.filter((r) => r.status === 'sent');
      expect(sent.every((r) => r.hubspotSendId)).toBe(true);
      expect(signing.hubspotEmailId).toBeTruthy();
    }
  });
});

describe('seeded world — approval queue', () => {
  it('lists every send waiting on an approver, soonest first', async () => {
    const queue = await layer.listApprovalQueue();
    expect(queue.length).toBeGreaterThan(4);
    const dates = queue.map((i) => i.send.scheduledDate);
    expect([...dates].sort()).toEqual(dates);
    expect(queue.some((i) => i.release.title === 'Falling Light')).toBe(true);
    expect(queue.some((i) => i.release.title === 'Vessel VIII')).toBe(true);
    for (const item of queue) {
      expect(item.recipientCount).toBeGreaterThan(0);
    }
  });
});

describe('seeded world — batches overview', () => {
  it('lists every batch under its release, with honest counts', async () => {
    const rows = await layer.listBatches();
    const releases = await layer.listReleases();
    // Every release's batches are present, and no phantom ones.
    expect(rows.length).toBe(releases.reduce((sum, r) => sum + r.batchCount, 0));
    // Releases arrive in the index's own order, batches by creation within.
    const titles = [...new Set(rows.map((r) => r.release.title))];
    expect(titles).toEqual(releases.map((r) => r.release.title));
    // The count is ACTIVE orders — a refunded collector is not a collector.
    const fl = releases.find((r) => r.release.title === 'Falling Light')!;
    const flRows = rows.filter((r) => r.release.id === fl.release.id);
    expect(flRows.reduce((sum, r) => sum + r.collectorCount, 0)).toBe(fl.orderCount);
    // Night Garden has batches but no promises yet — the page must show that.
    const ng = rows.filter((r) => r.release.title === 'Night Garden');
    expect(ng.length).toBeGreaterThan(0);
    expect(ng.every((r) => r.batch.promiseDate === null)).toBe(true);
  });
});

describe('live behaviour through the interface', () => {
  it('re-importing the same CSV creates no duplicates', async () => {
    const { release } = await releaseByTitle('Night Garden');
    const before = (await releaseByTitle('Night Garden')).orderCount;
    const summary = await layer.importOrders(release.id, NIGHT_GARDEN_CSV);
    expect(summary.newOrders).toBe(0);
    /* Every row in the file is a duplicate, the in-file repeat included — so
       the skip count is the row count and the release is unchanged. Stated
       against the file rather than as a number, because the file grew. */
    expect(summary.duplicatesSkipped).toBe(summary.rowsParsed);
    expect((await releaseByTitle('Night Garden')).orderCount).toBe(before);
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

  it('refuses to approve an email with no image, and lets you fix it in place', async () => {
    /* The whole point of dropping the master default: an email with no
       picture is unfinished, not "fine, it will use the fallback". The
       refusal sits at approval because that is where the choice stops being
       reversible — everything before it is one click to fix. */
    const { release } = await releaseByTitle('Falling Light');
    const detail = await layer.getRelease(release.id);
    const send = detail.sends.find((s) => s.status === 'pending_approval')!;
    const slot = send.imageSlot!;
    const was = detail.release.templateImages[slot];

    await layer.setReleaseEmailImage(release.id, slot, null);
    await expect(layer.approveSend(send.id)).rejects.toThrow(/no image yet/);

    // Picking one backfills the queued send in place — no re-submission.
    await layer.setReleaseEmailImage(release.id, slot, was ?? 'Artwork detail');
    const approved = await layer.approveSend(send.id);
    expect(approved.status).toBe('approved');
    expect(approved.imageName).toBeTruthy();
  });

  it('refuses an image name that is not in the library', async () => {
    const { release } = await releaseByTitle('Falling Light');
    await expect(
      layer.setReleaseEmailImage(release.id, 'pp-printing', 'Not A Real Picture'),
    ).rejects.toThrow(/not in the image library/);
  });

  it('a hand-added on-track send takes the next free slot, not always the first', async () => {
    /* It used to hardcode pp-ontrack-1, so two on-track emails shared one
       picture — and now that a refusal names the slot to go and fix, it
       would have named the wrong one. */
    const { release } = await releaseByTitle('Vessel VIII');
    const detail = await layer.getRelease(release.id);
    const batch = detail.batches[0];
    const before = detail.sends.filter(
      (s) => s.batchId === batch.id && s.templateRef === 'pp-ontrack' && s.status !== 'cancelled',
    ).length;
    const added = await layer.addSend(batch.id, 'pp-ontrack', addDays(today(), 30));
    expect(added.imageSlot).toBe(`pp-ontrack-${before + 1}`);
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
    // The old pending plan is cancelled; the new one is pending, delay first.
    expect(
      after.sends.filter((s) => s.status === 'approved'),
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
  it('generated sends carry the structured email content, per flow', async () => {
    const { release } = await releaseByTitle('Falling Light');
    const detail = await layer.getRelease(release.id);
    const framedBatch = detail.batches.find((b) => b.name === 'Framed')!;
    const unframedBatch = detail.batches.find((b) => b.name === 'Unframed')!;
    const framedPrinting = detail.sends.find(
      (s) => s.batchId === framedBatch.id && s.templateRef === 'pp-printing',
    )!;
    expect(framedPrinting.headline).toBe('Printing in progress');
    expect(framedPrinting.body).toContain('ship your edition between');
    expect(framedPrinting.nextSteps!.map((s) => s.title)).toEqual([
      'Signing',
      'Framing',
      'Dispatching',
    ]);
    // The release's picked image travels on the send.
    expect(framedPrinting.imageName).toBe('Studio — printing');
    // Unframed collectors are never promised a framing stage.
    const unframedPrinting = detail.sends.find(
      (s) => s.batchId === unframedBatch.id && s.templateRef === 'pp-printing',
    )!;
    expect(unframedPrinting.nextSteps!.map((s) => s.title)).toEqual(['Signing', 'Dispatching']);
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
    const framedBatch = detail.batches.find((b) => b.name === 'Framed')!;
    const framed3 = detail.batches.find((b) => b.name === 'Framed 3')!;
    expect(framed3.sourceBatchId).toBe(framedBatch.id);
    const f3Delay = detail.sends.find((s) => s.batchId === framed3.id && s.type === 'delay')!;
    const view = await layer.getSendDetail(f3Delay.id);
    // These collectors sat in the Framed batch until two days ago — the
    // last thing they received is its framing email, not nothing.
    expect(view.lastSent).not.toBeNull();
    expect(view.lastSent!.templateRef).toBe('pp-framing');
    expect(view.lastSent!.batchName).toBe('Framed');
    expect(view.releaseBatchCount).toBe(4);

    const queue = await layer.listApprovalQueue();
    const flItem = queue.find((i) => i.release.title === 'Falling Light');
    expect(flItem?.lastSent).not.toBeNull();
  });

  it('a second reschedule of a split batch never repeats milestones its collectors received', async () => {
    const { release } = await releaseByTitle('Falling Light');
    const before = await layer.getRelease(release.id);
    const batch2 = before.batches.find((b) => b.name === 'Framed 2')!;
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
      productKind: 'sculpture',
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

  it('print imports route orders into framed and unframed batches', async () => {
    const { release } = await releaseByTitle('Night Garden');
    const detail = await layer.getRelease(release.id);
    const framed = detail.batches.find((b) => b.fulfilment === 'framed')!;
    const unframed = detail.batches.find((b) => b.fulfilment === 'unframed')!;
    expect(framed.name).toBe('Framed');
    expect(unframed.name).toBe('Unframed');
    for (const order of detail.orders) {
      const expected = /unframed/i.test(order.variant) ? unframed.id : framed.id;
      expect(order.batchId).toBe(expected);
    }
  });

  it('image picks land on upcoming sends without touching approvals', async () => {
    const { release } = await releaseByTitle('Falling Light');
    const before = await layer.getRelease(release.id);
    const framedBatch = before.batches.find((b) => b.name === 'Framed')!;
    const dispatch = before.sends.find(
      (s) => s.batchId === framedBatch.id && s.templateRef === 'pp-dispatch',
    )!;
    const statusBefore = dispatch.status;
    await layer.setReleaseEmailImage(release.id, 'pp-dispatch', 'Packing & dispatch');
    const after = await layer.getRelease(release.id);
    const updated = after.sends.find((s) => s.id === dispatch.id)!;
    expect(updated.imageName).toBe('Packing & dispatch');
    expect(updated.status).toBe(statusBefore);
  });

  it('re-importing allocations after a sibling line item is removed keeps variant matching', async () => {
    const { release } = await releaseByTitle('Falling Light');
    const before = await layer.getRelease(release.id);
    const unframed = before.orders.find(
      (o) => o.shopifyOrderName === '#AA10418' && o.variant === 'Unframed',
    )!;
    await layer.removeOrder(unframed.id, 'Partial refund — unframed print cancelled');
    await layer.importAllocations(release.id, FALLING_LIGHT_ALLOCATION_CSV);
    const after = await layer.getRelease(release.id);
    const framed = after.orders.find(
      (o) => o.shopifyOrderName === '#AA10418' && o.variant === 'Framed',
    )!;
    // The surviving framed line item still takes only its own sheet row —
    // not the removed sibling's Print Only row as well.
    expect(framed.allocations).toHaveLength(1);
    expect(framed.allocations![0].fulfilment).toBe('Framed');
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
