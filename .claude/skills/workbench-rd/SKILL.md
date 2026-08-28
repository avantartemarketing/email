---
name: workbench-rd
description: Build or change any screen using the Workbench-rd design system. Use for new pages, redesigns, table work, form work, chart work, or any change that touches markup or CSS.
---

# UI work in Workbench-rd

The job is transplantation, not interpretation. This system already answered
most of the questions a screen raises, and each answer cost a round of review.
Take the answer.

## Before you touch anything

Read `docs/TOKEN-RULINGS.md`. It is the spine — every token with the role it
plays and the argument that settled it. Then open `example/index.html` in a
browser (`python3 -m http.server` from the kit root, so the font resolves) and
look at the vocabulary rendered. A system read only as source is a system you
will re-express rather than reuse.

## The rules that are not negotiable

- **Never type a value at the point of use.** No hex, no px, no font
  shorthand — in CSS or in a `style=` prop. Every colour and size is a token in
  `tokens.css`; if the one you need is not there, **add it there, named**, and
  say what role it plays. `node checks/prove-tokens.mjs` fails the build
  otherwise, and it is right to.
- **Port, don't re-express.** Copy the values verbatim. A value "close to" the
  system is a bug, not a rounding. If the system lacks a structure — a
  collapsible rail, a sticky header, a max-width — the screen must lack it too
  until somebody rules otherwise.
- **Reuse the component before writing a component.** `components/` holds 21 of
  them. A count that opens to show what it is made of is `ExpandCount`. A
  filter/group/sort row is `ViewControls`. A selection replacing a table's
  header row is `BulkBar`. Writing a second one of these is how two screens
  start disagreeing.
- **Colour never carries meaning alone.** Every status edge pairs with a worded
  tag. A pill is a status, a tag is a category — the shape carries it, so
  reaching for the wrong one says the wrong thing however it is tinted.
- **Rank comes from ink, then size; weight is for the answer.** Nothing is bold
  below body size.

## The loop for one screen

1. **Find the vocabulary.** Grep `css/MAP.md` for the nearest section, and
   `example/index.html` for the markup that wears it. Copy the structure.
2. **Build it.**
3. **Render it and LOOK at it.** Not the tests passing — the picture, at a size
   you can read. Crop to the part you changed and shoot it at 2×; a full-page
   shot of a wide table lands about 500px across, where a one-column shift is
   invisible and every figure is a grey smudge. **An unseen screen is a
   divergent screen**, and it is the single most expensive rule on this page to
   skip.
4. **Check the table's integrity, not only its geometry.** A table can match to
   the pixel and still put figures under the wrong headings. Cell count against
   header count; no two cells in a row overlapping; no body cell overflowing.
5. **Encode what you found as a check.** Add the screen's anatomy to a harness
   so it cannot drift back. Then **make the check fail on purpose once** — a
   check that has never failed has not been shown to work, and a green check
   measuring the wrong element is worse than none.

## Measuring

Assert against a **rendered** page, never against the stylesheet. The system's
own history is the argument: a status pill at its natural size props every row
open, so the rows land near 36px while the CSS still says 32, and the first
draft of this system rendered 46px rows under a stylesheet labelled 40.
`checks/lib/row-height.mjs` carries the two numbers every table needs — 34px
rows, header and body alike, and a status pill capped at 20px inside them —
because a number copied into nine harnesses is a number that will disagree with
itself.

```sh
node checks/prove-tokens.mjs     # no value typed at the point of use
node checks/prove-kit.mjs        # no phantom class, no dangling import
node checks/prove-example.mjs    # 34px rows, no cell drawn over another
```

`prove-kit` is the one that catches the quietest fault in the system: a class a
component wears that no stylesheet defines. It fails nothing on its own —
TypeScript does not read CSS, the stylesheet parses fine without the rule, and
a click test clicks an unstyled button quite happily. Only a person looking
notices, and only if they know what it was meant to look like.

## When the system is wrong

It sometimes is. `README.md` §6 documents one such: a cap that was written to
wrap and clipped instead, undetected for as long as nothing used it. If you
find another, **fix it in `css/` and record the finding where the rule lives**,
in a comment at the rule itself — dated, with what you rendered to find it.
A fix nobody can trace back to a render is a preference.

## Storage

Set `NAMESPACE` in `components/useColWidths.ts` and `lib/view.ts` to this
product's name before shipping anything that remembers a column width or a
view. Two apps on one origin sharing a key prefix read each other's state.
