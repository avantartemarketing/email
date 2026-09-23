# Session handover — post-purchase comms tool

Written 28 Aug 2026, for whichever session picks this up. Read `README.md`
first for product context and architecture; this file is only *state*: what
happened, what's in flight, and what to do next. Delete it once absorbed.

## Where things stand

**The UI is Workbench-rd now. Shopify Polaris is gone.**

Tom sent over an admin design system as a folder — tokens, 21 components, the
written rulings behind both, and the checks that keep them from drifting — and
asked how the tool would look wearing it. It was ported screen by screen, with
no behaviour changed and the logic layer untouched.

- The kit lives at `src/rd/` (its `css/`, `components/`, `lib/` verbatim) plus
  `src/rd/css/app.css`, this product's own layer for the two things the kit
  deliberately does not ship: the navigation furniture and the email artifact.
- `src/ui/rd.tsx` is the primitive set every screen is built from — Page, Card,
  Dialog, Pill, Tag, Bar, Facts, Cap. Each is kit markup with a React shape
  around it. **Reuse it before writing anything**, and reach for
  `src/rd/components/*` before either.
- `docs/PORTING-BRIEF.md` is the local contract; `.claude/skills/workbench-rd/`
  is the kit's own skill, so a future session works to the system rather than
  to its own taste.
- Bundle: 1,093 KB → 363 KB raw, 227 KB → 106 KB gzipped. No UI dependencies.

**Three checks, and `npm run build` runs the first two:**

```sh
npm run check           # prove-tokens + prove-kit, on the kit AND the app
npx vite preview --port 4173 &
npm run check:screens   # 34px rows on every table, one-row heads, no cell over
                        # another, Inter loaded — measured on a real render
```

Four faults were found by rendering rather than by reading, and each is
recorded at the rule that carries it:
1. the email preview measured 652px against a ruled 600 (`box-sizing`);
2. the reschedule dialogue's Save button sat below a 600px preview, off-screen
   (sticky foot — and `prove-screens` now measures it, after being made to fail
   on purpose once);
