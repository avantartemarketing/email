/**
 * The Columns picker, and the shape of a column it picks from.
 *
 * One control, drawn the same way wherever a table can put a column away —
 * the owner asked for it on Pay and on All payments after using it on Log,
 * and three copies of a menu is three chances to word it differently.
 *
 * **A picker governs a SCREEN, not a table.** On Log & pay the two tables
 * hold the same kinds of fact, so one picker drives both and it lives in the
 * page header: a Columns chip in one table's bar, quietly changing the other
 * table as well, would be a control that lies about its reach. Where a screen
 * has one table the two placements are the same place.
 *
 * What is NOT offered is as deliberate as what is: the tick gutter, because
 * it is how a selection is made, and Log's Status column, because it carries
 * the queue's findings and a list you can hide the warnings on is a list that
 * stops warning you.
 */
import { useState } from 'react'
import Menu from './Menu'

export interface ColumnSpec {
  /** What a hidden column and a dragged width are stored against. */
  id: string
  label: string
  /** The concept's width, or null for the column that takes the surplus. */
  width: number | null
  /** A figure column: right-aligned, tabular. */
  n?: boolean
  /** Anything else the cell wears — the identity column's ink, say. */
  cls?: string
}

/**
 * Two tables' columns as one list, in an order that reads like the tables do.
 *
 * A column only one of them has — Country, which Pay draws and the Log queue
 * does not — is placed after the column it follows in its own table rather
 * than tacked on the end, so the menu is not a third order to learn.
 */
export function mergeColumns(a: ColumnSpec[], b: ColumnSpec[]): ColumnSpec[] {
  const out = [...a]
  b.forEach((c, i) => {
    if (out.some((x) => x.id === c.id)) return
    const prev = b[i - 1]
    const at = prev ? out.findIndex((x) => x.id === prev.id) : -1
    out.splice(at >= 0 ? at + 1 : out.length, 0, c)
  })
  return out
}

export default function ColumnsMenu({
  columns,
  hidden,
  onToggle,
}: {
  columns: readonly ColumnSpec[]
  hidden: Set<string>
  onToggle: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const on = (id: string) => !hidden.has(id)
  return (
    <Menu
      chipClass="rd-chip"
      chip="Columns"
      open={open}
      setOpen={setOpen}
      items={columns.map((c) => ({
        key: c.id,
        label: `${on(c.id) ? '✓' : ' '}  ${c.label}`,
        on: on(c.id),
      }))}
      onPick={(id) => {
        onToggle(id)
        // The menu stays up: putting three columns away is three picks, and
        // closing after each would make it four clicks a column.
        return true
      }}
    />
  )
}
