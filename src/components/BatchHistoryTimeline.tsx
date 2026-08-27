import { BlockStack, InlineStack, Text } from '@shopify/polaris';
import type { ReactElement } from 'react';
import type { BatchEvent } from '../types';
import { formatDateTime, formatDay } from '../logic/dates';

/**
 * Immutable batch history, newest first. Reschedule entries spell out the
 * who / when / old date / new date / reason so anyone can open a batch and
 * read the story it has been told.
 */
export function BatchHistoryTimeline({ events }: { events: BatchEvent[] }): ReactElement {
  if (events.length === 0) {
    return (
      <Text as="p" tone="subdued">
        Nothing has happened to this batch yet.
      </Text>
    );
  }
  return (
    <ul className="pp-timeline">
      {events.map((event) => (
        <li key={event.id} className="pp-timeline__item">
          <span
            className={`pp-timeline__dot${event.type === 'reschedule' ? ' pp-timeline__dot--attention' : ''}`}
          />
          <BlockStack gap="050">
            <InlineStack gap="200" blockAlign="center" wrap>
              <Text as="span" variant="bodyMd" fontWeight={event.type === 'reschedule' ? 'semibold' : 'regular'}>
                {event.description}
              </Text>
            </InlineStack>
            {event.type === 'reschedule' ? (
              <Text as="p" variant="bodySm" tone="subdued">
                {formatDay(event.data.oldDate ?? null)} → {formatDay(event.data.newDate)}
              </Text>
            ) : null}
            <Text as="p" variant="bodySm" tone="subdued">
              {formatDateTime(event.at)} · {event.byName}
            </Text>
          </BlockStack>
        </li>
      ))}
    </ul>
  );
}
