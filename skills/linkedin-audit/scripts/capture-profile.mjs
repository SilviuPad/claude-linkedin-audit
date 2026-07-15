import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [profileUrl, outDirArg] = process.argv.slice(2);
if (!profileUrl || !/linkedin\.com\/in\//.test(profileUrl)) {
  console.error('Usage: node capture-profile.mjs <https://www.linkedin.com/in/...> <outDir>');
  process.exit(1);
}

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(outDirArg ?? path.join(skillDir, 'audits', new Date().toISOString().slice(0, 10)));
const userDataDir = path.join(skillDir, '.browser-profile');
await mkdir(outDir, { recursive: true });

const base = profileUrl.replace(/\/+$/, '');
const pages = [
  { key: 'profile', url: `${base}/` },
  { key: 'experience', url: `${base}/details/experience/` },
  { key: 'education', url: `${base}/details/education/` },
  { key: 'skills', url: `${base}/details/skills/` },
  { key: 'certifications', url: `${base}/details/certifications/` },
  { key: 'projects', url: `${base}/details/projects/` },
  { key: 'recommendations', url: `${base}/details/recommendations/` },
  { key: 'featured', url: `${base}/details/featured/` },
  { key: 'volunteering', url: `${base}/details/volunteering-experiences/` },
  { key: 'activity', url: `${base}/recent-activity/all/` },
];

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
const page = context.pages()[0] ?? (await context.newPage());
page.setDefaultTimeout(30_000);

const needsLogin = () => /authwall|checkpoint|\/login|\/signup|\/uas\//.test(page.url());

// LinkedIn redirects to the authwall client-side, sometimes seconds after load —
// so this must be called after every navigation, not just the first one.
async function gotoAuthenticated(url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (!needsLogin()) return;

  console.log('LOGIN REQUIRED: log in to LinkedIn in the opened browser window. Waiting up to 5 minutes...');
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline && needsLogin()) await page.waitForTimeout(2000);
  if (needsLogin()) throw new Error('Timed out waiting for LinkedIn login.');

  console.log('Login detected, continuing.');
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (needsLogin()) throw new Error('Still hitting the authwall after login.');
}

async function settle() {
  let lastHeight = 0;
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(700);
    // Detail pages paginate behind a "Show more results" button — click it as it appears.
    const more = page
      .locator('main button')
      .filter({ hasText: /show more|afișați mai multe/i })
      .first();
    if (await more.isVisible().catch(() => false)) {
      await more.click().catch(() => {});
      await page.waitForTimeout(1800);
    }
    const height = await page.evaluate(() => document.body.scrollHeight);
    if (height === lastHeight && i > 4) break;
    lastHeight = height;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

async function expandSeeMore() {
  const buttons = page.locator('button:has-text("see more")');
  const count = Math.min(await buttons.count(), 20);
  for (let i = 0; i < count; i++) {
    await buttons.nth(i).click({ timeout: 2000 }).catch(() => {});
  }
}

const manifest = { profileUrl, capturedAt: new Date().toISOString(), pages: [] };

for (const { key, url } of pages) {
  const entry = { key, requestedUrl: url };
  try {
    await gotoAuthenticated(url);
    await settle();
    if (key === 'profile') await expandSeeMore();

    entry.finalUrl = page.url();
    const wantPath = new URL(url).pathname.replace(/\/$/, '');
    const gotPath = new URL(entry.finalUrl).pathname.replace(/\/$/, '');
    entry.redirected = key !== 'profile' && !gotPath.startsWith(wantPath);

    const text = await page.evaluate(
      () => (document.querySelector('main') ?? document.body).innerText,
    );
    await writeFile(path.join(outDir, `${key}.txt`), text, 'utf8');
    await page.screenshot({ path: path.join(outDir, `${key}.png`), fullPage: true }).catch(async () => {
      await page.screenshot({ path: path.join(outDir, `${key}.png`) });
    });
    entry.ok = true;
    console.log(`captured ${key}${entry.redirected ? ' (redirected — section likely empty)' : ''}`);
  } catch (err) {
    entry.ok = false;
    entry.error = String(err?.message ?? err);
    console.warn(`failed ${key}: ${entry.error}`);
  }
  manifest.pages.push(entry);
}

await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
await context.close();

const good = manifest.pages.filter((p) => p.ok && !p.redirected).length;
console.log(`Done. ${good}/${pages.length} pages captured with content. Output: ${outDir}`);
if (manifest.pages.every((p) => !p.ok)) process.exit(2);
