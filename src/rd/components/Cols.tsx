/**
 * A table's grid, declared once on a colgroup.
 *
 * The concept writes a column's width on the header cell — `<th
 * style="width:170px">` — and its cells are content-box, so the padding sits
 * *outside* that number and the column comes out 170 plus the cell's own 12px
 * either side. Two things make that placement unusable here:
 *
 * - Under `table-layout: fixed` the grid comes from the table's first row, and
 *   on a table whose rows can be ticked that row is the bulk bar the moment a
 *   box is ticked — one cell wide, no widths, whole grid collapsed.
 * - A `col` has no padding of its own, so the same number on a colgroup means
 *   a narrower column. This is the fault a wide finance screen was shipped
 *   with once already: every other metric matched while the fixed columns came
 *   out 14-26px short.
 *
 * So the widths stay the concept's numbers, verbatim, and the padding is added
 * back from the same token the cells use. `null` is a column the concept leaves
 * undeclared, which takes the surplus.
 */
/**
 * A column: the concept's declared width, and which right-hand gutter its cell
 * uses where that is not the ordinary one. An expandable count reserves room
 * for its chevron, and the column after it gives some back, so those two carry
 * more padding than the rest — and a colgroup that ignored that would come out
 * 22px and 12px short of the drawing.
 *
 * `{ px }` is the one form that is NOT the concept's number: a width somebody
 * set by dragging the seam (ruling 19). It is the column's whole rendered
 * width, padding included, because that is what the pointer was over — so it
 * goes on verbatim, with none of the padding arithmetic below.
 */
export type ColSpec = number | null | { w: number; right: 'un' | 'afterUn' } | { px: number }

const RIGHT = {
  un: 'var(--rd-cell-pad-un)',
  afterUn: 'var(--rd-cell-pad-after-un)',
} as const

export default function Cols({ widths }: { widths: ColSpec[] }) {
  return (
    <colgroup>
      {widths.map((c, i) => {
        if (c == null) return <col key={i} />
        if (typeof c === 'object' && 'px' in c) return <col key={i} style={{ width: c.px }} />
        const w = typeof c === 'number' ? c : c.w
        const right = typeof c === 'number' ? 'var(--rd-cell-pad-x)' : RIGHT[c.right]
        return <col key={i} style={{ width: `calc(${w}px + var(--rd-cell-pad-x) + ${right})` }} />
      })}
    </colgroup>
  )
}
