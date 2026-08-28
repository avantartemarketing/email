/**
 * Ruling 11's row geometry, asserted on a rendered page.
 *
 * The ruling is explicit that the stylesheet must not be trusted here: a
 * status pill at its natural size is about 21px tall — taller than a 13px line
 * box — so left uncapped it props every cell open and the row lands near 36px
 * while the CSS still says 32. Design found their own first draft rendering
 * 46px rows under a stylesheet labelled 40. So this measures
 * `getBoundingClientRect()`, and it measures the ROW rather than the cell,
 * because the row is what a person sees.
 *
 * Shared because every checkbox table needs the same two numbers, and a check
 * copied into nine shoot scripts is a check that gets updated in seven of them.
 *
 *   import { checkRowHeight } from './lib/row-height.mjs'
 *   faults.push(...(await checkRowHeight(page)))
 *
 * The half-pixel in the header is not a fudge and not a tolerance. Under
 * `border-collapse: collapse` the rule between two cells is SHARED: a body row
 * sits between two of them and gives up a whole pixel, a header with nothing
 * above it gives up half. Both numbers below are what the ruling asks for,
 * measured.
 */

/**
 * Ruling 11 as amended (21 Aug): 34px, header and body alike.
 *
 * Two pixels above Airtable's 32 and well below Shopify's ~40 — Design names
 * that as the point where a 19px category tag and a 10px flag stop touching
 * the row edges. One number for both rows is also what lets ruling 9's bulk
 * bar stand in the header row without the two being matched by arithmetic.
 */
export const ROW = 34
export const HEAD = 34

/**
 * A status pill inside a table cell (ruling 11 as amended, 21 Aug).
 *
 * 17px originally; the owner asked for "a little bigger" and it is 20. The cap
 * is what matters rather than the number — uncapped, a pill is about 21px and
 * props a 34px row open to ~36. 20 leaves 7px of air either side, so the row
 * height is untouched.
 *
 * Named here because six harnesses assert it, and a number changed in five of
 * them is a number that will disagree with itself.
 */
export const PILL = 20

/**
 * @param page a Playwright page with the screen already painted
 * @param opts.label what to call the screen in a fault
 * @param opts.sel the table, when a screen has more than one
 */
export async function checkRowHeight(page, { label = 'the table', sel = 'table.rd-t27' } = {}) {
  const seen = await page.evaluate(
    ({ s }) => {
      const t = document.querySelector(s)
      if (!t) return null
      /* An ORDINARY row: one that holds a record. Bands, section rules and
         add rows have their own heights and are ruled separately, so they are
         named and excluded — an empty `className` is NOT the test, because a
         row can carry one for a reason that has nothing to do with its height
         (the cards table's rows are clickable, so they wear `rd-rowlink`). */
      const structural = /band|sec|group|add|fold|tot|answer/i
      const row = [...t.querySelectorAll('tbody tr')].find(
        (r) => r.querySelector('td') && !structural.test(r.className),
      )
      const head = t.querySelector('thead tr')
      /* A pill in an ORDINARY row. A band's lozenge is deliberately 24px
         (ruling 14: a band is a heading), so reading the table's first pill
         finds the band's and reports the ruling as a fault. */
      const pill = row?.querySelector('.rd-tag') ?? null
      return {
        row: row ? +row.getBoundingClientRect().height.toFixed(2) : null,
        head: head ? +head.getBoundingClientRect().height.toFixed(2) : null,
        /* Reported so a failure says WHY. A row that is too tall almost always
           has an uncapped pill in it, and naming the pill's height turns a
           number nobody can act on into the fix. */
        pill: pill ? +pill.getBoundingClientRect().height.toFixed(2) : null,
      }
    },
    { s: sel },
  )

  if (!seen) return [`${label}: no ${sel} on the page to measure`]
  const faults = []
  if (seen.row !== ROW)
    faults.push(
      `${label}: rows are ${seen.row}px, ruled ${ROW}px` +
        (seen.pill && seen.pill > PILL
          ? ` — the status pill in them is ${seen.pill}px and should be capped at ${PILL}`
          : ''),
    )
  if (seen.head !== HEAD) faults.push(`${label}: the header row is ${seen.head}px, ruled ${HEAD}px`)
  if (seen.pill != null && seen.pill !== PILL)
    faults.push(`${label}: a status pill in a cell is ${seen.pill}px, ruled ${PILL}px`)
  return faults
}

