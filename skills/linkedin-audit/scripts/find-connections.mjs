// Search LinkedIn for people relevant to the target role and send connection invites.
//   node find-connections.mjs [maxInvites] [outDir]
// Personal use on the user's own account, with an explicit per-run cap (default 12 —
// the audit's "10-15 targeted requests a week" guidance). Searches 2nd-degree only:
// those invites carry a mutual-connection line and accept far better than cold 3rd+.
// Writes connections-log.json to outDir and prints a summary.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const maxInvites = Math.max(1, Math.min(25, Number(process.argv[2] ?? 12)));
const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(
  process.argv[3] ?? path.join(skillDir, 'audits', `${new Date().toISOString().slice(0, 10)}-connections`),
);
const userDataDir = path.join(skillDir, '.browser-profile');
await mkdir(outDir, { recursive: true });

// Queries ordered by expected value: recruiters who staff frontend roles first,
// then senior frontend peers (2nd-degree peers at target companies).
const QUERIES = [
  { q: 'technical recruiter frontend', cap: 4 },
  { q: 'IT recruiter react', cap: 3 },
  { q: 'talent acquisition frontend developer', cap: 3 },
  { q: 'senior frontend developer react', cap: 4 },
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
async function gotoAuthenticated(url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  if (!needsLogin()) return;
  console.log('LOGIN REQUIRED: log in in the opened window. Waiting up to 5 minutes...');
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline && needsLogin()) await page.waitForTimeout(2000);
  if (needsLogin()) throw new Error('Timed out waiting for LinkedIn login.');
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
}

const dialog = () => page.locator('[role="dialog"]:visible, dialog:visible').last();
const log = [];
let sent = 0;
let weeklyLimitHit = false;

async function handlePostClickDialog(name) {
  await page.waitForTimeout(1800);
  if (!(await dialog().isVisible().catch(() => false))) return 'sent-directly';
  const text = ((await dialog().textContent().catch(() => '')) ?? '').toLowerCase();
  if (/weekly.*limit|limit.*invita|reached the limit/i.test(text)) {
    weeklyLimitHit = true;
    await page.keyboard.press('Escape');
    return 'weekly-limit';
  }
  // Email-gated invites are not worth fighting — close and skip.
  if (/email/.test(text) && /verify|enter/i.test(text)) {
    await page.keyboard.press('Escape');
    return 'email-gated';
  }
  const withoutNote = dialog()
    .locator('button, [role="button"]')
    .filter({ hasText: /send without a note|trimite fără notă/i })
    .first();
  if (await withoutNote.isVisible().catch(() => false)) {
    await withoutNote.click();
    await page.waitForTimeout(1500);
    return 'sent';
  }
  const send = dialog()
    .locator('button, [role="button"]')
    .filter({ hasText: /^\s*(send|send now|trimite(ți)? acum|trimite(ți)?)\s*$/i })
    .first();
  if (await send.isVisible().catch(() => false)) {
    await send.click();
    await page.waitForTimeout(1500);
    return 'sent';
  }
  console.log(`      unrecognized dialog for ${name} — skipping`);
  await page.keyboard.press('Escape');
  return 'skipped-dialog';
}

for (const { q, cap } of QUERIES) {
  if (sent >= maxInvites || weeklyLimitHit) break;
  const url = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}&network=%5B%22S%22%5D&origin=FACETED_SEARCH`;
  console.log(`\nquery: "${q}" (2nd degree)`);
  await gotoAuthenticated(url);
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(1500);

  // Connect controls are NOT reliably <button>s in search results (verified Aug 2026:
  // "Follow" is a button, "Connect" is not) — match aria-label "Invite <name>" across
  // a/button/[role=button], with a text-based fallback.
  let controls = await page.locator('main [aria-label*="invit" i]').all();
  if (controls.length === 0)
    controls = await page
      .locator('main a, main button, main [role="button"]')
      .filter({ hasText: /^\s*(connect|conectați(-vă)?)\s*$/i })
      .all();
  console.log(`  ${controls.length} connectable results on page 1`);
  let sentThisQuery = 0;

  for (const btn of controls) {
    if (sent >= maxInvites || sentThisQuery >= cap || weeklyLimitHit) break;
    const label = (await btn.getAttribute('aria-label')) ?? '';
    // "Pending, click to withdraw invitation sent to X" also contains "invit" — never click those.
    if (/pending|withdraw|retrage/i.test(label)) continue;
    const card = await btn
      .evaluate(
        (el) =>
          (el.closest('li') ?? el.closest('[data-chameleon-result-urn]') ?? el.parentElement)
            ?.innerText?.replace(/\s+/g, ' ')
            .slice(0, 220) ?? '',
      )
      .catch(() => '');
    let name = label.replace(/^invit\w*\s+/i, '').replace(/\s+to connect.*$/i, '').trim();
    if (!name) name = (card.split('•')[0] ?? '').trim().slice(0, 60);
    if (!name || log.some((e) => e.name === name)) continue;
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await btn.click().catch(() => null);
    const status = await handlePostClickDialog(name);
    if (status === 'sent' || status === 'sent-directly') {
      sent++;
      sentThisQuery++;
      console.log(`  ✓ invited ${name}`);
    } else {
      console.log(`  – ${name}: ${status}`);
    }
    log.push({ name, query: q, status, card });
    await page.waitForTimeout(1200 + Math.floor(1500 * ((sent % 5) / 5))); // pace, non-uniform
  }
}

await writeFile(
  path.join(outDir, 'connections-log.json'),
  JSON.stringify({ ranAt: new Date().toISOString(), maxInvites, sent, weeklyLimitHit, log }, null, 2),
  'utf8',
);
await context.close();
console.log(`\nDone. ${sent}/${maxInvites} invites sent${weeklyLimitHit ? ' (stopped at weekly limit)' : ''}. Log: ${path.join(outDir, 'connections-log.json')}`);
