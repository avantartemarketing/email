/**
 * The example page renders the system it claims to.
 *
 * A design system handed over as a folder of CSS is a claim nobody has tested.
 * `example/index.html` is the claim made visible; this is the claim measured.
 * It asserts ruling 11's geometry — 34px rows, header and body alike, and a
 * status pill capped at 20px inside them — and ruling 19's "text is never
 * drawn over other text", both against a real render rather than against the
 * stylesheet. The stylesheet is explicitly not trusted here: an uncapped pill
 * props a row to 36px while the CSS still says 32, which is exactly the fault
 * `lib/row-height.mjs` was written for.
 *
 * It also serves the page over HTTP rather than opening the file, because
 * `tokens.css` asks for `/fonts/InterVariable.woff2` — under file:// the type
 * falls back silently and every measurement below is a measurement of the
 * wrong face.
 *
 * Run it from the kit root:  node checks/prove-example.mjs
 *
 * Needs `playwright` and a browser. In a project that already has one, point
 * at it:  PW_CHROMIUM=/path/to/chromium node checks/prove-example.mjs
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { checkRowHeight, checkNoOverlap } from './lib/row-height.mjs'

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' }

const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const file = rel.endsWith('/') ? path.join(rel, 'index.html') : rel
  try {
    const body = await readFile(path.join(process.cwd(), file))
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('no')
  }
})
await new Promise((r) => server.listen(0, r))
const origin = `http://localhost:${server.address().port}`

const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
)
const page = await browser.newPage({ viewport: { width: 1440, height: 760 } })

const missed = []
page.on('requestfailed', (r) => missed.push(r.url()))
await page.goto(`${origin}/example/`, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)

const faults = [...missed.map((u) => `the page asked for ${u} and did not get it`)]

/* The type is the measurement's foundation: fall back to a system face and
   every number below is a number about some other font. */
if (!(await page.evaluate(() => document.fonts.check('16px "Inter Variable"'))))
  faults.push('Inter did not load — serve from the kit root so /fonts/ resolves')

/* A screen head is ONE ROW: the name, and the one thing the screen does, on
   the same line. This is here because cutting the stylesheet down took
   `.rd-head`'s own flex rule — leaving three rules that mention it as an
   ancestor, so every class-level check still passed — and the primary button
   dropped below the title. Nothing but the render knew. */
const head = await page.evaluate(() => {
  const title = document.querySelector('.rd-head .rd-title')
  const action = document.querySelector('.rd-head button')
  if (!title || !action) return null
  const t = title.getBoundingClientRect()
  const a = action.getBoundingClientRect()
  /* Their centres, not their tops: the button is shorter than the title and
     a shared top edge would be the wrong thing to ask for. */
  return { gap: Math.abs(t.top + t.height / 2 - (a.top + a.height / 2)) }
})
if (!head) faults.push('the example has no page head with an action in it to measure')
else if (head.gap > 2)
  faults.push(
    `the page head is not one row — its action sits ${head.gap.toFixed(1)}px off the title's line, ` +
      'which is what a missing `display: flex` on `.rd-head` looks like',
  )

faults.push(...(await checkRowHeight(page, { label: 'the example table' })))
faults.push(...(await checkNoOverlap(page, { label: 'the example table' })))

await browser.close()
server.close()

if (faults.length) {
  console.error(`${faults.length} fault${faults.length === 1 ? '' : 's'}:\n`)
  for (const f of faults) console.error(`  ${f}`)
  process.exit(1)
}
console.log('the example renders the system: 34px rows, a 20px pill, no cell over another')
