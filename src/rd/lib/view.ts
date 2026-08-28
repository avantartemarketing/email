/**
 * Filter, group and sort — one mechanism, for every table in the redesign.
 *
 * Twenty-seven of the thirty-five redesign screens draw a table. Before this,
 * **two** offered a search field, **four** let you choose a grouping, **one**
 * had filters at all, and **none** of them sorted: `WbSort.tsx`'s settled
 * rules — a column sorts the way its figures read, empty sorts last in both
 * directions, remainder rows hold the foot, the shipped order is a real state
 * you can get back to — were used by one incumbent screen and no redesign one.
 * Rate data had twenty lines of its own with none of those rules.
 *
 * So this is not "standardise the four controls we have". Two of them barely
 * existed. It follows Airtable's model, on the owner's ask.
 *
 * ## The shape
 *
 * **A screen declares its fields once** — id, label, type, how to read the
 * value — and all four controls are derived from that one list. A field that
 * cannot be sorted, grouped or filtered says so by opting out, which is how a
 * screen states that a column is not a fact you can ask questions of. That is
 * why Log's Status column and every tick gutter stay out: a list you can hide
 * the warnings on is a list that stops warning you.
 *
 * ## Why it is here and not in a component
 *
 * `lib/payments/ledger.ts` already does exactly this for one screen, and it
 * lives in `lib/` for a reason worth repeating: the incumbent All payments and
 * the redesign's `33b` both read it, so the two screens cannot answer the same
 * question differently. Pure functions over plain data are also testable
 * without a table — which is where the rules below are actually pinned.
 *
 * ## Three rules inherited from `WbSort`, because they were right
 *
 * - **The shipped order is a real state, not the absence of one.** Sorting
 *   starts there and can be returned to; a table that cannot get back to the
 *   order it shipped with has lost something.
 * - **A column sorts the way its figures read.** A count starts at its
 *   biggest, a name at A. Making someone press twice for the obvious reading
 *   is the sort of small tax that stops people using it.
 * - **Empty is empty.** A row with nothing in the sorted column goes last in
 *   BOTH directions. Nought would put it top of an ascending count and the
 *   empty string top of A–Z, and it is neither: it is a row that does not have
 *   the thing being sorted on. `admits` treats it the same way — an invoice
 *   with no due date is not due in August.
 */

export type FieldKind = 'text' | 'number' | 'date' | 'choice'

/** What a row can be read as. `null`/`undefined`/`''` all mean empty. */
export type Cell = string | number | null | undefined

export interface ViewField<T> {
  id: string
  /** What the control calls it. The column's own heading, so they agree. */
  label: string
  kind: FieldKind
  /** How to read this field off a row. */
  value: (row: T) => Cell
  /**
   * A `choice` field's values, in the order they should be offered. Derived
   * from the rows where the screen has no fixed vocabulary, given explicitly
   * where it has one — a status table, a country list. Countries list alphabetically by
   * code everywhere, so a screen passing that list passes it as it comes.
   */
  options?: (rows: T[]) => Array<{ key: string; label: string }>
  /** What a band says this grouping IS — `STATUS`, `COUNTRY`. Ruling 14. */
  caption?: string
  /**
   * The order this field's values are listed in — bands AND the filter menu.
   * A status table reads most urgent first, which is neither alphabetical nor
   * by size, and a screen that has one vocabulary must not offer two orders.
   */
  order?: readonly string[]
  /**
   * Bands biggest-first. The ledger's order and the one the concept draws;
   * insertion breaks the tie, so two groups of the same size stay in the sort's
   * own order and are still predictable. Ignored where `order` is declared.
   */
  groupsBySize?: boolean
  /** How a group's value prints, where the raw key is not what to show. */
  groupLabel?: (key: string, rows: T[]) => string
  /** Opt-outs. A column absent from a control is a column that is not a fact. */
  sortable?: boolean
  groupable?: boolean
  filterable?: boolean
  /** Included in the search field's sweep. Text fields, by default. */
  searchable?: boolean
  /**
   * A value step the screen draws itself, replacing the menu's list or its
   * typed box. The three payment dates use it to open a CALENDAR: a range is
   * drawn, days outside the data dimmed and unclickable, never two
   * `input[type=date]`s. Without it, generalising the filter row would have
   * quietly traded a drawn range for two typed conditions.
   */
  valueEditor?: (commit: (value: string, value2?: string) => void, close: () => void) => unknown
}

