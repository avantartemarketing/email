/**
 * A segmented toggle whose fill travels (ruling 27, 86b).
 *
 * "Two states swapping instantly is genuinely ambiguous — you cannot tell
 * whether your press took effect or the control redrew." Which is exactly what
 * this control did: the `.on` class moved from one button to another and the
 * ink block appeared somewhere else in the same frame.
 *
 * So the fill is ONE element behind the buttons, and it moves and resizes to
 * the option pressed. A background on the chosen button cannot do this; a
 * background does not travel between two elements.
 *
 * Which button is chosen is still said by the `.on` class the callers already
 * set — this reads it off the DOM rather than taking a `value` prop, because
 * four screens drive this control four different ways (one navigates, one sets
 * a store field, one flips a local boolean) and a second source of truth for
 * "which one is on" is a second thing that can disagree with the first.
 *
 * The traps in ruling 27 §6 that this hits, and where:
 *
 *   1. The animated property (`transform`, `width`) is in the stylesheet, and
 *      only the measured NUMBERS are written from here, as custom properties.
 *      Writing `left`/`width` inline would mean the class could never move it.
 *   2. The first measurement forces a reflow and then drops `cold`
 *      SYNCHRONOUSLY, so the fill commits at its resting position with the
 *      transition off, and only then starts transitioning. Split across a
 *      `requestAnimationFrame` this would slide in from the left edge on every
 *      mount.
 *   3. `offsetLeft`/`offsetWidth`, never `getBoundingClientRect` — layout
 *      maths in unscaled pixels, matching the unscaled pixels being written.
 *   4. `.rd-seg` carries no padding, so the padding box the fill is positioned
 *      against and the box `offsetLeft` is measured from are the same box.
 *      If a padding is ever added here, this needs a wrapper.
 */
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'

export default function Segmented({
  children,
  className,
  role,
  ariaLabel,
}: {
  children: ReactNode
  className?: string
  role?: string
  ariaLabel?: string
}) {
  const box = useRef<HTMLSpanElement>(null)
  const fill = useRef<HTMLSpanElement>(null)
  /** Cold until the first real measurement — see trap 2 above. */
  const cold = useRef(true)

  /* No dependency array: the chosen button is read off the DOM, so the only
     honest trigger is "the DOM changed", which is every render. Two offset
     reads on a control with three buttons is not a cost worth a dependency
     that could be wrong. */
  useLayoutEffect(() => {
    const el = box.current
    const bar = fill.current
    if (!el || !bar) return
    const on = el.querySelector<HTMLElement>('button.on')
    if (!on) {
      // Nothing chosen — which this control is not supposed to allow, but a
      // fill parked at the left edge would assert something false, so it is
      // hidden instead.
      bar.classList.add('rd-segfill-cold')
      cold.current = true
      return
    }
    el.style.setProperty('--rd-seg-x', `${on.offsetLeft}px`)
    el.style.setProperty('--rd-seg-w', `${on.offsetWidth}px`)
    if (cold.current) {
      void bar.offsetWidth // commit the start state at the resting position
      bar.classList.remove('rd-segfill-cold')
      cold.current = false
    }
  })

  /* The buttons' widths come from their text, so they change when the control
     does — a narrower window, a longer word after a reload. Re-measuring on
     resize keeps the fill on the button rather than near it. */
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const on = el.querySelector<HTMLElement>('button.on')
      if (!on) return
      el.style.setProperty('--rd-seg-x', `${on.offsetLeft}px`)
      el.style.setProperty('--rd-seg-w', `${on.offsetWidth}px`)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <span
      ref={box}
      className={className ? `rd-seg ${className}` : 'rd-seg'}
      role={role}
      aria-label={ariaLabel}
    >
      <span ref={fill} className="rd-segfill rd-segfill-cold" aria-hidden />
      {children}
    </span>
  )
}
