# Workbench-rd — a design system you can drop into another project

An admin design system, taken out of a working product and generalised: the
tokens, the component vocabulary, the written rulings behind both, the React
components that wear them, and the checks that keep them from drifting.

It is **not** an npm package and does not want to be. It is hand-written CSS
and plain React with no framework underneath, which is the whole reason it is
portable: there is no Material, Ant or Polaris grammar to bend around, and
nothing to keep in step with a dependency's release notes.

**Open `example/index.html` first.** Everything below is easier to read once
you have seen the thing it describes.

```sh
python3 -m http.server 8000     # from THIS directory
open http://localhost:8000/example/
```

---

## 1 · What is in here

| | |
|---|---|
| `css/tokens.css` | Every value the system has: ink ramp, surfaces, tag tints, radii, the five motion durations, the type scale. **The only file allowed to contain a literal.** |
| `css/redesign.css` | The component vocabulary — 65 sections. |
| `css/MAP.md` | A section index, and two warnings worth reading before you cut it further. |
| `components/` | 21 components and 6 hooks, all of which compile against nothing but React. |
| `lib/` | The two modules those components import. |
| `docs/` | The rulings. This is the part with the reasoning in it. |
| `checks/` | Three checks that run today, plus the shared harness helper they use. |
| `example/` | One page that renders the vocabulary, and a screenshot of it. |
| `fonts/` | Inter Variable (SIL Open Font License, in `LICENSE-Inter.txt`). |
| `.claude/skills/workbench-rd/` | The skill file. Copy it into the receiving project and Claude will work to this system rather than to its own taste. |

## 2 · Installing it

1. **Copy the four folders** into the receiving project — `css/`, `components/`,
   `lib/`, `docs/` — wherever that project keeps such things. Nothing here
   reads a path outside itself except the font.
2. **Put `fonts/InterVariable.woff2` where `/fonts/InterVariable.woff2`
   resolves** (in a Vite project that is `public/fonts/`). `tokens.css` asks
   for it by absolute path. Get this wrong and there is no error — the type
   falls back to a system face and every measurement in the system becomes a
   measurement of a different font.
3. **Import the two stylesheets, tokens first.** `tokens.css` declares what
   `redesign.css` spends.
4. **Set `NAMESPACE`** in `components/useColWidths.ts` and `lib/view.ts` to
   your product's name. It prefixes every `localStorage` key the system
   writes, and two apps sharing an origin must not share keys.
5. **Copy `.claude/skills/workbench-rd/` into the project's `.claude/skills/`.**
6. **Copy `checks/` in and wire `prove-tokens` into the build.** It is the one
   that keeps the system a system; see §5.

Dependencies the host project must already have: **React 18+** and
**react-dom** (one component portals). The checks need **Node 18+**, and two of
them need **Playwright** and a browser. Nothing else — no build plugin, no
PostCSS, no CSS-in-JS.

Two components need assets the kit does not carry. `Flag` wants a folder of
flag images — fetch them once at `w20`, commit them, and serve them from the
path its `IMG_BASE` names; the ruling is explicit that production must not pull
them from a CDN. `AreaIcon`-style navigation furniture is not here at all,
being particular to whatever areas your product has.

## 3 · The five rules that carry the most

The full argument for each is in `docs/`; these are the ones whose absence is
visible within a day.

- **Never type a value at the point of use.** Every colour and every size is a
  token in `tokens.css`. A second screen wanting the same tint copies the
  number, a third gets it slightly wrong, and that is how a design system stops
  being one. `checks/prove-tokens.mjs` fails the build on it.
- **Rank comes from ink, then size. Weight is for the answer.** Weight 600
  appears in two places — a card title and a total. Nothing is bold below body
  size. Bold at 13px is the tell of a design that needed emphasis and had no
  size left to give.
- **Colour never carries meaning alone.** Every status edge pairs with a worded
  tag, so a colour-blind reader loses nothing. And the SHAPE carries a
  distinction the colour does not: a pill (999px) is a **status**, a state that
  changes over time; a tag (6px, soft fill, no border) is a **category**, a
  fixed taxonomy value that does not change because time passed.
- **A caption earns its place by changing what someone does next.** Otherwise
  delete it, however true it is. A sentence explaining how the product works is
  read once and then printed on every visit forever.
- **One curve, five durations, and nothing lost with motion off.** All of it is
  a `transition` reading `--rd-ease` and `--rd-dur-*` straight from the tokens,
  which is what lets reduced-motion switch the whole system off in four
  declarations. See `docs/INTERACTION-AND-MOTION.md` §0 and §7.

## 4 · What it assumes, and where that will bite you

This system was built for one product and it shows. None of these are hidden;
all are cheap to change if you decide differently, and expensive to discover
late.

- **Desktop first.** Built for a team of three to five on desktop, often for
  hours at a stretch. Density is treated as a feature rather than a cost. There
  is a phone layer — dialogues become sheets, the rail overlays — but it is a
  concession, not the target.
