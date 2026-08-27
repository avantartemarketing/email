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
npm run build      # typecheck + production bundle into dist/
npm run serve      # serve dist/ (the Render web service entrypoint)
```

The app boots signed in as Tom (admin). The user menu (top right) switches
between admin and operator users to demo the approval gate — phase 2 replaces
this with magic-link sign-in.

### The seeded world

- **Falling Light** — the delayed release. Batch 1 is nearly done (dispatch
  queued), Batch 2 was split and delayed once (delay + framing sent, rest
  pending), Batch 3 was split two days ago and its delay notice is still
  unapproved — the overdue/attention state on the index.
- **Vessel VIII** — sculpture, ~5-month window: on-track cadence with one send
  held pending copy.
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

src/screens/     The five Polaris screens: releases index, release detail
                 (batch tabs, order selection, plan timeline, history),
                 approval queue, send detail. The reschedule modal lives in
                 src/components/RescheduleModal.tsx.

server/          Express service that serves the SPA (grows the API in ph. 2).
scripts/         hubspot-pipe-test.mjs — the pipe prover (below).
```

Rules encoded in the mock the same way Postgres will enforce them later:

- Every order belongs to exactly one batch; releases start with one default
  batch and new batches only appear via reschedule splits.
- First promise date → draft plan; changing a date after that must go through
  **Change delivery date** so collectors get told.
- A regenerated plan never repeats a milestone the batch already received
  (a split batch inherits its source batch's sent story); dispatch is the one
  legitimate repeat.
- Send statuses: draft → pending approval → approved → sent (+ held /
  cancelled). Only admins approve/hold. Editing an approved send resets it to
  pending. Sent sends are immutable, with recipients, per-recipient HubSpot
  send IDs and failures frozen on the record.
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
