/**
 * Screenshot the app for the design-review artifact.
 *
 * Pattern from the first session: serve dist/ (vite preview), drive the
 * preinstalled Chromium, use role-based selectors. The Polaris-era selectors
 * are gone with Polaris — a row is now `table.rd-t27 tbody tr` and a tick is a
 * `[role="checkbox"]` span rather than an `<input>`, because the kit draws the
 * mark as an SVG that strokes on.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/shoot-screens.mjs <outDir>
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173';
const OUT = resolve(process.argv[2] ?? 'shots');
mkdirSync(OUT, { recursive: true });

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = readFileSync(join(here, '../src/data/mock/fixtures.ts'), 'utf8');
const allocationCsv = /FALLING_LIGHT_ALLOCATION_CSV = `([\s\S]*?)`;/.exec(fixtures)?.[1];
if (!allocationCsv) throw new Error('Could not extract allocation fixture');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({
  viewport: { width: 1520, height: 940 },
  deviceScaleFactor: 1.5,
});

const ROW = 'table.rd-t27 tbody tr';

async function shot(name, { fullPage = true } = {}) {
  // The type is the whole system; a shot taken before it loads is a shot of a
  // different font.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, fullPage, type: 'jpeg', quality: 82 });
  console.log('shot', name);
}

async function goHome() {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Releases' }).first().waitFor().catch(() => {});
  await page.locator(ROW).first().waitFor();
}

// --- 1. releases index ----------------------------------------------------
await goHome();
await page.getByText('Falling Light').first().waitFor();
await shot('01-releases-index');

// the next-send popover: a date-only cell that opens the next three sends
await page
  .locator(ROW, { hasText: 'Falling Light' })
  .locator('.rd-menuwrap button')
  .first()
  .click();
await page.getByText(/Next ·/).waitFor();
await shot('01b-releases-next-popover', { fullPage: false });
await page.keyboard.press('Escape');

// --- 2. release detail: Falling Light framed flow -------------------------
await page.getByText('Falling Light').first().click();
await page.getByRole('tab', { name: /^All orders/ }).waitFor();
await page.waitForTimeout(400);
// the first tab: every order on the release, one row per print
await shot('00-release-all-orders');

// a flow tab: promise date, comms plan, orders, history
await page.getByRole('tab', { name: /^Framed \(/ }).click();
await page.waitForTimeout(400);
await shot('03-release-emails-card');

// All emails: an image per slot, sized by the longest window
await page.getByRole('tab', { name: 'All emails' }).click();
await page.getByText('On track 1', { exact: true }).waitFor();
await shot('04-release-email-edit');

// the image picker, with the library and the upload box
await page.locator('table.rd-t27 tbody tr').first().locator('.rd-chip-sm').first().click();
await page.getByRole('dialog').waitFor();
await page.getByText('Master default').first().waitFor();
await shot('04b-image-picker', { fullPage: false });
await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();

// Framed 3 — the overdue split batch, with inherited story in the plan
await page.getByRole('tab', { name: /^Framed 3/ }).click();
await page.getByText(/before the split/).first().waitFor();
await shot('05-release-fl-batch3');

// --- 3. warehouse allocation import summary -------------------------------
await page.getByRole('button', { name: 'Import warehouse allocation' }).click();
await page.getByRole('dialog').waitFor();
await page.getByLabel('Or paste the CSV contents').fill(allocationCsv);
await page.getByRole('button', { name: 'Import', exact: true }).click();
await page.getByText(/orders matched from/).waitFor();
await shot('06-allocation-import', { fullPage: false });
await page.getByRole('button', { name: 'Done' }).click();

// --- 4. reschedule flow ---------------------------------------------------
await page.getByRole('tab', { name: /^Framed \(/ }).click();
await page.waitForTimeout(400);
// tick three orders — the bulk bar replaces the header row in place
const ticks = page.locator(`${ROW} [role="checkbox"]`);
await ticks.nth(0).click();
await ticks.nth(1).click();
await ticks.nth(2).click();
await shot('02-bulk-bar', { fullPage: false });
await page.getByRole('button', { name: /Change delivery date/ }).first().click();
await page.getByRole('dialog').waitFor();
const future = new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10);
await page.getByLabel('New promised delivery date').fill(future);
await page
  .getByLabel('Reason for the change')
  .fill('Second framing run pushed back at the framers');
await shot('07-reschedule-step1', { fullPage: false });
await page.getByRole('button', { name: 'Next: delay email' }).click();
await page.getByText('What happens when you save').waitFor();
await shot('08-reschedule-step2', { fullPage: false });
await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();

// --- 5. batchless release (Vessel VIII, sculpture) ------------------------
await goHome();
await page.getByText('Vessel VIII').first().click();
// A release that never split shows "Overview" where a print shows its flows.
await page.getByRole('tab', { name: 'Overview' }).click();
await page.getByRole('button', { name: 'Change delivery date' }).first().waitFor();
await shot('09-release-nightgarden-batchless');

// --- 6. approval queue ----------------------------------------------------
await page.goto(BASE + '/approvals', { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: 'Approval queue' }).waitFor().catch(() => {});
await page.locator(ROW).first().waitFor();
await shot('10-approval-queue');

// inline preview: first row
await page.locator(ROW).first().click();
await page.getByRole('dialog').waitFor();
await page.getByText('What happens next?').first().waitFor();
await shot('11-approval-preview', { fullPage: false });
await page.keyboard.press('Escape');

// --- 7. send detail -------------------------------------------------------
await goHome();
await page.getByText('Falling Light').first().click();
await page.getByRole('tab', { name: /^Framed \(/ }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Signing', exact: true }).click();
await page.getByText('Email as sent').waitFor();
await shot('12-send-detail-sent');

// an upcoming send with the structured preview + "they last received"
await page.goBack({ waitUntil: 'networkidle' });
await page.getByRole('tab', { name: /^Framed 3/ }).click();
await page.getByRole('button', { name: 'Delay notice', exact: true }).click();
await page.getByText('Email as it will send').waitFor();
await shot('13-send-detail-upcoming');

await browser.close();
console.log('done →', OUT);
