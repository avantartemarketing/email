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
    sub: document.querySelector('.rd-subhead')?.textContent?.trim() ?? null,
  }))
  if (nav.hop !== null) return out
  /* And a top-level screen carries NO subtitle. The owner, 29 Aug 2026:
     "Remove all helper text like 'Every release in production, opened out into
     the batches it ships in — who has been promised what, and how many.'" The
     rule has a natural edge and this is it: a screen reached by a crumb is a
     RECORD, and its subhead is that record's identity — an artist, an edition
     size, the release a send belongs to. A worklist has no identity to state,
     so anything under its title is the page describing itself. */
  if (nav.sub !== null)
    out.push(`${what}: a worklist with a subtitle — "${nav.sub.slice(0, 70)}"`)
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
  /* Two clicks now, and that is the point of the change: the batch tab is a
     level down. Batches → the run. */
  await page.getByRole('tab', { name: /^Batches \(/ }).click()
  await page.waitForTimeout(200)
  /* By class and text rather than by accessible name: the sub-tab's name
     carries its count ("Framed 145"), and pinning a seeded number here would
     make this check fail the next time the fixture grows an order. */
  await page.locator('.rd-subtab', { hasText: 'Framed' }).first().click()
  await page.waitForTimeout(400)
})

/* The two levels are TWO levels. The owner, 29 Aug 2026: "The batches is a tab
   and then the different batches is a sub level within that." Three things
   make that true rather than merely intended, and each is a way the change
   could quietly come undone:
   - the top strip is fixed at three, however many times a release splits;
   - the sub-level is captioned, which is what stops it reading as small tabs;
   - it is drawn QUIETER than the strip above it. The first attempt used the
     segmented control, whose selected item fills with ink under a strip whose
     selected tab is a pale lozenge — the owner: "the styling looks off", and
     it was, the hierarchy read upside down. */
{
  const what = 'release detail · the two levels'
  const levels = await page.evaluate(() => {
    const strip = document.querySelector('.rd-tabs')
    const sub = document.querySelector('.rd-subtabs')
    if (!strip || !sub) return null
    const lum = (colour) => {
      const m = /rgba?\(([^)]+)\)/.exec(colour)
      if (!m) return null
      const [r, g, b, a = '1'] = m[1].split(',').map((n) => Number(n))
      // Composited over white, which is what everything here actually sits on.
      const over = (c) => c * Number(a) + 255 * (1 - Number(a))
      return 0.2126 * over(r) + 0.7152 * over(g) + 0.0722 * over(b)
    }
    const onTop = strip.querySelector('.rd-tab.on')
    const onSub = sub.querySelector('.rd-subtab.on')
    const cs = getComputedStyle(onSub)
    return {
      topTabs: [...strip.querySelectorAll('.rd-tab')].map((t) => t.textContent?.trim() ?? ''),
      caption: sub.querySelector('.rd-subtabs-cap')?.textContent?.trim() ?? null,
      subCount: sub.querySelectorAll('.rd-subtab').length,
      hTop: Math.round(onTop.getBoundingClientRect().height),
      hSub: Math.round(onSub.getBoundingClientRect().height),
      /* A tab is a raised OBJECT — it has an edge and a shadow. A sub-tab is a
         mark on the page and must have neither, or it is a small tab. */
      subEdge: cs.borderTopWidth !== '0px' || cs.boxShadow !== 'none',
      subInk: lum(cs.color),
      subGround: lum(cs.backgroundColor),
    }
  })
  if (!levels) faults.push(`${what}: no sub-level drawn under the tab strip`)
  else {
    if (levels.topTabs.length !== 3)
      faults.push(
        `${what}: the top strip has ${levels.topTabs.length} tabs — ${levels.topTabs.join(', ')}. ` +
          'It is three destinations whatever a release does to itself',
      )
    if (!levels.caption)
      faults.push(`${what}: the sub-level has no caption, which is what makes it not small tabs`)
    if (levels.subCount < 2)
      faults.push(`${what}: ${levels.subCount} sub-tab(s) — the seeded release has five batches`)
    if (levels.hSub >= levels.hTop)
      faults.push(`${what}: the sub-tab is ${levels.hSub}px against the tab's ${levels.hTop}px`)
    if (levels.subEdge)
      faults.push(
        `${what}: the selected sub-tab has an edge or a relief of its own — that makes it a ` +
          'raised object, which is what a tab is. A level down is a mark on the page',
      )
    /* The fault the owner reported, stated as a measurement: the ink-filled
       segmented control put light text on a dark ground under a strip whose
       open tab is a pale lozenge, so the quieter row was the louder mark. */
    if (levels.subInk !== null && levels.subGround !== null && levels.subInk > levels.subGround)
      faults.push(
        `${what}: the selected sub-tab is inverted — ${Math.round(levels.subInk)} ink on ` +
          `${Math.round(levels.subGround)} ground. A level down cannot be the darkest mark ` +
          'on the page',
      )
  }
}


