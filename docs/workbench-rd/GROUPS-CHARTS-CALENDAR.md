# Rulings 14–16 — grouped tables, charts, and the email calendar

From Design, 21 Aug 2026. Commit as an addition to `docs/TOKEN-RULINGS.md`.
Reference: turns 56b, 57, 62d and 63a in the concept file.
Supersedes the Emails/Calendar section of HANDOFF.md entirely — the timeline is deleted.

---

## 14 · Group bands, rebuilt (Airtable's shape)

Applies to **every grouped table** — every record list, every ledger, and the
email Calendar.

```
┌──────────────────────────────────────────────┐
│  ⌄   PHASE                                   │  50px, bg #f4f7fb,
│      [ Pre-orders ]                          │  1px #dfe5ec top AND bottom
├──────────────────────────────────────────────┤
│  Period opening    …                         │  32px rows
│  Pre-order live    …                         │
│  +                                           │  32px add row
└──────────────────────────────────────────────┘
      12px of white air
┌──────────────────────────────────────────────┐
│  ⌄   PHASE                                   │
│      [ Black Friday ]                        │
```

- **Band height 50px**, background `#f4f7fb`, hairline top and bottom.
- **Two lines inside**: a caption naming *what the grouping is* — `PHASE`, `STATUS`, `MONTH` —
  at `600 9px`, `letter-spacing .09em`, `#98a1ad`; then the **value** beneath it (a status pill, a
  category tag, or plain 500/13px text for a month).
- **Chevron is drawn, 10px, 1px stroke, `#8a919c`** — an inline SVG path, never a rotated-border
  triangle and never a text glyph. The old border-triangle read chunky at every size we tried.
- **12px of white space between groups.** A transparent full-width row, not margin.
- **No counts on bands.** Ruled earlier and still ruled; Airtable prints them, we do not.
- **Each group ends in an add row**: 32px, a bare drawn plus (12px, 1.6px stroke, `#a0a7b1`) at the
  first column's inset, whole row washes `#f4f7fb` on hover. It creates the record **inside that
  group** — a new email added under `Black Friday` is a Black Friday email — not at the table foot.
- Empty groups are **absent**, not printed empty. If no email falls in October, October has no band.

---

## 15 · Chart vocabulary — one plot box, band as ghost floor

The admin has exactly one chart shape. Every screen that plots anything uses it.

- **One plot box.** The line owns the y ladder. The band sits behind it as pale bars anchored to the
  floor (`#e4ebf4`), with **no gridlines touching it and no second y-axis, ever**.
- **The band's level is stated once, in words**, beneath the plot: "Bars are weekly paid social
  spend on their own scale — read them for shape, not level. Peak EUR 4,600."
- **One x-axis, printed once.**
- **Ladder labels run low-to-high** (`0` at the baseline). Derive tick positions and data positions
  from the *same* function or they will disagree — see the warning below.
- **Signed bands** (joins above, departures below) get their own zero line inside
  the same box, drawn once, and use `#e4ebf4` up / `#f2e2df` down.
- End-of-line value labels carry the two numbers anyone acts on (actual and plan); they must not
  collide — nudge one, don't stack them.

### States
| state | draw |
|---|---|
| **empty** | the frame, plus a sentence saying there is nothing to report. **Never a flat line at zero** — that reads as "sold nothing" rather than "nothing recorded". |
| **stale** | the whole chart at 50% opacity, with a worded warnbar naming the age ("the pipeline last ran seven days ago"). Toolbar freshness caption goes amber at the same moment. |
| **unreadable** | **nothing.** No axes, no baseline, no zero line. A worded failure band instead. A chart that renders is a chart someone reads. |

### ⚠ Derive every position from one function
Two bugs in our own drafts, both from hand-placed geometry:
1. Ladder labels were emitted top-down while paths drew bottom-up — `100%` printed on the baseline
   and the 74% line ended beside a gridline labelled `25%`.
2. Dots were placed from hand-assigned week numbers while month ticks sat at a fake 4-weeks-per-month,
   accumulating **41px (11 days)** of drift: a 25 Aug send rendered on the Sep tick.

Write `x(date)` and `y(value)` once. Use them for ticks, gridlines, data, "today", and any spans.
Verify by measurement, not by reading the source.

---

## 16 · Emails / Calendar — the table is the page

**The timeline is deleted.** Not restyled — removed. Replaced by a 32px grouped table with a small
date ruler beneath it.

### The table
Columns: **Name · Phase · Countries · Languages · Date · When · Status**

- **Audience is gone from this screen.** `Phase` replaces it.
- **Phase** is a new first-class field: a category tag, tinted per value —
  `Pre-orders` #e9eef6/#3f5573 · `Black Friday` #efeaf9/#5b3fa8 · `Xmas` #eaf0ea/#3f6349 ·
  `January` #fbf1dd/#8a5800. **Users can add phases** (`+ New phase` in the toolbar, dashed 7px
  chip): a phase is a name plus a date range. An email with no phase shows a dashed `+ phase`
  affordance in its cell, never a dash, and groups under a dashed `No phase` band.
- **Countries** are flags only, 14×10px, no codes — the column is scanned, not read.
- **Languages** are the language-family lozenges (ruling 3), max five.
- **Date** is the send date; empty prints `– set date` in `#a0a7b1`, and the text is the click target.
- **When** is a *derived* relative string — "in 4 days", "3 weeks ago", "last week". Compute it from
  today; never store or type it.
- **Status**: Sent / Scheduled / Draft / No date, as status pills.

### Toolbar
`Group by: [Phase ▾]` — **Phase, Month or Status** — then status filter chips
(All / Sent / Scheduled / Draft / No date), then `+ New phase` on the right.
When grouped by Phase, the Phase **column is dropped** — the band already says it.

### The ruler
One card beneath the table, titled "The period", scoped to the cycle it covers.
A **plain date axis**: month ticks, one dot per dated email in its status colour, a dashed "today"
line. **No phase spans on it** — the group bands already name the phases, and drawing them twice
spends a band repeating the table. Dateless emails are **named in words** at the right
("2 emails with no date sit outside this ruler"), never silently dropped.

### Brushing, both directions
Hovering a table row enlarges its dot (r 5 → 8); hovering a dot washes the row `#eef4fb`.
In the concept this is pure CSS (`:has()` + `data-erow`/`data-edot` index attributes) — implement it
however suits the codebase, but it must work **both ways**.

### Not built
The **phase editor** behind `+ New phase` (name, date range, whether phases may overlap) is not
designed yet. Do not invent it — ask.
