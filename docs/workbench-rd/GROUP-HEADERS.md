# Ruling 18 — two-row group headers on wide finance tables

From Design, 21 Aug 2026. Commit as an addition to `docs/TOKEN-RULINGS.md`.
Reference: turns 66b and 67b in the concept file.
Applies to every **wide finance table** — any table whose
columns are organised under a second, higher header row.

---

## The problem this fixes
In the previous build the group label was **darker and larger** than the column labels beneath it.
That inverts the hierarchy: the group reads as a heading floating above the table rather than as the
thing that *owns* those four columns. The repair demotes the label and gives it something to bind to.

## The treatment

```
                        │ As charged                │ As settled                │ Payout
Date  Ref    Country    │ Gross    Net   Tax   Ccy  │ Gross    Net   Tax   Ccy  │ Fees   Payout  Ccy
──────────────────────────────────────────────────────────────────────────────────────────────────
```

- **Group label**: `500 11.5px`, `#181d26`, **left-aligned** over its first column, sitting on the
  baseline directly above the column labels (4px of padding beneath it).
- **The group rule**: `1.5px solid #b8c4d4`, spanning **exactly** the group's columns — not the full
  table width, and not just the label's text width.
- **The vertical seams** between groups: the **same** `1.5px solid #b8c4d4`. This is the point of the
  treatment — one weight across the top and down the left makes each group read as a *bracket*.
  They were previously 1px `#d5dee9`, which read as an ordinary column divider.
- **Column labels**: `500 11px`, `#5b6470`, above a `1px solid #dfe5ec` rule. Deliberately lighter
  than the group rule so the two rows are legible as two levels.
- **Body rows**: unchanged dense-sheet geometry — 27px, 12.5px text, `1px #eef1f5` row rules. The
  seam continues down the body at 1.5px.
- **No fill, no tint, no new colour.** An alternating pale-cap version was drawn (66a/67a) and
  rejected: the page already carries a warnbar and tinted flagged rows, and the caps competed with
  the one thing that should catch the eye.

### The whole page is three line weights
`1.5px #b8c4d4` group rule and seams · `1px #dfe5ec` under column labels and around cards ·
`1px #eef1f5` between rows. Nothing else. If a fourth weight appears, something is wrong.

## What must NOT change with it
These were all decided earlier and the new header treatment does not touch them:

- **No totals, anywhere.** Not per card, not per page.
- **Negatives in parentheses** — `(1,043.50)`. This is a filing-adjacent surface.
- **Empty tax prints a muted dash** (`#a0a7b1`) — it means no tax was charged.
- **An unknown half prints nothing at all.** When the upstream system has no payout line for a row, the whole
  "As settled" group is **blank** for that row — never zeros. Zeros would read as a settled figure of
  nothing, which is a different and wrong fact.
- **Flagged rows** are tinted `#fdf6e7` and named **once** in a warnbar above the content, in words.
- **Three section cards** (say Sales, Refunds, Adjustments) **share one column grid**, so the group
  labels and seams line up vertically down the page. That alignment carries as much of the structure
  as the rules do — do not let the cards size their columns independently.
- **A repeated country code is greyed on its second line** (existing rule, unchanged).
- Currency is named per group (`Ccy`), never summed or converted across currencies.

## Check after implementing
1. Group rule spans exactly its columns — measure the rule's width against the sum of its `th` widths.
2. Group rule and seams are the identical colour and weight (`1.5px #b8c4d4`) — a mismatch here
   destroys the bracket effect and is easy to introduce by styling them in separate rules.
3. The three cards' column edges align vertically down the page.
4. Column-label rule is visibly lighter than the group rule at 100% zoom.
