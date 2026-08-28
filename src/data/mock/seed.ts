import type {
  Batch,
  BatchFulfilment,
  ImageSlot,
  ScheduledSend,
  SendRecipient,
} from '../../types';
import { addDays, parseDay, today } from '../../logic/dates';
import { buildDefaultDelayEmail } from '../../logic/reschedule';
import { requiredImageSlots } from '../../logic/templates';
import { MockDataLayer } from './MockDataLayer';

import {
  BLUE_INTERVAL_CSV,
  FALLING_LIGHT_ALLOCATION_CSV,
  FALLING_LIGHT_CSV,
  HUBSPOT_DIRECTORY,
  NIGHT_GARDEN_CSV,
  USERS,
  VESSEL_VIII_CSV,
} from './fixtures';

/** Which of the library's pictures suits which email, for the seeded world. */
const MILESTONE_IMAGES: Partial<Record<ImageSlot, string>> = {
  'pp-printing': 'Studio — printing',
  'pp-signing': 'Studio — signing',
  'pp-framing': 'Framing bench',
  'pp-dispatch': 'Packing & dispatch',
  'pp-delay': 'Artist portrait',
};

/** Rotated across a release's on-track run so no collector sees a repeat. */
const ON_TRACK_IMAGES = [
  'Artwork detail',
  'Behind the scenes',
  'Artist at work',
  'Artist portrait',
];

