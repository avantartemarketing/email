import { useCallback, useEffect, useRef, useState } from 'react'
import type { ColSpec } from './Cols'

/**
 * Ruling 19 — a column the reader can widen.
 *
 * Content-sized defaults stay; this lets someone override one, and keeps the
 * override. The affordance is in `Seam` and the CSS; the mechanics are here.
 *
 * ## Why the widths go on the colgroup and not the `th`
 *
 * The ruling says to set width inline on the header `th`, because in Design's
 * own build the `<colgroup>` was stripped before render and every drag broke
 * silently. That failure does not exist here, and the opposite one does:
 * `BulkBar` **replaces** the column-header row the moment a box is ticked
 * (ruling 9), so `thead tr:last-child th` is a single `colSpan` cell for as
 * long as a selection is live. Widths written there would be thrown away on
 * the first tick and the grid would collapse mid-selection — which is the
 * fault `Cols.tsx` already records this table having shipped once.
 *
 * So the ruling's *reason* is honoured — the widths live where they cannot be
 * stripped — by putting them on the structure that survives the header swap.
 * Recorded in PORT-NOTES.md. Everything else in ruling 19 is verbatim.
 *
 * ## The freeze
 *
 * These tables are `width: 100%` with `table-layout: fixed`, so widening one
 * column takes the room from its neighbours and they fight the pointer. Before
 * any delta is applied every column is pinned to the width it currently draws
 * at, and the table is given that sum as an explicit width. From then on the
 * table grows to the right and `.rd-scroll` carries it, which is already the
 * ruled behaviour for a column set that overruns.
 *
 * Both halves of that — pinning each column, and pinning the table — turn out
 * to be individually sufficient here, which `prove-resize.mjs` establishes by
 * deleting each in turn and watching the checks still pass. Once every column
 * carries an explicit width, `table-layout: fixed` grows the table to their
 * sum on its own; once the table carries an explicit width, the undeclared
 * column absorbs the delta on its own. They are kept together because they
 * cover different column sets — a table with nothing undeclared needs the
 * first, a table with nothing declared needs the second — and the check fails
 * loudly when both go, with the neighbour moving 90px the wrong way.
 *
 * The drag writes to the DOM rather than to React state, coalesced into one
 * `requestAnimationFrame`: a width written on every `mousemove` forces a
 * synchronous layout of a wide table several times a frame. State catches up
 * once, on release.
 */

/**
 * The floor a column cannot be dragged below.
 *
 * Ruling 19 said 56px and the **owner has overruled it**: a column must keep
 * shrinking past it. This is not "no floor", though, and the reason is the
 * seam rather than the column. The grip is a 3px strip inside the column's
 * right edge, so a column narrower than the strip has nothing left to grab and
 * can never be brought back — a drag that destroys a column with no way to
 * undo it is worse than a drag that stops.
 *
 * 12px is four times the strip, which leaves nine clear pixels between one
 * column's grip and the previous column's, so a pointer aimed at a squeezed
 * column's seam cannot land on its neighbour's. A column at 12px shows nothing
 * of its content and everything of its handle, which is the state somebody
 * squeezing a column down to nothing actually wants.
 */
export const MIN_COL = 12

