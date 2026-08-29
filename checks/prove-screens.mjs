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

/**
 * The three places a top-level screen says its own name — the rail row, the
 * bar, and the title under the hairline — say the SAME name.
 *
 * Renaming Batches to Release overview on 29 Aug 2026 changed the rail row and
 * the page title and missed the bar, which then said "My approvals" over the
 * release overview: three strings computed in three places, and nothing in the
 * app that reads two of them at once. A screen with a crumb is exempt — there
 * the bar names the area and the title names the thing inside it, which is the
 * shell's whole shape.
 */
async function checkNaming(what) {
  const out = []
  const nav = await page.evaluate(() => ({
    here: document.querySelector('.rd-barhere')?.textContent?.trim() ?? '',
    hop: document.querySelector('.rd-barhop')?.textContent?.trim() ?? null,
    title: document.querySelector('.rd-title')?.textContent?.trim() ?? '',
    rail: document.querySelector('.rd-navrow.on')?.firstChild?.textContent?.trim() ?? '',
  }))
  if (nav.hop !== null) return out
  if (nav.here !== nav.title)
    out.push(`${what}: the bar says "${nav.here}" over a page titled "${nav.title}"`)
  if (nav.rail && nav.rail !== nav.title)
    out.push(`${what}: the rail says "${nav.rail}" for a page titled "${nav.title}"`)
  return out
}

async function screen(what, go) {
  await go()
  await settle(what)
  faults.push(...(await checkNaming(what)))
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

/* ---- 2b · the release overview ------------------------------------------- */
await screen('release overview', async () => {
  await page.goto(`${BASE}/overview`, { waitUntil: 'networkidle' })
})

/* The page's definition is "grouped by release", so a fresh open must draw
   band rows — a flat first paint means the default view never reached the
   table. ONE browser context serves the whole run and nothing clears
   localStorage, so this block must stay the run's first touch of /overview:
   `ppc.table.release-overview.view` is unwritten here, which is what makes this read
   what a new visitor gets. Any later check that exercises this table's view
   controls has to run after it. */
{
  const what = 'release overview'
  const bands = await page.evaluate(
    () => document.querySelectorAll('table tr.rd-band').length,
  )
  if (bands === 0) faults.push(`${what}: opened flat — no release bands drawn`)

  /* And the bands FOLD. The kit records shipping a band whose chevron had no
     handler behind it — "it looked collapsible for months and never was, and
     the owner reported it" — so the chevron being drawn is not the check: the
     rows going away when it is pressed is. */
  const fold = await page.evaluate(() => {
    const band = document.querySelector('table tr.rd-band')
    const wrap = band?.querySelector('.rd-bandwrap')
    if (!band || !wrap) return null
    const chevron = wrap.querySelector('.rd-bandchev') !== null
    const before = document.querySelectorAll('table tbody tr').length
    wrap.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return { chevron, before, expanded: wrap.getAttribute('aria-expanded') }
  })
  if (!fold) faults.push(`${what}: no band to fold`)
  else {
    if (!fold.chevron) faults.push(`${what}: the band draws no chevron`)
    await new Promise((r) => setTimeout(r, 250))
    const after = await page.evaluate(
      () => document.querySelectorAll('table tbody tr').length,
    )
    if (after >= fold.before)
      faults.push(
        `${what}: pressing a band changed nothing — ${fold.before} rows before, ${after} after. ` +
          'A chevron with no handler behind it is the fault this check exists for',
      )
    // Put it back, so nothing after this reads a folded table.
    await page.evaluate(() => {
      const wrap = document.querySelector('table tr.rd-band .rd-bandwrap')
      wrap?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await new Promise((r) => setTimeout(r, 250))
  }
}

/* ---- 2c · emails to write ------------------------------------------------
   The CRM handoff (29 Aug 2026). Two things are worth proving on the render
   rather than in a unit test: the row offers the WRITER'S verb and not the
   approver's, and the writer dialogue's action is reachable — the 600px email
   preview that used to push the reschedule dialogue's Save off-screen lives
   in this dialogue now, so the hazard moved here with it. */
await screen('emails to write', async () => {
  await page.goto(`${BASE}/copy`, { waitUntil: 'networkidle' })
})

{
  const what = 'emails to write'
  const verbs = await page.evaluate(() =>
    [...document.querySelectorAll('table.rd-t27 tbody button')].map((b) => b.textContent?.trim() ?? ''),
  )
  if (verbs.length === 0) faults.push(`${what}: no row verbs — the seeded copy queue is empty`)
  if (verbs.some((v) => /^approve/i.test(v)))
    faults.push(`${what}: a row offers "Approve" — this queue is written, not approved`)
  if (!verbs.some((v) => /write the email/i.test(v)))
    faults.push(`${what}: no "Write the email" on any row`)

  await page.locator('table.rd-t27 tbody tr').first().click()
  await page.getByRole('dialog').waitFor()
  await page.waitForTimeout(400)
  /* The brief is the reason this screen exists: the reason must be IN the
     dialogue, above the fields, not merely capped in the row behind it. */
  const brief = await page.evaluate(() => {
    const bar = document.querySelector('.rd-dialog .rd-notebar')
    const fields = document.querySelector('.rd-dialog .rd-fields')
    if (!bar || !fields) return null
    return {
      text: bar.textContent?.trim() ?? '',
      above: bar.getBoundingClientRect().bottom <= fields.getBoundingClientRect().top,
    }
  })
  if (!brief) faults.push(`${what}: the writer has no brief bar above its fields`)
  else {
    if (!/why the date moved/i.test(brief.text))
      faults.push(`${what}: the brief bar does not say why the date moved`)
    if (!brief.above) faults.push(`${what}: the brief is drawn below the fields it briefs`)
  }
  const foot = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.rd-dialogfoot button')].find((b) =>
      /send for approval/i.test(b.textContent ?? ''),
    )
    if (!btn) return null
    const box = btn.getBoundingClientRect()
    return { top: box.top, bottom: box.bottom, viewport: window.innerHeight }
  })
  if (!foot) faults.push(`${what}: no "Send for approval" button in the writer's foot`)
  else if (foot.bottom > foot.viewport || foot.top < 0)
    faults.push(
      `${what}: "Send for approval" is drawn at ${Math.round(foot.top)}–${Math.round(foot.bottom)}px ` +
        `in a ${foot.viewport}px window — the writer's one action is behind a 600px email preview`,
    )
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
}