/**
 * Build the phase-1 mock world by REPLAYING history through the public
 * DataLayer API with a shifted clock: real CSV imports (mess included), real
 * plan generation, real reschedules and approvals — so every batch's story
 * is internally consistent with what the logic actually produces. The only
 * direct store writes are the things phase 3 will own: marking queued sends
 * as sent (what the cron worker will do) and completing a release.
 *
 * Everything is dated relative to "today" so the screens always look alive:
 *   - Falling Light: the delayed print release. Framed and unframed flows
 *     run as separate batches on their own dates; the framed flow has been
 *     split and delayed twice ("Framed 2" delayed once, "Framed 3" split
 *     two days ago with its delay notice still unapproved — the overdue
 *     state). The warehouse allocation sheet is imported.
 *   - Vessel VIII: sculpture, long window, on-track cadence with custom
 *     "casting" copy, one update pushed back by its approver and one dropped.
 *   - Blue Interval: completed, framed and unframed flows both fully sent.
 *   - Night Garden: imported yesterday, no promise dates yet.
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
  const batchOf = (releaseId: string, fulfilment: BatchFulfilment): Batch => {
    const batch = [...layer._store.batches.values()].find(
      (b) => b.releaseId === releaseId && b.fulfilment === fulfilment,
    );
    if (!batch) throw new Error(`Seed error: no ${fulfilment} batch for ${releaseId}`);
    return batch;
  };
  const sentAt = (send: ScheduledSend) =>
    new Date(parseDay(send.scheduledDate).getTime() - 2 * 3600_000).toISOString();
  const approveAndSendPlan = async (batchId: string, sendUpTo: (s: ScheduledSend) => boolean) => {
    await layer.submitBatchPlanForApproval(batchId);
    for (const send of findSends(batchId)) {
      await layer.approveSend(send.id);
      if (sendUpTo(send)) markSent(layer, send.id, sentAt(send));
    }
  };

  /**
   * Pick a hero image for every slot a release owes one for.
   *
   * There is no master default any more, so this is setup work a real operator
   * does before anything can be approved — and the seed has to do it too, or
   * its own story cannot approve its own sends. Called AFTER the promise dates
   * are set, because the dates decide how many on-track pictures a release
   * needs; anything chosen by hand above is left alone.
   *
   * Night Garden deliberately never calls this. It is the release that has
   * only just been imported, so it is where the unfinished state — "Not
   * chosen", the warning band, the shut Submit — is actually visible.
   */
  const pickImagesFor = async (releaseId: string) => {
    const release = layer._store.releases.get(releaseId)!;
    const batches = [...layer._store.batches.values()].filter((b) => b.releaseId === releaseId);
    const sends = [...layer._store.sends.values()].filter((s) => s.releaseId === releaseId);
    let nth = 0;
    for (const slot of requiredImageSlots(release, batches, sends, T)) {
      const onTrack = slot.startsWith('pp-ontrack-');
      const name = onTrack ? ON_TRACK_IMAGES[nth++ % ON_TRACK_IMAGES.length] : MILESTONE_IMAGES[slot];
      if (release.templateImages[slot] || !name) continue;
      await layer.setReleaseEmailImage(releaseId, slot, name);
    }
  };

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
  clock(-118);
  await layer.setPromiseDate(batchOf(blueInterval.id, 'unframed').id, addDays(T, -40));
  await layer.setPromiseDate(batchOf(blueInterval.id, 'framed').id, addDays(T, -30));
  await pickImagesFor(blueInterval.id);
  clock(-117);
  await approveAndSendPlan(batchOf(blueInterval.id, 'unframed').id, () => true);
  await approveAndSendPlan(batchOf(blueInterval.id, 'framed').id, () => true);
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
  // The CRM manager picks hero images for the templated emails at setup.
  await layer.setReleaseEmailImage(fallingLight.id, 'pp-printing', 'Studio — printing');
  await layer.setReleaseEmailImage(fallingLight.id, 'pp-signing', 'Artist at work');
  await layer.setReleaseEmailImage(fallingLight.id, 'pp-ontrack-1', 'Artwork detail');
  await layer.setReleaseEmailImage(fallingLight.id, 'pp-delay', 'Artist portrait');
  const flFramed = batchOf(fallingLight.id, 'framed');
  const flUnframed = batchOf(fallingLight.id, 'unframed');

  // Separate dates per flow: unframed ships first, framing adds weeks.
  clock(-58);
  await layer.setPromiseDate(flUnframed.id, addDays(T, 10));
  await layer.setPromiseDate(flFramed.id, addDays(T, 20));
  await pickImagesFor(fallingLight.id);
  clock(-57);
  // Unframed: printing and signing out on schedule; dispatch queued.
  await approveAndSendPlan(flUnframed.id, (s) => s.templateRef !== 'pp-dispatch');
  // Framed: printing and signing out; framing and dispatch still ahead.
  await approveAndSendPlan(
    flFramed.id,
    (s) => s.templateRef === 'pp-printing' || s.templateRef === 'pp-signing',
  );
  const flFraming = findSends(flFramed.id).find((s) => s.templateRef === 'pp-framing');

  // T-12: the framers push the second framing run back — 6 framed orders
  // split off into "Framed 2", delayed to T+45. Delay notice approved and
  // sent same day; its regenerated framing email also went out.
  clock(-12);
  await as('user-pm');
  const flSplit1 = await layer.reschedule({
    releaseId: fallingLight.id,
    batchId: flFramed.id,
    orderIds: findOrders(fallingLight.id, [
      '#AA10428',
      '#AA10431',
      '#AA10433',
      '#AA10436',
      '#AA10439',
      '#AA10440',
    ]),
    newPromiseDate: addDays(T, 45),
    reason: 'Second framing run pushed back at the framers',
    delaySubject: 'An update on your Falling Light delivery date',
    delayBody: buildDefaultDelayEmail(
      layer._store.releases.get(fallingLight.id)!,
      addDays(T, 20),
      addDays(T, 45),
      'The second framing run has been pushed back at our framers',
    ).body,
    userId: 'user-pm',
  });
  await as('user-crm');
  const flFramed2Sends = findSends(flSplit1.batch.id);
  const flDelay1 = flFramed2Sends.find((s) => s.type === 'delay')!;
  await layer.approveSend(flDelay1.id);
  markSent(layer, flDelay1.id, sentAt(flDelay1));
  const flF2Framing = flFramed2Sends.find((s) => s.templateRef === 'pp-framing');
  if (flF2Framing) {
    await layer.approveSend(flF2Framing.id);
    markSent(layer, flF2Framing.id, sentAt(flF2Framing));
  }

  // The framed batch's own framing email fired on schedule at T-8.
  clock(-8);
  if (flFraming) markSent(layer, flFraming.id, sentAt(flFraming));

  // T-5: a refund comes through Shopify; the order is removed by hand.
  clock(-5);
  await as('user-crm');
  const [refunded] = findOrders(fallingLight.id, ['#AA10442']);
  await layer.removeOrder(refunded, 'Refunded in Shopify — collector cancelled');

  // T-4: the warehouse shares the edition allocation sheet; two orders are
  // still unallocated and one sheet row has no matching order — both states
  // the screens should surface.
  clock(-4);
  await as('user-warehouse');
  await layer.importAllocations(fallingLight.id, FALLING_LIGHT_ALLOCATION_CSV);

  // T-2: frame moulding out of stock for 4 framed orders — split to
  // "Framed 3", delayed to T+75. The delay notice is still waiting for
  // approval, two days past its scheduled date: the overdue state.
  clock(-2);
  await as('user-warehouse');
  await layer.reschedule({
    releaseId: fallingLight.id,
    batchId: flFramed.id,
    orderIds: findOrders(fallingLight.id, ['#AA10419', '#AA10443', '#AA10446', '#AA10449']),
    newPromiseDate: addDays(T, 75),
    reason: 'Frame moulding out of stock at the supplier',
    delaySubject: 'An update on your Falling Light delivery date',
    delayBody: buildDefaultDelayEmail(
      layer._store.releases.get(fallingLight.id)!,
      addDays(T, 20),
      addDays(T, 75),
      'The moulding used for your frame is out of stock with our supplier, and the replacement batch has a longer lead time than expected',
    ).body,
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
  // Sculpture updates get release-level custom copy before the plan is
  // generated — the on-track master reads too print-like for a bronze.
  await layer.updateReleaseEmail(vessel.id, 'pp-ontrack', {
    headline: 'Casting in progress',
    body: `A quick update on {{release_title}} by {{artist}}: casting and finishing at the foundry are progressing as planned, and we're currently on track to ship your edition between {{ship_window}}.

You can expect more updates along the way, but please don't hesitate to contact us if you have any questions.`,
  });
  await layer.setReleaseEmailImage(vessel.id, 'pp-ontrack-1', 'Artist at work');
  await layer.setReleaseEmailImage(vessel.id, 'pp-ontrack-2', 'Artwork detail');
  await layer.setReleaseEmailImage(vessel.id, 'pp-ontrack-3', 'Behind the scenes');
  clock(-19);
  await layer.setPromiseDate(vBatch.id, addDays(T, 150));
  await pickImagesFor(vessel.id);
  await layer.submitBatchPlanForApproval(vBatch.id);
  clock(-18);
  const vSends = findSends(vBatch.id);
  await layer.approveSend(vSends[0].id);
  markSent(layer, vSends[0].id, sentAt(vSends[0]));
  /* The third update needed sculpture-specific copy, so its approver pushed
     it back rather than parking it — there is no hold any more: an approver
     either approves, moves the date, or cancels. */
  if (vSends[2]) {
    await layer.updateSend(vSends[2].id, {
      scheduledDate: addDays(vSends[2].scheduledDate, 21),
    });
  }
  // December's update is dropped — the studio is sending a printed card instead.
  if (vSends[4]) await layer.cancelSend(vSends[4].id);

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
