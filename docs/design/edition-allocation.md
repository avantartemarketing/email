# Edition allocation — how the workbook works, and what to build

Written 31 Aug 2026, from `TEMPLATE_Edition_Allocation_Tool.xlsx` (21 tabs) supplied by
the owner: *"This is a model for allocating editions within a release. Read the
spreadsheet and understand how it works. I'm interested in building the
functionality into this post purchase tool."*

Published as an artifact: https://claude.ai/code/artifact/5147d703-854d-4203-84cc-24fd9738a4fe

Everything below was re-derived from the file, or measured by running this repo's own
code over the real export it contains — the sheet's own summaries are not quoted,
because two of them turned out to be wrong.

**Status:** slice 1 (the framing join) is built and pushed. Slices 2–5 are designed,
not built. See *Slices* below.

## What the workbook is

A Google Sheets template, copied per release. A raw Shopify order export goes in; a
warehouse pick-list with an edition number on every line comes out. Its final tab,
`Edition Allocation`, is exported as CSV — **and that CSV is the file
`src/logic/allocation.ts` already parses.** The tool is the consumer; the proposal is
that it becomes the producer.

The pipeline:

| Tab | Job |
| --- | --- |
| `Raw Shopify Import` | one row per line item; **a frame is its own line, not a variant** |
| `Codes`, `SKU Map` | derive the artworks from the line-item title — the bad hop |
| `Shopify Cleaned` | `Print 1`…`Print 10`; framing/glass/mount resolved from the SKU |
| `Order Matrix` | count distinct artworks per order; biggest set gets priority 1 |
| `Order Summary`, `Frames Summary` | unpivot to one row per order × artwork; attach the frame spec |
| `Edition Allocation` | **pasted values**, exported to the warehouse |
| `Order Changes` | hand-run triage: tags vs line items (19 auto · 4 review · 3 info) |
| `Framing Studio` | a quote sheet for the external framer |

The ordering rule, in a cell comment on `Order Matrix!P1`: *"Ranks each row by set
size. The largest set size in column O gets priority 1, smaller sets get progressively
lower priority."* Tie-break inside a group is oldest order first. It holds in the data.

## The four faults

1. **A comma in a title becomes a print.** `Codes!B` runs
   `SUBSTITUTE(REGEXEXTRACT(name,"^(.*) -"), ", ", ";")` and treats the pieces as
   artworks. `"Flowers of Heaven, 2018"` becomes two prints, one called **2018**, which
   gets its own edition sequence 1–187 on the warehouse sheet. 559 of the 1,601
   allocation rows name a bare year. The mirror is worse: `"Set of Four"`, the SKU that
   really is four prints, has no comma, so it counts as one — 109 orders get a single
   line for an object numbered out of a sequence that does not exist. Real artworks in
   the release: **4**. Artworks the sheet believes in: **9**.

2. **Both self-checks are dead and both report a pass.** The gap/duplicate check reads
   `C1`, which has resolved to `#REF!`, so it compares 0 to 0 and reports `TRUE`. The
   cross-artwork consistency check reads column `H` (`Set_Size`) instead of `I`
   (`Edition No.`); set sizes are equal by construction, so it can only ever say
   "consistent". It prints *"All multi-print orders have consistent edition numbers"*.
   **13 orders are not consistent.** `Edition Overrides`, the escape hatch two REVIEW
   rows tell the operator to write into, is header-only and referenced by no formula
   anywhere in the workbook.

3. **The priority engine reads five columns of twelve.** `Order Matrix!O` sums `C:G`
   over a matrix spanning `C:N`; `H:N` compare a print name against an instance number
   and can never match. Confined to the ranking column — the `Set_Size` that reaches
   the warehouse is computed elsewhere. The exported CSV was also assembled in ~47
   append passes, so priority is not globally respected in the file that shipped.

