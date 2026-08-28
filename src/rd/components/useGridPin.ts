/**
 * Hold a content-sized table's grid still while a selection is live.
 *
 * ## What this is for
 *
 * Item 3 sizes columns by their contents — `table-layout: auto`, the browser's
 * own algorithm, which is what a commerce admin's own tables use and what
 * `docs/spikes/column-autolayout.mjs` measured: below the columns' natural
 * total the table does not shrink and the wrapper scrolls; above it the
 * surplus divides in proportion to each column's own width.
 *
 * That collides with **ruling 9**, and the collision is the whole reason this
 * file exists. Ruling 9 makes the bulk bar REPLACE the column-header row in
 * place, so that "starting a selection moves nothing and the ticked row stays
 * under the pointer". But an auto grid is sized by every row INCLUDING the
 * header, so the moment the bar's single `colSpan` cell takes the header's
 * place the browser re-derives every column from the body alone. Measured on
 * All payments, ticking one box moved the grid:
 *
 *     46, 142, 273, 93, 148, 97, 84, 97, 81, 83, 185
 *   → 51, 145, 273, 91, 154, 86, 87, 103, 73, 81, 185
 *
 * Which is precisely the fault ruling 9 exists to prevent, arriving through
 * the thing that replaced it.
 *
 * **The owner's answer, 27 Aug: pin the grid during a selection.** So the
 * columns are content-sized at rest and frozen for exactly as long as a
 * selection lasts.
 *
 * ## How
 *
 * On the rising edge the drawn width of every header cell is measured and
 * written onto the cells, and the table is switched to `table-layout: fixed`
 * for the duration. Fixed layout takes those widths as law and stops reading
 * the body at all, so the bar can replace the header without the grid noticing.
 * The transition is invisible because the widths written are exactly the ones
 * auto layout had already produced.
 *
 * On the falling edge everything written is removed and the table goes back to
 * being sized by its contents — including any content that changed while the
 * selection was up.
 *
 * Two details that are not incidental:
 *
 * - **The header row is measured, not the first body row.** A body row can be
 *   missing cells a header has (a spanning "nothing here" row), and the header
 *   is the row whose cells the bar is about to replace.
 * - **The widths go on the `th`s, and the table carries their sum.** A `col`
 *   has no padding of its own and these cells are `content-box`, so a width
 *   copied onto a `col` would come out narrower by the cell's padding — the
 *   fault `Cols.tsx` records this codebase shipping once already.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createElement, Fragment } from 'react'

export interface GridPin {
  /** Goes on the `<table>`. */
  ref: (el: HTMLTableElement | null) => void
  /** Rendered as the table's first child. Nothing at rest. */
  cols: ReactNode
  /** Style for the `<table>`: fixed and sized while pinned, nothing at rest. */
  style: React.CSSProperties
}

export function useGridPin(active: boolean): GridPin {
  const el = useRef<HTMLTableElement | null>(null)
  /* The grid as last drawn AT REST, kept in a ref rather than in state: it is
     measured on every commit and nothing should re-render because of it. */
  const rest = useRef<number[]>([])
  const [pinned, setPinned] = useState<number[] | null>(null)

  const ref = (node: HTMLTableElement | null) => {
    el.current = node
  }

  useLayoutEffect(() => {
    const t = el.current
    if (!t) return
    if (active) {
      /* The rising edge. The widths come from the ref, not from a measurement
         taken here: by now ruling 9's bulk bar has already replaced the
         column-header row, so there is no header left to measure. This is why
         the resting grid is recorded on every commit.

         Set through state so the colgroup renders — under `table-layout:
         fixed` the grid comes from the first row, and while the bar is up that
         row is one `colSpan` cell, which would collapse the whole grid. A
         `colgroup` survives the swap; the same reason `Cols.tsx` exists. A
         `useLayoutEffect` setState re-renders before paint, so nothing
         flashes. */
      if (rest.current.length && !pinned) setPinned(rest.current)
      return
    }
    if (pinned) {
      setPinned(null)
      return
    }
    /* At rest: record what auto layout drew, so the next selection has an
       exact grid to hold. Measured off the header row, which is the row the
       bar is going to replace — a body row can be missing cells a header has. */
    const head = [...t.querySelectorAll('thead tr')].reverse().find((r) => r.children.length > 1)
    if (head) rest.current = [...head.children].map((c) => c.getBoundingClientRect().width)
  })

  return {
    ref,
    cols: pinned
      ? createElement(
          'colgroup',
          null,
          pinned.map((w, i) => createElement('col', { key: i, style: { width: `${w}px` } })),
        )
      : createElement(Fragment, null),
    style: pinned
      ? { tableLayout: 'fixed', width: pinned.reduce((a, b) => a + b, 0) }
      : {},
  }
}

export default useGridPin
