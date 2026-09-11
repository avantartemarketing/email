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
  'pp-signed': 'Signed by the artist',
  'pp-production': 'Production in progress',
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

/* The three real closings, from the archive of 13 real sends (7 Sep 2026).
   Which one an email carries is not taste — it tracks whether another CRM
   email follows, which the plan generator decides when it builds the
   schedule. `{{closing_line}}` is resolved per send from its position;
   these are its values. */
export const CLOSING_MORE_UPDATES =
  "You can expect more updates along the way, but please don't hesitate to contact us if you have any questions.";
export const CLOSING_ONE_MORE =
  "We'll be in touch with another update before it leaves, but if you have any questions in the meantime, please reply to this email.";
export const CLOSING_TRACKING =
  "As soon as your order is on its way, you'll receive a separate email with tracking details and an estimated delivery date.";

/* Every master's copy below is reseeded from the archive — same skeleton,
   same phrasing, with the sentences Mattie adapts by hand replaced by
   computed tokens: {{edition_noun}}, {{next_destination}},
   {{remaining_route}}, {{closing_line}}, {{ship_window_short}}. */
export const MASTER_TEMPLATES: Record<TemplateRef, MasterTemplate> = {
  'pp-printing': {
    ref: 'pp-printing',
    name: 'Milestone — printing in progress',
    subject: '{{artist}} · Printing in progress',
    headline: 'Printing in progress',
    body: `For the last few weeks, printing of your artwork by {{artist}} has been underway at Make-Ready, our specialist fine art printmaking studio based in North London. Once complete, it will be {{remaining_route}}.

We're currently on track to ship your {{edition_noun}} by {{ship_window_short}}.

{{closing_line}}`,
    stepTitle: 'Printing',
    stepText:
      'Your edition is printed at Make-Ready, our specialist fine art printmaking studio, and checked by hand before it moves to the next stage.',
  },
  'pp-signing': {
    ref: 'pp-signing',
    name: 'Milestone — with the artist for signing',
    subject: '{{artist}} · Signing in progress',
    headline: 'Signing in progress',
    body: `Your artwork from our recent collaboration with {{artist}} has been printed and is now with the artist for signing. This step takes time, but it will be essential in proving the authenticity of your print in years to come.

We're currently on track to ship your {{edition_noun}} by {{ship_window_short}}.

{{closing_line}}`,
    stepTitle: 'Signing',
    stepText:
      'Your edition is with the artist for their signature — the step that confirms its authenticity for years to come.',
  },
  /* The archive's second signing-stage email. The body CLAIMS a signature, so
     the calendar must never send it on its own say-so — the approval step is
     the truth gate: the approver approves it only once it is true. */
  'pp-signed': {
    ref: 'pp-signed',
    name: 'Milestone — signed by the artist',
    subject: '{{artist}} · Your artwork has been signed',
    headline: 'Your artwork has been signed',
    body: `Your artwork from our recent collaboration with {{artist}} has been signed by the artist and is now {{next_destination}}.

We're still on track to ship your {{edition_noun}} by {{ship_window_short}}.

{{closing_line}}`,
    // No card row of its own: the real cards go Framing → Packing → Dispatching.
  },
  /* Sculptures' real first email: the craft story that justifies the wait.
     {{craft_line}} has a generic default; each release writes its own once,
     via the existing release-level copy override. */
  'pp-production': {
    ref: 'pp-production',
    name: 'Milestone — production in progress (sculpture)',
    subject: '{{artist}} · Your edition is in progress',
    headline: 'Your edition is in progress',
    body: `The creation of your {{release_title}} edition by {{artist}} is now underway. {{craft_line}}

Once complete, your artwork will be entrusted to our specialist art handling team in Amsterdam for final checks and preparation for dispatch.

We currently expect to ship your {{edition_noun}} by {{ship_window_short}}. We understand this may feel like a long wait, but we're confident it will be worth it. Thank you for your continued patience.

{{closing_line}}`,
  },
  'pp-framing': {
    ref: 'pp-framing',
    name: 'Milestone — framing',
    subject: '{{artist}} · Framing in progress',
    headline: 'Framing in progress',
    body: `Your artwork from our recent collaboration with {{artist}} is now being professionally framed at our bespoke framing studio just outside of Amsterdam. Framing usually takes 2 to 4 weeks to complete.

We're still on track to ship your framed edition by {{ship_window_short}}.

{{closing_line}}`,
    stepTitle: 'Framing',
    stepText:
      'Your signed print is professionally framed at our bespoke framing studio. Framing usually takes 2 to 4 weeks to complete.',
  },
  'pp-dispatch': {
    ref: 'pp-dispatch',
    name: 'Milestone — preparing for dispatch',
    subject: '{{artist}} · Preparing for dispatch',
    headline: 'Preparing for dispatch',
    body: `Great news — your artwork from our recent collaboration with {{artist}} has passed its final checks and is now in the hands of our specialist art handling team in Amsterdam, where it is being carefully prepared for dispatch.

We're still on track to ship your {{edition_noun}} by {{ship_window_short}}.

${CLOSING_TRACKING} If you have any questions in the meantime, please don't hesitate to reach out at collecting@avantarte.com.`,
    stepTitle: 'Dispatching',
    stepText:
      "Once everything's ready to go, we'll email you an update with a delivery date and tracking details. Dispatch is estimated to be around {{ship_window_short}}.",
  },
  'pp-ontrack': {
    ref: 'pp-ontrack',
    name: 'Milestone — on track (generic)',
    subject: '{{artist}} · An update on your order',
    headline: 'Everything is on track',
    body: `A quick update on {{release_title}} by {{artist}}: everything is proceeding to schedule, and we're currently on track to ship your {{edition_noun}} by {{ship_window_short}}. No news is good news — production is progressing exactly as planned.

{{closing_line}}`,
    // Fillers never appear in a "What happens next?" card.
  },
  /* Lean, like the real one: no salutation, no old date (the brief keeps it
     for the writer), no next-steps card, no hero image required. */
  'pp-delay': {
    ref: 'pp-delay',
    name: 'Delay notice',
    subject: '{{artist}} · An update on your order',
    headline: 'An update on your order',
    body: `We're reaching out with an update on your artwork from our recent collaboration with {{artist}}. {{reason_line}}

Our team is working hard to resolve this as quickly as possible; however, we now expect to ship your {{edition_noun}} by {{ship_window_short}}.

We're very sorry for this unexpected delay and appreciate your patience as we work through this.

If you have any questions in the meantime, please don't hesitate to reach out at collecting@avantarte.com.`,
  },
};

