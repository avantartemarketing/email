import { useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PendingSendItem } from '../types';
import { formatDayShort, today } from '../logic/dates';
import { TEMPLATE_LABELS, plural, sendStatusBadge } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { useAsync } from '../ui/useAsync';
import { useColumns } from '../ui/useColumns';
import {
  Btn,
  Cap,
  Card,
  CellLink,
  Dialog,
  Empty,
  Foot,
  None,
  Page,
  Skeleton,
  Why,
} from '../ui/rd';
import Tabs from '../rd/components/Tabs';
import { EmailPreview } from '../components/EmailPreview';

/**
 * The approval gate: every pending send across every release, soonest first.
 * Admins approve (which queues it for its scheduled day) or hold. The Held tab
 * is the parking lot — released sends return to pending.
 *
 * Nine columns of single-line facts, which is what the columns control is for:
 * the reviewer's question is "what is this, who gets it, and what did they get
 * last time", and everything else can be put away.
 */
export function ApprovalQueue(): ReactElement {
  const { data, isAdmin, showToast } = useApp();
  const navigate = useNavigate();
  const queue = useAsync(() => data.listApprovalQueue(), []);
  const [tab, setTab] = useState<'pending' | 'held'>('pending');
  const [preview, setPreview] = useState<PendingSendItem | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const items = queue.data ?? [];
  const pending = items.filter((i) => i.send.status === 'pending_approval');
  const held = items.filter((i) => i.send.status === 'held');
  const shown = tab === 'pending' ? pending : held;

  const columns = useColumns('approval-queue', [
    { id: 'scheduled', title: 'Scheduled', locked: true },
    { id: 'email', title: 'Email' },
    { id: 'subject', title: 'Subject' },
    { id: 'release', title: 'Release' },
    { id: 'batch', title: 'Batch', defaultHidden: true },
    { id: 'recipients', title: 'Recipients', n: true },
    { id: 'lastReceived', title: 'They last received' },
    { id: 'status', title: 'Status', locked: true },
    { id: 'actions', title: '', locked: true },
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

  /** What a row offers. Non-admins see the controls and why they are shut. */
  const rowActions = (item: PendingSendItem): ReactElement => {
    const busy = actingOn === item.send.id;
    const buttons =
      item.send.status === 'pending_approval' ? (
        <>
          <Btn kind="pri" disabled={!isAdmin || busy} onClick={() => void act(item, 'approve')}>
            Approve
          </Btn>
          <Btn small disabled={!isAdmin || busy} onClick={() => void act(item, 'hold')}>
            Hold
          </Btn>
        </>
      ) : (
        <Btn small disabled={!isAdmin || busy} onClick={() => void act(item, 'unhold')}>
          Release hold
        </Btn>
      );
    return (
      <div className="rd-rowacts" onClick={(e) => e.stopPropagation()}>
        {isAdmin ? buttons : <Why says="Only admins can approve or hold sends">{buttons}</Why>}
      </div>
    );
  };

  const lastReceivedLabel = (item: PendingSendItem): string =>
    `${TEMPLATE_LABELS[item.lastSent!.templateRef]}${
      item.lastSent!.type === 'delay' ? ' (delay)' : ''
    } · ${formatDayShort(item.lastSent!.sentAt.slice(0, 10))}`;

  return (
    /* The columns control sits in the PAGE head, not the card's: the kit's own
       note is that a picker governs a screen rather than a table, and where a
       screen has one table the two placements are the same place. */
    <Page title="Approval queue" actions={columns.menu}>
      <Tabs
        tabs={[
          { key: 'pending', label: queue.data ? `Pending (${pending.length})` : 'Pending' },
          { key: 'held', label: queue.data ? `Held (${held.length})` : 'Held' },
        ]}
        value={tab}
        onPick={setTab}
        label="Queue"
      />
      <Card>
        {queue.data === null ? (
          <Skeleton rows={6} />
        ) : shown.length === 0 ? (
          <Empty>
            {tab === 'pending'
              ? 'Nothing waiting for approval. New and rescheduled comms plans land here before anything can send.'
              : 'Nothing on hold. Sends an admin has parked appear here until released back to pending.'}
          </Empty>
        ) : (
          <>
            <div className="rd-scroll">
              <table className="rd-t rd-t27 rd-fit rd-tpad">
                <thead>
                  <tr>{columns.head}</tr>
                </thead>
                <tbody>
                  {shown.map((item) => {
                    const overdue =
                      item.send.status === 'pending_approval' && item.send.scheduledDate < today();
                    return (
                      <tr
                        key={item.send.id}
                        className="rd-rowlink"
                        onClick={() => setPreview(item)}
                      >
                        <td className={overdue ? 'rd-ink' : undefined}>
                          {formatDayShort(item.send.scheduledDate)}
                        </td>
                        {columns.show('email') ? (
                          <td className="rd-ink">
                            {TEMPLATE_LABELS[item.send.templateRef]}
                            {item.send.type === 'delay' ? ' (delay)' : ''}
                          </td>
                        ) : null}
                        {columns.show('subject') ? (
                          <td>
                            <Cap>{item.send.subject}</Cap>
                          </td>
                        ) : null}
                        {columns.show('release') ? <td>{item.release.title}</td> : null}
                        {columns.show('batch') ? (
                          <td>{item.releaseBatchCount > 1 ? item.batch.name : <None />}</td>
                        ) : null}
                        {columns.show('recipients') ? (
                          <td className="n">{item.recipientCount}</td>
                        ) : null}
                        {columns.show('lastReceived') ? (
                          <td>
                            {item.lastSent ? (
                              lastReceivedLabel(item)
                            ) : (
                              <span className="rd-none">Nothing yet</span>
                            )}
                          </td>
                        ) : null}
                        <td>{sendStatusBadge(item.send)}</td>
                        <td>{rowActions(item)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Foot>
              {plural(shown.length, 'send')} · approving a future-dated send queues it for the day;
              approving an overdue one releases it in the next run
            </Foot>
          </>
        )}
      </Card>

      <Dialog
        open={preview !== null}
        size="lg"
        onClose={() => setPreview(null)}
        title={
          preview
            ? preview.releaseBatchCount > 1
              ? `${preview.release.title} — ${preview.batch.name}`
              : preview.release.title
            : ''
        }
        primary={
          preview
            ? preview.send.status === 'pending_approval'
              ? {
                  label: `Approve — ${plural(preview.recipientCount, 'collector')}`,
                  onClick: () => void act(preview, 'approve'),
                  disabled: !isAdmin || actingOn === preview.send.id,
                }
              : {
                  label: 'Release hold',
                  onClick: () => void act(preview, 'unhold'),
                  disabled: !isAdmin || actingOn === preview.send.id,
                }
            : undefined
        }
        secondary={
          preview
            ? [
                ...(preview.send.status === 'pending_approval'
                  ? [{ label: 'Hold', onClick: () => void act(preview, 'hold') }]
                  : []),
                {
                  label: 'Open send detail',
                  onClick: () => {
                    navigate(`/sends/${preview.send.id}`);
                    setPreview(null);
                  },
                },
              ]
            : undefined
        }
      >
        {preview ? (
          <>
            <div className="rd-facts">
              <div className="rd-fact">
                <span>Status</span>
                <b>{sendStatusBadge(preview.send)}</b>
              </div>
              <div className="rd-fact">
                <span>Scheduled</span>
                <b>{formatDayShort(preview.send.scheduledDate)}</b>
              </div>
              <div className="rd-fact">
                <span>Recipients</span>
                <b>{preview.recipientCount}</b>
              </div>
              <div className="rd-fact">
                <span>They last received</span>
                <b>
                  {preview.lastSent ? (
                    <CellLink
                      onClick={() => {
                        navigate(`/sends/${preview.lastSent!.sendId}`);
                        setPreview(null);
                      }}
                    >
                      {lastReceivedLabel(preview)}
                    </CellLink>
                  ) : (
                    'Nothing yet'
                  )}
                </b>
              </div>
            </div>
            <EmailPreview
              subject={preview.send.subject}
              headline={preview.send.headline}
              body={preview.send.body}
              nextSteps={preview.send.nextSteps}
              imageName={preview.send.imageName}
            />
          </>
        ) : null}
      </Dialog>
    </Page>
  );
}
