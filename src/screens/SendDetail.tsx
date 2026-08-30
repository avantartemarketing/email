import { useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDateTime, formatDay } from '../logic/dates';
import { NO_IMAGE_YET } from '../logic/templates';
import { TEMPLATE_LABELS, plural, sendStatusBadge } from '../ui/format';
import { useApp, useCrumb } from '../ui/AppContext';
import { useAsync } from '../ui/useAsync';
import {
  Bar,
  Btn,
  Cap,
  Card,
  CardHead,
  CellLink,
  Dialog,
  KV,
  None,
  Page,
  Pill,
  Skeleton,
  Why,
} from '../ui/rd';
import { DataTable } from '../ui/DataTable';
import type { Column } from '../ui/DataTable';
import { EmailPreview } from '../components/EmailPreview';
import { DelayReason } from '../components/DelayReason';
import { EditSendModal } from '../components/EditSendModal';

/**
 * Send detail / history: the email exactly as sent (or as it will send), every
 * recipient with their HubSpot send ID, and delivery failures surfaced rather
 * than buried. A sent send is immutable log.
 */
export function SendDetail(): ReactElement {
  const { sendId } = useParams<{ sendId: string }>();
  const { data, isAdmin, showToast, userName } = useApp();
  const navigate = useNavigate();
  const detail = useAsync(() => data.getSendDetail(sendId!), [sendId]);
  const [editing, setEditing] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  useCrumb(detail.data ? TEMPLATE_LABELS[detail.data.send.templateRef] : null);

  if (detail.error) {
    return (
      <Page title="Send not found">
        <Bar tone="fail">{detail.error.message}</Bar>
      </Page>
    );
  }
  if (detail.data === null) {
    return (
      <Page title="Send">
        <Card>
          <Skeleton rows={8} />
        </Card>
      </Page>
    );
  }

  const { send, release, batch, prospectiveRecipients, releaseBatchCount, lastSent } = detail.data;
  const sent = send.status === 'sent';
  const failures = send.recipients?.filter((r) => r.status === 'failed') ?? [];

  const act = async (action: 'approve' | 'cancel') => {
    try {
      if (action === 'approve') {
        await data.approveSend(send.id);
        showToast('Approved — queued');
      } else {
        await data.cancelSend(send.id);
        showToast('Send cancelled');
        setConfirmingCancel(false);
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

  const lastSentLabel = lastSent
    ? `${TEMPLATE_LABELS[lastSent.templateRef]}${
        lastSent.type === 'delay' ? ' (delay)' : ''
      } — ${formatDay(lastSent.sentAt.slice(0, 10))}`
    : null;

  const facts: { k: string; v: ReactElement | string }[] = [
    { k: 'Template', v: `${send.templateRef} — cloned and patched per send` },
    { k: 'Type', v: send.type === 'delay' ? 'Delay notice' : 'Milestone' },
    { k: 'Scheduled', v: formatDay(send.scheduledDate) },
  ];
  if (send.approvedBy)
    facts.push({
      k: 'Approved',
      v: `${userName(send.approvedBy)}${send.approvedAt ? ` · ${formatDateTime(send.approvedAt)}` : ''}`,
    });
  if (sent && send.sentAt) facts.push({ k: 'Sent', v: formatDateTime(send.sentAt) });
  if (send.hubspotEmailId) facts.push({ k: 'HubSpot email', v: send.hubspotEmailId });
  facts.push({ k: 'Created by', v: userName(send.createdBy) });
  if (!sent)
    facts.push({
      k: 'They last received',
      v: lastSentLabel ? (
        <CellLink onClick={() => navigate(`/sends/${lastSent!.sendId}`)}>{lastSentLabel}</CellLink>
      ) : (
        'Nothing yet — this will be their first email'
      ),
    });

  const recipientColumns: Column<(typeof recipientRows)[number]>[] = [
    {
      id: 'name',
      title: 'Collector',
      locked: true,
      kind: 'text',
      value: (r) => r.name,
      cell: (r) => <span className="rd-ink">{r.name}</span>,
    },
    { id: 'email', title: 'Email', kind: 'text', value: (r) => r.email, cell: (r) => <Cap>{r.email}</Cap> },
    {
      id: 'contact',
      title: 'HubSpot contact',
      kind: 'text',
      value: (r) => r.contact,
      cell: (r) => r.contact,
    },
    {
      id: 'sendId',
      title: 'HubSpot send ID',
      defaultHidden: true,
      kind: 'text',
      value: (r) => r.sendId,
      cell: (r) => r.sendId,
    },
    {
      id: 'status',
      title: 'Status',
      /* Locked: it is the column that says a delivery failed. */
      locked: true,
      kind: 'choice',
      caption: 'STATUS',
      value: (r) => (r.failed ? (sent ? 'Failed' : 'Flagged') : sent ? 'Delivered' : 'Ready'),
      cell: (r) =>
        r.failed ? (
          <Pill tone="red">{sent ? 'Failed' : 'Flagged'}</Pill>
        ) : sent ? (
          <Pill tone="green">Delivered</Pill>
        ) : (
          <Pill tone="blue">Ready</Pill>
        ),
    },
    {
      id: 'reason',
      title: 'Reason',
      kind: 'text',
      value: (r) => r.error ?? null,
      cell: (r) => (r.error ? <Cap>{r.error}</Cap> : <None />),
    },
  ];

  return (
    <Page
      title={TEMPLATE_LABELS[send.templateRef]}
      tag={sendStatusBadge(send)}
      facts={
        <>
          <CellLink onClick={() => navigate(`/releases/${release.id}`)}>{release.title}</CellLink>
          {releaseBatchCount > 1 ? <span>· {batch.name}</span> : null}
        </>
      }
      actions={
        <>
          {!sent && send.status !== 'cancelled' ? (
            <Btn onClick={() => setEditing(true)}>Edit</Btn>
          ) : null}
          {/* Approve, or change it. There is no third parking state: the
              owner, 28 Aug — "they can reschedule a send, or they can mark it
              as cancelled". Both of those are already on this row. */}
          {send.status === 'awaiting_copy' ? (
            /* Not Approve, and not a shut Approve either: this send is not
               waiting on this person's judgement, it is waiting on somebody's
               words. The verb here has to be the one that unblocks it. */
            <Btn kind="pri" onClick={() => navigate('/copy')}>
              Write the email
            </Btn>
          ) : null}
          {send.status === 'pending_approval' && isAdmin ? (
            !send.imageName ? (
              <Why says={NO_IMAGE_YET}>
                <Btn kind="pri" disabled>
                  Approve
                </Btn>
              </Why>
            ) : (
              <Btn kind="pri" onClick={() => void act('approve')}>
                Approve
              </Btn>
            )
          ) : null}
          {!sent && send.status !== 'cancelled' ? (
            <Btn kind="link-danger" onClick={() => setConfirmingCancel(true)}>
              Cancel send
            </Btn>
          ) : null}
        </>
      }
    >
      <div className="rd-stack">
        {/* First, above even the awaiting-copy note: on a delay send this is
            what the whole record is ABOUT, and it is the one fact here nobody
            can reconstruct from the email itself. */}
        <DelayReason brief={send.brief} />
        {send.status === 'awaiting_copy' ? (
          <Bar tone="note" title="Waiting for the CRM team to write it">
            The delivery date changed and this email is the notice to collectors. The copy below is
            the generated starting draft — it goes to an approver only once somebody has written
            it, in Emails to write.
          </Bar>
        ) : null}
        {failures.length > 0 ? (
          <Bar
            tone="fail"
            title={`${plural(failures.length, 'recipient')} could not be delivered`}
          >
            They are listed below with the reason; fix the missing email or HubSpot contact and
            retry from here once sending is live.
          </Bar>
        ) : null}

        <Card>
          <CardHead title="Details" />
          <KV rows={facts.map((f) => ({ k: f.k, v: f.v }))} />
        </Card>

        <Card>
          <CardHead title={sent ? 'Email as sent' : 'Email as it will send'} />
          <EmailPreview
            subject={send.subject}
            headline={send.headline}
            body={send.body}
            nextSteps={send.nextSteps}
            imageName={send.imageName}
            sampleRecipientName={recipientRows[0]?.name}
            sent={sent}
          />
        </Card>

        <DataTable
          table="send-recipients"
          noun="recipient"
          searchPlaceholder="Search recipients"
          title={
            sent
              ? `Recipients (${recipientRows.length})`
              : `Will send to ${plural(recipientRows.length, 'collector')} currently in ${batch.name}`
          }
          columns={recipientColumns}
          rows={recipientRows}
          rowKey={(r) => r.key}
          empty="No recipients — every order in this batch has been removed."
        />
      </div>

      <EditSendModal
        send={editing && !sent ? send : null}
        onClose={() => setEditing(false)}
        onSaved={() => detail.reload()}
      />
      <Dialog
        open={confirmingCancel}
        size="sm"
        title={`Cancel “${send.subject}”?`}
        onClose={() => setConfirmingCancel(false)}
        primary={{ label: 'Cancel send', onClick: () => void act('cancel'), destructive: true }}
        secondary={{ label: 'Keep it', onClick: () => setConfirmingCancel(false) }}
      >
        <p>
          The email will not go out and drops off the plan. This is recorded in the batch history.
          Scheduled for {formatDay(send.scheduledDate)}.
        </p>
      </Dialog>
    </Page>
  );
}
