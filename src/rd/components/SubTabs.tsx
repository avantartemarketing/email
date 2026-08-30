/**
 * The level below a tab strip — the one that picks WHICH of a destination you
 * are looking at.
 *
 * The owner, 29 Aug 2026: *"The batches is a tab and then the different
 * batches is a sub level within that."* A tab strip answers "where am I?"; this
 * answers "which one?", and the CSS note beside `.rd-subtabs` carries the
 * argument for why it is drawn the way it is. Three things in the markup are
 * worth saying here rather than there:
 *
 * - **The caption is required**, not optional. It is what makes the row a
 *   different KIND of control rather than a smaller copy of the one above it:
 *   no tab strip names the thing it is choosing between. A `SubTabs` with no
 *   caption is small tabs, which is the fault this component exists to fix.
 * - **The count is a separate node**, so it can step back in weight. Baked into
 *   the label it would be at the name's weight, and "Framed 2 6" reads as one
 *   number the way "2 8 collectors" did on the approvals band.
 * - **Arrow keys walk it**, as they do the tab strip. It is a `tablist` to a
 *   screen reader for the same reason it looks like one to an eye: it switches
 *   what is under it.
 */
import type { ReactElement } from 'react'

export interface SubTabDef<K extends string = string> {
  key: K
  label: string
  /** Drawn after the label, one step back — a row count, a collector count. */
  n?: number
}

export default function SubTabs<K extends string>({
  caption,
  tabs,
  value,
  onPick,
}: {
  /** What this row is choosing between: BATCH, FLOW, MONTH. Printed in caps. */
  caption: string
  tabs: readonly SubTabDef<K>[]
  value: K
  onPick: (key: K) => void
}): ReactElement {
  const step = (from: number, by: number) => {
    const next = (from + by + tabs.length) % tabs.length
    onPick(tabs[next].key)
  }

  return (
    <div className="rd-subtabs" role="tablist" aria-label={caption}>
      <span className="rd-subtabs-cap">{caption}</span>
      {tabs.map((t, i) => {
        const on = t.key === value
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            className={on ? 'rd-subtab on' : 'rd-subtab'}
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
            {t.label}
            {t.n === undefined ? null : <span className="rd-subtab-n">{t.n}</span>}
          </button>
        )
      })}
    </div>
  )
}