/** The second on-track body: consecutive check-ins must not repeat verbatim.
    The nth filler in a plan takes `onTrackBody(n)`; a release-level override
    of pp-ontrack replaces both. */
const ONTRACK_BODY_2 = `Thank you for your patience as your {{release_title}} {{edition_noun}} by {{artist}} continues to progress steadily. We wanted to check in and reassure you that everything remains on track, and we still expect to ship by {{ship_window_short}}.

{{closing_line}}`;

export function onTrackBody(nth: number): string {
  return nth % 2 === 0 ? ONTRACK_BODY_2 : MASTER_TEMPLATES['pp-ontrack'].body;
}

/** Milestone order for prints; the plan generator draws from this sequence.
    Two signing-stage emails, like the real archive: "with the artist" then
    "signed". Short windows drop the early ones, which reproduces Mattie's
    own timing choices (a month out, the signed email is the one that goes). */
export const PRINT_SEQUENCE: TemplateRef[] = [
  'pp-printing',
  'pp-signing',
  'pp-signed',
  'pp-framing',
  'pp-dispatch',
];

/** Sculptures: the craft-story production email, then dispatch — the plan
    generator inserts on-track fillers into the long gap between them. */
export const SCULPTURE_SEQUENCE: TemplateRef[] = ['pp-production', 'pp-dispatch'];

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
  release: Pick<Release, 'artist' | 'title'> & Partial<Pick<Release, 'productKind'>>,
  promiseDateIso: string,
  extra: TemplateFields = {},
): TemplateFields {
  return {
    artist: release.artist,
    release_title: release.title,
    promise_date: formatDay(promiseDateIso),
    ship_window: shipWindowText(promiseDateIso),
    ship_window_short: shipWindowShort(promiseDateIso),
    /* Defaults for the stage tokens, so a preview without batch context still
       renders whole sentences. `stageFields` overrides them per send. */
    edition_noun: release.productKind === 'sculpture' ? 'sculpture edition' : 'edition',
    closing_line: CLOSING_MORE_UPDATES,
    next_destination:
      'on its way to our specialist art handling team in Amsterdam, where it will be carefully prepared for dispatch',
    remaining_route: 'signed by the artist and carefully prepared for dispatch',
    craft_line:
      'Each edition is carefully crafted — a meticulous process that requires time and great attention to detail.',
    ...extra,
  };
}

