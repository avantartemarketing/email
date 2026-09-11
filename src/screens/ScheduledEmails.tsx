import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PendingSendItem } from '../types';
import { daysBetween, formatDayShort, today } from '../logic/dates';
import { TEMPLATE_LABELS, sendStatusBadge, subjectInTable } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { Cap, None, Page, Tag } from '../ui/rd';
import { DataTable } from '../ui/DataTable';
import type { Column } from '../ui/DataTable';
import { useAsync } from '../ui/useAsync';

/**
 * The calendar: every email that is going to send, across every release,
 * soonest first — whatever desk it currently sits on. The owner, 9 Sep 2026:
 * a screen "with an overview of all scheduled emails", under Releases.
 *
 * Read-only on purpose. Approving lives in My approvals, writing in Emails
 * to write, editing on the send itself — a row here is a door to the send,
 * not a fourth place to act on it.
 */
export function ScheduledEmails(): ReactElement {
  const { data } = useApp();
  const navigate = useNavigate();
  const sends = useAsync(() => data.listScheduledSends(), []);

  const rows = sends.data ?? [];
  const columns: Column<PendingSendItem>[] = [
    {
      id: 'scheduled',
      title: 'Scheduled',
      locked: true,
      kind: 'date',
      value: (i) => i.send.scheduledDate,
      cell: (i) => formatDayShort(i.send.scheduledDate),
    },
    {
      id: 'daysAway',
      title: 'Days away',
      n: true,
      kind: 'number',
      value: (i) => daysBetween(today(), i.send.scheduledDate),
      /* Past dates render blank rather than "-6": the Status cell beside it
         already says Overdue, and a negative count in a column headed "Days
         away" is a figure the reader has to translate before it means
         anything. Sorting still runs on the signed value above. */
      cell: (i) => {
        const away = daysBetween(today(), i.send.scheduledDate);
        return away < 0 ? <None /> : away;
      },
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
        </span>
      ),
    },
    {
      id: 'status',
      title: 'Status',
      /* Locked: the one column that says whether a row still needs a person —
         a draft, an unwritten delay email, a pending approval. */
      locked: true,
      kind: 'choice',
      caption: 'STATUS',
      order: ['Awaiting copy', 'Pending approval', 'Draft', 'Queued'],
      value: (i) =>
        i.send.status === 'awaiting_copy'
          ? 'Awaiting copy'
          : i.send.status === 'pending_approval'
            ? 'Pending approval'
            : i.send.status === 'approved'
              ? 'Queued'
              : 'Draft',
      cell: (i) => sendStatusBadge(i.send),
    },
    {
      id: 'subject',
      title: 'Subject',
      kind: 'text',
      value: (i) => subjectInTable(i.send.subject),
      cell: (i) => <Cap>{subjectInTable(i.send.subject)}</Cap>,
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
      n: true,
      kind: 'number',
      value: (i) => i.recipientCount,
      cell: (i) => i.recipientCount,
    },
  ];

  return (
    <Page title="Scheduled emails">
      <DataTable
        table="scheduled-emails"
        noun="email"
        searchPlaceholder="Search"
        columns={columns}
        rows={rows}
        rowKey={(i) => i.send.id}
        onRowClick={(i) => navigate(`/sends/${i.send.id}`)}
        empty={
          sends.data === null
            ? 'Loading…'
            : 'Nothing scheduled.'
        }
      />
    </Page>
  );
}
