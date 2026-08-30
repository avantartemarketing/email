import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PendingSendItem, ReleaseDetail } from '../types';
import type { SendDetailView } from '../data/DataLayer';
import { daysBetween, formatDayShort, today } from '../logic/dates';
import { inheritedSentStory } from '../logic/reschedule';
import { NO_IMAGE_YET, shipWindowShort } from '../logic/templates';
import { isOverdueApproval, needsApprovingNow } from '../logic/approvals';
import { TEMPLATE_LABELS, plural } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { useAsync } from '../ui/useAsync';
import {
  Bar,
  Btn,
  Cap,
  Card,
  CellLink,
  Dialog,
  Facts,
  None,
  Page,
  Pill,
  RowAct,
  Skeleton,
  Stack,
  Tag,
  Why,
} from '../ui/rd';
import { DataTable } from '../ui/DataTable';
import type { Column } from '../ui/DataTable';
import usePicked from '../rd/components/usePicked';
import { EmailPreview } from '../components/EmailPreview';
import { ChangeSendDateModal } from '../components/ChangeSendDateModal';
import { DelayReason } from '../components/DelayReason';
import { RescheduleModal } from '../components/RescheduleModal';

/**
 * The approver's own worklist.
 *
 * The owner, 28 Aug 2026: "We should have a my approvals page, which shows
 * both live approvals that need making now, and all future approvals that are
 * coming up that you will have to approve."
 *
 * ## What "my" means
 *
 * Not "assigned to me" — nothing in this app assigns a send to a person, and
 * inventing an owner field to justify a page title would be the wrong way
 * round. It means **standing**: the approvals it is on you to make. There are
 * two roles and one gate (`approveSend` requires an admin), so for an admin
 * that is every pending send in the app.
 *
 * The possessive still earns its place, because it changes what the page IS.
 * The old screen was an inventory — "here are eleven pending sends", sorted by
 * date, every row looking like every other. This one is a worklist: the two
 * you owe this week, and the nine heading your way. If a real assignment model
 * ever lands, the predicate to change is one function in `logic/approvals.ts`
 * and nothing on this screen moves.
 *
 * ## Why two tables and not one grouped one
 *
 * Grouping is user state — it lives in the view controls and persists — so the
 * split the owner asked for would be a preference somebody could switch off.
 * More decisively, the two halves want different SHAPES, not just different
 * rows: the urgent one carries a tick gutter, a bulk bar and three verbs per
 * row; the calm one must not, or every future send becomes something to act on
 * today. One table cannot vary its columns or its selection per band.
 *
 * ## There is no Hold
 *
 * The owner, same day: "I don't think someone should be able to click hold.
 * They can reschedule a send, or they can mark it as cancelled." Hold was one
 * verb doing two jobs — "not yet" and "not this" — and it parked sends in a
 * tab nobody visited. Both honest verbs are on the row now.
 */
