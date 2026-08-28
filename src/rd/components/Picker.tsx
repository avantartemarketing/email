/**
 * A field you pick from rather than type into.
 *
 * Both shapes are a `Field` with something else inside its value slot, not a
 * lookalike built beside it: a thing you pick and a thing you type sit in the
 * same column of the same form, so they share one lockup, one empty state and
 * one focus ring. The label still floats, the box still stays the height it
 * was — everything `44b` settled applies without being restated here.
 *
 * Two shapes, because a short list and a long one are different questions.
 * A closed handful — published or draft, the platform a record belongs to
 * — opens the admin's own floating menu; a long list — every country that can
 * take a shipment — filters as you type, so nobody hunts for the Netherlands
 * in an alphabetised forty.
 *
 * The short one WAS a native `<select>`, on the reasoning that a phone's
 * system wheel beats anything drawn here. The owner reported what that costs
 * on a desktop: the field is ours and the list that drops out of it is the
 * operating system's, in the middle of a screen where every other menu is
 * `.rd-float`. So it is drawn, from the same panel the toolbar's menus use —
 * one menu vocabulary, and the trade taken deliberately the other way.
 *
 * The searchable one commits a CODE and shows a NAME. What is typed is a
 * filter and never the value, so the field cannot come to hold "Nethrlands"
 * and everything downstream — the derived fields, the upstream draft's
 * countryCode — can trust what it gets.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Field from './Field'
import { stagger } from './Menu'

export interface Option {
  /** What is stored. */
  value: string
  /** What is read. */
  label: string
}