4. **It is a template and carries the last release with it.** `Suggested Flags` is 189
   rows of `SANCH-` (Tomás Sánchez); `Framing Studio`, the framer's brief, is headed
   *"Autorretrato en tarde rosa"*. Six SKU prefixes coexist in the file, and the visible
   input tab is not the one the allocation was computed from.

## The live bug this turned up in our own code

**This upload is the first real Shopify export the project has seen.** The fixtures
were written from an assumption — that a line item reads `"Falling Light - Framed"`.
It does not. Real Avant Arte line items say `"Black Abachi Wood Frame - UV protective
acrylic"`; the word *framed* never appears, and a frame is a **separate line item** on
the same order.

`classifyFulfilment` tests `/framed/i` against the title. Measured over every line item
in the workbook — 3,668 orders across six releases, 1,523 of them (42%) genuinely
framed — it returns `framed` for **zero of 1,760 frame line items**.

Running the Ai Weiwei *Guardian* export through the real add-a-release flow unmodified:

```
products listed   45 rows, prints and frames mixed   (should be 3 artworks)
proposed title    "Guardian (Purple)"                (should be "Guardian")
product kind      sculpture                          (should be print)
batches           [ unframed ]                       (should be framed + unframed)
framed rows       0 of 1,511                         (should be ~437 of 1,070 print lines)
one-product guard refuses the release                (three artworks, one release)
```

So on a real release every collector lands in the Unframed batch on the unframed
timeline, the printing and signing emails are dropped as well (sculpture), and the
one-product guard blocks the release from being created at all.

Two more found while checking: `MockDataLayer.importAllocations` carries the same
regex, so a framed order takes the wrong sheet rows; and `recipientCount` counted
order rows while being drawn as "N collectors", so it overstated the audience for
every multi-artwork collector.

*(Corrected 31 Aug, after reading the send path properly: a send is one job per
BATCH, not one per order, so nobody was receiving duplicate emails. The count was a
label that lied, not a send that duplicated. Both are fixed below.)*

**The fix is a join, not a better regex.** An order line is framed when a frame line
exists on the same order for the same artwork. Both halves are already parsed — `sku`
was added last week, and `productKeyOf` already returns `"Guardian (Purple)"` for the
print and its frame alike. Measured on the same 1,511 lines:

| Join key | Framed | Unframed | Unmatched frames |
| --- | --- | --- | --- |
| today — regex on the title | 0 | 1,511 | n/a |
| order + artwork title | 437 | 633 | 4 |
| order + SKU art code ◆ | **439** | 631 | **2** |

The art-code join wins: it recovers two Albers frames whose title differs from the
print's by one comma.

## What to build

The tool models *release → order*. This needs *release → artwork → SKU → order line*.
Adding the middle two makes allocation possible **and** fixes the intake bug, because
framing and artwork identity come off the same join.

The rule that kills the class of bug: **an artwork is a record a person confirmed,
never a string the app split.** The add-a-release flow already works this way one level
up — you tick rows from the file rather than typing a title.

| Workbook | Becomes |
| --- | --- |
| `Codes` · `SKU Map` | Artworks step — confirm artworks and which SKU delivers which |
| `Shopify Cleaned` · `Order Summary` | `src/logic/intake.ts`, extended with the frame join |
| `Order Matrix` | pure ordering rule, declared per release as data |
| `Edition Allocation` | `src/logic/editions.ts` — a pure allocator |
| `Order Changes` | Auto/Review/Info worklist — same shape as the approval queue |
| `Edition Overrides` | per-order pinned numbers, actually wired in |
| `Framing Studio` | stays a spreadsheet; it is a quote sheet for an external framer |

`src/ui/DataTable.tsx` already supports locked columns, bands, captions and default
views, so the tables are configuration rather than new components.

## The hard part, measured

Number each artwork independently by rank and a collector's position in *Flowers of
Heaven* depends on who else bought that print — a different crowd from *Lollipop*. That
is exactly why 13 orders came out mismatched.