/** A column's identity, which is what a stored width is keyed by. */
export interface ColDef {
  /**
   * Stable across reordering and hiding. Keying by index would move every
   * stored width onto the wrong column the first time a column was hidden.
   */
  id: string
  /** What the concept declares, used until someone overrides it. */
  w: ColSpec
  /**
   * No seam on this column's right edge.
   *
   * For the tick gutter, which is 36px because that is what a checkbox is,
   * and holds nothing that could want more room.
   *
   * The original reason was arithmetic and is gone: ruling 19's floor was
   * 56px, so the smallest drag would have jerked the gutter from 36 to 56,
   * which reads as a broken control rather than a resize. With the floor at
   * 12px that no longer happens. The exclusion stays on the other ground the
   * ruling itself uses for the last column — there is nothing in a checkbox
   * gutter to make room for, so a seam there offers a resize nobody wants and
   * puts a grip 3px from the row's tick target.
   *
   * And because it has no seam, a fixed column's width is never STORED or read
   * back either — it always draws at its declaration. A stored width only
   * exists so a drag can be remembered, and no drag can reach this column; the
   * only widths a store could hold for it are ones a faulty build measured.
   * One did: a drag once handed the whole grid back unsized, the card was
   * divided equally between the columns, and the next drag froze the tick
   * gutter at a seventh of the table — which then drew as a bare gap to the
   * left of the first real column, on every visit, with no seam to pull it
   * back and nothing in the UI to reset it. The owner reported the gap.
   * Declaration-only is what makes that state unrepresentable.
   */
  fixed?: boolean
  /**
   * The empty column at the end that takes whatever room is left over.
   *
   * The owner's instruction, overruling how this was done before: *"On column
   * resizing, it still snaps the right most column back to the edge and
   * expands it to fill space. Instead, another empty column should appear to
   * the right of it to fill space."*
   *
   * Every earlier answer handed the surplus to a REAL column — first the one
   * the screen declared flexible, then the last one that was not being
   * dragged — and both mean the same thing to somebody sizing a table: a
   * column they did not touch changes width, and the one they did touch may
   * spring back. A column that holds nothing can absorb without lying, so the
   * grid gains one and every real column keeps exactly the width it was
   * given.
   *
   * It is a real column, not a CSS trick, because the alternatives all fail
   * somewhere visible: the header has to be opaque and sticky across it, the
   * row hairlines and the group bands' fill have to run through it, and a
   * table cell is what already does all three.
   *
   * It is never stored, never seamed, never fitted, and never counted when
   * asking whether the grid is pinned — it is furniture, not a column.
   */
  filler?: boolean
}

type Stored = Record<string, number>

/** Prefix on every key this system writes to `localStorage`. Set it to your
 *  own product's name: two systems sharing an origin must not share keys. */
export const NAMESPACE = 'ppc'

const storeKey = (table: string) => `${NAMESPACE}.colw.${table}`

/** Storage throws outright in a private window; a lost width is not worth a blank screen. */
function load(table: string, cols: ColDef[]): Stored {
  try {
    const raw = localStorage.getItem(storeKey(table))
    if (!raw) return {}
    const v: unknown = JSON.parse(raw)
    if (!v || typeof v !== 'object') return {}
    const out: Stored = {}
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
      /* A fixed column or the filler never holds a stored width — no seam
         reaches either, so any entry under their ids is a faulty build's
         measurement, not a person's drag. Earlier builds wrote them (one froze
         the tick gutter at a seventh of the card, which drew as a permanent
         bare gap left of the first real column), so they are dropped on read:
         the store heals itself the first time this code sees it. A column not
         in `cols` is kept — it may be hidden, and hiding must not forget. */
      const col = cols.find((c) => c.id === k)
      if (col && (col.fixed || col.filler)) continue
      // Sanitised, not floored: MIN_COL is the floor a drag enforces; a value
      // an old build stored below it still reads back as itself.
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[k] = n
    }
    return out
  } catch {
    return {}
  }
}

function save(table: string, v: Stored) {
  try {
    localStorage.setItem(storeKey(table), JSON.stringify(v))
  } catch {
    /* a full or blocked store costs the memory of a width, and nothing else */
  }
}

/**
 * The widest thing in a column, in pixels — what "fit to content" fits to.
 *
 * Neither of the obvious readings works. `getBoundingClientRect` on the cell
 * reports the column, because under `table-layout: fixed` the cell's box IS
 * the column — the number we are trying to replace. And a `Range` over the
 * cell's contents reports the column too, on the header row: the header now
 * holds a `<Seam>`, absolutely positioned at the cell's right edge, so the
 * range's union rect runs from the label's left to the seam's right. That one
 * is worse than useless, because it fails by returning something plausible —
 * double-clicking a name column grew it from 540px to 556px instead of fitting it.
 *
 * So the range is taken over the cell's real contents and the seam left out of
 * it. `overflow: hidden` clips painting, not layout, so clipped text still
 * lays out at its full width and a range measures it exactly — no narrowing
 * the column and reading `scrollWidth` back, which double-counts the cell's
 * padding and left 35px of slack on a column asked to fit.
 */
function contentWidth(table: HTMLTableElement, index: number): number {
  let widest = 0
  for (const row of table.querySelectorAll('tr')) {
    // A band row or the bulk bar spans the table; one cell across seven
    // columns says nothing about how wide column three should be.
    if (row.cells.length <= index || row.cells[index].colSpan > 1) continue
    const cell = row.cells[index]

    let left = Infinity
    let right = -Infinity
    for (const node of cell.childNodes) {
      if (node instanceof HTMLElement && node.classList.contains('rd-seamgrip')) continue
      const range = document.createRange()
      range.selectNode(node)
      const box = range.getBoundingClientRect()
      range.detach()
      if (box.width === 0) continue
      left = Math.min(left, box.left)
      right = Math.max(right, box.right)
    }
    if (right <= left) continue

    const style = getComputedStyle(cell)
    const pad = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
    widest = Math.max(widest, right - left + pad)
  }
  return widest
}

