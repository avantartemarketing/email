/**
 * One table's half of a screen that carries two — the Log & pay page.
 *
 * The owner, 24 Aug 2026: *"I think we can combine the pay and log tabs in one
 * tab under payments — they can all be in two tables, with log at the top and
 * Pay underneath."* Two tables on one page need two things a one-table screen
 * never has to answer: which table is which, and where the controls that act
 * on only ONE of them go. The page header cannot hold them — "Export CSV"
 * standing beside "Upload invoice" names neither table, and a reader who
 * guesses wrong exports the wrong list.
 *
 * So a section's bar is the page header's row one level down: the same flex
 * row, the same single control height (`--rd-head-control-h`, ruling 89j), and
 * the name at `--rd-size-section` rather than the display face. Two 22px
 * titles under one crumb would read as two pages that had been pushed
 * together, which is the thing this screen is not.
 *
 * The name is the whole caption. A qualifier under each — "documents waiting",
 * "invoices outstanding" — was written and taken out again: each card's own
 * foot already counts its rows, and a caption earns its place by changing what
 * somebody does next.
 */
import type { ReactNode } from 'react'

export default function Section({
  id,
  name,
  actions,
  children,
}: {
  /** A stable hook for this half of the page: `rd-sect-log`, `rd-sect-pay`. */
  id: string
  name: string
  /** The controls that act on THIS table, right-aligned in its own bar. */
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={`rd-sect rd-sect-${id}`}>
      <div className="rd-secbar">
        <span className="rd-secname">{name}</span>
        <div style={{ flex: 1 }} />
        {actions}
      </div>
      {children}
    </section>
  )
}
