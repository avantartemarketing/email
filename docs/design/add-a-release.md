<!-- Build spec. The flow itself is drawn in the artifact linked from
     HANDOVER.md; this is the detail that would not fit on it. -->

# Adding a release — build spec

Produced 30 Aug 2026 for the owner's ask: *"Design the flow for adding a new
release to the dashboard. Medium term this will be through a sync with Shopify,
but in the short term it will be a CSV download from Shopify per release of all
the Orders."*

Written by a fan-out of twenty-one agents — four scouts over the code, the
fixtures, the sync seam and the design kit; three independent flow designs;
three judging lenses each; a synthesis; then three adversarial verifiers which
returned forty problems, six of them blocking, all folded back in.

**Independently verified before publication** (run against this tree, output in
the session log, probes deleted):

| Claim | Verified |
|---|---|
| `splitLineItemTitle('Falling Light - Framed - Oak')` → variant `Oak`, and `classifyFulfilment('Oak')` → `unframed` | yes — a live routing bug |
| `classifyFulfilment('Falling Light - Framed - Oak')` → `framed` | yes — the fix is the argument, not the function |
| `filterItemsForRelease(items, [])` matches everything | yes — 2 of 2, 0 filtered |
| An empty file yields exactly one issue, drawn under *"1 row could not be read / Everything else was imported."* | yes |
| A semicolon-separated re-export lands on *"Missing required column(s) … is this a Shopify order export?"* | yes |
| `'Falling Light'` DOES claim `'Falling Light - Study'` | yes — punctuation cannot tell a variant from a sibling release |

That last one corrected a comment in `logic/importer.ts` that had been written
the same morning and was wrong.

---

All facts re-derived from the working tree at `30f9b41` (clean). Here is the corrected design.

---

# Add a release — one flow (correction pass)

## What this pass changed, and why the numbers moved

Every figure below was re-run against the tree as it stands. **The previous draft was evidenced on a fixture that no longer exists**: `30f9b41` ("Take the tote bag out of the Shopify fixture") deleted both tote rows and replaced one with a Night Garden line item on `#AA10427`'s continuation row. So the tote-bag worked example, the "297 rows / 295 items", and the whole hyphenated-merchandise failure row were quoting a world that had been edited out. The case that replaced it is **better** and the design is rebuilt on it: an order that belongs to two releases.

**Falling Light, as the file is now** — `parseShopifyOrderExport` at HEAD:

| | |
|---|---|
| Rows in the file | **296** |
| Line items parsed | 296 (0 issues) |
| Distinct `Lineitem name` | 3 — `Falling Light - Framed` (156 lines / 155 Shopify orders), `Falling Light - Unframed` (139 / 139), `Night Garden - Framed` (1 / 1) |
| Distinct Shopify order names in the file | **293** |
| Ticking the two Falling Light rows | 295 line items claimed → **294 Order records** (the exact duplicate `#AA10412` collapses) |
| …from | **293 Shopify orders** |
| …for | **293 collectors** (292 emails, plus `#AA10421` who has none) |
| Newest order | 26 Apr 2026 |

All four order exports: **606 rows, 603 order records**, every row `Lineitem quantity` 1, `Financial Status` `paid` on 604 rows and **blank on 2** — both continuation rows, both in Falling Light. There are **four** order-export fixtures; the fifth constant is `FALLING_LIGHT_ALLOCATION_CSV`, a warehouse sheet with a different header.

---

## Which design this is

The spine is unchanged: **"Read the file first."** The operator drops the export, the app shows the products the file actually contains, and the operator ticks which ones are this release — so the Shopify join key is never typed. From **"The file is the release"**, grafted whole: the `Intake` record, `addOrders`, the chained promise-date dialogue, and the "Products this release claims" correction door. From **"Prove the match"**: `ParseFault` as a type separate from per-row `issues`, and a release with no orders as a real drawn state.

Fatals fixed in the first draft, still fixed: create is not atomic-only; the title is editable and renameable; framing is not derived into `disabledTemplates`.

**What this pass fixes on top:** the flow no longer welds two products together on *either* door; an empty product match means *nothing*, never *everything*; batch language appears only when a release actually splits; the create gesture is reversible; a second operator cannot silently make a second copy of the same release; a Shopify retitle cannot double every collector's emails; the fulfilment routing stops being derived from a positional split; every count reconciles against the file that exists; and the notes table fits in cells that cannot draw a sentence.

---

## The flow

### 1. Releases index — one line changes

`ReleasesIndex.tsx:197` mounts `NewReleaseModal` unconditionally, so an abandoned draft survives a Cancel. Mount it on `open`. Nothing else on this screen changes — no new Status value.

Button, unchanged: **New release**

### 2. New release — pane one, the file

One `Dialog size="lg"` (760px, `app.css:340`), body-swapped in three panes with the foot's verbs carrying position, and **the title carrying the state**:

```
Pane one:   New release
Pane two:   New release — falling-light-2026-04-26.csv
Pane three: (create navigates; there is no pane three at this door)
```

*Correction.* The previous draft argued "no stepper" by citing HANDOVER:247. That citation does not support the claim: HANDOVER:242-252 is the **CRM-handoff** ruling — the reschedule dialogue lost its second step because writing the delay email became another team's job, leaving a form that is genuinely one act. It is not a ruling against staged dialogues. **The citation is dropped.** This *is* a two-pane dialogue and it says so: the title carries the file, and the way back reads **Back**, not "Choose another file". The argument for two panes stands on its own merits — the second pane cannot be drawn until the file is read, and there is no staged-flow vocabulary in 6,419 lines of CSS to draw a rail with.

Body is the kit's `.rd-importdrop` and a paste field. **No standing paragraph** — `CsvImportDialog.tsx:105`'s `<p>{hint}</p>` is a screen explaining itself on arrival. Its one real claim is made by evidence in pane two instead.

```
Drop box:         Choose the Shopify order export, or drop it here
Drop box, filled: Replace falling-light-2026-04-26.csv
Field:            Or paste the export
Primary:          Read the file
  shut, Why:      Choose the order export, or paste it.
Secondary chip:   Cancel
Secondary link:   Set up without a file
```

**The drop target takes its own drops.** The kit's box is a `<label>` wrapping `<input type="file" accept=".csv,text/csv">`, and the input *is* the drop target — so Chrome and Firefox validate `accept` on drop and swallow a non-matching file without firing `change`. Drop the `.xlsx` the operator actually has on disk today and **nothing happens at all**: no filename, no band, no toast, and a shut primary whose `Why` says "Choose the order export, or paste it" — which is not why. So the label handles `onDrop` itself, takes `dataTransfer.files[0]` unconditionally, and judges it on content. An `.xlsx` then lands on `not_an_export` where it belongs; a folder or a second file lands on a fault of its own rather than on silence.

Pressing **Read the file** runs `parseShopifyOrderExport` in the browser. Pure, and it writes nothing.

### 3. Pane one, rejected — the file that is not an order export

A whole-file fault stays in pane one, above the drop box, as one `Bar tone="fail"`. It never reaches the per-row channel: today an empty file draws *"1 row could not be read"* over the body *"Everything else was imported."* — false in exactly the case where reassurance does damage.

```
empty            That file is empty
                 Nothing was read, and nothing was created.

wrong_separator  This file is semicolon-separated
                 Re-export from Shopify, or save it as CSV (comma-delimited).

not_an_export    That is not a Shopify order export
                 No Name or Lineitem name column. Columns found:
                 Order Number, Print Name, Fulfilment…

no_rows          That export has no orders in it
                 The columns are right and there are no rows under them.

all_rows_failed  No row in this file could be read
                 296 rows, every one missing a readable "Created at" date.
```

*Correction.* The previous draft's `not_an_export` copy named one cause with total confidence — "The warehouse allocation sheet goes on the release, not here" — and it is **not the commonest one**. A genuine, unmodified Shopify export merely opened and re-saved in Excel under a European locale comes back semicolon-delimited, parses as a single column, and hits exactly that branch. The operator whose file *is* the order export would be sent to the wrong door. So the diagnosis splits on evidence the parser already has: if the first row has no commas but does have semicolons or tabs, say **that**; otherwise say only what is true — the two columns are missing — and **name the columns found**, which is what actually identifies the allocation sheet without guessing.

`all_rows_failed` is also new, and it is the fix for a real wall: a file whose `Created at` is in a non-ISO format (an Excel re-save) yields **one issue per row** — 296 rows of the same sentence in one dialogue — and today nothing blocks, so the orders are written with `orderDate: ''`. "Every row failed the same way" is a whole-file fault, not 296 issues.

**`CsvImportDialog`'s `wrongFile` prop is removed — from the component and from *both* callers.** It fires only when `e.target.files?.[0]` is `undefined`, the cancel case, which browsers do not fire a change event for; it has never appeared. The second caller the previous draft never mentioned is `AllocationImportModal.tsx:47` ("That file type is not accepted — upload the allocation sheet as CSV"). **The allocation importer does not lose its only wrong-file signal**: it gains the same content-judged rejection — its parser already knows its own header, so a file without it draws a `fail` band naming the columns found, exactly as the order door does. Removing a prop from a shared component is not a change to one door.

