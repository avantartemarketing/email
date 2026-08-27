import type { ScheduledSend, SendRecipient } from '../../types';
import { addDays, formatDay, parseDay, today } from '../../logic/dates';
import { MockDataLayer } from './MockDataLayer';
import {
  BLUE_INTERVAL_CSV,
  FALLING_LIGHT_CSV,
  HUBSPOT_DIRECTORY,
  NIGHT_GARDEN_CSV,
  USERS,
  VESSEL_VIII_CSV,
} from './fixtures';

/**
 * Build the phase-1 mock world by REPLAYING history through the public
 * DataLayer API with a shifted clock: real CSV imports (mess included), real
 * plan generation, real reschedules and approvals — so every batch's story
 * is internally consistent with what the logic actually produces. The only
 * direct store writes are the things phase 3 will own: marking queued sends
 * as sent (what the cron worker will do) and completing a release.
 *
 * Everything is dated relative to "today" so the screens always look alive:
 *   - Falling Light: the delayed release. Batch 1 nearly done, Batch 2 split
 *     and delayed once, Batch 3 split two days ago with its delay notice
 *     still unapproved (overdue — the attention state).
 *   - Vessel VIII: sculpture, long window, on-track cadence, one held send.
 *   - Blue Interval: completed, full sent history.
 *   - Night Garden: imported yesterday, no promise date yet.
 */

let sentCounter = 0;

/** What the phase-3 cron worker will do; seed-only stand-in. */
function markSent(layer: MockDataLayer, sendId: string, atIso: string): void {
  const send = layer._store.sends.get(sendId);
  if (!send) throw new Error(`Seed error: unknown send ${sendId}`);
  if (send.status !== 'approved') {
    throw new Error(`Seed error: marking a ${send.status} send as sent (${send.subject})`);
  }
  const orders = [...layer._store.orders.values()].filter(
    (o) => o.batchId === send.batchId && !o.removed,
  );
  const recipients: SendRecipient[] = orders.map((o) => {
    if (!o.email) {
      return {
        orderId: o.id,
        collectorName: o.collectorName,
        email: '',
        hubspotContactId: null,
        hubspotSendId: null,
        status: 'failed',
        error: 'No email address on the order',
      };
    }
    if (!o.hubspotContactId) {
      return {
        orderId: o.id,
        collectorName: o.collectorName,
        email: o.email,
        hubspotContactId: null,
        hubspotSendId: null,
        status: 'failed',
        error: `No HubSpot contact found for ${o.email}`,
      };
    }
    sentCounter += 1;
    return {
      orderId: o.id,
      collectorName: o.collectorName,
      email: o.email,
      hubspotContactId: o.hubspotContactId,
      hubspotSendId: `hs-send-${100000 + sentCounter}`,
      status: 'sent',
    };
  });
  send.status = 'sent';
  send.sentAt = atIso;
  send.hubspotEmailId = `hs-email-${send.id}`;
  send.recipients = recipients;
  const failed = recipients.filter((r) => r.status === 'failed').length;
  layer._addEvent(
    send.releaseId,
    send.batchId,
    'send_sent',
    `“${send.subject}” sent to ${recipients.length - failed} collector${recipients.length - failed === 1 ? '' : 's'}${failed > 0 ? ` (${failed} failed)` : ''}`,
    { sendId: send.id },
    { id: 'system', name: 'System' },
    atIso,
  );
}

