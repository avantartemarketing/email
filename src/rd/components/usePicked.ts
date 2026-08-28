/**
 * The row selection every ticked table shares — and, with it, `89i`.
 *
 * The owner: *"if I click a selection button on a row on a table and press
 * shift and click another a few down, it should select all the rows in
 * between."* Which is how every list anybody uses works, and how none of the
 * seven ticked tables in this admin worked.
 *
 * They each kept their own `useState<Set<string>>` and their own three-line
 * `toggle`, seven near-copies of the same thing. Adding a range to seven
 * copies is how they drift: it is exactly the shape of fault that let the
 * band carry a chevron with no handler behind it for months.
 * So the set, the anchor and the range live here, once.
 *
 * ## The anchor, and why the range is read off the DOM
 *
 * A range needs two things: where it started, and what "in between" means.
 *
 * The anchor is the last row pressed WITHOUT the modifier. It stays put across
 * shift-presses, so a range can be widened and narrowed from the same start
 * rather than walking away with every click.
 *
 * "In between" is the order the table is DRAWN in, which is not the order of
 * any array this hook could be handed. A grouped table interleaves its bands,
 * a sorted one reorders, and a folded group's rows are not on the screen at
 * all — a range taken from the data would sweep in rows nobody can see and
 * report a count that does not match what is ticked. So the ticks are read
 * from the DOM at the moment of the press: whatever is drawn, in the order it
 * is drawn, and nothing that is not.
 *
 * ## What a shift-press does
 *
 * It SELECTS the range; it never clears it. Two reasons: the owner's words are
 * "select all the rows in between", and a shift-press that deselected would
 * make the same gesture mean two things depending on a state — whether the
 * anchor happened to be ticked — that nothing on the screen shows.
 */
import { useCallback, useRef, useState } from 'react'

/** Every tick currently drawn in this one's table, in the order drawn.
    The order record's lines are the one ticked list that is not a `<table>`
    — the invoiced order draws the line editor's boxes, shaded — so the
    scope is the nearest of the two containers a tick can live in. */
export function ticksInTable(el: Element): string[] {
  const table = el.closest('table, .rd-lines')
  if (!table) return []
  return [...table.querySelectorAll<HTMLElement>('[data-tick]')]
    .map((n) => n.dataset.tick ?? '')
    .filter(Boolean)
}

export interface Picked {
  ids: Set<string>
  size: number
  has: (id: string) => boolean
  /**
   * A row was pressed. `order` is what the table is drawing, from
   * `ticksInTable`; with `range` true and an anchor to work from, every row
   * between the two is selected, and otherwise this is an ordinary toggle.
   */
  press: (id: string, range: boolean, order: string[]) => void
  /** For the bulk bar's own writes — select-all, clear, a completed action. */
  replace: (next: Set<string>) => void
  clear: () => void
}

/**
 * `after` runs on every change. A roster uses it to disarm a primed Delete:
 * an armed action that survived a re-tick would fire on a set nobody armed it
 * for.
 */
export default function usePicked(after?: () => void): Picked {
  const [ids, setIds] = useState<Set<string>>(new Set())
  const anchor = useRef<string | null>(null)

  const press = useCallback(
    (id: string, range: boolean, order: string[]) => {
      after?.()
      const from = anchor.current
      const a = from == null ? -1 : order.indexOf(from)
      const b = order.indexOf(id)

      /* No anchor yet, or either end is no longer drawn — a filter changed
         under the selection, say. An ordinary toggle is the honest answer;
         guessing at a range across rows that are not there is not. */
      if (!range || a < 0 || b < 0 || a === b) {
        anchor.current = id
        setIds((prev) => {
          const next = new Set(prev)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
        return
      }

      /* The anchor STAYS. Widening and narrowing from one start is the whole
         reason a range has an anchor rather than just a previous click. */
      const lo = Math.min(a, b)
      const hi = Math.max(a, b)
      setIds((prev) => {
        const next = new Set(prev)
        for (let i = lo; i <= hi; i += 1) next.add(order[i])
        return next
      })
    },
    [after],
  )

  const replace = useCallback(
    (nextIds: Set<string>) => {
      after?.()
      setIds(nextIds)
    },
    [after],
  )

  const clear = useCallback(() => {
    after?.()
    anchor.current = null
    setIds(new Set())
  }, [after])

  return {
    ids,
    size: ids.size,
    has: (id: string) => ids.has(id),
    press,
    replace,
    clear,
  }
}
