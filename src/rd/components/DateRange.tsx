import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * A date range: presets as chips, and a Custom chip that opens a calendar.
 *
 * The owner asked for a custom date picker on two reporting screens;
 * the chips they had offered 12 weeks, 26 weeks and All and nothing else.
 *
 * **A calendar, not two `input[type=date]`s.** That is the design system's own
 * rule and it is worth restating: a pair of date fields makes somebody type a
 * date they have to know in advance, in a format they have to guess, with no
 * indication of which days have data behind them. A month you can see answers
 * all three — and the days outside the data are dimmed and refuse the click,
 * so a range that would come back empty cannot be chosen by accident.
 *
 * **The draft is held until Apply.** Picking a start date is not a range, and
 * a chart that redrew on the first click would flash a window nobody asked
 * for. Cancel leaves everything as it was, which is the promise a Cancel
 * beside an Apply makes.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const iso = (d: Date) => d.toISOString().slice(0, 10)
const monthStart = (s: string) => new Date(`${s.slice(0, 7)}-01T00:00:00Z`)
const shift = (d: Date, months: number) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1))

/** Every day drawn in a month's grid, Monday-first, including the padding. */
function grid(month: Date): Array<{ key: string; day: number | null; iso: string }> {
  const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))
  const lead = (first.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate()
  const out: Array<{ key: string; day: number | null; iso: string }> = []
  for (let i = 0; i < lead; i++) out.push({ key: `pad${i}`, day: null, iso: '' })
  for (let d = 1; d <= days; d++) {
    const at = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), d))
    out.push({ key: iso(at), day: d, iso: iso(at) })
  }
  return out
}

export interface Preset {
  key: string
  label: string
}

export default function DateRange({
  presets,
  value,
  custom,
  bounds,
  onPreset,
  onCustom,
}: {
  presets: Preset[]
  /** Which preset is chosen, or 'custom'. */
  value: string
  /** The custom window, when there is one. */
  custom: { from: string; to: string }
  /** The first and last day there is data for. Outside it, days are dimmed. */
  bounds: { from: string; to: string }
  onPreset: (key: string) => void
  onCustom: (range: { from: string; to: string }) => void
}) {
  const [open, setOpen] = useState(false)
  /* Held apart from what is applied, so Cancel really does leave things as
     they were and a half-picked range never reaches the chart. */
  const [draft, setDraft] = useState<{ from: string; to: string }>({ from: '', to: '' })
  const [month, setMonth] = useState(() => monthStart(custom.to || bounds.to || iso(new Date())))
  const wrap = useRef<HTMLDivElement>(null)

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

  const cells = useMemo(() => grid(month), [month])
  const within = (d: string) => (!bounds.from || d >= bounds.from) && (!bounds.to || d <= bounds.to)

  /* A range is picked in two clicks. The second one before the first is not an
     error — somebody scanning backwards through a month picks the later day
     first — so the pair is ordered rather than refused. */
  const pick = (d: string) => {
    if (!draft.from || draft.to) return setDraft({ from: d, to: '' })
    setDraft(d < draft.from ? { from: d, to: draft.from } : { from: draft.from, to: d })
  }

  const ready = Boolean(draft.from && draft.to)
  const shown = draft.to ? draft : custom
  const label = custom.from && custom.to ? `${dayShort(custom.from)} – ${dayShort(custom.to)}` : 'Custom…'

  return (
    /* `.rd-chips` only. It wore `.rd-daterange` as well, which is a DIFFERENT
       thing wearing a similar name — the Emails screen's two From/To fields,
       a flex row whose rule puts `flex: 1` on every child. Borrowed here it
       forced all four chips to one width, so "26 weeks" and "All" measured the
       same and the selected chip's tick overflowed its own box by 9px. Two
       different things sharing one class name, which is the collision this
       codebase keeps paying for. */
    <span className="rd-chips" ref={wrap}>
      {presets.map((p) => (
        <button
          key={p.key}
          className={value === p.key ? 'rd-chip on' : 'rd-chip'}
          onClick={() => onPreset(p.key)}
        >
          {p.label}
          {value === p.key && <span className="rd-tick">✓</span>}
        </button>
      ))}
      <button
        className={value === 'custom' ? 'rd-chip on' : 'rd-chip'}
        aria-expanded={open}
        onClick={() => {
          setDraft(custom.from && custom.to ? custom : { from: '', to: '' })
          setMonth(monthStart(custom.to || bounds.to || iso(new Date())))
          setOpen((o) => !o)
        }}
      >
        {label}
        {value === 'custom' && <span className="rd-tick">✓</span>}
      </button>

      {open && (
        <div className="rd-dpick" role="dialog" aria-label="Choose a date range">
          <div className="rd-dpick-head">
            <button
              className="rd-dpick-arrow"
              aria-label="Previous month"
              onClick={() => setMonth((m) => shift(m, -1))}
            >
              ‹
            </button>
            <span>
              {MONTHS[month.getUTCMonth()]} {month.getUTCFullYear()}
            </span>
            <button
              className="rd-dpick-arrow"
              aria-label="Next month"
              onClick={() => setMonth((m) => shift(m, 1))}
            >
              ›
            </button>
          </div>
          <div className="rd-dpick-days">
            {DAYS.map((d, i) => (
              <span key={i} className="rd-dpick-dow">
                {d}
              </span>
            ))}
            {cells.map((c) =>
              c.day == null ? (
                <span key={c.key} />
              ) : (
                <button
                  key={c.key}
                  className={cls(c.iso, shown, within(c.iso))}
                  disabled={!within(c.iso)}
                  onClick={() => pick(c.iso)}
                >
                  {c.day}
                </button>
              ),
            )}
          </div>
          <div className="rd-dpick-foot">
            <span className="rd-aside">
              {draft.from && !draft.to
                ? `From ${dayShort(draft.from)} — pick the end`
                : ready
                  ? `${dayShort(draft.from)} – ${dayShort(draft.to)}`
                  : 'Pick a start and an end'}
            </span>
            <div style={{ flex: 1 }} />
            <button className="rd-chip" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              className="rd-btn-pri"
              disabled={!ready}
              onClick={() => {
                onCustom(draft)
                setOpen(false)
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </span>
  )
}

/** The span filled between its ends, so a range reads as one thing. */
function cls(day: string, range: { from: string; to: string }, ok: boolean): string {
  const out = ['rd-dpick-day']
  if (!ok) out.push('rd-dpick-out')
  if (range.from && day === range.from) out.push('rd-dpick-end')
  if (range.to && day === range.to) out.push('rd-dpick-end')
  if (range.from && range.to && day > range.from && day < range.to) out.push('rd-dpick-in')
  return out.join(' ')
}

const dayShort = (s: string): string =>
  new Date(`${s}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