/* ---- 1b · adding a release ------------------------------------------------
   The flow the owner approved on 30 Aug: drop the export, tick which products
   are this release, let the file decide the rest. Three things are worth
   proving on a render rather than in a unit test, and each is a way the flow
   could quietly stop working:
   - a file that is not an order export gets a whole-FILE answer, never a row
     count. An empty file used to draw "1 row could not be read" over the body
     "Everything else was imported.";
   - pane two lists what the file actually contains, with the counts;
   - the primary is shut until the one thing the file cannot supply is given,
     and it says which thing. */
addingARelease: {
  const what = 'new release'
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'New release' }).click()
  await page.getByRole('dialog').waitFor()

  const notAnExport = 'Order Number,Print Name,Fulfilment\n#1,Falling Light,Framed'
  await page.setInputFiles('.rd-importdrop input', {
    name: 'allocation.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(notAnExport),
  })
  await page.getByRole('button', { name: 'Read the file' }).click()
  await page.waitForTimeout(250)
  const fault = await page.evaluate(() => {
    const bar = document.querySelector('.rd-dialog .rd-failbar')
    return {
      text: bar?.textContent?.trim() ?? '',
      rows: document.querySelectorAll('.rd-dialog table tbody tr').length,
    }
  })
  if (!/not a Shopify order export/i.test(fault.text))
    faults.push(`${what}: a non-export drew "${fault.text.slice(0, 70)}" instead of a file fault`)
  if (!/Order Number/.test(fault.text))
    faults.push(`${what}: the fault does not name the columns the file DID have`)
  if (fault.rows > 0)
    faults.push(`${what}: a whole-file fault drew ${fault.rows} table row(s) — it is not a row`)

  /* A refused file must leave the door open. Stated as its own fault, and the
     block stops here when it is broken, because everything below drops a
     second file into a box that is no longer on the screen — and a check that
     reports a 30-second timeout instead of a sentence has told the next
     person nothing. This guard is why: with the fault put back in the row
     channel the first file "succeeded" into pane two and the run crashed. */
  if ((await page.locator('.rd-importdrop input').count()) === 0) {
    faults.push(`${what}: a file that is not an order export moved the dialogue on anyway`)
    break addingARelease
  }

  /* And the real thing — in the shape a real Avant Arte export actually has,
     which the invented fixtures did not: two colourways of one work, framing as
     its own LINE ITEM rather than a variant, and four-segment SKUs whose third
     segment says FR. Three things have to hold on the render:
     the release is named after the WORK and not one colourway; the frame line
     is drawn as a frame rather than wearing a batch's name; and the primary is
     shut only for the artist, never by the old one-product guard, which
     refused every real multi-colourway release outright. */
  const header =
    'Name,Email,Financial Status,Paid at,Fulfillment Status,Currency,Subtotal,Created at,' +
    'Lineitem quantity,Lineitem name,Lineitem price,Lineitem sku,Billing Name,Shipping Name,' +
    'Shipping Country,Tags'
  const row = (n, title, sku) =>
    `#ZZ${n},c${n}@example.com,paid,2026-06-01 10:00:00 +0000,unfulfilled,GBP,500,` +
    `2026-06-01 10:00:00 +0000,1,${title},500,${sku},Collector ${n},Collector ${n},United Kingdom,`
  const csv = [
    header,
    row(1, 'Harbour Light (Dawn) - Public', 'RSTON-HARBD-TL-PUBLIC'),
    row(2, 'Harbour Light (Dawn) - Public', 'RSTON-HARBD-TL-PUBLIC'),
    row(3, 'Harbour Light (Dusk) - Public', 'RSTON-HARBK-TL-PUBLIC'),
    row(3, 'Harbour Light (Dusk) - Black Abachi wood frame', 'RSTON-HARBK-FR-BLACKABACH'),
  ].join('\n')
  await page.setInputFiles('.rd-importdrop input', {
    name: 'harbour-light.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  })
  await page.getByRole('button', { name: 'Read the file' }).click()
  await page.waitForTimeout(350)

  const pane = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.rd-dialog .rd-importlist tbody tr')].map((r) =>
      [...r.children].map((c) => c.textContent?.trim() ?? ''),
    )
    const primary = document.querySelector('.rd-dialogfoot button')
    return {
      rows,
      foot: document.querySelector('.rd-dialog .rd-foot')?.textContent?.trim() ?? '',
      primary: primary?.textContent?.trim() ?? '',
      shut: primary instanceof HTMLButtonElement ? primary.disabled : null,
      why: document.querySelector('.rd-dialogfoot .rd-tip')?.textContent?.trim() ?? '',
      title: document.querySelector('.rd-dialoghd, .rd-dialog h2')?.textContent?.trim() ?? '',
      bar: document.querySelector('.rd-dialog .rd-failbar')?.textContent?.trim() ?? '',
      releaseTitle:
        [...document.querySelectorAll('.rd-dialog input')]
          .map((i) => (i instanceof HTMLInputElement ? i.value : ''))
          .find(Boolean) ?? '',
    }
  })
  if (pane.rows.length !== 3)
    faults.push(`${what}: ${pane.rows.length} product rows for a file with three line items`)
  else {
    const dawn = pane.rows.find((r) => r.join(' ').includes('Dawn'))
    if (!dawn?.includes('2'))
      faults.push(`${what}: the Dawn row does not carry its count — ${dawn?.join(' | ')}`)
    /* A frame is not going into a batch. Drawing "Unframed" against a wood
       frame is the old bug spelled out on screen. */
    const frame = pane.rows.find((r) => r.join(' ').toLowerCase().includes('wood frame'))
    if (!frame?.some((c) => c === 'Frame'))
      faults.push(`${what}: the frame line is not drawn as a frame — ${frame?.join(' | ')}`)
    if (frame?.some((c) => /^Unframed$/.test(c)))
      faults.push(`${what}: the frame line is wearing a batch's name — ${frame.join(' | ')}`)
  }
  if (!/harbour-light\.csv/.test(pane.title))
    faults.push(`${what}: pane two's title does not carry the file name — "${pane.title}"`)
  if (!/3 orders from 3 Shopify orders/.test(pane.foot))
    faults.push(`${what}: the foot does not state both totals — "${pane.foot}"`)
  /* Named after the WORK, not one of its colourways. */
  if (pane.releaseTitle !== 'Harbour Light')
    faults.push(
      `${what}: the release is proposed as "${pane.releaseTitle}" — a release of two ` +
        'colourways is named after the work',
    )
  if (pane.shut !== true)
    faults.push(`${what}: the primary is open with no artist — a Shopify export has no artist column`)
  if (!/artist/i.test(pane.why))
    faults.push(`${what}: the shut primary does not say what is missing — "${pane.why}"`)
  /* And never REFUSED. Two colourways of one work are one release, and the
     dialogue must draw no fail bar over them at all.
     Asserted as "the bar is empty", not as the absence of a particular
     sentence: the first draft of this check looked for the old wording
     ("cannot share a release"), which the fix had already deleted — so it was
     a check that could never fail, which is the exact fault this file exists
     to catch in the workbook. */
  if (pane.bar !== '')
    faults.push(
      `${what}: two colourways of one work are refused — the dialogue draws ` +
        `"${pane.bar.replace(/\s+/g, ' ').slice(0, 90)}"`,
    )
  if (pane.why !== '' && !/artist/i.test(pane.why))
    faults.push(`${what}: the primary is shut for something other than the artist — "${pane.why}"`)
}

