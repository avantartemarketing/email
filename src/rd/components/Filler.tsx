/**
 * The empty column at the end of a resizable table.
 *
 * The owner's instruction, overruling two earlier answers: *"On column
 * resizing, it still snaps the right most column back to the edge and expands
 * it to fill space. Instead, another empty column should appear to the right
 * of it to fill space."*
 *
 * A table narrower than its card has to put the surplus somewhere. Handing it
 * to a real column means a column somebody did not touch changes width — and
 * where that column is the one they DID touch, it springs back under the hand
 * that narrowed it. A column holding nothing can take the room without
 * telling a lie about anything.
 *
 * It is a real cell rather than a CSS trick because three things have to run
 * through it and all three are cell behaviour: the header stays opaque and
 * sticky across it (ruling: the column heads hold their place), the row
 * hairlines reach the card's edge, and a group band's fill does too. A
 * cell-less column in the colgroup gets none of them, and the hole shows.
 *
 * It carries nothing and says nothing: no label, no seam, no width of its
 * own, and `aria-hidden` because there is no column here to announce.
 *
 * `rows` is for the two-row group heads on wide finance tables, where the
 * identity columns live in the FIRST header row under
 * `rowSpan={2}` and only the grouped columns are in the second. The filler is
 * one of the first kind: written into the second row instead, that row comes
 * out a column short and every group band slides one place left of the
 * figures it names — which is not a fault any screenshot shows, because the
 * cells still line up with each other.
 */
export default function Filler({ head, rows }: { head?: boolean; rows?: number }) {
  return head ? (
    <th className="rd-fill" rowSpan={rows} aria-hidden />
  ) : (
    <td className="rd-fill" rowSpan={rows} aria-hidden />
  )
}