export const OPERATORS = [
  'is',
  'is not',
  'contains',
  'is empty',
  'is not empty',
  'before',
  'after',
  'between',
] as const
export type Operator = (typeof OPERATORS)[number]

/**
 * What a field type can be ASKED. Deliberately short, and `and` only — no
 * `or`, no nesting — until somebody asks for more. Every filter in the ledger
 * today is an equality plus three date spans, and nothing in the app has yet
 * needed a disjunction.
 */
export const OPS_FOR: Record<FieldKind, readonly Operator[]> = {
  text: ['is', 'is not', 'contains', 'is empty', 'is not empty'],
  choice: ['is', 'is not', 'is empty', 'is not empty'],
  number: ['is', 'is not', 'before', 'after', 'is empty', 'is not empty'],
  /* `between` first, because a date is nearly always asked as a range and a
     range is DRAWN — never two date inputs. A screen supplies the calendar
     through `valueEditor`; `prove-datefilter` holds that rule. */
  date: ['between', 'is', 'before', 'after', 'is empty', 'is not empty'],
}

/** An operator that asks about presence takes no value. */
export const NEEDS_VALUE = (op: Operator) => op !== 'is empty' && op !== 'is not empty'

export interface Condition {
  field: string
  op: Operator
  value?: string
  /** The far end of a `between`. Both ends inclusive. */
  value2?: string
}

export type SortDir = 'asc' | 'desc'

export interface ViewState {
  search: string
  filters: Condition[]
  /** '' is the order the screen shipped with — a real state. */
  group: string
  sort: Array<{ field: string; dir: SortDir }>
}

export const EMPTY_VIEW: ViewState = { search: '', filters: [], group: '', sort: [] }

const isEmpty = (v: Cell) => v === null || v === undefined || v === ''
const text = (v: Cell) => String(v ?? '').toLowerCase()

/** A field's first press: a figure reads biggest-first, a name reads A-first. */
export const firstDir = (kind: FieldKind): SortDir => (kind === 'text' || kind === 'choice' ? 'asc' : 'desc')

/**
 * What a press on a header does: the column's own reading, then its reverse,
 * then back to the order the table shipped with. Pure, so the three-state
 * cycle is testable without a table — `WbSort.nextSort`'s rule, kept.
 */
export function nextSort(sort: ViewState['sort'], id: string, kind: FieldKind): ViewState['sort'] {
  const first = firstDir(kind)
  const top = sort[0]
  if (!top || top.field !== id) return [{ field: id, dir: first }]
  if (top.dir === first) return [{ field: id, dir: first === 'asc' ? 'desc' : 'asc' }]
  return []
}

/** Does this row survive one condition? */
export function admitsOne<T>(row: T, f: ViewField<T>, c: Condition): boolean {
  const v = f.value(row)
  if (c.op === 'is empty') return isEmpty(v)
  if (c.op === 'is not empty') return !isEmpty(v)
  const want = c.value ?? ''
  if (want === '') return true
  /* Empty is empty: a row with nothing in this field does not match a value
     being asked for, in either direction. An invoice with no due date is not
     due in August, and sweeping the undated into every range would make the
     count a number nobody can act on. */
  if (isEmpty(v)) return false
  switch (c.op) {
    case 'is':
      return f.kind === 'number' ? Number(v) === Number(want) : text(v) === want.toLowerCase()
    case 'is not':
      return f.kind === 'number' ? Number(v) !== Number(want) : text(v) !== want.toLowerCase()
    case 'contains':
      return text(v).includes(want.toLowerCase())
    /* Dates are `YYYY-MM-DD`, so a string compare IS a date compare and needs
       no parsing. Numbers compare as numbers. */
    case 'before':
      return f.kind === 'number' ? Number(v) < Number(want) : String(v) < want
    case 'after':
      return f.kind === 'number' ? Number(v) > Number(want) : String(v) > want
    /* Both ends inclusive. Dates are `YYYY-MM-DD`, so this is a string compare
       and needs no parsing — the same reason `inSpan` never parsed either. */
    case 'between':
      return f.kind === 'number'
        ? Number(v) >= Number(want) && Number(v) <= Number(c.value2 ?? want)
        : String(v) >= want && String(v) <= (c.value2 ?? want)
    default:
      return true
  }
}