await page.keyboard.press('Escape')
await page.waitForTimeout(200)

/* ---- 2b · the promise date overview --------------------------------------- */
await screen('promise date overview', async () => {
  await page.goto(`${BASE}/overview`, { waitUntil: 'networkidle' })
})

/* The page's definition is "grouped by release", so a fresh open must draw
   band rows — a flat first paint means the default view never reached the
   table. ONE browser context serves the whole run and nothing clears
   localStorage, so this block must stay the run's first touch of /overview:
   `ppc.table.promise-overview.view` is unwritten here, which is what makes this read
   what a new visitor gets. Any later check that exercises this table's view
   controls has to run after it. */
{
  const what = 'promise date overview'
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

  /* What the row itself prints, read BY HEADING rather than by index — the
     column list on this screen is a thing people add to, and an index would
     silently start comparing the brief against the wrong cell. `Cap` truncates
     in CSS, so `textContent` is the whole reason either way. */
  const rowSays = await page.evaluate(() => {
    const table = document.querySelector('table.rd-t27')
    const heads = [...(table?.querySelectorAll('thead th') ?? [])].map(
      (th) => th.textContent?.trim() ?? '',
    )
    const cells = [...(table?.querySelector('tbody tr')?.children ?? [])].map(
      (c) => c.textContent?.trim() ?? '',
    )
    const at = (name) => {
      const i = heads.findIndex((h) => h.toLowerCase() === name)
      return i < 0 ? null : (cells[i] ?? null)
    }
    return { reason: at('reason for the delay'), requester: at('requested by') }
  })
  await page.locator('table.rd-t27 tbody tr').first().click()
  await page.getByRole('dialog').waitFor()
  await page.waitForTimeout(400)
  /* The brief is the reason this screen exists — the owner, 29 Aug: "When
     you're writing the email you should be able to see the delay reason the
     person who delayed it wrote." So three things, and the third is the one
     worth a harness: it is in the dialogue, above the fields, and it is THIS
     job's reason rather than a heading that could sit over anybody's. */
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
    if (!rowSays.reason)
      faults.push(`${what}: no "Reason for the delay" column to compare the brief against`)
    else if (!brief.text.includes(rowSays.reason))
      faults.push(
        `${what}: the brief does not carry the row's own reason — the row says ` +
          `"${rowSays.reason.slice(0, 60)}" and the bar says "${brief.text.slice(0, 90)}"`,
      )
    /* And it is signed. "The person who delayed it" is somebody the writer can
       go and ask, and an unsigned brief is a brief with nobody to query. */
    if (!rowSays.requester)
      faults.push(`${what}: no "Requested by" column to check the brief's signature against`)
    else if (!brief.text.includes(rowSays.requester))
      faults.push(
        `${what}: the brief is unsigned — the row credits ${rowSays.requester} and the bar does not`,
      )
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
  await page.getByRole('tab', { name: /^Batches \(/ }).click()
  await page.waitForTimeout(200)
  /* By class and text rather than by accessible name: the sub-tab's name
     carries its count ("Framed 145"), and pinning a seeded number here would
     make this check fail the next time the fixture grows an order. */
  await page.locator('.rd-subtab', { hasText: 'Framed' }).first().click()
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
