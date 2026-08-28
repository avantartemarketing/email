/**
 * A destructive control that takes two presses, in the redesign's own words.
 *
 * One screen made the ruling and this carries it everywhere: a browser
 * dialogue is the wrong answer twice over. It is the browser's furniture on a
 * screen where every other menu, field and dialogue is ours — and, the reason
 * it had to go, a browser that has been asked to stop showing dialogs on a
 * page returns FALSE from `window.confirm` without drawing anything, so the
 * button silently does nothing at all. `window.prompt` fails the same way,
 * returning null; the action just never happens and nobody is told why.
 *
 * Arming says the same thing where the decision is being made: the control
 * names what a second press will do, and the caller puts the consequence in
 * words beside it — the rows, the card, the phase still on screen to be read,
 * which a modal covers up.
 *
 * The label change is the safeguard against a stray second click: a control
 * that is still armed does not look like one that is not.
 */
import { useCallback, useState } from 'react'

export interface Arm {
  /** True once the first press has landed and the act is one press away. */
  armed: boolean
  /** Wrap the destructive act: the first press arms, the second runs it. */
  press: (go: () => void) => void
  /** Put the control back to rest — a selection changed, a dialogue closed. */
  disarm: () => void
  /** The control's label, carrying the second press when it is armed. */
  word: (label: string) => string
}

export default function useArm(): Arm {
  const [armed, setArmed] = useState(false)
  const press = useCallback(
    (go: () => void) => {
      if (!armed) {
        setArmed(true)
        return
      }
      setArmed(false)
      go()
    },
    [armed],
  )
  const disarm = useCallback(() => setArmed(false), [])
  return {
    armed,
    press,
    disarm,
    word: (label) => (armed ? `${label} — press again` : label),
  }
}
