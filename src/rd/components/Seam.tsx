import type { SeamHandlers } from './useColWidths'

/**
 * Ruling 19's affordance: the strip on a column's right edge you drag to
 * widen it.
 *
 * Absent at rest. Every seam in the row appears together the moment the
 * pointer enters the header row — one seam fading in under the pointer is a
 * hint about one column; the whole row appearing at once says the table
 * resizes. The seam under the pointer thickens and turns blue.
 *
 * `null` handlers mean the last column, which has nothing to its right to
 * resize and so draws no seam. The caller passes `seam(i)` straight through,
 * so that decision lives in one place rather than at every call site.
 *
 * The strip is inset 6px top and bottom so its hit target cannot collide with
 * the row above or below. The `th` it sits in must be `position: relative`,
 * which `.rd-t th` is.
 */
export default function Seam({ on }: { on: SeamHandlers | null }) {
  if (!on) return null
  return (
    <span
      className="rd-seamgrip"
      role="presentation"
      onMouseDown={on.onMouseDown}
      onDoubleClick={on.onDoubleClick}
      // The header row is clickable on several of these tables (sort); a drag
      // that also sorted would make the column jump as it was being sized.
      onClick={(e) => e.stopPropagation()}
    >
      <i className="rd-seamline" />
    </span>
  )
}
