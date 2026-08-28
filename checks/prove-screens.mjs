/**
 * Every screen in this app renders the system it claims to.
 *
 * The kit ships `prove-example.mjs`, which measures its own one-page example.
 * That page is the kit's claim about itself; this is the claim about the
 * PRODUCT, and it is the check the kit's own instructions ask a host project to
 * write: "when a screen is brought to the system, add its anatomy to a harness
 * so it cannot drift back."
 *
 * What it asserts, on a real render of each screen rather than on the
 * stylesheet — the stylesheet is explicitly not trusted here, because an
 * uncapped status pill props a row to 36px while the CSS still says 34:
 *
 *   - Inter actually loaded. Everything below is a measurement of a font, and
 *     a system fallback makes every one of them a measurement of the wrong one.
 *   - 34px rows, header and body alike (ruling 11), and a status pill capped at
 *     20px inside a cell.
 *   - No cell drawn over another, checked at a NARROW viewport where things
 *     actually overflow — at desk width nothing does and the check proves
 *     nothing.
 *   - Every `tr`/`td`/`th` still renders as a table part: the general form of
 *     the fault where a class collision took a row out of the table layout and
 *     drew it on top of its neighbour, which eleven text-reading harnesses
 *     missed and one screenshot caught.
 *   - A `.rd-tpad` table stops the same distance from both edges of its card.
 *   - The page head is ONE ROW. This one is here because cutting the kit's
 *     stylesheet down once took `.rd-head`'s own flex rule, leaving three rules
 *     that merely mention it — so every class-level check passed while the
 *     page's primary button sat below its title. Only the render knew.
 *
 * Serve the built app first, because the font is fetched over HTTP:
 *
 *   npm run build && npx vite preview --port 4173 &
 *   node checks/prove-screens.mjs
 *
 * PW_CHROMIUM points at a browser if Playwright's own is not installed.
 */
import { chromium } from 'playwright'
import {
  checkRowHeight,
  checkNoOverlap,
  checkRowShape,
  checkGutters,
} from './lib/row-height.mjs'

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173'

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium',
})
const page = await browser.newPage({ viewport: { width: 1520, height: 940 } })

const faults = []
const missed = []
page.on('requestfailed', (r) => missed.push(r.url()))
/* A screen that threw is a screen that rendered nothing, and every measurement
   below would then pass by finding nothing to measure. */
page.on('pageerror', (e) => faults.push(`the page threw: ${String(e).slice(0, 120)}`))

/** Wait for a screen to have actually painted its table before measuring. */
async function settle(what) {
  await page.evaluate(() => document.fonts.ready)
  try {
    await page.locator('table.rd-t27 tbody tr').first().waitFor({ timeout: 5000 })
  } catch {
    faults.push(`${what}: no table rows rendered`)
  }
  await page.waitForTimeout(150)
}

/**
 * The head is one row: the screen's name and what the screen does, on a line.
 * Their CENTRES, not their tops — the button is shorter than the title, and a
 * shared top edge would be the wrong thing to ask for.
 */
async function checkHead(what) {
  const head = await page.evaluate(() => {
    const title = document.querySelector('.rd-head .rd-title')
    const action = document.querySelector('.rd-head button')
    if (!title || !action) return null
    const t = title.getBoundingClientRect()
    const a = action.getBoundingClientRect()
    return { gap: Math.abs(t.top + t.height / 2 - (a.top + a.height / 2)) }
  })
  if (!head) return [] // a screen may legitimately have no action in its head
  return head.gap > 2
    ? [
        `${what}: the page head is not one row — its action sits ${head.gap.toFixed(1)}px off ` +
          "the title's line, which is what a missing `display: flex` on `.rd-head` looks like",
      ]
    : []
}

/**
 * Every table on the screen, not just the first: a release page has three, and
 * a check that measures one of them says nothing about the other two.
 *
 * The kit's helper takes a CSS selector and runs it through `querySelector`,
 * so "the third table" has to be expressible in CSS. The tables are not
 * siblings — they sit in three different cards — so `:nth-of-type` cannot
 * reach them. Numbering them on the page first is what makes each one
 * addressable, and the attribute is taken off again afterwards so nothing a
 * later check reads is left changed.
 */
async function checkEveryTable(what) {
  const out = []
  const count = await page.evaluate(() => {
    const tables = [...document.querySelectorAll('table.rd-t27')]
    tables.forEach((t, i) => t.setAttribute('data-check-i', String(i)))
    return tables.length
  })
  if (count === 0) out.push(`${what}: no table on the screen`)
  for (let i = 0; i < count; i += 1) {
    out.push(
      ...(await checkRowHeight(page, {
        label: `${what} table ${i + 1} of ${count}`,
        sel: `table[data-check-i="${i}"]`,
      })),
    )
  }
  await page.evaluate(() =>
    document.querySelectorAll('[data-check-i]').forEach((t) => t.removeAttribute('data-check-i')),
  )
  return out
}

async function screen(what, go) {
  await go()
  await settle(what)
  faults.push(...(await checkHead(what)))
  faults.push(...(await checkEveryTable(what)))
  faults.push(...(await checkRowShape(page, { label: what })))
  faults.push(...(await checkGutters(page)).map((f) => `${what}: ${f}`))
  faults.push(...(await checkNoOverlap(page, { label: what })))
}

