import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PendingSendItem } from '../types';
import type { SendDetailView } from '../data/DataLayer';
import { formatDayShort, today } from '../logic/dates';
import { TEMPLATE_LABELS, plural, sendStatusBadge } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { useAsync } from '../ui/useAsync';
import {
  Btn,
  Cap,
  Card,
  CellLink,
  Dialog,
  Facts,
  None,
  Page,
  Pill,
  Skeleton,
  Tag,
  Why,
} from '../ui/rd';
import { DataTable } from '../ui/DataTable';
import type { Column } from '../ui/DataTable';
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
  const { data, isAdmin, showToast, userName } = useApp();
  const navigate = useNavigate();
  const queue = useAsync(() => data.listApprovalQueue(), []);
  const [tab, setTab] = useState<'pending' | 'held'>('pending');
  const [preview, setPreview] = useState<PendingSendItem | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);
  /* The last email these collectors received, shown where it is asked for
     rather than on a screen you have to navigate to and come back from. The
     queue row carries only the DATE and the send's id, so the email itself is
     fetched when the popup opens. */
  const [lastFor, setLastFor] = useState<PendingSendItem | null>(null);
  const [lastEmail, setLastEmail] = useState<SendDetailView | null>(null);

  useEffect(() => {
    const sendId = lastFor?.lastSent?.sendId;
    if (!sendId) {
      setLastEmail(null);
      return;
    }
    let live = true;
    setLastEmail(null);
    void data
      .getSendDetail(sendId)
      .then((detail) => {
        if (live) setLastEmail(detail);
      })
      .catch((err: unknown) => {
        if (!live) return;
        showToast(err instanceof Error ? err.message : String(err), true);
        setLastFor(null);
      });
    return () => {
      live = false;
    };
  }, [lastFor, data, showToast]);

  const items = queue.data ?? [];
  const pending = items.filter((i) => i.send.status === 'pending_approval');
  const held = items.filter((i) => i.send.status === 'held');
  const shown = tab === 'pending' ? pending : held;

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

  const overdue = (item: PendingSendItem): boolean =>
    item.send.status === 'pending_approval' && item.send.scheduledDate < today();

  const lastReceivedLabel = (item: PendingSendItem): string =>
    `${TEMPLATE_LABELS[item.lastSent!.templateRef]}${
      item.lastSent!.type === 'delay' ? ' (delay)' : ''
    } · ${formatDayShort(item.lastSent!.sentAt.slice(0, 10))}`;

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

  const columns: Column<PendingSendItem>[] = [
    {
      id: 'scheduled',
      title: 'Scheduled',
      locked: true,
      kind: 'date',
      value: (i) => i.send.scheduledDate,
      cell: (i) => (
        <span className={overdue(i) ? 'rd-ink' : undefined}>
          {formatDayShort(i.send.scheduledDate)}
        </span>
      ),
    },
    {
      id: 'email',
      title: 'Email',
      kind: 'choice',
      caption: 'EMAIL',
      value: (i) => TEMPLATE_LABELS[i.send.templateRef],
      cell: (i) => (
        <span className="rd-ink">
          {TEMPLATE_LABELS[i.send.templateRef]}
          {i.send.type === 'delay' ? ' (delay)' : ''}
        </span>
      ),
    },
    {
      id: 'subject',
      title: 'Subject',
      kind: 'text',
      value: (i) => i.send.subject,
      cell: (i) => <Cap>{i.send.subject}</Cap>,
    },
    {
      id: 'release',
      title: 'Release',
      kind: 'choice',
      caption: 'RELEASE',
      value: (i) => i.release.title,
      cell: (i) => i.release.title,
    },
    {
      id: 'batch',
      title: 'Batch',
      kind: 'choice',
      caption: 'BATCH',
      value: (i) => (i.releaseBatchCount > 1 ? i.batch.name : null),
      cell: (i) =>
        i.releaseBatchCount > 1 ? <Tag tone="teal">{i.batch.name}</Tag> : <None />,
    },
    {
      id: 'recipients',
      title: 'Recipients',
      n: true,
      kind: 'number',
      value: (i) => i.recipientCount,
      cell: (i) => i.recipientCount,
    },
    {
      id: 'lastReceived',
      /* Just the date. The owner, 28 Aug: "change column to just 'Last
         received' and just put date. When you click date, it shows the last
         email they received in a popup." Which email it was is one fact too
         many for a column being scanned for recency — and it is a question
         with a better answer than a truncated label, since the email itself
         is one click away. */
      title: 'Last received',
      kind: 'date',
      value: (i) => i.lastSent?.sentAt.slice(0, 10),
      cell: (i) =>
        i.lastSent ? (
          <CellLink onClick={() => setLastFor(i)}>
            {formatDayShort(i.lastSent.sentAt.slice(0, 10))}
          </CellLink>
        ) : (
          <span className="rd-none">Nothing yet</span>
        ),
    },
    {
      id: 'who',
      /*
       * Who is on the hook for the row.
       *
       * The owner asked the queue to "show the approver", and the honest
       * version of that differs by tab: a send in the PENDING tab has not
       * been approved by anyone — that is what makes it pending — so a column
       * headed "Approved by" would be a dash on every row, which is a column
       * that costs width and answers nothing. What a reviewer actually wants
       * before approving is who put it in front of them, and after a hold,
       * who parked it. So the column is one column with the name the tab
       * makes true.
       */
      title: tab === 'held' ? 'Held by' : 'Submitted by',
      kind: 'choice',
      caption: tab === 'held' ? 'HELD BY' : 'SUBMITTED BY',
      value: (i) => {
        const who = tab === 'held' ? i.send.heldBy : i.send.createdBy;
        return who ? userName(who) : null;
      },
      cell: (i) => {
        const who = tab === 'held' ? i.send.heldBy : i.send.createdBy;
        return who ? userName(who) : <None />;
      },
    },
    {
      id: 'status',
      /* Only the exception is drawn. Every row in the Pending tab is pending,
         so a "Pending approval" pill on all ten of them is a column that says
         the same thing ten times and hides the one row that is late. The
         owner: "change Status to just Overdue". Locked, because it is the
         column that carries the warning. */
      title: 'Overdue',
      locked: true,
      kind: 'choice',
      caption: 'OVERDUE',
      value: (i) => (overdue(i) ? 'Overdue' : null),
      cell: (i) =>
        overdue(i) ? <Pill tone="red">Overdue</Pill> : <None />,
    },
    {
      id: 'actions',
      title: '',
      locked: true,
      cell: (i) => rowActions(i),
    },
  ];

  return (
    <Page title="Approval queue">
      <Tabs
        tabs={[
          { key: 'pending', label: queue.data ? `Pending (${pending.length})` : 'Pending' },
          { key: 'held', label: queue.data ? `Held (${held.length})` : 'Held' },
        ]}
        value={tab}
        onPick={setTab}
        label="Queue"
      />
      {queue.data === null ? (
        <Card>
          <Skeleton rows={6} />
        </Card>
      ) : (
        <DataTable
          key={tab}
          table={`approval-${tab}`}
          noun="send"
          searchPlaceholder="Search subjects, releases, collectors"
          columns={columns}
          rows={shown}
          rowKey={(i) => i.send.id}
          onRowClick={(i) => setPreview(i)}
          empty={
            tab === 'pending'
              ? 'Nothing waiting for approval. New and rescheduled comms plans land here before anything can send.'
              : 'Nothing on hold. Sends an admin has parked appear here until released back to pending.'
          }
          foot="approving a future-dated send queues it for the day; approving an overdue one releases it in the next run"
        />
      )}

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

      <Dialog
        open={lastFor !== null}
        size="lg"
        onClose={() => setLastFor(null)}
        title={
          lastFor?.lastSent
            ? `Last received — ${formatDayShort(lastFor.lastSent.sentAt.slice(0, 10))}`
            : 'Last received'
        }
        secondary={
          lastFor?.lastSent
            ? {
                label: 'Open send detail',
                onClick: () => {
                  navigate(`/sends/${lastFor.lastSent!.sendId}`);
                  setLastFor(null);
                },
              }
            : undefined
        }
      >
        {lastFor?.lastSent ? (
          <>
            <Facts
              items={[
                {
                  label: 'Email',
                  value: `${TEMPLATE_LABELS[lastFor.lastSent.templateRef]}${
                    lastFor.lastSent.type === 'delay' ? ' (delay)' : ''
                  }`,
                },
                { label: 'Went out on', value: lastFor.lastSent.batchName },
                { label: 'Release', value: lastFor.release.title },
              ]}
            />
            {lastEmail ? (
              <EmailPreview
                subject={lastEmail.send.subject}
                headline={lastEmail.send.headline}
                body={lastEmail.send.body}
                nextSteps={lastEmail.send.nextSteps}
                imageName={lastEmail.send.imageName}
              />
            ) : (
              <Skeleton rows={6} />
            )}
          </>
        ) : null}
      </Dialog>
    </Page>
  );
}
