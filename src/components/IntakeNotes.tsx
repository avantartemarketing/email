import type { ReactElement } from 'react';
import type { IntakeNote } from '../types';
import { Bar } from '../ui/rd';

/**
 * Everything a file does that somebody would want to know before pressing the
 * button — said before anything is written, and blocking none of it.
 *
 * ## Why no cell is a sentence
 *
 * The first draft of this table had a "Which" column running to sixty
 * characters: *"#AA10418 — framed and unframed, two dates, two email
 * streams"*. `Cap` is 27 characters and the house rule is that a cell in this
 * app is never two lines, so every row of it would have rendered as
 * `#AA10418 — framed and unfr…` and the whole point of the table would have
 * been lost on every row. So three short columns, a fixed vocabulary word per
 * kind, and the prose said once in the band above — which is where prose is
 * allowed.
 *
 * ## And why the band is not a warning
 *
 * The helper-text ruling (29 Aug) kept warnings because "they qualify a
 * control". This qualifies nothing: nothing here blocks. It is justified as
 * EVIDENCE instead — the pre-write equivalent of a table's foot count, which
 * the same ruling explicitly kept, and the thing that replaced the standing
 * paragraph the old import dialogue opened with.
 */
export function IntakeNotes({ notes }: { notes: IntakeNote[] }): ReactElement | null {
  if (notes.length === 0) return null;
  const outside = notes.filter(
    (n) => n.kind === 'no_email' || n.kind === 'no_collector_name' || n.kind === 'not_paid',
  ).length;
  return (
    <>
      <Bar
        tone="note"
        title={`${notes.length} thing${notes.length === 1 ? '' : 's'} to check in this file`}
      >
        None of these stop the import.
        {outside > 0
          ? ` ${outside === 1 ? 'One needs' : `${outside} need`} a fix outside this tool.`
          : ''}
      </Bar>
      <table className="rd-t rd-t27 rd-fit rd-importlist">
        <thead>
          <tr>
            <th scope="col">Order</th>
            <th scope="col">What</th>
            <th scope="col">Detail</th>
          </tr>
        </thead>
        <tbody>
          {notes.map((n) => (
            <tr key={`${n.kind}-${n.order}`}>
              <td>{n.order}</td>
              <td className="rd-ink">{n.what}</td>
              <td className="rd-mut">{n.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
