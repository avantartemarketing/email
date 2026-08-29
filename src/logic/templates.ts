import type {
  Batch,
  ImageSlot,
  OnTrackSlot,
  Release,
  ScheduledSend,
  SendStatus,
  SendStep,
  TemplateRef,
} from '../types';
import { addDays, formatDay, formatDayShort } from './dates';
import { generateMilestonePlan } from './plan';

/**
 * What each email is called, everywhere. It lives here rather than in `ui/`
 * because the logic layer needs it too — `slotLabel` names the slot a thrown
 * message asks somebody to go and fix, and a rule that names a thing must name
 * it the way the screen does. `ui/format.tsx` re-exports it, so no importer
 * had to change.
 */
export const TEMPLATE_LABELS: Record<TemplateRef, string> = {
  'pp-printing': 'Printing in progress',
  'pp-signing': 'Signing',
  'pp-framing': 'Framing',
  'pp-dispatch': 'Preparing for dispatch',
  'pp-ontrack': 'On track',
  'pp-delay': 'Delay notice',
};

/** Statuses a send can still be changed in — everything before it went out. */
export const UNSENT_STATUSES: SendStatus[] = [
  'draft',
  /* An unwritten delay email is as unsent as a draft, and it occupies a date
     in the batch's story: leaving it out here would let a moved milestone
     land on top of a delay notice nobody could see yet. */
  'awaiting_copy',
  'pending_approval',
  'approved',
];

/**
 * Local mirrors of the six HubSpot master templates (`pp-*`). The real
 * design lives in HubSpot and is owned by the team; these mirrors carry the
 * same *structure* as the real emails so every editable field here maps onto
 * a patchable module field in the HubSpot master:
 *
 *   - `subject`   — the email subject line
 *   - `headline`  — the centered H1 under the hero image
 *   - `body`      — the paragraphs under the headline
 *   - step copy   — one "What happens next?" row per upcoming milestone
 *                   (icon + bold title + text in the real email)
 *
 * At dispatch time the app clones the HubSpot master and patches these same
 * fields into it (see scripts/hubspot-pipe-test.mjs for the proven pattern).
 * The hero image, logo and footer belong to the master and are not edited
 * here.
 *
 * Tokens use `{{token}}` syntax, matching what we patch in HubSpot:
 *   - {{first_name}}      — per-recipient, patched at send time (HubSpot contact token)
 *   - {{artist}}          — release artist
 *   - {{release_title}}   — release title
 *   - {{promise_date}}    — start of the promised dispatch window, long-formatted
 *   - {{ship_window}}     — "30 October 2026 and 6 November 2026" (the window)
 *   - {{old_promise_date}}— previous promise date (delay template only)
 */

/** The promised dispatch window: opens on the promise date, one week long. */
export const SHIP_WINDOW_DAYS = 7;

export function shipWindowText(promiseDateIso: string): string {
  return `${formatDay(promiseDateIso)} and ${formatDay(addDays(promiseDateIso, SHIP_WINDOW_DAYS))}`;
}

/**
 * The same window, short enough to be a figure — "17 – 24 Sept 2026".
 *
 * `shipWindowText` is written for the inside of a sentence ("we expect to ship
 * between X and Y") and is too long to read as a value. This is the window
 * drawn AS a window, which is what let the batch header drop its "From": a
 * promise date is the start of a seven-day window, and a range says so
 * without a preposition doing the work.
 *
 * What is shared is said once — the month where both ends fall in it, the year
 * where both fall in that. A range that repeats "Sept 2026" twice is a range
 * nobody reads to the end of.
 */
export function shipWindowShort(promiseDateIso: string): string {
  const from = promiseDateIso;
  const to = addDays(promiseDateIso, SHIP_WINDOW_DAYS);
  const a = formatDayShort(from).split(' '); // ["17", "Sept", "2026"]
  const b = formatDayShort(to).split(' ');
  if (a[2] !== b[2]) return `${formatDayShort(from)} – ${formatDayShort(to)}`;
  if (a[1] !== b[1]) return `${a[0]} ${a[1]} – ${b[0]} ${b[1]} ${b[2]}`;
  return `${a[0]} – ${b[0]} ${b[1]} ${b[2]}`;
}

export interface MasterTemplate {
  ref: TemplateRef;
  name: string;
  subject: string;
  headline: string;
  body: string;
  /** Copy for this milestone's row in another email's "What happens next?"
   *  card. Absent for templates that never appear there. */
  stepTitle?: string;
  stepText?: string;
}

