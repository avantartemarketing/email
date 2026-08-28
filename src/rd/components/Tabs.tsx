/**
 * A tab strip — ruling 96.
 *
 * The redesign had never ruled a tab. Three near-relatives had grown up in the
 * gap instead: `.rd-ltab` (the language strip, underlined), `.scentab`
 * (Workbench's scenario strip, "underlined not boxed") and `.rd-seg`, which is
 * a segmented toggle and is NOT a tab — it changes a value while the screen
 * stays the screen, where a tab changes what is on screen. `.rd-seg` is
 * untouched by this.
 *
 * **The open tab is an object; the rest are text.** An underline marks the open
 * tab by taking something away — every tab is the same thing and one of them
 * has a line under it, which reads at a glance only because the eye has learned
 * where the line goes. A lozenge marks it by making it a different KIND of
 * thing, and the shape is then the answer with nothing to scan.
 *
 * Two rules the shape rests on, both of which the reference itself breaks:
 *
 * - **One mark, not two.** The reference draws a lozenge AND an underline under
 *   it. Two marks for one fact is what ruling 14 dropped the band gap for and
 *   what the scenario strip says the record in WORDS to avoid. The underline
 *   survives in one role only, `capped`: a full-width hairline where the strip
 *   is the top edge of the surface it switches. That says "the content starts
 *   here", not "this tab is open", so it runs the whole strip.
 * - **Icons belong to the STRIP, not the tab.** In the reference only the open
 *   tab carries one, and an icon that appears on selection reflows the row —
 *   the tabs move under the pointer at the moment of the click, which is the
 *   fault the scenario strip already forbids ("the strip does not reorder under
 *   the pointer"). That is why `icon` is a prop of this component and not of a
 *   tab: by construction either every tab has one or none does, and there is no
 *   call site that can get it half right.
 *
 * The same reasoning is why the CSS gives EVERY tab the lozenge's box — its
 * padding and a 1px transparent border — and changes only the ground and the
 * edge's colour on `on`. A border that appears on selection is 2px of width
 * arriving under the pointer.
 */
import type { ReactNode } from 'react'

export interface TabDef<K extends string = string> {
  key: K
  /** What the tab is called. Read by anyone who cannot see the mark. */
  label: string
  /**
   * A mark the strip defines — the language strip's completeness dot, a
   * scenario's `.tagst`. ruling 96 lets a tab carry one; it rides at the same
   * offset open or shut, so it does not move either.
   */
  mark?: ReactNode
  /** The hover title, where the mark needs saying in words. */
  title?: string
}

export default function Tabs<K extends string>({
  tabs,
  value,
  onPick,
  icon,
  capped = false,
  label,
}: {
  tabs: readonly TabDef<K>[]
  /** The open tab's key. */
  value: K
  onPick: (key: K) => void
  /**
   * The strip's icon, drawn on every tab or on none — never on the open one
   * alone. See the note above: this is a prop of the strip on purpose.
   */
  icon?: (tab: TabDef<K>) => ReactNode
  /**
   * The strip is the top edge of the surface it switches, so it carries a
   * full-width hairline. Not a second mark on the open tab.
   */
  capped?: boolean
  /** Names the strip for a screen reader — "Language", "Scenario". */
  label?: string
}) {
  /* Arrow keys walk the strip, which is what a tablist is expected to do and
     what three hand-rolled copies of this never had. */
  const step = (from: number, by: number) => {
    const next = (from + by + tabs.length) % tabs.length
    onPick(tabs[next].key)
  }

  return (
    <div className={capped ? 'rd-tabs rd-tabs-capped' : 'rd-tabs'} role="tablist" aria-label={label}>
      {tabs.map((t, i) => {
        const on = t.key === value
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            className={on ? 'rd-tab on' : 'rd-tab'}
            title={t.title}
            onClick={() => onPick(t.key)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                e.preventDefault()
                step(i, 1)
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault()
                step(i, -1)
              }
            }}
          >
            {icon?.(t)}
            {t.mark}
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
