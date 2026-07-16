import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const url = process.argv[2];
if (!url) {
  console.error('usage: node probe.mjs <linkedin-url>');
  process.exit(1);
}

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = await chromium.launchPersistentContext(path.join(skillDir, '.browser-profile'), {
  headless: false, viewport: { width: 1280, height: 900 }, channel: 'chrome',
});
const page = context.pages()[0] ?? (await context.newPage());
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(500); }
const text = await page.evaluate(() => (document.querySelector('main') ?? document.body).innerText);
console.log(text.split('\n').filter((l) => l.trim()).slice(0, 90).join('\n'));
await context.close();
