import { Text } from '@shopify/polaris';
import type { ReactElement } from 'react';
import { renderForRecipient } from '../logic/templates';

/**
 * Renders a send the way a collector will read it. `{{first_name}}` is
 * personalised per recipient at dispatch time; the preview substitutes a
 * sample name so reviewers see real copy, not tokens.
 */
export function EmailPreview({
  subject,
  body,
  sampleRecipientName,
}: {
  subject: string;
  body: string;
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
      <div className="pp-email-preview__body">{renderForRecipient(body, sample)}</div>
    </div>
  );
}