const CLOSING_LINE =
  "You can expect more updates along the way, but please don't hesitate to contact us if you have any questions.";

export const MASTER_TEMPLATES: Record<TemplateRef, MasterTemplate> = {
  'pp-printing': {
    ref: 'pp-printing',
    name: 'Milestone — printing in progress',
    subject: '{{artist}} · Printing in progress',
    headline: 'Printing in progress',
    body: `Printing of your artwork by {{artist}} is underway at our specialist fine art printmaking studio. Once complete, it will be signed by the artist and carefully prepared for dispatch.

We're currently on track to ship your edition between {{ship_window}}.

${CLOSING_LINE}`,
    stepTitle: 'Printing',
    stepText:
      'Your edition is printed at our specialist fine art printmaking studio and checked by hand before it moves to the next stage.',
  },
  'pp-signing': {
    ref: 'pp-signing',
    name: 'Milestone — signing',
    subject: '{{artist}} · Signing your edition',
    headline: 'Signing in progress',
    body: `Your edition of {{release_title}} has been returned to {{artist}} for their signature. This step takes time, but is essential to confirming the authenticity of your edition for years to come.

We're currently on track to ship your edition between {{ship_window}}.

${CLOSING_LINE}`,
    stepTitle: 'Signing',
    stepText:
      'Your edition is returned to the artist for their signature — the step that confirms its authenticity for years to come.',
  },
  'pp-framing': {
    ref: 'pp-framing',
    name: 'Milestone — framing',
    subject: '{{artist}} · Framing your edition',
    headline: 'Framing in progress',
    body: `Your edition of {{release_title}} is now with our specialist framers. Each work is mounted, framed and condition-checked individually before it's cleared for dispatch.

We're currently on track to ship your edition between {{ship_window}}.

${CLOSING_LINE}`,
    stepTitle: 'Framing',
    stepText:
      'Your edition is mounted, framed and condition-checked individually by our specialist framers.',
  },
  'pp-dispatch': {
    ref: 'pp-dispatch',
    name: 'Milestone — preparing for dispatch',
    subject: '{{artist}} · Preparing your edition for dispatch',
    headline: 'Preparing for dispatch',
    body: `Your edition of {{release_title}} by {{artist}} has passed its final checks. Our specialist art handling team in Amsterdam is now carefully packing it for dispatch.

Once everything's ready to go, we'll email you an update with a delivery date and tracking details. Dispatch is estimated to be between {{ship_window}}.`,
    stepTitle: 'Dispatching',
    stepText:
      "Our specialist art handling team in Amsterdam carefully packs your edition, and we'll email you a delivery date and tracking details once it's collected. Dispatch is estimated to be between {{ship_window}}.",
  },
  'pp-ontrack': {
    ref: 'pp-ontrack',
    name: 'Milestone — on track (generic)',
    subject: 'An update on {{release_title}}',
    headline: 'Everything is on track',
    body: `A quick update on {{release_title}} by {{artist}}: production is progressing as planned, and we're currently on track to ship your edition between {{ship_window}}.

${CLOSING_LINE}`,
    // Fillers never appear in a "What happens next?" card.
  },
  'pp-delay': {
    ref: 'pp-delay',
    name: 'Delay notice',
    subject: 'An update on your {{release_title}} delivery date',
    headline: 'An update on your order',
    body: `Hi {{first_name}},

We're writing with an update on {{release_title}} by {{artist}}. {{reason_line}}

Your edition was previously expected to ship from {{old_promise_date}}. We now expect to ship it between {{ship_window}}.

We know delays are frustrating, and we're sorry for the wait — every edition is made to the artist's exacting standard, and we won't ship anything that falls short of it. We'll continue to update you as your edition progresses, and you can reply to this email with any questions.

Thank you for your patience,
Avant Arte`,
  },
};

/** Milestone order for prints; the plan generator draws from this sequence. */
export const PRINT_SEQUENCE: TemplateRef[] = [
  'pp-printing',
  'pp-signing',
  'pp-framing',
  'pp-dispatch',
];

/** Sculptures have no printing/signing/framing stages — generic updates, then dispatch. */
export const SCULPTURE_SEQUENCE: TemplateRef[] = ['pp-ontrack', 'pp-dispatch'];