- **Light only.** No dark mode, and no token structure waiting for one. Adding
  it means giving `tokens.css` a second palette, which is the right shape of
  job but is a job.
- **No icon set.** Text glyphs — `→ ‹ › ▾ × ✓ ⌕` — plus a dot / edge / tag
  vocabulary, with one exception: the checkbox tick is drawn SVG, because a
  character takes the font's metrics and sat a fraction low in its box. This is
  a real decision you may overturn; overturn it deliberately and price it.
- **34px rows, not 32.** Ruling 11 as amended: two pixels above the table tool
  it was measured against, well below the commerce admin beside it, which is
  where a 19px category tag and a 10px flag stop touching the row edges. The
  stylesheet says 32 in places and is **not to be trusted here** — an uncapped
  status pill props a row to 36px while the CSS still says 32. Measure the
  rendered row, which is what `checks/lib/row-height.mjs` does.
- **It was drawn to sit beside a commerce admin all day**, and its palette was
  moved onto that product's tokens for exactly that reason. If yours is not a
  sibling of anything, that is the first decision to revisit.

## 5 · The checks, and why they are the point

A design system is a set of claims about a rendered page. Claims nobody
measures come apart quietly: the fault does not throw, it renders slightly
wrong, once, somewhere nobody is looking. So each of these encodes a fault that
actually shipped.

```sh
node checks/prove-tokens.mjs     # no colour or size is typed at the point of use
node checks/prove-kit.mjs        # no phantom class, no dangling import
node checks/prove-example.mjs    # 34px rows, a head that is one row, no cell over another
```

`prove-example` needs Playwright. If your project's browser is not where
Playwright expects it: `PW_CHROMIUM=/path/to/chromium node checks/prove-example.mjs`.

Two habits are worth taking along with the files, because they are what the
checks are made of:

- **An unseen screen is a divergent screen.** Never ship one you have not
  rendered and looked at. Not the tests passing — the picture. Cutting this
  stylesheet down proved it twice in an hour: once when a check caught a whole
  component's rules going out with a screen, and once when no check caught
  `.rd-head` losing its flex and only the render knew.
- **Encode each finding as a check.** When a screen is brought to the system,
  add its anatomy to a harness so it cannot drift back. And a check that has
  never failed has not been shown to work: break the thing on purpose once and
  watch it fail before you trust it.

## 6 · What was taken out, and one thing that was fixed

**Every trace of the product it came from.** Its name, its screens, its
customers and suppliers, the systems it reads from, its countries, its storage
keys. Five of the numbered rulings went with them — 16, 16a, 20, 22 and 23 —
because each was a spec for one screen rather than a rule about the system;
they are the only gaps in the numbering, and `docs/TOKEN-RULINGS.md` says so
where they were. Forty-five stylesheet sections went the same way.

**Two products are still named, deliberately.** Airtable and a large commerce
admin appear throughout as *design references* — the source of the four view
controls, the group band's shape, the 32px row density that 34 is measured
against. Naming them identifies where a decision came from, which is the part
worth keeping; nothing about them says anything about whose admin this was.

**Codes like `45a` and `42c`** are references to screens in the concept file
the system was drawn in. That file is not here. They are left in place because
a sentence rewritten around a missing reference usually loses the point it was
making — read them as "the drawing that settled this".

**One bug was fixed on the way out**, marked in place at the `.rd-cap` rule.
The 27-character cell cap was written to wrap — its own comment says "past that
it wraps inside the cap" — but `.rd-t td` sets `white-space: nowrap`, a
`.rd-cap` is one of its descendants, and nowrap beats `overflow-wrap` outright.
So the cap capped and then **clipped**, which is the one thing it was written
not to do. It had gone unseen because nothing wore `.rd-cap`: a rule with no
callers renders correctly everywhere it is never used. It was found by building
`example/index.html`, rendering it at 900px and measuring — which is the
argument for §5 in one paragraph.

## 7 · Reading order

`docs/` is a record of decisions, written as they were made, and it is not
uniform. Start here:

1. **`docs/TOKEN-RULINGS.md`** — the spine. Every token, with the role it plays
   and the argument that settled it.
2. **`docs/TYPE-INTER.md`** — why Inter, and the reading scale.
3. **`docs/TABLES-TAGS-FLAGS.md`** — row density, and the pill-versus-tag
   distinction above.
4. **`docs/INTERACTION-AND-MOTION.md`** — the motion budget. §0 first.
5. **`docs/GROUP-HEADERS.md`**, **`docs/GROUPS-CHARTS-CALENDAR.md`** — grouped
   tables and the one chart shape.

They are written as rulings handed down and argued with, dated, sometimes
overruled in place with the old text struck through. That is deliberate: a rule
with its argument attached survives contact with the first person who finds it
inconvenient, and a rule without one does not.
