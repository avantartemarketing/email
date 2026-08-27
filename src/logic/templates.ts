import type { Release, SendStep, TemplateRef } from '../types';
import { addDays, formatDay } from './dates';

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

Your edition was previously expected to ship by {{old_promise_date}}. We now expect to ship it between {{ship_window}}.

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
