# Post-Purchase Comms Tool

The single source of truth for what each Avant Arte collector has been promised
and what they've been told. Releases are made after purchase; ~95% run late,
often partially. This tool moves batching and date decisions to the people who
make them (PMs, warehouse) and keeps every email behind an admin approval gate,
dispatched through HubSpot transactional email.

**Status: phase 1.** All five screens are real, running against an in-memory
mock data layer seeded from a deliberately messy Shopify order export. The
plan-generation and reschedule logic is the production logic (pure, tested);
nothing persists between reloads and nothing sends.

## Run it

```bash
npm install
npm run dev        # → http://localhost:5173
npm test           # logic + seeded-world integration tests (vitest)
npm run check      # the design system's own rules, on the source
npm run build      # check + typecheck + production bundle into dist/
npm run serve      # serve dist/ (the Render web service entrypoint)

npx vite preview --port 4173 &
npm run check:screens   # …and its rules on a real render of every screen
```

The app boots signed in as Tom (admin). The user menu (top right) switches
between admin and operator users to demo the approval gate — phase 2 replaces
this with magic-link sign-in.

### The seeded world

- **Falling Light** — the delayed release. Batch 1 is nearly done (dispatch
  queued), Batch 2 was split and delayed once (delay + framing sent, rest
  pending), Batch 3 was split two days ago and its delay notice is still
  unapproved — the overdue/attention state on the index.
- **Vessel VIII** — sculpture, ~5-month window: on-track cadence with one
  update pushed back by its approver and one dropped.