/**
 * Text must never be drawn over other text.
 *
 * Under `table-layout: fixed` a cell whose content is wider than its column
 * does not wrap and does not clip by default — it draws straight across its
 * neighbour. Narrow the window and the owner found one column's heading
 * printed on top of the next, and every name printed on top of a flag.
 * A clipped cell hides the end of a word, which is a cost; an overlapping one
 * makes both words unreadable, which is a fault.
 *
 * Checked at a NARROW viewport on purpose: at the width a harness normally
 * runs, nothing overflows and the check proves nothing.
 */
export async function checkNoOverlap(page, { label = 'the table', width = 900, sel = 'table.rd-t27' } = {}) {
  const was = page.viewportSize()
  await page.setViewportSize({ width, height: was?.height ?? 900 })
  await page.evaluate(() => document.fonts.ready)
  const seen = await page.evaluate((s) => {
    const t = document.querySelector(s)
    if (!t) return null
    const over = [...t.querySelectorAll('td, th')].filter((c) => c.scrollWidth > c.clientWidth + 1)
    const leaking = over.filter((c) => getComputedStyle(c).overflow !== 'hidden')
    const card = t.closest('.rd-scroll')
    const de = document.documentElement
    return {
      leaking: leaking.map((c) => c.textContent.trim().slice(0, 24)).slice(0, 4),
      overflowing: over.length,
      /* Clipping alone is not the answer — a clipped column still hides what
         it holds. Below its floor the CARD has to scroll, so a narrow window
         costs a sideways drag rather than a row of ellipses. */
      cardScrolls: card ? card.scrollWidth > card.clientWidth : null,
      pageStill: de.scrollWidth <= de.clientWidth,
    }
  }, sel)
  await page.setViewportSize(was ?? { width: 1600, height: 900 })
  await page.evaluate(() => document.fonts.ready)

  if (!seen) return [`${label}: no table to squeeze`]
  const faults = []
  if (seen.leaking.length)
    faults.push(`${label}: at ${width}px, ${seen.leaking.length} cell(s) draw over their neighbours — ${seen.leaking.join(' | ')}`)
  if (seen.overflowing > 0 && seen.cardScrolls === false)
    faults.push(`${label}: at ${width}px, ${seen.overflowing} cell(s) are clipped and the card does not scroll — the content is simply gone`)
  if (!seen.pageStill) faults.push(`${label}: at ${width}px the whole page scrolls sideways, not the card`)
  return faults
}

/**
 * Ruling 14's band, asserted on a rendered page.
 *
 * Shared for the same reason the row height is: the band is on seven screens,
 * and a check copied seven times is a check updated in five of them. It also
 * settles a recurring argument with the drawings — `28a`, `33d` and `39b` were
 * drawn BEFORE ruling 14 and each ground its band a slightly different grey
 * (`#f2f5f9`, `#f6f8fa`). The ruling names one value, and the ruling is later,
 * so the ruling is what the app is measured against.
 */
export const BAND = {
  h: 50,
  ground: 'rgb(244, 247, 251)', // #f4f7fb
  /* 0.08em, not 0.09: #403 folded five group headings into `.rd-grouphd` and
     brought `.rd-bandcap` onto the same tracking, but left this constant
     where it was — so every screen with a band has failed this check since.
     Every caps-micro rule in the stylesheet is 0.08em and none is 0.09. */
  cap: { size: '9px', weight: '600', tracking: 0.08 },
  chev: 10,
  pill: 24,
}

/**
 * @param page a Playwright page with a grouped table painted
 * @param opts.folds true when this table's groups collapse — a chevron is the
 *   mark of a thing that opens, so a band that does not open must not wear one
 */