3. every dialogue was drawn against whichever ancestor turned out to be its
   containing block, so the image picker's scrim covered only its own card
   (dialogues portal to the body now, as the kit's `Menu` already did);
4. the single-file artifact rendered in a system face because Vite rewrites the
   font's absolute path to `./fonts/…` — twice, in two different ways. The
   artifact build now patches the written file and asserts nothing survived.

**Every table has the same four controls** — search, Columns, Group, Sort and
Add filter — drawn by `src/ui/DataTable.tsx`, which is now the one table this
app draws. A screen declares its COLUMNS once (title, how to draw the cell,
and where the column is a fact, how to read its value) and the header, the
cells, the Fields menu and the three view controls all come off that list. A
column with no `value` is a gutter and is never offered; a `locked` column is
never hideable — the identity, and everything carrying a warning. Grouping
draws ruling 14's bands. The view is remembered per table.

**The mock world is release-sized**: 605 orders across four releases, 293 of
them on Falling Light, with the warehouse sheet and HubSpot directory grown to
match. The hand-written rows are untouched at the top of each fixture — they
carry the edge cases the seeded story and the tests depend on. Three
assertions that counted the old world now state the invariant instead.

**Tom's structural round is also in:**
- **All orders** is the release's first tab — one row per PRINT, all fourteen
  warehouse/customer columns, hideable, order number linking into Shopify.
  The Shopify store handle in `ReleaseOrdersTable.tsx` is `avantarte-prod`,
  confirmed by Tom on 22 Sep 2026 (it was a guess, `avant-arte`, until then).
- **All emails** is the second tab, and lists as many on-track slots as the
  release's LONGEST window will send (`onTrackSlotsNeeded`). Subjects render
  with tokens resolved.
- Pushing a date out that needs another on-track email raises a dialogue at
  that moment and leaves a derived band on the release until images are picked.
- The image picker is a grid with a working upload (data URI into the mock
  layer). Seeded names draw the kit's hatch: they live in HubSpot, not here.
- New order fields: `country` and `shopifyTags`, read from Shipping/Billing
  Country and Tags, carried across continuation rows, both optional.

**Tom's table-texture round (28 Aug, latest) is in:**
- **Warnings went back to the Shopify shape** he preferred: a bold line saying
  what is wrong, then the detail underneath. `Bar` takes a `title` now, and all
  eleven call sites were rewritten to lead with the fault rather than with a
  paragraph.
- **Lozenges in the tables.** Fulfilment, glass, mounting, batch and frame
  finish are tags, not bare words — `fulfilmentValueTag`, `specTag`,
  `frameFinishTag` in `src/ui/format.tsx`. The frame finish carries a colour
  swatch beside the word (never instead of it); an unknown finish gets the word
  and no swatch rather than a guessed colour.
- **Country is a flag**, drawn as inline SVG in `src/ui/Flag.tsx`. The kit's
  own `Flag` loads `/flags/<iso>.png`, which resolves to nothing in a
  single-file artifact and fails *silently* — the exact shape of bug the font
  produced twice. Thirteen countries drawn; a fourteenth is one line.
- **The order number is blue and opens Shopify** (`.rd-extlink`).
- **All orders has bulk actions**: mark cancelled (reason required, they drop
  out of every future send), move to another batch, and set a new promise date.
  The last one reuses the whole reschedule flow — so picking part of a batch
  splits it, exactly as it does from the batch tab. A selection spanning
  several batches is asked which batch's date is changing, one at a time,
  because a promise date belongs to one batch and doing three silently would
  send three different delay emails from one click.
- **The promised-dispatch bar was redrawn.** "From 17 Sept" is gone; the
  promise reads as the window it always was (`shipWindowShort`), beside the two
  facts that were missing — collectors in the batch, and the next email — with
  the actions level with the figures. Four alternatives were drawn and rejected
  on the record: see the studies artifact below.
- **Approval queue**: Status became **Overdue** and draws only the exception —
  a "Pending approval" pill on all ten rows hid the one that was late. Last
  received is a date, and clicking it opens the email itself in a popup rather
  than navigating away. Batch is visible. The who-column is named by tab —
  *Submitted by* on Pending, *Held by* on Held — because a send in the pending
  queue has by definition not been approved by anyone, and a column that is a
  dash on every row costs width and answers nothing.

**The image round (28 Aug, latest) — three asks, and the answer to a fourth:**

- **There is no master default any more.** Tom: *"For the image selection, it
  shouldn't have a default."* `templateImages[slot]` used to be an OVERRIDE of
  the HubSpot master's own picture, so an unpicked slot was a silent fallback.
  It is now the only answer there is, and an unpicked slot is unfinished setup.
  - `logic/templates.ts` owns the rule: `requiredImageSlots` (which slots a
    release owes a picture for) and `missingImagesFor` (which it has not got).
    The row list, the count, the warning band and the refusal all read that one
    list, so they cannot drift.
  - The cell has three readings and the SHAPE carries them: a chip with the
    name, the dashed `NoneYet` invitation reading *Not chosen*, and a plain
    dash for a switched-off email that will never send. `NoneYet` is new in
    `ui/rd.tsx` and wears the kit's `.rd-ctag-none`, which nothing wore before.
  - **The gate is at `approveSend` and nowhere else.** Gating plan generation
    was considered and rejected on the evidence: the on-track slot count is
    derived from the date being typed, so a refusal there can demand a slot
    whose row does not exist until the date is saved. It would also refuse to
    record a slipped delivery date over a missing picture — and the person who
    pays for that is the collector owed a delay notice. `Submit plan for
    approval` is shut with a `Why` as the earlier, kinder catch.
  - `onTrackSlotsInPlay` holds a slot open for a queued send after the window
    has shortened. Without it a send can point at a slot with no row, which
    nobody could fix and nobody could approve.
  - The seed now picks its own images (`pickImagesFor`); **Night Garden
    deliberately does not**, so the unfinished state is visible in the demo.

- **My approvals** replaces the Approval queue. Tom: *"shows both live
  approvals that need making now, and all future approvals that are coming up."*
  `logic/approvals.ts` owns the split — pending and inside seven days is "now";
  everything else is "coming up" — and the rail's badge reads the same
  predicate, so the number beside the name is work owed rather than inventory.
  Two tables, not one grouped one: grouping is user state that can be switched
  off, and the two halves want different shapes (the urgent one has a tick
  gutter, a bulk approve and three verbs; the calm one has none of them).
  `prove-screens` now proves no send is drawn in both.

- **Hold is gone.** Tom: *"they can reschedule a send, or they can mark it as
  cancelled."* The `held` status, `heldBy`/`heldAt`, `holdSend`/`unholdSend`,
  the Held tab and the violet Held pill are all removed; `ChangeSendDateModal`
  and Cancel send are on the row in their place. The seeded held send is now
  pushed back by its approver, and one Vessel VIII update is cancelled outright
  so the demo has a deliberately cancelled send to show.

- **"What does Switch off add?"** — it stays, because it does one thing nothing
  else can: a hand-cancelled milestone COMES BACK on the next reschedule
  (`remainingSequence` drops only SENT ones), where a switched-off one cannot.
  It also strips the stage from other queued emails' "What happens next?" rows,
  which `cancelSend` does not. But three things about it were wrong and are
  fixed: "Off" has left the Copy column (it was a lifecycle answer in a column
  about copy, and it hid a stored override); switching off On track no longer
  deletes the row carrying its own "Switch on"; and it now confirms first,
  naming how many queued sends across how many batches it will cancel.

**The can't-approve round (29 Aug, latest):** an email an approver cannot
approve is one of two problems, and the queue now routes each to its remedy.

- *"True, but not yet"* → **Change email date** (renamed from "Change date":
  two date verbs one click apart need their objects in their names). The
  dialogue now fetches the batch's other queued sends and warns when a move
  lands out of order or crowds another email inside the plan's own seven-day
  floor. The 7-day approvals horizon is the snooze: a moved email leaves "To
  approve now" and re-enters it, badge and all, when it is due — the toast
  says "it comes back up for approval nearer the time".
- *"No longer true — the promise slipped"* → **Change delivery date**, now
  reachable FROM the queue: a door in the preview (which also carries a
  "Promised dispatch" fact, so the email's claim is checkable in place), and
  a hard CEILING in the email-date dialogue — no update may land on/after the
  dispatch email, and dispatch may not land after the window opens. A date
  that does not fit blocks Move send and offers the pivot; picking an
  impossible date IS the diagnosis. The reschedule is scoped to the send's
  batch, reuses `RescheduleModal` wholesale, and supersedes the un-approvable
  email as a side effect (plan regenerated, delay notice lands at the top of
  the queue, pending, for the same approver).

**Promise date overview (same round, renamed twice on 29 Aug — Batches →
Release overview → this):** a rail item between Releases and Emails to write — every release opened out into the batches it ships in,
with active collector counts and the promised window (`listBatches()` on the
DataLayer). It OPENS grouped by release via a new `defaultView` prop on
DataTable (an initial view used only until the user changes anything), and
DataTable drops the grouped column from the grid while its bands are drawn —
the band already prints the value, and a column repeating its own heading was
two marks for one fact.

Tom renamed it and sent a reference for the shape: *"Batches should be called
Release overview, and look more like this. The Grouped headings wouldn't be in
status lozenges though."* Then, an hour later, *"Change Releases over view to
Promise date overview"* — each rename moving the name closer to what the page
is opened to find out. So:

- the band stays ruling 14's caption-over-value and the release title stays
  BARE — a lozenge is a mark on a status or a category, and a release title is
  a name, not a state;
- the batch name moved from a teal tag to emphasis (`.rd-ink`), because grouped
  by release it is the row's identity and the reference sets an identity in
  weight; the fulfilment tag it used to carry has its own column in Fields;
- **grouped bands now FOLD.** The kit records shipping a band whose chevron had
  no handler behind it — "it looked collapsible for months and never was" — so
  `DataTable` wires `open`/`onToggle`. Session state, not view state: a filter
  somebody lost is worse than no filter, but a fold somebody forgot is a table
  quietly hiding rows next visit. Folding a group also deselects its rows, so a
  bulk action can never fire on a row nobody can see.

`prove-screens` asserts the page opens banded, that pressing a band actually
removes rows (made to fail by restoring the old handler-less chevron), and —
new, `checkNaming` — that a top-level screen's rail row, bar and title all say
the same name. That last one exists because the first rename changed two of the
three and left the bar saying "My approvals" over the release overview.

**No helper text (29 Aug):** Tom, *"Remove all helper text like 'Every release
in production, opened out into the batches it ships in — who has been promised
what, and how many.'"* Gone from every worklist: the subtitle under each title,
the explanatory clause in each table's foot (the COUNT stays — that is data),
the band on Emails to write explaining whose queue it is, and the one on My
approvals announcing that approving is admin-only. The restriction is not lost
with that last one: the shut Approve control carries its reason in `Why`, which
is where the kit rules it belongs — "never the only place something is said".

What stayed, and the line it draws: **warnings** (an order with no email, an
email with no image — they qualify a control), **empty states** (what a screen
says when it has nothing is not helper text), **field notes** that carry a rule
("required — the CRM writer works from this"), and the subhead on a RECORD
screen, where it is the record's identity (artist · edition of 150 · Print)
rather than the page describing itself. `checkNaming` now enforces that edge
directly: a screen reached without a crumb is a worklist and may carry no
`.rd-subhead` at all. Made to fail by putting one back.

**The CRM handoff (29 Aug 2026)** — Tom: *"When someone schedules a delay, the
job of writing the email goes to the CRM team. So we need it to trigger a
notification to them and appear in a view where they can see the reason for the
delay and write the email."*

The reschedule dialogue lost its second step. It used to make the person
scheduling the delay write the collector email on the spot; now that act belongs
to CRM, so the dialogue is one form (date + reason) and the reason is no longer
a field you fill in to unlock a text editor — it is the BRIEF, and its note says
so. What changed underneath:

- **A new send status, `awaiting_copy`.** `planReschedule` mints the delay send
  in it (drafted from the release's delay template with the reason patched in,
  so nobody opens a blank page) with a `DelayBrief` attached — old date, new
  date, reason, who asked, when. It is not in the approval queue: `approveSend`
  refuses it by name (`NOT_WRITTEN_YET`), because an auto-drafted email in front
  of an approver is how a template goes out under a human's name.
- **A `Notification` record**, built in the pure logic layer so both DataLayer
  implementations raise the same one, addressed to a **team** (`Team = 'crm' |
  'ops'` on `User`) rather than a person — a person goes on holiday and the
  delay notice does not wait. Phase 2 delivers it to Slack and email; phase 1
  delivers it to the rail badge and the queue, which is the same event on a
  shorter wire.
- **Emails to write** — a new rail item and screen (`/copy`). One row per
  unwritten delay email: needed-by with an Overdue pill, a New pill while its
  notification is unread, collectors, how far the promise slipped, and the
  reason (capped in the row, in full above the fields in the writer). The writer
  pre-fills the draft, previews the real email, and `Send for approval` moves it
  into My approvals. `Save and finish later` holds half-written copy.
- **The badge summons CRM only.** The page is open to everyone — an ops lead
  should be able to see what is stuck, and a collector owed a delay notice must
  not wait for the right person to be at their desk — but a badge counting
  somebody else's work is a badge you learn to ignore. Ops sees a note saying
  whose desk it is instead.
- The seed now replays the handoff: two of its three reschedules were written
  and approved, one Vessel VIII delay has sat unwritten for six days (the
  overdue copy job) and today's QC reprint on Falling Light is the fresh one.
- `prove-screens` gained `/copy`: no row may offer *Approve*, every row offers
  *Write the email*, the brief is drawn above the fields it briefs, and `Send
  for approval` stays on screen above the 600px email preview — the hazard that
  used to live in the reschedule dialogue moved here with the preview. Made to
  fail three ways on purpose before being kept.

**The brief, quoted and signed (29 Aug, same day):** Tom, on seeing it — *"When
you're writing the email you should be able to see the delay reason the person
who delayed it wrote. The flow is: Warehouse change date and delay write reason
→ Goes to CRM to write email."* The reason was already on the writer and read
as app copy: a blue advisory band, the same shape as the note above it saying
whose queue this is, with the same sentence again inside the drafted body
below. So `components/DelayReason.tsx` — one bar, three screens:

- it QUOTES the reason, because they are somebody else's words, and SIGNS it
  with the name and date, because "the person who delayed it" is somebody the
  writer can go and ask;
- it is on the **writer** (to write from), the **approval preview** (an
  approver's question is "does this say what actually happened?", and until now
  the only thing that could answer it was the email being judged) and the
  **send's own page** (where anyone else lands asking why this went out);
- the writer's "Requested by" fact box went, since the signature says it.

`prove-screens` now checks the writer's brief against the row it was opened
from — the same reason text, the same name — rather than only that a bar with
the right heading exists; a generic unsigned bar fails it, demonstrated. A
seeded-world test pins that `submitDelayCopy` does not consume the brief, so
the approver still has it.

`npm test` → 158 green. `npm run build` clean. `check:screens` clean.

**Release tabs — three hierarchies (29 Aug, exploration, nothing built):** Tom,
*"I think we need a visual difference between the tabs for all order, emails and
batches. The batches is a tab and then the different batches is a sub level
within that. Explore 3 ways of doing this."* The strip runs seven peers today —
All orders, All emails, then one tab per batch, all the same size and shape, and
it grows with every reschedule. Three options drawn in the real kit (the source
is `docs/explorations/release-tabs.html`, inlined with the real CSS and the real
font by a scratch script, so the widths are honest):

1. **Two tiers, two kinds of control** — three tabs; Batches opens a second row
   drawn as the kit's SEGMENTED control, which the system has already ruled is
   "NOT a tab — it changes a value while the screen stays the screen". The rank
   comes from the control's kind, not its size. Recommended.
2. **One row, the batch inside its tab** — `Batches · Framed 2 ▾`, a tab that
   is also a menu. Never grows; hides the list.
3. **A sub-rail inside the Batches tab** — batches down a 196px left column.
   The clearest hierarchy, and the most expensive in width.

Tom picked option 1 — *"Option 1 but the styling looks off"* — and he was
right. The exploration drew tier 2 as the kit's segmented control, whose
selected item fills with INK: the loudest mark on the page, sitting under a
strip whose open tab is a pale lozenge. The hierarchy read upside down.

**Built, restyled** (`rd/components/SubTabs.tsx`, `.rd-subtabs` in
redesign.css). Three things make the row a level down rather than small tabs:

- **It is captioned.** `BATCH` in micro-caps at its head. No tab strip names
  what it is choosing between; this is ruling 14's argument moved sideways, and
  it is the load-bearing move.
- **It is quieter, not smaller.** Selection is the inset wash — no border, no
  relief. The tab above is a raised object; this is a mark on the page.
- **The top strip is fixed at three**, whatever a release does to itself. An
  unsplit release's third tab is still "Overview" and draws no sub-level, so
  the "no batch language until a release splits" ruling is untouched.

`ReleaseDetail` moved from one index into a flat list of seven to two pieces of
state (`top` + `batchId`), which is the model the flat strip was drawing. A
split selects its new batch after the reload by newest `createdAt`, since the
id does not exist at click time.

`prove-screens` gained a two-levels check: three tabs at the top, the sub-level
captioned, shorter, with no edge or relief of its own, and never inverted (its
text darker than its ground). Restoring the ink fill fails it two ways —
demonstrated.

**One demo gap:** the seeded world no longer has a single-batch release (the
Vessel VIII patina split gave it a second), so the "Overview" path is not
clickable in the prototype. It was verified by rendering with that split
removed and is correct. Worth adding a never-split release back if that state
matters in a demo.

**Also noticed, not acted on:** `remainingSequence` drops a milestone whose ref
has already been sent, which is right for a one-off stage and wrong for the
on-track FILLER — one sent on-track email would remove every future on-track
from a regenerated plan. Only reachable through a whole-batch reschedule of a
release with a sent filler; worth a decision.

**Adding a release — built (30 Aug):** Tom, *"Design the flow for
adding a new release to the dashboard. Medium term this will be through a sync
with Shopify, but in the short term it will be a CSV download from Shopify per
release of all the Orders."*

`docs/design/add-a-release.md` is the build spec it was built from and
`docs/explorations/add-a-release.html` is the design artifact's source.
The spine: **drop the export first**, the app lists the products the file
actually contains, and the operator ticks which ones are this release. The
ticked strings become the stored product match — so the string that has to be
exactly right is one nobody typed, and it is the same string the Shopify sync
will match on.

Four faults it fixes, each measured against this tree rather than asserted:

- a mistyped title imports nothing and reports it as "296 other products";
- **a live routing bug** — `classifyFulfilment` is passed the VARIANT, so
  `Falling Light - Framed - Oak` yields variant `Oak` → `unframed`; an
  oak-framed print goes on the unframed timeline with no framing email.
  Passing the whole line-item title returns `framed`, and gives the identical
  answer on all four fixtures, so the fix is behaviour-preserving;
- an empty file draws *"1 row could not be read / Everything else was
  imported"* — the reassurance is false in exactly the case where it does
  damage;
- nothing stops two operators creating the same release twice, which this
  design would make MORE likely, so it ships a claimed-product guard.

Also found and fixed in passing: the comment I had written that morning saying
`'Falling Light'` must not claim `'Falling Light - Study'` — it does. Punctuation
cannot tell a variant from a sibling release, which is the argument for the
operator confirming the match rather than the matcher guessing harder.

**What shipped.** `src/logic/intake.ts` is the new pure module — it reads a
line-item title three deliberately separate ways (`productKeyOf` groups,
`fulfilmentOf` routes, the display split does neither) and `planIntake` says
what a file would do before anything is written. `NewReleaseModal` is two
panes; `AddOrdersModal` is the recurring door on a release page ("Import
orders" is now "Add orders"), pre-ticking by exact string equality against the
stored match. `OrderIntakeDialog` is the file pane both share.
`DataLayer.importOrders` is gone, replaced by `createRelease(input, intake?)`
and `addOrders(releaseId, items, source)`; `Release.shopifyProductIds` is
replaced by `productMatch`. `claimantsOf` backs the duplicate-release guard and
`undoIntake` reverses a mis-dropped file — both refuse once anything has sent.
`prove-screens` gained a *1b · adding a release* block; both of its assertions
were made to fail on purpose before being kept, and the first run of that
proof crashed with a 30-second timeout instead of reporting, which is why the
block now checks the drop box survived a refused file and stops there if not.

**Deliberately left for a later slice**, all of it additive: renaming a
release (and `looksLikeRename` detection); `joinedSinceApproval` on the
approval queue; a warn band when orders arrive for an audience already
approved; refund-status-change bands; `setProductKind` after creation; and a
"Set up without a file" door — the fileless path works at the layer, it just
has no UI.

**Edition allocation — analysed, not built (31 Aug):** Tom sent
`TEMPLATE_Edition_Allocation_Tool.xlsx`, the workbook that decides which collector
gets print 1 of 150, and asked how it could be built into this tool. Full write-up in
`docs/design/edition-allocation.md` and the artifact below. The short of it: the
workbook's output tab IS the allocation CSV `src/logic/allocation.ts` already imports,
so the tool is the consumer and this would make it the producer. It needs one concept
the tool lacks — the **artwork**, between release and order.

**Slices 1 AND 2 are now BUILT (31 Aug)** — the framing join, and artworks. See the doc's Slices
section for exactly what shipped and what it measured. The rest is designed, not built.
The owner also answered the gating question: *"we don't do bundles anymore but used to"*
— so a SKU maps to exactly one artwork and the bundle-expansion problem is gone; only
the mid-flight Murakami release still needs a certificate decision for its 109 bundle
orders, which is a backfill rather than a system requirement.

**The bug it turned up, and why it should not have waited.** This upload is
the FIRST REAL SHOPIFY EXPORT the project has seen, and the fixtures were written from
an assumption it contradicts. Real line items say "Black Abachi Wood Frame — UV
protective acrylic"; the word *framed* never appears, and a frame is a SEPARATE LINE
ITEM, not a variant. `classifyFulfilment` tests `/framed/i` on the title and returns
`framed` for **0 of 1,760 frame line items** across 3,668 real orders, 42% of which are
framed. Running the real Ai Weiwei export through the real add-a-release flow:
`proposeRelease` calls a print release a *sculpture*, proposes the title
"Guardian (Purple)", justifies only an unframed batch, and the one-product guard
refuses the release outright. Same regex again in `MockDataLayer.importAllocations`
(a framed order took the wrong sheet rows), and `recipientCount` counted order rows
while being drawn as "N collectors". ⚠ I first reported that last one as "a four-print
collector gets four copies of every email" — WRONG, and corrected: a send is one job
per BATCH, not per order, so the count was a label that lied, not a send that
duplicated.

All of it is fixed. `isFrameLine` reads the SKU's third segment; `resolveFulfilments`
frames a print when a frame line sits beside it on the same order for the same artwork;
frame lines are ABSORBED rather than becoming orders, because a framed purchase is one
thing to make and ship. `HARBOUR_LIGHT_CSV` is a real-SHAPED anonymised fixture (the
real export carries live names, emails and addresses, which must not enter the repo)
and `src/logic/__tests__/framing.test.ts` has 17 tests, regressed on purpose first.
On the real export: 1,070 orders + 441 frames absorbed = 1,511 lines, both batches
justified, 439 framed / 631 unframed, 2 orphan frames reported, product kind `print`.

**Slice 2, the artwork model, is in too.** `src/logic/artworks.ts` groups a file into
artworks on the SKU's ART CODE and proposes the lead artwork's ARTIST — on the real
Guardian export that is exactly the three AWEI1 colourways, dropping the stray JALBE
and ANTON lines. The release is named by what its artworks share, so the title is now
**"Guardian"** rather than "Guardian (Purple)", and the one-product guard is a
one-ARTIST guard, so a multi-colourway release can finally be created. Driven end to
end in a browser: a real-shaped file creates "Harbour Light", 7 orders, 2 batches.

⚠ Two lessons from that round, both worth keeping: `prove-screens` caught a live bug
on the render BEFORE anything was regressed on purpose ("Dawn"/"Dusk" share the prefix
`Harbour Light (D`, so the title stopped mid-word); and the first version of its guard
assertion tested for wording the fix had already deleted — a check that could never
fail, exactly the fault this project criticises the workbook for. Assert invariants,
not sentences.

**Slices 3 AND 4 are BUILT too (1 Sep)** — the allocator and the Editions tab. The
owner: *"Could you build the allocation calculator into the dashboard?"* Full detail in
`docs/design/edition-allocation.md`'s Slices section. The spine: `src/logic/editions.ts`
numbers per ORDER (lowest number free in every artwork the order bought — matched sets
by construction, the workbook's 13-order fault made impossible), anything already
numbered is a PIN that never moves, and `auditAllocation` cannot pass vacuously. The
release page has a fourth tab, Editions: allocate / export the warehouse CSV (the
sheet's exact eight columns, round-trip-proven against our own importer) / clear.
Frame finish and glass are captured at intake from the absorbed frame line and derived
by the workbook's confirmed rules.

⚠ Worth knowing: the audit found REAL corruption in `FALLING_LIGHT_ALLOCATION_CSV` (a
fixture invented before it existed) — two collectors both holding edition 21, and
#AA10418's two prints both numbered 5. The accidental dupes were fixed; **the #AA10418
case is kept deliberately**, so seeded Falling Light's Editions tab demos the refusal
state: fault named on screen, Allocate shut with a Why, no export offered. Harbour
Light (new fifth seeded release, three colourways from `HARBOUR_LIGHT_CSV`) demos the
clean allocate → export path. The owner then asked for 100+ orders per example release
(1 Sep): every seeded release now clears it — Blue Interval 112, Falling Light 293,
Harbour Light 137, Night Garden 125, Vessel VIII 104 — grown by generated collectors
in the fixtures' own style, every one of them in `HUBSPOT_DIRECTORY`, hand-written
edge-case rows untouched. Harbour's #RS2134 is the seeded full-set buyer (all three
colourways) and holds edition 1 of each; its demand also now exceeds the seeded
edition size of 40, so the Editions tab shows the over-edition note doing its job. The releases-index seed test now expects five titles.

**Owner's naming round (1 Sep):** the tab is **Edition allocation** and sits SECOND,
right after All orders — his words: "Call the tab Edition allocation, and put it after
All orders." The prove-screens strip assertion pins that order. Same round fixed a
dialogue he called confusing: Change delivery date on a batch with NO promise date
used to render the whole form and only refuse at Save; it now says at the door that
nothing is promised yet and points to Set promise date on the batch.

**The rule gained a middle key (1 Sep, later):** Tom: "don't framed orders get
lower edition numbers? Check the spreadsheet." He was right — the sheet's own
allocation order carries a key its written comment never states: within every
set size, ALL framed orders are numbered before ALL print-only (770 orders, no
exception; the two mixed orders sit with the framed, so framed is an
order-level ANY). `DEFAULT_RULE` is now set size desc → framed first → oldest
first, with tests for each edge. A full workbook audit followed ("review the
spreadsheet for any more hidden stuff like that") — findings: dormant AP
machinery (SKU `AP`/`APGIFT`/`APARTIST` segments or an `APSALE` tag →
`Is_AP`, zero rows in this census), a manual `Exclude?` gate filtered before
allocation, the historical bundle expansion (`Codes`/`SKU Map` Set Size +
Print 1..10 — Tom: bundles are dead), frame colour by keyword search
(Black/White/Natural anywhere in the title), 26 partially-refunded orders all
keeping their numbers, and the `Order Matrix` summing only its first five
product columns (its zero-flag orders were hand-slotted at the sheet's head).
None of the dormant machinery was built — reported to Tom instead.

**Per-release approver (1 Sep):** Tom: "for each release we should be able to
set the approver. For the time being, it's Elani for every one."
`Release.approverId` (always set; default `user-approver`, the fixture user
"Elani" — first name only, a surname is not ours to invent), settable via
`setApprover` (admins only) from the **Approver · Elani** button in the
release header. My approvals gains an Approver column ("You" when it's you).
Naming is not gating: any admin still approves.

**Guided tour — now FOUR PATHS (1 Sep, same round):** Tom: "split the Take a
Tour into a few paths." The tour opens on a chooser (`TOUR_PATHS` in
`tourSteps.ts`): 1 release-from-file-to-numbered-editions, 2 emails + each
batch's plan (drives a real image pick), 3 a delay — whole batch AND partial
split — through the CRM writer to Send for approval, 4 approval day (switches
user to Elani via the who-chip, approves for real). Finishing a path returns
to the chooser. prove-screens §6 asserts the chooser offers exactly 4 paths
and path 1's file-drop reaches the read-file pane (failed once via a
3-path slice, then a broken drop selector, before being kept).

**Approvals: one button per row (1 Sep):** Tom, over a screenshot of the row
actions: "Change this to one button Approve, and other actions you have to do
by selecting the checkbox." Rows on My approvals now carry only Approve; Change
email date and Cancel send(s) live on the bulk bar. Change email date with a
multi-selection opens a "Which email is moving?" chooser (the modal's
guardrails are per-send); Cancel handles any number with a listing confirm.
The preview dialog (row click) keeps every verb for a single send.

**Tour rewritten as plain-English guides (1 Sep):** Tom, on the first
captions: "the tone of voice is awful … Do it in plain english, proper
sentences" and "structure them as a step by step guide." The four paths are
now titled "How to import a release and allocate edition numbers" / "How to
set up the email plan for a release" / "How to log a delay" / "How to approve
emails", each step titled "Step N — do X" with instructions that say what to
click and what happens. Keep this register for any future tour edits.

**Guided tour — built (1 Sep):** Tom: "Make an animated guide running end to end
on how this works", answered as: for new team members, inside the prototype, the
full lifecycle, ~2 minutes brisk. It is **"Take the tour"** in the rail —
`src/components/Tour.tsx` (spotlight overlay: one hole whose box-shadow is the
scrim, caption card bottom-centre, autoplay clock with Pause/Back/Next/End) and
`src/components/tourSteps.ts` (the 13-step script). Nothing is a recording: each
step performs real clicks — the tour drops a real CSV into New release (Harbour
Lantern, `RSTOL-LANT*`, deliberately not Harbour Light so the claim guard stays
quiet), ticks a Falling Light row and fills the reschedule form, presses
Allocate on Harbour Light. So the guide breaks in front of the maintainer if a
button moves — and prove-screens §6 makes that official: rail opens the tour, a
real-sized spotlight appears, the file-drop step actually reaches the read-file
pane, End tour clears the overlay (made to fail once by breaking the drop
selector; it named the fault). Driver gotchas already learned, in the code as
comments: `clickText` refuses disabled controls (Read the file enables a beat
after the drop label flips), `waitForText('.rd-title', …)` is how a step knows a
navigation landed (the OLD table still matches structural selectors), and All
orders is spotlit via `.rd-workscroll` because the table's own rect is its
scrollWidth. Everything the tour mutates vanishes on refresh — the last card
says so.

**Full UI review + Mattie's template archive (7 Sep):** Two review artifacts, both
verified finding-by-finding against code and rulings before anything was written:
- **Two Seats, One Tool** (https://claude.ai/code/artifact/591759cf-9d40-4517-9bc0-2ed12198cd8c):
  42 confirmed findings from persona-driven browser walks + code lenses. Themes: the
  front door ignores both personas' setup work (no To-number or Images-owed signal
  outside release pages); the delay handoff has blind spots (a cancelled delay
  notice notifies nobody upstream — HIGH; three of four cancel dialogs omit the
  "collectors never told" warning — HIGH); My approvals hasn't caught up with
  Release.approverId (badge summons operators); navigation dead-ends (overview drops
  the clicked batch; Overdue trail goes cold); dangerous doors (EditSendModal is an
  unguarded date back door — HIGH; the numbering fault's only visible exit is
  destructive — HIGH; bulk-bar reschedule verb 'Set a new promise date' vs 'Change
  delivery date' everywhere else — HIGH). Four raised-and-checked items are recorded
  deliberate (over-edition confirm, writer self-approval, blind image tiles,
  approvals-as-standing). Top-8 shortlist is in the artifact. Two open decisions for
  Tom: is "my approvals" standing or assignment; is image-picking formally CRM's.
- **Less Bespoke** (https://claude.ai/code/artifact/49983b0c-7039-488a-9240-8e9a1241a2d7):
  Mattie's 13 real HubSpot exports (uploads Archive_5.zip; extracted texts in the
  session scratchpad, NEVER into the repo — clean of collector PII, all sent to
  collecting@avantarte.com) are one skeleton; her hand-adaptations map to computed
  facts. Recommendation, 8 moves: {{closing_line}} from plan position (3 real
  closings); {{edition_noun}}/{{next_destination}} per-batch tokens (kills the
  framed/unframed template pairs); split signing into with-artist + signed (approval
  is the truth gate — never claim a signature from the calendar); pp-production for
  sculptures with a release-level craft-sentence override; rotate on-track bodies
  like their image slots; add the Packing row (+{{packing_week}}) to next steps;
  make pp-delay lean (no image requirement, no next-steps card — the real one has
  neither); reseed master copy from her files (window phrasing "by 06 – 13
  November", subjects "{Artist} · Stage", preheader field). None of it is built yet.

**The review shortlist and the template recommendation are BUILT (7 Sep):**
Tom: "Ok build both. Also there would be slack notifications connected to key
moments eg when something is due to approve or delay email needs writing."
- Template model rebuilt on the archive: computed {{closing_line}} (per-send
  plan position), {{edition_noun}}/{{next_destination}}/{{remaining_route}}
  (per batch via `stageFields`), pp-signed + pp-production stages, on-track
  body rotation (`onTrackBody(n)`), Packing row in every next-steps card,
  lean pp-delay (no image owed — `requiredImageSlots` drops it, approval and
  every screen exempt delay sends), masters reseeded from the real files,
  neutral delay draft (raw ops reason stays in the brief).
- Front door: releases index gains To number (red "Broken numbers" pill when
  the held allocation fails audit) and Images owed columns (ReleaseSummary
  gains toNumber/allocationBroken/imagesOwed); Edition allocation tab carries
  its count; CRM badge counts writing jobs + image-owing releases.
- Handoff: cancelling a delay send raises a 'delay_notice_cancelled'
  notification to ops + a warn bar on the batch; DelayCancelWarning in all
  four cancel dialogs; /copy gains a "Handed over" strip (listDelayHandoffs)
  and held drafts show "Draft · Name" (heldBy/heldAt); submit toast names the
  approver; Submitted-by shows the WRITER for delay sends.
- Doors: EditSendModal takes a `ceiling` and blocks dates past it; the bulk
  bar verb is 'Change delivery date' everywhere; the editions fault bar
  offers "Import a corrected warehouse sheet"; Clear-all-numbers dialog states
  its true radius; Add send has its Why; editions tab has real empty/loading/
  failed states; edition-size field says what it gates; approvals rail badge
  is admin-gated.
- Navigation: release pages accept ?tab=&batch= deep links; overview rows
  land on the batch they name, with an amber "Not yet told" pill while a
  delay notice is unsent (BatchListItem.delayNoticePending).
- **Slack notifications**: SlackMessage store + `_slack()` minted at the key
  moments (due to approve on plan submit / delay-copy handback within the
  7-day horizon, mentioning the release's approver; delay email needs writing
  on reschedule; delay notice cancelled), a /slack feed screen ("Slack
  notifications" in the rail) showing what WOULD post; phase 2 wires the same
  objects to a webhook. listSlackFeed on the DataLayer.
Not built from the review (still open): overdue index menu/release band,
send-detail crumb derivation, contact-flag filter column, batch-flip preview.
The token menu in Edit copy is BUILT (9 Sep): a Tokens table in the edit
dialogue — every token the template can take, filtered per template
(delay's two only on pp-delay, craft_line only on pp-production), each
showing the value it resolves to now from the same `fields` the preview
uses; a row click inserts at the body's cursor. prove-screens §2b3 covers
it (failed once on purpose). The two decisions for Tom stand: standing vs
assignment for "My approvals" (badge is now admin-gated only), and whether
image-picking is formally CRM's (the badge fold assumes yes).

**Promises at Import is BUILT (7 Sep):** Tom: "When you import a release, it
should ask you for the initial batching and promise dates … it determines how
many email templates initially need to be populated by an image." Designed in
the artifact below, then built as a THIRD pane on the New release dialogue
(the design's mock predates the lean-delay rule — the built pane owes the
delay email no image, matching `requiredImageSlots`):
- Pane 2's primary is now "Next — batches & dates"; pane 3's is "Create
  release — N orders[, M batches]". The pane-2 milestone switches moved into
  pane 3's plan table as Switch off/on row actions (same vocabulary as the
  release Emails table; a switched-off row keeps its row + Off pill so it can
  come back). Dispatch has no switch — it anchors every plan.
- Shipping choice (SelectField, only when the file justifies a split):
  "Framed and unframed ship separately — Framed N · Unframed M" vs
  "Everything ships together — one batch of T". Ship-together persists as the
  batch's own shape: a default batch with NO fulfilment, which `intakeBatch`
  now routes every print order into (later arrivals too).
- One date field per batch (optional, min tomorrow), note shows order count +
  "collectors read {shipWindowShort}". A dated batch's plan is drafted by the
  SAME `setPromiseDate` call the batch screen uses; blank keeps today's flow
  and draws a warn bar ("X has no promise date yet … numbers above are not
  final") / a note bar when nothing is dated.
- The preview is `previewImportPlan` (`src/logic/importPlan.ts`, pure):
  per-slot rows (the emails tab's own `requiredImageSlots` order) with Sends
  across dated batches + first date + amber Needed pill; facts Emails queued /
  Images to pick / First send. Agreement by construction: the toast reports
  "9 emails drafted" and the release page opens saying "6 emails have no
  image" — the same numbers pane 3 promised. `OPTIONAL_MILESTONES` moved to
  importPlan.ts.
- Layer: `CreateReleaseInput.batching` ({shipTogether?, promiseDates?:
  {framed/unframed/single}}); createRelease makes the ship-together default
  batch up front and applies dates after `takeIn`.
- Tests: `importPlan.test.ts` (5) + "promises at import" describe in
  mockDataLayer.test.ts (3) — 254 total. prove-screens' addingARelease block
  now drives pane 3 (2 date fields, Needed pills, dispatch unswitchable,
  primary open with one date blank — failed once on purpose). Tour guide 1
  gained "Step 3 — Set the delivery dates".

**Design pass (8 Sep), four standing rules from Tom** — "Review the whole
design everywhere": (1) spacing is generous; (2) button labels one word, two
max; (3) remove ALL helper copy; (4) buttons black and white, not blue, and
taller. These are STANDING for all future UI work.
- Kit: `--rd-btn-pri: #181d26` (new token — `--rd-primary` blue keeps focus/
  selection/links only); `.rd-btn-pri` 9px pad (~35px tall), `.rd-btn-grey`/
  `.rd-chip` matched; `--rd-head-control-h` 26→32; a scoped guard keeps
  `.rd-t27` in-row buttons at the compact scale so rows stay 34px; spacing
  opened: dialog head/body/foot 24px sides, `.rd-fields`/`.rd-fieldrow` gap
  14, `--rd-card-gap` 20, `.rd-facts` roomier, `.rd-grouphd` 20px top.
- Labels (the new vocabulary): Send / Save / Detail / Cancel / Keep / Read /
  Next / Create / Add / Approve / Write / Move / Remove / Undo / Reset /
  Clear / Allocate / Export / Import / Set date / Change date / Add send /
  Pick images / Switch off / Switch on / Mark→Cancel; `Submit (N)`. Approvals
  keeps two doors distinct as 'Change date' (email) vs 'Change delivery'
  (promise).
- Helper copy removed: all instructional Field notes (incl. "{{first_name}}
  is personalised…"), teaching Bar bodies (title-only bars are fine per the
  Bar contract), dialog explainer paragraphs trimmed to consequences/facts;
  SlackFeed explainer bar deleted; previewas line trimmed. KEPT: evidence
  (Why the date moved), fact bodies (who/what/when), destructive-consequence
  lines, error remedies, Why on shut controls, tour captions.
- tour clicks/captions + prove-screens updated to the new labels (writer-foot
  check now finds /^send$/i; copy-queue verb /^write$/i). Full gate green,
  all four guides re-driven, artifact republished.

**Busyness sweep (8 Sep, same day):** the owner, pointing at the editions
fault bar: "a button should never be that thin … way too much copy on warning
messages … screens generally way too busy". Standing additions to the four
rules above:
- `.rd-inline-pill` is DELETED from the kit. A band's way out is a real
  `.rd-chip` on its own line inside `.rd-baracts` (new kit class). All five
  sites converted (editions fault bar, release image band, writer image bar,
  clash bar, change-date pivot).
- Fault wording terse: "Falling Light — edition 5 held twice by #AA10418"
  (the "two prints, one number" explainer gone); fault-bar title "The
  numbering is broken". editionAllocation tests + prove-screens updated to
  the new strings; the gap fault keeps the word "gap" (a test reads it).
- Toasts trimmed to the outcome ("Approved", "Saved as a draft", "Image
  set", "Draft added", "Saved — approval reset", "All images picked").
- Decluttered defaults: index Batches column and approvals Approver column
  defaultHidden (Columns brings them back); SendDetail loses the Template
  fact and long dialog title; allocation caption "Allocation: N of M";
  "Nothing yet" for no-last-email.

**Grouped rail + Scheduled emails + Permissions (9 Sep):** Tom: "organise
the side bar into Releases … and Actions … Also create a permissions tab."
- Rail is two groups. **Releases** (a `.rd-navhead` — a destination AND a
  heading, opens the index, never wears `.on`) holds Promise date overview
  and the NEW **Scheduled emails** screen (`/scheduled`, `listScheduledSends`
  — every unsent send across every release, soonest first, read-only rows
  opening the send). **Actions** (opens /approvals) holds My approvals and
  Emails to write. Slack notifications, Permissions and Take the tour sit
  below. Child rows are `.rd-navrow.rd-navsub` (indented); only children
  carry `.on`, which keeps prove-screens' naming check honest.
- **Permissions** (`/permissions`): users table (name/email/team/role/
  access/password-set), black Add user door, Edit per row. Model:
  `AdminArea = releases|approvals|copy|slack|permissions`; `User.access` +
  `User.hasPassword` (the password itself is NEVER stored in phase 1 — the
  mock discards it on purpose; phase 2's auth server keeps a hash). Layer:
  `createUser` / `updateUserAccess` (refuses to strip the last Permissions
  holder) / `setUserPassword`, all gated on the caller holding
  `permissions`. The RAIL is gated by access (what you can't open isn't
  shown); roles still gate actions (approve needs admin). Seeds: admins
  hold all five areas, operators everything but Permissions.
- AppContext gains `refreshUsers`; the shell keeps the user list live so
  the who-switcher sees new people. prove-screens §2b2 covers the grouped
  rail anatomy, the calendar's rows and the Add user dialog (failed once
  on purpose). 258 tests.

**Elani's round (10 Sep) — from the prototype meeting transcript, decisions
by Tom (AskUserQuestion): two owners per release; build fulfilment+holds,
tag-driven changes and the filter→batch motion; Shopify integration is the
frame with CSV interim; REVIEW FIRST for tag changes. The Thursday PM+
warehouse Slack digest is PARKED (not selected).**
- **Owners**: `Release.pmOwnerId` + `warehouseOwnerId` replace `approverId`.
  `ownerFor(release, send)` (logic/approvals.ts): pp-dispatch → warehouse,
  everything else incl. delay notices → PM. Defaults Priya (now ADMIN in
  fixtures — an owner must be able to approve) and Elani. `setOwners`
  replaces `setApprover`; release subhead wears both chips → one dialog,
  two pick lists. My approvals Owner column (visible — it varies now);
  rail badge counts sends where ownerFor === you; Slack due_to_approve
  mentions the send's owner.
- **The Shopify seam**: `syncRelease(releaseId, items, label)` is THE entry
  the integration will call; the release's new Sync door (SyncModal) feeds
  it a CSV in the interim and reports Facts (New orders / Refreshed / To
  review). Additions run the standing intake; statuses AND tags refresh on
  matched orders; changes only ever become `ChangeProposal`s.
- **Changes queue (review first)**: detection — framed order with no frame
  line or an SOP tag (/frame\s*(removed|cancelled)/) → frame_removed;
  unframed + new frame line → frame_added; different frame SKU (art-code
  join) → spec_changed. Pending proposals draw a warn band on the release
  ("N changes from the shop to review" → Review dialog, Apply/Dismiss per
  row). Apply moves the order/updates the spec + `order_changed` event
  naming evidence and decider. Dedupe: no second pending proposal per
  order+kind.
- **Fulfilment + holds**: logic/fulfilment.ts — `fulfilmentLabel` (On hold ▸
  Fulfilled ▸ Partial ▸ Unfulfilled; hold outranks), `receivesSend` (holds
  never receive; delay never reaches fulfilled). Wired into every
  recipientCount + prospectiveRecipients. All orders gains a Dispatch
  column (choice/filterable). ⚠ hold = any tag containing "hold" — the
  exact CS tag needs confirming with Elani (her SOP doc is the source).
  ⚠ detection tag vocabulary from the meeting ("frame removed", SKU-in-tags
  for colour changes) — reconcile with the SOP when Tom shares it.
- **Elani's words**: order columns renamed Frame colour / Glazing / Mount
  type (mount now visible); her window-mount motion = filter → select all
  → Change date (existing split flow).
- Seeded demo: Falling Light — 90 unframed orders fulfilled, 2 holds on
  Framed, one pending frame_removed proposal created through the REAL
  syncRelease. 263 tests; prove-screens §2b2b (owners chips, Dispatch
  values, Review dialog, Owner routing — failed once on purpose).

**The big review (11 Sep) — text, spacing, ugliness:** Tom, *"Do a big review
for a) excess text, can any messages be reduced, ideally radically in lenght b)
cramped spacing, spacing should be expansive and generous c) any other UI that
is ugly"*. Six review agents read the screens, the components and the kit CSS;
every finding was adversarially verified against the real files before it was
applied, and the render was the final judge — as usual it caught what the
agents could not see.

- **a) Text.** Every `Bar` in the app is now a title and nothing else. The
  bodies that followed them were consequence, reassurance or instruction, never
  the fact the band exists to carry; where a body held a real fact the fact
  moved into the title (the delay-cancel band names the window collectors were
  moved to). Empty states lost their tutorials. `NO_IMAGE_YET` is "No image
  picked." A Why states what is missing. Toasts confirm the verb and the thing
  that changed, not the mechanism. `(delay)` after "Delay notice" said it twice
  on every row in three tables.
- **b) Spacing.** There was no scale — thirty rules each typed their own 8, 9,
  10, 12 or 14, and the sum of thirty small mean numbers is a cramped screen
  though no single rule looks wrong. Four steps in tokens now
  (`--rd-gap-inner` / `-tight` / `--rd-gap` / `--rd-card-gap`) plus
  `--rd-gap-wide`, `--rd-gap-room` and `--rd-dialog-inset`. Page gutter 22 → 32,
  card inset 16 → 24, card gap 20 → 28. **The page-title top padding is the one
  thing left alone** — Tom asked for that edge specifically on 24 Aug.
- **c) Ugly.** Two KPIs each grew to 600px (they stop at 300 and pack left);
  three control heights on one toolbar line, 36/32/24 (one `--rd-bar-control-h`
  now, and the check that found it); five fact boxes stretched to the tallest
  so one wrapping value left four boxes of white; Approve was grey-on-grey
  inside a grey row; the last blue control; three inline styles doing layout; a
  dialogue title under a table's sticky header; the orders table printing the
  release title in all 112 rows, naming framing "Fulfilment" two columns from a
  Dispatch column reading Fulfilled, and carrying three empty spec columns that
  pushed the customer email off the right edge; subjects truncated to "Rafael
  Okonkwo · An update on y…" with the readable half cut; "Days away" printing
  -6 beside a cell already saying Overdue; card heads reprinting the tab above
  them.
- **prove-screens §2b4** is the new block — one toolbar height, the toolbar
  clearing the card edge, no card head echoing the open tab, and a band-word
  sweep across every screen and every release tab. All three arms were made to
  fail on purpose before being kept; the height arm found the 36/32/24 fault
  for real.
- 263 tests, all three checks, all four tour guides re-driven clean.
- **A completeness pass** afterwards asked what the six dimensions had not
  looked at, and found seven more — including this round's own mistake: the
  spacing scale's comment documented a 6px step two lines above a token
  declaring 8px, and every argument in the review cited "the declared scale".
  Also `.rd-who` (the one element on every page, and its 20px disc sat nearer
  the chip's edge than its own ceiling); the only band title in the app with a
  full stop, which is the whole Permissions screen for a non-admin; a `fail`
  band drawn as a body with no title, which the kit says reads as a note; the
  sort menu speaking three registers in one list; a card titled "Recipients
  (42)" in one state and "Will send to 42 collectors" in the other; and the
  same orders called "cancelled" in a KPI and "removed" two inches below it.

**The hold tag is unresolved** — Tom is not sure what CS uses (23 Sep). The
match is currently any tag containing "hold". Settle it at the first REAL
Shopify export: list every distinct tag in the file and pick, rather than
asking anyone to remember. Same for the change-tag vocabulary.

**Remaining is slice 5:** the Auto/Review/Info changes worklist (tags vs line items),
pinned numbers for edition requests, and freezing a number once a collector has been
told — which waits on Tom's "edition numbers in emails?" answer.

**Artifacts live (publish with `url:` to update, never without):**
- Prototype, Workbench-rd: https://claude.ai/code/artifact/ebfa534f-1267-4a64-99a5-7978167d3a9f
- Numbering the Edition (the allocation workbook, read and costed):
  https://claude.ai/code/artifact/5147d703-854d-4203-84cc-24fd9738a4fe
- Release tab hierarchies (3 options):
  https://claude.ai/code/artifact/ef6ad63b-8c3c-4515-9eda-6f4858e28490
- Adding a release (the flow):
  https://claude.ai/code/artifact/2e82bd2b-f263-4073-ab21-3de4cad8ec34
- Promises at Import (the pane-3 design, now built):
  https://claude.ai/code/artifact/42ea27f3-70ee-45ac-8435-af60b34890ae
- Before/after review: https://claude.ai/code/artifact/f4e228af-af0a-4f6c-9ca7-b111503fb81f
- Dispatch bar studies (five options, drawn in the real system):
  https://claude.ai/code/artifact/dada54e1-0a78-4fbe-ae76-4388d5ee3cfa
- Prototype, Polaris (kept deliberately, as the "before"):
  https://claude.ai/code/artifact/597f2ef2-8557-4fc7-9b6e-3ced09fa9aac
- The Five Screens (round 2, Polaris): https://claude.ai/code/artifact/175468ca-3af9-4b54-bc18-7443ae935ea0

Screenshots come from `scripts/shoot-screens.mjs`; the review page is built by
`build-two-systems.py` in the session scratchpad from `shots-polaris/` and
`shots-final/`.

## Deploying it — Render

**Live at https://post-purchase-comms.onrender.com/** — one web service,
created by hand on 22 Sep 2026 in the Avant Arte project's Production
environment beside BI. Frankfurt, Starter. First build passed. Not a blueprint: there was a `render.yaml`
for a day, but the service was made through New → Web Service, and a blueprint
that is not the thing actually running is worse than none — the next person
reads it and believes it. Its settings, which are the service's:

| Field | Value |
|---|---|
| Repo | `avantartemarketing/email` |
| Branch | `claude/post-purchase-comms-tool-tcm104` until merged, then `main` |
| Runtime | Node — `engines` in package.json pins ≥ 22 |
| Build | `npm ci --include=dev && npm run build` |
| Start | `npm run serve` |
| Health check | `/healthz` |
| Region / plan | Frankfurt / Starter |
| Env | `NODE_VERSION=22.22.2`; `PORT` is Render's, the server reads it |

`--include=dev` is load-bearing: Render builds with `NODE_ENV=production`,
which skips the devDependencies that vite and tsc live in; without it the build
fails with "vite: not found". `npm run build` runs prove-tokens and prove-kit
ahead of tsc, so a design-system regression fails the deploy rather than
shipping. prove-screens is NOT in the build — it drives a real browser.

Rehearsed clean-room before the service existed: bare checkout, the build
command, the start command, then a browser driven against it — `/healthz`,
`/`, `/approvals`, `/permissions` all 200, the app renders, no console errors.

**Environments.** Production holds BI and this. An environment in Render is a
*stage* (Production / Staging), not a *product* — an "Email" environment was
created first and is the wrong axis; the free plan's two slots should be
Production and, one day, Staging. Same-service sharing with BI was asked for
three times and is the wrong call for a different reason: one process, one
`process.env`, and this service will hold the HubSpot token that can email
every collector Avant Arte has. Two services in one environment share nothing
but a folder. The one exception: **env groups** attached to the environment
apply to every service in it, so the token goes on THIS service, never on a
group, or BI inherits it.

**Region: Frankfurt.** BI is Oregon; this one is not, on purpose — EU
collectors' names, emails and addresses will live here, and phase 2's Postgres
goes in the same region. A service's region is fixed at creation, so this was
the one setting worth getting right before anything real landed.

**Plan: Starter** — always on. Free would have slept after fifteen minutes and
made the first visitor wait fifty seconds.

**What is deployed is the prototype on mock data.** `MockDataLayer` is
in-memory and reseeds on refresh; anything a person does vanishes on reload.
Good for letting Elani drive it herself; not a tool anyone can start using.

**The HubSpot token is not set.** Nothing deployed reads it — `server/index.mjs`
serves static files and has no send path. It arrives with phase 3's send
worker, set on the service (Environment → Environment Variables), and **only
`server/` may ever read it**: this is a Vite app, anything the client bundle
touches ships to the browser, and Vite exposes only `VITE_`-prefixed vars to
the client. Never name it `VITE_HUBSPOT_TOKEN`.

**Confirmed 23 Sep 2026: the HubSpot account HAS the Transactional Email
add-on** — the one thing that could have forced a different sending design.
Tom administers HubSpot himself. The pipe test
(`scripts/hubspot-pipe-test.mjs --dry-run`) runs from this cloud environment
once `api.hubapi.com` is on its allowed domains and the private-app token is
stored there as `HUBSPOT_TOKEN` (the name the script reads). Scopes: `content`
+ `transactional-email` (the key Tom made also carries `marketing-email` and
`crm.objects.contacts.read`, which is fine). A token is never pasted into a
chat. The same token is also set on the Render service — correct place, idle
until phase 3.

To run it in a fresh session, both must already be set there, then:

    HUBSPOT_TEST_EMAIL=tom.lloyd@avantarte.com node scripts/hubspot-pipe-test.mjs --dry-run

and report which of the four steps passed. Drop `--dry-run` only once the dry
run is clean; that final step sends one real email to that address.

## Open decisions

Put to Tom on the review page and not yet answered:
1. **Keep the system?** If not, one revert.
2. **The palette is inherited** — the kit was drawn to sit beside a commerce
   admin and took that product's blues. Its own note says that is the first
   thing to revisit if yours is not a sibling of anything. One file.
3. **Dark mode, ever?** The kit is light-only with no token structure waiting
   for one. Cheaper to decide now than after the second screen.

Still open from earlier rounds: dispatch-window width (7 days), drafts vs
straight-to-queue, whether flags block approval.

**Decided 23 Sep 2026 — edition numbers in collector emails: not at present,
maybe in future.** The part of slice 5 that hangs off it (pinning a number for
a collector who asked, freezing it once told) is deferred, not blocked. The
changes worklist does not depend on it and can go ahead.

## Then, in order

1. **Prove the HubSpot pipe** — Transactional Email is confirmed on the
   account (23 Sep); what remains is `api.hubapi.com` on this environment's
   allowed domains and the token stored as `HUBSPOT_TOKEN`, then the dry run.
   The real email confirmed the clone-and-patch mapping.
2. Phase 2 per README: Postgres + magic-link auth + server API behind
   `DataLayer` (`src/data/index.ts` is the swap point; screens unchanged).

## Working agreements observed

- Everything lands on `claude/post-purchase-comms-tool-tcm104`; no PRs.
- No model identifiers in anything pushed to the repo.
- Never a value typed at the point of use. If the token is missing, add it to
  `src/rd/css/tokens.css`, named, with the role it plays.
- **Render the screen and look at it.** Every one of the four faults above was
  invisible to a passing check and obvious in a picture.
- Delete stray probe scripts (`scripts/zz-*.mjs`) before committing.