export interface TemplateFields {
  artist?: string;
  release_title?: string;
  promise_date?: string;
  ship_window?: string;
  old_promise_date?: string;
  reason_line?: string;
  first_name?: string;
  [key: string]: string | undefined;
}

/**
 * The standard field set for a release + promise date. `promiseDateIso` is
 * the raw ISO date so the ship window can be derived from it.
 */
export function buildTemplateFields(
  release: Pick<Release, 'artist' | 'title'>,
  promiseDateIso: string,
  extra: TemplateFields = {},
): TemplateFields {
  return {
    artist: release.artist,
    release_title: release.title,
    promise_date: formatDay(promiseDateIso),
    ship_window: shipWindowText(promiseDateIso),
    ...extra,
  };
}

/**
 * Replace `{{token}}` occurrences with field values. Unknown tokens are left
 * in place — `{{first_name}}` intentionally survives until per-recipient
 * rendering at send time.
 */
export function patchTokens(text: string, fields: TemplateFields): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, token: string) => {
    const value = fields[token.toLowerCase()];
    return value !== undefined ? value : whole;
  });
}

/**
 * The template a release actually uses for a ref: the master, with any
 * release-level copy overrides applied. Overrides keep tokens intact, so
 * they patch cleanly for every batch's dates.
 */
export function effectiveTemplate(release: Release, ref: TemplateRef): MasterTemplate {
  const master = MASTER_TEMPLATES[ref];
  const override = release.templateOverrides[ref];
  if (!override) return master;
  return {
    ...master,
    subject: override.subject ?? master.subject,
    headline: override.headline ?? master.headline,
    body: override.body ?? master.body,
  };
}

/**
 * The milestone sequence for a release, with release-disabled milestones
 * removed. `pp-dispatch` is the anchor of every plan and cannot be disabled.
 */
export function releaseSequenceFor(release: Release): TemplateRef[] {
  const base = release.productKind === 'sculpture' ? SCULPTURE_SEQUENCE : PRINT_SEQUENCE;
  return base.filter(
    (ref) => ref === 'pp-dispatch' || !release.disabledTemplates.includes(ref),
  );
}

/**
 * The gap-filler template for a release's plans: the generic on-track email,
 * or null (no fillers) when the release switched it off.
 */
export function releaseFillerTemplate(release: Release): TemplateRef | null {
  return release.disabledTemplates.includes('pp-ontrack') ? null : 'pp-ontrack';
}

/**
 * The milestone sequence for one batch: the release's sequence, minus the
 * framing email for unframed batches — unframed prints never get framed.
 */
export function sequenceForBatch(
  release: Release,
  batch: Pick<Batch, 'fulfilment'>,
): TemplateRef[] {
  const base = releaseSequenceFor(release);
  return batch.fulfilment === 'unframed' ? base.filter((ref) => ref !== 'pp-framing') : base;
}

/**
 * Image slots, in the order the release-emails screen lists them. The
 * on-track email gets three so a long plan's fillers rotate pictures.
 */
export const onTrackSlot = (n: number): OnTrackSlot => `pp-ontrack-${n}`;

/**
 * How many on-track slots a release needs: as many as its LONGEST dispatch
 * window will send.
 *
 * The owner's rule, 28 Aug 2026 — "the email tab should populate depending on
 * the number of emails required for the longest dispatch date". A release runs
 * several batches at several dates, and the set of images has to cover the one
 * that sends the most; sizing to the shortest would leave the longest batch
 * short of a picture halfway through its plan.
 *
 * Counted from the plan the app would actually generate, not from the number
 * of weeks: the plan is what decides where a filler goes, and a second
 * calculation of that would be a second answer.
 *
 * Never fewer than one, so a release with no dates yet still has something to
 * set up against.
 */
export function onTrackSlotsNeeded(
  release: Release,
  batches: Pick<Batch, 'promiseDate' | 'fulfilment'>[],
  todayIso: string,
): number {
  const filler = releaseFillerTemplate(release);
  if (!filler) return 0;
  let most = 0;
  for (const batch of batches) {
    if (!batch.promiseDate) continue;
    const plan = generateMilestonePlan(todayIso, batch.promiseDate, release.productKind, {
      sequence: sequenceForBatch(release, batch),
      fillerTemplate: filler,
    });
    most = Math.max(most, plan.filter((step) => step.templateRef === 'pp-ontrack').length);
  }
  return Math.max(most, 1);
}

