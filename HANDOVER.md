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
  ⚠ The Shopify store handle in `ReleaseOrdersTable.tsx` is a **guess**
  (`avant-arte`); confirm it before anyone relies on those links.
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
clean allocate → export path. The releases-index seed test now expects five titles.

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
- Before/after review: https://claude.ai/code/artifact/f4e228af-af0a-4f6c-9ca7-b111503fb81f
- Dispatch bar studies (five options, drawn in the real system):
  https://claude.ai/code/artifact/dada54e1-0a78-4fbe-ae76-4388d5ee3cfa
- Prototype, Polaris (kept deliberately, as the "before"):
  https://claude.ai/code/artifact/597f2ef2-8557-4fc7-9b6e-3ced09fa9aac
- The Five Screens (round 2, Polaris): https://claude.ai/code/artifact/175468ca-3af9-4b54-bc18-7443ae935ea0

Screenshots come from `scripts/shoot-screens.mjs`; the review page is built by
`build-two-systems.py` in the session scratchpad from `shots-polaris/` and
`shots-final/`.

## Open decisions

Put to Tom on the review page and not yet answered:
1. **Keep the system?** If not, one revert.
2. **The palette is inherited** — the kit was drawn to sit beside a commerce
   admin and took that product's blues. Its own note says that is the first
   thing to revisit if yours is not a sibling of anything. One file.
3. **Dark mode, ever?** The kit is light-only with no token structure waiting
   for one. Cheaper to decide now than after the second screen.

Still open from earlier rounds: dispatch-window width (7 days), edition numbers
in emails or not, drafts vs straight-to-queue, whether flags block approval.

## Then, in order

1. **Prove the HubSpot pipe** — `scripts/hubspot-pipe-test.mjs` needs a
   private-app token with `content` + `transactional-email` scopes from Tom.
   The real email confirmed the clone-and-patch mapping; the token is the
   blocker.
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
