/**
 * No value is typed at the point of use.
 *
 * DESIGN-SYSTEM §1 states the rule about type — four sizes, two weights, three
 * inks, "and never a value typed at the point of use" — and it is not only
 * about type. Ten hex values had grown into `redesign.css`, each doing a real
 * job and each unnameable from where it sat: a second screen wanting the same
 * tint would have had to copy the number, and a third would have got it
 * slightly wrong. That is how a design system stops being one.
 *
 * So this reads the stylesheet and the components, and fails on:
 *
 * - a raw hex or rgb() in `redesign.css`, where every colour is a token;
 * - a font shorthand or size typed inline in a component, where every size is
 *   a token;
 * - a colour typed inline in a component, same reason.
 *
 * Comments are stripped first: a hex NAMED in prose is documentation — half
 * the reasoning in these files is "the ruling says #b8c4d4 and here is why we
 * draw it as a shadow" — and forbidding that would cost more than it saves.
 *
 * `tokens.css` is the one file exempt. It is where the values live.
 */
import { readFileSync, readdirSync } from 'node:fs'

/* ---- where this repo keeps the kit, and what else is held to it -----------
   The kit ships expecting to BE the root. Here it is a folder inside an app,
   and the app's own screens are the thing most likely to type a value at the
   point of use — so they are scanned too. A check that only reads the kit
   proves the kit is clean and says nothing about the product wearing it. */
const CSS_DIR = 'src/rd/css'
const STYLESHEETS = [`${CSS_DIR}/redesign.css`, `${CSS_DIR}/app.css`]
const TOKENS = `${CSS_DIR}/tokens.css`
/** Every directory of components held to the rule — the kit's, and the app's. */
const TSX_DIRS = ['src/rd/components', 'src/ui', 'src/components', 'src/screens', 'src']

const faults = []

/** The .ts/.tsx files in a directory, without descending into it. */
const sources = (dir) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
    .map((e) => `${dir}/${e.name}`)

/* ---- every token referenced is a token that exists ----------------------- */
/* The rule above says never type a value at the point of use. Obeying it and
   MISSPELLING the token is the same bug with none of the warning: CSS drops
   the declaration silently, the text inherits whatever it inherits, and the
   screen looks plausible. `--rd-ink-secondary` was written into this
   stylesheet, passed every check here, and did not exist — the ink ramp is
   named `body`, `ui`, `tertiary`, `muted`. So the names are checked too. */
{
  /* Blanked, not deleted: replacing a comment with its own newlines keeps
     every following line where it was. The first cut of this check stripped
     them outright and then reported line 2094 for a fault that lives on 2615,
     which sends the reader to an innocent rule. */
  const blank = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ''))
  const tokens = blank(readFileSync(TOKENS, 'utf8'))
  const declared = new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))

  /* A property the app sets at runtime is declared in TypeScript rather than
     in tokens.css — `--rd-reader-h` is measured and written by useReaderFit.
     Those are read WITH a fallback, which is the tell, and the fallback is
     what makes them safe. */
  const fromJs = new Set()
  for (const dir of TSX_DIRS)
    for (const f of sources(dir))
      for (const m of readFileSync(f, 'utf8').matchAll(/setProperty\(\s*['"`](--[\w-]+)/g))
        fromJs.add(m[1])

  for (const file of [...STYLESHEETS, TOKENS]) {
    const text = blank(readFileSync(file, 'utf8'))
    const setHere = new Set([...text.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))
    text.split('\n').forEach((line, i) => {
      // `var(--x, fallback)` cannot render nothing, so it is not this bug.
      for (const m of line.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
        const [, name, next] = m
        if (declared.has(name) || setHere.has(name) || fromJs.has(name)) continue
        if (next === ',') continue
        faults.push(`${file}:${i + 1}  ${name} is not declared in tokens.css`)
      }
    })
  }
}

/* ---- the stylesheet ------------------------------------------------------ */
for (const sheet of STYLESHEETS) {
  const src = readFileSync(sheet, 'utf8')
  const body = src.replace(/\/\*[\s\S]*?\*\//g, '')
  const lines = body.split('\n')
  lines.forEach((line, i) => {
    /* A shadow is checked as a WHOLE VALUE rather than as a colour. Its alpha
       is part of its shape — `0 0 0 .5px rgba(24,29,38,.12)` is one value, and
       naming half of it would make it less readable, not more.

       This line used to `continue` past every shadow, which is exactly how
       three untokenised drop shadows reached five sites while the flat-surface
       rule was still on the books. Elevation is now a named set, so a lifted
       surface must take one of those names; the two shapes below are not
       elevation and are checked for their colour like anything else:

       - a RING (`0 0 0 Npx …`) — focus, a flag's hairline, a selected tile.
         No offset and no blur: it is an edge drawn inside or outside the box.
       - an INSET rule — how a `border-collapse` table carries a line that has
         to travel with its cell (`.rd-t thead th`, `.rd-seam`). */
    const shadow = /(box|text|drop)-shadow/.test(line)
    if (shadow) {
      const ring = /\b0\s+0\s+0\s+[\d.]+px/.test(line)
      const inset = /\binset\b/.test(line)
      const lifted = line.replace(/var\(--rd-shadow-[\w-]+\)/g, '')
      if (!ring && !inset && /\d+px\s+\d+px/.test(lifted)) {
        faults.push(
          `${sheet}:${i + 1}  a lifted surface must take an --rd-shadow-* token  <- ${line.trim().slice(0, 70)}`,
        )
      }
    }
    /* A ring's and an inset rule's colour is a colour like any other and is
       checked; a lifted surface's is part of the token it now has to use. */
    const skipColour = shadow && !/\b0\s+0\s+0\s+[\d.]+px/.test(line) && !/\binset\b/.test(line)
    for (const m of line.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)) {
      if (skipColour) continue
      faults.push(`${sheet}:${i + 1}  ${m[0]}  <- ${line.trim().slice(0, 70)}`)
    }
  })
}

/* ---- the components ------------------------------------------------------ */
for (const path of TSX_DIRS.flatMap(sources)) {
  const src = readFileSync(path, 'utf8')
  src.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/(fontSize|font)\s*:\s*'([^']*)'/g)) {
      const v = m[2]
      if (v === 'inherit' || v.includes('var(--')) continue
      faults.push(`${path}:${i + 1}  ${m[1]}: ${v.slice(0, 50)}`)
    }
    for (const m of line.matchAll(
      /(color|background|backgroundColor|borderColor|fill|stroke)\s*:\s*'(#[0-9a-fA-F]{3,8}|rgba?\([^']*)'/g,
    )) {
      faults.push(`${path}:${i + 1}  ${m[1]}: ${m[2].slice(0, 40)}`)
    }
  })
}

if (faults.length) {
  console.error(`${faults.length} value(s) typed at the point of use:`)
  for (const f of faults) console.error(`  ${f}`)
  console.error(`\nName them in ${TOKENS}, where every other value in this system lives.`)
  process.exit(1)
} else {
  console.log('tokens: every colour and size in the redesign is named, not typed')
}
