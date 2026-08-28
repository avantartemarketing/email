/**
 * The mark inside a checkbox (ruling 27, 88d's neighbour 88b).
 *
 * This is the most-clicked control in the admin, and until now the mark was
 * the character `✓` (and `–` for indeterminate) swapped in and out. Two things
 * were wrong with that, and only one of them is about motion:
 *
 *   - **It appeared instantly**, so there was no confirmation the click landed
 *     on the row you aimed at. On a fifty-row list that is the difference
 *     between trusting a bulk action and counting the ticks again.
 *   - **A character takes the font's metrics.** `✓` is centred by a text
 *     rule against a line box, so it sat a fraction low in a 16px box and the
 *     box had to carry a `font` declaration to hold it — a type value doing a
 *     drawing's job, which is precisely what ruling 24 objected to about the
 *     text chevron.
 *
 * So it is drawn, and it STROKES ON via `stroke-dashoffset` over 120ms: the
 * mark is made in the direction a hand makes it, which is what reads as
 * "that click was taken" rather than as "something changed here".
 *
 * The indeterminate bar is not a stroke anybody draws, so it grows from its
 * centre instead; drawn from one end it reads as a tick going wrong.
 *
 * `aria-hidden` throughout: the state is on the `role="checkbox"` wrapper's
 * `aria-checked`, and the mark is the drawing of that state, not a second
 * statement of it.
 */

/** The mark's own geometry, in the 16px box's user units. */
export default function Tick({ mixed }: { mixed?: boolean }) {
  return (
    <svg
      className="rd-cbxmark"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden
      focusable="false"
    >
      {mixed ? (
        <rect x="4" y="7.25" width="8" height="1.5" rx="0.75" />
      ) : (
        /* Two segments, 12.88 user units long together — the dash array in the
           stylesheet rounds that to 13, which is the length that has to be
           offset for the mark to be undrawn. Stated there rather than measured
           with `getTotalLength()`: the path is fixed, so a measurement would
           be a layout read on every mount for an answer that never changes. */
        <path d="M3.6 8.4 L6.6 11.4 L12.4 5" />
      )}
    </svg>
  )
}
