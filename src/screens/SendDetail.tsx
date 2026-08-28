import { useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDateTime, formatDay } from '../logic/dates';
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
  Page,
  Pill,
  Skeleton,
} from '../ui/rd';
import { EmailPreview } from '../components/EmailPreview';
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
  if (send.heldBy) facts.push({ k: 'Held by', v: userName(send.heldBy) });
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
          {send.status === 'pending_approval' && isAdmin ? (
            <>
              <Btn kind="pri" onClick={() => void act('approve')}>
                Approve
              </Btn>
              <Btn onClick={() => void act('hold')}>Hold</Btn>
            </>
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
        {failures.length > 0 ? (
          <Bar tone="fail">
            <b>{plural(failures.length, 'recipient')} could not be delivered.</b> They are listed
            below with the reason; fix the missing email or HubSpot contact and retry from here
            once sending is live.
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
          />
        </Card>

        <Card>
          <CardHead
            title={
              sent
                ? `Recipients (${recipientRows.length})`
                : `Will send to ${plural(recipientRows.length, 'collector')} currently in ${batch.name}`
            }
          />
          <div className="rd-scroll">
            <table className="rd-t rd-t27 rd-fit rd-tpad">
              <thead>
                <tr>
                  <th scope="col">Collector</th>
                  <th scope="col">Email</th>
                  <th scope="col">HubSpot contact</th>
                  <th scope="col">HubSpot send ID</th>
                  <th scope="col">Status</th>
                  <th scope="col">Reason</th>
                </tr>
              </thead>
              <tbody>
                {recipientRows.map((row) => (
                  <tr key={row.key}>
                    <td className="rd-ink">{row.name}</td>
                    <td>{row.email}</td>
                    <td>{row.contact}</td>
                    <td>{row.sendId}</td>
                    <td>
                      {row.failed ? (
                        <Pill tone="red">{sent ? 'Failed' : 'Flagged'}</Pill>
                      ) : sent ? (
                        <Pill tone="green">Delivered</Pill>
                      ) : (
                        <Pill tone="blue">Ready</Pill>
                      )}
                    </td>
                    <td>
                      {row.error ? (
                        <Cap>{row.error}</Cap>
                      ) : (
                        <span className="rd-none">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