export interface SeamHandlers {
  onMouseDown: (e: React.MouseEvent) => void
  onDoubleClick: (e: React.MouseEvent) => void
}

export function useColWidths(table: string, cols: ColDef[]) {
  const [stored, setStored] = useState<Stored>(() => load(table, cols))
  // `commit` runs from a mouseup listener that closed over the render the drag
  // started in; reading the map through a ref keeps it from merging onto a
  // stale one.
  const storedRef = useRef(stored)
  storedRef.current = stored
  /*
   * Every table sharing this grid, in the order they mounted.
   *
   * Usually one. On the two-row group-header screens it is TWO — Canada draws
   * two kinds of transaction as separate cards over the
   * same columns, and ruling 19 excluded those screens precisely because "their
   * cards must stay aligned to each other". The owner overruled the exclusion,
   * not the reason: so the cards share one stored grid and one drag, and a
   * seam pulled on either moves both. Aligning them is no longer something the
   * screen has to be careful about — it is the only thing this can do.
   *
   * A `Set` keyed by the element, so React's mount/unmount order and a
   * re-render that swaps a node cannot leave a stale table being painted.
   */
  const tables = useRef(new Set<HTMLTableElement>())
  const tableRef = useCallback((el: HTMLTableElement | null) => {
    if (el) tables.current.add(el)
    // React calls the cleanup with null on unmount; without pruning, a table
    // from a card the screen has since dropped keeps being written to.
    else for (const t of [...tables.current]) if (!t.isConnected) tables.current.delete(t)
  }, [])
  /** The one the grid is MEASURED from — whichever is on screen first. */
  const firstTable = () => {
    for (const t of tables.current) if (t.isConnected) return t
    return null
  }
  const frame = useRef<number | null>(null)

  // Nothing prunes a width whose column is not currently in `cols`, and that
  // is deliberate: ruling 19 makes resizing independent of the show/hide
  // picker, so a hidden column keeps its width for when it comes back. An
  // earlier draft dropped any id it could not see, which on the Log — the one
  // table with a picker — meant hiding a column silently forgot how wide
  // someone had made it. A stale key costs a few bytes; the alternative costs
  // the ruling.

  useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current)
    },
    [],
  )

  /* The filler is furniture: it holds nothing, stores nothing, and is never
     part of the arithmetic. Everything below asks about the REAL columns —
     and a FIXED column always draws its declaration, so pinning asks only
     about the columns a drag can actually have sized. */
  const real = cols.filter((c) => !c.filler)
  /* A fixed column's contribution to the table's floor is its declared width.
     The cell padding the colgroup adds on top is not knowable here, and does
     not need to be: under `table-layout: fixed` the table grows to the sum of
     its columns regardless, so `minWidth` a few pixels shy is still a floor. */
  const declared = (w: ColSpec): number =>
    typeof w === 'number' ? w : w == null ? 0 : 'px' in w ? w.px : w.w
  const total = real.reduce(
    (sum, c) => sum + (c.fixed ? declared(c.w) : (stored[c.id] ?? 0)),
    0,
  )
  // Only once every column is pinned does an explicit table width mean
  // anything: with one column still flexible, the sum is not the table.
  const pinned = real.every((c) => c.fixed || c.id in stored)

  /**
   * Which column takes up the slack when the widths add up to LESS than the
   * card — the FILLER, always, and nothing else.
   *
   * Drag the columns inwards and their sum falls below the scrollport. Pinned
   * to that sum the table simply stopped there, and everything a table paints
   * — the row hairlines, the group bands' fill — stopped with it, leaving a
   * band of bare card down the right.
   *
   * Two answers to that have been tried and both were reported: handing the
   * surplus to the column the screen declared flexible (which is the identity
   * column, and the one people drag, so it sprang back under the hand that
   * narrowed it), and handing it to the last column that was not being dragged
   * (which fattens a date column to 400px for reasons its reader cannot see).
   * The owner's instruction is the third answer and the right one: an empty
   * column appears to the right and takes it. A column that holds nothing can
   * absorb without lying.
   *
   * A table with no filler declared keeps the old behaviour of stopping where
   * its columns stop — there is nothing to absorb with, and inventing one
   * would change a grid the screen never asked to change.
   */
  const slackAt = cols.findIndex((c) => c.filler)

  /*
   * The slack column is left UNSIZED, which makes the arithmetic work in both
   * directions without measuring anything:
   *
   *   - wider than the card — `min-width` wins, the table is `total`, and the
   *     unsized column gets `total` less the others, which IS its stored width.
   *   - narrower — the table is 100%, and the unsized column gets the rest.
   *
   * So a dragged width is honoured exactly while the table overflows, and the
   * card is filled when it does not.
   */
  /*
   * The filler appears when somebody has sized something, and not before.
   *
   * Unsized it would be a second auto column beside the identity column the
   * concept leaves undeclared, and the two would SHARE the surplus half each
   * — which is not the drawing and not what anybody asked for. Until the grid
   * is pinned there is nothing to complain about anyway: no column has been
   * resized, so nothing can spring back, and the table should look exactly as
   * it was drawn. Collapsed to zero it takes no room and paints nothing.
   *
   * Once pinned, every real column carries the width it was given and the
   * filler is the only thing left that can absorb — which is the owner's
   * instruction, applied at the moment it starts to mean something.
   */
  const widths: ColSpec[] = cols.map((c) =>
    c.filler
      ? pinned
        ? null
        : { px: 0 }
      : c.fixed
        ? c.w
        : c.id in stored
          ? { px: stored[c.id] }
          : c.w,
  )

  /**
   * What every column draws at right now, or null if no row spans the grid.
   *
   * The header's last row is the usual answer and the wrong one on a two-row
   * group header: the identity columns sit in the FIRST row under `rowSpan=2`,
   * so `thead tr:last-child` holds only the grouped columns and the count
   * never matches. This returned null there, which is why those screens
   * appeared not to resize rather than resizing wrongly — a silent no-op, and
   * the reason it took an owner report to find.
   *
   * So: the first row anywhere in the table with one cell per column and no
   * spanning cell. On a plain table that is still the header; on a grouped one
   * it is the first body row, whose cells are one-per-column by construction.
   */
  const measure = useCallback((): number[] | null => {
    const el = firstTable()
    if (!el) return null
    for (const row of el.rows) {
      const cells = [...row.cells]
      if (cells.length !== cols.length) continue
      if (cells.some((c) => c.colSpan > 1 || c.rowSpan > 1)) continue
      return cells.map((c) => c.getBoundingClientRect().width)
    }
    return null
  }, [cols.length])

  const commit = useCallback(
    (px: number[]) => {
      // Merged onto what is already stored, not built fresh: `cols` is the
      // VISIBLE set, and a map rebuilt from it would drop a hidden column's
      // width — the same fault as pruning, arriving by the other door.
      const next: Stored = { ...storedRef.current }
      cols.forEach((c, i) => {
        // A fixed column and the filler are never stored: no seam reaches
        // them, so a stored width could only ever be a measurement — and a
        // measurement taken while the grid was faulty becomes a fault that
        // outlives every fix, because nothing in the UI can put it back.
        if (c.fixed || c.filler) return
        next[c.id] = Math.max(MIN_COL, Math.round(px[i]))
      })
      storedRef.current = next
      setStored(next)
      save(table, next)
    },
    [cols, table],
  )

  const seam = useCallback(
    (index: number): SeamHandlers | null => {
      // Ruling 19: no seam on the last column — nothing to its right to resize.
      if (index >= cols.length - 1) return null
      if (cols[index]?.fixed) return null

      const start = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const frozen = measure()
        if (!frozen) return

        /* Every table on this grid, not just the one the seam was in: two
           cards sharing a column set have to move together, or the drag that
           was meant to line them up is the thing that breaks the alignment. */
        const grids = [...tables.current]
          .filter((t) => t.isConnected)
          .map((t) => ({ el: t, colEls: [...t.querySelectorAll('colgroup > col')] as HTMLElement[] }))
          .filter((g) => g.colEls.length === frozen.length)
        if (!grids.length) return
        for (const g of grids) {
          g.colEls.forEach((c, i) => {
            c.style.width = `${frozen[i]}px`
          })
        }
        const sum = frozen.reduce((a, b) => a + b, 0)
        for (const g of grids) {
          g.el.style.width = `${sum}px`
          g.el.style.minWidth = `${sum}px`
        }

        const x0 = e.clientX
        const w0 = frozen[index]
        const live = [...frozen]
        document.body.classList.add('rd-resizing')

        let pending = w0
        const paint = () => {
          frame.current = null
          const w = sum - w0 + pending
          for (const g of grids) {
            g.colEls[index].style.width = `${pending}px`
            g.el.style.width = `${w}px`
            g.el.style.minWidth = `${w}px`
          }
          live[index] = pending
        }

        const move = (ev: MouseEvent) => {
          pending = Math.max(MIN_COL, Math.round(w0 + (ev.clientX - x0)))
          if (frame.current == null) frame.current = requestAnimationFrame(paint)
        }
        const up = () => {
          window.removeEventListener('mousemove', move)
          window.removeEventListener('mouseup', up)
          if (frame.current != null) {
            cancelAnimationFrame(frame.current)
            frame.current = null
          }
          paint()
          document.body.classList.remove('rd-resizing')

          /*
           * Hand back ONLY what React will not overwrite for itself.
           *
           * The drag paints straight onto the element — one write a frame, no
           * render in the way, which is the whole point — and an inline style
           * React did not set is one React will not remove. So anything the
           * drag leaves behind that React's next render does not happen to
           * change stays there for ever.
           *
           * The two that matter:
           *
           *   - the TABLE, whose pinned width is a floor React recomputes from
           *     the new total, so it would be rewritten anyway; cleared for
           *     safety.
           *   - the SLACK column, which React renders with no width at all.
           *     "No width" is not a change React can apply over an inline one,
           *     so without this the column keeps the pixel width the drag gave
           *     it and stops absorbing.
           *
           * Every other column is left alone, and that is the fix rather than
           * an omission: clearing them all made React skip the ones whose
           * width had not changed — it believed they were already set — so the
           * whole grid came back UNSIZED and `table-layout: fixed` divided the
           * card equally between them. Drag one column to 56px and the other
           * six all became 212. That is what "behaving very oddly" was.
           */
          /* The filler goes back to absorbing. React renders it with no width
             at all, and "no width" is not a change React can apply over an
             inline one — so a filler still carrying the pixel width the drag
             froze onto it would never absorb again, and the table would stop
             wherever the drag left it. Cleared by hand, because only this code
             knows the drag put it there. */
          for (const g of grids) {
            g.el.style.width = ''
            g.el.style.minWidth = ''
            if (slackAt !== -1 && g.colEls[slackAt]) g.colEls[slackAt].style.width = ''
          }

          commit(live)
        }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
      }

      const fit = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const frozen = measure()
        if (!frozen) return
        /* Fit to the widest content across EVERY table on the grid. Fitting to
           one card would clip the other, which is the same alignment fault the
           drag above avoids, arriving through the double-click. */
        const widest = [...tables.current]
          .filter((t) => t.isConnected)
          .reduce((n, t) => Math.max(n, contentWidth(t, index)), 0)
        if (!widest) return
        const next = [...frozen]
        next[index] = Math.max(MIN_COL, Math.round(widest + 4))
        /* A fitted column is a width somebody set, exactly as a dragged one
           is — and the filler absorbs whatever it gives up, so a fitted column
           keeps the width its content asked for instead of springing back to
           the card's edge. */
        commit(next)
      }

      return { onMouseDown: start, onDoubleClick: fit }
    },
    [cols, measure, commit, slackAt],
  )

  /**
   * The same seam, asked for by column id.
   *
   * For a header with a conditional cell — Emails drops Phase when the table
   * is already grouped by phase — where every index after it shifts. An index
   * that is one out is silent: the seam draws, it drags, and it sizes the
   * wrong column. An unknown id returns no seam rather than guessing.
   */
  const seamOf = useCallback(
    (id: string) => {
      const i = cols.findIndex((c) => c.id === id)
      return i === -1 ? null : seam(i)
    },
    [cols, seam],
  )

  return {
    tableRef,
    widths,
    seam,
    seamOf,
    /**
     * A FLOOR once the grid is pinned, not a fixed width.
     *
     * `width: total` made the table stop wherever the columns stopped, so
     * dragging them inwards left dead card to the right of the last one. A
     * floor keeps the overflow behaviour — the table still grows past the card
     * and scrolls — while 100% keeps it filling the card when it does not, and
     * the filler column is what the surplus goes into.
     */
    style: pinned ? { width: '100%', minWidth: total } : undefined,
    /** Whether this grid has a filler at all — the screens render its cell. */
    hasFiller: slackAt !== -1,
  }
}
