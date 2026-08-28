/**
 * Screenshot the five screens for the design-review artifact.
 * Pattern from the first session: serve dist/ (vite preview), drive the
 * preinstalled Chromium, use role-based selectors (Polaris Tabs render
 * hidden text copies that break text= selectors).
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

async function shot(name, { fullPage = true } = {}) {
  await page.waitForTimeout(650); // let Polaris settle + skeletons resolve
  await page.screenshot({ path: `${OUT}/${name}.jpg`, fullPage, type: 'jpeg', quality: 82 });
  console.log('shot', name);
}

async function goHome() {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Releases' }).first().waitFor();
}

// --- 1. releases index ----------------------------------------------------
await goHome();
await page.getByText('Falling Light').first().waitFor();
await shot('01-releases-index');

// the next-send popover: date-only cell expands to the next three sends
await page
  .locator('.Polaris-IndexTable__TableRow', { hasText: 'Falling Light' })
  .getByRole('button')
  .first()
  .click();
await page.getByText(/Next ·/).waitFor();
await shot('01b-releases-next-popover', { fullPage: false });
await page.keyboard.press('Escape');

// --- 2. release detail: Falling Light framed flow -------------------------
await page.getByText('Falling Light').first().click();
await page.getByRole('tab', { name: /^Framed \(/ }).waitFor();
await page.waitForTimeout(300);
await shot('03-release-emails-card');

// the Emails tab: image slots + copy status per email
await page.getByRole('tab', { name: 'Emails' }).click();
await page.getByText('On track 1', { exact: true }).waitFor();
await shot('04-release-email-edit');

// Framed 3 — the overdue split batch, with inherited story in the plan
await page.getByRole('tab', { name: /^Framed 3/ }).click();
await page.getByText('received before the split').first().waitFor();
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
// select three orders, open the reschedule modal
const checkboxes = page.locator('.Polaris-IndexTable__TableRow input[type="checkbox"]');
await checkboxes.nth(0).click();
await checkboxes.nth(1).click();
await checkboxes.nth(2).click();
await page.getByRole('button', { name: /Change delivery date \(3\)/ }).click();
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
await page.getByRole('button', { name: 'Change delivery date' }).first().waitFor();
await shot('09-release-nightgarden-batchless');

// --- 6. approval queue ----------------------------------------------------
await page.goto(BASE + '/approvals', { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: 'Approval queue' }).waitFor();
await page.locator('.Polaris-IndexTable__TableRow').first().waitFor();
await shot('10-approval-queue');

// inline preview: first row
await page.locator('.Polaris-IndexTable__TableRow').first().click();
await page.getByRole('dialog').waitFor();
await page.getByText('What happens next?').first().waitFor();
await shot('11-approval-preview', { fullPage: false });
await page.keyboard.press('Escape');

// --- 7. send detail -------------------------------------------------------
await goHome();
await page.getByText('Falling Light').first().click();
await page.getByRole('tab', { name: /^Framed \(/ }).waitFor();
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
