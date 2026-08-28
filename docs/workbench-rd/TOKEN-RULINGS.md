# Token rulings

From Design, 20 Aug 2026.
These rulings supersede both the earlier HANDOFF.md token list and the inline values in concept.html:
implement from these tokens; where a screen disagrees with a ruling, the ruling wins.

Implement from these tokens, never from inline values. Where a screen disagrees with a ruling below, the ruling wins — the concept file predates some decisions.

> **Rulings 16, 16a, 20, 22 and 23 are not in this copy.** Each was a spec for
> one screen of the product this system was built for — a send calendar, a
> stock-targets sheet, a warehouse planner, a shipments table — rather than a rule
> about the system. They are the only gaps in the numbering, and they are
> deliberate: nothing else refers to them.


**1 · Ink ramp — the screens are the truth; the earlier README list was stale.** The ramp, with roles:
- `--ink` `#181d26` — titles, answers, primary buttons
- `--ink-cell` `#1f242c` — table cell text
- `--ink-body` `#33383f` — long-form/body copy
- `--ink-ui` `#41454d` — default UI text (nav items, chips, notes) — the workhorse
- `--ink-tertiary` `#5b6470` — labels, rail pages, secondary buttons
- `--ink-muted` `#6b7380` — captions, key-value labels
- `--ink-faint` `#8a919c` — placeholders, floated labels, timestamps
- `--ink-disabled` `#a0a7b1` (fold `#98a1ad` into it) — empty dashes, untouched rows
- `--ink-on-navy` `#9fadc4` — muted text on the navy bar only (it shows on every screen because the bar does; it is not part of the grey ramp)

**2 · Teal and the second amber.**
- `#c07f00` = `--warn-dot`, the ● indicator on `#fdf6e7` warnbars — a real token the README forgot; that is all five of its uses.
- `#2e8a52` / `#d9a514` / `#b3261e` on `52a` = the meter ramp (`--meter-ok/-behind/-badly`), data-viz fills only, always accompanied by the printed %; never for text or statuses.
- `#12808a` teal is legitimate only inside the language-lozenge family (below). Any teal outside a language context is drift — replace with a named status pair.

**3 · The language palette is real — name it as a set.** Each language code gets a stable bg/border/ink triple (`--lang-<code>-bg/-border/-ink`); `38a` is the source of truth for the mapping and the 19 values listed in the audit are exactly this family. It recurs anywhere a language is shown (`37b`, `39a`, `42c`, `45a`, Popups). Tokenise from `38a`, then reuse — never re-derive per screen.

**4 · Stale palettes.**
- `22c`/`23a` kept an earlier exploration's colours — structure stands, colours re-map on implementation: `#1d3a8f`→`#254fad`, `#aa2d00`→`#b3261e`, `#0a5c22`/`#e7f2e7`→`#2e6b45`/`#e7f3ea`, `#2b2f36`→`#181d26`, `#e8e6df`→`#eef0f3`, `#7fa8d9`→`#c9d2dd`.
- `36d`'s reds are a real state: **armed-destructive** is deliberately softer than the failure red so an armed control doesn't read as an error. Tokens: `--armed-bg` `#fdf5f4`, `--armed-border` `#e4c4c0`, `--armed-outline` `#d88a84`.

**5 · Radius — controls are 7px; the rule stands.** The other radii are different layers, now named:
- 2px form fields · **4px** meter bars, image thumbs (fold 3px in) · **6px** floating-menu items, tooltips, mini copy-pills, language lozenges (fold 5px in) · **7px** every control · **8px** inset surface panels (bar search field, preview desks, popover inner panels) · 10px cards · 12px dialogues/popovers · 999px status pills, avatars. 1px is a slip → 2px.

**6 · Type scale and the third weight.** Real sizes the scale forgot: **13.5** (field values), **11.5** (captions, mini buttons), **10** (caps labels), 15 (wordmark), 16/20/21 (KPI + doc headers), 9 (micro caps column captions in line editors). Full scale: 9 · 10 · 10.5 · 11 · 11.5 · 12 · 12.5 · 13 · 13.5 · 14 · 15 · 21 · 22. The one-use sizes (14.5, 17, 24) live inside rendered artifacts (email preview, invoice paper, gallery chrome) — content, not UI tokens; don't port them.
- **Weight 600 is real in exactly one role:** tracked micro-caps labels (9–10px), which need 600 to stay legible. Everywhere else emphasis is 500 ("bold marks the answer"); 600s in email-preview bodies are content. No 700 anywhere.

**7 · The hairline is one decision, not two.** `#dddddd` is inherited — it is the bound design system's default hairline riding in through `--color-hairline`. The admin's structural border is the ruled `#dfe5ec`; they are the same decision made twice. Ruling: point `--color-hairline` at `#dfe5ec` and use it for the sidebar, bar, buttons, chips, cards and row seams (`#eef1f5` stays the lighter in-table row rule). `#c9d2dd` remains distinct and deliberate: it is the form-field/select border only — darker because those edges mean "editable". Three border tokens total: `--hairline` #dfe5ec, `--hairline-row` #eef1f5, `--border-field` #c9d2dd.

**8 · Freshness and sign-out.**
- **Sign-out** lives behind the avatar: clicking the disc opens the standard floating menu (12px radius, dialogue shadow) with the account email as a muted header line, then Sign out. Nothing else goes in it.
- **Data freshness** loses its rail card — the rail no longer exists as a per-area surface. It becomes a worded caption in the toolbar's right-hand slot, the pattern `52a` already shows: "data as of 16 Aug, 16:55" — 11.5px, `--ink-faint`, on every screen that reads from the pipeline (all of BI and Finance, the Targets sheet, Schedule/Results). Stale data escalates in words, not colour: past its expected refresh the caption gains a warnbar naming the age; an unreadable pipeline is the loud `54c` failure band, never zeros. Freshness is per screen, sign-out is global — they never shared a home except by accident of the old rail.

**9 · Bulk bar — replace, don't stack.** The concept's above-the-table placement is a drawing artifact, not a decision. Keep the incumbent's hard-won rule: on selection the bulk bar replaces the column-header row in place, at the header row's exact height, so starting a selection moves nothing and the ticked row stays under the pointer. Bar contents are unchanged (indeterminate box, "N selected", grey 7px pills, destructive in red text). Applies to every checkbox table.

**10 · Type is Inter.** Neue Haas Grotesk is retired from the admin — inherited from the parent design system, never chosen, and a marketing grotesque at product sizes. `--font-text` and `--font-display` both become `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`; self-host the variable woff2, set `font-optical-sizing: auto` and root `tabular-nums`, and remove any `-webkit-font-smoothing: antialiased`. The thirteen-size scale and three weights are unchanged. Full implementation note: `TYPE-INTER.md`.

