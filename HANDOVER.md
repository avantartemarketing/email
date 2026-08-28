# Session handover — post-purchase comms tool

Written 27 Aug 2026 (second session), for whichever session picks this up.
Read `README.md` first for product context and architecture; this file is
only *state*: what happened, what's in flight, and what to do next. Delete
it once absorbed.

## Where things stand

**Round-3 feedback (28 Aug) applied:**
- Releases index: selectable rows; Overdue / Pending approval as separate
  single-badge columns (no wrapped double-height rows anywhere); "Next
  send" is a date-only cell whose popover shows the next three sends
  (email, batch, collector count → send detail). `ReleaseSummary.upcomingSends`.
- "Emails" is a peer TAB on the release page (Framed / Unframed / … /
  Emails; Overview + Emails when batchless) — `ReleaseEmailsPanel`, no
  more buried button.
- **Comms plan layout is awaiting Tom's pick** from five mocked options:
  https://claude.ai/code/artifact/7384926b-b8df-4040-8eb4-9e74d22af0cd
  (plain table / progress strip + upcoming / stepper / upcoming-sent split
  / merged activity table — the last two also slim or absorb batch
  history). Build the chosen one next; recommendation was option 1, with
  4 or 5 if the history busyness is the real complaint.

**Round-2 feedback (same day, after the round-2 artifact) is also applied:**
- Print releases run **framed and unframed as separate batches** ("Framed" /
  "Unframed", created at import by variant) with their own promise dates;
  unframed plans never include the framing email; splits inherit the flow
  and name inside it ("Framed 2"). Sculptures keep a single default batch.
- **Emails are templated; the setup work is images.** The email table moved
  off the release page into the "Release emails" modal: an image pick per
  slot (`Release.templateImages`, slots incl. pp-ontrack-1..3 cycled across
  fillers, `ScheduledSend.imageSlot/imageName`,
  `DataLayer.setReleaseEmailImage` — image picks never reset approvals);
  copy editing is the exception path.
- **No two-line table cells anywhere.** Every field is its own column;
  `src/ui/useColumns.tsx` is the Shopify-style show/hide Columns control
  (localStorage-persisted per table) used by the orders table, approval
  queue and releases index.

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
- `npm test` → 117 green; `npm run build` clean.
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

Framed/unframed is SETTLED (separate batches, built). Still open: where
images come from in phase 2 (HubSpot image library vs pasted URLs; are three
on-track slots enough), dispatch-window semantics (7-day width, promise date
= window start), edition numbers in emails or not, drafts vs
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