/* ---- 3 · my approvals ---------------------------------------------------- */
await screen('my approvals', async () => {
  await page.goto(`${BASE}/approvals`, { waitUntil: 'networkidle' })
})

/* The split is the screen's whole job, so it is the thing worth proving on the
   render rather than in a unit test: every row is in exactly one of the two
   tables, the urgent one holds nothing beyond the horizon, and the calm one
   holds nothing inside it. A rule that lives in one function can still be read
   by the wrong table. */
{
  const what = 'my approvals'
  const split = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.rd-card')].filter((c) =>
      c.querySelector('table.rd-t27'),
    )
    const heads = cards.map((c) => c.querySelector('.rd-cardhd, .rd-cardhead')?.textContent ?? '')
    const dates = cards.map((c) =>
      [...c.querySelectorAll('tbody tr')].map((r) => r.querySelector('td:nth-child(2)')?.textContent ?? ''),
    )
    return { heads, dates }
  })
  if (split.heads.length !== 2) {
    faults.push(`${what}: expected two tables, found ${split.heads.length}`)
  } else {
    if (!split.heads[0].includes('To approve now')) {
      faults.push(`${what}: the first table is not "To approve now" (${split.heads[0].trim()})`)
    }
    if (!split.heads[1].includes('Coming up')) {
      faults.push(`${what}: the second table is not "Coming up" (${split.heads[1].trim()})`)
    }
    const overlap = split.dates[0].filter((d) => split.dates[1].includes(d) && d.trim())
    if (overlap.length > 0) {
      faults.push(`${what}: ${overlap.length} send(s) drawn in both tables`)
    }
  }
  // Hold is gone; nothing on this screen may still offer it.
  const holdish = await page.evaluate(() =>
    [...document.querySelectorAll('button, a')]
      .map((el) => el.textContent?.trim() ?? '')
      .filter((t) => /^(hold|release hold)$/i.test(t)),
  )
  if (holdish.length > 0) faults.push(`${what}: a "${holdish[0]}" control survived`)
}

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
   a whole — its foot included. Rendered on 28 Aug 2026 this dialogue's Save
   button sat below a 600px email preview, off-screen, reachable only by
   scrolling past it. `.rd-dialogfoot` is sticky now; this is what stops that
   coming back.

   The preview itself has since moved to the writer on /copy (checked in 2c),
   because the rescheduler no longer writes the delay email — so what is proved
   here is the rest of it: one step, a foot that says who writes, and the
   consequence panel appearing once the form is answerable. */
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
  /* No second step to click through any more: the consequence panel is the
     answer to a filled-in form, on the same panel. */
  await page.getByText('What happens when you save').waitFor()
  await page.waitForTimeout(250)
  const handoff = await page.evaluate(
    () => document.querySelector('.rd-dialog .rd-after')?.textContent ?? '',
  )
  if (!/CRM/.test(handoff))
    faults.push(
      `${what}: the consequence panel never names CRM — the one thing that changed about ` +
        'this flow is who writes the email',
    )

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