### 4. Pane two — what is in this file

`.rd-grouphd` **In this file**, then a bare 34px table (`.rd-t .rd-t27 .rd-fit`).

**Why not `DataTable`, said properly.** HANDOVER:52-54 rules that `DataTable` "is now the one table this app draws", and the previous draft argued around that ruling without quoting it. Quoting it: the ruling is about the app's **worklists** — a screen declares its columns once and gets search, Columns, Group, Sort, Add filter and a remembered view. `ImportIssues` already carved out the exception it does not cover — **a report inside a dialogue**, which has no view to remember, no filters to add, and three throwaway rows under a Card and four view controls it does not need. This table extends that existing carve-out from a report to a report **with a decision in it**. That is the honest argument, and it is the one the design makes.

**The mark is a `Tick`, not a `RowTick`.** The previous draft reached for `RowTick` + `usePicked`, which is the *selection* vocabulary — and ruling 9 pairs a live selection with `BulkBar`, which replaces the header row while a selection is live. This table opens with rows already ticked, so it would be in a permanently live selection with no bulk bar: the one place in the app where a tick means "include" rather than "selected", drawn with the control that means "selected" everywhere else. So it uses the kit's plain `Tick` — no anchor, no shift-range, no `usePicked`, no `BulkBar`. A tick here is a value, like a switch.

**Rows, and how the string is read.** One row per distinct `Lineitem name`, sorted by orders descending. On the real file:

```
        Product         Variant     Shopify orders   Batch
  [x]   Falling Light   Framed              155      [Framed]
  [x]   Falling Light   Unframed            139      [Unframed]
  [ ]   Night Garden    Framed                1      –

Foot:   2 of 3 products ticked · 294 orders from 293 Shopify orders
```

*Correction — the counting.* The previous draft headed this column **Orders** and then used the same word for the totals, which are a different quantity. In this codebase an `Order` is **one row per print** (`types.ts:125-132`, HANDOVER:65) — one per `(order name, line item title)` pair — and every other screen's "Orders" column reads that record count. Per-group distinct order names summed does equal the record count exactly (within one group, one order name is one record), so 155 + 139 = 294 records. But the file holds **293 distinct Shopify orders**, because `#AA10418` is counted once in Framed and once in Unframed. So the column head is now **Shopify orders** and the totals keep the app's word, **Orders**; the foot states both so nobody has to do the arithmetic, and the note row below carries the reason. This was the exact fault the design set out to fix, appearing in the design that fixes it.

*Correction — summing across rows.* With the tote gone, the third row is `Night Garden - Framed`. **Per-row Shopify orders cannot be summed across rows** to reconcile against Shopify: 155 + 139 + 1 = 295 records from 293 Shopify orders. The foot therefore never sums the column; it states the two totals for the **ticked** rows. This third row is the better example the fixture change handed us: it shows why a row must be unticked by default, why a per-release export legitimately contains whole orders from other releases, and — because ticking only the two print rows leaves a line item belonging to an order already in the release — it is also the note row `#AA10427` earns.

**Three reads of one string, each named.** The previous draft derived product, variant and fulfilment from a single `lastIndexOf(' - ')`, and that breaks on a variant containing a hyphen — the commoner Shopify shape (frame finish, size, edition tier). Verified: `splitLineItemTitle('Falling Light - Framed - Oak')` yields product `Falling Light - Framed`, variant `Oak`, and **`classifyFulfilment('Oak')` returns `unframed`** — an oak-framed print filed into the Unframed batch, on the unframed timeline, with no framing email. That is live today at `MockDataLayer.ts:432`, which calls `classifyFulfilment(item.variant)`. So the flow stops asking one derivation to do three jobs:

| Job | How the string is read | Why |
|---|---|---|
| **Display** Product / Variant | `splitLineItemTitle` — **unchanged** | Its `lastIndexOf` is deliberate and tested (`Study — Night - Blue - Unframed` → product `Study — Night - Blue`). It is a display split and nothing consequential hangs off it. |
| **Grouping and the one-release guard** | first ` - ` segment | `Falling Light - Framed` and `Falling Light - Framed - Oak` are one product; `Night Garden - Framed` is not. |
| **Batch routing** | `classifyFulfilment(lineItemTitle)` — the **whole title** | `classifyFulfilment` itself is byte-identical; only its argument changes. Verified: `'Falling Light - Framed - Oak'` → `framed`; `'Falling Light - Unframed'` → `unframed` (the existing `&& !/unframed/i` guard already handles the substring); `'Vessel VIII'` → `unframed`, unused for sculpture. **On all four fixtures, variant-based and title-based give the identical answer**, so this is a behaviour-preserving fix that lands in slice 1. |

The **Batch** tag is also **editable per row** — it is already the column that shows the consequence, so it is the right place to correct one. `Framed - Oak` routes to Framed by the rule; an operator who names a variant the rule cannot read fixes it here rather than discovering it three emails later.

**Where punctuation genuinely cannot decide**, the design says so rather than guessing. `Falling Light - Study` — a second edition off the same image, sold as its own product with its own promise — shares its first segment with `Falling Light`, so grouping cannot separate them and **the guard will not fire**. The answer is the proposal, not the guard: for a print file, ticks are proposed **only for rows whose title says framed or unframed**. `Study` is not proposed; it is drawn, untickeded, with its count, and ticking it is a deliberate act. Note also that `filterItemsForRelease`'s own comment claims `'Falling Light'` must not claim `'Falling Light - Study'` — **verified false**, `startsWith('falling light - ')` matches it, and the test at `importer.test.ts:166` covers `'Falling Light Study - Framed'` (a space, not a separator), so the case in the comment is untested. The comment is corrected either way.

**Product type.** `.rd-grouphd` **Product type**, then a `Segmented` — Print | Sculpture.

*Correction — the proposal.* The previous draft proposed on punctuation (any `" - "` → Print), which is right in one direction only. A sculpture sold in finishes — `Vessel VIII - Bronze`, `Vessel VIII - Patina` — proposes **Print**, and the consequence does not look wrong: `classifyFulfilment('Bronze')` and `('Patina')` both return `unframed`, so the Batch column reads a tidy "Unframed" on both rows while the release quietly takes the print sequence (printing / signing / framing) for a bronze. So the rule is inverted to the thing the batch split actually needs: **propose Sculpture unless some row in the file says framed.** Verified: Vessel VIII (104 rows, no framed) → Sculpture; `Vessel VIII - Bronze` → Sculpture; Falling Light, Blue Interval, Night Garden → Print.

The consequence is drawn for **both** values, beside the control — which is the whole argument for a Segmented over a Select:

```
Print      → 2 batches: Framed, Unframed · 4 emails switchable
Sculpture  → one timeline, no batches      · 1 email switchable
```

*Correction.* The previous draft said flipping it "visibly collapses the Batch column" and described the switch group as "the four `.rd-sw` switches, unchanged from today". `OPTIONAL_MILESTONES` gives print four (`pp-printing`, `pp-signing`, `pp-framing`, `pp-ontrack`) and **sculpture one** (`pp-ontrack`), and `NewReleaseModal.tsx:120` resets the selection when the kind flips. So the Segmented rewrites **two** things, and the larger of them was unstated. Both are now named on the control.

**This release.** `.rd-grouphd`, then `.rd-fields`:

```
Title          Falling Light        (Field suggested, note: "from the file")
Artist                              (note: "required — not in the export")
Edition size
```

*Correction.* The previous draft put "Artist is required" only in the shut primary's `Why`, and `redesign.css:689-690` rules that a `Why` is **"never the only place something is said"**. The established pattern is right there — `note="required — the CRM writer works from this"` at `RescheduleModal.tsx:193`, and the same at `ReleaseOrdersTable.tsx:363` and `RemoveOrderModal.tsx:61`. So Artist carries the requirement in its field note, and the `Why` is the second place, not the first.

Title wears the kit's `suggested` treatment (`rd-field-sug`) and is **editable**. It is a display name; the ticked strings are the join. Edition size is never prefilled: in all four fixtures the order count *exceeds* the stated edition (150 vs 293, 25 vs 104, 75 vs 80, 100 vs 125), so "294 orders on an edition of 150" is not an error and must not be validated as one.

**Emails this release sends** — the `.rd-sw` switches for the chosen product kind, **four for a print, one for a sculpture**, unchanged from today.

Then `.rd-after` / `.rd-after-t`, rendered only once the form can produce a consequence:

```
What this creates
Orders 294 · Collectors 293 · Batches 2 · Newest order 26 Apr
```

**The Batches box is drawn only when the ticked rows resolve to more than one fulfilment.** For Vessel VIII it reads `Orders 104 · Collectors 104 · Newest order 17 Apr` and there is no Batch column in the table above it either. (See *The batch-language ruling*, below.)

