/**
 * `89h` — a group band pins under the header and hands over to the next one.
 *
 * The owner: *"Groupings on tables should be sticky like headers."* Design
 * asked for the same and it was deferred once: *"position:sticky under the
 * header; the next band pushes the current one out. The group you are inside
 * is always named, fifty rows down."*
 *
 * ## Why this is not `position: sticky` alone
 *
 * It is `position: sticky` — that part lives in the stylesheet. What CSS
 * cannot do is the HAND-OVER, and the difference is not cosmetic: it is the
 * whole behaviour.
 *
 * A sticky cell is clamped by its containing block, and for a table cell that
 * containing block is the TABLE, not its row group. Chromium was asked
 * directly rather than assumed — a band whose group had scrolled a thousand
 * pixels past was still parked under the header, and the next band arrived on
 * top of it. Both bands are 50px and opaque, so what a person saw was one band
 * sliced in half by another: `STATUS / Reserved` with its lozenge cut through
 * the middle by `STATUS / Invoiced`. Worse than no sticky at all.
 *
 * Two CSS answers were tried and measured before writing any of this:
 * `position: relative` on the tbody changes nothing (the clamp is still the
 * table), and `display: block` on the tbody DOES clamp it — and takes the
 * column grid apart, which is the same fault a stray `display: flex` on a
 * table row caused on the Targets sheet.
 *
 * So the clamp is computed. Per frame, per band:
 *
 *     top = min(headerHeight, groupBottom − portTop − bandHeight)
 *
 * While the group has more than a band's worth of itself left below the
 * header, the band sits AT the header. Once it has not, the band is pushed up
 * by exactly the shortfall and leaves as the next one arrives — which is what
 * a native sticky section header does, and what the ruling asks for.
 *
 * ## What it costs
 *
 * One rAF per scroll, one controller per scrollport however many bands it
 * holds, and every read taken before any write so a frame cannot thrash
 * layout. A band whose top has not changed is not written to at all: the
 * common case, scrolling inside one long group, touches the DOM zero times.
 */
import { useEffect, useRef, type RefObject } from 'react'

interface Port {
  /** The band cells registered against this scrollport. */
  cells: Set<HTMLTableCellElement>
  onScroll: () => void
  frame: number
}

const PORTS = new Map<HTMLElement, Port>()

/** The last value written to each cell, so an unchanged top writes nothing. */
const WRITTEN = new WeakMap<HTMLTableCellElement, number>()

function measure(port: HTMLElement): void {
  const entry = PORTS.get(port)
  if (!entry) return
  const portTop = port.getBoundingClientRect().top
  /* The header's own height rather than the token, so the two cannot drift
     and a table without a sticky header still lands its bands at 0. */
  const head = port.querySelector<HTMLElement>('thead th')
  const headH = head ? head.getBoundingClientRect().height : 0

  /* Every read first, then every write. Interleaving them makes each write
     invalidate the layout the next read needs, which is the classic way a
     scroll handler turns into a stall. */
  const plan: Array<[HTMLTableCellElement, number]> = []
  for (const cell of entry.cells) {
    const group = cell.closest('tbody')
    if (!group) continue
    const bandH = cell.getBoundingClientRect().height
    const bottom = group.getBoundingClientRect().bottom
    /* How far the band may sit from the top of the port. Never below the
       header; never so far down that it outlives its own group. */
    plan.push([cell, Math.min(headH, bottom - portTop - bandH)])
  }
  for (const [cell, top] of plan) {
    if (WRITTEN.get(cell) === top) continue
    WRITTEN.set(cell, top)
    cell.style.top = `${top}px`
  }
}

function join(port: HTMLElement, cell: HTMLTableCellElement): () => void {
  let entry = PORTS.get(port)
  if (!entry) {
    entry = {
      cells: new Set(),
      frame: 0,
      onScroll: () => {
        const e = PORTS.get(port)
        if (!e || e.frame) return
        e.frame = requestAnimationFrame(() => {
          e.frame = 0
          measure(port)
        })
      },
    }
    PORTS.set(port, entry)
    port.addEventListener('scroll', entry.onScroll, { passive: true })
    /* The window too: the port scrolls sideways and the PAGE scrolls down on a
       short window, and a band that only listened to its own port would drift
       off the header on the second. */
    window.addEventListener('scroll', entry.onScroll, { passive: true })
    window.addEventListener('resize', entry.onScroll, { passive: true })
  }
  entry.cells.add(cell)
  entry.onScroll()

  return () => {
    const e = PORTS.get(port)
    if (!e) return
    e.cells.delete(cell)
    WRITTEN.delete(cell)
    if (e.cells.size) return
    port.removeEventListener('scroll', e.onScroll)
    window.removeEventListener('scroll', e.onScroll)
    window.removeEventListener('resize', e.onScroll)
    if (e.frame) cancelAnimationFrame(e.frame)
    PORTS.delete(port)
  }
}

/**
 * Register one band cell. Called by `GroupBand`, so a screen gets the
 * behaviour by drawing a band rather than by remembering a hook.
 */
export default function useStickyBand(ref: RefObject<HTMLTableCellElement | null>): void {
  const port = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const cell = ref.current
    port.current = cell?.closest<HTMLElement>('.rd-scroll') ?? null
    if (!cell || !port.current) return
    return join(port.current, cell)
  }, [ref])

  /* No dependency array, deliberately. Groups are folded, filtered and
     re-sorted, and every one of those changes a group's height without
     anybody scrolling — so the tops are re-measured after each render of the
     band that owns them. It is cheap: one rAF, and a top that has not moved is
     not written at all.
     
     This was a ResizeObserver on the table first, and that is a trap worth
     recording. The observer fired, the frame wrote a `top`, and the write
     brought the observer round again — a loop that never settles, which does
     not look like a loop: the screen renders correctly and the page simply
     never goes quiet, so what fails is an unrelated harness waiting for the
     network to idle. */
  useEffect(() => {
    if (port.current) PORTS.get(port.current)?.onScroll()
  })
}