/** Does this row survive every condition, and the search? */
export function admits<T>(row: T, fields: readonly ViewField<T>[], state: ViewState): boolean {
  for (const c of state.filters) {
    const f = fields.find((x) => x.id === c.field)
    if (f && !admitsOne(row, f, c)) return false
  }
  const q = state.search.trim().toLowerCase()
  if (!q) return true
  return fields
    .filter((f) => f.searchable ?? (f.kind === 'text' || f.kind === 'choice'))
    .some((f) => text(f.value(row)).includes(q))
}

/**
 * The ordering, with the three rules above. `last` pins remainder rows to the
 * foot — "Country not recorded", "Rest of world", a total band — because those
 * are what is left after the rows rather than rows that did badly.
 */
export function orderBy<T>(
  rows: T[],
  fields: readonly ViewField<T>[],
  sort: ViewState['sort'],
  last?: (row: T) => boolean,
): T[] {
  if (!sort.length) return rows
  const keep = last ? rows.filter(last) : []
  const move = last ? rows.filter((r) => !last(r)) : rows
  /* The SHIPPED order breaks every tie — not the array's accidental order
     after the remainder split. A tie broken by luck makes a table flicker
     between two orders as its figures update. */
  const at = new Map(move.map((r, i) => [r, i]))
  const out = [...move].sort((a, b) => {
    for (const s of sort) {
      const f = fields.find((x) => x.id === s.field)
      if (!f) continue
      const av = f.value(a)
      const bv = f.value(b)
      const ae = isEmpty(av)
      const be = isEmpty(bv)
      if (ae || be) {
        if (ae && be) continue
        return ae ? 1 : -1
      }
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'en')
      if (cmp) return cmp * (s.dir === 'asc' ? 1 : -1)
    }
    return (at.get(a) ?? 0) - (at.get(b) ?? 0)
  })
  return [...out, ...keep]
}

export interface ViewGroup<T> {
  key: string
  label: string
  rows: T[]
}

/**
 * Rows gathered into bands. Ruling 14's band prints a caption naming WHAT the
 * grouping is over the value it took, and **no counts** — Airtable prints
 * them, we do not, ruled twice.
 *
 * Groups come out in the order their first row appears, which for a sorted
 * table is the sort's own order and is therefore predictable without being
 * learned. An empty group is absent rather than printed empty.
 */
export function groupRows<T>(rows: T[], f: ViewField<T> | undefined): ViewGroup<T>[] {
  if (!f) return [{ key: '', label: '', rows }]
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const v = f.value(r)
    const key = isEmpty(v) ? '' : String(v)
    const list = map.get(key)
    if (list) list.push(r)
    else map.set(key, [r])
  }
  const entries = [...map.entries()]
  /* Insertion order is the sort's order, so it is the tie-break for both of
     the orderings below and the default where a screen declares neither. */
  const at = new Map(entries.map(([k], i) => [k, i]))
  if (f.order) {
    const rank = (k: string) => {
      const i = f.order!.indexOf(k)
      return i < 0 ? f.order!.length : i
    }
    entries.sort((a, b) => rank(a[0]) - rank(b[0]) || (at.get(a[0]) ?? 0) - (at.get(b[0]) ?? 0))
  } else if (f.groupsBySize) {
    entries.sort((a, b) => b[1].length - a[1].length || (at.get(a[0]) ?? 0) - (at.get(b[0]) ?? 0))
  }
  const out = entries.map(([key, rs]) => ({
    key,
    label: f.groupLabel ? f.groupLabel(key, rs) : key,
    rows: rs,
  }))
  /* The band for rows that have no value sits last, for the same reason a
     remainder row does: it is what is left over rather than a group that did
     badly. Its label is the field's own word for absence, never a blank band. */
  const none = out.findIndex((g) => g.key === '')
  if (none >= 0) {
    const [g] = out.splice(none, 1)
    out.push({ ...g, label: g.label || `No ${f.label.toLowerCase()}` })
  }
  return out
}

/** Everything at once: filter, then sort, then gather. */
export function applyView<T>(
  rows: readonly T[],
  fields: readonly ViewField<T>[],
  state: ViewState,
  last?: (row: T) => boolean,
): { rows: T[]; groups: ViewGroup<T>[] } {
  const kept = rows.filter((r) => admits(r, fields, state))
  const ordered = orderBy(kept, fields, state.sort, last)
  const by = fields.find((f) => f.id === state.group)
  return { rows: ordered, groups: groupRows(ordered, by) }
}

