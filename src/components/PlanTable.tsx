import { Badge, Button, ButtonGroup, Card, IndexTable, InlineStack, Text } from '@shopify/polaris';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ScheduledSend } from '../types';
import { formatDateTime, formatDayShort } from '../logic/dates';
import { TEMPLATE_LABELS, sendStatusBadge } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { useColumns } from '../ui/useColumns';

/**
 * A batch's comms plan as a plain table: one row per email, one line per
 * row, chronological. Sent rows read muted; upcoming rows carry their
 * actions. For split batches, the emails collectors received before the
 * split open the story as muted rows. Columns follow the same show/hide
 * control as every other table.
 */
export function PlanTable({
  sends,
  inheritedSends = [],
  batchActiveOrderCount,
  onEdit,
  onCancel,
}: {
  sends: ScheduledSend[];
  inheritedSends?: ScheduledSend[];
  batchActiveOrderCount: number;
  onEdit: (send: ScheduledSend) => void;
  onCancel: (send: ScheduledSend) => void;
}): ReactElement {
  const navigate = useNavigate();
  const { userName } = useApp();

  const columns = useColumns('comms-plan', [
    { id: 'email', title: 'Email', locked: true },
    { id: 'status', title: 'Status', locked: true },
    { id: 'scheduled', title: 'Scheduled' },
    { id: 'sent', title: 'Sent' },
    { id: 'approvedBy', title: 'Approved by' },
    { id: 'recipients', title: 'Recipients' },
    { id: 'issues', title: 'Issues' },
    { id: 'actions', title: '', locked: true },
  ]);

  const visible = sends.filter((s) => s.status !== 'cancelled');
  const cancelled = sends.filter((s) => s.status === 'cancelled');
  const rows = [
    ...inheritedSends.map((send) => ({ send, inherited: true })),
    ...visible.map((send) => ({ send, inherited: false })),
  ].sort((a, b) => a.send.scheduledDate.localeCompare(b.send.scheduledDate));

  const header = (
    <div style={{ padding: 'var(--p-space-400) var(--p-space-400) var(--p-space-200)' }}>
      <InlineStack align="space-between" blockAlign="center" wrap>
        <Text as="h2" variant="headingSm">
          Comms plan
        </Text>
        {rows.length > 0 ? columns.columnsButton : null}
      </InlineStack>
    </div>
  );

  if (rows.length === 0 && cancelled.length === 0) {
    return (
      <Card padding="0">
        {header}
        <div style={{ padding: '0 var(--p-space-400) var(--p-space-400)' }}>
          <Text as="p" tone="subdued">
            No sends planned yet — set a promise date to generate the milestone plan.
          </Text>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="0">
      {header}
      <IndexTable
        resourceName={{ singular: 'send', plural: 'sends' }}
        itemCount={rows.length}
        selectable={false}
        headings={columns.headings as [{ title: string }]}
      >
        {rows.map(({ send, inherited }, index) => {
          const isSent = send.status === 'sent';
          const muted = isSent || inherited;
          const failures = send.recipients?.filter((r) => r.status === 'failed').length ?? 0;
          return (
            <IndexTable.Row id={send.id} key={send.id} position={index}>
              <IndexTable.Cell>
                <Button variant="plain" onClick={() => navigate(`/sends/${send.id}`)}>
                  {`${TEMPLATE_LABELS[send.templateRef]}${inherited ? ' · before the split' : ''}`}
                </Button>
              </IndexTable.Cell>
              <IndexTable.Cell>
                {inherited ? <Badge tone="success">Sent</Badge> : sendStatusBadge(send)}
              </IndexTable.Cell>
              {columns.show('scheduled') ? (
                <IndexTable.Cell>
                  <Text as="span" tone={muted ? 'subdued' : undefined}>
                    {formatDayShort(send.scheduledDate)}
                  </Text>
                </IndexTable.Cell>
              ) : null}
              {columns.show('sent') ? (
                <IndexTable.Cell>
                  <Text as="span" tone="subdued">
                    {send.sentAt ? formatDateTime(send.sentAt) : '—'}
                  </Text>
                </IndexTable.Cell>
              ) : null}
              {columns.show('approvedBy') ? (
                <IndexTable.Cell>
                  <Text as="span" tone={muted ? 'subdued' : undefined}>
                    {send.approvedBy ? userName(send.approvedBy) : '—'}
                  </Text>
                </IndexTable.Cell>
              ) : null}
              {columns.show('recipients') ? (
                <IndexTable.Cell>
                  <Text as="span" tone={muted ? 'subdued' : undefined}>
                    {isSent || inherited
                      ? (send.recipients?.length ?? '—')
                      : batchActiveOrderCount}
                  </Text>
                </IndexTable.Cell>
              ) : null}
              {columns.show('issues') ? (
                <IndexTable.Cell>
                  {failures > 0 ? (
                    <Text as="span" tone="critical">
                      {failures} failed
                    </Text>
                  ) : (
                    <Text as="span" tone="subdued">
                      —
                    </Text>
                  )}
                </IndexTable.Cell>
              ) : null}
              <IndexTable.Cell>
                {!isSent && !inherited ? (
                  <div onClick={(e) => e.stopPropagation()}>
                    <ButtonGroup>
                      <Button size="micro" onClick={() => onEdit(send)}>
                        Edit
                      </Button>
                      <Button size="micro" tone="critical" variant="plain" onClick={() => onCancel(send)}>
                        Cancel
                      </Button>
                    </ButtonGroup>
                  </div>
                ) : null}
              </IndexTable.Cell>
            </IndexTable.Row>
          );
        })}
      </IndexTable>
      {cancelled.length > 0 ? (
        <div style={{ padding: 'var(--p-space-200) var(--p-space-400) var(--p-space-300)' }}>
          <Text as="p" variant="bodySm" tone="subdued">
            {cancelled.length} cancelled send{cancelled.length === 1 ? '' : 's'} superseded by
            reschedules — full history on the right.
          </Text>
        </div>
      ) : null}
    </Card>
  );
}
