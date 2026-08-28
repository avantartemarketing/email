/**
 * The tick on a row, and the one place `89i`'s range gesture is implemented.
 *
 * Seven tables drew this same span with the same four handlers; the range
 * would have been seven copies of the same twenty lines, and the eighth table
 * would have got five of them. `usePicked` owns the set and the anchor, this
 * owns the gesture, and a screen supplies neither.
 *
 * Three things that are easy to leave out and each show as a bug:
 *
 * - **`data-tick` is the row's id**, and it is what `ticksInTable` reads to
 *   know what "in between" means. A tick without it cannot be ranged over, so
 *   it is set here rather than by a caller who might forget.
 * - **A shift-press must not select TEXT.** Shift-clicking two points in a
 *   document is the browser's own "select everything between", and it fires
 *   whatever else the click does — so the range gesture would leave half the
 *   table highlighted blue. Suppressed on mousedown, which is where the
 *   browser starts it, and only when the modifier is down.
 * - **Space ranges too.** The keyboard reaches the same control, and a
 *   gesture that works with a mouse and not with a key is a gesture somebody
 *   has to learn twice.
 */
import Tick from './Tick'
import { ticksInTable } from './usePicked'

export default function RowTick({
  id,
  on,
  label,
  onPress,
}: {
  id: string
  on: boolean
  /** What this ticks — read out where the row's own name is not enough. */
  label?: string
  onPress: (id: string, range: boolean, order: string[]) => void
}) {
  const press = (el: Element, range: boolean) => onPress(id, range, ticksInTable(el))
  return (
    <span
      className={on ? 'rd-cbx on' : 'rd-cbx'}
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      data-tick={id}
      tabIndex={0}
      onMouseDown={(e) => {
        if (e.shiftKey) e.preventDefault()
      }}
      onClick={(e) => press(e.currentTarget, e.shiftKey)}
      onKeyDown={(e) => {
        if (e.key !== ' ') return
        e.preventDefault()
        press(e.currentTarget, e.shiftKey)
      }}
    >
      <Tick />
    </span>
  )
}
