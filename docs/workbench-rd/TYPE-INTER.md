# Ruling 10 — Type: Inter

From Design. Commit as an addition to `docs/TOKEN-RULINGS.md`.
Supersedes every Neue Haas Grotesk reference in the handoff, the concept file, and the design system.

## The decision
**UI text is Inter. Display text is Inter.** Neue Haas Grotesk is retired from the admin entirely —
it was inherited from the parent design system the admin was drawn against, never chosen for it,
and it is a marketing grotesque being run at product sizes. Inter is what the reference product
runs its own UI in, and it is drawn for small sizes on screens: larger x-height, sturdier stems,
tabular figures that hold a column.

```
--font-text:    Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
--font-display: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

One family, two roles. Keep both variables even though they now resolve to the same stack — the
roles differ in size and weight (display = 21–22px at 400/500; text = 9–15px), and keeping them
separate leaves room to reintroduce a display face later without touching call sites.

## How to load it
Self-host; do not use the Google Fonts CDN in production.

1. Take Inter from `rsms.me/inter` or the `@fontsource-variable/inter` package.
2. Ship the **variable** woff2 (`InterVariable.woff2`) — one file covers 400/500/600 and avoids
   synthetic weights. Add `InterVariable-Italic.woff2` only if italics get used (they currently do not).
3. `font-display: swap`, `unicode-range` left at default (the admin shows CJK place names as
   Latin transliterations only).
4. Preload it: `<link rel="preload" as="font" type="font/woff2" crossorigin>`. The admin is a
   text-dense tool behind a login — a flash of fallback text on every page is worth avoiding.

## Feature settings — required, not optional
Inter's defaults are wrong for this admin in two ways. Set both globally:

```css
:root {
  font-family: var(--font-text);
  font-feature-settings: "cv05" 1, "ss03" 1;  /* single-storey g, curved r — optional, see note */
  font-variant-numeric: tabular-nums;         /* NOT optional: see below */
}
```

- **`tabular-nums` everywhere numbers stack.** Already specified per-column in the design, but set
  it at the root too. Inter's proportional figures are the default and they break column alignment.
- **`font-optical-sizing: auto`** if you ship the variable font — Inter's optical size axis thickens
  strokes at small sizes, which is most of what we were trying to fix.
- The `cv05`/`ss03` stylistic sets are a judgement call, not a ruling. Ship without them first;
  Design will look at the result.

## What changes on screen — check these
Inter is wider than Neue Haas at the same size. Expect and re-check:

1. **Column widths.** Every content-sized column grows 2–4%. The eleven-column Pay screen and the
   widest finance sheet is the one that will start scrolling where it did not before. That is
   acceptable — horizontal scroll is the specified behaviour — but confirm no column *wraps*.
2. **Sidebar drift words.** "380 unplaced" at 11px is the longest; confirm it still fits 224px
   without truncating.
3. **The 9px tracked micro-caps** in line editors. Inter at 9px/600 with 0.08em tracking is legible
   where Haas was marginal — no change needed, but it will look different.
4. **KPI figures at 21px.** Inter's figures are taller; the KPI tile's 3px gap between label and
   value may want to become 2px. Design's call once it is on screen — flag it, do not fix it.
5. **Nothing about the type SCALE changes.** All thirteen sizes stay exactly as ruled. Do not
   "adjust for the new font" — no re-sizing, no line-height tuning, no letter-spacing added.

## Do not
- Do not set `-webkit-font-smoothing: antialiased`. The parent design system does; the admin must
  not. It thins strokes on macOS and is half the reason the old type looked weak. Remove it if the
  inherited stylesheet sets it.
- Do not add a second family "for headings", and do not fall back to Helvetica/Arial in the stack
  before the system faces — the order above is deliberate.
- Do not introduce weight 700. Three weights only: 400 default, 500 the answer, 600 for 9–10px
  tracked micro-caps.
