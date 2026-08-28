/**
 * The kit is closed: nothing it ships reaches for something it does not.
 *
 * A design system handed over as a folder fails in two quiet ways, and neither
 * one raises an error at the point it is introduced:
 *
 * - **A phantom class.** A component wears `rd-btn`, no stylesheet defines it,
 *   and the button renders as bare browser chrome. TypeScript does not read
 *   CSS, the stylesheet parses fine without the rule, and a click test clicks
 *   an unstyled button quite happily. This exact fault shipped twice in one
 *   week in the app this kit came from. A class whose ONLY styling sits inside
 *   an `@media` block counts as a phantom at desk width, which is where it is
 *   being read — so media blocks are stripped before the scan.
 * - **A dangling import.** A component that was lifted out of the app but
 *   still imports one of the app's own modules will typecheck against nothing
 *   here and explode on the first build in its new home.
 *
 * Run it from the kit root: `node checks/prove-kit.mjs`
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'

const faults = []

/* The kit lives at `src/rd/` in this repo and the app wears it, so both are
   scanned: a phantom class is a phantom wherever it is worn, and the app's
   screens wear far more of this vocabulary than the kit's own components do. */
const CSS_DIR = 'src/rd/css'
const CSS = [`${CSS_DIR}/redesign.css`, `${CSS_DIR}/tokens.css`, `${CSS_DIR}/app.css`]
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')

/** The CSS with every `@media` block removed — what "defined" is measured against. */
const stripMedia = (css) => {
  let out = ''
  for (let i = 0; i < css.length; i++) {
    if (!css.startsWith('@media', i)) {
      out += css[i]
      continue
    }
    let j = css.indexOf('{', i)
    if (j < 0) break
    let depth = 1
    for (j++; j < css.length && depth > 0; j++) {
      if (css[j] === '{') depth++
      else if (css[j] === '}') depth--
    }
    i = j - 1
  }
  return out
}
const BASE_CSS = stripMedia(CSS)

/**
 * "Defined" is a mention in any selector, deliberately — not a rule whose
 * subject is the class.
 *
 * The stricter test was tried and reverted the same hour. Plenty of classes
 * here are styled only in context and are perfectly well styled: `.rd-band`
 * gets everything it has from `.rd-t tr.rd-band > td`, and demanding a
 * standalone rule reported thirteen healthy classes as phantoms. What it
 * caught in exchange was one real fault — `.rd-head` reduced to an ancestor in
 * `.rd-head .rd-chip` after its own flex rule was cut — and a check that
 * cries wolf thirteen times to find it once will be switched off before it
 * ever finds it again.
 *
 * That fault is caught in `prove-example.mjs` instead, as what it actually
 * was: a page head that stopped laying out on one line. A layout question is
 * answered by a layout, not by a stylesheet scan.
 */
const defined = (cls) => new RegExp(`\\.${cls}(?![\\w-])`).test(BASE_CSS)

/**
 * Tokens that LOOK like classes but are deliberately something else. Each
 * carries its reason; a new entry needs one too, or it is a typo with an
 * excuse.
 */
const NOT_CLASSES = new Map([
  ['rd-skel', 'the skeleton wrapper hook; its rows are styled directly'],
])

/** Comments removed, so prose cannot break the string scan below. */
const stripComments = (src) => {
  let out = ''
  let quote = null
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      out += c
      if (c === '\\') {
        out += src[++i] ?? ''
        continue
      }
      if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      out += c
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
      out += '\n'
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      i = end < 0 ? src.length : end + 1
      out += ' '
      continue
    }
    out += c
  }
  return out
}

/** Every rd- token inside any string literal in the file. */
const wornClasses = (src) => {
  const out = new Set()
  for (const m of stripComments(src).matchAll(/['"`]([^'"`]*)['"`]/g))
    for (const token of m[1].split(/\s+/)) if (/^rd-[\w-]+$/.test(token)) out.add(token)
  return out
}

const SOURCES = [
  'src/rd/components',
  'src/rd/lib',
  'src/ui',
  'src/components',
  'src/screens',
  'src',
].flatMap((dir) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && (e.name.endsWith('.tsx') || e.name.endsWith('.ts')))
    .map((e) => path.join(dir, e.name)),
)

/**
 * The example page is scanned too, and it is not an afterthought.
 *
 * It wears structural classes no component does — `.rd-page`, `.rd-head`,
 * `.rd-card` — because in a real app those are worn by the shell and the
 * screens, neither of which the kit ships. Scanning only `components/` left
 * them unguarded, and the hole showed the first time this stylesheet was cut
 * down: `.rd-head` went with the section it happened to sit in, the page's
 * primary button dropped below its title, and every check here passed. Only
 * looking at the render caught it, which is the thing a check exists to stop
 * being the only line of defence.
 */
const EXAMPLES = readdirSync(CSS_DIR)
  .filter((n) => n.endsWith('.html'))
  .map((n) => path.join(CSS_DIR, n))

/** Every rd- token inside a `class="..."` attribute. */
const wornInHtml = (src) => {
  const out = new Set()
  for (const m of src.matchAll(/class=["']([^"']*)["']/g))
    for (const token of m[1].split(/\s+/)) if (/^rd-[\w-]+$/.test(token)) out.add(token)
  return out
}

/* ---- 1 · no phantom classes --------------------------------------------- */
for (const file of SOURCES) {
  const src = readFileSync(file, 'utf8')
  for (const cls of wornClasses(src))
    if (!defined(cls) && !NOT_CLASSES.has(cls)) faults.push(`${file}  wears ${cls}, which no stylesheet here defines`)
}
for (const file of EXAMPLES) {
  for (const cls of wornInHtml(readFileSync(file, 'utf8')))
    if (!defined(cls) && !NOT_CLASSES.has(cls)) faults.push(`${file}  wears ${cls}, which no stylesheet here defines`)
}

/* ---- 2 · every import resolves ------------------------------------------
   Bare specifiers are the host project's dependencies, named in README §4 and
   not this kit's to satisfy. A relative one is ours, and must land on a file
   we ship. */
for (const file of SOURCES) {
  const src = stripComments(readFileSync(file, 'utf8'))
  for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const spec = m[1]
    if (!spec.startsWith('.')) continue
    const base = path.join(path.dirname(file), spec)
    if (!['.ts', '.tsx', ''].some((ext) => existsSync(base + ext)))
      faults.push(`${file}  imports ${spec}, which this kit does not ship`)
  }
}

if (faults.length) {
  console.error(`${faults.length} fault${faults.length === 1 ? '' : 's'}:\n`)
  for (const f of faults) console.error(`  ${f}`)
  process.exit(1)
}
console.log(
  `the kit is closed — ${SOURCES.length} source files and ${EXAMPLES.length} example page(s), every class defined, every import resolved`,
)
