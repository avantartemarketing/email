import type { ReactElement } from 'react';
import { Bar, Cap } from '../ui/rd';

/**
 * The rows an import could not read.
 *
 * A table, not a list: a row number and a reason are two facts per line, which
 * is a two-column table wherever else in this app they appear. It sits under a
 * failure band that says how many, because the count is the thing somebody
 * acts on and the rows are what they act on it with.
 */
export function ImportIssues({
  issues,
}: {
  issues: { row: number; reason: string }[];
}): ReactElement | null {
  if (issues.length === 0) return null;
  return (
    <>
      <Bar
        tone="fail"
        title={`${issues.length} row${issues.length === 1 ? '' : 's'} could not be read`}
      >
        Everything else was imported.
      </Bar>
      <table className="rd-t rd-t27 rd-fit rd-importlist">
        <thead>
          <tr>
            <th scope="col" className="n">
              Row
            </th>
            <th scope="col">Why</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={`${issue.row}-${issue.reason}`}>
              <td className="n">{issue.row}</td>
              <td>
                <Cap>{issue.reason}</Cap>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
