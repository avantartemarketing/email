import {
  Badge,
  Banner,
  BlockStack,
  Card,
  IndexTable,
  InlineStack,
  Layout,
  Page,
  SkeletonBodyText,
  SkeletonPage,
  Text,
} from '@shopify/polaris';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDateTime, formatDay } from '../logic/dates';
import { TEMPLATE_LABELS, plural, sendStatusBadge } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { useAsync } from '../ui/useAsync';
import { EmailPreview } from '../components/EmailPreview';
import { EditSendModal } from '../components/EditSendModal';

/**
 * Send detail / history: the email exactly as sent (or as it will send),
 * every recipient with their HubSpot send ID, and delivery failures surfaced
 * rather than buried. Sent sends are immutable log.
 */
export function SendDetail(): ReactElement {
  const { sendId } = useParams<{ sendId: string }>();
  const { data, isAdmin, showToast, userName } = useApp();
  const navigate = useNavigate();
  const detail = useAsync(() => data.getSendDetail(sendId!), [sendId]);
  const [editing, setEditing] = useState(false);

  if (detail.error) {
    return (
      <Page title="Send not found" backAction={{ content: 'Releases', onAction: () => navigate('/') }}>
        <Banner tone="critical" title={detail.error.message} />
      </Page>
    );
  }
  if (detail.data === null) {
    return (
      <SkeletonPage title="Send">
        <SkeletonBodyText lines={8} />
      </SkeletonPage>
    );
  }

  const { send, release, batch, prospectiveRecipients } = detail.data;
  const sent = send.status === 'sent';
  const failures = send.recipients?.filter((r) => r.status === 'failed') ?? [];

  const act = async (action: 'approve' | 'hold' | 'cancel') => {
    try {
      if (action === 'approve') {
        await data.approveSend(send.id);
        showToast('Approved — queued');
      } else if (action === 'hold') {
        await data.holdSend(send.id);
        showToast('Held');
      } else {
        await data.cancelSend(send.id);
        showToast('Send cancelled');
      }
      detail.reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    }
  };

  const recipientRows = sent
    ? (send.recipients ?? []).map((r) => ({
        key: r.orderId,
        name: r.collectorName,
        email: r.email || '—',
        contact: r.hubspotContactId ?? '—',
        sendId: r.hubspotSendId ?? '—',
        failed: r.status === 'failed',
        error: r.error,
      }))
    : prospectiveRecipients.map((o) => ({
        key: o.id,
        name: o.collectorName,
        email: o.email ?? '—',
        contact: o.hubspotContactId ?? '—',
        sendId: '—',
        failed: !o.email || !o.hubspotContactId,
        error: !o.email
          ? 'No email address on the order'
          : !o.hubspotContactId
            ? 'No HubSpot contact — will fail unless resolved'
            : undefined,
      }));

  return (
    <Page
      title={TEMPLATE_LABELS[send.templateRef]}
      subtitle={`${release.title} · ${batch.name}`}
      titleMetadata={sendStatusBadge(send)}
      backAction={{
        content: release.title,
        onAction: () => navigate(`/releases/${release.id}`),
      }}
      secondaryActions={[
        ...(!sent && send.status !== 'cancelled'
          ? [{ content: 'Edit', onAction: () => setEditing(true) }]
          : []),
        ...(send.status === 'pending_approval' && isAdmin
          ? [
              { content: 'Approve', onAction: () => void act('approve') },
              { content: 'Hold', onAction: () => void act('hold') },
            ]
          : []),
        ...(!sent && send.status !== 'cancelled'
          ? [{ content: 'Cancel send', destructive: true, onAction: () => void act('cancel') }]
          : []),
      ]}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {failures.length > 0 ? (
              <Banner tone="critical" title={`${plural(failures.length, 'recipient')} could not be delivered`}>
                <p>
                  Failed recipients are listed below with the reason. Fix the underlying issue
                  (missing email / HubSpot contact) and retry from here once sending is live
                  (phase 3).
                </p>
              </Banner>
            ) : null}
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingSm">
                  {sent ? 'Email as sent' : 'Email as it will send'}
                </Text>
                <EmailPreview
                  subject={send.subject}
                  body={send.body}
                  sampleRecipientName={recipientRows[0]?.name}
                />
              </BlockStack>
            </Card>
            <Card padding="0">
              <div style={{ padding: 'var(--p-space-400) var(--p-space-400) 0' }}>
                <Text as="h2" variant="headingSm">
                  {sent
                    ? `Recipients (${recipientRows.length})`
                    : `Will send to ${plural(recipientRows.length, 'collector')} currently in ${batch.name}`}
                </Text>
              </div>
              <IndexTable
                resourceName={{ singular: 'recipient', plural: 'recipients' }}
                itemCount={recipientRows.length}
                selectable={false}
                headings={[
                  { title: 'Collector' },
                  { title: 'Email' },
                  { title: 'HubSpot contact' },
                  { title: 'HubSpot send ID' },
                  { title: 'Status' },
                ]}
              >
                {recipientRows.map((row, index) => (
                  <IndexTable.Row id={row.key} key={row.key} position={index}>
                    <IndexTable.Cell>{row.name}</IndexTable.Cell>
                    <IndexTable.Cell>{row.email}</IndexTable.Cell>
                    <IndexTable.Cell>{row.contact}</IndexTable.Cell>
                    <IndexTable.Cell>{row.sendId}</IndexTable.Cell>
                    <IndexTable.Cell>
                      {row.failed ? (
                        <InlineStack gap="100" blockAlign="center" wrap>
                          <Badge tone="critical">{sent ? 'Failed' : 'Flagged'}</Badge>
                          {row.error ? (
                            <Text as="span" variant="bodySm" tone="subdued">
                              {row.error}
                            </Text>
                          ) : null}
                        </InlineStack>
                      ) : sent ? (
                        <Badge tone="success">Delivered to HubSpot</Badge>
                      ) : (
                        <Badge tone="info">Ready</Badge>
                      )}
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            </Card>
          </BlockStack>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingSm">
                Details
              </Text>
              <DetailRow label="Template" value={`${send.templateRef} (cloned & patched per send)`} />
              <DetailRow label="Type" value={send.type === 'delay' ? 'Delay notice' : 'Milestone'} />
              <DetailRow label="Scheduled" value={formatDay(send.scheduledDate)} />
              {send.approvedBy ? (
                <DetailRow
                  label="Approved"
                  value={`${userName(send.approvedBy)}${send.approvedAt ? ` · ${formatDateTime(send.approvedAt)}` : ''}`}
                />
              ) : null}
              {send.heldBy ? <DetailRow label="Held by" value={userName(send.heldBy)} /> : null}
              {sent && send.sentAt ? (
                <DetailRow label="Sent" value={formatDateTime(send.sentAt)} />
              ) : null}
              {send.hubspotEmailId ? (
                <DetailRow label="HubSpot email" value={send.hubspotEmailId} />
              ) : null}
              <DetailRow label="Created by" value={userName(send.createdBy)} />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
      <EditSendModal
        send={editing && !sent ? send : null}
        onClose={() => setEditing(false)}
        onSaved={() => detail.reload()}
      />
    </Page>
  );
}

function DetailRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <BlockStack gap="050">
      <Text as="span" variant="bodySm" tone="subdued">
        {label}
      </Text>
      <Text as="span" variant="bodyMd">
        {value}
      </Text>
    </BlockStack>
  );
}
