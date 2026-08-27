# Session handover — post-purchase comms tool

Written 27 Aug 2026 (second session), for whichever session picks this up.
Read `README.md` first for product context and architecture; this file is
only *state*: what happened, what's in flight, and what to do next. Delete
it once absorbed.

## Where things stand

- **Round-1 design feedback is applied and pushed** to
  `claude/post-purchase-comms-tool-tcm104`. Tom supplied two real
  artefacts — an actual HubSpot post-purchase email (Yoon Hyup "Printing in
  progress") and the warehouse edition-allocation sheet — plus four asks:
  choose/customise emails per release, batches only where they exist, show
  reviewers the last email collectors received, and track the warehouse
  data per customer. All built:
  - Templates mirror the real email structure (headline, body,
    "What happens next?" card, dispatch *window* — promise date = window
    start, 7 days). Every editable field maps onto a patchable HubSpot
    module field. `src/logic/templates.ts` is the model.
  - Release-level email plan: `Release.disabledTemplates` +
    `Release.templateOverrides`, edited via the "Emails for this release"
    table (as a table per Tom, full-width orders below). Propagation rules:
    unsent sends re-render, hand-edited (`copyEdited`) sends keep their
    words, approved sends reset to pending, delay copy only pre-fills.
  - Batch lineage: `Batch.sourceBatchId`, `inheritedSentStory` /
    `sentStoryForBatch` in `src/logic/reschedule.ts`. Fixes the confirmed
    round-1 bug (second reschedule of a split batch repeating milestones)
    and powers "They last received" on the approval queue and send detail.
  - Warehouse allocation: `src/logic/allocation.ts` parses the sheet as
    exported (junk rows above the header, "AP" editions), attaches per
    order (variant-matched for multi-line-item orders, removed orders
    skipped); edition + spec show in the orders table.
  - All nine round-1 review findings fixed; two adversarial review passes
    ran over this session's diff and their confirmed findings are fixed
    (filler-template leak, copyEdited pinning, stale next-steps rows,
    no-op release saves, per-batch events, removed-order allocations).
- `npm test` → 109 green; `npm run build` clean.
- **Two artifacts are live** (publish with `url:` to update, never without):
  - Review page "The Five Screens" (round 2):
    https://claude.ai/code/artifact/175468ca-3af9-4b54-bc18-7443ae935ea0
  - Clickable prototype (single-file build of the app):
    https://claude.ai/code/artifact/597f2ef2-8557-4fc7-9b6e-3ced09fa9aac
    Rebuild with `npm run build:artifact` (hash routing, everything
    inlined), strip the outer html/head/body tags, republish.
- Screenshots for the review page come from `scripts/shoot-screens.mjs`
  (vite preview on dist/, preinstalled Chromium at
  `/opt/pw-browsers/chromium`, role-based selectors).

## Open decisions (the amber blocks on the review page)

The big one: **framed vs unframed email variants.** Tom's real unframed
printing email has no Framing step; the tool sends one email per batch.
Split releases by fulfilment, render next-steps per collector at send time,
or accept one shared version? This decides schema before phase 2 — don't
start phase 2 without it. Also open: dispatch-window semantics (7-day width,
promise date = window start), edition numbers in emails or not, drafts vs
straight-to-queue, whether flags should block approval.

## Then, in order

1. Collect round-2 answers; apply changes to the prototype.
2. **Prove the HubSpot pipe** — `scripts/hubspot-pipe-test.mjs` (needs a
   private-app token with `content` + `transactional-email` scopes from
   Tom, a test email, and the `pp-delay` master as a Transactional email).
   The real email confirmed the clone-and-patch mapping; the token is the
   blocker.
3. Phase 2 per README: Postgres + magic-link auth + server API behind
   `DataLayer` (`src/data/index.ts` is the swap point; screens unchanged).

## Working agreements observed

- Everything lands on `claude/post-purchase-comms-tool-tcm104`; no PRs.
- No model identifiers in anything pushed to the repo.
- The stop hook demands a clean, pushed tree at end of turn — beware that
  review-workflow agents may drop probe test files (`zz-probe*.test.ts`);
  delete, never commit them.