/** One caret for both shapes: drawn, 10px, never a glyph (ruling 14). */
function Caret() {
  return (
    <svg className="rd-pickcaret" width="10" height="10" viewBox="0 0 10 10" aria-hidden focusable="false">
      <path
        d="M2 3.5 5 6.5 8 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}


/**
 * Which way a list should drop, and how tall it may be.
 *
 * A picker's list is absolutely positioned inside its field, and a field
 * often sits inside something that scrolls — a dialogue's body, a page's
 * card. `overflow: auto` clips absolutely positioned descendants, so a list
 * that opens downward from the LAST field in a scrolling box is rendered
 * exactly where the box stops painting: present in the DOM, 44 rows tall,
 * and completely invisible. That is the Country field in a record
 * record, and it is the whole reason this hook exists.
 *
 * So: find the nearest ancestor that clips, measure the room either side of
 * the field within it, and drop toward the room. The list is capped to what
 * is actually there, which means it can always be seen even when neither
 * side is generous.
 */
const GAP = 4
const MARGIN = 8
const TALLEST = 260

const clipper = (el: HTMLElement | null): HTMLElement | null => {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const o = getComputedStyle(p)
    if (/(auto|scroll|hidden)/.test(`${o.overflowY}${o.overflowX}`)) return p
  }
  return null
}

function useDropSide(open: boolean, wrap: React.RefObject<HTMLDivElement | null>) {
  const [side, setSide] = useState<{ up: boolean; maxH: number }>({ up: false, maxH: TALLEST })
  useEffect(() => {
    if (!open) return
    const measure = () => {
      const el = wrap.current
      if (!el) return
      const box = el.getBoundingClientRect()
      const clip = clipper(el)
      const top = clip ? clip.getBoundingClientRect().top : 0
      const bottom = clip ? clip.getBoundingClientRect().bottom : window.innerHeight
      const below = bottom - box.bottom - GAP - MARGIN
      const above = box.top - top - GAP - MARGIN
      /* Downward unless upward genuinely has more room: a list that flips
         about while the page scrolls is worse than a slightly short one. */
      const up = below < Math.min(TALLEST, above) && above > below
      setSide({ up, maxH: Math.max(80, Math.min(TALLEST, up ? above : below)) })
    }
    measure()
    /* The room changes as the container scrolls under the open list. */
    const clip = clipper(wrap.current)
    clip?.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      clip?.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [open, wrap])
  return side
}

/** The short, closed list. */
export function SelectField({
  label,
  value,
  options,
  onChange,
  width,
  mark,
  placeholder = 'Choose…',
}: {
  label: string
  value: string
  options: Option[]
  onChange: (v: string) => void
  width?: number
  /**
   * A mark that belongs to the ANSWER, drawn before it — an editor's
   * published/draft dot. In the value slot rather than on the label's line
   * (where `Field.mark` puts a flag), because this one qualifies the word it
   * sits beside and is read with it. It never carries the state alone: the
   * word is always there too.
   */
  mark?: React.ReactNode
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  /* Which row the keyboard is on. Opening puts it on the answer, so Enter
     twice is a no-op rather than a silent change to the first row. */
  const [cursor, setCursor] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const drop = useDropSide(open, wrap)
  const chosen = options.find((o) => o.value === value)
  /* The field is a <label>, so naming the button here makes the WHOLE field
     the press — the label's word, the caret, the padding either side. A
     button is labelable, and the browser forwards one synthetic click to it;
     a press landing on the button itself is not forwarded again, so there is
     no double toggle to guard against. */
  const id = useId()

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  const show = () => {
    setCursor(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }
  const take = (o: Option) => {
    onChange(o.value)
    setOpen(false)
  }

  return (
    <div className="rd-pickwrap" ref={wrap} style={width == null ? undefined : { width, flex: 'none' }}>
      <Field label={label} value={chosen?.label ?? ''} controlId={id}>
        {mark}
        <button
          id={id}
          type="button"
          className="rd-pickbtn"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => (open ? setOpen(false) : show())}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              return
            }
            if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
              e.preventDefault()
              show()
              return
            }
            if (!open) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setCursor((c) => Math.min(c + 1, options.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setCursor((c) => Math.max(c - 1, 0))
            } else if (e.key === 'Home') {
              e.preventDefault()
              setCursor(0)
            } else if (e.key === 'End') {
              e.preventDefault()
              setCursor(options.length - 1)
            } else if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              if (options[cursor]) take(options[cursor])
            }
          }}
        >
          {chosen ? chosen.label : <span className="rd-mut">{placeholder}</span>}
        </button>
        <Caret />
      </Field>
      {open && (
        <div
          className={drop.up ? 'rd-float rd-pickmenu rd-pickup' : 'rd-float rd-pickmenu'}
          style={{ maxHeight: drop.maxH }}
          role="listbox"
        >
          {options.map((o, i) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              style={stagger(i)}
              className={[o.value === value ? 'on' : '', i === cursor ? 'rd-floatcursor' : '']
                .filter(Boolean)
                .join(' ')}
              onMouseEnter={() => setCursor(i)}
              onMouseDown={(e) => {
                /* Taken on mousedown: the button's blur fires first and would
                   close the list out from under the pointer. */
                e.preventDefault()
                take(o)
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * The long list: type to filter, click or Enter to commit.
 *
 * The closing rules are each one a picker somewhere gets wrong. Clicking away
 * reverts to the committed value rather than leaving a half-typed filter in
 * the box; Escape does the same; Enter takes the highlighted row, and takes
 * nothing when nothing matches. The rows are bound on `mousedown`, not click,
 * because the input's blur fires first and would close the list out from
 * under the pointer.
 */
export function SearchPicker({
  label,
  value,
  options,
  onChange,
  width,
  placeholder = 'Search…',
}: {
  label: string
  value: string
  options: Option[]
  onChange: (v: string) => void
  width?: number
  placeholder?: string
}) {
  const chosen = options.find((o) => o.value === value)
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const id = useId()
  const [cursor, setCursor] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const drop = useDropSide(open, box)

  const shown = useMemo(() => {
    const n = typed.trim().toLowerCase()
    if (!n) return options
    /* Three ranks, and the first one matters: typing a CODE puts that country
       first. "de" contains-matches Denmark and code-matches Germany, and a
       plain prefix rule offers Denmark — so someone typing the code they know
       gets the country they did not mean. Then prefix, then contained. */
    const rank = (o: Option) =>
      o.value.toLowerCase() === n ? 0 : o.label.toLowerCase().startsWith(n) ? 1 : 2
    return options
      .filter((o) => o.label.toLowerCase().includes(n) || o.value.toLowerCase() === n)
      .sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label))
  }, [options, typed])

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) {
        setOpen(false)
        setTyped('')
      }
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  const take = (o: Option) => {
    onChange(o.value)
    setOpen(false)
    setTyped('')
  }

  return (
    <div className="rd-pickwrap" ref={box} style={width == null ? undefined : { width, flex: 'none' }}>
      {/* Named, so the label's word and the caret reach the input — the field
          opens the list wherever it is pressed, not only on the value. */}
      <Field label={label} value={chosen?.label ?? ''} controlId={id}>
        <input
          id={id}
          className="rd-pickinput"
          value={open ? typed : (chosen?.label ?? '')}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          onFocus={() => {
            setOpen(true)
            setCursor(0)
          }}
          onChange={(e) => {
            setTyped(e.target.value)
            setOpen(true)
            setCursor(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setCursor((c) => Math.min(c + 1, shown.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setCursor((c) => Math.max(c - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              if (shown[cursor]) take(shown[cursor])
            } else if (e.key === 'Escape') {
              setOpen(false)
              setTyped('')
            }
          }}
        />
        <Caret />
      </Field>
      {open && (
        <div
          className={drop.up ? 'rd-picklist rd-pickup' : 'rd-picklist'}
          style={{ maxHeight: drop.maxH }}
          role="listbox"
        >
          {shown.map((o, i) => (
            <div
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={i === cursor ? 'rd-pickrow rd-pickrow-on' : 'rd-pickrow'}
              onMouseEnter={() => setCursor(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                take(o)
              }}
            >
              <span>{o.label}</span>
              <span className="rd-pickcode">{o.value}</span>
            </div>
          ))}
          {!shown.length && <div className="rd-pickrow rd-mut">No match</div>}
        </div>
      )}
    </div>
  )
}