Allocating **per order** — walk the orders in priority sequence, give each the lowest
number still free in *every* artwork it bought — keeps a set together but skips
numbers, and a numbered edition cannot have holes. Whether later single-print buyers
backfill them is not something you can reason about, so it was simulated over the real
770 orders:

```
770 of 770 orders got one number across all their artworks
  0 gaps in any artwork's sequence
  0 orders that had to be split
 22 orders whose number sits above their strict rank — the whole cost
```

Sequences land at 187/187/187/185 and 111, cross-checking exactly against the
workbook's own census. **The elaborate hole-reservation machinery this seemed to need
is not needed** — a greedy rule produces a perfect result on the real data. It is not
perfect in principle (an adversarial case with no valid assignment exists), so the
allocator must still report a split rather than hide one. With `Set of Four` expanded
the result holds: 1,190 numbers, no gaps, no splits, 135 of 770 above strict rank.

## Slices

1. ~~**Fix the framing join**~~ — **shipped 31 Aug.** `isFrameLine` reads the SKU's
   third segment (`FR`), `artCodeOf`/`artworkKeyOf` give the join key, and
   `resolveFulfilments` frames a print when a frame line sits beside it on the same
   order for the same artwork. Frame lines are **absorbed** rather than becoming
   orders of their own — a framed purchase is one thing to make and ship. The write
   path reads the plan's answer instead of re-deriving it, `importAllocations` reads
   the order's batch, and `recipientCount` counts distinct emails. A real-*shaped*
   anonymised fixture (`HARBOUR_LIGHT_CSV`) and 17 tests guard it; both halves of the
   fix were regressed on purpose first and reported nine and one named failures.
   Measured on the real Ai Weiwei export: 1,070 orders and 441 frames absorbed
   against 1,511 order rows before, both batches justified, 439 framed / 631
   unframed, 2 orphan frames reported. **Not fixed, and needing slice 2:** the
   proposed title is still one colourway ("Guardian (Purple)"), and the one-product
   guard still refuses a three-colourway release — verified in the browser, the
   dialogue says *"Harbour Light (Dawn) and Harbour Light (Dusk) cannot share a
   release."*
2. **Artworks as a confirmed record** — about a week. Fixes the title, the sculpture
   misclassification and the one-product guard. No allocator needed.
3. **The allocator as pure logic, no UI** — about a week. Invariants that *cannot* pass
   vacuously (the workbook's failed by comparing zero to zero). Prove it by reproducing
   the workbook's own 857-row output, then by catching its 13 mismatches.
4. **The Editions tab and the CSV out** — two to three weeks, mostly DataTable config.
5. **Changes worklist, pinned numbers, freeze after telling a collector** — the
   quarter-sized one; needs the answers below.

## Questions for the owner

1. ~~**Does "Set of Four" ship as four numbered prints?**~~ **Answered 31 Aug:**
   *"we don't do bundles anymore but used to."* So no future release needs a SKU that
   delivers several artworks, and the design collapses — a SKU maps to exactly one
   artwork and `SkuComposition` is not needed. The measured allocation result that
   applies is the simpler one: matched numbers, no gaps, 22 of 770 orders above strict
   rank. It leaves one OPERATIONAL question, not a design one: Murakami is mid-flight
   and did have a bundle, so those 109 orders still need a decision about what goes on
   their certificates. That is a backfill.
2. **Is edition size per artwork or per release?** It is on `Release` today and shown in
   the identity line; moving it touches the releases index and add-a-release.
3. **Do edition numbers appear in the emails?** Still open from an earlier round. No
   template carries the token. It decides when a number is *published* and frozen.
4. **When tags and line items disagree, which wins?** The workbook trusts tags. That is
   a policy, not a fact — on the Ai Weiwei file they disagree on 4 of 441 frames.
5. **A collector cancels after being told they have #12 — does 12 die or pass on?**
   Cancellations here are marked by hand months later, so this fires routinely.
6. **Does the warehouse still send the sheet back with edits?** If so the tool needs
   reconcile-on-return, not just an export — and that is a conversation with them.