**11 · Standard tables are 34px rows** (two pixels above Airtable's 32, well below the ~40 of the commerce admin beside it — the point where the category tags and flags stop touching the row edges). The cell owns the height — `box-sizing:border-box; height:34px; padding:0 12px; vertical-align:middle` — and the status pill must be capped to 17px inside table cells or it props every row open to ~36px. Dense sheet screens keep their own ~27px. Measure `tr.getBoundingClientRect().height`, don't trust the stylesheet.

**12 · A second lozenge shape.** 999px pill = **status** (a changing state); 6px soft-filled tag, 19px tall, no border = **category** (a fixed taxonomy value). Category tags are tinted per value from a named set — Source and Category get their own tints, Currency takes one neutral tint for all currencies. Currency splits out of the money column into its own tag column *with a real `Currency` header*, leaving Value as pure aligned figures.

**13 · Country columns are the flag ALONE** — 14×10px, no code beside it (amended 21 Aug; the flag originally preceded the code). The column is scanned, not read: eight two-letter codes in a column are eight things to parse, where eight flags are one glance. The code moves into `alt` and `title`, so hovering names it for anyone who does not know the flag, and screen readers still get the code rather than an image. Hairline shadow `0 0 0 .5px rgba(24,29,38,.12)` so white-heavy flags (JP, FI, DK) survive a white row. Host the images locally, not from a CDN. A "rest of" bucket is drawn too (amended 22 Aug). It has no national flag, since it is what is left over rather than a place — so it gets a mark of its own: a globe on the same 14×10, a drawn SVG beside the flags, with the code in `alt` and `title` like every other cell. The first cut gave it a spacer and the word, which left one cell in the column that had to be READ while the rest were glanced at — the exact cost this ruling exists to remove. Only a code with no flag at all keeps the bare spacer. **Exception: a statutory filing keeps the country named in full** — a filing states its jurisdiction in words, never as a picture.

Full implementation note for 11–13: `TABLES-TAGS-FLAGS.md`.

**14 · Group bands** are 50px on `#f4f7fb` with hairlines top and bottom, holding a tracked-caps caption naming the grouping (`PHASE`/`STATUS`/`MONTH`) above the value — and the band's lozenge is **24px at 12.5px**, larger than the 17px/11px used in body rows, because a band is a heading; a drawn 10px chevron (never a glyph or rotated border); no gap between groups — the band hairlines separate them; no counts; and a 32px add row ending each group whose plus creates the record *inside that group*. Empty groups are absent, not printed empty.

**15 · One chart shape**: a single plot box where the line owns the y ladder and the band sits behind it as a pale ghost floor — no gridlines on the band, no second axis, its level stated once in words. One x-axis. Ladder labels low-to-high. Empty says so in words (never a flat zero line); stale dims the whole chart at 50% with a worded age; unreadable draws **nothing**. Derive ticks and data from one `x()`/`y()` function — hand-placed geometry drifted 41px in our own draft.

**15a · A second MARK, not a second chart.** Ruling 15 names the reporting screens and gives them one shape — a line over a ghost band, for a series through time. A history comparison is not one of them and is not that question: it compares periods against each other, and a line joining 2024 to 2025 to 2026 would assert a continuity the data does not have. So it draws grouped bars, from the same file (`Chart.tsx`), sharing the part of ruling 15 the ⚠ is actually about — one `x()` and one `y()`, the ladder derived rather than laid out, the box measured rather than scaled, and the type left on ruling 10's reading scale. **One chart vocabulary, two marks.** The bar mark adds a SIGNED ladder, because growth crosses zero: it walks out from zero by one step in both directions, and zero sits where zero falls in the range so both halves stay to scale. Stretching one half to fit is how a 3% fall comes to read as a collapse. Raised for Design rather than assumed.

Full implementation note for 14–16: `GROUPS-CHARTS-CALENDAR.md`.

⚠ **One collision to settle.** Ruling 16 names `#fbf1dd/#8a5800` for the `January` phase, and ruling 12's note says never to tint a tag from the status palette — that pair *is* the status palette's amber (Invoiced, Partial). Built to the ruled value, because nudging the hex would put two ambers within a shade of each other and separate nothing. What keeps a January phase from reading as an Invoiced state is shape (a 6px tag is not a 999px pill) and the word, which "colour never carries meaning alone" already requires.

**17 · The rail carries destinations, and nothing else.** A record is not a rail entry: it is opened by clicking its row in a list, and it has a URL but no place in the sidebar. A *section within* a record — reached from the record itself — is not a destination either. Stated as a ruling because the temptation runs one way only: every record type that gets busy enough eventually gets proposed as a rail row, and the rail is the one surface where a wrong entry costs every screen.

**18 · Two-row group headers on wide finance tables.** The previous build drew the group label darker and larger than the column labels beneath it, which inverts the hierarchy — the group read as a heading floating above the table rather than the thing that OWNS those four columns. The repair demotes the label and gives it something to bind to: group label `500 11.5px #181d26`, left-aligned over its first column with 4px beneath; a `1.5px #b8c4d4` rule spanning exactly the group's columns; and the vertical seams between groups at the **same** `1.5px #b8c4d4`, so one weight across the top and down the left makes each group read as a bracket. Column labels are `500 11px #5b6470` over a lighter `1px #dfe5ec`. **The whole page is three line weights** — 1.5px #b8c4d4 group rules and seams, 1px #dfe5ec under column labels and around cards, 1px #eef1f5 between rows — and a fourth means something is wrong. No fill and no tint: an alternating pale-cap version was drawn and rejected, because the page already carries a warnbar and tinted flagged rows. Unchanged with it: no totals anywhere, negatives in parentheses, **an empty tax prints a muted dash while an unknown half prints nothing at all**, flagged rows named once in words, and the three section cards share one column grid so their edges line up down the page. Full text: `GROUP-HEADERS.md`.

**19 · Adjustable column widths.** Replaces the earlier "fixed content-sized columns, no resizing" position: the content-sized defaults stay, and a person can override one. Seams are **absent at rest** and appear **together across the whole header row** the moment the pointer enters it (1px `--rd-border`); the seam under the pointer goes 3px and `--rd-primary`. The hit target is a 3px strip on the column's right edge, inset 6px top and bottom, `cursor: col-resize` on it and on `<body>` for the drag. No seam on the last column — **nor on the filler beside it** (19b), which is furniture rather than a column. ~~Minimum 56px~~ **overruled by the owner (23 Aug: a column must keep shrinking past it); the floor is 12px**, which is what the 3px seam strip needs to stay grabbable — a column narrower than its own handle can never be dragged back, and a drag that destroys a column with no way to undo it is worse than a drag that stops. No maximum — the table grows and `.rd-scroll` carries it. Double-clicking a seam fits the column to its content + 4px. Widths persist per person per table, **keyed by column id, never by index**, and are independent of the show/hide picker: a hidden column keeps its width for when it returns. ~~Two-row group headers and the one-column-per-country sheets do **not** resize — they are fixed-grid proofing surfaces whose cards must stay aligned to each other.~~ **The exclusion is overruled** (owner, 21 Aug: *"Make columns on these types of table adjustable like they are on the other type of table"*). The **reason** stands and is now structural rather than a thing a screen has to be careful about: every card of a shape registers against ONE `useColWidths`, so a seam pulled on one card moves its sibling with it and the two cannot come out of alignment. A card with a different column count is a second grid rather than the same one with columns hidden — one instance cannot measure both. **A one-column-per-country sheet keeps its exclusion**, being a different shape from a group-header table. Mechanics: freeze every column before applying any delta, grow the table by the delta rather than redistributing, and coalesce writes into one `requestAnimationFrame`. Implementation: `components/useColWidths.ts`, `components/Seam.tsx`; the mechanics want a harness run against four tables of different shapes, and the wiring one run on every screen that claims the ruling.

⚠ **Two departures, both recorded in `PORT-NOTES.md`.** (1) The widths go on the **`<colgroup>`, not the header `th`**. The ruling says `th` because in Design's build the colgroup was stripped before render; here the opposite fault applies — `BulkBar` replaces the whole column-header row with one `colSpan` cell while a selection is live (ruling 9), so `th` widths would be discarded on the first tick and the grid would collapse mid-selection. The ruling's *reason* — put the widths where they cannot be stripped — is what was honoured. (2) The **tick gutter carries no seam**. It is 36px because that is what a checkbox is, holds nothing that could want more room, and (until the floor came down to 12px) the ruling's own 56px floor would have jerked it from 36 to 56 on the smallest drag. That arithmetic no longer applies; the exclusion stands on the ruling's other ground — there is nothing in a checkbox gutter to make room for, and a seam there would put a 3px grip beside the row's tick target. The ruling excludes the last column for the same kind of reason and does not mention the gutter.

---

**21 · Never delivered.** Ruling 22 cites it ("per ruling 21 they must still measure identically", about control heights in a card head). No ruling 21 has reached this repo. The requirement it is cited for is legible on its own — every control in a card head measures 30px whatever its fill — so that is what is built and checked; the number is not inferred from anything. Flagged here so the gap is on the record rather than quietly papered over.

**11 · amended twice more, on the owner's word.** The in-cell status pill's history is worth keeping because each step was a correction of the last: built at 10px/1px 8px (smaller than anything the concept draws), capped at 17px so it stopped propping rows open, raised to 20px — *"a little bigger"* — and now, 21 Aug: *"the pills are too small, make them a touch bigger by reducing the padding above/below."*

So the BOX does not grow. 20px stands and the row height with it; the type inside takes the room the air was using, 11.5px → 12.5px — one step up the reading scale and the size ruling 14's band lozenge already wears. The pill family is one type at two heights (20px in a row, 24px in a band) rather than two types at two heights.

Two misuses found and fixed while measuring it, both of which read as "the pill is a bit small" rather than as the wrong component:

- **`rd-tag-sm` in a status column.** It is documented as a state riding beside a NAME — "Linked", "Default". Worn where the pill IS the cell (Popups' Status and Translations, the new Shipments screen) it made the one word the column exists for the smallest thing in the row. Inside a cell the size cap wins on specificity, so the mistake showed up only as a wrong padding, which is why it survived.
- **A category drawn as a pill.** Ruling 12 lets the SHAPE carry the distinction — 999px is a status, 6px is a taxonomy value — and one screen's From/To locations shipped as pills, which reads as something the row is currently doing.

`scripts/prove-pills.mjs` measures both, across a status-column screen and a status-BANDED one, and asserts the row height did not move — the whole reason the cap exists. A screen banded by status is declared as such in the check, because a harness that quietly measured nothing there would pass forever.


**19a · Ruling 19 reaches the two-row group-header tables.** The owner's override, above. Four tables, each a paired transaction card, a monthly workings sheet or a set of document cards. Two things had to change in the hook, and both were silent failures rather than visible ones.

**The grid is measured from a row that spans it, not from `thead tr:last-child`.** On a two-row head the identity columns live in the FIRST row under `rowSpan=2`, so the last header row holds only the grouped columns and its cell count never matches. `measure()` returned null there and every drag was a no-op — which is why these tables read as "not wired up" rather than as resizing wrongly, and why it took an owner report to find. It now takes the first row anywhere in the table with one cell per column and nothing spanning: still the header on a plain table, the first body row on a grouped one.

**A seam is asked for by column ID, never by index.** The markup order is not the grid order on a two-row head — a `Total` column can be a `rowSpan=2` cell at the END of the first row and the LAST column of the grid, with eight grouped columns between them coming from the second row. An index taken off the markup draws a seam that drags perfectly and sizes a different column.

The check (`scripts/prove-groupresize.mjs`) walks the head the way a browser does to build the grid order, then asserts: every column but the last and the filler carries a seam (19b); a drag sizes the column it is on and no other; **a drag on one card moves the other by the same amount**; and the width survives a reload. Worth recording what actually holds the alignment, because it is not the obvious thing — both tables render one hook's `widths` array, and the hook painting every registered table matters only DURING the drag. Splitting the refs alone does not break it: the first attempt at negative-testing this did exactly that and passed, because React was still handing both tables the same colgroup. Two whole `useColWidths` instances is the regression, and that is what the check fails on.

**19b · The room left over goes into an empty column, not a real one.** The owner, 24 Aug, overruling how this was answered twice before: *"On column resizing, it still snaps the right most column back to the edge and expands it to fill space. Instead, another empty column should appear to the right of it to fill space."*

A table narrower than its card has to put the surplus somewhere, and both earlier answers put it in a REAL column. First the one the screen declares flexible — which is the identity column, and the one people drag, so it sprang back under the hand that narrowed it. Then the last column that was not being dragged — which fattens a date column to 400px for a reason its reader cannot see. **A column holding nothing can take the room without telling a lie about anything**, so every resizable grid gains one: `{ id: 'fill', w: null, filler: true }` at the end of its `ColDef[]`, `<Filler head />` at the end of the header row and `<Filler />` at the end of every body row.

**It is a real cell, not a CSS trick**, because three things have to run through it and all three are cell behaviour: the header stays opaque and sticky across it, the row hairlines reach the card's edge, and a group band's fill does too. A cell-less column in the colgroup gets none of them and the hole shows.

**It appears when somebody has sized something, and not before.** Unsized it would be a second auto column beside the identity column the concept leaves undeclared, and the two would share the surplus half each — which is not the drawing. Until the grid is pinned no column has been resized, so nothing can spring back and the table looks exactly as it was drawn; the filler is collapsed to zero and takes no room at all. Every harness asserts that 0, because a filler with width on an untouched grid is the divergence this ruling is careful not to be.

Three things the rollout to the other ten tables turned on, each of which fails somewhere a screenshot does not look:

- **Every row needs the cell.** Header, body, foot, expanded, conditional. A row one cell short does not look wrong on itself — the misalignment shows further along the table, on the rows that have it. `scripts/lib/resize.mjs` and `prove-groupresize.mjs` now count every body row's coverage against the grid.
- **A spanning cell that reaches the card's edge needs one more.** `GroupBand`'s `columns`, `BulkBar`'s `columns`, `AddRow`'s, an empty-state `colSpan` — all of them, and all now derived from the screen's own `COLS.length` rather than typed, so the count cannot drift again. A spanning cell that covers only PART of a row does not change.
- **On a two-row group head the filler is a `rowSpan={2}` cell in the FIRST row**, beside the identity columns. Written into the second row it leaves the first one a column short and every group slides one place left of the figures it names.

**Two columns withhold a seam at the end now, not one:** the filler, which is furniture, and the last real column, which is the one this ruling's "no seam on the last column" was written about and still is. The seams are the same seams as before; only what "last" means moved.

Deliberately **not in the concept**, which draws no such column — recorded in `PORT-NOTES.md`. Implementation: `useColWidths.ts` (`ColDef.filler`, excluded from `total`/`pinned`/`commit`), `Filler.tsx`, `.rd-fill` in `redesign.css`. Checks: `prove-resize.mjs` on four tables of different shapes, `prove-groupresize.mjs` on all four group-header cards, `lib/resize.mjs` on every screen that claims ruling 19, and each screen's own `shoot-redesign-*` harness comparing against the concept's count PLUS the filler.

**24 · Page titles are icon · chevron · name.** From Design, 22 Aug 2026; reference turns 75a/75b. **Replaces the `Area / Record name` text crumb everywhere.** The old version set the area, the slash and the record name all at 22px, so the three read as one string and the slash took as much room as a word.

A **record page** draws the area's own sidebar glyph at 19px, then a chevron, then the name at ~~24px~~ **22px** (overruled below) /400 with `letter-spacing:-.008em`, 4px clear. A **list page** — where the area IS the title — draws the glyph in full `#181d26` and its own name, no chevron: nothing is lost, because there is no deeper level to show.

- **The glyph is the area's own nav icon**, same set, 1.7px stroke, `currentColor`, so a title and its sidebar row are unmistakably the same thing. Never a different or decorative icon, and the stroke does not scale with the size.
- **34px hit area, no box at rest.** On hover a 9px-radius `--rd-hover-square` (`#e8eaed`) square appears and the glyph darkens to full ink. 34 is deliberately one notch above the 30px control height (ruling 21): this is navigation, not a button in the action row, and it must not line up with them.
- **Chevron**: 18px box, 1.35px stroke, `--rd-crumb-chev` (`#b6c0cc`), pulled `-2px` toward the icon so icon+chevron read as one crumb rather than three evenly-spaced things. **Drawn, never the text glyph `›`** — a character takes the font's metrics and sits on a baseline it shares with nothing here.
- **The icon must carry `aria-label` and `title` naming the area.** A glyph alone is not a label: it is legible here only because the sidebar is always visible, and neither a screen reader nor a first-time user gets that for free.
- ~~**24 replaces 22 in the type scale** as the page-title size (`--rd-size-title`).~~ **Overruled by the owner (24 Aug 2026, on a screenshot of an icon-and-name title: *"the header doesn't need to be so big in font, and can be a tiny bit closer to top"*) — the title is 22px again, and the head sits 6px higher.** Rendered at 24, 22 and 20 before choosing: 20 leaves the name barely taller than the 34px icon square beside it, so the crumb reads as an icon with a caption; 22 keeps a clear step above the 30px controls under it and is the value this clause replaced. It is also the only choice that keeps every step of the scale distinct — 21 is the KPI figure and 20 the document header. **The offset is the shell's, not the screen's**: `.rd-page`'s top padding goes 18px → 12px, so the title's top edge lands at 60px under the 46px top bar where it was 66. Every screen wears this title, so there is exactly one token and one metric to change and no per-screen value anywhere. The rest of the ruling stands — the icon, the drawn chevron, the 34px hit area, the tracking and the ARIA label are untouched. The loading harness now asserts both numbers outright rather than only comparing the loading title to the loaded one, and the screen harness reads 22px.
- Rejected: a bordered square at rest (too many boxes on a screen already carrying cards, tags and buttons), the glyph in full ink with no separator (gives up the two-level reading), and a back-arrow pairing (redundant once the hover affordance exists).

**The area comes from the ROUTE, not from the caller.** Twenty-five screens pass a crumb; asking each to name its area again is twenty-five chances to name a different one from the sidebar's. `Crumb` reads `useRoute().app` and takes `hops` only for the destinations. A screen with no hops gets the list form — which is also what the skeleton now renders, so a loading title is the same title as the one it loads into.

The check asserts the icon is 34×34 at 9px radius, carries a non-empty `aria-label`, is **not** the same height as the buttons beside it, that the separator is an `<svg>` at 1.35px and not a character, that the name is 22px/400 at `-.008em`, and that hovering paints `rgb(232,234,237)` with full ink.


**27 · Interaction polish and motion.** From Design, 22 Aug 2026; full text in `INTERACTION-AND-MOTION.md`, reference turns 83–89. Sent twice, an hour apart; the two sends are byte-identical, so there is nothing to choose between them. Nothing in it adds a screen: every item "removes a step someone takes several times a day, or replaces a moment where the interface teleports."

**§0 · The motion budget — the part everything else hangs off.** One curve, `ease-out`, and two durations: **120ms** for a state change (row, cell, control, tint, fill, collapse) and **160ms** for an overlay (popover, dialogue, menu, warning band), scaling from .96–.98. Three exceptions with reasons rather than tastes: **80ms** for anything tracking the pointer, because a crosshair on a longer curve reads as lag behind your own hand; **140ms** when several rows travel at once; **420ms** for a one-off chart draw-in. No bounce, no overshoot, no spring — a 300ms overshoot was drawn in `83h` as the counter-example and rejected.

These are **tokens**, `--rd-ease` and `--rd-dur-state|overlay|pointer|rows|draw`, for the reason ruling 10's sizes are: a duration typed at the point of use is copied by the next screen and got slightly wrong by the third. Every duration already in `redesign.css` was moved onto them, so there is now exactly one place the admin's motion is described. `scripts/prove-motion.mjs` walks every element of a rendered screen and fails on any non-zero duration that is not one of the five, or any curve that is not `ease-out` — which is what makes the token the rule rather than a convention.

**§7 · Reduced motion, and the ruling's own test for whether an animation was decoration.** Under `prefers-reduced-motion: reduce` every duration goes to 0 and **no behaviour is lost**. Zeroed rather than removed on purpose: `transition: none` and a 0ms duration land in the same place, but a 0ms duration still fires `transitionend`, and a rule that stopped the event would leave anything settling on it stuck mid-travel — the one way a reduced-motion switch could actually break a screen. The check runs the whole suite twice and asserts, with motion off, that the box is still ticked, the bar is still up at full opacity and the dot is still on the current page.

**Implemented, with the clause numbers, so what is NOT here is legible too:**

- **88b · The tick draws, the box fills.** The most-clicked control in the admin. The mark was the character `✓`; it is now a stroked path drawn on via `stroke-dashoffset` over 120ms, so it is made in the direction a hand makes it. Two bugs went with the character: an instant tick gave no confirmation the click landed on the row you aimed at, and a glyph is centred by a text rule against a line box, so the box carried a `font` declaration to hold it — a type value doing a drawing's job, which is ruling 24's objection to the text chevron. The indeterminate mark grows from its centre instead, because a bar drawn from one end reads as a tick going wrong. Nine call sites; `Tick.tsx`.
- **86b · Segmented fills slide and resize.** One fill behind the buttons, travelling and resizing to the option pressed — a background on the chosen button cannot move between two elements. Which button is chosen is still read off the `.on` class the callers already set, rather than taken as a prop: four screens drive this control four different ways, and a second source of truth for "which one is on" is a second thing that can disagree with the first.
- **86a · The active dot travels.** One dot in the rail, moved to the page you opened, instead of one per row switching off in one place and on in another. It is mounted only while the open area holds the current page, so moving between areas remounts it — there is no path to travel along between two lists, and sliding down from the top of a rail it was never on would say something untrue.
- **88d · Menu items arrive in order**, 14ms apart, under a panel that grows from its own top-left corner. **85b · Overlays grow from what opened them** is the same motion: popovers scale from their anchor's corner (and from the bottom when they flip above a row), and the dialogue from its own centre at .96, since a dialogue has no anchor on the page.
- **85e · The bulk bar cross-fades in place.** Ruling 9 already put it in the header row's own box; what was missing was that the replacement reads as a replacement rather than as one row vanishing and another being there.
- **84d · Copy flashes where the value is**, `#e7f3ea` for 900ms rather than 1400 — the old hold was long enough that a second copy landed while the first was still lit, so two copies read as one.
- **88c · The knob travels, the track follows** at 120ms both (it was 150), and every other duration in the stylesheet with it.
- **§0's pointer exception** has a home: the chart's crosshair and readout glide between whole weeks at 80ms. The chart answers for a week, so it snaps to weeks; gliding between the snaps is what makes it read as tracking rather than as flicking.
- **Trap 5** is applied — `contain: layout style` on cards and dialogues, `layout style` and never `paint`, which would clip popovers to the card and is the defect ruling 23 had to dig out of `.rd-t27 td`.

**Not implemented, and why — all recorded in `PORT-NOTES.md`.** The owner's steer was highest-value-first with the stopping point left to judgement, so this list is part of the delivery rather than an apology for it. **83f/88i/89h** (sticky header, its scroll-proportional shadow, pinned group bands) are a second session's work and would have collided. **83j** (prefetch on hover) is already beaten by what is there: `useWarmScreens` warms every screen the person may open, one at a time, yielding to any screen they are actually waiting on — hover-prefetch on top of it would only add bursts. **83a** (skeletons at the real geometry, no spinners) was already built and is now asserted rather than assumed. **88a** is half-implemented, deliberately and with a measurement behind it — the ink eases, the label does not rise, because in flow every way of animating it makes the field swell past its final height and come back, which is the overshoot §0 rejects by name. **83b, 83c, 83d, 86e, 83e, 83g, 89a–89e, 89g–89j, 85a, 85c, 85d, 86c, 86d, 87e** are behavioural rather than stylistic — optimistic writes, counting figures, stale-while-revalidate, FLIP row travel, keyboard navigation, the command palette, axis zoom — and each needs work inside the screen that owns it rather than in the shared layer this ruling's foundation lives in. **88g** (arming a destructive action) already ships, from ruling 23.

The check is `scripts/prove-motion.mjs`. It proves travel the only way that means anything: sample the position every frame across the transition and require a frame strictly BETWEEN the two ends, because a jump passes a start-and-end check. Fourteen deliberate breaks were run against it and all fourteen were caught — including the two that only failed once the break was made properly, which is worth recording: a second `useLayoutEffect` writer was quietly repairing a broken measurement, and a "one dot per row" regression has to actually render two dots before the count can object to it.


## 89h · A group band pins under the header and hands over

The owner, 24 Aug 2026: *"Groupings on tables should be sticky like headers."*
Design asked for the same thing in ruling 27 and it was deferred at the time as
a second session's work, in its own words: *"position:sticky under the header;
the next band pushes the current one out. The group you are inside is always
named, fifty rows down."*

Eight grouped tables carry ruling 14's band —
All payments, Vendors, Shipments — plus Products' family rows and the Targets
sheet's family band. All of them now pin.

**The hand-over is the whole ruling, and CSS will not give it.** A sticky table
cell is clamped by its TABLE, not by its row group. Left at that, a band whose
group scrolled a thousand pixels past was still parked under the header and the
next band landed on top of it: two 50px opaque bands, one sliced through the
middle by the other, which is worse than no sticky at all. Two CSS answers were
measured before any code was written — `position: relative` on the tbody
changes nothing, and `display: block` on the tbody does clamp it and takes the
column grid apart, which is the fault a stray `display: flex` on a table row
caused on this same sheet a day earlier.

So the clamp is computed, once per frame per band:

    top = min(headerHeight, groupBottom − portTop − bandHeight)

While a group has more than a band's worth of itself left below the header, the
band sits AT the header. Once it has not, the band is pushed up by exactly the
shortfall and leaves as the next arrives. Every read is taken before any write,
and a band whose top has not changed is not written to — scrolling inside one
long group, the common case, touches the DOM zero times.

**Three things this cost, all of them recorded where they bite:**

1. **One `<tbody>` per group.** Not decoration: the hook measures the group's
   box to know when to push, and with a single tbody every band is measured
   against the whole table and none of them ever leave.
2. **The head becomes its own stacking context** (`position: relative;
   z-index: 9`). z-index 8 on a header cell against 6 on a band is not enough
   and the reason is not obvious — a thead and a tbody do not order their
   positioned cells against each other by z-index alone. With only the cell
   numbers set, a band painted straight over the "Change status" menu, and
   lowering the band to 3 or even 1 did not help. Lifting the whole head does,
   and it puts everything hanging off the head — menus, popovers, the bulk bar
   — above the bands with one declaration.
3. **No ResizeObserver.** The first version observed the table so a folded
   group would re-measure. The observer fired, the frame wrote a `top`, and the
   write brought the observer round again — a loop that never settles and does
   not look like one: the screen renders correctly and the page simply never
   goes quiet, so what failed was an unrelated harness waiting on the network.
   A dependency-free effect on the band does the same job for nothing.

**One departure, and it is a design question rather than an oversight.** The
One sheet nests three levels — family, variant, section. Only the FAMILY
band pins. Three pinned at once puts 84px of heading over a 26px sheet and
leaves less of the figures on screen than the ruling saves; the top level is
the one that answers "whose numbers am I reading". Raised with the owner rather
than settled here.

One chart screen's `.rd-bandrow` is deliberately NOT sticky. It is a single rollup
line — the answer above the breakdown — not a grouping, which is why the rule
is scoped to a cell that asks for it rather than to the class.

`scripts/prove-sticky.mjs` holds all five behaviours, each watched failing
first: the band pins at the header's height, it is still there fifty rows into
its group, two bands never overlap by so much as a pixel at the hand-over, a
band goes under the headings rather than over them, and folding a group
re-measures without a scroll. That last one passed against the very bug it was
written for until it was rewritten to fold AFTER scrolling — setting scrollTop
to the value it already holds fires no event, so the check was being answered
by its own scroll.


## 89i · Shift-click a tick and the rows between are selected

The owner, 24 Aug 2026: *"if I click a selection button on a row on a table and
press shift and click another a few down, it should select all the rows in
between."* Which is how every list anybody uses works, and how none of the
eight ticked tables in this admin worked.

**The gesture is not the interesting part; the eight copies are.** Each screen
kept its own `useState<Set<string>>` and its own three-line `toggle`, so a
range would have been eight copies of the same twenty lines and the ninth
table would have got five of them. That is the shape of fault that let the
one band carry a chevron with no handler behind it for months. So the
set and the anchor live in `usePicked`, the gesture lives in `RowTick`, and a
screen supplies neither.

**"In between" means the order the table is DRAWN in**, and that order is read
off the DOM at the moment of the press rather than from any array the hook
could be handed. A grouped table interleaves its bands, a sorted one reorders,
and a folded group's rows are not on the screen at all — a range taken from the
data would sweep in rows nobody can see and hand a bulk action a count that
does not match what is ticked.

**A shift-press only ever selects.** The owner's words are "select all the rows
in between", and a press that could also deselect would make the same gesture
mean two things depending on a state — whether the anchor happened to be ticked
— that nothing on the screen shows.

The anchor is the last row pressed without the modifier, and a shift-press
leaves it where it is. Worth recording honestly: because the range only ever
adds, that is barely observable — from any anchor already inside the union the
union comes out the same. What IS observable, and is checked, is that a plain
press moves it.

**Three things that are easy to leave out and each show as a bug:**

- `data-tick` carries the row's id and is what the range is read from, so it is
  set by the component rather than by a caller who might forget.
- **A shift-press must not select TEXT.** Shift-clicking two points is the
  browser's own "select everything between", and it fires alongside whatever
  else the click does — unsuppressed, the range gesture leaves eight rows of
  the table highlighted blue. Suppressed on mousedown, where the browser starts
  it, and only when the modifier is down.
- **Space ranges too.** A gesture that works with a mouse and not with a key is
  a gesture somebody has to learn twice.

The Log queue is adapted rather than converted: its selection is owned by
`LogView`, which also drives the incumbent shell, so the set stays there and
only the range — and its anchor — is worked out in the redesign's screen. An
anchor in the parent would be shared with a view that has no gesture to move
it.

`scripts/prove-range.mjs` holds six behaviours and `tests/redesign/rowTick.test.ts`
pins the other half of the ruling: no screen draws the checkbox by hand any
more, every `RowTick` is wired to a press that knows where the range started,
and all eight tables still draw one.

One check was worthless when it was written and is worth recording as a trap.
The no-text-selected assertion passed with the suppression deleted, because a
browser extends a text selection from the last caret and clicking a tick — a
span holding an SVG and no text — sets none. It clicks the card's foot first
now, which is what a person's click history does for them.


## 89j · A header's actions are one height, and read as one

The owner, 24 Aug 2026, with a picture of the order record's header: *"I think
More actions is not as high as Invoice. Align them on all layouts like this."*

**Measured first, and the measurement is the interesting part: on that screen
they were already the same.** `.rd-chip` and `.rd-btn-pri` both came out
26.39px from the same padding, font and border — the chip with its chevron
included. What differs is CONTRAST. The chip was white with a 1px
`--rd-border` edge on a near-white page, so its top and bottom edges are barely
there and the eye takes the text block for the control. It reads shorter beside
a solid blue whatever the box model says.

The concept settled this and the app had drifted from it. `#s-*`'s `.btn` is
`height:32px; min-height:32px; max-height:32px` with `.btn.sec` on `#e2e5ea` —
a declared height so no two controls can differ, and a secondary that is a
BLOCK. The app had dressed the header's secondary as `.chip`, which in the
concept is a different component again: a 28px bordered pill for TOOLBAR
FILTERS. One class was doing two jobs and had taken the wrong one's clothes.

So a header's secondary is the concept's secondary button — `--rd-btn-sec`,
the mock's own value — and every control in the row carries one declared
height. Filter chips are untouched; they live in `.rd-toolbar`, never here.

**The height is the app's 26, not the mock's 32.** This redesign runs denser
than the concept everywhere (34px rows against 42), and 26 is what the padding
already produced — declared now so it is a whole pixel rather than 26.39, and
so two controls cannot drift apart again. `--rd-head-control-h` is named apart
from `--rd-control-h`, which is a different control: the bulk bar's pill, built
from 4px of padding rather than 5, coming out 24.4. Reusing it here quietly
took 2px off every header button on the way past — the drift this token exists
to stop, arriving through the token itself.

**Measuring every header found a worse case than the one reported.**
A finance screen's period picker is a `.rd-select`, which carries a FIELD's 7px
padding, and stood **34px beside a 26px** Download button. Another screen's picker, one
screen over, is a `.rd-chip` and always matched. Two classes for the same
control in the same position is the whole fault, said twice.

`scripts/prove-headactions.mjs` checks both halves, on the classes themselves
so it holds for a screen written tomorrow, and on six real headers. The
contrast half is checked as a SIGNED comparison against the page: a secondary
sits on or below the page's own tone, never above it — a control lighter than
the paper behind it reads as a hole with a hairline round it. An unsigned
distance passes both states, which is how the first version of that check
passed with the fill taken back out.


## A form box reads from the left, whatever is in it

The owner, with a picture of a "Followers / 500" field: *"Across the app we
need to be left aligning form boxes, even when they are numbers."*

A `Field` marked `numeric` right-aligned its value, so a figure sat at the far
edge of a 340px box, away from the label naming it, and a column of fields had
no left edge to read down. Thirty-nine call sites across Rate data, the Box
planner, the productions ledger, the payment record and the order.

**This is a correction toward the concept, not away from it.** Every
right-alignment in `#s-*` is a COLUMN of figures or a key/value fact list —
`.wb .num`, `.kv .v`, `.payrow .pv`, `.docfacts dd`, a typed cell in a lane.
The mock never right-aligns a form field; the app invented that.

**What stays right, and why.** Right-alignment is for a column, where the point
is that the units line up under each other: a table's `.n` cells, the order's
line cells, the totals box at the foot of them, and a typed cell inside a
sheet's figure column. None of those is a form box. A planner's Needed /
Buffer / In stock / Order columns are the clearest case — its Buffer cell is
typed INTO and still right, because it belongs to a column rather than to a
form.

**The tabular figures stay.** They are a different thing from the alignment:
they stop a digit changing width as a value is typed, which is what makes a
figure jitter while somebody edits it. Deleting them alongside the alignment is
the easy mistake, so the check asserts both.

The class is `rd-figs` now, not `rd-n`. `n` has meant "a number, so
right-aligned" in this app since the first table — `.rd-t td.n` still means
exactly that — and a class keeping the name while losing the alignment is a
trap for whoever reads it next.

Checked in `shoot-redesign-payment.mjs`, which is where the numeric fields are:
an amount and two tax figures. The count is asserted first, because a check run
on a screen with no numeric field would pass on any rule at all. Both halves
watched failing.

Nothing on the incumbent shell needed it — every `text-align: right` in
`styles.css` is a table cell, a tooltip value, a timeline head or a totals row.


## 91b · The collapse chevron takes no row of its own

The owner: *"I don't like the way the collapse chevron creates a gap above
home."*

Ruling 91 put the chevron at the rail's top right and it took a 30px band to
sit in, holding nothing else — so the rail opened on a strip of empty white
with Home beginning below it. The gap is not decoration anybody chose; it is
what a control gets when it is the only thing on its row.

**30px is exactly one nav row, and that is what makes this a fix rather than a
nudge.** Out of the flow the chevron lands ON the first row, at the rail's
right edge where nothing is drawn, and Home moves up to the top of the rail.
The chevron keeps the corner ruling 91 gave it — the same corner, one row
further up. Its `top` is the rail's own 12px padding plus the 2px that centres
a 26px control in a 30px row: both numbers are the rail's, and a third number
invented here is how a control drifts off the row it is meant to sit on.

**Collapsed keeps the row, and that is the one trade.** At 56px there is no
right-hand edge to sit in — the rail is one centred icon with about eleven
pixels either side, and a chevron laid over that is a chevron over the Home
icon. It costs nothing there: every row is an icon, so an empty one at the top
reads as spacing rather than as a gap under a heading. The cost is that the
icon column settles 30px when the rail is collapsed or re-opened, inside a
transition that is already redrawing the rail's whole width. Worth naming
rather than hiding; if it reads badly the answer is a second decision about
where the chevron goes when the rail is narrow, not a third number here.

`prove-rail.mjs` asserts it on the OPEN rail deliberately — collapsed still
keeps the row, and a check that took whichever state it found would pass on
the fault half the time. Three things: the first row is flush with the top of
the rail's content, the chevron's centre is the first row's centre, and the
chevron is the element under its own pointer, because a control laid over a
nav row that let the row take the click would navigate instead of collapsing.


## 92 · A column caption inside a well is a table header, not micro-caps

The owner, with a screenshot of a table's header row: *"Use a header
style like this one."*

The agreement builder shipped its column captions as `.rd-linehd`'s micro-caps
— 9px, 600, `.07em`, uppercase, `--rd-ink-faint`. That was right for what the
screen was then: a caption floating in open space above some rows, with nothing
around it to say where the column began. Caps and letter-spacing were doing the
work an enclosure would otherwise do.

The well took that job. Once the rows sit in an inset panel with a hairline
under the first row, the caption is not floating — it is **the header row of a
small table**, and the app already draws one of those: `.rd-t27 th`, which is
`--rd-weight-emphasis` at `--rd-size-head` in `--rd-ink-head`, sentence case,
34px tall, one `--rd-border` hairline under it. So `.inf-cap` is now that rule
and nothing new was invented.

**This narrows the caps role rather than ending it.** Micro-caps keep the
places they were ruled into that are still captions in open space —
`.rd-floathd` menu headings and `.rd-bandcap` band captions.

*(Amended: `.rd-linehd`, the order record's line editor, was on that list and
has since come off it — not against this ruling but by it. The order's lines
now sit in a well too, so its head is enclosed and takes `.rd-t27 th`'s rule.
The list is a consequence of the principle below, and moves when a screen
does.)* The distinction to carry forward: **caps are for a label with no
enclosure; a label inside one takes the header rule.** A screen that encloses
its rows and keeps the caps is now the drift, not the other way round.

The 34px header also settled a phone question the previous round had answered
the other way. Captions used to be hidden under 700px, because a floating
caption row on a 390px card was noise the row could speak for itself. Inside
the well it is structure, and it stays: `prove-inset.mjs` measures the phone
header along with the desk one.

`prove-inset.mjs` is the check, and it does not compare screenshots. It renders
the approved artboard and the live screen, measures the same anatomy in both —
card padding and radius, the well's inset from each card edge, its radius and
edge, the header's height, rule, type and ink, where the caption starts against
where the row's name starts, row height and rule, the value box's width and
right edge, the add button's height and radius — and prints every value that
differs, for all four cards. Two things it deliberately ignores: the colour of
a 0px border, which is inherited and never painted, and the box model, which
the artboards were given `border-box` for so that both sides measure the same
thing. Four earlier rounds shipped a screen that resembled the mock; this is
what stops the fifth.


## 93 · A row of fields is equal columns, and a class is styled or it is not

Two faults the owner reported twice, which is once more than they should
have been. Both had the same shape: a check existed, passed, and was not
actually looking at the thing.

**The row.** `flex: 1 1 0` cannot make a `.rd-field` and a `.rd-pickwrap` the
same width. A zero basis is a zero BORDER box, which each item then floors at
its own padding and edge — 28px for a field, nothing for a picker, which is a
bare positioning shell with the padding on its child. So the field came out
exactly 28px wider however the flex numbers were written, and chasing it with
basis values is what brought it back. `.inf-row` is a grid now
(`grid-auto-columns: minmax(0, 1fr)`): tracks are sized before the items go in
them, so padding cannot reach them. The two `width` props that pinned a picker
at 150px are gone with it — nothing may fight the tracks. The check measures
EVERY row in the dialogue, because the first one measured only the City row
and left Postcode/Country, the pair actually complained about, unlooked at.

**The class.** `rd-btn` rendered as browser chrome — grey fill, system edge —
on a dialogue's button, while `classesExist` passed. The only place the name
appeared in any stylesheet was `.inf-dlgfoot .rd-btn` inside a
`max-width: 700px` block: a flex hack for the phone, no colour, no edge, no
padding. The test counted that as defined. It now measures against the CSS
with every `@media` block stripped, so a class whose only styling is
conditional is not styled. A genuinely phone-only helper goes in NOT_CLASSES
with its reason, like every other exception there.

The same test had a second hole, which is how `rd-chip-on` went undefined for
months while the Archived filter showed no active state. The scan pairs quote
characters in source order, and an apostrophe in a comment — "the owner's",
"does not" — shifted every pairing after it, so long stretches of real code
were read as the inside of a string and skipped. Comments are stripped before
the scan now. `tokens.css` was also missing from the stylesheets the test
reads, which hid `.rd-shell` the moment the other two holes closed.

Both were negative-tested by putting the bug back and watching the test name
it. The rule underneath all three: **a check that has never failed has not
been shown to work.**

## 94 · The rail goes to the top, and the path leaves the title

The owner, 27 Aug 2026, on the ElevenLabs admin: *"the sidebar goes all the
way to the top, then a thin grey line separates the header from the contents
underneath… have a small breadcrumb in the top bar, then have the name of the
section bigger below. The bar itself can be a bit less high. This means taking
away the icon and > before the list's name."* Then, on the palette and the rail's edge:
*"I'd copy ElevenLabs on those points."*

**The rail runs the full height of the window** and carries the wordmark, so
the top-left corner of the app belongs to the sidebar rather than to a band
across the top. In the DOM this is one change and everything else follows from
it: the rail is a SIBLING of the bar, not something underneath it.

**The bar belongs to the work area.** It is `--rd-bar-h` (44px, down from 46,
because it gave up both the wordmark and the page title), it begins exactly
where the rail ends, and its hairline stops there too. That last clause is the
whole point and the easiest thing to get wrong: a bar that reached back to
x = 0 would look almost right and would cut the rail in two. `prove-shell`
measures `bar.left === rail.right` for that reason and nothing else.

**The chrome is light and warm.** The navy bar is gone. The rail is the one
tinted surface — `--rd-rail: #f7f6f4` — and the work area beside it is white;
ElevenLabs' way round, and the inverse of the cool desk this shell carried
until now. Six variants were rendered on a real screen before the
choice: neutral goes flat, and it is the warmth that stops a light chrome
reading as a hospital. **The rail draws no right-hand border**: against a white
work area the tone change is the edge, and a hairline on top of it is one thing
too many.

**Ruling 24 is superseded.** A page title was `icon · chevron · name`; it is
now the name alone, and the path — `Billing / Invoices`, at `--rd-size-head`,
the hops as links and the page itself not — is in the bar. The path is said
ONCE. Drawing it in front of the title as well is what made the old title
heavy, and it is what the owner asked to have taken away. An area's own home
says its name once too: `Permissions / Permissions` is what the naive path
reads on every screen where the area IS the page, so that case collapses to the
leaf.

**Three things this cost, each found by rendering rather than by reasoning.**

The leaf cannot be read off `children`. A title is not always a string — the
a country screen hands its name in with a flag beside it — so inspecting the
prop returned an empty leaf on exactly the screens whose names are worth the
most. `Crumb` reads the text off the node that draws it, which means the bar
says what the page head says by construction.

A publisher must only clear what is still its own, and must clear its own memo
with it. `Skeleton` draws a `Crumb`, React mounts the arriving screen before it
unmounts the one it replaces, and StrictMode mounts every effect twice. The
first version published-if-changed and retracted on unmount; the retract left
the "what I last said" memo populated, so the remount thought there was nothing
to say and the bar rendered empty on every screen in the app.

`.rd-wordmark-tight` lost to `.rd-wordmark` on source order. Both are a single
class, so the later rule won, the `display: none` did nothing, and the collapsed
rail grew the badge back as a second row above Home — the exact fault 91b
removed. Stated after the rule it overrides, it works. **Specificity ties are
decided by position, and a rule appended to the end of a stylesheet is always
in the later position.**

**A harness must report what it found before it tries anything.** The first
`prove-shell` measured the shell, then clicked a hop. Under the very fault it
exists to catch — a bar laid back over the rail — the hop is unreachable, so
the click threw and the run died reporting NONE of the structural faults it had
already collected. The interaction is wrapped now and a failure to press is a
fault like any other.

## 94a · Two segments, and a bar that is never empty

Follow-ups to 94, on the owner's rulings of 27 Aug 2026.

**A record's path stops at two.** `Billing / Invoices / IN-042 · Northgate
Freight` says the record's name twice — once at 12px in the bar and once at
22px an inch below — and makes the bar a different length on every record. The
bar carries the way BACK; the title carries the name. So a screen that sits
under something shows the area and the nearest list, both links, and stops.

The mechanism was already there and being thrown away. `hops[0]` supplies the
AREA's destination, and its label was discarded in favour of the area's own
name. That is right when the two agree — an account record's first hop is
"Accounts", which is the area — and wrong when they do not: an invoice record's
first hop is "Invoices", the list it belongs to. Keeping a first hop that names
something other than the area is what turns `Billing / IN-042 · Northgate
Freight` into `Billing / Invoices`.

Three shapes, and every screen is one of them:

| screen | passes | bar |
| --- | --- | --- |
| an area's own page | no hops, leaf = area | `Permissions` |
| a list | no hops | `Billing / Invoices` |
| a record | hops | `Billing / Invoices`, both links, no leaf |

A record whose parent list shares the area's name — an account, a payment, a
message — collapses to one segment pointing at that list. One segment that
reaches the right place beats two that say the same word twice.

**The bar is never empty.** The home page draws no title of its own, and every
screen whose data source is unreachable renders an error instead of a header,
so the bar was blank on the app's front page and blank again on any screen that
failed to load — 13 of 27 routes on a machine without credentials. The route
always knows the AREA, so the bar falls back to it. The area's name over "this
section has no data source" is worth more than a hole, and it made the count
0 of 27.

**One back button went, not four.** A `← All countries` on a country screen
duplicated the bar's own hop and is gone. The other three that look like it are
not the same thing and stay: two render only on an escape-hatch shell where
there is no bar to duplicate, and one moves between STEPS of a wizard, which no
crumb reaches. **A control that
looks like a crumb is not necessarily a crumb** — the test is where it goes,
not what it is called.

## 95 · If it acts, it says so — and it is big enough to aim at

The owner's standing rule, 27 Aug 2026: **always make it tappable.**

**A `<button>` defaults to `cursor: default`,** so any control that never named
one looks exactly like text. An audit across twelve screens found 34 of 286
live controls like that — including **the sidebar's own rows**, the most-used
control in the admin, which had gone the entire redesign without a pointer.

The shell states it once now, for everything enabled inside it, rather than
per component: the next control somebody adds is tappable without having to
remember. What is deliberately NOT pressable says so in its own rule, and
those rules come later in the file and win.

Two of them were showing it without ever SAYING it. The area row you are in
had a `default` cursor; a forbidden area sat at 0.38 opacity. A cursor is not
an accessible name and a faded button is still a button to anything that
cannot see it, so those now carry `aria-current` and `aria-disabled` — which
is also what lets the check tell a deliberate `default` from a forgotten one.

**`--rd-tap: 24px` is the floor for what you aim at**, and it never grows what
is DRAWN: the drawing decides the size of the mark, the token decides the size
of the target. It is bought with padding where padding costs nothing, and with
a transparent `::after` overlay where padding would move a neighbour.

**Four things this cost.**

*An overlay cannot escape a clip.* `::after` is a child, so an
`overflow: hidden` ancestor cuts it off — and a table cell clips, which is
exactly where the smallest controls live. The overlay silently did nothing for
them and the pointer still landed on the cell. Inside a clipped cell the room
has to come from the control's own box.

*An element that is already positioned must not be re-positioned.*
`.rd-rulerdot` is `position: absolute` — placed on the ruler by date — and a
`position: relative` stated after that rule wins on source order and drops
every dot into flow.

*Deleting a declaration block from between two selector lists MERGES them,
silently.* An edit that removed `{ position: relative }` from the middle of
one list left the selectors running on into the next rule: the rail toggle
lost its containing block, so its overlay anchored to the shell and laid a
full-width 24px band across the middle of the page swallowing clicks meant for
the rail — and picked up an `inline-block` over its own `display: flex`.

*A hit area is measured by hit-testing, not by reading a box.* An overlay
changes nothing about `getBoundingClientRect()`, so a check that measured the
element would call a fixed control broken and a broken one fixed. The check
walks outward from the centre asking the document what is under the pointer,
and reports what it lands on — which is the only reason the merged-selector
fault above was found rather than shipped.

**Two exceptions, each with its reason, named in the check so they cannot be
forgotten.** Two emails on the SAME DAY draw one ruler dot exactly on top of
another, so the one underneath cannot be reached whatever size its target is —
a stacking fault, not a size one. And the card table's `+ New card` row
overlaps the foot beneath it, so the foot answers for the row's centre; the
press still lands, so it is an overlap and not an unreachable control.

---

## 96 · A tab is an object; the tabs beside it are text

*(Numbered 96 rather than 94: rulings 94 and 95 were taken by the shell
change and the tap-target rule while this was being built. Those landed
first and are cited by `prove-shell.mjs` and `prove-tappable.mjs`, so this
one and the table header below moved rather than they.)*

From the owner, 27 Aug 2026, with a reference shot: a two-tab strip where the
open tab is a **bordered lozenge carrying an icon and its label in ink**, and
the tab beside it is **bare grey text with no chrome at all**.

**The redesign has never ruled a tab.** There is no entry for one anywhere
above, and three near-relatives grew up in the gap instead: `.rd-ltab`
(language tabs, underline), `.scentab` (Workbench scenario tabs, 36px,
"underlined not boxed"), and `.rd-seg` (the segmented toggle). This is the
missing entry.

### The idea, and why it is better than what we have

Underline tabs mark the open one by **taking something away**: every tab is the
same object, one of them has a line under it. That reads at a glance only
because the eye has learned where to look for the line.

A lozenge marks the open one by **making it a different kind of thing**. The
open tab is an object with an edge and a ground; the rest are labels. Nothing
has to be scanned — the shape is the answer. On a strip of two or three that is
strictly more legible, and it costs nothing that the underline was buying.

### The anatomy

- **The open tab is a lozenge**: card ground, 1px `--rd-border`, the control
  radius (ruling 5, 7px), the header control height (30px — ruling 22's "every
  control in a card head measures 30px, whatever its fill"), label in
  `--rd-ink` at the tab size and 500.
- **Every other tab is bare text** at the same size and weight, in
  `--rd-ink-tertiary`. No border, no ground, no underline. On hover it takes
  `--rd-ink`, and nothing else moves.
- **Icons are a property of the STRIP, not of a tab.** Either every tab in a
  strip carries one or none does. In the reference only the open tab has an
  icon, and an icon that appears on selection **reflows the row** — the tabs
  move under the pointer at the moment of the click, which is the fault the
  scenario strip already forbids ("the strip does not reorder under the
  pointer"). Same rule, new control.
- **A tab may carry a mark its strip defines** — the language tabs' completeness
  dot, a scenario's `.tagst`. It rides inside the lozenge when open and beside
  the text when not, at the same offset, so it does not move either.

### One deliberate departure from the reference

**The reference draws the lozenge AND an underline beneath it. We take the
lozenge alone.**

Two marks for one fact is the thing this system has ruled against more than
once — ruling 14 dropped the 12px gap between group bands because "two rules
and a gap say the same thing twice", and the scenario strip says which tab is
the record **in words** precisely so the underline is not made to say it twice.
A lozenge and an underline on the same tab are that fault exactly.

The underline survives in **one** role, where it is answering a different
question rather than repeating this one: where the strip is the top edge of the
surface it switches, the strip keeps a **full-width 1px `--rd-border` rule**
under it, binding the tabs to the thing below. That is "the content starts
here", not "this tab is open", and it runs the whole strip rather than the
active tab.

*Flagged for the owner:* if the doubled mark is wanted verbatim, this is the
line to overrule, and it should be overruled explicitly rather than drifting
back in on one screen.

### What this is not

- **A segmented toggle is not a tab.** `.rd-seg` changes a *value* — a period,
  a unit, a mode — and the screen stays the screen. Tabs change *what is on
  screen*. Two controls, two jobs; `.rd-seg` keeps its filled-ink chosen state
  and is untouched by this.
- **Tabs are never navigation between destinations.** Ruling 17: the rail
  carries destinations, and records and their sections do not appear in it. A
  tab strip switches views of **one subject** — this email's languages, this
  period's scenarios. A strip whose tabs are places belongs in the rail.
- **DESIGN-SYSTEM.md §4b's scenario rule stands.** "Which tab is the chosen one is said in
  words, not by the underline" is about which scenario is *the record* — a
  different fact from which tab is *open*. The lozenge says open; the `.tagst`
  still says record. Nothing there changes.

### Where it lands

Every tab strip in the app, which is four:

| Strip | Today | Screens |
|---|---|---|
| Language tabs | `.rd-ltab`, underline + completeness dot | Email, Popup, Card dialogue |
| Scenario tabs | `.scentab`, 36px underlined (Workbench) | Plan |
| — | `.rd-seg` is a toggle, not a tab | unchanged |

One component, `Tabs.tsx`, replacing `.rd-ltabs`/`.rd-ltab` and absorbing
`.scentab` when Plan is ported. Three copies of a strip is three chances to
word it differently — the same reason `ColumnsMenu` exists.

**Exact metrics are pinned at the mock**, measured against the reference rather
than read off it: port, don't re-express. The harness gets the strip's anatomy
(one lozenge at a time, every tab the same height, no width change between
states, the icon rule) so it cannot drift back to an underline.

---

## 97 · A table header is dark ink on a wash, under the ordinary hairline

From the owner, 27 Aug 2026, with a reference shot: a column-header row whose
labels are **near-black**, sitting on a **very faint wash**, with a **thin rule
underneath** — the owner's words, "this colour, and same thickness of line
underneath".

### What the app does today

`.rd-t th` is `500 11px` in `--rd-ink-tertiary` (#5b6470) on the card's own
white, with a 1px `--rd-border` rule carried as an inset shadow so it travels
with the sticky cell.

Two things to fix while this is open:

- **There are already two header inks.** `--rd-ink-head` (#3f454e) is declared
  in `tokens.css` as "column-header ink" and used in three places — but the
  main table header uses `--rd-ink-tertiary` instead. Same decision, made
  twice, at two values (ruling 7's fault, in a different place). This ruling
  folds them into one.
- **"Same thickness" settles a question that was open.** The rule under the
  header stays **1px `--rd-border`** — it does not become ruling 18's 1.5px
  `#b8c4d4` group rule. Ruling 18's "the whole page is three line weights, and
  a fourth means something is wrong" survives intact, and the header rule is
  the ordinary hairline, not a heavier one.

### The ruling

- **Header ink goes to the top of the ramp** — the near-black the reference
  draws, not a mid-grey. One token; `--rd-ink-head` takes the new value and
  `.rd-t th` is repointed at it, so the two-inks fault closes with the change
  rather than after it.
- **The header row takes a faint wash**, a single step off the card. It must be
  **opaque**: the header is `position: sticky`, and a translucent ground lets
  the rows show through it as they pass.
- **The rule underneath is 1px `--rd-border`**, unchanged, still carried as an
  inset shadow — a real `border-bottom` shifts every cell metric on a
  `content-box` header and fails the parity harness.
- Size and weight are unchanged (`--rd-size-label`, 500). The reference changes
  the colour, not the scale.

### The wash is what makes the dark ink safe — take both or neither

A header as dark as its cells **inverts rank**: the reading scale is "rank comes
from ink, then size", and a column label that out-inks the figures under it is
exactly the fault ruling 18 was written to repair on the finance group headers,
where the group label "read as a heading floating above the table rather than
the thing that OWNS those four columns".

The reference gets away with it because the header is **on a different
surface**. The wash, not the ink, is what says "this row is the frame". Ship the
dark ink onto a white header and the labels compete with their own columns; ship
the wash without the ink and nothing has changed. They are one decision.

### The collision to avoid: this wash is NOT the group band's fill

Ruling 14 puts group bands on `#f4f7fb`. If the header wash lands on the same
value, then on every grouped table —
Vendors, Emails — **the header and the first band read as the same object**,
stacked, with only a hairline between them.

So the header wash is a **new token at a fainter value than the band**, near
enough to white that the band still reads as the heavier thing. That value is
not in the palette today, which is why it is being raised here rather than
picked from what is lying around.

### What it touches

Every `.rd-t` header in the redesign, and three structures that sit next to one:

- **The two-row finance heads** (ruling 18: the wide
  returns). The group-label row and the column-label row are both header; the
  wash covers both, and ruling 18's 1.5px group rules and seams sit on top of it
  unchanged.
- **The bulk bar** (ruling 9), which *replaces* the header row in place on
  selection, at the header row's exact height. It takes the same ground, or
  ticking a box changes the colour of a row that is meant not to move.
- **The sticky header's scroll shadow** (88i), which is drawn on the same cells
  and must still read against a wash rather than against white.
- **Item 2 in the design update plan** — if resting elevation lands, the header
  is a second surface inside a raised card. Decide the two together; a wash and
  a shadow both saying "this is a different plane" is the doubled mark ruling 94
  is about.

**Exact values at the mock**, measured off the reference rather than read from
it, and checked in the parity harness as computed colour on a rendered header —
not as the string in the stylesheet.
