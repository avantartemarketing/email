import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ScheduledSend } from '../types';
import { formatDateTime, formatDayShort } from '../logic/dates';
import { TEMPLATE_LABELS, sendStatusBadge } from '../ui/format';
import { useApp } from '../ui/AppContext';
import { useColumns } from '../ui/useColumns';
import { Card, CardHead, CellLink, Foot, None, Pill, RowAct } from '../ui/rd';

/**
 * A batch's comms plan as a plain table: one row per email, one line per row,
 * chronological. Sent rows read muted; upcoming rows carry their actions. For
 * a split batch, the emails collectors received BEFORE the split open the
 * story as muted rows — the plan is what this batch has been told, not what
 * this batch object happens to own.
 */
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

  const columns = useColumns('comms-plan', [
    { id: 'email', title: 'Email', locked: true },
    { id: 'status', title: 'Status', locked: true },
    { id: 'scheduled', title: 'Scheduled' },
    { id: 'sent', title: 'Sent' },
    { id: 'approvedBy', title: 'Approved by' },
    { id: 'recipients', title: 'Recipients', n: true },
    { id: 'issues', title: 'Issues' },
    { id: 'actions', title: '', locked: true },
  ]);

  const visible = sends.filter((s) => s.status !== 'cancelled');
  const cancelled = sends.filter((s) => s.status === 'cancelled');
  const rows = [
    ...inheritedSends.map((send) => ({ send, inherited: true })),
    ...visible.map((send) => ({ send, inherited: false })),
  ].sort((a, b) => a.send.scheduledDate.localeCompare(b.send.scheduledDate));

  return (
    <Card>
      <CardHead title="Comms plan" actions={rows.length > 0 ? columns.menu : undefined} />
      <div className="rd-scroll">
        <table className="rd-t rd-t27 rd-fit rd-tpad">
          <thead>
            <tr>{columns.head}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="rd-prose" colSpan={columns.count}>
                  No sends planned yet — set a promise date to generate the milestone plan.
                </td>
              </tr>
            ) : (
              rows.map(({ send, inherited }) => {
                const isSent = send.status === 'sent';
                const muted = isSent || inherited;
                const failures = send.recipients?.filter((r) => r.status === 'failed').length ?? 0;
                return (
                  <tr key={send.id} className={muted ? 'rd-mut' : undefined}>
                    <td className={muted ? undefined : 'rd-ink'}>
                      <CellLink onClick={() => navigate(`/sends/${send.id}`)}>
                        {`${TEMPLATE_LABELS[send.templateRef]}${
                          inherited ? ' · before the split' : ''
                        }`}
                      </CellLink>
                    </td>
                    <td>{inherited ? <Pill tone="green">Sent</Pill> : sendStatusBadge(send)}</td>
                    {columns.show('scheduled') ? (
                      <td>{formatDayShort(send.scheduledDate)}</td>
                    ) : null}
                    {columns.show('sent') ? (
                      <td>{send.sentAt ? formatDateTime(send.sentAt) : <None />}</td>
                    ) : null}
                    {columns.show('approvedBy') ? (
                      <td>{send.approvedBy ? userName(send.approvedBy) : <None />}</td>
                    ) : null}
                    {columns.show('recipients') ? (
                      <td className="n">
                        {isSent || inherited
                          ? (send.recipients?.length ?? <None />)
                          : batchActiveOrderCount}
                      </td>
                    ) : null}
                    {columns.show('issues') ? (
                      <td>
                        {failures > 0 ? (
                          <Pill tone="red">{failures} failed</Pill>
                        ) : (
                          <None />
                        )}
                      </td>
                    ) : null}
                    <td>
                      {!isSent && !inherited ? (
                        <div className="rd-rowacts">
                          <RowAct onClick={() => onEdit(send)}>Edit</RowAct>
                          <RowAct danger onClick={() => onCancel(send)}>
                            Cancel
                          </RowAct>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {cancelled.length > 0 ? (
        <Foot>
          {cancelled.length} cancelled send{cancelled.length === 1 ? '' : 's'} superseded by
          reschedules — full history below.
        </Foot>
      ) : null}
    </Card>
  );
}
