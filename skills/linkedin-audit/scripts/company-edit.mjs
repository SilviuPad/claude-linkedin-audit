import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// EDIT ME — dummy example values; replace with your own company page's data.
// The company id is in your admin URL: linkedin.com/company/<id>/admin/edit/
const ADMIN = 'https://www.linkedin.com/company/00000000/admin/edit/';
const DESCRIPTION = `Acme Studio is a web development agency in Springfield. We build high-performance websites and web applications, from architecture to production.

Services: custom web apps (React, Next.js, TypeScript), SEO, and product architecture for startups.

Case study: https://www.example.com/blog/case-study/`;
const WEBSITE = 'https://www.example.com';

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(skillDir, 'audits', 'company-edits');
const context = await chromium.launchPersistentContext(path.join(skillDir, '.browser-profile'), {
  headless: false, viewport: { width: 1280, height: 900 }, channel: 'chrome',
});
const page = context.pages()[0] ?? (await context.newPage());
page.setDefaultTimeout(15000);

async function openSection(re) {
  await page.goto(ADMIN, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await page.locator('main a, main button, main [role="tab"], main li').filter({ hasText: re }).first().click();
  await page.waitForTimeout(2500);
}

async function saveSection(name) {
  await page.screenshot({ path: path.join(shots, `company-${name}-before-save.png`), timeout: 8000 }).catch(() => {});
  const save = page
    .locator('main button, main [role="button"]')
    .filter({ hasText: /^\s*(save|salvați)\s*$/i })
    .first();
  await save.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(shots, `company-${name}-after-save.png`), timeout: 8000 }).catch(() => {});
  console.log(`saved: ${name}`);
}

// --- Details: description, website, industry, size ---
await openSection(/^\s*(Details|Detalii)\s*$/);
const detailFields = await page.locator('main textarea:visible, main input:visible, main select:visible').all();
console.log('--- Details fields ---');
for (const el of detailFields) {
  console.log(
    ' ',
    await el.evaluate((e) => e.tagName),
    'id=', ((await el.getAttribute('id')) ?? '').slice(0, 60),
    'ph=', await el.getAttribute('placeholder'),
    'value=', JSON.stringify(((await el.inputValue().catch(() => '')) ?? '').slice(0, 40)),
  );
}
const descArea = page.locator('main textarea:visible').first();
await descArea.fill(DESCRIPTION);

const urlInput = page
  .locator('main input[type="url"]:visible, main input[id*="website" i]:visible, main input[name*="website" i]:visible')
  .first();
if (await urlInput.isVisible().catch(() => false)) await urlInput.fill(WEBSITE);
else console.log('WARN: website input not found by type/id — check dump above');

const industryInput = page
  .locator('main input[id*="industry" i]:visible, main input[role="combobox"]:visible')
  .first();
if (await industryInput.isVisible().catch(() => false)) {
  await industryInput.fill('IT Services and IT Consulting');
  await page.waitForTimeout(2000);
  const opt = page.locator('[role="option"]').filter({ hasText: /IT Services and IT Consulting/i }).first();
  if (await opt.isVisible().catch(() => false)) await opt.click();
}
const sizeSelect = page.locator('#organization-size-select');
if (await sizeSelect.isVisible().catch(() => false)) {
  const labels = await sizeSelect.locator('option').allTextContents();
  const pick = labels.find((l) => /2-10/.test(l));
  if (pick) await sizeSelect.selectOption({ label: pick });
}
// "PUBLIC_COMPANY" means stock-exchange listed — wrong for an agency.
const typeSelect = page.locator('#organization-type-select');
if (await typeSelect.isVisible().catch(() => false)) {
  const labels = await typeSelect.locator('option').allTextContents();
  const pick = labels.find((l) => /privately held|self-owned|deținut/i.test(l));
  if (pick) await typeSelect.selectOption({ label: pick });
  console.log('type options:', JSON.stringify(labels), '→ picked:', pick);
}
// The website opt-out checkbox hides the URL entirely if checked.
const optout = page.locator('#organization-website-optout-checkbox');
if (await optout.isChecked().catch(() => false)) {
  await optout.click({ force: true });
  console.log('unchecked website opt-out');
}
await saveSection('details');

// --- Buttons: Visit website → WEBSITE ---
await openSection(/^\s*(Buttons|Butoane)\s*$/);
console.log('--- Buttons section text ---');
console.log(
  (await page.evaluate(() => (document.querySelector('main') ?? document.body).innerText))
    .replace(/\s+/g, ' ')
    .slice(0, 500),
);
const toggle = page.locator('main input[type="checkbox"]:visible, main [role="switch"]:visible').first();
if (await toggle.isVisible().catch(() => false)) {
  if (!(await toggle.isChecked().catch(() => false))) await toggle.click();
  await page.waitForTimeout(1000);
}
const btnSelect = page.locator('main select:visible').first();
if (await btnSelect.isVisible().catch(() => false)) {
  const labels = await btnSelect.locator('option').allTextContents();
  const pick = labels.find((l) => /visit website|vizitați/i.test(l));
  if (pick) await btnSelect.selectOption({ label: pick });
  console.log('button options:', JSON.stringify(labels), '→ picked:', pick);
}
const btnUrl = page
  .locator('main input[type="url"]:visible, main input[type="text"]:visible, main input:not([type]):visible')
  .first();
if (await btnUrl.isVisible().catch(() => false)) await btnUrl.fill(WEBSITE);
await saveSection('buttons');

await context.close();
console.log('DONE');