/**
 * The tokens that depend on WHERE a send sits: its batch, and what still
 * follows it in that batch's plan. This is the mechanism that replaces
 * Mattie's hand-adaptation — the diverging sentences in the real archive are
 * the batch's remaining stages leaking into prose, so they are computed from
 * exactly that.
 */
export function stageFields(
  release: Pick<Release, 'productKind'>,
  batch: Pick<Batch, 'fulfilment'> | null,
  upcomingRefs: TemplateRef[],
): TemplateFields {
  const framingAhead = upcomingRefs.includes('pp-framing');
  /* The closing tracks how many CRM emails still follow: two or more → the
     "more updates" line; exactly one (usually dispatch) → "in touch with
     another update before it leaves"; none → the tracking handoff, though in
     practice dispatch is always last and carries that line natively. */
  const closing =
    upcomingRefs.length >= 2
      ? CLOSING_MORE_UPDATES
      : upcomingRefs.length === 1
        ? CLOSING_ONE_MORE
        : CLOSING_TRACKING;
  return {
    edition_noun:
      release.productKind === 'sculpture'
        ? 'sculpture edition'
        : batch?.fulfilment === 'framed'
          ? 'framed edition'
          : 'edition',
    closing_line: closing,
    next_destination: framingAhead
      ? 'on its way to our bespoke framing studio just outside of Amsterdam, where it will be framed. The framing process usually takes between two and four weeks'
      : 'on its way to our specialist art handling team in Amsterdam, where it will be carefully prepared for dispatch',
    remaining_route: framingAhead
      ? 'signed by the artist, professionally framed, and carefully prepared for dispatch'
      : 'signed by the artist and carefully prepared for dispatch',
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
export const NO_IMAGE_YET = 'No image picked.';

/** Said when somebody tries to approve a delay email nobody has written. */
export const NOT_WRITTEN_YET = 'Not written yet.';

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
  /* No pp-delay here any more: the real delay email carries no hero image
     (7 Sep 2026, the archive — logo, four short paragraphs, no card), so the
     tool must not demand a picture the email will never show. */
  return [
    ...before,
    ...onTrackSlotsInPlay(release, batches, sends, todayIso),
    'pp-dispatch',
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
    /* Every real card ends Packing → Dispatching; the tool used to merge the
       two into one Dispatching row. The Packing row rides in just before it. */
    if (ref === 'pp-dispatch') {
      steps.push({
        templateRef: 'pp-dispatch',
        title: 'Packing',
        text: patchTokens(
          'Our Amsterdam-based team will carefully pack your edition. You can expect this to take place in the week before {{promise_date}}.',
          fields,
        ),
      });
    }
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
