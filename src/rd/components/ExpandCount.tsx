/**
 * A count in a table cell that opens to show what it is made of.
 *
 * The table vocabulary's rule: an expandable count gets a grey pill on the
 * row's hover and a small drawn chevron, and opens a floating popover headed
 * by the fact its lines are grouped under. The pill is drawn by hover rather
 * than sitting there, because a column of pills reads as a column of buttons.
 *
 * The room the chevron needs is reserved by the cell (`rd-un`), so nothing
 * shifts when it appears — a count that moves when you point at it is a count
 * you cannot aim at.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export interface PopLine {
  key: string
  name: string
  /** The line's own reference — a SKU, a code. Sits under the name, muted. */
  sub?: string
  qty: ReactNode
  /**
   * What opening this line does, where the line is a thing rather than a
   * quantity. A count of an order's calendars opens nothing — the lines ARE
   * the answer. A count of a person's agreements is a list of documents, and
   * the reason to open it is to reach one of them, so those lines take a
   * press. Given, the line is drawn as a button and shows a pointer; absent,
   * it is the plain row it has always been.
   */
  onOpen?: () => void
}

/** One panel of lines under the fact they are grouped by — a stock point. */
export interface PopGroup {
  key: string
  heading: string
  lines: PopLine[]
  /**
   * A worded total at the foot of the panel (ruling 23).
   *
   * Optional because it is only worth printing where the count in the cell is
   * a SUM of the lines. Where the lines are the thing and the count is how
   * many of them there are — an order's lines — a total would restate the
   * figure the reader just clicked.
   */
  total?: ReactNode
}

export default function ExpandCount({
  count,
  heading,
  lines,
  total,
  load,
}: {
  count: ReactNode
  /** What the lines are grouped under — "2026 order", "UK store". */
  heading?: string
  lines?: PopLine[]
  /** See `PopGroup.total`. */
  total?: ReactNode
  /**
   * Fetched when the count is opened, for lines the list does not carry.
   *
   * An order's lines are not in the orders response and putting them there
   * would be a page of lines for a popover opened one at a time. So the
   * request happens on the click, and the answer is kept for as long as the
   * row is on screen — opening the same count twice asks once.
   */
  load?: () => Promise<PopGroup[]>
}) {
  const [open, setOpen] = useState(false)
  const [got, setGot] = useState<PopGroup[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [up, setUp] = useState(false)
  const wrap = useRef<HTMLSpanElement>(null)
  const pop = useRef<HTMLDivElement>(null)

  /* Which way it opens is decided from where it landed, not guessed from the
     row's index: measured before the browser paints, so it never opens
     downwards and jumps.
     
     Measured against the SCROLLPORT where there is one, and the card
     otherwise. Both clip, and the scrollport is the tighter of the two — it
     ends above the card's foot — so a popover on a row near the bottom of a
     long table had its last line cut off by a sentence, while a check that
     asked the card agreed everything was fine. The nearest clipping box is the
     only one worth asking. */
  useLayoutEffect(() => {
    if (!open) {
      setUp(false)
      return
    }
    const box = pop.current?.getBoundingClientRect()
    const el = wrap.current?.closest('.rd-scroll') ?? wrap.current?.closest('.rd-card')
    const clip = el?.getBoundingClientRect()
    if (!box || !clip) return
    // Only flip if there is actually more room the other way — where neither
    // side fits, downwards at least starts in the right place.
    const anchor = wrap.current!.getBoundingClientRect()
    setUp(box.bottom > clip.bottom && anchor.top - clip.top > clip.bottom - anchor.bottom)
  }, [open, got, failed])

  /* One shape whether the lines were handed over or fetched: a single group
     headed by whatever the count is grouped under. */
  const groups: PopGroup[] | null =
    lines != null ? [{ key: 'only', heading: heading ?? '', lines, total }] : got

  useEffect(() => {
    if (!open || !load || got) return
    let live = true
    load()
      .then((g) => live && setGot(g))
      .catch((e: Error) => live && setFailed(e.message))
    return () => {
      live = false
    }
  }, [open, load, got])

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <span
      className={open ? 'rd-uc on' : 'rd-uc'}
      ref={wrap}
      role="button"
      aria-expanded={open}
      tabIndex={0}
      onClick={(e) => {
        // The row underneath opens a record; the count opens itself.
        e.stopPropagation()
        setOpen((v) => !v)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }
      }}
    >
      {count}
      <span className="rd-xarr" aria-hidden />
      {open && (
        <div
          className={up ? 'rd-pop rd-pop-up' : 'rd-pop'}
          ref={pop}
          onClick={(e) => e.stopPropagation()}
        >
          {failed ? (
            // A popover that cannot say what it is made of says so, rather
            // than opening empty and reading as an order with no lines.
            <div className="rd-popinner">
              <div className="rd-pophd">Could not read the lines</div>
              <div className="rd-popline">
                <div>
                  <div className="rd-popsub">{failed}</div>
                </div>
              </div>
            </div>
          ) : groups == null ? (
            <div className="rd-popinner">
              <div className="rd-pophd">Reading…</div>
            </div>
          ) : (
            groups.map((g) => (
              <div className="rd-popinner" key={g.key}>
                <div className="rd-pophd">{g.heading}</div>
                {g.lines.map((l) => {
                  const inner = (
                    <>
                      <div>
                        <div className="rd-popname">{l.name}</div>
                        {l.sub && <div className="rd-popsub">{l.sub}</div>}
                      </div>
                      <div className="rd-popqty">{l.qty}</div>
                    </>
                  )
                  return l.onOpen ? (
                    <button
                      type="button"
                      className="rd-popline rd-popline-go"
                      key={l.key}
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpen(false)
                        l.onOpen!()
                      }}
                    >
                      {inner}
                    </button>
                  ) : (
                    <div className="rd-popline" key={l.key}>
                      {inner}
                    </div>
                  )
                })}
                {g.total != null && (
                  <div className="rd-poptot">
                    <div>Total</div>
                    <div className="rd-popqty">{g.total}</div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </span>
  )
}
