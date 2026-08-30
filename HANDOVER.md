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

**Artifacts live (publish with `url:` to update, never without):**
- Prototype, Workbench-rd: https://claude.ai/code/artifact/ebfa534f-1267-4a64-99a5-7978167d3a9f
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