export function MyApprovals(): ReactElement {
  const { data, isAdmin, showToast, userName, refreshApprovals } = useApp();
  const navigate = useNavigate();
  const queue = useAsync(() => data.listApprovalQueue(), []);
  const picked = usePicked();

  const [preview, setPreview] = useState<PendingSendItem | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [movingDate, setMovingDate] = useState<PendingSendItem | null>(null);
  const [cancelling, setCancelling] = useState<PendingSendItem | null>(null);
  /* Situation 2: the promise itself has slipped. The reschedule flow needs
     the batch's orders and sends, which the queue row does not carry, so the
     door fetches the release before the dialogue can open. */
  const [rescheduling, setRescheduling] = useState<{
    item: PendingSendItem;
    detail: ReleaseDetail;
  } | null>(null);
  /** Bumped per request, so only the newest reschedule fetch may open. */
  const rescheduleReq = useRef(0);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  /* The last email these collectors received, shown where it is asked for
     rather than on a screen you navigate to and come back from. */
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
  const now = items.filter((i) => needsApprovingNow(i.send));
  const coming = items.filter((i) => !needsApprovingNow(i.send));
  const overdue = now.filter((i) => isOverdueApproval(i.send));
  const pickedItems = now.filter((i) => picked.has(i.send.id));
  const blocked = pickedItems.filter((i) => !i.send.imageName);
  const approvable = pickedItems.filter((i) => i.send.imageName);

  const reload = () => {
    queue.reload();
    refreshApprovals();
  };

  /**
   * The door from the queue into Change delivery date.
   *
   * The moment an approver realizes "17 – 24 Sept isn't true any more"
   * happens HERE, reading the email — but the remedy used to live three
   * screens away on the batch tab. Same flow, same modal, opened where the
   * realization happens. It only ever produces PENDING sends, so it is not
   * admin-gated: an operator can pull the cord and approval still guards
   * everything that reaches a collector.
   */
  const openReschedule = async (item: PendingSendItem): Promise<void> => {
    /* The dialogue the approver is looking at stays up until its replacement
       is ready: tearing it down first left the screen bare for the fetch, and
       on a failure dropped them somewhere they never asked to be. The token
       makes the last click win, so a double-click or a slow release cannot
       open a modal for a send nobody is looking at any more. */
    const req = (rescheduleReq.current += 1);
    try {
      const detail = await data.getRelease(item.release.id);
      if (req !== rescheduleReq.current) return;
      setPreview(null);
      setMovingDate(null);
      setRescheduling({ item, detail });
    } catch (err) {
      if (req !== rescheduleReq.current) return;
      showToast(err instanceof Error ? err.message : String(err), true);
    }
  };

  const approve = async (item: PendingSendItem): Promise<void> => {
    setActingOn(item.send.id);
    try {
      await data.approveSend(item.send.id);
      showToast(
        item.send.scheduledDate <= today()
          ? 'Approved — will go out in the next send run'
          : `Approved — queued for ${formatDayShort(item.send.scheduledDate)}`,
      );
      setPreview(null);
      reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setActingOn(null);
    }
  };

  const approveMany = async (): Promise<void> => {
    setBusy(true);
    let done = 0;
    try {
      for (const item of approvable) {
        await data.approveSend(item.send.id);
        done += 1;
      }
      /* Exactly the blocked rows stay ticked, under their own Missing pill,
         so what is left is visible rather than merely counted at you. */
      picked.replace(new Set(blocked.map((i) => i.send.id)));
      setBulkOpen(false);
      showToast(
        blocked.length > 0
          ? `Approved ${done} of ${pickedItems.length} — ${plural(blocked.length, 'send')} still ${
              blocked.length === 1 ? 'needs' : 'need'
            } an image`
          : `Approved ${plural(done, 'send')}`,
        blocked.length > 0,
      );
      reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (): Promise<void> => {
    if (!cancelling) return;
    setBusy(true);
    try {
      await data.cancelSend(cancelling.send.id);
      showToast('Send cancelled');
      setCancelling(null);
      setPreview(null);
      reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setBusy(false);
    }
  };

  /**
   * What a row offers: approve it, move it, or stop it.
   *
   * Only Approve is shut for a non-admin, because `approveSend` is the only
   * call the data layer gates — shutting the other two would claim a
   * restriction that does not exist.
   */
  const rowActions = (item: PendingSendItem): ReactElement => {
    const noImage = !item.send.imageName;
    const approveBtn = (
      <Btn
        kind="pri"
        disabled={!isAdmin || actingOn === item.send.id || noImage}
        onClick={() => void approve(item)}
      >
        Approve
      </Btn>
    );
    return (
      <div className="rd-rowacts" onClick={(e) => e.stopPropagation()}>
        {!isAdmin ? (
          <Why says="Only admins can approve sends">{approveBtn}</Why>
        ) : noImage ? (
          <Why says={NO_IMAGE_YET}>{approveBtn}</Why>
        ) : (
          approveBtn
        )}
        {/* The object is in the name, because two date verbs now live one
            click apart: this one moves ONE EMAIL silently; "Change delivery
            date" changes the batch's promise and tells collectors. A bare
            "Change date" next to that pair is a coin toss. */}
        <RowAct onClick={() => setMovingDate(item)}>Change email date</RowAct>
        {/* "Cancel send", not "Cancel": on a screen with a dialogue on every
            verb, a bare "Cancel" is the word that dismisses one. The noun is
            what makes it an act. Same word the send's own page uses. */}
        <RowAct danger onClick={() => setCancelling(item)}>
          Cancel send
        </RowAct>
      </div>
    );
  };

  /**
   * One column list, both tables, so the two halves cannot drift into two
   * different readings of the same row. The three that differ are the three
   * the split itself creates.
   */
  const columnsFor = (which: 'now' | 'coming'): Column<PendingSendItem>[] => [
    {
      id: 'scheduled',
      title: 'Scheduled',
      locked: true,
      kind: 'date',
      value: (i) => i.send.scheduledDate,
      /* The pill rides beside the date rather than in a column of its own.
         "Overdue" is not a second fact — it is a property OF this date, which
         is what `.rd-cellflex` exists for. As a column it spent 102px drawing
         one mark on one row, and those 102px were the difference between the
         urgent table fitting inside its card and scrolling across it. */
      cell: (i) => (
        <span className="rd-cellflex">
          <span className={isOverdueApproval(i.send) ? 'rd-ink' : undefined}>
            {formatDayShort(i.send.scheduledDate)}
          </span>
          {isOverdueApproval(i.send) ? (
            <Pill tone="red" small>
              Overdue
            </Pill>
          ) : null}
        </span>
      ),
    },
    ...(which === 'coming'
      ? ([
          {
            id: 'daysAway',
            /* The figure the calm table is actually read for: not "when", but
               "how long have I got". A date column answers the first. */
            title: 'Days away',
            n: true,
            kind: 'number',
            value: (i) => daysBetween(today(), i.send.scheduledDate),
            cell: (i) => daysBetween(today(), i.send.scheduledDate),
          },
        ] as Column<PendingSendItem>[])
      : []),
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
      cell: (i) => (i.releaseBatchCount > 1 ? <Tag tone="teal">{i.batch.name}</Tag> : <None />),
    },
    {
      id: 'recipients',
      title: 'Recipients',
      /* Hidden in the urgent table only. The band above totals the collectors
         this week reaches and the preview names them per send, so here it was
         survey data on a table nobody surveys — and its width was part of what
         pushed Approve off a laptop screen. */
      defaultHidden: which === 'now',
      n: true,
      kind: 'number',
      value: (i) => i.recipientCount,
      cell: (i) => i.recipientCount,
    },
    {
      id: 'lastReceived',
      title: 'Last received',
      /* A scanning aid, so it earns its width in the long calm table and not
         in the short urgent one — where there are two rows, you open each of
         them, and the preview says it anyway. Measured at 1520px: with it
         visible the urgent table ran 121px past its card and put Approve half
         off-screen, which is the one control that must never need scrolling
         to. One click in Columns brings it back. */
      defaultHidden: which === 'now',
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
      id: 'image',
      /* Only the exception is drawn — a "Picked" pill on every row would say
         the same thing nine times and hide the one that is blocked. Locked,
         because it is the column carrying the reason a row cannot be
         approved, and in BOTH tables: the blocked send is usually a long way
         out, so a warning only in the urgent table would miss it. */
      title: 'Image',
      locked: true,
      kind: 'choice',
      caption: 'IMAGE',
      order: ['Missing', 'Picked'],
      value: (i) => (i.send.imageName ? 'Picked' : 'Missing'),
      cell: (i) => (i.send.imageName ? <None /> : <Pill tone="amber">Missing</Pill>),
    },
    {
      id: 'who',
      /* Who put it in front of you. Not "Approved by": a send in this queue
         has by definition not been approved by anybody, so that column would
         be a dash on every row — width spent answering nothing. */
      title: 'Submitted by',
      /* Hidden by default and still filterable: the view's fields come off the
         column list rather than off what is on screen, so "sends I submitted"
         stays two clicks away while the width goes to the verbs. Rendered at
         1520px with it visible, the Approve button fell off the card. */
      defaultHidden: true,
      kind: 'choice',
      caption: 'SUBMITTED BY',
      value: (i) => (i.send.createdBy ? userName(i.send.createdBy) : null),
      cell: (i) => (i.send.createdBy ? userName(i.send.createdBy) : <None />),
    },
    ...(which === 'coming'
      ? ([
          {
            id: 'month',
            title: 'Month',
            defaultHidden: true,
            kind: 'choice',
            caption: 'MONTH',
            value: (i) => i.send.scheduledDate.slice(0, 7),
            groupLabel: (key) => (key ? formatDayShort(`${key}-01`).slice(3) : ''),
            cell: (i) => formatDayShort(`${i.send.scheduledDate.slice(0, 7)}-01`).slice(3),
          },
        ] as Column<PendingSendItem>[])
      : []),
    ...(which === 'now'
      ? ([
          {
            id: 'overdue',
            title: 'Overdue',
            /* Drawn beside the date now, so the column exists only to be
               filtered and grouped by — which a hidden one still does, because
               the view's fields come off the column list rather than off what
               is on screen. */
            defaultHidden: true,
            kind: 'choice',
            caption: 'OVERDUE',
            value: (i) => (isOverdueApproval(i.send) ? 'Overdue' : null),
            cell: (i) => (isOverdueApproval(i.send) ? <Pill tone="red">Overdue</Pill> : <None />),
          },
        ] as Column<PendingSendItem>[])
      : []),
    ...(which === 'now'
      ? ([
          {
            id: 'actions',
            title: '',
            locked: true,
            cell: (i) => rowActions(i),
          },
        ] as Column<PendingSendItem>[])
      : []),
  ];

  const nextComing = coming[0];

  return (
    /* No subtitle, and no band announcing that approving is admin-only. The
       owner, 29 Aug 2026: "Remove all helper text." The restriction is not
       lost with it — the shut Approve control carries its own reason in `Why`,
       which is where the system rules it belongs: "never the only place
       something is said: the control it wraps already carries the answer". A
       band saying it a second time, to everyone, on arrival, is the helper
       text. */
    <Page title="My approvals">
      {/* Everything below is one stack at the standard card gap. Without it
          the band and both cards butted straight into each other: `.rd-headrow`
          zeroes the band's own margin because it is written to sit INSIDE a
          stack, and a Card carries no margin of its own. Measured at 0px. */}
      <Stack>
      {/* The two figures that decide whether to keep reading. Both partition
          the table below, so neither repeats a foot. */}
      <div className="rd-headrow">
        <div className="rd-kband">
          <div className="rd-kpi">
            <div className="rd-l">Overdue</div>
            <div className="rd-v">
              {overdue.length > 0 ? (
                <>
                  {overdue.length}
                  <span className="rd-vnote">
                    oldest {formatDayShort(overdue[0].send.scheduledDate)}
                  </span>
                </>
              ) : (
                <span className="rd-none">None</span>
              )}
            </div>
          </div>
          <div className="rd-kpi">
            <div className="rd-l">Due in the next 7 days</div>
            <div className="rd-v">
              {now.length > 0 ? (
                <>
                  {now.length}
                  {/* "to 8 collectors", not "8 collectors": a figure followed
                      by another figure reads as one number, and "2 8 collectors"
                      was landing as twenty-eight. */}
                  <span className="rd-vnote">
                    {`to ${plural(
                      now.reduce((sum, i) => sum + i.recipientCount, 0),
                      'collector',
                    )}`}
                  </span>
                </>
              ) : (
                <span className="rd-none">None</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {queue.data === null ? (
        <Card>
          <Skeleton rows={8} />
        </Card>
      ) : (
        <>
          <DataTable
            table="approvals-now"
            title="To approve now"
            noun="send"
            searchPlaceholder="Search subjects and releases"
            columns={columnsFor('now')}
            rows={now}
            rowKey={(i) => i.send.id}
            onRowClick={(i) => setPreview(i)}
            select={{
              picked,
              label: (i) => i.send.subject,
              actions: [{ label: 'Approve', onClick: () => setBulkOpen(true) }],
            }}
            empty={
              nextComing
                ? `Nothing needs approving in the next 7 days. The next one is ${formatDayShort(
                    nextComing.send.scheduledDate,
                  )} — it is in Coming up below.`
                : 'Nothing waiting for approval. New and rescheduled comms plans land here before anything can send.'
            }
          />

          <DataTable
            table="approvals-coming"
            title="Coming up"
            noun="send"
            searchPlaceholder="Search subjects and releases"
            columns={columnsFor('coming')}
            rows={coming}
            rowKey={(i) => i.send.id}
            onRowClick={(i) => setPreview(i)}
            empty="Nothing scheduled beyond the next 7 days. Sends appear here as soon as a release has a promise date and its plan is submitted."
          />
        </>
      )}
      </Stack>

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
            ? {
                label: `Approve — ${plural(preview.recipientCount, 'collector')}`,
                onClick: () => void approve(preview),
                disabled: !isAdmin || actingOn === preview.send.id || !preview.send.imageName,
              }
            : undefined
        }
        secondary={
          preview
            ? [
                { label: 'Change email date', onClick: () => setMovingDate(preview) },
                { label: 'Change delivery date', onClick: () => void openReschedule(preview) },
                {
                  /* The one that LEAVES rather than acts, so it leaves the
                     boxed register too: four chips beside a primary is four
                     equal-looking boxes with no rank in them. */
                  label: 'Open send detail',
                  kind: 'link' as const,
                  onClick: () => {
                    navigate(`/sends/${preview.send.id}`);
                    setPreview(null);
                  },
                },
              ]
            : undefined
        }
        danger={
          preview ? { label: 'Cancel send', onClick: () => setCancelling(preview) } : undefined
        }
      >
        {preview ? (
          <>
            {/* On a delay send, the brief the copy was written FROM. An
                approver's question is "does this say what happened?", and
                until now the only thing on this dialogue that could answer it
                was the email itself — which is the thing being checked. */}
            <DelayReason brief={preview.send.brief} />
            {!preview.send.imageName ? (
              <Bar tone="warn" title="This email has no image">
                Pick one on the release's All emails tab and it lands on this send — it keeps its
                place in the queue.
              </Bar>
            ) : null}
            <Facts
              items={[
                { label: 'Scheduled', value: formatDayShort(preview.send.scheduledDate) },
                {
                  /* The promise, next to the email that claims it — so "is
                     what this says still true?" is answerable without leaving
                     the dialogue or trusting memory. */
                  label: 'Promised dispatch',
                  value: preview.batch.promiseDate
                    ? shipWindowShort(preview.batch.promiseDate)
                    : 'Not set',
                },
                { label: 'Recipients', value: preview.recipientCount },
                { label: 'Submitted by', value: userName(preview.send.createdBy) },
                {
                  label: 'They last received',
                  value: preview.lastSent
                    ? `${TEMPLATE_LABELS[preview.lastSent.templateRef]} · ${formatDayShort(
                        preview.lastSent.sentAt.slice(0, 10),
                      )}`
                    : 'Nothing yet',
                },
              ]}
            />
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
                sent
              />
            ) : (
              <Skeleton rows={6} />
            )}
          </>
        ) : null}
      </Dialog>

      <ChangeSendDateModal
        item={movingDate}
        onClose={() => setMovingDate(null)}
        onMoved={(message) => {
          setMovingDate(null);
          setPreview(null);
          showToast(message);
          reload();
        }}
        onPivot={() => {
          if (movingDate) void openReschedule(movingDate);
        }}
      />

      {/* Change delivery date, scoped to the send's batch. The reschedule
          cancels the batch's unsent sends and regenerates the plan, so the
          email that could not be approved is superseded as a side effect of
          telling the truth — the queue reloads with the delay notice at the
          top, pending, for the same approver. */}
      {rescheduling
        ? (() => {
            const d = rescheduling.detail;
            const batch = d.batches.find((b) => b.id === rescheduling.item.batch.id);
            if (!batch) return null;
            const orders = d.orders.filter((o) => o.batchId === batch.id && !o.removed);
            const batchSends = d.sends.filter((send) => send.batchId === batch.id);
            return (
              <RescheduleModal
                open
                onClose={() => setRescheduling(null)}
                release={d.release}
                batch={batch}
                batchLabel={d.batches.length > 1 ? batch.name : null}
                selectedOrders={orders}
                batchActiveOrderCount={orders.length}
                batchSends={batchSends}
                inheritedSentSends={inheritedSentStory(batch, d.batches, d.sends)}
                onDone={(message) => {
                  setRescheduling(null);
                  showToast(message);
                  reload();
                }}
              />
            );
          })()
        : null}

      <Dialog
        open={cancelling !== null}
        size="sm"
        title={cancelling ? `Cancel “${cancelling.send.subject}”?` : ''}
        onClose={() => setCancelling(null)}
        primary={{
          label: 'Cancel send',
          destructive: true,
          onClick: () => void cancel(),
          disabled: busy,
        }}
        secondary={{ label: 'Keep it', onClick: () => setCancelling(null) }}
      >
        {cancelling ? (
          <p>
            The email will not go out and drops off the plan. This is recorded in the batch history.
            Scheduled for {formatDayShort(cancelling.send.scheduledDate)}
            {isOverdueApproval(cancelling.send) ? ' (overdue)' : ''}.
          </p>
        ) : null}
      </Dialog>

      <Dialog
        open={bulkOpen}
        size="sm"
        title={`Approve ${plural(pickedItems.length, 'send')}?`}
        onClose={() => setBulkOpen(false)}
        primary={{
          label: `Approve ${plural(approvable.length, 'send')}`,
          onClick: () => void approveMany(),
          disabled: busy || approvable.length === 0,
        }}
        secondary={{ label: 'Keep reviewing', onClick: () => setBulkOpen(false) }}
      >
        <p>
          They go to{' '}
          {plural(
            pickedItems.reduce((sum, i) => sum + i.recipientCount, 0),
            'collector',
          )}{' '}
          in total. Each one goes out on its own scheduled day.
        </p>
        {pickedItems.some((i) => isOverdueApproval(i.send)) ? (
          <p>
            {plural(pickedItems.filter((i) => isOverdueApproval(i.send)).length, 'is', 'are')}{' '}
            already overdue and will go out in the next send run.
          </p>
        ) : null}
        {blocked.length > 0 ? (
          <Bar tone="warn" title={`${plural(blocked.length, 'send')} cannot be approved yet`}>
            {blocked.length === 1 ? 'It has' : 'They have'} no image picked, so{' '}
            {blocked.length === 1 ? 'it stays' : 'they stay'} selected here while the rest go
            through.
          </Bar>
        ) : null}
      </Dialog>
    </Page>
  );
}
