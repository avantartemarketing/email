import type { TemplateRef } from '../types';

/**
 * Local mirrors of the six HubSpot master templates (`pp-*`). The real copy
 * lives in HubSpot and is owned by the team; these defaults exist so the app
 * can pre-fill an editable subject/body per send and render previews. At
 * dispatch time the app clones the HubSpot master and patches these same
 * fields into it (see scripts/hubspot-pipe-test.mjs for the proven pattern).
 *
 * Tokens use `{{token}}` syntax, matching what we patch in HubSpot:
 *   - {{first_name}}      — per-recipient, patched at send time (HubSpot contact token)
 *   - {{artist}}          — release artist
 *   - {{release_title}}   — release title
 *   - {{promise_date}}    — the batch's (new) promise date, long-formatted
 *   - {{old_promise_date}}— previous promise date (delay template only)
 */

export interface MasterTemplate {
  ref: TemplateRef;
  name: string;
  subject: string;
  body: string;
}

export const MASTER_TEMPLATES: Record<TemplateRef, MasterTemplate> = {
  'pp-printing': {
    ref: 'pp-printing',
    name: 'Milestone — printing in progress',
    subject: '{{release_title}} — printing is underway',
    body: `Hi {{first_name}},

Good news — printing of {{release_title}} by {{artist}} is underway. Each edition is being produced with the artist's studio and checked by hand before it moves to the next stage.

Your edition is on schedule for delivery by {{promise_date}}. We'll be in touch as it reaches each milestone along the way.

Thank you for collecting with us,
Avant Arte`,
  },
  'pp-signing': {
    ref: 'pp-signing',
    name: 'Milestone — signing',
    subject: '{{artist}} is signing your edition',
    body: `Hi {{first_name}},

Your edition of {{release_title}} has reached the studio — {{artist}} is now signing and numbering each work in the edition by hand.

Everything remains on track for delivery by {{promise_date}}.

Thank you for collecting with us,
Avant Arte`,
  },
  'pp-framing': {
    ref: 'pp-framing',
    name: 'Milestone — framing',
    subject: 'Your edition of {{release_title}} is being framed',
    body: `Hi {{first_name}},

{{release_title}} by {{artist}} is now with our framers. Each work is mounted, framed and condition-checked individually before it's cleared for dispatch.

Your delivery remains on schedule for {{promise_date}}.

Thank you for collecting with us,
Avant Arte`,
  },
  'pp-dispatch': {
    ref: 'pp-dispatch',
    name: 'Milestone — preparing for dispatch',
    subject: '{{release_title}} — preparing for dispatch',
    body: `Hi {{first_name}},

Your edition of {{release_title}} by {{artist}} has passed its final checks and is being carefully packed for dispatch.

You'll receive tracking details from our shipping partner as soon as it's collected. Delivery is expected by {{promise_date}}.

Thank you for collecting with us,
Avant Arte`,
  },
  'pp-ontrack': {
    ref: 'pp-ontrack',
    name: 'Milestone — on track (generic)',
    subject: 'An update on {{release_title}}',
    body: `Hi {{first_name}},

A quick update on {{release_title}} by {{artist}}: production is progressing as planned and your edition remains on track for delivery by {{promise_date}}.

We'll keep you posted as it moves through each stage.

Thank you for collecting with us,
Avant Arte`,
  },
  'pp-delay': {
    ref: 'pp-delay',
    name: 'Delay notice',
    subject: 'An update on your {{release_title}} delivery date',
    body: `Hi {{first_name}},

We're writing with an update on {{release_title}} by {{artist}}. {{reason_line}}

Your edition was previously expected by {{old_promise_date}}. The updated delivery date is {{promise_date}}.

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
  old_promise_date?: string;
  reason_line?: string;
  first_name?: string;
  [key: string]: string | undefined;
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

export function renderTemplate(
  ref: TemplateRef,
  fields: TemplateFields,
): { subject: string; body: string } {
  const master = MASTER_TEMPLATES[ref];
  return {
    subject: patchTokens(master.subject, fields),
    body: patchTokens(master.body, fields),
  };
}

/** Final per-recipient render, used for previews and the immutable send log. */
export function renderForRecipient(text: string, collectorName: string): string {
  const firstName = collectorName.trim().split(/\s+/)[0] || 'there';
  return patchTokens(text, { first_name: firstName });
}
