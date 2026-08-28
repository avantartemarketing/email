/**
 * The view controls — Airtable's four, on the owner's ask.
 *
 * Fields · Filter · Group · Sort, over one field declaration per screen, so a
 * screen says what its columns ARE once and gets four controls from it.
 *
 * ## The one decision behind the shape
 *
 * Airtable puts the conditions behind a button and signals them with a count.
 * This app's own ruling on All payments says the opposite, in as many words:
 * *"With selects, a filter left on somewhere off to the right is invisible and
 * the count underneath it is a number nobody can account for."*
 *
 * **So it does both.** The button opens the dialogue and is the EDITOR; the
 * applied conditions still print as chips in the toolbar, each stating its own
 * subject ("Category · Storage & Couriers") and removable by its own ×. That
 * is Airtable's affordance without reversing a ruling that was paid for.
 *
 * ## What it will not offer
 *
 * The tick gutter, because that is how a selection is made; and any column a
 * screen declares as un-askable — Log's Status column carries the queue's
 * findings, and a list you can hide the warnings on is a list that stops
 * warning you. Both are existing rulings, and both survive by a field opting
 * out rather than by this component knowing about them.
 *
 * ## Where the menus come from
 *
 * `Menu.tsx`, which portals its panel. That is not a detail: an
 * absolutely-positioned panel inside a table is clipped by the scrollport, and
 * the audience picker on Schedule shipped invisible twice before that was
 * solved. Re-solving it here would be the third time.
 */
import { useState } from 'react'
import Menu, { type MenuItem } from './Menu'
import type { ReactNode } from 'react'
import {
  NEEDS_VALUE,
  OPS_FOR,
  chipLabel,
  optionsFor,
  type Condition,
  type Operator,
  type ViewField,
  type ViewState,
} from '../lib/view'

/** The chevron every menu chip wears, so they cannot be drawn differently. */
const Chev = () => <span className="rd-chev-chip" aria-hidden />

export interface ViewControlsProps<T> {
  fields: readonly ViewField<T>[]
  /** The rows BEFORE filtering — a filter menu offers what the table holds. */
  rows: readonly T[]
  state: ViewState
  onChange: (next: ViewState) => void
  /** Where the search field says what it is searching. */
  searchPlaceholder?: string
  /** Columns the screen can put away, if it has a Fields control at all. */
  fieldsMenu?: React.ReactNode
  /** The result count, right-aligned — "6 payments match". */
  count?: React.ReactNode
}

