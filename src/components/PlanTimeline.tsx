import { BlockStack, Button, ButtonGroup, InlineStack, Text } from '@shopify/polaris';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ScheduledSend } from '../types';
import { formatDateTime, formatDayShort } from '../logic/dates';
import { TEMPLATE_LABELS, isOverdue, sendStatusBadge } from '../ui/format';
import { useApp } from '../ui/AppContext';

/**
 * A batch's comms plan as a vertical timeline: sent items greyed out with
 * sent date and approver, upcoming items with status badges and edit/cancel
 * actions. Clicking through opens the send detail screen.
 */
export function PlanTimeline({
  sends,
  onEdit,
  onCancel,
}: {
  sends: ScheduledSend[];
  onEdit: (send: ScheduledSend) => void;
  onCancel: (send: ScheduledSend) => void;
}): ReactElement {
  const navigate = useNavigate();
  const { userName } = useApp();

  const visible = sends.filter((s) => s.status !== 'cancelled');
  const cancelled = sends.filter((s) => s.status === 'cancelled');

  if (visible.length === 0 && cancelled.length === 0) {
    return (
      <Text as="p" tone="subdued">
        No sends planned yet — set a promise date to generate the milestone plan.
      </Text>
    );
  }

  return (
    <BlockStack gap="200">
      <ul className="pp-timeline">
        {visible.map((send) => {
          const sent = send.status === 'sent';
          const dotClass = sent
            ? 'pp-timeline__dot pp-timeline__dot--sent'
            : isOverdue(send)
              ? 'pp-timeline__dot pp-timeline__dot--overdue'
              : send.status === 'pending_approval' || send.status === 'held'
                ? 'pp-timeline__dot pp-timeline__dot--attention'
                : 'pp-timeline__dot';
          const failures = send.recipients?.filter((r) => r.status === 'failed').length ?? 0;
          return (
            <li
              key={send.id}
              className={`pp-timeline__item${sent ? ' pp-timeline__item--muted' : ''}`}
            >
              <span className={dotClass} />
              <BlockStack gap="100">
                <InlineStack gap="200" blockAlign="center" wrap>
                  <Button variant="plain" onClick={() => navigate(`/sends/${send.id}`)}>
                    {TEMPLATE_LABELS[send.templateRef]}
                  </Button>
                  {send.type === 'delay' ? (
                    <Text as="span" variant="bodySm" tone="subdued">
                      delay
                    </Text>
                  ) : null}
                  {sendStatusBadge(send)}
                  {failures > 0 ? (
                    <Text as="span" variant="bodySm" tone="critical">
                      {failures} delivery failure{failures === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                </InlineStack>
                <Text as="p" variant="bodySm" tone="subdued">
                  {sent
                    ? `Sent ${formatDateTime(send.sentAt!)} · approved by ${userName(send.approvedBy)} · ${send.recipients?.length ?? 0} recipients`
                    : `Scheduled ${formatDayShort(send.scheduledDate)}${send.status === 'approved' ? ` · approved by ${userName(send.approvedBy)}` : ''}`}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" truncate>
                  {send.subject}
                </Text>
                {!sent ? (
                  <InlineStack gap="200">
                    <ButtonGroup>
                      <Button size="micro" onClick={() => onEdit(send)}>
                        Edit
                      </Button>
                      <Button size="micro" tone="critical" onClick={() => onCancel(send)}>
                        Cancel send
                      </Button>
                    </ButtonGroup>
                  </InlineStack>
                ) : null}
              </BlockStack>
            </li>
          );
        })}
      </ul>
      {cancelled.length > 0 ? (
        <Text as="p" variant="bodySm" tone="subdued">
          {cancelled.length} cancelled send{cancelled.length === 1 ? '' : 's'} superseded by
          reschedules {'—'} full history below.
        </Text>
      ) : null}
    </BlockStack>
  );
}
