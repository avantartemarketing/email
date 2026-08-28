/**
 * Where a table's view is remembered.
 *
 * Two places, and the pair is the point:
 *
 * - **Per person, in localStorage**, as density and column widths already are.
 *   A fact about one person's screen, never data, so it never goes near the
 *   server. It is what makes a table you come back to the table you left.
 * - **In the query string**, which is the addition. This is a team of three to
 *   five who send each other screens, and a filtered table that cannot be
 *   pasted to somebody is a filtered table they have to rebuild from a
 *   description. Airtable's answer to the same problem is a saved, shared,
 *   named view; this is the cheap half of it, and the state shape is a plain
 *   object so the other half can be added later without a migration.
 *
 * **A pasted link wins on load.** It is an explicit instruction from a person;
 * a remembered preference is not. So the URL is read first and only falls
 * through to storage when it says nothing.
 *
 * The URL is rewritten with `replaceState` rather than pushed. Typing into the
 * search field is not five history entries, and a Back button that walks
 * letter by letter out of a search is worse than one that leaves the screen.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { EMPTY_VIEW, decodeView, encodeView, storageKey, type ViewState } from '../lib/view'

const read = (key: string): ViewState | null => {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? 'null') as ViewState | null
    if (!raw || typeof raw !== 'object') return null
    return {
      search: typeof raw.search === 'string' ? raw.search : '',
      group: typeof raw.group === 'string' ? raw.group : '',
      sort: Array.isArray(raw.sort) ? raw.sort : [],
      filters: Array.isArray(raw.filters) ? raw.filters : [],
    }
  } catch {
    /* A corrupt preference is the shipped order, not a broken screen. */
    return null
  }
}

const write = (key: string, v: ViewState) => {
  try {
    if (!encodeView(v)) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* Not remembering a view is a smaller failure than not applying one. */
  }
}

/**
 * @param table   Where the view is remembered. Stable per table, never per
 *                screen — two tables on one screen are remembered apart.
 * @param initial The view the screen SHIPS with, which is a real state: All
 *                payments opens grouped by country and can be returned to it.
 *                A remembered or pasted view beats it; nothing else does.
 */
export function useView(
  table: string,
  initial: Partial<ViewState> = {},
): [ViewState, (next: ViewState) => void] {
  const key = storageKey(table)
  const [state, setState] = useState<ViewState>(() => {
    const shipped = { ...EMPTY_VIEW, ...initial }
    if (typeof window === 'undefined') return shipped
    return decodeView(window.location.search.replace(/^\?/, '')) ?? read(key) ?? shipped
  })

  /* The screen's own query params — `shell=redesign` and anything else — are
     not ours to drop when the view changes. Held once, on mount. */
  const others = useRef<string>('')
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    for (const k of ['q', 'g', 's', 'f']) p.delete(k)
    others.current = p.toString()
  }, [])

  const set = useCallback(
    (next: ViewState) => {
      setState(next)
      write(key, next)
      try {
        const mine = encodeView(next)
        const qs = [others.current, mine].filter(Boolean).join('&')
        window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
      } catch {
        /* A view that cannot be linked still applies. */
      }
    },
    [key],
  )

  return [state, set]
}
