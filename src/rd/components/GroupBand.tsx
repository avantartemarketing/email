/**
 * The band that heads a group of rows — ruling 14, Airtable's shape.
 *
 * Every grouped table in the system draws this — every record list,
 * All payments, Vendors and the email list. It was six near-copies before,
 * which is how one band came to have a chevron drawn on it and no
 * handler behind it — it looked collapsible for months and never was, and the
 * owner reported it.
 *
 * Ruling 14, in its own terms:
 *
 * - **50px, on `--rd-band`, hairlined top AND bottom.** The bottom rule is
 *   what separates one group from the next; there is no gap between groups.
 *   The first draft of the ruling asked for 12px of white air and the amended
 *   one takes it away, because two rules and a gap say the same thing twice.
 * - **Two lines.** A tracked-caps caption naming WHAT the grouping is —
 *   `STATUS`, `PHASE`, `MONTH` — over the value it took. The caption is why the
 *   value can be bare: with "STATUS" above it, "Reserved" needs no sentence.
 * - **The band's lozenge is bigger than a row's** — 24px at 12.5px against the
 *   17px/11px of a body row — because a band is a heading. A heading at body
 *   size is a row that happens to be grey.
 * - **A drawn chevron**, 10px, 1px stroke: an SVG path, never a rotated border
 *   and never a glyph. Both of those read chunky at every size Design tried.
 * - **No counts.** Airtable prints them; we do not. Ruled twice now.
 *
 * An empty group is absent rather than printed empty — that is the caller's
 * job, since only it knows what the groups are.
 */
import { useRef, type ReactNode, type TdHTMLAttributes } from 'react'
import useStickyBand from './useStickyBands'

/** The chevron, drawn. A rotated border reads chunky and a glyph is a font. */
export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={open ? 'rd-bandchev' : 'rd-bandchev rd-bandchev-shut'}
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden
      focusable="false"
    >
      <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function GroupBand({
  columns,
  caption,
  children,
  open = true,
  onToggle,
  ...rest
}: {
  /** How many columns to span — the whole grid, whatever the table's is. */
  columns: number
  /** What the grouping IS: STATUS, PHASE, MONTH. Printed in tracked caps. */
  caption: string
  /** The value the group took — a status pill, a category tag, or plain text. */
  children: ReactNode
  open?: boolean
  /** Absent on a table whose groups do not fold. The chevron goes with it. */
  onToggle?: () => void
  /** `data-*` for a harness that needs to fold one named band. */
  [attr: `data-${string}`]: string | undefined
}) {
  /* `89h`: the band holds its place under the header while its own rows go
     past, and is pushed out by the next group's. Registered here rather than
     by each screen, so a table gets the behaviour by drawing a band. */
  const cell = useRef<HTMLTableCellElement>(null)
  useStickyBand(cell)

  return (
    <tr className="rd-band" {...rest}>
      <td colSpan={columns} ref={cell}>
        {/* The whole band is the target, not the chevron: a 10px glyph is a
            hard thing to hit, and there is nothing else on the row to click. */}
        <div
          className="rd-bandwrap"
          role={onToggle ? 'button' : undefined}
          tabIndex={onToggle ? 0 : undefined}
          aria-expanded={onToggle ? open : undefined}
          onClick={onToggle}
          onKeyDown={(e) => {
            if (!onToggle) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggle()
            }
          }}
        >
          {onToggle && <Chevron open={open} />}
          <div className="rd-bandlines">
            <div className="rd-bandcap">{caption}</div>
            <div className="rd-bandval">{children}</div>
          </div>
        </div>
      </td>
    </tr>
  )
}

/**
 * The row that ends a group, and makes a record INSIDE it.
 *
 * Ruling 14: a new email added under `Black Friday` is a Black Friday email —
 * not one at the table's foot that then has to be filed. Optional, because it
 * is only meaningful where a group is a thing you can put a record into: you
 * can add an email to a phase, and you cannot add an order to "Cancelled".
 */
export function AddRow({
  columns,
  label,
  onAdd,
}: {
  columns: number
  /** What it makes — "New email". Read by anyone who cannot see the plus. */
  label: string
  onAdd: () => void
}) {
  return (
    <tr className="rd-addrow">
      <td colSpan={columns}>
        <button type="button" onClick={onAdd} aria-label={label} title={label}>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden focusable="false">
            <path d="M6 1.5v9M1.5 6h9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </td>
    </tr>
  )
}

/**
 * A band cell on a table that does not draw ruling 14's band — the Products
 * sheet's family rows, where the grouping is one line rather than a caption
 * over a value. Same behaviour and the same hook, so there is no second
 * implementation of `89h` to keep in step with this one.
 */
export function StickyBandCell({
  children,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
  const cell = useRef<HTMLTableCellElement>(null)
  useStickyBand(cell)
  return (
    <td ref={cell} {...rest}>
      {children}
    </td>
  )
}