"Newest order", not a range: Night Garden spans 17 Apr – 22 Aug but **110 of its 126 line items fall in twelve days of April**. A range would read as a four-month sale to whoever sets the promise date.

Then the notes table (step 5). Then the foot:

```
Primary:        Create release & add 294 orders
Secondary chip: Back
Secondary link: Cancel

shut, Why:  Artist is required.
shut, Why:  Tick at least one product.
shut, Why:  Tick one product — Falling Light and Night Garden cannot share a release.
shut, Why:  “Falling Light - Framed” already belongs to another release.
shut, Why:  Creating…                    (in flight)
```

The primary carries `saving` from the first press. `NewReleaseModal` already guards with it; the previous draft's foot spec never mentioned it, and without it a double-click makes the duplicate by itself.

**The two-products guard**, when the ticked rows resolve to more than one first-segment product:

```
fail   Two products are ticked
       Falling Light (294 orders) and Night Garden (1). A release is one product.
       Create one, then add the other from Products this release claims.
```

Both figures are now **order records**, consistently, and both are real in the seeded world — the Night Garden row in the Falling Light export is 1 order. The previous draft's example (`Night Garden (125)`) mixed a record count with a distinct-order count and happened to agree only by luck.

### 4a. The claimed-product guard — two operators, one release

*This is new, and it is the fix for the design's largest hole.* There is no uniqueness constraint anywhere: `MockDataLayer.createRelease` validates only that title and artist are non-empty, and dedupe is strictly per-release (`MockDataLayer.ts:409` builds `seen` from orders `.filter(o => o.releaseId === releaseId)`). So two people dropping `falling-light-2026-04-26.csv` a minute apart produce **two releases, 588 orders, and every collector on two full milestone sequences**. This design made that *more* likely, not less: create became one gesture that both makes the release and imports the file, and decision 2 explicitly demotes the title — previously the de facto key, and the thing a second operator would have seen was taken — to a display name.

So `productMatch.lineItemTitles` is a **claimed set across releases**, checked at both write doors. After the file is read, every ticked title is looked up against every existing release's `productMatch`:

```
fail   “Falling Light - Framed” is already claimed
       Falling Light, created 6 minutes ago by Priya Raman — 294 orders.
       Add these orders to it instead.                   [Open Falling Light]
```

The primary is shut with a `Why`. **[Open Falling Light]** navigates into that release's Add-orders door **carrying the same file**, already read, straight to pane two — which is what the operator actually wanted. The identical check runs in `setProductMatch`, so the correction door cannot claim a title out from under another release either.

### 5. Pane two — the mess, said before anything is written

*Correction — this table could not be drawn.* `Cap` is `.rd-capline` (`app.css:450-457`): `max-width: 27ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`, and its own comment reads *"A cell in this app is never two lines."* The previous draft's Which column ran 40-60 characters — `#AA10418 — framed and unframed, two dates, two email streams` renders as `#AA10418 — framed and unfr…`. The house rule the design cites forbids the obvious remedy, and the whole point of the table is lost on every row.

So **no cell is a sentence.** Three short columns, a fixed vocabulary word per `IntakeNoteKind`, and the prose said once in the band above where prose is allowed:

```
note   5 things to check in this file
       None of these stop the import. Two need a fix outside this tool.

Order      What              Detail
#AA10412   Duplicate row     Second skipped
#AA10418   Two batches       Framed + Unframed
#AA10421   No email          Imported, never sent to
#AA10427   Another release   Night Garden - Framed
#AA10430   No name           Greeted “lars.petersen”
```

Longest cell is 23 characters. Measured against `checks/prove-screens.mjs`, which already runs `checkRowShape` and `checkNoOverlap` on every table on a screen — and the SKILL's own rule, *"Render it and LOOK at it. An unseen screen is a divergent screen."* `.rd-importlist td:first-child { width: 40% }` is re-keyed for three columns rather than inherited unexamined.

*Correction — every row above is now real.* The previous draft's `#AA10419` (refunded), `#AA10501` (multi-print) and `#AA10605` (France then Germany) were presented as read off "this exact file" under a blanket verification claim, and **none of the three holds**: `#AA10419` is `paid`; `#AA10501` is the first Vessel VIII order, single-line, not in this export at all; Falling Light's `#AA10605` is one row, Ines Lange, Netherlands — the France/Germany conflict is Night Garden's `#AA10605`, Dina Khoury, a different file and a different collector. The five rows above are the five the file actually carries. The country-conflict case moves to where it lives, as a Night Garden example in *Failure modes*.

Rows that appear where the data warrants, marked honestly as **designed from the header, unfirable on the seeded data** (see decision 3):

```
#AA10419   Refunded          Imported and active
#AA10501   Quantity 2        One collector, one email
#AA10605   Row disagreed     Kept France, ignored Germany
```

**Nothing here blocks.**

*Correction — the justification.* The previous draft claimed this band under HANDOVER:237-238's exemption for "warnings… **they qualify a control**" and then said "Nothing here blocks" two lines later. A band that qualifies nothing is not in that category by the design's own quoted test. It is justified instead as **evidence** — the pre-write equivalent of a table's `Foot` count, which the same ruling explicitly kept (*"the COUNT stays — that is data"*), and the thing that replaced `CsvImportDialog`'s `hint` paragraph. The one row here the exemption does cover cleanly is the two-products case, and that one does shut the primary.

`Financial Status` is read, stored and reported; it is never acted on. The README's v1 rule — cancellations are marked by hand, never inferred from the CSV — stands. Reporting is not inferring.

### 5a. The file that is not release-sized

*This is new.* The likeliest operator mistake with a Shopify export is not the wrong product's export — it is **Orders → Export → "All orders"**, the default path, which for Avant Arte is hundreds of distinct line-item names. The previous draft sized the table for the file it hoped for: hundreds of 34px rows inside a 760px dialogue, no search, no cap, no scroll container, and a shift-range gesture requiring two rows found by eye.

Both tables are capped, and say what was capped:

```
Field above the table:   Filter products
Foot when capped:        Showing 12 of 340 products · filter to find one
Container:               max-height with its own scroll, so the foot and the
                         primary stay put
```

A `Field`, not `DataTable`'s apparatus — the objection to `DataTable` is its persisted view and its four controls, not the existence of a search box. The row-failure table collapses identical reasons into one row with a count (`296 rows: unreadable "Created at" date`), and "every row failed the same way" is promoted to the `all_rows_failed` whole-file fault rather than 296 issues.

### 6. The write, and where it lands

One call: `createRelease(input, { items, source })` writes the release, its `productMatch` (with `confirmedAt` / `confirmedBy` set from the ticks), the batches the file justified, the orders, and the `Intake` — atomically.

```
Toast:  Falling Light created — 294 orders in 2 batches
Toast:  Vessel VIII created — 104 orders            (one batch: no batch language)
```

A report, not an instruction. Today's toast (`NewReleaseModal.tsx:68`) says *"review its emails, then import the Shopify order export"*, vanishes in five seconds, and states the dependency backwards — the image-slot count is a function of the promise date, which is a function of the import, so images provably cannot come first.

**Atomic was never the risk. Irreversible was.** `DataLayer` has no `deleteRelease`, no `updateRelease`, and no way to undo an intake — the only removal is `removeOrders(orderIds, reason)`, which sets `removed: true` and leaves the orders in their batches, in the dedupe set (`MockDataLayer.ts:407`: removed orders still count, "so a cancelled order in a re-uploaded export stays gone") and in the audit trail. Today a mis-click at the New release door costs an empty release you can ignore. Under this design **one mis-drop costs a permanent release with 294 orders, 2 batches, an Intake and events on every batch** — and the file most likely to be mis-dropped is named almost identically to the right one. So the flow ships with a remover:

```
⋯ menu → Delete release          (only while no send on this release has fired)

Dialog:  Delete Falling Light?
Body:    294 orders, 2 batches, 1 intake. Nothing has been sent.
Danger:  Delete release
```

and, more precisely, since `Intake` already exists:

```
Release head, All orders foot → Undo this import
Dialog:  Undo the import of falling-light-2026-04-26.csv?
Body:    294 orders and 2 batches created at 14:02 today. Nothing has been sent.
```

`undoIntake` **hard-deletes** the orders that intake created plus any batch it created — not `removed: true`, because a soft-removed order stays in the dedupe set and would poison a re-import of the correct file. Both are refused the moment any send on the affected batches has fired.

`setProductKind` ships with them, allowed under the same condition — otherwise the Print/Sculpture answer is a permanent decision made from a variant vocabulary, with no `deleteRelease` to remake the release from.

### 7. The release page

```
Head facts:   Jenny Marlowe · edition of 150  [Print]
Head actions: Add orders · Import warehouse allocation · ⋯
⋯ menu:       Rename release · Products this release claims · Delete release
```

