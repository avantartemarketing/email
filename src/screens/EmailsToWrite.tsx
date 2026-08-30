import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CopyJobItem } from '../types';
import { daysBetween, formatDayShort, today } from '../logic/dates';
import { NO_IMAGE_YET, shipWindowShort } from '../logic/templates';
import { plural } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { useAsync } from '../ui/useAsync';
import {
  Bar,
  Btn,
  Cap,
  Card,
  Dialog,
  Facts,
  None,
  Page,
  Pill,
  RowAct,
  Skeleton,
  Stack,
  Tag,
} from '../ui/rd';
import { DataTable } from '../ui/DataTable';
import type { Column } from '../ui/DataTable';
import Field from '../rd/components/Field';
import { EmailPreview } from '../components/EmailPreview';
import { DelayReason } from '../components/DelayReason';

/**
 * The CRM team's worklist: delay emails somebody has to write.
 *
 * The owner, 29 Aug 2026: "When someone schedules a delay, the job of writing
 * the email goes to the CRM team. So we need it to trigger a notification to
 * them and appear in a view where they can see the reason for the delay and
 * write the email."
 *
 * ## Why this is a page and not a filter on My approvals
 *
 * Because it is not the same question. An approver asks "should this go out?"
 * of an email that exists; a writer asks "what do I say?" of an email that
 * does not. The columns differ (a reason, a slip, a promise moved — none of
 * which an approver reads), the verb differs, and above all the AUDIENCE
 * differs. Two jobs owed by two teams on one screen is a screen where each
 * team learns to ignore half the rows.
 *
 * ## The reason is the payload
 *
 * Every other column here is context; the reason is the only thing the person
 * who scheduled the delay knows and the writer does not. It gets a column of
 * its own — capped, because nothing wraps in a table — and the full text at
 * the top of the writer, above the fields, where it is read before a word is
 * typed rather than recalled after.
 *
 * ## Nothing here is shut for the wrong team
 *
 * The queue is addressed to CRM and the rail badge only summons CRM, but the
 * page is open and so are its verbs. A delay notice a collector is owed must
 * not wait for the right person to come back from lunch, and a shut control
 * on this page would be claiming a restriction the data layer does not have.
 * What ops sees instead is a note saying whose desk this is.
 */
