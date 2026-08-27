# Session handover — post-purchase comms tool

Written 27 Aug 2026, at the end of the first build session, for whichever
session picks this up. Read `README.md` first for product context and
architecture; this file is only *state*: what happened, what's in flight, and
what to do next. Delete it once absorbed.

## Where things stand

- **Phase 1 is built and pushed** to `claude/post-purchase-comms-tool-tcm104`
  (two commits). All five screens run in Polaris against the seeded in-memory
  mock; plan-generation, reschedule and CSV-import logic is real, pure and
  tested. `npm install && npm run dev`; `npm test` → 67 tests, all green;
  `npm run build` (typecheck + bundle) is clean.
- **The project is gated on a design review.** Tom asked to review the screen
  designs before anything further is built. A review page with annotated
  screenshots of all five screens and per-screen "decisions to confirm" lists
  was published as a Claude artifact:
  **https://claude.ai/code/artifact/175468ca-3af9-4b54-bc18-7443ae935ea0**
  ("The Five Screens"). Tom may share it with the CRM manager and a PM.
  **Do not start phase 2 (Postgres, auth, sending) until that feedback lands.**
  To update the page from a new session, re-render the HTML and publish with
  the Artifact tool passing `url:` that address — publishing without `url`
  would create a second artifact and orphan the link people have.
  The page's screenshots were produced by a Playwright script (pattern: serve
  `dist/` with `vite preview`, drive with the preinstalled Chromium, use
  role-based selectors — Polaris Tabs render hidden text copies that break
  `text=` selectors).
- **Design feedback already applied** (commit 2): Tom compared against the
  real Shopify admin — the app was falling back to Helvetica because Polaris
  expects the Inter variable font but nothing loaded it (now self-hosted in
  `src/assets/`, no Google dependency), and all pages now use Polaris
  `fullWidth` to match the admin's edge-to-edge tables.
- Tom has **installed new UI skills** in the new session's environment — when
  doing further UI/design work, check the available-skills list and prefer
  them over ad-hoc approaches.

## Code-review findings to act on (from a 4-reviewer + adversarial-verify workflow)

The workflow was stopped mid-verification at handover; the salvage is below.
Apply fixes AFTER the design review lands (they're independent of it, but Tom
asked for a hold; batch them with the design changes).

**Confirmed, high — fix first, with a test:**

1. `src/logic/reschedule.ts` — `remainingSequence()` only sees the batch's own
   sends, and a split batch carries none of its source batch's *sent* story.
   The first split is correct (context passes the source batch's sends), but a
   **second reschedule of a split batch regenerates milestones its collectors
   already received** (e.g. Falling Light Batch 2: printing/signing were sent
   while its orders sat in Batch 1; reschedule Batch 2 again and the new plan
   re-includes them). Two independent reviewers found it; two verifiers
   reproduced it against the seeded world. Suggested shape of the fix: record
   lineage on split (`Batch.sourceBatchId` — it's already captured in the
   `batch_created` event's `data.fromBatchId`) and have the data layer build
   the reschedule context from the batch's own sends plus its ancestors'
   *sent* sends; keep `planReschedule` pure.

**Unverified (reviewer claims, ranked; judge each before fixing):**

2. (medium, `src/screens/ReleaseDetail.tsx`) Removing an order while it is
   selected leaves a phantom id in `useIndexResourceState`, so reschedule
   counts can be wrong until the tab remounts.
3. (low, `src/logic/reschedule.ts`) Duplicate ids in `orderIds` make a subset
   look like the whole batch (`length` compared against distinct count).
4. (low, `src/logic/reschedule.ts`) `newPromiseDate` today/past is accepted →
   delay-only plan and cancelled dispatch. UI validates; logic should too.
5. (low, `src/logic/templates.ts`) `renderForRecipient` greets comma-form
   names ("Okafor, Chidi") as "Hi Okafor,," — split on `,` first.
6. (low, `src/screens/ReleaseDetail.tsx`) Reschedule flow reachable for a
   batch with no promise date, bypassing the set-promise-date path.
7. (low, `src/data/mock/MockDataLayer.ts`) `updateSend` logs "(approval
   reset)" even for sends that were never approved.
8. (low, `src/data/mock/MockDataLayer.ts`) `unholdSend` writes no history
   event, so a hold's release is invisible in batch history.
9. (low, `src/screens/SendDetail.tsx`) "Cancel send" there is one-click with
   no confirm modal (ReleaseDetail's timeline has one; reuse it).

## Then, in order

1. Collect design-review answers (the amber blocks on the artifact page);
   apply agreed changes to the prototype; refresh the artifact's screenshots.
2. Apply the fixes above (at minimum #1 with a regression test).
3. **Prove the HubSpot pipe** — `scripts/hubspot-pipe-test.mjs` (needs a
   private-app token with `content` + `transactional-email` scopes, a test
   email, and the `pp-delay` master created as a Transactional email in
   HubSpot). It validates the one unknown that could force a redesign; the
   brief says do it early. Requires credentials from Tom.
4. Phase 2 per README: Postgres + magic-link auth + server API behind the
   existing `DataLayer` interface (`src/data/index.ts` is the swap point; the
   screens must not change).

## Working agreements observed this session

- Everything lands on `claude/post-purchase-comms-tool-tcm104`; no PR was
  requested or created.
- No model identifiers in anything pushed to the repo.
- The stop hook demands a clean, pushed tree at end of turn — beware that
  review-workflow agents may drop probe test files (`zz-probe*.test.ts`) in
  `src/logic/__tests__/`; delete, never commit them.