*Correction — the intake fact is out of the head.* The previous draft put "Orders from Shopify · added 14:02 today" in `.rd-subhead`, and that is the exact edge the 29 Aug ruling draws. `checks/prove-screens.mjs:148-154`: *"a screen reached by a crumb is a RECORD, and its subhead is that record's identity — an artist, an edition size, the release a send belongs to."* An intake timestamp is not identity: it is an event, it changes on every import, and it is the release page narrating its own history under its title. The draft also undercut its own justification — "Day the sync lands" §5 said the verb changes from "added" to "synced", contradicting "nothing on this page is reworded on sync day" — and `IntakeSource.label` is defined as the file name, so the head would have printed `falling-light-2026-04-26.csv` after the same design ruled that the word CSV survives only inside the upload dialogue.

Provenance goes where the project already built a home for it:

```
BatchHistoryTimeline:   294 orders added from falling-light-2026-04-26.csv
All orders tab, Foot:   294 orders · last added 14:02 today   [Undo this import]
```

A count in a `Foot` is data, which the same ruling explicitly preserved.

**Add orders** replaces **Import orders** in the head, for the reason the previous draft gave and which still holds: the verb is true under both regimes.

Bands above the tabs, in this order:

```
warn  2 batches have no promise date        (>1 batch)
      No emails are drafted until each has one.        [Set promise dates]

warn  This release has no promise date      (one batch)
      No emails are drafted until it has one.          [Set promise date]

warn  Some orders can't receive email yet              (existing band, unchanged)

warn  6 emails have no image                           (existing band — see below)
```

**The images band.** *Correction, twice.*

First, the arithmetic. The previous draft claimed "the slot list goes from 6 to 8 the moment a 150-day date is set", verified. Re-run against the real `requiredImageSlots`:

| State | Slots |
|---|---|
| Fresh print release, 0 batches | **6** |
| Framed dated at +10, +20, +30, +45, +60, +90 or +120 days | **6** |
| Framed dated at +150 days, Unframed undated | **7** |
| Both batches dated at +120 days | **7** |
| Both batches dated at +150 days | **8** |

So 6 → 8 is not what the described flow produces — the band's own **[Set promise dates]** sets Framed first, and the design's own `PromiseDateModal` secondary reads "Set Unframed next". And it does not move **at all** below about 120 days. **The seeded Falling Light dates are +10 and +20 days** (`seed.ts:229-230`), so in the seeded world setting every promise date changes the count by **zero**. "Provably wrong" was false for the common case.

Second, the predicate. Suppressing on "any batch is undated" inverts the round it comes from. Batches are dated one at a time — `PromiseDateModal` takes a single `batch` — so on a two-batch release with Framed dated and Unframed not, the Framed batch has already generated its plan and those sends are heading for approval, where `approveSend` refuses on `NO_IMAGE_YET`. The band naming the blocker would be suppressed precisely while the work it blocks is live. HANDOVER:135 kept `Submit plan for approval` shut with a `Why` as "the earlier, kinder catch"; HANDOVER:238 lists "an email with no image" among the warnings that survived the sweep *because they qualify a control*.

**So the band is not suppressed.** It is drawn always, and the count is stated as what it is:

```
warn  At least 6 emails have no image
      There is no default — an email cannot be approved until its image
      is picked. A dispatch date beyond about four months adds more.
                                                          [Pick images]
```

The count is a **floor**, not a lie: the six slots are pickable today, and the honest fix was always to make the count honest rather than to hide it. Once every batch is dated the floor is the answer and the word "at least" drops.

Pressing **Set promise dates** opens the existing `PromiseDateModal`, which gains one foot secondary when another batch is still undated:

```
Secondary: Set Unframed next
```

The dialogue does not open itself. The band is permanent, which is what a toast is not.

**The batch-language ruling, honoured on every surface.** The ruling is stated three times in code and once in HANDOVER: `ReleaseDetail.tsx:135` ("An unsplit release has no batch language anywhere"), `PromiseDateOverview.tsx:66-68`, `reschedule.ts:378-380` ("the notification must not be where 'Batch 1' is introduced"), HANDOVER:343. The previous draft broke it on four surfaces unconditionally. All four are now gated on `batchesCreated.length > 1`:

- the pane-two **Batch** column is dropped when the ticked rows resolve to one fulfilment;
- the **Batches** box is dropped from `.rd-after`;
- the toast reads "Vessel VIII created — 104 orders";
- the promise-date band reads "This release has no promise date".

The convention copied is the existing one — `PendingSendItem.releaseBatchCount` ("1 means don't talk about batches") and `PromiseDateModal`'s `batchLabel?: string | null`. Note that `MockDataLayer.createRelease` names a sculpture's batch the literal string **"Batch 1"**; nothing in this design ever draws it, and `ImportSummary.batchesCreated[].name` is read only when the length is greater than one.

**`ReleaseDetail`'s two guards.** *Correction:* the previous draft cited line 142, which is only the label expression. The comparison is at **line 130** — `const singleBatch = batches.length === 1` — and changing 142 alone would rename the tab while leaving `singleBatch === false` for an empty array, so line 211's `top === 'batches' && !singleBatch` would still render `SubTabs` and line 215's `batches[0].id` would still throw. The stated consequence only follows from the change at 130:

- `ReleaseDetail.tsx:130` — `const singleBatch = batches.length <= 1;`
- `ReleaseDetail.tsx:215` — `batches[0]?.id`, belt and braces.

That `TypeError` is reachable ten seconds into the flow today, with no `ErrorBoundary` anywhere in `src`, and the page goes blank. It is fixed by a guard rather than by forbidding the state, because every order in a release can be cancelled and the state comes back.

### 8. The fileless release — "Set up without a file"

```
Head facts:  Jenny Marlowe · edition of 150  [Print]
Tabs:        All orders (0) · All emails · Overview
CardHead:    No orders yet          [Add orders]
Empty:       Add the Shopify order export. Framed and unframed prints land
             in their own batches with separate timelines.
```

*Correction.* The previous draft put a `NoneYet` in the head. `NoneYet` is "a REQUIRED thing nobody has chosen yet, **and the control that chooses it**" — a value slot in a table cell, worn only by `ReleaseEmailsCard.tsx:202`. "No orders yet" is a release *state*, and a state is a `Pill`; and putting a dashed **button** into `.rd-subhead` (`app.css:163-170`, a muted text row) also puts a control into the line the design elsewhere insists is identity. It is dropped: the tab already reads "All orders (0)" and the `Empty` + `CardHead` below carries both the invitation and the control.

**Edits made in this window are now logged.** `BatchEvent` is keyed to a batch (`batchId: string`), and `updateReleaseEmail`'s `emitTo` resolves through `anchorBatch(releaseId)`, which returns `batches[0] ?? null` (`MockDataLayer.ts:196-200`) — so with no batches, `targets` is `[]` and **the event is silently dropped** (`MockDataLayer.ts:577`). Today that is defensible because a print release has no batches for about ten seconds. This design promotes it to a normal working state that can last days, and the work done in it — switching a milestone off, overriding copy that will reach 294 collectors — is precisely what an audit trail exists for. So `BatchEvent.batchId` becomes `string | null`, and `BatchHistoryTimeline`'s callers fold release-level events into every batch's story (they already join by release).

### 9. Add orders — the recurring job

The same dialogue, titled `Add orders — Falling Light`, then `Add orders — Falling Light · falling-light-2026-05-03.csv`. Pane one identical. Pane two has no release form and no switches.

**Pre-ticking, and the empty-matcher hole.** *This was the blocking fault.* `filterItemsForRelease` (`importer.ts:212-213`) opens with `if (matchers.length === 0) return { matched: items, filteredOut: 0 }` — **an empty matcher list matches everything**. Today that branch is unreachable because the layer defaults to `[release.title]` (`MockDataLayer.ts:403`). Under the previous draft it became reachable for every release created through "Set up without a file" *and* for every existing release, since `productMatch` replaced `shopifyProductIds` with no backfill. The first Add-orders on such a release would pre-tick every line item in the file — and on the real export that includes `Night Garden - Framed`, welding another release's collectors in with a promise date and a printing email, silently, on the one door the design added and the one door with no guard on it.

Three changes, at the rule rather than at the symptom:

1. **`filterItemsForRelease` is inverted.** An empty matcher list now returns `{ matched: [], filteredOut: items.length }` — no claim, no rows. There is exactly one caller and it never passes empty, so nothing changes in behaviour today; the test at `importer.test.ts:182-184` ("passes everything through with no matchers") is rewritten to assert the refusal, which is the point.
2. **Pre-ticking does not use it.** Ticks are pre-computed by **exact string equality** against `productMatch.lineItemTitles`. An empty match pre-ticks nothing and the primary is shut:
   ```
   shut, Why:  This release does not claim a product yet — tick one.
   ```
3. **The first Add-orders on a fileless release writes `productMatch`** from the ticks, with `confirmedAt` and `confirmedBy` — the fields the previous draft declared and never set.

**Precedence, stated.** The previous draft specified two filters and no order between them. It is now explicit: **the ticked items are the write.** `addOrders(releaseId, items, source)` receives exactly the ticked `ParsedLineItem`s, and the layer re-derives its plan by calling `reconcileIntake(existing, items)` on the items it was handed — matchers are not consulted at write time at all. The preview and the layer cannot disagree because they run the same function over the same array.

