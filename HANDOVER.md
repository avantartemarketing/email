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

`npm test` → 123 green. `npm run build` clean.

**Artifacts live (publish with `url:` to update, never without):**
- Prototype, Workbench-rd: https://claude.ai/code/artifact/ebfa534f-1267-4a64-99a5-7978167d3a9f
- Before/after review: https://claude.ai/code/artifact/f4e228af-af0a-4f6c-9ca7-b111503fb81f
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
