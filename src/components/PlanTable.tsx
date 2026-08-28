import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ScheduledSend } from '../types';
import { formatDateTime, formatDayShort } from '../logic/dates';
import { TEMPLATE_LABELS, sendStatusBadge } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { CellLink, None, Pill, RowAct } from '../ui/rd';
import { DataTable } from '../ui/DataTable';
import type { Column } from '../ui/DataTable';

/**
 * A batch's comms plan as a plain table: one row per email, one line per row,
 * chronological. Sent rows read muted; upcoming rows carry their actions. For
 * a split batch, the emails collectors received BEFORE the split open the
 * story as muted rows — the plan is what this batch has been told, not what
 * this batch object happens to own.
 */
interface PlanRow {
  send: ScheduledSend;
  inherited: boolean;
}

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

  const visible = sends.filter((s) => s.status !== 'cancelled');
  const cancelled = sends.filter((s) => s.status === 'cancelled');
  const rows: PlanRow[] = [
    ...inheritedSends.map((send) => ({ send, inherited: true })),
    ...visible.map((send) => ({ send, inherited: false })),
  ].sort((a, b) => a.send.scheduledDate.localeCompare(b.send.scheduledDate));

  const failures = (r: PlanRow) =>
    r.send.recipients?.filter((x) => x.status === 'failed').length ?? 0;
  const muted = (r: PlanRow) => r.inherited || r.send.status === 'sent';

  const columns: Column<PlanRow>[] = [
    {
      id: 'email',
      title: 'Email',
      locked: true,
      kind: 'choice',
      caption: 'EMAIL',
      value: (r) => TEMPLATE_LABELS[r.send.templateRef],
      cell: (r) => (
        <span className={muted(r) ? 'rd-mut' : 'rd-ink'}>
          <CellLink onClick={() => navigate(`/sends/${r.send.id}`)}>
            {`${TEMPLATE_LABELS[r.send.templateRef]}${r.inherited ? ' · before the split' : ''}`}
          </CellLink>
        </span>
      ),
    },
    {
      id: 'status',
      title: 'Status',
      /* Locked: it is the column that says a send is overdue or failed. */
      locked: true,
      kind: 'choice',
      caption: 'STATUS',
      value: (r) => (r.inherited ? 'sent' : r.send.status),
      cell: (r) => (r.inherited ? <Pill tone="green">Sent</Pill> : sendStatusBadge(r.send)),
    },
    {
      id: 'scheduled',
      title: 'Scheduled',
      kind: 'date',
      value: (r) => r.send.scheduledDate,
      cell: (r) => formatDayShort(r.send.scheduledDate),
    },
    {
      id: 'sent',
      title: 'Sent',
      kind: 'date',
      value: (r) => r.send.sentAt?.slice(0, 10),
      cell: (r) => (r.send.sentAt ? formatDateTime(r.send.sentAt) : <None />),
    },
    {
      id: 'approvedBy',
      title: 'Approved by',
      kind: 'choice',
      caption: 'APPROVED BY',
      value: (r) => (r.send.approvedBy ? userName(r.send.approvedBy) : null),
      cell: (r) => (r.send.approvedBy ? userName(r.send.approvedBy) : <None />),
    },
    {
      id: 'recipients',
      title: 'Recipients',
      n: true,
      kind: 'number',
      value: (r) =>
        muted(r) ? (r.send.recipients?.length ?? null) : batchActiveOrderCount,
      cell: (r) =>
        muted(r) ? (r.send.recipients?.length ?? <None />) : batchActiveOrderCount,
    },
    {
      id: 'issues',
      title: 'Issues',
      locked: true,
      n: true,
      kind: 'number',
      value: (r) => failures(r) || null,
      cell: (r) => (failures(r) > 0 ? <Pill tone="red">{failures(r)} failed</Pill> : <None />),
    },
    {
      id: 'actions',
      title: '',
      locked: true,
      cell: (r) =>
        !r.inherited && r.send.status !== 'sent' ? (
          <div className="rd-rowacts">
            <RowAct onClick={() => onEdit(r.send)}>Edit</RowAct>
            <RowAct danger onClick={() => onCancel(r.send)}>
              Cancel
            </RowAct>
          </div>
        ) : null,
    },
  ];

  return (
    <DataTable
      table="comms-plan"
      title="Comms plan"
      noun="email"
      searchPlaceholder="Search this plan"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.send.id}
      empty="No sends planned yet — set a promise date to generate the milestone plan."
      foot={
        cancelled.length > 0 ? (
          <>
            {cancelled.length} cancelled send{cancelled.length === 1 ? '' : 's'} — see the history
            below for why
          </>
        ) : undefined
      }
    />
  );
}
