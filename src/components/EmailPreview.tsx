import { Text } from '@shopify/polaris';
import type { ReactElement } from 'react';
import type { SendStep } from '../types';
import { renderForRecipient } from '../logic/templates';

/**
 * Renders a send the way a collector will read it, mirroring the real
 * HubSpot email format: logo, hero image slot, centered headline, body
 * paragraphs, then the "What happens next?" card. The hero image, icons and
 * footer live in the HubSpot master — the preview shows placeholders so
 * reviewers know they exist without pretending we control them here.
 *
 * `{{first_name}}` is personalised per recipient at dispatch time; the
 * preview substitutes a sample name so reviewers see real copy, not tokens.
 */
export function EmailPreview({
  subject,
  headline,
  body,
  nextSteps,
  imageName,
  sampleRecipientName,
}: {
  subject: string;
  headline?: string;
  body: string;
  nextSteps?: SendStep[];
  /** The release's picked hero image for this send's slot, if any. */
  imageName?: string;
  sampleRecipientName?: string;
}): ReactElement {
  const sample = sampleRecipientName ?? 'Jane Smith';
  return (
    <div className="pp-email-preview">
      <div className="pp-email-preview__header">
        <Text as="p" variant="bodySm" tone="subdued">
          Subject
        </Text>
        <Text as="p" variant="bodyMd" fontWeight="semibold">
          {renderForRecipient(subject, sample)}
        </Text>
      </div>
      <div className="pp-email-preview__page">
        <div className="pp-email-preview__logo">AVANT ARTE</div>
        <div className="pp-email-preview__hero">
          {imageName ? `Hero image: ${imageName}` : 'Artist hero image — from the HubSpot master'}
        </div>
        {headline ? <h1 className="pp-email-preview__headline">{headline}</h1> : null}
        <div className="pp-email-preview__body">{renderForRecipient(body, sample)}</div>
        {nextSteps && nextSteps.length > 0 ? (
          <div className="pp-email-preview__steps">
            <p className="pp-email-preview__steps-title">What happens next?</p>
            {nextSteps.map((step) => (
              <div key={step.templateRef} className="pp-email-preview__step">
                <span className="pp-email-preview__step-icon" aria-hidden="true" />
                <div>
                  <p className="pp-email-preview__step-name">{step.title}</p>
                  <p className="pp-email-preview__step-text">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="pp-email-preview__footer">
          avantarte.com · Follow us
          <br />
          Avant Arte · Abcouderstraatweg 130-B, 1105 AA · Amsterdam, Netherlands
        </div>
      </div>
    </div>
  );
}