export default function ViewControls<T>({
  fields,
  rows,
  state,
  onChange,
  searchPlaceholder = 'Search',
  fieldsMenu,
  count,
}: ViewControlsProps<T>) {
  /* "+ Add filter" is a menu whose FIRST step chooses what the second step is
     about: pick a field, then pick its operator and value. `Menu` supports
     that by letting `onPick` return true to stay up. */
  const [adding, setAdding] = useState<string | null>(null)
  const [draft, setDraft] = useState<Condition | null>(null)
  /** True while the rarer conditions are being offered instead of the values. */
  const [ops, setOps] = useState(false)
  /** A condition whose value the SCREEN is drawing — a date's calendar. */
  const [editing, setEditing] = useState<Condition | null>(null)

  const set = (patch: Partial<ViewState>) => onChange({ ...state, ...patch })

  const groupable = fields.filter((f) => f.groupable ?? true)
  const sortable = fields.filter((f) => f.sortable ?? true)
  const filterable = fields.filter((f) => f.filterable ?? true)
  const grouped = fields.find((f) => f.id === state.group)

  const drop = (i: number) => set({ filters: state.filters.filter((_, n) => n !== i) })

  const commit = (c: Condition) => {
    set({ filters: [...state.filters, c] })
    setAdding(null)
    setDraft(null)
    setOps(false)
    setEditing(null)
  }

  return (
    <div className="rd-toolbar rd-viewbar">
      <label className="rd-search">
        <span aria-hidden>⌕</span>
        <input
          value={state.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
        />
      </label>

      {fieldsMenu}

      {groupable.length > 0 && (
        <Menu
          chipClass={`rd-chip rd-chip-sm rd-menu${state.group ? ' rd-chip-on' : ''}`}
          chip={
            <>
              Group{grouped ? ` · ${grouped.label}` : ''}
              <Chev />
            </>
          }
          heading="Group by"
          items={[
            { key: '', label: 'No grouping', on: !state.group },
            ...groupable.map((f): MenuItem => ({ key: f.id, label: f.label, on: f.id === state.group })),
          ]}
          onPick={(k) => set({ group: k })}
        />
      )}

      {sortable.length > 0 && (
        <Menu
          chipClass={`rd-chip rd-chip-sm rd-menu${state.sort.length ? ' rd-chip-on' : ''}`}
          chip={
            <>
              Sort{state.sort.length ? ` · ${sortLabel(fields, state)}` : ''}
              <Chev />
            </>
          }
          heading="Sort by"
          items={[
            /* The shipped order is a real state and can be returned to — the
               rule `WbSort` settled and no redesign screen had. */
            { key: '', label: 'The order it shipped in', on: !state.sort.length },
            ...sortable.flatMap((f): MenuItem[] => [
              { key: `${f.id}:asc`, label: `${f.label} ${f.kind === 'number' ? '(low to high)' : 'A → Z'}`, on: isSorted(state, f.id, 'asc') },
              { key: `${f.id}:desc`, label: `${f.label} ${f.kind === 'number' ? '(high to low)' : 'Z → A'}`, on: isSorted(state, f.id, 'desc') },
            ]),
          ]}
          onPick={(k) => {
            if (!k) return set({ sort: [] })
            const [field, dir] = k.split(':')
            set({ sort: [{ field, dir: dir === 'asc' ? 'asc' : 'desc' }] })
          }}
        />
      )}

      {/* One chip per live condition, in the order they were added, each saying
          its own subject so the row reads as what is on screen. */}
      {state.filters.map((c, i) => (
        <span key={`${c.field}-${c.op}-${i}`} className="rd-chip rd-chip-sm rd-filterchip">
          {chipLabel(fields, c)}
          <button
            type="button"
            className="rd-chip-x"
            aria-label={`Remove the ${fields.find((f) => f.id === c.field)?.label ?? c.field} filter`}
            onClick={() => drop(i)}
          >
            ×
          </button>
        </span>
      ))}

      {filterable.length > 0 && (
        <Menu
          chipClass="rd-chip rd-chip-sm rd-chip-add"
          chip="+ Add filter"
          open={adding !== null}
          setOpen={(v) => {
            setAdding(v ? '' : null)
            setDraft(null)
            setOps(false)
          }}
          heading={adding ? fields.find((f) => f.id === adding)?.label : undefined}
          items={stepItems(fields, rows, adding, draft, ops)}
          onPick={(k) => {
            /* Step one: which field. */
            if (!adding) {
              setAdding(k)
              /* A `choice` goes STRAIGHT to its values, with `is` assumed.
                 Making somebody pick "is" every time is the small tax that
                 stops people using a control — and `is` is what the two-step
                 flow this replaces always meant. The rarer conditions are one
                 more item down, not one more step up. */
              const f = fields.find((x) => x.id === k)
              if (f?.valueEditor) {
                /* A field that draws its own value step goes STRAIGHT to it,
                   asking for a range — a payment's date is nearly always asked
                   as one. The menu CLOSES and the editor opens in its place
                   rather than inside the panel: `.dpick` is anchored furniture
                   with its own stacking, and drawn inside the portal it lands
                   under the sticky table header, where its month arrows cannot
                   be clicked at all. */
                setAdding(null)
                setDraft(null)
                setEditing({ field: k, op: 'between' })
                return false
              }
              if (f?.kind === 'choice') {
                setDraft({ field: k, op: 'is' })
              }
              return true
            }
            /* "Other conditions…" — the way to `is not` and the empties. */
            if (k === OTHER) {
              setDraft(null)
              setOps(true)
              return true
            }
            if (!draft) {
              const op = k as Operator
              if (!NEEDS_VALUE(op)) {
                commit({ field: adding, op })
                return false
              }
              setDraft({ field: adding, op })
              setOps(false)
              return true
            }
            commit({ ...draft, value: k })
            return false
          }}
        >
          {/* Otherwise a text or date value is typed. The form is the menu's
              second step, so choosing an operator does not take the question
              away before it has been answered. */}
          {draft && !fields.find((f) => f.id === draft.field)?.valueEditor && needsTyping(fields, draft) && (
            <form
              className="rd-viewvalue"
              onSubmit={(e) => {
                e.preventDefault()
                const v = new FormData(e.currentTarget).get('v')
                if (typeof v === 'string' && v.trim()) commit({ ...draft, value: v.trim() })
              }}
            >
              <input
                name="v"
                autoFocus
                type={fields.find((f) => f.id === draft.field)?.kind === 'date' ? 'date' : 'text'}
                aria-label={`${fields.find((f) => f.id === draft.field)?.label} ${draft.op}`}
              />
              <button type="submit" className="rd-chip rd-chip-sm">
                Apply
              </button>
            </form>
          )}
        </Menu>
      )}

      {/* The screen's own value step — the payment dates' calendar. Anchored
          beside the chip row, which is where `.dpick` is built to sit, and
          drawn with the menu shut. */}
      {editing && (
        <span className="dpick-anchor">
          {drawnEditor(
            fields,
            editing,
            (c) => {
              commit(c)
              setEditing(null)
            },
            () => setEditing(null),
          ) as ReactNode}
        </span>
      )}

      {count != null && <span className="rd-viewcount">{count}</span>}
    </div>
  )
}

const isSorted = (s: ViewState, id: string, dir: string) => s.sort[0]?.field === id && s.sort[0]?.dir === dir

function sortLabel<T>(fields: readonly ViewField<T>[], s: ViewState): string {
  const top = s.sort[0]
  const f = fields.find((x) => x.id === top?.field)
  if (!f) return ''
  return `${f.label} ${top.dir === 'asc' ? '↑' : '↓'}`
}

/** The item whose pick swaps a value list for the rarer conditions. */
const OTHER = '~other'

/**
 * What the "+ Add filter" menu is showing right now.
 *
 * Step one is the fields. After that a `choice` shows its VALUES — `is` is
 * assumed, because it is what the approved two-step flow always meant and
 * making somebody choose it every time is a tax on the common case. Everything
 * else shows its operators, since "contains what?" cannot be answered from a
 * list. A field that draws its own value step, or takes a typed one, offers no
 * items at all — a date field listing every distinct date in the table is a
 * picker for a fact nobody asks that way.
 */
function stepItems<T>(
  fields: readonly ViewField<T>[],
  rows: readonly T[],
  adding: string | null,
  draft: Condition | null,
  ops: boolean,
): MenuItem[] {
  if (!adding) return fields.filter((f) => f.filterable ?? true).map((f) => ({ key: f.id, label: f.label }))
  const f = fields.find((x) => x.id === adding)
  if (!f) return []
  if (ops || (!draft && f.kind !== 'choice')) return OPS_FOR[f.kind].map((op) => ({ key: op, label: op }))
  if (!draft) return []
  if (f.valueEditor || needsTyping(fields, draft)) return []
  return [
    ...optionsFor(f, rows).map((o) => ({ key: o.key, label: o.label })),
    { key: OTHER, label: 'Other conditions…' },
  ]
}

/** The screen's own value step, where it has one. */
function drawnEditor<T>(
  fields: readonly ViewField<T>[],
  draft: Condition,
  commit: (c: Condition) => void,
  close: () => void,
): unknown {
  const f = fields.find((x) => x.id === draft.field)
  if (!f?.valueEditor) return null
  return f.valueEditor((value, value2) => commit({ ...draft, value, value2 }), close)
}

/** A `choice` is picked from a list; everything else is typed. */
function needsTyping<T>(fields: readonly ViewField<T>[], c: Condition): boolean {
  const f = fields.find((x) => x.id === c.field)
  return !!f && f.kind !== 'choice' && NEEDS_VALUE(c.op)
}
