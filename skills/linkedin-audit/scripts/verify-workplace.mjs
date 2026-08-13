// Open the profile, try to reach the workplace-verification flow, request the code
// to the given email, and KEEP THE BROWSER OPEN so the user can enter the code.
//   node verify-workplace.mjs <profileUrl> <workEmail>
// The process exits when the user closes the browser window.
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [profileUrl, email] = process.argv.slice(2);
if (!profileUrl) {
  console.error('Usage: node verify-workplace.mjs <profileUrl> [workEmail]');
  process.exit(1);
}
const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const userDataDir = path.join(skillDir, '.browser-profile');

async function launch() {
  const opts = { headless: false, viewport: { width: 1280, height: 900 }, locale: 'en-US' };
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      return await chromium.launchPersistentContext(userDataDir, { ...opts, channel });
    } catch (err) {
      if (channel === undefined) throw err;
    }
  }
}

const context = await launch();
context.on('close', () => process.exit(0));
const page = context.pages()[0] ?? (await context.newPage());
page.setDefaultTimeout(30_000);
const dialog = () => page.locator('[role="dialog"]:visible, dialog:visible').last();

await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

// Hunt for a verification entry point on the profile (prompt card or per-position link).
let clicked = false;
for (const el of await page.locator('main a, main button, main [role="button"]').all()) {
  const t = (
    (((await el.textContent().catch(() => '')) ?? '') +
      ' ' +
      ((await el.getAttribute('aria-label').catch(() => '')) ?? ''))
  ).toLowerCase();
  if (/verif/.test(t) && !/verified|verification badge/.test(t)) {
    console.log(`clicking verification entry: "${t.replace(/\s+/g, ' ').trim().slice(0, 80)}"`);
    await el.click().catch(() => {});
    clicked = true;
    break;
  }
}
if (!clicked) console.log('No verification entry found on the profile — window left open for manual navigation.');

await page.waitForTimeout(3000);
if (email && (await dialog().isVisible().catch(() => false))) {
  const input = dialog().locator('input[type="email"], input[type="text"]').first();
  if (await input.isVisible().catch(() => false)) {
    await input.fill(email);
    await page.waitForTimeout(500);
    const send = dialog()
      .locator('button, [role="button"]')
      .filter({ hasText: /send code|trimite cod/i })
      .first();
    if (await send.isVisible().catch(() => false)) {
      await send.click();
      console.log(`Verification code requested to ${email} — check the inbox and enter it in the open window.`);
    } else {
      console.log(`Email filled (${email}) — click Send code in the open window.`);
    }
  }
}

console.log('Browser stays open. Finish the verification, then close the window to end this script.');
await new Promise(() => {});