export async function createSeededMockDataLayer(): Promise<MockDataLayer> {
  const layer = new MockDataLayer(structuredClone(USERS), 'user-tom', HUBSPOT_DIRECTORY);
  const T = today();

  // Each clock() call advances a minute so event ordering is deterministic.
  let minutes = 0;
  const clock = (daysFromToday: number) => {
    minutes += 1;
    layer._setClock(
      new Date(parseDay(addDays(T, daysFromToday)).getTime() - 12 * 3600_000 + 9 * 3600_000 + minutes * 60_000),
    );
  };
  const as = (userId: string) => layer.setCurrentUser(userId);
  const findOrders = (releaseId: string, orderNames: string[]) =>
    [...layer._store.orders.values()]
      .filter((o) => o.releaseId === releaseId && orderNames.includes(o.shopifyOrderName))
      .map((o) => o.id);
  const findSends = (batchId: string) =>
    [...layer._store.sends.values()]
      .filter((s) => s.batchId === batchId)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const sentAt = (send: ScheduledSend) =>
    new Date(parseDay(send.scheduledDate).getTime() - 2 * 3600_000).toISOString();

  // --- Blue Interval — completed release, clean history -------------------
  clock(-120);
  await as('user-crm');
  const blueInterval = await layer.createRelease({
    title: 'Blue Interval',
    artist: 'Theo Lindgren',
    editionSize: 75,
    productKind: 'print',
    shopifyProductIds: ['9051230001'],
  });
  await layer.importOrders(blueInterval.id, BLUE_INTERVAL_CSV);
  const biBatch = [...layer._store.batches.values()].find((b) => b.releaseId === blueInterval.id)!;
  clock(-118);
  await layer.setPromiseDate(biBatch.id, addDays(T, -30));
  await layer.submitBatchPlanForApproval(biBatch.id);
  clock(-117);
  for (const send of findSends(biBatch.id)) {
    await layer.approveSend(send.id);
    markSent(layer, send.id, sentAt(send));
  }
  layer._store.releases.get(blueInterval.id)!.status = 'completed';

  // --- Falling Light — the delayed release -------------------------------
  clock(-60);
  await as('user-crm');
  const fallingLight = await layer.createRelease({
    title: 'Falling Light',
    artist: 'Jenny Marlowe',
    editionSize: 150,
    productKind: 'print',
    shopifyProductIds: ['9051230412'],
  });
  await layer.importOrders(fallingLight.id, FALLING_LIGHT_CSV);
  const flBatch1 = [...layer._store.batches.values()].find(
    (b) => b.releaseId === fallingLight.id,
  )!;

  // Promise date set, plan approved. Printing/signing/framing went out on
  // schedule; dispatch is approved and queued for T+15.
  clock(-58);
  await layer.setPromiseDate(flBatch1.id, addDays(T, 20));
  await layer.submitBatchPlanForApproval(flBatch1.id);
  clock(-57);
  for (const send of findSends(flBatch1.id)) await layer.approveSend(send.id);
  const [flPrinting, flSigning, flFraming] = findSends(flBatch1.id);
  markSent(layer, flPrinting.id, sentAt(flPrinting));
  markSent(layer, flSigning.id, sentAt(flSigning));

  // T-12: the framers push the second framing run back — 9 orders split off
  // into Batch 2, delayed to T+45. Delay notice approved and sent same day.
  clock(-12);
  await as('user-pm');
  const flSplit1 = await layer.reschedule({
    releaseId: fallingLight.id,
    batchId: flBatch1.id,
    orderIds: findOrders(fallingLight.id, [
      '#AA10428',
      '#AA10430',
      '#AA10431',
      '#AA10433',
      '#AA10434',
      '#AA10436',
      '#AA10437',
      '#AA10439',
      '#AA10440',
    ]),
    newPromiseDate: addDays(T, 45),
    reason: 'Second framing run pushed back at the framers',
    delaySubject: 'An update on your Falling Light delivery date',
    delayBody: buildSeedDelayBody('Falling Light', 'Jenny Marlowe', addDays(T, 20), addDays(T, 45), 'The second framing run has been pushed back at our framers.'),
    userId: 'user-pm',
  });
  await as('user-crm');
  const flBatch2Sends = findSends(flSplit1.batch.id);
  const flDelay1 = flBatch2Sends.find((s) => s.type === 'delay')!;
  await layer.approveSend(flDelay1.id);
  markSent(layer, flDelay1.id, sentAt(flDelay1));
  // Batch 2's regenerated framing milestone also went out.
  const flB2Framing = flBatch2Sends.find((s) => s.templateRef === 'pp-framing');
  if (flB2Framing) {
    await layer.approveSend(flB2Framing.id);
    markSent(layer, flB2Framing.id, sentAt(flB2Framing));
  }

  // Batch 1's framing send fired on schedule at T-8.
  clock(-8);
  markSent(layer, flFraming.id, sentAt(flFraming));

  // T-5: a refund comes through Shopify; the order is removed by hand.
  clock(-5);
  await as('user-crm');
  const [refunded] = findOrders(fallingLight.id, ['#AA10442']);
  await layer.removeOrder(refunded, 'Refunded in Shopify — collector cancelled');

  // T-2: frame moulding out of stock for 4 orders — split to Batch 3,
  // delayed to T+75. The delay notice is still waiting for approval, two
  // days past its scheduled date: this is the overdue/attention state.
  clock(-2);
  await as('user-warehouse');
  await layer.reschedule({
    releaseId: fallingLight.id,
    batchId: flBatch1.id,
    orderIds: findOrders(fallingLight.id, ['#AA10443', '#AA10445', '#AA10446', '#AA10448']),
    newPromiseDate: addDays(T, 75),
    reason: 'Frame moulding out of stock at the supplier',
    delaySubject: 'An update on your Falling Light delivery date',
    delayBody: buildSeedDelayBody('Falling Light', 'Jenny Marlowe', addDays(T, 20), addDays(T, 75), 'The moulding used for your frame is out of stock with our supplier, and the replacement batch has a longer lead time than expected.'),
    userId: 'user-warehouse',
  });

  // --- Vessel VIII — sculpture, long window ------------------------------
  clock(-20);
  await as('user-crm');
  const vessel = await layer.createRelease({
    title: 'Vessel VIII',
    artist: 'Rafael Okonkwo',
    editionSize: 25,
    productKind: 'sculpture',
    shopifyProductIds: ['9051230508'],
  });
  await layer.importOrders(vessel.id, VESSEL_VIII_CSV);
  const vBatch = [...layer._store.batches.values()].find((b) => b.releaseId === vessel.id)!;
  clock(-19);
  await layer.setPromiseDate(vBatch.id, addDays(T, 150));
  await layer.submitBatchPlanForApproval(vBatch.id);
  clock(-18);
  const vSends = findSends(vBatch.id);
  await layer.approveSend(vSends[0].id);
  markSent(layer, vSends[0].id, sentAt(vSends[0]));
  // The third update is held pending sculpture-specific copy.
  if (vSends[2]) await layer.holdSend(vSends[2].id);

  // --- Night Garden — imported yesterday, no promise date yet ------------
  clock(-1);
  await as('user-tom');
  const nightGarden = await layer.createRelease({
    title: 'Night Garden',
    artist: 'Mireille Fontaine',
    editionSize: 100,
    productKind: 'print',
    shopifyProductIds: ['9051230601'],
  });
  await layer.importOrders(nightGarden.id, NIGHT_GARDEN_CSV);

  // Back to real time, signed in as Tom, with honest loading latency.
  layer._setClock(null);
  await layer.setCurrentUser('user-tom');
  layer.simulatedLatencyMs = 200;
  return layer;
}

/** Seeded delay bodies mirror what buildDefaultDelayEmail produces live. */
function buildSeedDelayBody(
  title: string,
  artist: string,
  oldDate: string,
  newDate: string,
  reasonLine: string,
): string {
  return `Hi {{first_name}},

We're writing with an update on ${title} by ${artist}. ${reasonLine}

Your edition was previously expected by ${formatDay(oldDate)}. The updated delivery date is ${formatDay(newDate)}.

We know delays are frustrating, and we're sorry for the wait — every edition is made to the artist's exacting standard, and we won't ship anything that falls short of it. We'll continue to update you as your edition progresses, and you can reply to this email with any questions.

Thank you for your patience,
Avant Arte`;
}
