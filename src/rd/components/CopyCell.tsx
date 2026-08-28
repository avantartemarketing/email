/**
 * A value that is there to be copied rather than read — an email, an address.
 *
 * Clicking copies it and the cell says "Copied" for a moment. The word is
 * above the cell rather than in it, so the confirmation can never be mistaken
 * for the value.
 *
 * Ruling 27 (84d) gives the confirmation its flash: `--rd-copied-wash` for
 * 900ms, at the value rather than in a corner — there are no corner toasts
 * anywhere in this admin, because nobody looks there.
 *
 * A clipboard appears on hover, on the owner's word. The dotted underline said
 * "this is different" without saying what was different about it — a mark that
 * names the action is the difference between a hint and an invitation. It is
 * drawn in the gutter the cell already reserves, so nothing shifts when it
 * appears: a target that moves when you point at it is a target you cannot
 * aim at.
 */
import { useEffect, useRef, useState } from 'react'

export default function CopyCell({ value }: { value: string }) {
  const [did, setDid] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  if (!value) return <span className="rd-none">–</span>
  return (
    <span
      className={did ? 'rd-cpy did' : 'rd-cpy'}
      role="button"
      tabIndex={0}
      title="Click to copy"
      onClick={(e) => {
        e.stopPropagation()
        void navigator.clipboard?.writeText(value)
        setDid(true)
        if (timer.current) clearTimeout(timer.current)
        /* 900ms, ruling 27's own number for this flash (84d). It replaces
           1400: the old one was long enough that a second copy landed while
           the first was still lit, so two copies read as one. */
        timer.current = setTimeout(() => setDid(false), 900)
      }}
    >
      {value}
      <svg className="rd-cpymark" width="11" height="12" viewBox="0 0 11 12" aria-hidden focusable="false">
        <rect x="3.5" y="0.5" width="7" height="8.5" rx="1.5" fill="none" stroke="currentColor" />
        <path d="M7.5 11.5h-6a1 1 0 0 1-1-1V3" fill="none" stroke="currentColor" strokeLinecap="round" />
      </svg>
    </span>
  )
}
