import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const [changesPath, ...ops] = process.argv.slice(2);
if (!changesPath || ops.length === 0) {
  console.error('Usage: node edit-profile.mjs <changes.mjs> <op...>');
  console.error('Ops: headline | about | exp:<companyMatch> | skill:<name> | all');
  process.exit(1);
}

const changes = (await import(pathToFileURL(path.resolve(changesPath)).href)).default;
const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const userDataDir = path.join(skillDir, '.browser-profile');
const shotsDir = path.join(path.dirname(path.resolve(changesPath)), 'edits');
await mkdir(shotsDir, { recursive: true });
const base = changes.profileUrl.replace(/\/+$/, '');

const opList =
  ops[0] === 'all'
    ? [
        'headline',
        'about',
        ...changes.experiences.map((e) => `exp:${e.match}`),
        ...changes.skills.map((s) => `skill:${s}`),
      ]
    : ops;

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
page.setDefaultTimeout(20_000);

async function goto(sub = '') {
  await page.goto(`${base}/${sub}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (/authwall|checkpoint|\/login|\/uas\//.test(page.url()))
    throw new Error('Not logged in — run capture-profile.mjs first to establish the session.');
}

// LinkedIn's edit forms render web components in shadow DOM: obfuscated classes, no
// artdeco, fields are contenteditable divs. Playwright locators pierce shadow DOM, but
// hidden <dialog> elements (video.js) coexist on the page — filter to :visible.
const dialog = () =>
  page.locator('dialog:visible, [role="dialog"]:visible, .artdeco-modal:visible').last();

// UI language is Romanian, so never match on visible text or aria-labels.
// Edit pencils are anchors with stable hrefs; Save is the dialog's submit/primary button.
async function openEditForm(hrefFragment) {
  const anchor = page.locator(`a[href*="${hrefFragment}"]`).first();
  await anchor.click();
  await page.waitForTimeout(2500);
  if (!(await dialog().isVisible().catch(() => false)))
    throw new Error(`Edit dialog did not open for ${hrefFragment}`);
}

async function fieldValue(el) {
  const value = await el.inputValue().catch(() => null);
  if (value !== null) return value;
  return (await el.textContent().catch(() => '')) ?? '';
}

async function findField(currentSnippet) {
  const fields = await dialog()
    .locator('textarea, input, [contenteditable="true"], [role="textbox"]')
    .all();
  if (currentSnippet) {
    for (const el of fields) {
      if ((await fieldValue(el)).includes(currentSnippet)) return el;
    }
  }
  for (const sel of ['[contenteditable="true"]', 'textarea']) {
    const candidates = await dialog().locator(sel).all();
    if (candidates.length === 1) return candidates[0];
  }
  throw new Error(
    `Could not locate field (snippet: ${JSON.stringify(currentSnippet)}, ${fields.length} candidates)`,
  );
}

async function setField(el, text) {
  try {
    await el.fill(text);
  } catch {
    await el.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.insertText(text);
  }
}

const saveButton = () => {
  const byText = dialog()
    .locator('button')
    .filter({ hasText: /^\s*(save|salva(ți|ță)?|salvează)\s*$/i });
  return { byText, fallback: dialog().locator('button').filter({ hasText: /\S/ }).last() };
};

async function saveDialog(name) {
  await page.screenshot({ path: path.join(shotsDir, `${name}-before-save.png`) });
  const { byText, fallback } = saveButton();
  if (await byText.first().isVisible().catch(() => false)) await byText.first().click();
  else await fallback.click();
  await page.waitForTimeout(3500);
  // A lingering dialog is either a post-save "share with network" prompt (Escape closes it
  // harmlessly) or a validation error (the form with its fields is still there).
  if (await dialog().isVisible().catch(() => false)) {
    const stillForm = await dialog()
      .locator('textarea, [contenteditable="true"], input[type="text"]')
      .first()
      .isVisible()
      .catch(() => false);
    if (stillForm) {
      await page.screenshot({ path: path.join(shotsDir, `${name}-validation-error.png`) });
      throw new Error('Form still open after Save — see validation-error screenshot.');
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: path.join(shotsDir, `${name}-after-save.png`) });
}

async function editHeadline() {
  await goto();
  try {
    await openEditForm('edit/intro');
  } catch {
    await goto('edit/intro/');
    if (!(await dialog().isVisible().catch(() => false))) throw new Error('Intro form not reachable');
  }
  const field = await findField(changes.headline.currentSnippet);
  await setField(field, changes.headline.text);
  await saveDialog('headline');
}

async function editAbout() {
  await goto();
  await openEditForm('edit/forms/summary');
  const field = await findField(changes.about.currentSnippet);
  await setField(field, changes.about.text);
  await saveDialog('about');
}

async function editExperience(match) {
  const entry = changes.experiences.find((e) => e.match === match);
  if (!entry) throw new Error(`No change entry for ${match}`);
  await goto('details/experience/');
  // Shadow DOM breaks ancestor-text matching, so identify the right entry by opening
  // each form and checking its own field values for the company name before editing.
  const hrefs = [];
  for (const anchor of await page.locator('a[href*="/details/experience/edit/forms/"]').all()) {
    const href = await anchor.getAttribute('href');
    if (href && !hrefs.includes(href)) hrefs.push(href);
  }
  if (hrefs.length === 0) throw new Error('No experience edit anchors found');
  for (const href of hrefs) {
    await page.locator(`a[href="${href}"]`).first().click();
    await page.waitForTimeout(2500);
    if (!(await dialog().isVisible().catch(() => false))) continue;
    const values = [];
    for (const el of await dialog().locator('textarea, input, [contenteditable="true"]').all())
      values.push(await fieldValue(el));
    if (values.some((v) => v.includes(match))) {
      const field = await findField(entry.currentSnippet ?? '');
      await setField(field, entry.text);
      await saveDialog(`exp-${match.replace(/\W+/g, '-')}`);
      return;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    if (await dialog().isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }
  }
  throw new Error(`No experience form contained "${match}"`);
}

async function addSkill(spec) {
  const [name, assoc] = spec.split('@');
  await goto('details/skills/');
  const addBtn = page
    .locator('main')
    .locator('button[aria-label*="add" i], button[aria-label*="dăug" i], a[aria-label*="add" i], a[aria-label*="dăug" i]')
    .first();
  await addBtn.click();
  await page.waitForTimeout(2500);
  if (!(await dialog().isVisible().catch(() => false)))
    throw new Error('Add-skill form did not open');
  const field = dialog()
    .locator('input[type="text"], input:not([type]), input[role="combobox"], [role="combobox"]')
    .first();
  await field.fill(name);
  await page.waitForTimeout(1800);
  const option = page.locator(`[role="option"]:has-text("${name}")`).first();
  if (await option.isVisible().catch(() => false)) await option.click();
  if (assoc) {
    const byRole = dialog().getByRole('checkbox', { name: new RegExp(assoc, 'i') }).first();
    if (await byRole.isVisible().catch(() => false)) await byRole.check();
    else await dialog().locator('label').filter({ hasText: assoc }).first().click();
  }
  await saveDialog(`skill-${spec.replace(/\W+/g, '-')}`);
}

// Details pages paginate/lazy-load ~10 items; scroll the last anchor into view until
// no new anchors appear.
async function collectAnchors(pattern) {
  const seen = [];
  for (let round = 0; round < 12; round++) {
    const anchors = await page.locator(`a[href*="${pattern}"]`).all();
    let grew = false;
    for (const a of anchors) {
      const href = await a.getAttribute('href');
      if (href && !seen.includes(href)) {
        seen.push(href);
        grew = true;
      }
    }
    if (anchors.length) await anchors[anchors.length - 1].scrollIntoViewIfNeeded().catch(() => {});
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(1200);
    if (!grew && round > 1) break;
  }
  return seen;
}

async function checkedCount() {
  let n = 0;
  for (const c of await dialog().getByRole('checkbox').all()) if (await c.isChecked().catch(() => false)) n++;
  return n;
}

async function editSkill(spec) {
  const [name, assoc] = spec.split('@');
  if (!assoc) throw new Error('editskill needs <name>@<association>');
  await goto('details/skills/');
  const hrefs = await collectAnchors('/details/skills/edit/forms/');
  if (hrefs.length === 0) throw new Error('No skill edit anchors found');
  for (const href of hrefs) {
    const anchor = page.locator(`a[href="${href}"]`).first();
    await anchor.scrollIntoViewIfNeeded().catch(() => {});
    await anchor.click();
    await page.waitForTimeout(2500);
    if (!(await dialog().isVisible().catch(() => false))) continue;
    // The skill name is a static heading, not a field — match on dialog text. Only
    // position/education titles appear otherwise, so a plain includes() is unambiguous.
    const dlgText = ((await dialog().textContent()) ?? '').replace(/\s+/g, ' ');
    if (dlgText.includes(name)) {
      const before = await checkedCount();
      const row = dialog().getByText(new RegExp(assoc, 'i')).first();
      await row.click();
      await page.waitForTimeout(800);
      const after = await checkedCount();
      if (after < before) throw new Error(`Unchecked an existing ${assoc} association — aborting save`);
      if (after === before) throw new Error(`Clicking "${assoc}" row did not toggle a checkbox`);
      await saveDialog(`editskill-${spec.replace(/\W+/g, '-')}`);
      return;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    if (await dialog().isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }
  }
  throw new Error(`No skill entry named "${name}" found among ${hrefs.length} entries`);
}

async function editProject(match) {
  const entry = (changes.projects ?? []).find((p) => p.match === match);
  if (!entry) throw new Error(`No project change entry for ${match}`);
  await goto('details/projects/');
  const hrefs = await collectAnchors('/details/projects/edit/forms/');
  if (hrefs.length === 0) throw new Error('No project edit anchors found');
  for (const href of hrefs) {
    await page.locator(`a[href="${href}"]`).first().click();
    await page.waitForTimeout(2500);
    if (!(await dialog().isVisible().catch(() => false))) continue;
    const nameField = await findField(match).catch(() => null);
    if (nameField) {
      await setField(nameField, entry.name);
      const desc = dialog().locator('textarea').first();
      if (await desc.isVisible().catch(() => false)) await setField(desc, entry.text);
      await saveDialog(`proj-${match.replace(/\W+/g, '-')}`);
      return;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    if (await dialog().isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }
  }
  throw new Error(`No project form contained "${match}"`);
}

async function addProject(nameFragment) {
  const entry = (changes.projectAdds ?? []).find((p) => p.name.includes(nameFragment));
  if (!entry) throw new Error(`No projectAdds entry matching ${nameFragment}`);
  await goto('edit/forms/project/new/');
  if (!(await dialog().isVisible().catch(() => false)))
    throw new Error('Add-project form did not open');
  await setField(dialog().locator('input').first(), entry.name);
  await setField(dialog().locator('textarea').first(), entry.text);
  await saveDialog(`projadd-${nameFragment.replace(/\W+/g, '-')}`);
}

async function openFeaturedMenu(itemRe) {
  await goto('details/featured/');
  await page
    .locator('main button[aria-label*="overflow" i], main button[aria-label*="depășire" i]')
    .first()
    .click();
  await page.waitForTimeout(1800);
  await page.locator('[role="menuitem"]').filter({ hasText: itemRe }).first().click();
}

async function featurePost(snippet) {
  await openFeaturedMenu(/post/i);
  await page.waitForTimeout(4000);
  if (!(await dialog().isVisible().catch(() => false)))
    throw new Error('Post picker did not open');
  const snippetEl = dialog().getByText(snippet).first();
  await snippetEl.scrollIntoViewIfNeeded();
  const sBox = await snippetEl.boundingBox();
  if (!sBox) throw new Error(`Post containing "${snippet}" not found in picker`);
  // Each post card ends with its own Feature button; pick the nearest one below the snippet.
  let best = null;
  for (const b of await dialog().locator('button').filter({ hasText: /feature|recomand/i }).all()) {
    const box = await b.boundingBox();
    if (!box) continue;
    const dy = box.y - sBox.y;
    if (dy > 0 && (!best || dy < best.dy)) best = { b, dy };
  }
  if (!best) throw new Error('No Feature button found below the target post');
  await page.screenshot({ path: path.join(shotsDir, `featurepost-before.png`) });
  await best.b.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(shotsDir, `featurepost-after.png`) });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
}

async function featureLink(url) {
  await openFeaturedMenu(/link/i);
  await page.waitForTimeout(3000);
  if (!(await dialog().isVisible().catch(() => false)))
    throw new Error('Add-link dialog did not open');
  await setField(dialog().locator('input').first(), url);
  await dialog().locator('button').filter({ hasText: /^\s*(add|adăugați)\s*$/i }).first().click();
  await page.waitForTimeout(5000);
  await saveDialog(`featurelink-${url.replace(/\W+/g, '-').slice(0, 40)}`);
}

async function swapTopSkill(spec) {
  const [remove, add] = spec.split('@');
  if (!remove || !add) throw new Error('topswap needs <removeSkill>@<addSkill>');
  // The Top-skills showcase (max 5) lives inside the About edit overlay. Remove buttons
  // carry the skill name in their aria-label in any language ("Remove X from list" /
  // "Elimină X din listă").
  await goto('edit/forms/summary/new/');
  if (!(await dialog().isVisible().catch(() => false)))
    throw new Error('About/Top-skills form did not open');

  const removeBtn = dialog().locator(`button[aria-label*="${remove}"]`).first();
  if (!(await removeBtn.isVisible().catch(() => false)))
    throw new Error(`No remove button for "${remove}" — not currently a top skill?`);
  await removeBtn.click();
  await page.waitForTimeout(1500);

  await dialog()
    .locator('button')
    .filter({ hasText: /add.*skill|adăugați o aptitudine/i })
    .first()
    .click();
  await page.waitForTimeout(1800);
  const input = dialog()
    .locator('input[type="text"], input:not([type]), [role="combobox"]')
    .first();
  await input.fill(add);
  await page.waitForTimeout(2000);
  const option = page.locator(`[role="option"]:has-text("${add}")`).first();
  if (!(await option.isVisible().catch(() => false)))
    throw new Error(`Typeahead offered no option for "${add}" — is it in your skills list?`);
  await option.click();
  await page.waitForTimeout(1000);
  await saveDialog(`topswap-${spec.replace(/\W+/g, '-')}`);
}

async function editOpenToWork(spec) {
  // spec: "remove=A,B;add=C,D" — edits the Job titles list in open-to-work preferences.
  const parts = Object.fromEntries(
    spec.split(';').map((s) => {
      const [k, v] = s.split('=');
      return [k, (v ?? '').split(',').map((x) => x.trim()).filter(Boolean)];
    }),
  );
  await goto('opportunities/job-opportunities/edit/');
  if (!(await dialog().isVisible().catch(() => false)))
    throw new Error('Job preferences form did not open');

  for (const title of parts.remove ?? []) {
    const btn = dialog().locator(`button[aria-label*="${title}"]`).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1200);
    } else {
      console.log(`      "${title}" not present — skipping removal`);
    }
  }

  // Two form variants exist: an older one with an "Add title" button + typeahead, and a
  // newer chips form with an always-visible input that commits free text on Enter.
  for (const title of parts.add ?? []) {
    if (await dialog().locator(`button[aria-label*="${title}"]`).first().isVisible().catch(() => false)) {
      console.log(`      "${title}" already present — skipping add`);
      continue;
    }
    const addBtn = dialog()
      .locator('button, [role="button"]')
      .filter({ hasText: /add title|adăugați (un )?titlu/i })
      .first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1500);
    }
    const input = dialog()
      .locator('input[type="text"]:visible, input:not([type]):visible, [role="combobox"]:visible')
      .first();
    await input.fill(title);
    await page.waitForTimeout(2000);
    const option = page.locator(`[role="option"]:has-text("${title}")`).first();
    if (await option.isVisible().catch(() => false)) await option.click();
    else await input.press('Enter');
    await page.waitForTimeout(1200);
    const chip = dialog().locator(`button[aria-label*="${title}"], [aria-label*="Remove ${title}" i]`).first();
    const committed =
      (await chip.isVisible().catch(() => false)) ||
      ((await dialog().textContent().catch(() => '')) ?? '').includes(title);
    if (!committed) throw new Error(`"${title}" did not commit as a chip`);
  }
  await saveDialog('opentowork');
}

async function deleteFeatured(match) {
  await goto('details/featured/');
  const snippetEl = page.locator('main').getByText(match).first();
  await snippetEl.scrollIntoViewIfNeeded();
  const sBox = await snippetEl.boundingBox();
  if (!sBox) throw new Error(`No featured card containing "${match}"`);
  // A card's own Delete sits BELOW its title; absolute distance can grab the previous
  // card's control. Positive dy only.
  let best = null;
  for (const el of await page
    .locator('main a, main button, main [role="button"]')
    .filter({ hasText: /^\s*(delete|ștergeți)\s*$/i })
    .all()) {
    const box = await el.boundingBox();
    if (!box) continue;
    const dy = box.y - sBox.y;
    if (dy > 0 && (!best || dy < best.dy)) best = { el, dy };
  }
  if (!best || best.dy > 800) throw new Error(`No Delete control below "${match}" card`);
  await best.el.click();
  await page.waitForTimeout(1500);
  const confirm = dialog().locator('button, [role="button"]').filter({ hasText: /delete|ștergeți/i }).first();
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(shotsDir, `featuredelete-${match.replace(/\W+/g, '-')}.png`) });
  // Deletes have silently no-opped before — verify the card is actually gone.
  await goto('details/featured/');
  if (await page.locator('main').getByText(match).first().isVisible().catch(() => false))
    throw new Error(`Card containing "${match}" still present after delete`);
}

async function certToTop(spec) {
  // LinkedIn certs display newest-ADDED first with no reorder control, so topping one
  // means delete + immediate re-add. All fields are harvested before deletion.
  const [name, org, issueMonth, issueYear, credentialId] = spec.split('|');
  await goto('details/certifications/');
  let credentialUrl = null;
  for (const a of await page.locator(`a[aria-label*="${name}"]`).all()) {
    let href = await a.getAttribute('href');
    if (!href || href.includes('linkedin.com/in/')) continue;
    // LinkedIn wraps external links in a /safety/go/?url=... redirect — unwrap it.
    const wrapped = href.match(/[?&]url=([^&]+)/);
    if (wrapped) href = decodeURIComponent(wrapped[1]);
    credentialUrl = href;
  }
  console.log(`      harvested credential URL: ${credentialUrl ?? 'none'}`);

  const hrefs = [];
  for (const a of await page.locator('a[href*="/details/certifications/edit/forms/"]').all()) {
    const href = await a.getAttribute('href');
    if (href && !href.includes('/new') && !hrefs.includes(href)) hrefs.push(href);
  }
  let deleted = false;
  for (const href of hrefs) {
    await page.locator(`a[href="${href}"]`).first().click();
    await page.waitForTimeout(2500);
    if (!(await dialog().isVisible().catch(() => false))) continue;
    // The cert name lives in the Name input's VALUE — textContent alone misses it.
    const values = [((await dialog().textContent()) ?? '').replace(/\s+/g, ' ')];
    for (const el of await dialog().locator('textarea, input, [contenteditable="true"]').all())
      values.push(await fieldValue(el));
    if (values.some((v) => v.includes(name))) {
      await page.screenshot({ path: path.join(shotsDir, 'certtop-before-delete.png') });
      await dialog()
        .locator('button, [role="button"]')
        .filter({ hasText: /delete|ștergeți/i })
        .first()
        .click();
      await page.waitForTimeout(1500);
      const confirm = dialog().locator('button, [role="button"]').filter({ hasText: /delete|ștergeți/i }).first();
      if (await confirm.isVisible().catch(() => false)) await confirm.click();
      await page.waitForTimeout(2500);
      deleted = true;
      break;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }
  if (!deleted) throw new Error(`Cert "${name}" not found to delete`);

  await goto('details/certifications/');
  await page.locator('a[href*="certifications/edit/forms/new"]').first().click();
  await page.waitForTimeout(2500);
  if (!(await dialog().isVisible().catch(() => false))) throw new Error('Add-cert form did not open');

  const inputs = await dialog().locator('input[type="text"]:visible, input:not([type]):visible').all();
  await setField(inputs[0], name);
  await setField(inputs[1], org);
  await page.waitForTimeout(1800);
  const orgOption = page.locator(`[role="option"]:has-text("${org}")`).first();
  if (await orgOption.isVisible().catch(() => false)) await orgOption.click();
  await page.waitForTimeout(800);
  const selects = await dialog().locator('select:visible').all();
  if (selects.length >= 2) {
    await selects[0].selectOption(String(Number(issueMonth))).catch(() => selects[0].selectOption({ index: Number(issueMonth) }));
    await selects[1].selectOption(issueYear).catch(() => {});
  }
  const inputsAfter = await dialog().locator('input[type="text"]:visible, input:not([type]):visible').all();
  if (credentialId && inputsAfter.length >= 3) await setField(inputsAfter[2], credentialId);
  if (credentialUrl && inputsAfter.length >= 4) await setField(inputsAfter[3], credentialUrl);
  await saveDialog(`certtop-${name.replace(/\W+/g, '-')}`);
}

async function setBanner(imagePath) {
  await goto();
  await page
    .locator('main button[aria-label*="background" i], main button[aria-label*="fundal" i]')
    .first()
    .click();
  await page.waitForTimeout(1800);
  await page.locator('[role="menu"]').getByText(/cover image|imaginea de fundal/i).first().click();
  await page.waitForTimeout(3500);
  if (!(await dialog().isVisible().catch(() => false)))
    throw new Error('Cover editor did not open');

  // The dialog's controls are NOT <button>s: "Change photo" is an <a>, Edit/Delete are
  // <div role="button">. Never use bare text clicks here — Delete is one slip away.
  const clickable = (re) =>
    dialog().locator('a, [role="button"], button').filter({ hasText: re }).first();

  await clickable(/change photo|schimbați fotografia/i).click();
  await page.waitForTimeout(3000);
  // "Change photo" opens an "Add a cover image" gallery; "Upload single photo" there
  // is what actually fires the file chooser.
  const chooserPromise = page.waitForEvent('filechooser', { timeout: 12000 }).catch(() => null);
  await clickable(/upload single photo|upload|încărc/i).click();
  const chooser = await chooserPromise;
  if (chooser) {
    await chooser.setFiles(imagePath);
  } else {
    await page.waitForTimeout(2500);
    const anyInput = page.locator('input[type="file"]');
    if (!(await anyInput.count().catch(() => 0)))
      throw new Error('No file chooser or file input appeared after Upload single photo');
    await anyInput.first().setInputFiles(imagePath);
  }
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(shotsDir, 'banner-crop.png') });

  // AI-generated images carry C2PA content credentials; LinkedIn shows a "Got it"
  // notice that becomes the last dialog and hijacks dialog()-scoped clicks.
  const gotIt = page.locator('button, [role="button"]').filter({ hasText: /got it|am înțeles/i }).first();
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(1000);
  }
  const editImageDialog = page
    .locator('dialog:visible, [role="dialog"]:visible')
    .filter({ has: page.locator('text=/save changes|salvați modificările/i') })
    .last();
  const saveChanges = editImageDialog
    .locator('a, [role="button"], button')
    .filter({ hasText: /save changes|salvați modificările/i })
    .first();
  if (await saveChanges.isVisible().catch(() => false)) await saveChanges.click();
  else await clickable(/save changes|salvați modificările|^\s*(apply|aplicați)\s*$/i).click();
  await page.waitForTimeout(4000);
  const save2 = clickable(/^\s*(save|salvați)\s*$/i);
  if (await save2.isVisible().catch(() => false)) {
    await save2.click();
    await page.waitForTimeout(3500);
  }
  await page.screenshot({ path: path.join(shotsDir, 'banner-after.png') });
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Row label of an association checkbox, shadow-DOM safe. label/aria resolve to the
// SECTION header ("Experience"), not the row — climb ancestors until the first line of
// innerText is something richer than a section name.
const checkboxLabel = (c) =>
  c.evaluate((el) => {
    const sections = /^(experience|education|projects|licenses|licențe|experiență|educație|proiecte)/i;
    let n = el;
    for (let i = 0; i < 6 && n; i++, n = n.parentElement) {
      const line = ((n.innerText || '').trim().split('\n')[0] || '').trim();
      if (line && !sections.test(line)) return line;
    }
    return '';
  });

async function skillToTop(name) {
  // The skills list has NO reorder control (verified July 2026: the per-skill edit form
  // holds only association checkboxes + Delete skill + Save). Order is newest-added
  // first, so topping a skill means delete + immediate re-add, restoring associations.
  // NEVER run this on a skill with endorsements or a passed-assessment badge — both are
  // lost on delete.
  await goto('details/skills/');
  // Per-skill edit anchors carry the skill name in aria-label in both UI languages
  // ("Edit X skill" / "Editați competența X"). The list lazy-loads: mouse.wheel does not
  // reach the scroll container, so scroll the last anchor into view each round instead.
  let anchor = null;
  for (let round = 0; round < 14 && !anchor; round++) {
    const cand = page.locator(`a[href*="/details/skills/edit/forms/"][aria-label*="${name}"]`).first();
    if (await cand.isVisible().catch(() => false)) { anchor = cand; break; }
    const anchors = await page.locator('a[href*="/details/skills/edit/forms/"]').all();
    if (anchors.length) await anchors[anchors.length - 1].scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(1200);
  }
  if (!anchor) throw new Error(`No edit anchor found for skill "${name}"`);
  await anchor.scrollIntoViewIfNeeded().catch(() => {});
  await anchor.click();
  await page.waitForTimeout(2500);
  if (!(await dialog().isVisible().catch(() => false))) throw new Error('Skill edit form did not open');
  const heading = ((await dialog().textContent()) ?? '').replace(/\s+/g, ' ');
  if (!heading.includes(name)) throw new Error(`Opened form is not for "${name}"`);

  // Harvest checked association labels before deleting.
  const assocLabels = [];
  for (const c of await dialog().getByRole('checkbox').all()) {
    if (await c.isChecked().catch(() => false)) {
      const label = ((await checkboxLabel(c)) ?? '').split('\n')[0].trim();
      if (label) assocLabels.push(label);
    }
  }
  console.log(`      harvested ${assocLabels.length} associations: ${assocLabels.join(' | ')}`);
  await page.screenshot({ path: path.join(shotsDir, `skilltop-${name.replace(/\W+/g, '-')}-before-delete.png`) });

  await dialog().locator('button, [role="button"]').filter({ hasText: /delete|șterge/i }).first().click();
  await page.waitForTimeout(1500);
  const confirm = dialog().locator('button, [role="button"]').filter({ hasText: /delete|șterge/i }).first();
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await page.waitForTimeout(2500);

  // Re-add: the add form is directly navigable.
  await goto('skills/edit/forms/new/');
  if (!(await dialog().isVisible().catch(() => false))) throw new Error('Add-skill form did not open');
  const field = dialog()
    .locator('input[type="text"], input:not([type]), input[role="combobox"], [role="combobox"]')
    .first();
  await field.fill(name);
  await page.waitForTimeout(1800);
  const exact = page
    .locator('[role="option"]')
    .filter({ hasText: new RegExp(`^\\s*${escRe(name)}\\s*$`) })
    .first();
  if (await exact.isVisible().catch(() => false)) await exact.click();
  else {
    const loose = page.locator(`[role="option"]:has-text("${name}")`).first();
    if (await loose.isVisible().catch(() => false)) await loose.click();
  }
  await page.waitForTimeout(1500);

  let restored = 0;
  for (const label of assocLabels) {
    const before = await checkedCount();
    const row = dialog().getByText(new RegExp(escRe(label), 'i')).first();
    if (!(await row.isVisible().catch(() => false))) {
      console.warn(`      association row not found on re-add: ${label}`);
      continue;
    }
    await row.click();
    await page.waitForTimeout(600);
    const after = await checkedCount();
    if (after > before) restored++;
    else if (after < before) {
      await row.click(); // undo an accidental uncheck
      await page.waitForTimeout(400);
    }
  }
  console.log(`      restored ${restored}/${assocLabels.length} associations`);
  await saveDialog(`skilltop-${name.replace(/\W+/g, '-')}`);
}

async function certAdd(spec) {
  const [name, org, issueMonth, issueYear, credentialId, credentialUrl] = spec.split('|');
  await goto('details/certifications/');
  await page.locator('a[href*="certifications/edit/forms/new"]').first().click();
  await page.waitForTimeout(2500);
  if (!(await dialog().isVisible().catch(() => false))) throw new Error('Add-cert form did not open');
  const inputs = await dialog().locator('input[type="text"]:visible, input:not([type]):visible').all();
  await setField(inputs[0], name);
  await setField(inputs[1], org);
  await page.waitForTimeout(1800);
  const orgOption = page.locator(`[role="option"]:has-text("${org}")`).first();
  if (await orgOption.isVisible().catch(() => false)) await orgOption.click();
  await page.waitForTimeout(800);
  const selects = await dialog().locator('select:visible').all();
  if (selects.length >= 2) {
    if (issueMonth)
      await selects[0]
        .selectOption(String(Number(issueMonth)))
        .catch(() => selects[0].selectOption({ index: Number(issueMonth) }));
    if (issueYear) await selects[1].selectOption(issueYear).catch(() => {});
  }
  const inputsAfter = await dialog().locator('input[type="text"]:visible, input:not([type]):visible').all();
  if (credentialId && inputsAfter.length >= 3) await setField(inputsAfter[2], credentialId);
  if (credentialUrl && inputsAfter.length >= 4) await setField(inputsAfter[3], credentialUrl);
  await saveDialog(`certadd-${name.replace(/\W+/g, '-')}`);
}

async function eduDelete(match) {
  await goto('details/education/');
  const hrefs = await collectAnchors('/details/education/edit/forms/');
  if (hrefs.length === 0) throw new Error('No education edit anchors found');
  for (const href of hrefs) {
    await page.locator(`a[href="${href}"]`).first().click();
    await page.waitForTimeout(2500);
    if (!(await dialog().isVisible().catch(() => false))) continue;
    // The school name lives in an input VALUE, not the dialog text.
    const values = [((await dialog().textContent()) ?? '').replace(/\s+/g, ' ')];
    for (const el of await dialog().locator('textarea, input, [contenteditable="true"]').all())
      values.push(await fieldValue(el));
    if (values.some((v) => v.includes(match))) {
      await page.screenshot({ path: path.join(shotsDir, `edudelete-${match.replace(/\W+/g, '-')}-before.png`) });
      await dialog().locator('button, [role="button"]').filter({ hasText: /delete|șterge/i }).first().click();
      await page.waitForTimeout(1500);
      const confirm = dialog().locator('button, [role="button"]').filter({ hasText: /delete|șterge/i }).first();
      if (await confirm.isVisible().catch(() => false)) await confirm.click();
      await page.waitForTimeout(2500);
      if (await dialog().isVisible().catch(() => false))
        throw new Error('Dialog still open after education delete — not confirmed');
      await page.screenshot({ path: path.join(shotsDir, `edudelete-${match.replace(/\W+/g, '-')}-after.png`) });
      return;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }
  throw new Error(`No education entry matching "${match}" found among ${hrefs.length} entries`);
}

const results = [];
for (const op of opList) {
  try {
    if (op === 'headline') await editHeadline();
    else if (op === 'about') await editAbout();
    else if (op.startsWith('exp:')) await editExperience(op.slice(4));
    else if (op.startsWith('editskill:')) await editSkill(op.slice(10));
    else if (op.startsWith('skill:')) await addSkill(op.slice(6));
    else if (op.startsWith('proj:')) await editProject(op.slice(5));
    else if (op.startsWith('projadd:')) await addProject(op.slice(8));
    else if (op.startsWith('featurepost:')) await featurePost(op.slice(12));
    else if (op.startsWith('featurelink:')) await featureLink(op.slice(12));
    else if (op.startsWith('banner:')) await setBanner(op.slice(7));
    else if (op.startsWith('topswap:')) await swapTopSkill(op.slice(8));
    else if (op.startsWith('otw:')) await editOpenToWork(op.slice(4));
    else if (op.startsWith('featuredelete:')) await deleteFeatured(op.slice(14));
    else if (op.startsWith('certtop:')) await certToTop(op.slice(8));
    else if (op.startsWith('skilltop:')) await skillToTop(op.slice(9));
    else if (op.startsWith('certadd:')) await certAdd(op.slice(8));
    else if (op.startsWith('edudelete:')) await eduDelete(op.slice(10));
    else throw new Error(`Unknown op ${op}`);
    results.push({ op, ok: true });
    console.log(`OK    ${op}`);
  } catch (err) {
    results.push({ op, ok: false, error: String(err?.message ?? err) });
    console.warn(`FAIL  ${op}: ${err?.message ?? err}`);
    await page.screenshot({ path: path.join(shotsDir, `FAIL-${op.replace(/\W+/g, '-')}.png`) }).catch(() => {});
    // Escape an open form; its confirm dialog's primary button is Discard, keeping the next op clean.
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(800);
    const confirmPrimary = dialog().locator('button.artdeco-button--primary').first();
    if (await confirmPrimary.isVisible().catch(() => false)) await confirmPrimary.click();
    await page.waitForTimeout(800);
  }
}

await context.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} succeeded. Screenshots: ${shotsDir}`);
if (failed.length) process.exit(3);