```
        Product         Variant     In file   New   Batch
  [x]   Falling Light   Framed         158      3   [Framed]
  [x]   Falling Light   Unframed       142      3   [Unframed]
  [ ]   Night Garden    Framed           1      1   –

Foot:   6 new orders · 294 already here · 1 row left out

.rd-after   What this adds
            New orders 6 · Collectors 6 · Already here 294 · Newest order 3 Sep

Primary:    Add 6 orders
  shut Why: Every order in this file is already here.
```

The table is drawn on **every** top-up, not only when something new appears — today a fresher export that matches nothing renders as *"0 new orders created from 296 rows"* over four neutral facts and a button saying **Done**.

**The wrong file:**

```
fail  Nothing in this file belongs to Falling Light
      It contains Night Garden - Framed (66 orders) and Night Garden - Unframed (59).
                                                    [Create Night Garden from this file]
```

*Correction — the welding.* The previous draft said "Rows stay tickable, because the legitimate case is real" and offered a primary reading **"Add 125 orders and a new product to Falling Light"** — directly under a band saying nothing in the file belongs here. That contradicts the create-time guard on the same table in the same session, and it is the exact recovery gesture a hurried operator makes after dropping the wrong file. The consequence is not recoverable: the orders route into the release's batches by fulfilment, inherit its promise dates and its whole approved plan, and the design's own remedy admits they stay.

**The two cases are split**, because the sentence defending the tick was defending a *variant* while the example number belonged to a different *product*:

| Ticked row resolves to… | What happens |
|---|---|
| The **same** first-segment product — a new variant, a new size (`Falling Light - Framed (Large)`) | Tickable, exactly as before. Primary: **Add 8 orders and a new variant to Falling Light** |
| A **different** product (`Night Garden - Framed`) | **Not tickable from this dialogue.** The offer is **[Create Night Garden from this file]** — the create door, pre-filled, which is what the operator wants nine times in ten |

Claiming a genuinely different title stays possible, but only through **Products this release claims**, with its own confirmation — the same remedy the create guard names. Never behind the top-up primary, and never on a pass where the fail band has just said nothing here belongs.

**The new variant, and the retitle that looks exactly like one.** *This was the other blocking fault.* `orderDedupeKey(name, lineItemTitle)` puts the line-item title **inside** the key, and `matchExistingOrder` falls back to it in phase 1. So after a Shopify retitle, a fresher export re-states all 155 existing Framed orders under the new string; every one is unmatched, the table reads **New 155**, the note band invites the tick, and the primary says "Add 155 orders". The write then creates 155 *second* Order records for the same 155 collectors, routed by `classifyFulfilment` into the **same existing Framed batch** (`intakeBatch` matches on fulfilment, not title). Recipients are per-Order and computed live from `activeBatchOrders` with no dedupe by email — so **every future milestone email goes to each collector twice** and the batch's collector count doubles. That is worse than today, where the retitled rows simply fail the filter and nothing is created.

So before offering an unseen title as a tickable product, the flow asks the cheaper question first: **how many of that row's Shopify order names already exist in this release under a different line-item title?**

```
warn  This looks like a rename, not a new product
      155 of these 155 orders are already here as “Falling Light - Framed”.
                                    [Rename the claimed product]   [Add as new anyway]
```

**[Rename the claimed product]** runs `setProductMatch` plus a rewrite of the existing orders' `lineItemTitle` — no orders created, no batch touched, and the next export matches. The "has not seen" note is reserved for rows whose order names are genuinely new:

```
note  This file has a variant this release has not seen
      Falling Light - Framed (Large) — 8 orders. Tick it to add it.
```

And regardless of which branch is taken, `reconcileIntake` carries a **same-collector guard**: an incoming line item whose order name already exists in this release, in the same batch, with the same email, is never silently a new order — it is a note row.

**Refunds on a re-import.** *Correction:* the previous draft stored `financialStatus` and drew a red **Refunded** pill, but for the case in the brief — "a fresher export with 40 new orders and 3 refunds" — **the pill could never appear**. A refund almost always happens after the order was first imported, so the refunded row is an order the release already has; the design's own reconcile classifies it as `duplicatesSkipped` and skips it, and there is no update path anywhere — only create-or-skip. The stored value would be frozen at whatever it was the first time the order was seen.

So a re-stated existing order becomes a **small update** rather than a pure skip: when `matchExistingOrder` finds it, `financialStatus`, `fulfillmentStatus` and `quantity` are refreshed on the stored Order — **never** batch, never email, never collector — and the ones whose status *changed* get their own line:

```
warn  3 orders are now refunded in Shopify
      #AA10419, #AA10486, #AA10502 — still active here. Cancel them by hand.
```

Still reporting, not inferring: the README's rule is that cancellation is a human act, and this only makes the fact visible to the human who has to act.

### 10. What landed

```
Heading:  6 orders added to Falling Light
Facts:    New orders 6 · Collectors 6 · Already here 294 · Left out 1
```

At most three bands, worst first, then one notes table, then the row-failure table. The rest are rows, not bands.

```
note  Framed batch created
      6 collectors, no promise date yet.                 [Set promise date]

warn  4 collectors joined after this batch started sending
      They missed “Printing has started”, sent 12 Aug.

warn  2 approved emails now go to more people
      Framed +4, Unframed +2. Nothing was re-approved.

Primary:   Set promise date      (when a batch owes one)
Primary:   Done                  (when none does)
Secondary: Add another file
```

Recipients are computed live from active batch orders at read time (`MockDataLayer.ts:1223`), never snapshotted at approval — so an approver's "approve for 155" silently becomes 159 today. This states it at both ends: here, and on `PendingSendItem.joinedSinceApproval` in the approval queue.

**The notes get a permanent home.** *Correction:* at the create door the notes table is shown once, pre-write, on the screen the operator is leaving — step 6 ends in a toast and a navigation. So "cancel it by hand" and "greeted as lars.petersen" would be said exactly once, in a closing dialogue, and then nowhere; the previous draft stored them in `Intake.summary.notes` and rendered them on no screen afterwards. That is the same fault the design correctly diagnoses in today's toast. Since the record already exists:

```
Release page, one note band that survives:
note  5 things to check from the 26 Apr import        [Show]   [Dismiss]
```

**[Show]** opens a read-only `ImportNotes` over the latest intake. Dismissible per intake and per user. Note kinds whose fix has an owning surface resolve into it instead and are dropped from the band — a refund into the red pill and a filter on the orders table, a missing collector name into the flagged-order band the release already draws.

### 11. Products this release claims

`Dialog size="md"`, from the release page's `⋯` menu. The same table, built from `productMatch.lineItemTitles` ∪ every line-item title seen in this release's intakes.

```
Title:    Products this release claims
Primary:  Save

note  Falling Light - Framed has 155 orders here already
      They stay. The next file will not add more.

fail  “Night Garden - Framed” is claimed by Night Garden
      Created 12 Apr by Priya Raman — 125 orders.
```

The cross-release claim check runs here too, so this door cannot be used to route around 4a.

This is the escape hatch `ImportOptions.titleMatchers` was built for and never given a door — declared at `DataLayer.ts:46`, honoured at `MockDataLayer.ts:403`, passed by no screen.

### 12. The trail

`BatchHistoryTimeline`, unchanged, reading a description built from the source:

```
294 orders added from falling-light-2026-04-26.csv
6 orders added from Shopify                          (after the sync, same line)
Framing email switched off                            (release-level, batchId: null)
```

### 13. Renaming a release

*This is new, and it is the consequence the previous draft's `renameRelease` did not state.* Decision 2 claims renaming becomes safe. It makes the **join** safe and leaves the collector-facing **copy** wrong: `buildTemplateFields` (`templates.ts:221-233`) puts `release_title: release.title` into the fields, and `patchTokens` resolves `{{release_title}}` into each send's **stored** `subject` and `body` when the send is generated. Six master templates carry it, including the subject lines "An update on {{release_title}}" and "An update on your {{release_title}} delivery date". Nothing re-renders an existing send on a release change except `updateReleaseEmail`. So a rename would leave every draft, pending and **approved** send saying the old name.

`renameRelease` gets the treatment `updateReleaseEmail` already has — the reach said **before** it happens, the way the switch-off confirm already does with `reachOf`:

```
Dialog:   Rename Falling Light
Field:    Title
note      12 unsent emails say “Falling Light”. They will be re-rendered.
warn      2 of them are approved
          They return to pending approval — an approver approved a wording.
Primary:  Rename & re-render 12 emails
```

Individually copy-edited sends are left alone, exactly as `updateReleaseEmail` leaves them.

---

## Failure modes