export async function checkBand(page, { label = 'the table', folds = null, sel = '' } = {}) {
  const seen = await page.evaluate((s) => {
    const tr = document.querySelector(`${s} tr.rd-band`.trim())
    if (!tr) return null
    const td = tr.querySelector('td')
    const cs = getComputedStyle(td)
    const cap = tr.querySelector('.rd-bandcap')
    const capCs = cap ? getComputedStyle(cap) : null
    const pill = tr.querySelector('.rd-bandval .rd-tag, .rd-bandval .rd-ctag')
    const chev = tr.querySelector('svg.rd-bandchev')
    return {
      h: +tr.getBoundingClientRect().height.toFixed(2),
      ground: cs.backgroundColor,
      capText: cap?.textContent.trim() ?? null,
      capSize: capCs?.fontSize ?? null,
      capWeight: capCs?.fontWeight ?? null,
      capCaps: capCs?.textTransform ?? null,
      /* As a fraction of the size, which is how the ruling states it and how
         it survives the caption being resized. */
      capTracking: capCs ? parseFloat(capCs.letterSpacing) / parseFloat(capCs.fontSize) : null,
      pill: pill ? +pill.getBoundingClientRect().height.toFixed(2) : null,
      chev: chev ? +chev.getBoundingClientRect().width.toFixed(2) : null,
      /* A drawn path, never a rotated border and never a glyph — both read
         chunky at every size Design tried. A rotated border would show here as
         a border width; an SVG has none. */
      chevBorder: chev ? parseFloat(getComputedStyle(chev).borderBottomWidth) : null,
      folds: tr.querySelector('[aria-expanded]') != null,
      /* Ruled twice: Airtable prints counts on its bands and we do not. */
      counts: /\(\s*\d+\s*\)|\b\d+\s+(rows?|items?|records?)\b/i.test(tr.textContent),
    }
  }, sel)

  if (!seen) return [`${label}: no band on the page to measure`]
  const faults = []
  if (seen.h !== BAND.h) faults.push(`${label}: the band is ${seen.h}px, ruled ${BAND.h}px`)
  if (seen.ground !== BAND.ground) faults.push(`${label}: the band's ground is ${seen.ground}, ruled ${BAND.ground}`)
  if (!seen.capText) faults.push(`${label}: the band has no caption naming what the grouping is`)
  if (seen.capCaps !== 'uppercase') faults.push(`${label}: the band caption is not in caps`)
  if (seen.capSize !== BAND.cap.size || seen.capWeight !== BAND.cap.weight)
    faults.push(`${label}: the caption is ${seen.capWeight} ${seen.capSize}, ruled ${BAND.cap.weight} ${BAND.cap.size}`)
  if (seen.capTracking != null && Math.abs(seen.capTracking - BAND.cap.tracking) > 0.005)
    faults.push(`${label}: the caption is tracked ${seen.capTracking.toFixed(3)}em, ruled ${BAND.cap.tracking}em`)
  if (seen.pill != null && seen.pill !== BAND.pill)
    faults.push(`${label}: the band's lozenge is ${seen.pill}px, ruled ${BAND.pill}px — a band is a heading`)
  if (seen.counts) faults.push(`${label}: the band prints a count — Airtable does, and ruling 14 says we do not`)
  if (folds === true && !seen.folds) faults.push(`${label}: the band does not fold`)
  if (seen.folds) {
    if (seen.chev !== BAND.chev) faults.push(`${label}: the chevron is ${seen.chev}px, ruled ${BAND.chev}px`)
    if (seen.chevBorder) faults.push(`${label}: the chevron is a rotated border, and the ruling asks for a drawn path`)
  } else if (seen.chev != null) {
    faults.push(`${label}: a band that does not fold wears a chevron, which says it opens`)
  }
  return faults
}

