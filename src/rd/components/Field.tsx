/**
 * A form field, in the redesign's floating-label vocabulary (`44b`).
 *
 * The label lives inside the field. Empty, it sits at full size and is the
 * placeholder; filled or focused, it floats to 10.5px and the value takes its
 * place. HANDOFF.md applies this to **every** form, including the screens drawn
 * before the decision — `35a`'s capped external labels are explicitly not to be
 * ported.
 *
 * The three things that ride with it are all here rather than reinvented per
 * screen: a counter or scope note on the floated label's line, a greyed prefix
 * the value is read through (a currency, a domain), and the read-only variant —
 * a grey-washed box with the lighter edge, because a value nobody can change
 * must not wear the edge that means "editable".
 */
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export default function Field({
  label,
  value,
  mark,
  onChange,
  onCommit,
  readOnly,
  note,
  noteNear,
  prefix,
  numeric,
  suggested,
  multiline,
  deep,
  width,
  controlId,
  children,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  /** Called when the field is left. Where the write goes, so typing is free. */
  onCommit?: () => void
  /** A value nobody can change here: grey wash, lighter edge, no cursor. */
  readOnly?: boolean
  /**
   * A mark that belongs to the field rather than to its value — today, the
   * country's flag. It sits on the LABEL's line, level with the label's word.
   *
   * Not in front of the value, which is where it started. A flag there is not
   * a prefix: a currency prefix is read THROUGH with the figure beside it
   * ("£1,200"), where a flag and the code beside it say the same thing twice
   * — and it pushed the value 22px right, so the one field with a flag was the
   * one field whose value did not line up with the column it sits in.
   */
  mark?: ReactNode
  /** Counter or scope note, on the floated label's line. */
  note?: ReactNode
  /** Reads amber — near a cap, or otherwise worth looking at. */
  noteNear?: boolean
  /** Greyed and inline, and never part of what gets typed. */
  prefix?: string
  numeric?: boolean
  /**
   * A value the reader proposed and nobody has confirmed (`45b`): amber dash
   * on cream, with the word on the label's line. The caller supplies the word
   * through `note` — this is only the treatment — so a screen can say
   * "suggested", "from last month", or whatever it actually means.
   */
  suggested?: boolean
  /**
   * A value that runs to a sentence rather than a phrase — `42c`'s
   * Description. A textarea, and the box keeps the room for two lines whether
   * or not they are used, so the form does not jump as one is typed.
   */
  multiline?: boolean
  /** Multiline only: a PARAGRAPHS field rather than a sentence — the box
      opens deep and then grows with its content, because copy that crops is
      copy nobody re-reads. A plain multiline keeps the description's two
      lines. */
  deep?: boolean
  width?: number
  /**
   * The id of a control the CALLER supplied through `children`.
   *
   * The field is a `<label>`, and a label reaches its control by `for`. Where
   * the field draws its own input that is wired up here; where a picker hands
   * one in, nothing carried the id and the association was to nothing — so a
   * press on the label's word, on the caret, or on any of the padding did
   * nothing at all, and only the value's own few pixels answered. Both pickers
   * pass this now. Any future caller with `children` must too.
   */
  controlId?: string
  /** A control of its own — a picker, a select — in place of the input. */
  children?: ReactNode
}) {
  const own = useId()
  // The caller's control where there is one; ours otherwise.
  const id = controlId ?? own
  const taRef = useRef<HTMLTextAreaElement>(null)
  /* The box fits its text, measured — a line count cannot see soft wrap, and
     soft wrap is most of a paragraph. Runs on every value change; collapsing
     to auto first lets it shrink again when text is deleted. */
  useLayoutEffect(() => {
    const el = taRef.current
    if (!el || !multiline) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value, multiline])
  const [focused, setFocused] = useState(false)
  /* Collapsed means the label is doing the placeholder's job, so there is
     nothing below it to make room for. Focus expands it even with nothing
     typed, because the caret has to have somewhere to sit — that is `44b`'s
     first swatch: blue label, empty value, caret. A field with its own control
     is never collapsed; the control has to be reachable. */
  const collapsed = !value && !focused && !children
  const cls = [
    'rd-field',
    collapsed ? 'rd-field-empty' : '',
    readOnly ? 'rd-field-read' : '',
    suggested ? 'rd-field-sug' : '',
    multiline ? 'rd-field-multi' : '',
    deep ? 'rd-field-deep' : '',
    /* Figures, not alignment: a form box reads from the left whatever is in
       it, and this only asks for the tabular digits that stop a figure
       jittering as it is typed. */
    numeric ? 'rd-figs' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <label className={cls} htmlFor={id} style={width == null ? undefined : { width }}>
      <span className="rd-fieldlab">
        {label}
        {mark != null && <span className="rd-fieldmark">{mark}</span>}
        {note != null && (
          <span className={noteNear ? 'rd-fieldnote rd-near' : 'rd-fieldnote'}>{note}</span>
        )}
      </span>
      <span className="rd-fieldval">
        {prefix && <span className="rd-fieldpre">{prefix}</span>}
        {children ??
          (readOnly || !onChange ? (
            <span>{value}</span>
          ) : multiline ? (
            <textarea
              id={id}
              ref={taRef}
              value={value}
              rows={2}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false)
                onCommit?.()
              }}
            />
          ) : (
            <input
              id={id}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => {
                setFocused(false)
                onCommit?.()
              }}
            />
          ))}
      </span>
    </label>
  )
}