/**
 * On-track slots the dates now need that have no image picked.
 *
 * Pushing a delivery date out adds on-track sends — that is what the ≤5-week
 * rule does — and each new one arrives pointing at a slot nobody has chosen a
 * picture for. The owner asked for it to be said out loud at the moment the
 * date changes, which is the one question this still answers: "did the dates
 * just ask for more pictures?" It is deliberately narrower than
 * `missingImagesFor`, which is what the page's band and the count read.
 */
export function missingOnTrackImages(
  release: Release,
  batches: Pick<Batch, 'promiseDate' | 'fulfilment'>[],
  todayIso: string,
): OnTrackSlot[] {
  return onTrackSlotsFor(release, batches, todayIso).filter(
    (slot) => !release.templateImages[slot],
  );
}

/** The slots themselves, in order: `pp-ontrack-1` … `pp-ontrack-N`. */
export function onTrackSlotsFor(
  release: Release,
  batches: Pick<Batch, 'promiseDate' | 'fulfilment'>[],
  todayIso: string,
): OnTrackSlot[] {
  return Array.from({ length: onTrackSlotsNeeded(release, batches, todayIso) }, (_, i) =>
    onTrackSlot(i + 1),
  );
}

/* ------------------------------------------------------------------------ *
 * Which pictures a release owes
 *
 * The owner, 28 Aug 2026: "For the image selection, it shouldn't have a
 * default." So `templateImages[slot]` stopped being an OVERRIDE of the
 * HubSpot master's own picture and became the only answer there is. An unset
 * slot is no longer a quiet fallback; it is unfinished setup, and the whole
 * app now needs one shared answer to "which slots does this release owe a
 * picture for", so the row list, the count, the warning band and the thing
 * that refuses to approve cannot drift apart.
 * ------------------------------------------------------------------------ */

/** Said by the shut Approve control and thrown by the layer behind it. */
export const NO_IMAGE_YET =
  "This email has no image yet — pick one on the release's All emails tab, then approve.";

/** Said when somebody tries to approve a delay email nobody has written. */
export const NOT_WRITTEN_YET =
  'The CRM team has not written this delay email yet — it is in Emails to write.';

/** `pp-ontrack-3` → "On track 3"; every other slot takes its template label. */
export function slotLabel(slot: ImageSlot): string {
  const nth = /^pp-ontrack-(\d+)$/.exec(slot);
  return nth ? `On track ${nth[1]}` : TEMPLATE_LABELS[slot as TemplateRef];
}

/**
 * The on-track run, extended to cover slots that queued sends already draw on.
 *
 * `onTrackSlotsNeeded` measures from TODAY to the promise date, so a window
 * that has simply got shorter as time passed asks for fewer slots than it did
 * when the plan was generated — while the sends generated against the longer
 * window are still sitting in the queue pointing at the slots it dropped.
 * Before "no default" that was harmless. Now it is a trap: such a send would
 * point at a slot with no row on the emails tab, so nobody could give it a
 * picture and nobody could approve it.
 *
 * Verified against the seeded world on 28 Aug 2026: Falling Light holds a
 * pending send on `pp-ontrack-2` dated 3 Oct while its tab lists one row.
 */
export function onTrackSlotsInPlay(
  release: Release,
  batches: Pick<Batch, 'promiseDate' | 'fulfilment'>[],
  sends: Pick<ScheduledSend, 'status' | 'imageSlot'>[],
  todayIso: string,
): OnTrackSlot[] {
  if (!releaseFillerTemplate(release)) {
    /* Switched off, so the release plans no fillers — but ONE row still has to
       exist, or the control that switched it off has nowhere to switch it back
       on from. The same argument `onTrackSlotsNeeded` already makes for a
       release with no dates yet. */
    return [onTrackSlot(1)];
  }
  let inUse = 0;
  for (const send of sends) {
    if (!UNSENT_STATUSES.includes(send.status)) continue;
    const nth = /^pp-ontrack-(\d+)$/.exec(send.imageSlot ?? '');
    if (nth) inUse = Math.max(inUse, Number(nth[1]));
  }
  return Array.from(
    { length: Math.max(onTrackSlotsNeeded(release, batches, todayIso), inUse) },
    (_, i) => onTrackSlot(i + 1),
  );
}

