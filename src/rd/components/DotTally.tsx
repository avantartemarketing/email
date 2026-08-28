/**
 * Ruling 25: how many periods a record has been active in, as a run of dots.
 *
 * The column was a graded lozenge carrying a numeral. A count in a box is
 * something you read; a run of dots is something you see — and the question
 * this column answers ("have they been around long?") is answered at a glance
 * or not at all, because nobody stops to read a 3 in a grey box while scanning
 * sixty rows.
 *
 * **One dot per period. No gaps, no hollow dots, no skipped state.** The
 * ruling records that a position track with skipped years drawn pale
 * was designed and DELIBERATELY REJECTED: it needs a legend, it puts a second
 * reading into a column that answers one question, and a pale dot is fragile
 * at fractional device-pixel ratios. It is not to be reintroduced.
 *
 * **The years live in the `title`**, because a dot run is not a label and the
 * detail somebody occasionally wants has to be somewhere.
 *
 * **Ten dots is the cap.** A run stops being countable at a glance well before
 * it stops fitting, so beyond ten the numeral is the honest answer.
 *
 * **Zero is zero dots, not a dash.** An empty cell is the fact here — nothing
 * has happened on this row yet — and a dash would read as "not known".
 */

/** Beyond this many, nobody counts dots; the numeral says it faster. */
export const DOT_CAP = 10

export default function DotTally({
  years: given,
  noun = 'year',
  empty = 'None yet',
}: {
  /** The periods themselves, in any order. Their COUNT is what is drawn. */
  years: number[]
  /** What one of them is called, for the title. Pluralised with an `s`. */
  noun?: string
  /** What the title says when there are none. */
  empty?: string
}) {
  const n = given.length
  /* Ascending, and said in full: "5 years: 2022, 2023, 2025, 2026, 2027".
     The gap in that run is the whole reason the years are here rather than
     drawn — the dots say how many, the title says which. */
  const years = [...given].sort((a, b) => a - b)
  const label = n === 0 ? empty : `${n} ${noun}${n === 1 ? '' : 's'}: ${years.join(', ')}`

  if (n > DOT_CAP) {
    return (
      <span className="rd-dotnum" title={label}>
        {n}
      </span>
    )
  }
  return (
    <span className="rd-dots" title={label}>
      {years.map((y) => (
        <span className="rd-dot" key={y} aria-hidden />
      ))}
      {/* The count in words for anything that cannot see the dots. The run
          itself is decoration to a screen reader — six identical spans say
          nothing — so the sentence the title carries is the accessible text. */}
      <span className="rd-sr">{label}</span>
    </span>
  )
}