/**
 * The values a `choice` field can take, for the filter's second step. Derived
 * from the rows where the screen gave no list — so the menu only ever offers a
 * value some row actually has, and a filter can never come back empty for a
 * reason nobody can see.
 */
export function optionsFor<T>(f: ViewField<T>, rows: readonly T[]): Array<{ key: string; label: string }> {
  if (f.options) return f.options([...rows])
  const seen = new Map<string, string>()
  for (const r of rows) {
    const v = f.value(r)
    if (isEmpty(v)) continue
    const k = String(v)
    if (!seen.has(k)) seen.set(k, f.groupLabel ? f.groupLabel(k, []) : k)
  }
  const out = [...seen.entries()].map(([key, label]) => ({ key, label }))
  /* One vocabulary per screen: where a field declares its order, the menu
     offers it in that order and the bands print it in that order. Two orders
     for one list is the fault the ledger's status table was written to fix. */
  if (f.order) {
    const rank = (k: string) => {
      const i = f.order!.indexOf(k)
      return i < 0 ? f.order!.length : i
    }
    return out.sort((a, b) => rank(a.key) - rank(b.key))
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'en'))
}

/** A chip states its own subject: "Category · Storage & Couriers". */
export function chipLabel<T>(fields: readonly ViewField<T>[], c: Condition): string {
  const f = fields.find((x) => x.id === c.field)
  const name = f?.label ?? c.field
  /* A filter that names a RECORD holds its id and must show its name. The
     chip is the state of the screen, so "Category · c2" is a chip that says
     nothing — the exact fault the chip row exists to prevent. `groupLabel` is
     the field's own id-to-name map and needs no rows to answer. */
  const shown = (v: string | undefined) => (v === undefined ? '' : (f?.groupLabel?.(v, []) ?? v))
  if (!NEEDS_VALUE(c.op)) return `${name} · ${c.op}`
  if (c.op === 'between') return `${name} · ${shown(c.value)} – ${shown(c.value2 ?? c.value)}`
  if (c.op === 'is') return `${name} · ${shown(c.value)}`
  return `${name} ${c.op} ${shown(c.value)}`
}

/* ---- where the state is remembered --------------------------------------
   Per person in localStorage, as density and column widths already are: a fact
   about one person's screen, never data, so it never goes near the server.

   AND in the query string, which is the addition. This is a team of three to
   five who send each other screens, and a filtered table that cannot be pasted
   to somebody is a filtered table they have to rebuild by description. The URL
   wins on load where it has something to say, because a pasted link is an
   explicit instruction and a remembered preference is not. */

/** Prefix on every key this system writes to `localStorage`. Set it to your
 *  own product's name: two systems sharing an origin must not share keys. */
export const NAMESPACE = 'ppc'

export const storageKey = (table: string) => `${NAMESPACE}.table.${table}.view`

export function encodeView(v: ViewState): string {
  const parts: string[] = []
  if (v.search) parts.push(`q=${encodeURIComponent(v.search)}`)
  if (v.group) parts.push(`g=${encodeURIComponent(v.group)}`)
  if (v.sort.length) parts.push(`s=${v.sort.map((s) => `${s.field}:${s.dir}`).join(',')}`)
  for (const f of v.filters)
    parts.push(`f=${encodeURIComponent([f.field, f.op, f.value ?? '', f.value2 ?? ''].join('~'))}`)
  return parts.join('&')
}

export function decodeView(qs: string): ViewState | null {
  if (!qs) return null
  const p = new URLSearchParams(qs)
  if (!p.has('q') && !p.has('g') && !p.has('s') && !p.has('f')) return null
  const sort = (p.get('s') ?? '')
    .split(',')
    .filter(Boolean)
    .map((s) => {
      const [field, dir] = s.split(':')
      return { field, dir: dir === 'asc' ? ('asc' as const) : ('desc' as const) }
    })
  const filters = p.getAll('f').map((raw) => {
    const [field, op, value, value2] = raw.split('~')
    return value2 ? { field, op: op as Operator, value, value2 } : { field, op: op as Operator, value }
  })
  return { search: p.get('q') ?? '', group: p.get('g') ?? '', sort, filters }
}