/**
 * A table's parts render as table parts, everywhere.
 *
 * This exists because of one bug that every other check on the page missed.
 * Ruling 13's flag image took the class `.rd-flag` and set
 * `display: inline-block; width: 14px; height: 10px` on it — right for a 14x10
 * picture. A flagged ROW on one screen already wore `.rd-flag`, so it rendered as
 * a 14px inline-block box drawn on top of the row beneath it, with its cells
 * packed into the left margin. It was obvious in a screenshot and invisible to
 * eleven harnesses, because they all read `textContent`: the text was all
 * there, in the right order, in a row nobody could read.
 *
 * So this is a shape check rather than a content one, and it is general — it
 * does not know about flags. Any future class collision that takes a `tr`,
 * `td` or `th` out of the table layout fails here on every screen at once.
 */
export async function checkRowShape(page, { label = 'the table' } = {}) {
  const seen = await page.evaluate(() => {
    const wrong = []
    for (const t of document.querySelectorAll('table.rd-t, table.rd-t27')) {
      const want = { TR: 'table-row', TD: 'table-cell', TH: 'table-cell' }
      for (const el of t.querySelectorAll('tr, td, th')) {
        const d = getComputedStyle(el).display
        // A row hidden on purpose is a fold, not a fault.
        if (d === 'none') continue
        if (d !== want[el.tagName])
          wrong.push({
            tag: el.tagName,
            display: d,
            cls: el.className || '(unclassed)',
            says: (el.textContent ?? '').trim().slice(0, 40),
          })
      }
    }
    /* And nothing overlaps its neighbour vertically: a row drawn on top of the
       next one is what the collision above actually looked like. */
    const rows = [...document.querySelectorAll('table.rd-t tbody tr, table.rd-t27 tbody tr')]
      .map((r) => ({ r, box: r.getBoundingClientRect() }))
      .filter(({ box }) => box.height > 0)
    const stacked = []
    for (let i = 1; i < rows.length; i += 1) {
      const a = rows[i - 1].box
      const b = rows[i].box
      if (b.top < a.bottom - 1)
        stacked.push({
          says: (rows[i].r.textContent ?? '').trim().slice(0, 40),
          over: Math.round(a.bottom - b.top),
        })
    }
    return { wrong: wrong.slice(0, 4), wrongCount: wrong.length, stacked: stacked.slice(0, 3) }
  })

  const faults = []
  for (const w of seen.wrong)
    faults.push(
      `${label}: a <${w.tag.toLowerCase()}> renders as ${w.display} — class "${w.cls}" collides with a rule for something that is not a table part ("${w.says}")`,
    )
  if (seen.wrongCount > seen.wrong.length)
    faults.push(`${label}: and ${seen.wrongCount - seen.wrong.length} more like it`)
  for (const s of seen.stacked)
    faults.push(`${label}: a row is drawn ${s.over}px over the one above it ("${s.says}")`)
  return faults
}

/**
 * A `.rd-tpad` table stops the same distance from both edges of its card.
 *
 * The rule that pushes the identity column in to sit under the section title
 * shipped without its mirror, so every one of these tables had a 16px gutter
 * on the left and the cell's ordinary 10px on the right. Nothing measured it,
 * because every check that looked at a table looked at its rows. The owner
 * saw it on the NZ return: "the padding to the right looks less than it is on
 * the right of the table".
 *
 * Checks the padding rather than the drawn position, because a table narrower
 * than its card has slack on the right that is not padding, and a table wider
 * than its card is scrolled.
 */
export async function checkGutters(page) {
  const faults = []
  const tables = await page.evaluate(() =>
    [...document.querySelectorAll('table.rd-tpad')].map((t, i) => {
      const row = [...t.querySelectorAll('tr')].find((r) => r.children.length > 1)
      if (!row) return null
      const first = row.children[0]
      const last = row.children[row.children.length - 1]
      return {
        i,
        left: parseFloat(getComputedStyle(first).paddingLeft),
        right: parseFloat(getComputedStyle(last).paddingRight),
      }
    }),
  )
  for (const t of tables) {
    if (!t) continue
    if (Math.abs(t.left - t.right) > 0.5) {
      faults.push(`.rd-tpad table ${t.i}: ${t.left}px in from the left, ${t.right}px from the right`)
    }
  }
  return faults
}