| Situation | What the flow does |
|---|---|
| Empty file, wrong columns, semicolon-delimited re-save, header with no rows, every row unreadable, the warehouse sheet dropped into Add orders (the two buttons are adjacent in the same head) | Pane two is never reached, nothing is written, one `fail` band in pane one names the fault — the semicolon case by its separator, the column case by naming the columns **found** |
| `.xlsx` dropped on the box (not picked) | The label handles `onDrop` itself and reads the file regardless of `accept`, so it lands on `not_an_export` instead of the current total silence |
| Typed title does not match the Shopify product | Structurally unreachable at create — nothing is typed |
| Wrong release's export dropped into Add orders | `fail` band naming what the file contains, with counts, and **[Create Night Garden from this file]**. Rows resolving to a different product are **not tickable here**. Dedupe would never have caught it: 43 order names are shared between the Falling Light and Night Garden files, and `#AA10605` is a different collector in each |
| An order in the file belongs to two releases (`#AA10427`: Falling Light unframed + Night Garden framed) | Its own unticked row with its own count, and a note row on the ticked side saying the other half is not this release's. Per-row Shopify orders are never summed across rows; the foot states both totals |
| A variant containing a hyphen (`Falling Light - Framed - Oak`) | Batch routing reads the **whole title** through `classifyFulfilment` → Framed. Grouping reads the first segment → one product, guard silent. Display splits with `splitLineItemTitle` as today. The Batch tag is editable if the rule still reads it wrong |
| A lookalike second edition (`Falling Light - Study`) | Punctuation cannot decide this and the design says so: same group, guard silent, **not proposed** for ticking (only rows saying framed/unframed are), drawn with its count, ticking it deliberate |
| Product renamed in Shopify | The order-name overlap question is asked **first**: high overlap draws the rename band, whose action is `setProductMatch` + retitle. No orders created, no doubled recipients |
| A genuinely new variant appears | `note` band, unticked row, and a primary that says **and a new variant** |
| Sculpture sold in finishes (`Vessel VIII - Bronze`) | Proposed **Sculpture**, because no row in the file says framed. Both consequences drawn beside the Segmented. `setProductKind` fixes a wrong answer while nothing has sent |
| Exact duplicate row (`#AA10412`) | First wins, and it is a **note row**, not a skip — so a first-ever import reports `Already here 0` and one note, where today it would say "Already imported 1" on a file never imported |
| Near-duplicate differing only in Shipping Country (Night Garden's `#AA10605`: France then Germany) | `note` row, `Kept France, ignored Germany`. This is a Night Garden fact; Falling Light's `#AA10605` is a single clean row |
| One Shopify order spanning both fulfilments (`#AA10418`) | Note row `Two batches / Framed + Unframed`, and the foot states both totals: **294 orders from 293 Shopify orders** |
| No email (`#AA10421`) or no name (`#AA10430`) | Two note rows, because the two fixes are different — one is Shopify, one is HubSpot. The name row quotes the greeting that will go out |
| Refunded or voided in Shopify | On a first import, a note row and a `Pill tone="red"` in the orders table. On a **re-import**, the stored order's status is refreshed and the ones that changed get a `warn` band with the order numbers. Never acted on |
| Quantity above one | Stored, reported, refreshed on re-import; never split into a second collector or a second email |
| A Shopify "All orders" export with 340 products | Table capped with a filter field and its own scroll; foot says "Showing 12 of 340". Row failures collapse by reason |
| Re-import creates a batch the first file did not have | `note` band in the summary with the control, and a permanent warn band on the release page. Today the only signal is a tab label changing from "Overview" to "Batches (2)" |
| New orders join an approved plan | `warn` band with the per-batch delta, and `joinedSinceApproval` on the approval queue row |
| A collector joins a batch that has already sent | `warn` band naming the sends missed, from `Order.importedAt` vs `send.sentAt` |
| An order cancelled in the app reappears in a fresher export | Not resurrected, and counted as `stillCancelled` rather than folded into "Already here" |
| Two operators create the same release at once | The claimed-title check shuts the primary, names the release, who made it and when, and offers **[Open Falling Light]** carrying the same file into its Add-orders door. The primary also carries `saving`, so a double-click cannot do it either |
| The wrong file was dropped and created | **Undo this import** (hard-deletes that intake's orders and any batch it created) or **Delete release**, both refused once anything has sent |
| A release is renamed | The dialogue counts the unsent sends carrying the old title, says how many are approved and that they return to pending, then re-renders |
| Copy or switches edited before the first import | Logged — `BatchEvent.batchId` is nullable and release-level events fold into every batch's story |
| Release set up before the sale opens | **Set up without a file**. The release exists, keeps its emails tab, has no batch, does not crash, and its first Add-orders pre-ticks **nothing** and writes `productMatch` from the ticks |

---

## `src/types.ts` — the precise diff

```ts
// NEW
export interface ProductMatch {
  /** Full `Lineitem name` strings this release claims. The join key, and a
   *  set claimed EXCLUSIVELY: no two releases may claim the same string. */
  lineItemTitles: string[];
  /** Secondary correlate for sync day. Never the matcher. */
  skus: string[];
  /** Empty until the sync writes it. */
  shopifyProductIds: string[];
  confirmedAt: string | null;
  confirmedBy: string | null;
}

export interface IntakeSource {
  kind: 'csv_upload' | 'shopify_sync';
  /** File name for an upload, "Shopify" for a sync. Never drawn in a head. */
  label: string;
}

export interface Intake {
  id: string;
  releaseId: string;
  source: IntakeSource;
  startedAt: string;
  finishedAt: string;
  /** User id, or "system" for a sync — the convention `_addEvent` already uses. */
  by: string;
  byName: string;
  summary: ImportSummary;
  newestOrderDate: string | null;
  /** Cleared when a user dismisses the release-page notes band. */
  notesDismissedBy: string[];
}

export type IntakeNoteKind =
  | 'duplicate_row' | 'conflicting_row' | 'no_email' | 'no_collector_name'
  | 'both_batches' | 'other_release' | 'quantity' | 'not_paid' | 'still_cancelled';

/** Three short cells. `what` is a fixed vocabulary word per kind and `detail`
 *  is at most a few words: `Cap` is 27ch and never draws two lines. */
export interface IntakeNote {
  kind: IntakeNoteKind;
  order: string;      // "#AA10418"
  what: string;       // "Two batches"
  detail: string;     // "Framed + Unframed"
}

export interface ParseFault {
  kind: 'empty' | 'wrong_separator' | 'not_an_export' | 'no_rows' | 'all_rows_failed';
  detail: string;
  /** Columns the file did have, for `not_an_export`. */
  columnsFound?: string[];
}

// Release
- shopifyProductIds: string[];
+ productMatch: ProductMatch;

// Order — additive only
+ intakeId: string;
+ /** When this tool created it. `orderDate` is when it was bought; the two are conflated today. */
+ importedAt: string;
+ quantity: number;
+ sku: string | null;
+ financialStatus: string | null;
+ fulfillmentStatus: string | null;
+ /** "csv:#AA10412" today, "shopify:5312…" after the sync. Namespaced on purpose. */
+ sourceOrderRef: string;
+ sourceLineRef: string | null;

// BatchEvent — release-level events have no batch
- batchId: string;
+ /** Null for a release-level event (a copy edit before the first import).
+  *  Timeline callers fold these into every batch's story. */
+ batchId: string | null;

// ImportSummary — keeps its name and its seven fields, gains SEVEN
+ lineItemsMatched: number;   // 295 on Falling Light
+ collectors: number;         // 293 — distinct people, not orders
+ shopifyOrders: number;      // 293 — distinct order names, ≠ newOrders
+ stillCancelled: number;     // split out of duplicatesSkipped
+ batchesCreated: { batchId: string; name: string; collectorCount: number }[];
+ joinedSentBatch: number;
+ approvedSendsAffected: { sendId: string; batchName: string; added: number }[];
+ statusChanged: { orderId: string; shopifyOrderName: string; from: string; to: string }[];
+ notes: IntakeNote[];
  // duplicatesSkipped is REDEFINED: distinct existing orders this file re-states.
  // A within-file repeat is a `notes` row, not a skip.

// ReleaseDetail
+ intakes: Intake[];

// PendingSendItem
+ joinedSinceApproval: number;
```

*Correction:* the previous draft said "gains six" and listed seven. It now gains nine, counted. `AllocationImportSummary`, `ImportRowIssue`, `BatchEventType` and `ReleaseSummary` are untouched. The event stays `orders_imported`; only its description is built from `source.label`.

## `src/data/DataLayer.ts` — the precise diff

```ts
// CreateReleaseInput
- shopifyProductIds?: string[];
+ productMatch?: { lineItemTitles: string[]; skus: string[] };

// DELETED
- export interface ImportOptions { titleMatchers?: string[] }

// NEW
export interface IntakeInput { items: ParsedLineItem[]; source: IntakeSource }
export interface CreateReleaseResult { release: Release; intake: Intake | null }

// Methods
- createRelease(input: CreateReleaseInput): Promise<Release>;
+ createRelease(input: CreateReleaseInput, intake?: IntakeInput): Promise<CreateReleaseResult>;

- importOrders(releaseId: string, csvText: string, options?: ImportOptions): Promise<ImportSummary>;
+ /** Orders in, whatever the source. CSV builds the items from a file; the
+  *  sync builds the same array from JSON. The ITEMS are the write — there is
+  *  no matcher argument, because the caller has already decided. */
+ addOrders(releaseId: string, items: ParsedLineItem[], source: IntakeSource): Promise<Intake>;

+ /** Re-renders unsent sends carrying {{release_title}}; approved ones return
+  *  to pending_approval. Copy-edited sends are left alone. */
+ renameRelease(releaseId: string, title: string): Promise<ReleaseEmailUpdateResult>;
+ /** Refuses a title claimed by another release. */
+ setProductMatch(releaseId: string, lineItemTitles: string[]): Promise<Release>;
+ /** Allowed while no send on the release has fired. */
+ setProductKind(releaseId: string, kind: ProductKind): Promise<Release>;
+ /** Hard-deletes the orders and any batch this intake created. Refused once
+  *  a send on those batches has fired — soft removal would poison the
+  *  dedupe set for a re-import of the correct file. */
+ undoIntake(intakeId: string): Promise<Release>;
+ /** Refused once any send on the release has fired. */
+ deleteRelease(releaseId: string): Promise<void>;
+ /** Which release, if any, already claims each of these line-item titles. */
+ claimantsOf(lineItemTitles: string[]): Promise<Record<string, ReleaseSummary>>;
```

*Correction — the migration claim.* The previous draft said "`csvText` leaving the storage interface is the whole migration" and that today's signature is "the one thing contradicting" `importer.ts`'s header. Neither is true, and `csvText` does not leave: `DataLayer.ts:118`'s `importAllocations(releaseId, csvText)` is untouched by this diff, and the design keeps its door on the release head. What is actually true is a stronger argument: **the order path stops passing CSV text, which is the path the Shopify sync replaces. The warehouse allocation sheet is a spreadsheet a human exports with no API behind it, so it keeps `csvText` deliberately.** A reader should not conclude the interface is clean when half of it takes raw text on purpose.

## `src/logic` — what it gains

`src/logic/importer.ts` (extended; the four exported matchers keep their behaviour):

- `ParsedLineItem` gains `sku`, `financialStatus`, `fulfillmentStatus`, `lineOrdinal`. *Correction:* only **three** columns start being read — `Lineitem sku`, `Financial Status`, `Fulfillment Status`. The genuinely unread columns are **seven** (`Financial Status`, `Paid at`, `Fulfillment Status`, `Currency`, `Subtotal`, `Lineitem price`, `Lineitem sku`); `lineOrdinal` is derived, not a column; and `Lineitem quantity` is **already parsed today** (`importer.ts:156-157`) and discarded when the `Order` is built, not when the row is parsed. So: *three of the seven unread columns stop being dead weight, and `quantity` — parsed today and dropped at the Order — is finally stored.*
- **`financialStatus` and `fulfillmentStatus` join the `orderContext` carry-forward and the back-fill loop**, exactly as `country` and `shopifyTags` are handled. *Correction:* both are **order-level** columns and are blank on continuation rows. The previous draft added the fields without extending the carry-forward, so `#AA10418`'s and `#AA10427`'s second line items would have been stored with `financialStatus: ''`. Counted on the raw column: Falling Light is `{"paid": 294, "": 2}` — the two blanks **are** the two continuation rows. `sku` and `quantity` are line-level and stay so.
- `ParseResult` gains `fault: ParseFault | null`, and the two `row: 0` pseudo-issues move into it. `wrong_separator`, `no_rows` and `all_rows_failed` are new.
- `filterItemsForRelease` — **one change**: an empty matcher list returns `{ matched: [], filteredOut: items.length }`. Its comment is corrected: `startsWith(`${m} - `)` **does** claim `Falling Light - Study`, and the test at line 166 covers `Falling Light Study - Framed` (a space), which is a different case.
- `splitLineItemTitle`, `classifyFulfilment`, `orderDedupeKey` — **unchanged**. `classifyFulfilment`'s *argument* changes at both call sites (`MockDataLayer.ts:432` and the new pane) from the positional variant to the whole line-item title. Verified behaviour-identical on all four fixtures.

`src/logic/intake.ts` (new, pure):

```ts
productKeyOf(lineItemTitle): string          // first " - " segment — grouping and the
                                             // one-release guard ONLY
fulfilmentOf(lineItemTitle): BatchFulfilment // classifyFulfilment(whole title)
productsInFile(items): FileProduct[]          // one per distinct Lineitem name, with
                                             // lines, shopifyOrders, records, display
                                             // product/variant, fulfilment, skus
proposeRelease(products): { lineItemTitles; title; productKind }
                                             // ticks proposed only for rows saying
                                             // framed/unframed; Sculpture unless some
                                             // row says framed
skusFor(products, title): string[]           // drops blanks and values mapping to more
                                             // than one title. Nothing else.
matchExistingOrder(existing, item): Order | null
looksLikeRename(existing, product): { was: string; overlap: number } | null
reconcileIntake(existing, incoming): IntakePlan   // no matcher argument
intakeNotes(plan, existing): IntakeNote[]
joinedAfterSend(orders, sends): string[]
countsFor(plan): { rows; lineItems; records; shopifyOrders; collectors }
```

*Correction — `skusFor`.* The previous draft had it drop the literal string `"SKU"`. That literal is an artefact of **this repo's fixture generator**, not of Shopify — counted: FL 268/296, V8 96/104, BI 74/80, NG 118/126, all in the seeded bulk rows. Encoding it as a rule in `src/logic` — the layer the house rules require to be pure and shared by both DataLayer implementations — would write a mock-world quirk into production logic that a real export never produces. It is dropped. If a placeholder filter is ever wanted, it belongs in the seed.

`reconcileIntake` is called by the preview **and** by every data layer, over the same items array, so the preview is true by construction. This lifts roughly eighty lines of matching, dedupe, batch routing and counting out of `MockDataLayer.importOrders`, which `DataLayer.ts:31` already forbids implementations from holding.

`src/logic/templates.ts`, one change: `requiredImageSlots` builds `before` from the union of `sequenceForBatch` over the release's actual batches, falling back to `releaseSequenceFor` when there are none. Verified as a real bug: today `before` comes from `releaseSequenceFor`, so an unframed-only print release is asked for a **Framing** picture no send will ever use.

---

## Kit: reused, and the one new thing

**Reused unchanged.** `Dialog` at `size="lg"`; the body-swap-and-changing-foot pattern from `CsvImportDialog`; `.rd-importdrop`; `Field` with `suggested`, `note`, `multiline deep`, `numeric`; `Segmented`; the kit's plain `Tick`; the bare `.rd-t.rd-t27.rd-fit` table with `Cap`; `Bar` at all three tones; `Facts`; `.rd-after` / `.rd-after-t`; `Foot`; `.rd-grouphd`; `.rd-fields`; `.rd-sw`; `Tag` via `fulfilmentTag` and `productKindTag`; `Pill tone="red"` for Refunded and `Pill` for "Joined late" — a state that changed because time passed, where framed/unframed is a fixed category, and the shape carries the distinction; `None()`; `Why`; `.rd-inline-pill`; `Empty` + `CardHead`; `Page`'s `facts` slot; `PromiseDateModal`; `BatchHistoryTimeline`; `Menu`.

**Not used, deliberately:** `RowTick`, `usePicked`, `BulkBar`. See step 4 — a tick here is a value, not a selection.

**Genuinely new — one component.** `FileProductsTable`. Assembled entirely from parts that exist — `Bar`, `Tick`, the bare table, `Cap`, `Tag`, `None`, `Field` (the filter), `Foot` — so no new CSS vocabulary, only a new arrangement, and the "one table this app draws" ruling is quoted and disposed of in step 4 rather than worked around.

**Generalised, not new.** `ImportIssues` → `ImportNotes({ tone, title, body, columns, rows })`. Three callers: the pre-write notes table, the row-failure table, and the release page's read-only notes view. This is also the fix for its bug — "Everything else was imported." is hard-coded into the component and is false for a whole-file fault. Moving the words to the caller retires it.

**Kit repairs, fixed at the rule.**

1. `Dialog.primary.why?: string`, wrapping the shut button in `Why`. **`rd.tsx:470`** (not 463) renders `disabled={primary.disabled}` on a bare `<button className="rd-btn-pri">`, so "a shut control must say why" is currently unhonourable inside *every* dialogue in the app — including both doors of today's flow (`NewReleaseModal`'s `!title.trim() || !artist.trim()` and `CsvImportDialog`'s `!effectiveCsv.trim()` say nothing). This design needs it seven times.
2. `@media (max-width: 700px) .rd-dialog.inf-dialog` (`redesign.css:4319`) is keyed to a class nothing in this app wears, under a heading saying every dialogue is a sheet on a phone and a note that the owner works this section from his phone. Re-key to `.rd-dialog`. A **dependency**, not a nicety: this flow is a dialogue with a table in it.
3. `.rd-modal .rd-tab.on` (`redesign.css:915`) is the same phantom-class fault; add `.rd-dialog` and record it. Not load-bearing here.
4. `.rd-importlist td:first-child { width: 40% }` is re-keyed for three columns.

---

## Day the sync lands

1. **One new function.** `fromShopifyApi(json): ParsedLineItem[]`, beside `parseShopifyOrderExport`. The sync calls the existing `addOrders(releaseId, items, { kind: 'shopify_sync', label: 'Shopify' })` with `by: 'system'`. `reconcileIntake` runs unchanged, so the first synced pass over a CSV-populated release **reconciles** rather than creating 294 more Falling Light orders.
2. **Release-to-product matching, once.** Every release carries `productMatch.lineItemTitles`, captured from Shopify's own export strings rather than typed, so it is an exact match against the API's product titles; `skus` is a second correlate where the export carried real ones (FL-FR, FL-UF, NG-FR, V8). Anything matching on neither is listed for a human. The sync writes `shopifyProductIds` on that match, and from then the product id is the join and the titles are the fallback.
3. **Order matching.** `matchExistingOrder` prefers `sourceLineRef` **only when both sides share a namespace prefix** (`csv:` vs `shopify:`), else `orderDedupeKey`. The sync's first pass backfills `shopify:` refs onto every order it matches; from the second run the line-item id is the key and the lossy `name::title` collision — and with it the whole retitle hazard — is gone.
4. **The UI.** Pane one disappears for a synced release; **Add orders** opens straight on pane two, fed by the API's product list. Same ticks, same counts, same Batch tags, same guards, same stored result. Create keeps both doors.
5. **Copy costs nothing** — because the intake fact is no longer in the head. The timeline line becomes "6 orders added from Shopify" with no component change, read off `Intake.source.label`; the All orders foot reads "300 orders · last added 09:14 today". Nothing on the release page is reworded on sync day, and this time that claim is true. The only place the word CSV survives is inside the upload dialogue, which is what the sync removes.
6. **What the sync then buys, and nothing before it does:** refund and cancellation webhooks (this design reads `Financial Status`, refreshes it on re-import, and stops there); `Fulfillment Status` closing the loop on dispatch; cross-release customer identity; real order ids (turning `ReleaseOrdersTable`'s search-based Shopify link into `/orders/<id>` in one line).

**Build order, because this is three slices.**

1. **Behaviour-preserving, shippable alone.** `ParseFault` + the carry-forward for the two order-level columns; `classifyFulfilment(lineItemTitle)` at `MockDataLayer.ts:432`; `filterItemsForRelease`'s empty case inverted and its comment corrected; `requiredImageSlots` built from `sequenceForBatch`; `ReleaseDetail.tsx:130` and `:215`; `Dialog.primary.why`; the `.inf-dialog` re-key; `BatchEvent.batchId` nullable; the images band reworded to "at least". Every one verified identical on the four fixtures.
2. **The flow.** `intake.ts`, `FileProductsTable`, `ProductMatch` (backfilled — **`seed.ts` passes `shopifyProductIds` and a CSV for all four releases at lines 191-391 and must be migrated to `createRelease(input, {items, source})` + `addOrders`**), `Intake`, `addOrders`, `claimantsOf`, both dialogue doors, both guards, `deleteRelease` / `undoIntake` / `setProductKind` — the removers ship **with** the flow, not after it.
3. **The post-write bands.** Late arrivals, approved-audience growth, `joinedSinceApproval` on the approval queue, `renameRelease`'s re-render. Touches screens outside this flow and should not hold the flow up.

---

## Deliberately not built

- **A staleness nag or re-import reminder.** Under a sync it is noise. The honest stand-in is the All orders foot's last-added fact, which is data rather than a prompt.
- **A column-mapping UI.** The header is fixed and known; a mapper is a screen the sync deletes. (The semicolon case is a re-export instruction, not a mapper.)
- **Multi-file upload or merge.** Sequential uploads are already equivalent — dedupe is on the record, not the file.
- **Refund or cancellation inference from `Financial Status`.** Read, stored, refreshed on re-import, reported, never acted on.
- **Storing the CSV blob.** The `Intake` record and `Order.intakeId` answer every question a stored file would — and `undoIntake` answers the one that made a stored file tempting.
- **A UI for `titleMatchers`.** Deleted, not grown. The stored `ProductMatch` and its correction dialogue replace it.
- **A new Status value on the releases index.** `status` is a lifecycle; "has no orders yet" is not one, and the Orders column already reads `0`.
- **Quantity splitting a collector into several.** Captured, reported, refreshed; never a second email.
- **A stepper or progress rail.** The pane count is argued on its own merits, and position is carried by the dialogue title and a **Back** verb. The HANDOVER:247 citation is withdrawn — it is the CRM-handoff ruling and does not say what it was cited for.
- **A placeholder-SKU filter in `src/logic`.** A mock-world quirk; if wanted, it belongs in the seed.
- **Recipient dedupe by email.** The retitle guard removes the cause; deduping recipients would hide a genuine double-purchase, which is a real thing a collector does.

---

## Four decisions you might reasonably overrule

1. **Creating from a file is the default, but not the only door.** `Set up without a file` stays: the sync will create releases before any order exists, and the emails tab is genuinely useful pre-drop — now that edits made there are logged. The cost is a state that has to be drawn and guarded, and someone will create one by habit. If you want the file mandatory, delete the link and the empty state — but the two `ReleaseDetail` guards stay either way, and so does the empty-matcher inversion.

2. **The release title stops being the Shopify join key.** The one call that cannot be retrofitted cheaply: every order imported under title-matching carries no product reference, so on sync day you either reconcile or map four releases and 603 orders by hand. It also makes renaming safe — as long as `renameRelease` re-renders, which §13 now requires. **The new cost, stated plainly:** demoting the title removes the informal collision signal a second operator relied on, which is why 4a's claimed-title check is not optional. If you would rather keep one field doing both jobs, say so now; everything else here is additive and this is not.

3. **Reading `Financial Status` and doing nothing about it.** The column is in every export and read by no code, so a refunded collector receives every milestone email in silence today. I report it, refresh it on re-import, and stop. That is one step from the README's v1 ruling and will look inconsistent to anyone who does not know the rule. Honestly: **604 of the 606 rows say `paid` and the other 2 are blank continuation cells; no fixture carries `refunded` or `voided`, and all 606 rows are quantity 1.** So the refund and quantity notes are designed from the header, not from evidence, and the real gateway vocabulary (`partially_refunded`, `voided`, `pending`) wants checking before the words are settled.

4. **The images band is drawn always, with the count as a floor.** The previous draft suppressed it, on arithmetic that does not hold: the count is **6** for every promise date under about 120 days, reaches **7** at ~120, and **8** only when both batches sit at ~150 — and the seeded Falling Light dates (+10 and +20 days) move it by **zero**. Suppression would also have gone quiet on a release with one batch dated and its plan already heading for approval, where `NO_IMAGE_YET` is the blocker. So the band says "At least 6 emails have no image". If you would rather it never overstate, the alternative is to drop the number and say "Images not picked" with the control — but not to hide it.

---

## Minor findings — the ledger

Every minor finding is fixed; none was judged not worth fixing.

| Finding | Where it is fixed |
|---|---|
| `ReleaseDetail` line 130, not 142 | §7 — `singleBatch = batches.length <= 1` at **130**, `batches[0]?.id` at 215 |
| `rd.tsx:470`, not 463 | Kit repairs 1 |
| "Four of the sixteen columns" | `src/logic` — three of the seven unread columns; `quantity` was already parsed |
| Invented note rows (`#AA10419`, `#AA10501`, `#AA10605`) | §5 — five real rows; the three header-designed ones labelled as unfirable; the country conflict moved to Night Garden |
| "294 orders ticked" under an Orders column | §4 — column head **Shopify orders**, totals keep **Orders**, foot states both |
| `wrongFile` has a second caller | §3 — removed from the component **and both callers**; the allocation door gains its own content-judged rejection |
| "The four `.rd-sw` switches" | §4 — four for a print, one for a sculpture; the Segmented rewrites the switch list as well as the Batch column |
| `NoneYet` in the head; "Artist is required" only in a `Why` | §8 — `NoneYet` dropped; §4 — `note="required — not in the export"`, `Why` as the second place |
| `skusFor` drops the literal `"SKU"` | `src/logic` — the rule is dropped; it is a fixture-generator artefact, not Shopify |
| Notes band justified as a warning that qualifies nothing | §5 — justified as **evidence**, the pre-write equivalent of a `Foot` count |
| The drop target swallows `.xlsx` | §2 — the label handles `onDrop` itself and judges on content |
| `not_an_export` names the allocation sheet with certainty | §3 — `wrong_separator` split out; the band names the **columns found** |
| HANDOVER:247 does not support "no stepper" | §2 — citation withdrawn; the title carries the state and the secondary reads **Back** |
| "gains six" / "all five fixtures" / framing cross-reference | types diff — nine, counted; four order-export fixtures (the fifth is the allocation sheet); the framing claim now points at *Failure modes* → **Sculpture sold in finishes** and the Segmented's stated consequences |