import {
  Badge,
  BlockStack,
  Button,
  ButtonGroup,
  Card,
  EmptyState,
  IndexTable,
  InlineStack,
  Modal,
  Page,
  SkeletonBodyText,
  Tabs,
  Text,
  Tooltip,
} from '@shopify/polaris';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PendingSendItem } from '../types';
import { formatDayShort, today } from '../logic/dates';
import { TEMPLATE_LABELS, plural, sendStatusBadge } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { useAsync } from '../ui/useAsync';
import { useColumns } from '../ui/useColumns';
import { EmailPreview } from '../components/EmailPreview';

/**
 * The approval gate: every pending send across every release, soonest
 * first. Admins approve (queues it for its scheduled day) or hold. The Held
 * tab is the parking lot — released sends return to pending.
 */
export function ApprovalQueue(): ReactElement {
  const { data, isAdmin, showToast } = useApp();
  const navigate = useNavigate();
  const queue = useAsync(() => data.listApprovalQueue(), []);
  const [tab, setTab] = useState(0);
  const [preview, setPreview] = useState<PendingSendItem | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const items = queue.data ?? [];
  const pending = items.filter((i) => i.send.status === 'pending_approval');
  const held = items.filter((i) => i.send.status === 'held');
  const shown = tab === 0 ? pending : held;

  const columns = useColumns('approval-queue', [
    { id: 'scheduled', title: 'Scheduled', locked: true },
    { id: 'email', title: 'Email' },
    { id: 'subject', title: 'Subject' },
    { id: 'release', title: 'Release' },
    { id: 'batch', title: 'Batch', defaultHidden: true },
    { id: 'recipients', title: 'Recipients' },
    { id: 'lastReceived', title: 'They last received' },
    { id: 'status', title: 'Status', locked: true },
    { id: 'actions', title: 'Actions', locked: true },
  ]);

  const act = async (
    item: PendingSendItem,
    action: 'approve' | 'hold' | 'unhold',
  ): Promise<void> => {
    setActingOn(item.send.id);
    try {
      if (action === 'approve') {
        await data.approveSend(item.send.id);
        showToast(
          item.send.scheduledDate <= today()
            ? 'Approved — will go out in the next send run'
            : `Approved — queued for ${formatDayShort(item.send.scheduledDate)}`,
        );
      } else if (action === 'hold') {
        await data.holdSend(item.send.id);
        showToast('Held — it will not send until released and approved');
      } else {
        await data.unholdSend(item.send.id);
        showToast('Released — back in the pending queue');
      }
      setPreview(null);
      queue.reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setActingOn(null);
    }
  };

  const actions = (item: PendingSendItem): ReactElement => {
    const buttons =
      item.send.status === 'pending_approval' ? (
        <ButtonGroup>
          <Button
            size="slim"
            variant="primary"
            disabled={!isAdmin}
            loading={actingOn === item.send.id}
            onClick={() => void act(item, 'approve')}
          >
            Approve
          </Button>
          <Button
            size="slim"
            disabled={!isAdmin}
            onClick={() => void act(item, 'hold')}
          >
            Hold
          </Button>
        </ButtonGroup>
      ) : (
        <Button
          size="slim"
          disabled={!isAdmin}
          loading={actingOn === item.send.id}
          onClick={() => void act(item, 'unhold')}
        >
          Release hold
        </Button>
      );
    return isAdmin ? buttons : <Tooltip content="Only admins can approve or hold sends">{buttons}</Tooltip>;
  };

  return (
    <Page
      fullWidth
      title="Approval queue"
      subtitle="Nothing sends without an approval from this screen"
    >
      <BlockStack gap="400">
        <Card padding="0">
          <InlineStack align="space-between" blockAlign="center" wrap>
            <Tabs
              tabs={[
                { id: 'pending', content: queue.data ? `Pending (${pending.length})` : 'Pending' },
                { id: 'held', content: queue.data ? `Held (${held.length})` : 'Held' },
              ]}
              selected={tab}
              onSelect={setTab}
            />
            <div style={{ padding: '0 var(--p-space-400)' }}>{columns.columnsButton}</div>
          </InlineStack>
          {queue.data === null ? (
            <div style={{ padding: 'var(--p-space-400)' }}>
              <SkeletonBodyText lines={6} />
            </div>
          ) : shown.length === 0 ? (
            <EmptyState
              heading={tab === 0 ? 'Nothing waiting for approval' : 'Nothing on hold'}
              image=""
            >
              <p>
                {tab === 0
                  ? 'New and rescheduled comms plans land here before anything can send.'
                  : 'Sends an admin has parked appear here until released back to pending.'}
              </p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={{ singular: 'send', plural: 'sends' }}
              itemCount={shown.length}
              selectable={false}
              headings={columns.headings as [{ title: string }]}
            >
              {shown.map((item, index) => {
                const overdue =
                  item.send.status === 'pending_approval' && item.send.scheduledDate < today();
                return (
                  <IndexTable.Row
                    id={item.send.id}
                    key={item.send.id}
                    position={index}
                    onClick={() => setPreview(item)}
                  >
                    <IndexTable.Cell>
                      <InlineStack gap="100" blockAlign="center" wrap={false}>
                        <Text as="span" fontWeight={overdue ? 'semibold' : 'regular'}>
                          {formatDayShort(item.send.scheduledDate)}
                        </Text>
                        {overdue ? <Badge tone="critical">Overdue</Badge> : null}
                      </InlineStack>
                    </IndexTable.Cell>
                    {columns.show('email') ? (
                      <IndexTable.Cell>
                        <Text as="span" fontWeight="semibold">
                          {TEMPLATE_LABELS[item.send.templateRef]}
                          {item.send.type === 'delay' ? ' (delay)' : ''}
                        </Text>
                      </IndexTable.Cell>
                    ) : null}
                    {columns.show('subject') ? (
                      <IndexTable.Cell>
                        <Text as="span" variant="bodySm" tone="subdued" truncate>
                          {item.send.subject}
                        </Text>
                      </IndexTable.Cell>
                    ) : null}
                    {columns.show('release') ? (
                      <IndexTable.Cell>{item.release.title}</IndexTable.Cell>
                    ) : null}
                    {columns.show('batch') ? (
                      <IndexTable.Cell>
                        {item.releaseBatchCount > 1 ? (
                          item.batch.name
                        ) : (
                          <Text as="span" variant="bodySm" tone="subdued">
                            —
                          </Text>
                        )}
                      </IndexTable.Cell>
                    ) : null}
                    {columns.show('recipients') ? (
                      <IndexTable.Cell>{item.recipientCount}</IndexTable.Cell>
                    ) : null}
                    {columns.show('lastReceived') ? (
                      <IndexTable.Cell>
                        {item.lastSent ? (
                          <Text as="span" variant="bodySm">
                            {`${TEMPLATE_LABELS[item.lastSent.templateRef]}${item.lastSent.type === 'delay' ? ' (delay)' : ''} · ${formatDayShort(item.lastSent.sentAt.slice(0, 10))}`}
                          </Text>
                        ) : (
                          <Text as="span" variant="bodySm" tone="subdued">
                            Nothing yet
                          </Text>
                        )}
                      </IndexTable.Cell>
                    ) : null}
                    <IndexTable.Cell>{sendStatusBadge(item.send)}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <div onClick={(e) => e.stopPropagation()}>{actions(item)}</div>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                );
              })}
            </IndexTable>
          )}
        </Card>
        <Text as="p" variant="bodySm" tone="subdued">
          Approving a future-dated send queues it; the send worker fires it on the day (phase 3).
          Approving an overdue send releases it in the next run.
        </Text>
      </BlockStack>

      <Modal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={
          preview
            ? preview.releaseBatchCount > 1
              ? `${preview.release.title} — ${preview.batch.name}`
              : preview.release.title
            : ''
        }
        primaryAction={
          preview?.send.status === 'pending_approval'
            ? {
                content: `Approve — ${plural(preview.recipientCount, 'collector')}`,
                onAction: () => void act(preview, 'approve'),
                disabled: !isAdmin,
                loading: actingOn === preview.send.id,
              }
            : preview
              ? {
                  content: 'Release hold',
                  onAction: () => void act(preview, 'unhold'),
                  disabled: !isAdmin,
                  loading: actingOn === preview.send.id,
                }
              : undefined
        }
        secondaryActions={
          preview
            ? [
                ...(preview.send.status === 'pending_approval'
                  ? [
                      {
                        content: 'Hold',
                        onAction: () => void act(preview, 'hold'),
                        disabled: !isAdmin,
                      },
                    ]
                  : []),
                {
                  content: 'Open send detail',
                  onAction: () => {
                    navigate(`/sends/${preview.send.id}`);
                    setPreview(null);
                  },
                },
              ]
            : []
        }
      >
        {preview ? (
          <Modal.Section>
            <BlockStack gap="300">
              <InlineStack gap="200" blockAlign="center" wrap>
                {sendStatusBadge(preview.send)}
                <Text as="span" variant="bodySm" tone="subdued">
                  Scheduled {formatDayShort(preview.send.scheduledDate)} ·{' '}
                  {plural(preview.recipientCount, 'recipient')} · template{' '}
                  {preview.send.templateRef}
                </Text>
              </InlineStack>
              {preview.lastSent ? (
                <InlineStack gap="100" blockAlign="center" wrap>
                  <Text as="span" variant="bodySm" tone="subdued">
                    These collectors last received:
                  </Text>
                  <Button
                    variant="plain"
                    size="micro"
                    onClick={() => {
                      navigate(`/sends/${preview.lastSent!.sendId}`);
                      setPreview(null);
                    }}
                  >
                    {`${TEMPLATE_LABELS[preview.lastSent.templateRef]}${preview.lastSent.type === 'delay' ? ' (delay)' : ''} — ${formatDayShort(preview.lastSent.sentAt.slice(0, 10))}`}
                  </Button>
                </InlineStack>
              ) : (
                <Text as="span" variant="bodySm" tone="subdued">
                  This is the first email these collectors will receive for this release.
                </Text>
              )}
              <EmailPreview
                subject={preview.send.subject}
                headline={preview.send.headline}
                body={preview.send.body}
                nextSteps={preview.send.nextSteps}
                imageName={preview.send.imageName}
              />
            </BlockStack>
          </Modal.Section>
        ) : null}
      </Modal>
    </Page>
  );
}