/* ---- 1 · the releases index --------------------------------------------- */
await screen('releases index', async () => {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
})

/* The font, once, on the first screen that painted. Checked after a render
   rather than before: `document.fonts.check` answers about a face the page has
   actually asked for. */
if (!(await page.evaluate(() => document.fonts.check('16px "Inter Variable"'))))
  faults.push(
    'Inter Variable did not load — /fonts/InterVariable.woff2 must resolve, or every ' +
      'measurement here is a measurement of a different font',
  )

/* ---- 2 · a release, with its three stacked tables ------------------------ */
await screen('release detail · all orders', async () => {
  await page.getByText('Falling Light').first().click()
  await page.waitForTimeout(400)
})

/* And the flow tab, which is the screen with three stacked tables on it — the
   one whose geometry has the most ways to go wrong. */
await screen('release detail · a flow', async () => {
  await page.getByRole('tab', { name: /^Framed \(/ }).click()
  await page.waitForTimeout(400)
})

/* ---- 3 · the approval queue --------------------------------------------- */
await screen('approval queue', async () => {
  await page.goto(`${BASE}/approvals`, { waitUntil: 'networkidle' })
})

/* ---- 4 · one send ------------------------------------------------------- */
{
  const what = 'send detail'
  await page.locator('table.rd-t27 tbody tr').first().click()
  await page.waitForTimeout(400)
  await page.evaluate(() => document.fonts.ready)
  faults.push(...(await checkHead(what)))
  faults.push(...(await checkRowShape(page, { label: what })))
  /* The email preview is the one thing on this screen that is not a table: it
     is a rendered artifact, and the check it needs is that it rendered at all
     and inside its paper rather than bleeding out of it. */
  const mail = await page.evaluate(() => {
    const paper = document.querySelector('.rd-mailpaper')
    if (!paper) return null
    const box = paper.getBoundingClientRect()
    const head = paper.querySelector('.rd-mailhead')
    return {
      width: Math.round(box.width),
      hasHeadline: Boolean(head && head.textContent.trim()),
      overflows: paper.scrollWidth > paper.clientWidth + 1,
    }
  })
  if (!mail) faults.push(`${what}: the email preview did not render`)
  else {
    if (!mail.hasHeadline) faults.push(`${what}: the email preview has no headline`)
    if (mail.overflows) faults.push(`${what}: the email preview overflows its own paper`)
    if (mail.width > 600) faults.push(`${what}: the email paper is ${mail.width}px, ruled 600`)
  }
}

/* ---- 5 · a dialogue's actions are reachable ------------------------------
   The kit's `.rd-dialog` carries its own overflow, so a tall panel scrolls as
   a whole — its foot included. This app puts a 600px email preview inside two
   of its dialogues, and the reschedule one is the most consequential action in
   the tool. Rendered on 28 Aug 2026 its Save button sat below the preview,
   off-screen, reachable only by scrolling past it. `.rd-dialogfoot` is sticky
   now; this is what stops that coming back. */
{
  const what = 'reschedule dialogue'
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.getByText('Falling Light').first().click()
  /* The strip opens on "All orders" now, which has no ticks — the reschedule
     lives on a flow tab, so the check has to go there rather than assume it
     is already the screen. */
  await page.getByRole('tab', { name: /^Framed \(/ }).click()
  await page.waitForTimeout(400)
  const ticks = page.locator('table.rd-t27 tbody tr [role="checkbox"]')
  await ticks.nth(0).click()
  await ticks.nth(1).click()
  await page.getByRole('button', { name: /Change delivery date/ }).first().click()
  await page.getByRole('dialog').waitFor()
  const future = new Date(2027, 0, 15).toISOString().slice(0, 10)
  await page.getByLabel('New promised delivery date').fill(future)
  await page.getByLabel('Reason for the change').fill('Checking the foot stays reachable')
  await page.getByRole('button', { name: 'Next: delay email' }).click()
  await page.getByText('What happens when you save').waitFor()
  await page.waitForTimeout(250)

  const foot = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.rd-dialogfoot button')].find((b) =>
      /save/i.test(b.textContent ?? ''),
    )
    if (!btn) return null
    const box = btn.getBoundingClientRect()
    return { top: box.top, bottom: box.bottom, viewport: window.innerHeight }
  })
  if (!foot) faults.push(`${what}: no Save button in the dialogue's foot to measure`)
  else if (foot.bottom > foot.viewport || foot.top < 0)
    faults.push(
      `${what}: the Save button is drawn at ${Math.round(foot.top)}–${Math.round(foot.bottom)}px ` +
        `in a ${foot.viewport}px window — it is off-screen, so the tool's most consequential ` +
        'action can only be reached by scrolling past a 600px email preview',
    )
}

for (const url of missed) faults.push(`the app asked for ${url} and did not get it`)

await browser.close()

if (faults.length) {
  console.error(`${faults.length} fault${faults.length === 1 ? '' : 's'}:\n`)
  for (const f of faults) console.error(`  ${f}`)
  process.exit(1)
}
console.log('screens: 34px rows on every table, no cell over another, one-row heads, Inter loaded')