export function EmailsToWrite(): ReactElement {
  const { data, currentUser, showToast, userName, refreshApprovals } = useApp();
  const navigate = useNavigate();
  const queue = useAsync(() => data.listCopyQueue(), []);

  const [writing, setWriting] = useState<CopyJobItem | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState<CopyJobItem | null>(null);

  const jobs = queue.data ?? [];
  const late = jobs.filter((j) => j.send.scheduledDate < today());
  const waiting = jobs.reduce((sum, j) => sum + j.recipientCount, 0);
  const isCrm = currentUser.team === 'crm';

  const reload = () => {
    queue.reload();
    /* The approval badge counts what is due, and a written email joins that
       count the moment it is handed back. */
    refreshApprovals();
  };

  /* Opening the row is reading the notification, and the row behind the
     dialogue has to stop saying "New" the moment it is — a pill that survives
     being looked at is a pill nobody reads twice. The reload is safe under an
     open dialogue: the writer draws from `writing`, which is its own copy, not
     from the row it came from. A failure is swallowed: the read is bookkeeping,
     and `submitDelayCopy` closes the notification anyway. */
  useEffect(() => {
    const id = writing?.notification?.id;
    if (!id) return;
    void data
      .markNotificationRead(id)
      .then(() => queue.reload())
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writing, data]);

  /* Not `open` — that shadows `window.open`, and a one-word name for the one
     verb this screen has is the name most likely to be read as the global. */
  const openWriter = (job: CopyJobItem): void => {
    setSubject(job.send.subject);
    setBody(job.send.body);
    setWriting(job);
  };

  const save = async (hold: boolean): Promise<void> => {
    if (!writing) return;
    setSaving(true);
    try {
      await data.submitDelayCopy(writing.send.id, { subject, body }, { hold });
      showToast(
        hold
          ? 'Saved — still on your list to finish'
          : writing.send.scheduledDate <= today()
            ? `Sent for approval — ${plural(writing.recipientCount, 'collector')} waiting`
            : `Sent for approval — goes out ${formatDayShort(writing.send.scheduledDate)}`,
      );
      setWriting(null);
      reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (): Promise<void> => {
    if (!cancelling) return;
    setSaving(true);
    try {
      await data.cancelSend(cancelling.send.id);
      showToast('Delay email cancelled — nothing goes to these collectors');
      setCancelling(null);
      setWriting(null);
      reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<CopyJobItem>[] = [
    {
      id: 'needed',
      title: 'Needed by',
      locked: true,
      kind: 'date',
      value: (j) => j.send.scheduledDate,
      /* The delay email is scheduled for the day the delay was scheduled, so
         a job that has sat here two days is two days of collectors not being
         told. The pill rides beside the date because "late" is a property OF
         this date, not a second fact. */
      cell: (j) => (
        <span className="rd-cellflex">
          <span className={j.send.scheduledDate < today() ? 'rd-ink' : undefined}>
            {formatDayShort(j.send.scheduledDate)}
          </span>
          {j.send.scheduledDate < today() ? (
            <Pill tone="red" small>
              Overdue
            </Pill>
          ) : null}
        </span>
      ),
    },
    {
      id: 'new',
      /* Only the exception is drawn. A "Read" pill on every other row would
         say the same thing five times and hide the one nobody has looked at. */
      title: 'New',
      locked: true,
      kind: 'choice',
      caption: 'NEW',
      order: ['New', 'Seen'],
      value: (j) => (j.notification ? 'New' : 'Seen'),
      cell: (j) => (j.notification ? <Pill tone="violet">New</Pill> : <None />),
    },
    {
      id: 'release',
      title: 'Release',
      kind: 'choice',
      caption: 'RELEASE',
      value: (j) => j.release.title,
      cell: (j) => <span className="rd-ink">{j.release.title}</span>,
    },
    {
      id: 'batch',
      title: 'Batch',
      kind: 'choice',
      caption: 'BATCH',
      value: (j) => (j.releaseBatchCount > 1 ? j.batch.name : null),
      cell: (j) => (j.releaseBatchCount > 1 ? <Tag tone="teal">{j.batch.name}</Tag> : <None />),
    },
    {
      id: 'collectors',
      title: 'Collectors',
      n: true,
      kind: 'number',
      value: (j) => j.recipientCount,
      cell: (j) => j.recipientCount,
    },
    {
      id: 'slipped',
      /* The size of the news, which is what decides how the email is written:
         four days is an apology in a sentence, eleven weeks is not. The exact
         new date is one row-click away, in the writer. */
      title: 'Slipped by',
      n: true,
      kind: 'number',
      value: (j) =>
        j.send.brief?.oldPromiseDate
          ? daysBetween(j.send.brief.oldPromiseDate, j.send.brief.newPromiseDate)
          : null,
      /* A promise can move EARLIER — allowed, and warned about at the door —
         so the cell must not render "-14 days" under a heading that says
         "slipped". The sort value keeps its sign, so brought-forward dates
         still sort to one end. */
      cell: (j) => {
        if (!j.send.brief?.oldPromiseDate) return <None />;
        const n = daysBetween(j.send.brief.oldPromiseDate, j.send.brief.newPromiseDate);
        return n < 0 ? `${-n} days earlier` : `${n} days`;
      },
    },
    {
      id: 'newDispatch',
      title: 'New dispatch',
      defaultHidden: true,
      kind: 'date',
      caption: 'NEW DISPATCH',
      value: (j) => j.send.brief?.newPromiseDate,
      cell: (j) =>
        j.send.brief ? shipWindowShort(j.send.brief.newPromiseDate) : <None />,
    },
    {
      id: 'wasDispatch',
      title: 'Was',
      defaultHidden: true,
      kind: 'date',
      value: (j) => j.send.brief?.oldPromiseDate ?? undefined,
      cell: (j) =>
        j.send.brief?.oldPromiseDate ? (
          formatDayShort(j.send.brief.oldPromiseDate)
        ) : (
          <None />
        ),
    },
    {
      id: 'reason',
      /* The column this page exists for. Capped rather than wrapped — nothing
         in a table here runs to two lines — and the full sentence sits above
         the fields in the writer, which is where it is actually read. */
      title: 'Reason for the delay',
      kind: 'text',
      value: (j) => j.send.brief?.reason ?? '',
      cell: (j) => <Cap>{j.send.brief?.reason ?? '—'}</Cap>,
    },
    {
      id: 'requestedBy',
      title: 'Requested by',
      kind: 'choice',
      caption: 'REQUESTED BY',
      value: (j) => (j.send.brief ? userName(j.send.brief.requestedBy) : null),
      cell: (j) => (j.send.brief ? userName(j.send.brief.requestedBy) : <None />),
    },
    {
      id: 'requestedAt',
      title: 'Requested',
      defaultHidden: true,
      kind: 'date',
      value: (j) => j.send.brief?.requestedAt.slice(0, 10),
      cell: (j) =>
        j.send.brief ? formatDayShort(j.send.brief.requestedAt.slice(0, 10)) : <None />,
    },
    {
      id: 'actions',
      title: '',
      locked: true,
      cell: (j) => (
        <div className="rd-rowacts" onClick={(e) => e.stopPropagation()}>
          <Btn kind="pri" onClick={() => openWriter(j)}>
            Write the email
          </Btn>
          <RowAct danger onClick={() => setCancelling(j)}>
            Cancel send
          </RowAct>
        </div>
      ),
    },
  ];

  return (
    <Page
      title="Emails to write"
      facts={
        <span>
          Production moves a delivery date and says why; writing to the collectors is this team's
          job. Each row is a batch that has not been told yet.
        </span>
      }
    >
      {!isCrm ? (
        <Bar tone="note" title="This queue belongs to the CRM team">
          You are signed in as {currentUser.name}, so nothing here is counted on your rail. You can
          still write one — a collector waiting on a delay notice should not also wait for the
          right person to be at their desk.
        </Bar>
      ) : null}

      <Stack>
        <div className="rd-headrow">
          <div className="rd-kband">
            <div className="rd-kpi">
              <div className="rd-l">Overdue</div>
              <div className="rd-v">
                {late.length > 0 ? (
                  <>
                    {late.length}
                    <span className="rd-vnote">
                      oldest {formatDayShort(late[0].send.scheduledDate)}
                    </span>
                  </>
                ) : (
                  <span className="rd-none">None</span>
                )}
              </div>
            </div>
            <div className="rd-kpi">
              <div className="rd-l">Collectors waiting to hear</div>
              <div className="rd-v">
                {jobs.length > 0 ? (
                  <>
                    {waiting}
                    <span className="rd-vnote">
                      {`across ${plural(jobs.length, 'email')}`}
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
            <Skeleton rows={6} />
          </Card>
        ) : (
          <DataTable
            table="copy-queue"
            noun="email"
            nounPlural="emails"
            searchPlaceholder="Search reasons and releases"
            columns={columns}
            rows={jobs}
            rowKey={(j) => j.send.id}
            onRowClick={(j) => openWriter(j)}
            empty="Nothing to write. A delay email lands here the moment somebody changes a delivery date."
            foot={
              jobs.length > 0
                ? 'each one starts from the release’s delay template with the reason patched in — edit it, then send it for approval'
                : undefined
            }
          />
        )}
      </Stack>

      <Dialog
        open={writing !== null}
        size="lg"
        onClose={() => setWriting(null)}
        title={
          writing
            ? writing.releaseBatchCount > 1
              ? `${writing.release.title} — ${writing.batch.name}`
              : writing.release.title
            : ''
        }
        primary={
          writing
            ? {
                label: 'Send for approval',
                onClick: () => void save(false),
                disabled: saving || !subject.trim() || !body.trim(),
              }
            : undefined
        }
        secondary={
          writing
            ? [
                { label: 'Save and finish later', onClick: () => void save(true) },
                {
                  label: 'Open send detail',
                  kind: 'link' as const,
                  onClick: () => {
                    navigate(`/sends/${writing.send.id}`);
                    setWriting(null);
                  },
                },
              ]
            : undefined
        }
        danger={writing ? { label: 'Cancel send', onClick: () => setCancelling(writing) } : undefined}
      >
        {writing ? (
          <>
            {/* Read before a word is typed. It is the only thing the person
                who scheduled the delay knows that the writer does not, and it
                is prose, so it cannot live in a cell. Quoted and signed — see
                `DelayReason`: these are somebody's words, not the app's. */}
            <DelayReason brief={writing.send.brief} />
            {!writing.send.imageName ? (
              <Bar tone="warn" title="This email has no image">
                {NO_IMAGE_YET} You can still write and send it for approval — the picture is picked
                on the release’s All emails tab.
              </Bar>
            ) : null}
            <Facts
              items={[
                { label: 'Needed by', value: formatDayShort(writing.send.scheduledDate) },
                { label: 'Recipients', value: writing.recipientCount },
                /* The dates as bare days, not as ship windows. Rendered as
                   windows these two boxes ran to two lines each while the
                   three beside them held one, and a facts band with two tall
                   boxes in it reads as two facts that matter more. The full
                   window is in the email copy below, which is where a
                   collector will read it. */
                {
                  label: 'Was promised',
                  value: writing.send.brief?.oldPromiseDate
                    ? formatDayShort(writing.send.brief.oldPromiseDate)
                    : 'Not set',
                },
                {
                  label: 'Now promised',
                  value: writing.send.brief
                    ? formatDayShort(writing.send.brief.newPromiseDate)
                    : 'Not set',
                },
                /* No "Requested by" box: the brief above is SIGNED now, and a
                   fact box repeating the name two lines under the signature is
                   the same fact spent twice. The four that are left are the
                   ones the writer weighs — when, how many, from what, to
                   what. */
              ]}
            />
            <div className="rd-fields">
              <Field label="Subject" value={subject} onChange={setSubject} />
              <Field
                label="Body"
                value={body}
                onChange={setBody}
                multiline
                deep
                note="{{first_name}} is personalised per collector"
              />
            </div>
            <EmailPreview
              subject={subject}
              headline={writing.send.headline}
              body={body}
              nextSteps={writing.send.nextSteps}
              imageName={writing.send.imageName}
            />
          </>
        ) : null}
      </Dialog>

      <Dialog
        open={cancelling !== null}
        size="sm"
        onClose={() => setCancelling(null)}
        title="Cancel this delay email?"
        primary={{
          label: 'Cancel the send',
          onClick: () => void cancel(),
          disabled: saving,
          destructive: true,
        }}
        secondary={{ label: 'Keep it', onClick: () => setCancelling(null) }}
      >
        {cancelling ? (
          <>
            {/* The one consequence somebody cancelling from THIS page can miss:
                the promise has already moved. Cancelling the email does not
                move it back — it only means nobody is told. */}
            <Bar tone="warn" title="The delivery date has already changed">
              {plural(cancelling.recipientCount, 'collector')} on {cancelling.release.title} have
              been moved to{' '}
              {cancelling.send.brief
                ? shipWindowShort(cancelling.send.brief.newPromiseDate)
                : 'a new date'}
              . Cancelling means they are never told, and their next email will be a milestone
              written against the new date.
            </Bar>
            <Facts
              items={[
                { label: 'Release', value: cancelling.release.title },
                { label: 'Recipients', value: cancelling.recipientCount },
                {
                  label: 'Reason given',
                  value: cancelling.send.brief?.reason ?? '—',
                },
              ]}
            />
          </>
        ) : null}
      </Dialog>
    </Page>
  );
}
