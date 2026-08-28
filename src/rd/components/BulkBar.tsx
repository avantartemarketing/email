/**
 * The bulk action bar, for any table with a tick column.
 *
 * It **replaces the column-header row** rather than stacking above it
 * (ruling 9). The concept draws it above the table, but that placement was a
 * drawing artifact: stacking pushes every row down the moment a box is ticked,
 * so the row just clicked slides out from under the pointer. Replacing it in
 * place, at the header row's own height, costs the column headings while a
 * selection is live — that is the trade, and it was made deliberately.
 *
 * The bar's cell is a `th` inside the same `thead`, so it takes the column
 * header row's padding, edge and height from the rules that size that row —
 * the two cannot come out different, because they are the same rule. The
 * table wants `rd-tsel`, which is what reserves a control's height in the
 * header row so there is room for the bar's pills.
 * `scripts/shoot-redesign-vendors.mjs` proves the swap is height-neutral by
 * ticking a box and checking the first data row has not moved.
 *
 * A bar offers where a selection can GO, never where it already is. Callers
 * pass only the actions that apply to what is ticked.
 */
import { Fragment, type ReactNode } from 'react'
import Tick from './Tick'

export interface BulkAction {
  label: string
  onClick?: () => void
  /** Reads red, and says so in the word — colour never carries it alone. */
  destructive?: boolean
  /**
   * A control that is not a plain pill — the roster's "Change status" menu.
   *
   * It sits in `actions` rather than in `children` so that the bar's order is
   * the bar's order: Delete comes after the menu on a roster, and
   * children render after every action, which would put the one irreversible
   * act in the middle of the row. The label is still what the control is
   * called, so a reader listing the bar gets the same words either way.
   */
  node?: ReactNode
}

export default function BulkBar({
  count,
  columns,
  actions,
  children,
}: {
  count: number
  /** How many columns the header row it stands in for spans. */
  columns: number
  actions: BulkAction[]
  children?: ReactNode
}) {
  return (
    <tr className="rd-bulkbar">
      <th colSpan={columns} scope="colgroup">
        <div className="rd-bulkinner">
          {/* Indeterminate: some of the list, not all of it. */}
          <span className="rd-cbx on" aria-hidden>
            <Tick mixed />
          </span>
          <span className="rd-bulkcount">{count} selected</span>
          {actions.map((a) =>
            a.node !== undefined ? (
              <Fragment key={a.label}>{a.node}</Fragment>
            ) : (
              <button
                key={a.label}
                type="button"
                className={a.destructive ? 'rd-btn-grey rd-btn-danger' : 'rd-btn-grey'}
                onClick={a.onClick}
              >
                {a.label}
              </button>
            ),
          )}
          {children}
        </div>
      </th>
    </tr>
  )
}