/**
 * Every slot this release owes a picture for, in the order the emails tab
 * lists them. Switched-off milestones are already gone — they never send, so
 * no picture is owed — but dispatch and the delay notice are always here,
 * because neither can be switched off.
 */
export function requiredImageSlots(
  release: Release,
  batches: Pick<Batch, 'promiseDate' | 'fulfilment'>[],
  sends: Pick<ScheduledSend, 'status' | 'imageSlot'>[],
  todayIso: string,
): ImageSlot[] {
  const sequence = releaseSequenceFor(release);
  const before = sequence.filter(
    (ref) => ref !== 'pp-ontrack' && ref !== 'pp-dispatch',
  ) as ImageSlot[];
  return [
    ...before,
    ...onTrackSlotsInPlay(release, batches, sends, todayIso),
    'pp-dispatch',
    'pp-delay',
  ];
}

/**
 * Those with no picture chosen.
 *
 * Falsy rather than `undefined`: an empty name is as missing as no name, and
 * this is the predicate a refusal to approve is written against.
 */
export function missingImagesFor(
  release: Release,
  batches: Pick<Batch, 'promiseDate' | 'fulfilment'>[],
  sends: Pick<ScheduledSend, 'status' | 'imageSlot'>[],
  todayIso: string,
): ImageSlot[] {
  return requiredImageSlots(release, batches, sends, todayIso).filter(
    (slot) => !release.templateImages[slot],
  );
}

/** Phase-1 stand-ins for the HubSpot image library. */
export const IMAGE_OPTIONS: string[] = [
  'Artist portrait',
  'Artist at work',
  'Studio — printing',
  'Studio — signing',
  'Framing bench',
  'Packing & dispatch',
  'Artwork detail',
  'Behind the scenes',
];

/**
 * Assign an image slot to each planned step: a milestone uses its own slot,
 * and the nth on-track filler uses the nth on-track slot.
 *
 * It used to cycle three slots round with a modulo, which meant a plan with
 * five fillers showed a collector the same two pictures twice. There are as
 * many slots as the longest window needs now (`onTrackSlotsNeeded`), so the
 * nth filler simply takes the nth slot and nobody sees a repeat.
 */
export function imageSlotsForPlan(refs: TemplateRef[]): ImageSlot[] {
  let ontrackCount = 0;
  return refs.map((ref) => {
    if (ref === 'pp-ontrack') {
      ontrackCount += 1;
      return onTrackSlot(ontrackCount);
    }
    return ref as ImageSlot;
  });
}

export function renderTemplate(
  ref: TemplateRef,
  fields: TemplateFields,
): { subject: string; headline: string; body: string } {
  const master = MASTER_TEMPLATES[ref];
  return {
    subject: patchTokens(master.subject, fields),
    headline: patchTokens(master.headline, fields),
    body: patchTokens(master.body, fields),
  };
}

/** Like renderTemplate, but honouring the release's copy overrides. */
export function renderReleaseTemplate(
  release: Release,
  ref: TemplateRef,
  fields: TemplateFields,
): { subject: string; headline: string; body: string } {
  const template = effectiveTemplate(release, ref);
  return {
    subject: patchTokens(template.subject, fields),
    headline: patchTokens(template.headline, fields),
    body: patchTokens(template.body, fields),
  };
}

/**
 * Build the "What happens next?" rows for a send: one row per upcoming
 * milestone that has step copy (fillers and delay notices don't). Mirrors
 * the card in the real email format.
 */
export function buildNextSteps(
  upcomingRefs: TemplateRef[],
  fields: TemplateFields,
): SendStep[] {
  const steps: SendStep[] = [];
  for (const ref of upcomingRefs) {
    const master = MASTER_TEMPLATES[ref];
    if (!master.stepTitle || !master.stepText) continue;
    steps.push({
      templateRef: ref,
      title: master.stepTitle,
      text: patchTokens(master.stepText, fields),
    });
  }
  return steps;
}

/** Final per-recipient render, used for previews and the immutable send log. */
export function renderForRecipient(text: string, collectorName: string): string {
  const name = collectorName.trim();
  // Shopify exports sometimes carry "Surname, First" names — greet with the
  // part after the comma, never "Hi Surname,,".
  const personal = name.includes(',')
    ? name.split(',').slice(1).join(' ').trim() || name.replace(/,/g, ' ').trim()
    : name;
  const firstName = personal.split(/\s+/)[0] || 'there';
  return patchTokens(text, { first_name: firstName });
}
