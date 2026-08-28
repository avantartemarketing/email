import { chromium } from 'playwright'

const OUT = process.env.OUT ?? '/tmp/claude-0/-home-user-email/5efe4882-2e8c-5e83-851b-a2dbd070ca0e/scratchpad'
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium/chrome-linux/chrome' })
const page = await browser.newPage({ viewport: { width: 1420, height: 900 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })

await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(500)

const inter = await page.evaluate(() => document.fonts.check('16px "Inter Variable"'))
await page.screenshot({ path: `${OUT}/1-index.png` })

// geometry
const geo = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('table.rd-t27 tbody tr')].map((r) => Math.round(r.getBoundingClientRect().height * 10) / 10)
  const head = [...document.querySelectorAll('table.rd-t27 thead tr')].map((r) => Math.round(r.getBoundingClientRect().height * 10) / 10)
  const pills = [...document.querySelectorAll('table.rd-t27 td .rd-tag')].map((p) => Math.round(p.getBoundingClientRect().height * 10) / 10)
  const th = document.querySelectorAll('table.rd-t27 thead tr th').length
  const td = document.querySelectorAll('table.rd-t27 tbody tr').length ? document.querySelectorAll('table.rd-t27 tbody tr')[0].children.length : 0
  const t = document.querySelector('table.rd-t27')
  const card = t?.closest('.rd-card')
  const cb = card?.getBoundingClientRect()
  const first = t?.querySelector('tbody td')?.getBoundingClientRect()
  const last = t?.querySelector('tbody tr')?.lastElementChild?.getBoundingClientRect()
  return { rows, head, pills, th, td, gutters: cb && first && last ? [Math.round(first.left - cb.left), Math.round(cb.right - last.right)] : null,
    bodyOverflow: document.body.scrollWidth > document.body.clientWidth + 1 }
})

// open the next-send menu
const cell = page.locator('table.rd-t27 tbody .rd-cellink').first()
let menu = null
if (await cell.count()) {
  await cell.click()
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${OUT}/2-nextsend.png` })
  menu = await page.evaluate(() => {
    const f = document.querySelector('.rd-float')
    if (!f) return null
    const items = [...f.querySelectorAll('button')]
    const hit = items.map((b) => {
      const r = b.getBoundingClientRect()
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return b.contains(el) || el === b
    })
    return { n: items.length, labels: items.map((b) => b.textContent), allVisible: hit.every(Boolean) }
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
}

// tick two rows -> bulk bar replaces the header, grid must not move
const before = await page.evaluate(() => [...document.querySelectorAll('table.rd-t27 tbody tr')][0].getBoundingClientRect().top)
await page.locator('table.rd-t27 tbody .rd-cbx').first().click()
await page.waitForTimeout(250)
const after = await page.evaluate(() => [...document.querySelectorAll('table.rd-t27 tbody tr')][0].getBoundingClientRect().top)
await page.screenshot({ path: `${OUT}/3-bulk.png` })
const bulk = await page.evaluate(() => {
  const bar = document.querySelector('.rd-bulkbar')
  return bar ? { text: bar.textContent.trim(), h: Math.round(bar.getBoundingClientRect().height * 10) / 10 } : null
})
await page.locator('table.rd-t27 tbody .rd-cbx').first().click()
await page.waitForTimeout(200)

// the dialogue
await page.getByRole('button', { name: 'New release' }).click()
await page.waitForTimeout(350)
await page.screenshot({ path: `${OUT}/4-dialog.png` })
const dlg = await page.evaluate(() => {
  const d = document.querySelector('.rd-dialog')
  if (!d) return null
  return {
    w: Math.round(d.getBoundingClientRect().width),
    fields: [...d.querySelectorAll('.rd-field')].map((f) => Math.round(f.getBoundingClientRect().height * 10) / 10),
    switches: [...d.querySelectorAll('.rd-sw')].map((s) => s.textContent.trim()),
    overflow: d.scrollHeight > d.clientHeight + 1,
  }
})
await page.locator('.rd-field input').first().fill('Falling Light II')
await page.waitForTimeout(200)
await page.screenshot({ path: `${OUT}/5-dialog-typed.png` })

console.log(JSON.stringify({ inter, geo, menu, rowMoved: Math.round((after - before) * 10) / 10, bulk, dlg, errs }, null, 2))
await browser.close()
