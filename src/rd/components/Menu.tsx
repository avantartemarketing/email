/**
 * A chip that opens a floating menu, and closes when you click away.
 *
 * Ruling 8 calls this "the standard floating menu" and gives it the dialogue
 * shadow and a 12px radius; ruling 5 gives its items 6px. It is the one
 * interaction the redesign's toolbar is built from — group by, add filter, and
 * each filter's own values are all this.
 *
 * The panel is a PORTAL, positioned from the chip's own rectangle. It began
 * as an absolutely-positioned child of the chip's wrapper, which is fine in a
 * toolbar and silently broken in a table: a scrollport clips its overflow, so
 * a menu opened from a row rendered its full height with every item behind
 * the clip — the owner opened the audience picker on Schedule and saw the
 * search box and nothing else, twice. A DOM check cannot catch that (the
 * items exist; they are just invisible), which is why prove-motion now asks
 * `elementFromPoint` whether an item's centre pixel really is the item.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { STAGGER_MS, STAGGER_STEPS } from '../lib/motion'

export interface MenuItem {
  key: string
  label: string
  /** Reads as the current answer: heavier and darker, not just tinted. */
  on?: boolean
}

/**
 * 88d's stagger, as a custom property the stylesheet's own animation reads.
 *
 * The DELAY is written from here and the animation is not: trap 1 says a
 * property a class animates must never be inline, and an inline
 * `animation-delay` is not that property — the class still owns `animation`,
 * this only tells it when to start. Written as a custom property rather than
 * as `animationDelay` for the same reason one step removed: it keeps every
 * part of the animation shorthand in the stylesheet, where the next person
 * looking for it will look.
 */
export const stagger = (i: number) =>
  ({ '--rd-stagger': `${Math.min(i, STAGGER_STEPS) * STAGGER_MS}ms` }) as React.CSSProperties

export default function Menu({
  chip,
  chipClass = 'rd-chip rd-chip-sm',
  heading,
  items,
  onPick,
  open,
  setOpen,
  children,
  search,
  emptySays,
}: {
  chip: ReactNode
  chipClass?: string
  heading?: string
  items: MenuItem[]
  /** Return true to keep the menu up — a menu whose first step chooses what
      the second step is about, like "+ Add filter". */
  onPick: (key: string) => boolean | void
  /** Controlled where a caller runs two menus in sequence; local otherwise. */
  open?: boolean
  setOpen?: (v: boolean) => void
  /**
   * A second step, below the items — a menu whose choice opens a form rather
   * than closing. The date range's Custom does this: the first step picks the
   * kind of window and the second IS the window, so closing on the first would
   * ask for a range and then take the form away.
   */
  children?: ReactNode
  /**
   * A filter over the items, ABOVE them — for a menu whose list is longer
   * than a glance. `children` cannot serve: it renders last, and a search you
   * reach after scrolling past what you were trying to skip is not a search.
   * The caller does the filtering, because only the caller knows what a match
   * means (an audience matches on its name, not on its recipient count).
   */
  search?: { value: string; onChange: (v: string) => void; placeholder?: string }
  /** Said when the filter leaves nothing — an empty menu explains itself. */
  emptySays?: string
}) {
  const [ownOpen, setOwnOpen] = useState(false)
  const isOpen = open ?? ownOpen
  const set = setOpen ?? setOwnOpen
  const wrap = useRef<HTMLSpanElement>(null)
  const float = useRef<HTMLDivElement>(null)
  /* Where the panel goes, in viewport coordinates — null until measured, so
     the portal never paints a frame at 0,0. */
  const [at, setAt] = useState<{ top: number; left: number } | null>(null)

  /* Under the chip, and never off the screen: measured before paint, and
     re-measured while anything scrolls or resizes, because a fixed-position
     panel does not ride along with the table its chip is in. The clamp reads
     the panel's real height (it varies with items) rather than assuming the
     stylesheet's max. */
  useLayoutEffect(() => {
    if (!isOpen) return
    const place = () => {
      const anchor = wrap.current?.getBoundingClientRect()
      if (!anchor) return
      const h = float.current?.getBoundingClientRect().height ?? 0
      const w = float.current?.getBoundingClientRect().width ?? 0
      setAt({
        top: Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - h - 8)),
        left: Math.max(8, Math.min(anchor.left, window.innerWidth - w - 8)),
      })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      setAt(null)
    }
  }, [isOpen, items.length])

  // Clicking anywhere else puts it away. Without this a menu left open sits
  // over the table and the row underneath cannot be reached. The panel is a
  // portal, so "else" is anywhere in neither the chip nor the panel.
  useEffect(() => {
    if (!isOpen) return
    const away = (e: MouseEvent) => {
      const t = e.target as Node
      if (!wrap.current?.contains(t) && !float.current?.contains(t)) set(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && set(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [isOpen, set])

  return (
    <span className="rd-menuwrap" ref={wrap}>
      <button type="button" className={chipClass} aria-expanded={isOpen} onClick={() => set(!isOpen)}>
        {chip}
      </button>
      {isOpen &&
        createPortal(
          <div
            className="rd-float rd-float-fixed"
            role="menu"
            ref={float}
            /* The unmeasured frame never paints: the layout effect above sets
               the real position synchronously, before the browser draws. It
               must not be `visibility: hidden` while it waits — a hidden
               input refuses focus, so the search box's autoFocus landed
               nowhere and typing fell on the CHIP, where the first space
               closed the menu. */
            style={at ? { top: at.top, left: at.left } : { top: 0, left: 0 }}
          >
          {heading && <div className="rd-floathd" style={stagger(0)}>{heading}</div>}
          {search && (
            <div className="rd-floatfind" style={stagger(heading ? 1 : 0)}>
              <input
                autoFocus
                type="search"
                value={search.value}
                placeholder={search.placeholder ?? 'Search'}
                aria-label={search.placeholder ?? 'Search'}
                onChange={(e) => search.onChange(e.target.value)}
                /* The menu closes on Escape; inside a search box that is the
                   one key people press to clear what they typed, so it clears
                   first and only closes the menu when there is nothing left. */
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && search.value) {
                    e.stopPropagation()
                    search.onChange('')
                  }
                }}
              />
            </div>
          )}
          {items.length === 0 && emptySays && (
            <div className="rd-floatnone" style={stagger(heading || search ? 1 : 0)}>{emptySays}</div>
          )}
          {items.map((it, i) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              style={stagger(i + (heading ? 1 : 0))}
              className={it.on ? 'on' : undefined}
              onClick={() => {
                if (onPick(it.key) !== true) set(false)
              }}
            >
              {it.label}
            </button>
          ))}
          {/* A second step, if there is one, arrives after every item — it is
              the thing you reach LAST, and the stagger is what says so. */}
          {children ? (
            <div style={stagger(items.length + (heading ? 1 : 0))}>{children}</div>
          ) : null}
          </div>,
          document.body,
        )}
    </span>
  )
}
