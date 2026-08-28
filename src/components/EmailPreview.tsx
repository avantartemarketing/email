import type { ReactElement } from 'react';
import type { SendStep } from '../types';
import { renderForRecipient } from '../logic/templates';

/**
 * A send as a collector will read it, mirroring the real HubSpot email:
 * wordmark, hero slot, centred headline, body, then the "What happens next?"
 * card.
 *
 * This is the one thing in the app that is NOT the UI — it is a rendered
 * artifact, somebody else's HTML previewed inside ours, and the kit says so
 * itself: the sizes inside one are "deliberately absent" from its reading
 * scale. So it wears the `rd-mail*` vocabulary, whose type is its own named
 * set of tokens (`--rd-email-*`), and it sits on the desk a shade darker than
 * the page — the way a sheet of paper does.
 *
 * The icons and footer live in the HubSpot master. The preview shows the
 * chosen hero rather than pretending we draw it; nothing chosen is a hatch,
 * because nothing-here-yet is a state and an empty grey box is a gap.
 *
 * That hatch says two different things and has to say them differently. On an
 * email nobody has finished setting up it is unfinished work — there is no
 * default any more, so it cannot be approved like this. On one that has
 * already gone out it is history: it left on whatever the master carried,
 * back when a default existed. Hence `sent`.
 *
 * `{{first_name}}` is personalised per recipient at dispatch; the preview
 * substitutes a sample name so reviewers read real copy, not tokens.
 */
export function EmailPreview({
  subject,
  headline,
  body,
  nextSteps,
  imageName,
  sampleRecipientName,
  sent,
}: {
  subject: string;
  headline?: string;
  body: string;
  nextSteps?: SendStep[];
  /** The release's picked hero image for this send's slot, if any. */
  imageName?: string;
  sampleRecipientName?: string;
  /** True for an email that already went out — see the note above. */
  sent?: boolean;
}): ReactElement {
  const sample = sampleRecipientName ?? 'Jane Smith';
  return (
    <div>
      <div className="rd-kv">
        <div className="rd-kvk">Subject</div>
        <div className="rd-kvv">{renderForRecipient(subject, sample)}</div>
      </div>
      <div className="rd-mail">
        <div className="rd-mailpaper">
          <div className="rd-mailmark">AVANT ARTE</div>
          <div className="rd-mailhero">
            {imageName
              ? `Hero image · ${imageName}`
              : sent
                ? 'Sent on the HubSpot master\u2019s own image'
                : 'No image picked yet'}
          </div>
          {headline ? <h1 className="rd-mailhead">{headline}</h1> : null}
          <div className="rd-mailbody">{renderForRecipient(body, sample)}</div>
          {nextSteps && nextSteps.length > 0 ? (
            <div className="rd-mailsteps">
              <h4>What happens next?</h4>
              {nextSteps.map((step) => (
                <div key={step.templateRef} className="rd-mailstep">
                  <i aria-hidden />
                  <div>
                    <b>{step.title}</b>
                    {step.text}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="rd-mailfoot">
            avantarte.com · Follow us
            <br />
            Avant Arte · Abcouderstraatweg 130-B, 1105 AA · Amsterdam, Netherlands
          </div>
        </div>
      </div>
    </div>
  );
}