- **Blue Interval** — completed, full immutable send history (open any sent
  send to see recipients, HubSpot send IDs and two seeded delivery failures on
  Falling Light's signing email).
- **Night Garden** — imported yesterday, no promise date yet.

The seed **replays history through the real API** (real CSV import with dupes
and missing emails, real plan generation, real reschedules and approvals) with
a shifted clock, so every batch's story is consistent with what the logic
actually does. Everything is dated relative to "today".

## Architecture

```
src/logic/       Pure functions, no I/O — the part that must be right.
  plan.ts          Milestone plan generation (≤5-week spacing, short windows
                   drop early milestones, long windows insert on-track fillers)
  reschedule.ts    Split/reschedule change-set builder + default delay email
  importer.ts      Shopify order-export CSV parsing (continuation rows, comma
                   names, missing emails), release filtering, dedupe keys
  templates.ts     Local mirrors of the six HubSpot masters + token patching
  csv.ts, dates.ts

src/data/        The storage seam.
  DataLayer.ts     THE interface the screens are written against
  mock/            Phase-1 in-memory implementation + fixtures + seed
  index.ts         getDataLayer() — swap point for phase 2

src/screens/     The four screens: releases index, release detail (batch
                 tabs, order selection, comms plan, orders, history), approval
                 queue, send detail. The reschedule modal lives in
                 src/components/RescheduleModal.tsx.

src/rd/          The Workbench-rd design system, dropped in as a folder.
  css/tokens.css   Every value the system has. The only file with a literal.
  css/redesign.css The component vocabulary — 65 sections.
  css/app.css      This product's own layer (rail, dialogue furniture, toast,
                   the email artifact), held to the same rules.
  components/      21 components and 6 hooks that compile against React alone.

src/ui/          This app's primitives in that vocabulary — rd.tsx (Page, Card,
                 Dialog, Pill, Tag, Bar, Facts…), format.tsx, useColumns.tsx.

checks/          The system's own harnesses. prove-tokens (no value typed at
                 the point of use), prove-kit (no phantom class, no dangling
                 import), prove-screens (34px rows, no cell over another,
                 one-row heads, Inter loaded — measured on a real render).
docs/            PORTING-BRIEF.md and workbench-rd/ — the rulings, with the
                 arguments attached.

server/          Express service that serves the SPA (grows the API in ph. 2).
scripts/         hubspot-pipe-test.mjs — the pipe prover (below).
```

### The design system

The UI is **Workbench-rd**: hand-written CSS and plain React, no framework
underneath — which is what makes it portable, since there is no Polaris or
Material grammar to bend around. Shopify Polaris was removed when it went in;
the app has no UI dependency now.

Two rules carry most of it, and both are enforced by `npm run check`, which the
build runs first:

- **Never type a value at the point of use.** Every colour and size is a token
  in `src/rd/css/tokens.css`. If the one you need is not there, add it there,
  named, with the role it plays.
- **Colour never carries meaning alone**, and the shape carries a distinction
  the colour does not: a pill (999px) is a *status*, a state that changes over
  time; a tag (6px, soft fill, no border) is a *category*, a fixed taxonomy
  value that does not change because time passed.

`docs/workbench-rd/TOKEN-RULINGS.md` is the spine — every token with the
argument that settled it. `docs/PORTING-BRIEF.md` is the local contract.
Rendering a screen and LOOKING at it is part of the loop, not a formality:
`npm run check:screens` measures the anatomy of all four against the rulings.

Rules encoded in the mock the same way Postgres will enforce them later:

- Every order belongs to exactly one batch; releases start with one default
  batch and new batches only appear via reschedule splits.
- First promise date → draft plan; changing a date after that must go through
  **Change delivery date** so collectors get told.
- A regenerated plan never repeats a milestone the batch already received
  (a split batch inherits its source batch's sent story); dispatch is the one
  legitimate repeat.
- Send statuses: draft → pending approval → approved → sent (+ cancelled).
  Only admins approve; anyone can move an unsent send's date or cancel it —
  there is no hold. Editing an approved send resets it to pending. Sent sends
  are immutable, with recipients, per-recipient HubSpot send IDs and failures
  frozen on the record.
- An email cannot be approved until a hero image is picked for its slot. There
  is no master default — `logic/approvals.ts` splits the queue into what is due
  inside a week and what is merely coming, and `logic/templates.ts` decides
  which slots a release owes a picture for.
- CSV re-uploads are always safe: dedupe on Shopify order name + line item,
  including removed orders (a cancelled order can't resurrect). Orders with no
  HubSpot contact or no email are imported and **flagged**, never dropped.
  Cancellations/refunds are marked by hand in the UI — never inferred from
  the CSV (v1).

## Prove the pipe (do this early)

`scripts/hubspot-pipe-test.mjs` validates the one unknown that could force a
redesign: clone a HubSpot master → patch fields in the draft → push live →
fire a transactional single-send. It needs a private app token with `content`
and `transactional-email` scopes, the transactional email add-on on the
account, and a master email (default `pp-delay`) created as a *Transactional*
email in HubSpot:

```bash
HUBSPOT_TOKEN=pat-... HUBSPOT_TEST_EMAIL=you@avantarte.com \
  node scripts/hubspot-pipe-test.mjs          # add --dry-run to skip the send
```

Each step reports exactly what HubSpot returned, so a missing scope or a
missing add-on is unambiguous. Masters: `pp-printing`, `pp-signing`,
`pp-framing`, `pp-dispatch`, `pp-ontrack`, `pp-delay` — owned by the team in
HubSpot; the app only patches variable fields (`{{artist}}`,
`{{release_title}}`, `{{promise_date}}`, `{{old_promise_date}}`,
`{{reason_line}}`) and leaves `{{first_name}}` for HubSpot contact
personalisation.

## Deployment target (Render)

One web service: build `npm install && npm run build`, start `npm run serve`.
Phase 2 adds Render Postgres and env vars (`DATABASE_URL`,
`HUBSPOT_TOKEN`, `MAGIC_LINK_SECRET`); phase 3 adds a Render cron job hitting
the service's send-runner endpoint for due approved sends.

## Phases

1. **UI first (this)** — five screens on the mock layer; logic real; nothing
   persists or sends. Put it in front of the CRM manager and a PM.
   In parallel: run the pipe prover against the real HubSpot account.
2. **Wire it up** — Postgres + magic-link auth + the importer behind the same
   `DataLayer` interface. The screens don't change.
3. **Send** — cron worker fires approved sends on the day via
   clone→patch→publish→single-send, records send IDs per recipient, retries
   individual failures and surfaces the rest in the send detail screen.
   Pilot one live release alongside the manual Notion process, then cut over.

Out of scope for v1: direct Shopify API sync (the importer interface is the
swap point), Airtable, surveys, Slack notifications, order tagging, writing
back to Shopify.
