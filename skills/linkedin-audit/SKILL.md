---
name: linkedin-audit
description: Audit a LinkedIn profile against a recruiter-focused rubric (banner, photo, headline, About, Featured, Experience, Education, Projects, Certifications, Skills, Recommendations, Activity, profile mechanics) and produce a scored report with concrete rewrites. Captures the live profile with Playwright using a locally stored login session. Use this whenever the user mentions their LinkedIn profile, wants a LinkedIn audit or review, asks why recruiters aren't reaching out, wants help with their headline / About section / banner, or asks to improve their LinkedIn presence — even if they don't say the word "audit".
---

# LinkedIn Profile Audit

Capture the user's LinkedIn profile with Playwright, score it against `references/audit-criteria.md`, and deliver a prioritized improvement report. The rubric is built on one principle: a recruiter spends 6–10 seconds deciding whether a profile is worth more time, so every section must lead with value.

**Scope note:** this skill is for auditing the *user's own* profile (or one they explicitly manage). Do not use it to mass-collect other people's profiles — one profile per run, personal use.

## Workflow

### 1. Load config

Read `config.json` in this skill's directory. It looks like:

```json
{
  "profileUrl": "https://www.linkedin.com/in/example/",
  "targetRole": "Software Developer",
  "targetMarket": "US remote",
  "yearsOfExperience": 8
}
```

- If the file is missing or `profileUrl`/`targetRole` is empty, ask the user, then save the file so future runs don't ask again. `targetMarket` and `yearsOfExperience` are optional — ask once if absent, accept "skip".
- If the user names a different role or URL in their request, use that for this run (and ask whether to update the saved default).
- The target role matters: headline SEO, skill ordering, and keyword checks are all judged relative to it. Target market calibrates conventions (US-remote vs. European norms differ on titles and keywords); years of experience calibrates the seniority language of rewrites.

### 2. Ensure dependencies (first run only)

The capture script lives in `scripts/` and needs Playwright:

```bash
cd <skill-dir>/scripts && npm install
```

The script prefers the system Chrome/Edge (no browser download needed). If neither is installed, run `npx playwright install chromium` in `scripts/`.

### 3. Capture the profile

```bash
node <skill-dir>/scripts/capture-profile.mjs "<profileUrl>" "<skill-dir>/audits/<yyyy-mm-dd>"
```

Behavior you should relay to the user before running:

- A **visible browser window opens**. On the first run LinkedIn will show a login page — the user logs in manually; the script waits (up to 5 minutes) and continues automatically once the profile loads.
- The session is stored in `<skill-dir>/.browser-profile/` and reused on later runs, so login is one-time. It never leaves the machine.
- The script visits the main profile plus the detail pages (experience, education, skills, certifications, projects, recommendations, featured, volunteering, recent activity), expands "see more" text, and saves for each: extracted text (`*.txt`), a full-page screenshot (`*.png`), and a `manifest.json` recording final URLs.

If a detail page redirects back to the main profile, that section is empty — the manifest marks it `redirected: true`. Treat those as missing sections in the audit (missing Featured or Recommendations is itself a finding, not a capture failure).

If the capture fails entirely (LinkedIn blocks the automation, captcha loops), fall back: ask the user to open their profile in their own browser, press Ctrl+S ("Webpage, Complete"), and give you the saved file path. Audit from that HTML plus whatever screenshots they can provide.

### 4. Audit

Read `references/audit-criteria.md` — it contains the full rubric, scoring guidance, red flags, and example rewrites. Then:

1. Read every captured `.txt` file and the manifest.
2. **Look at the screenshots** — the banner and profile-photo checks (generic vs. call-to-action banner, bright/professional photo) are visual and cannot be judged from text.
3. Score each of the 13 sections 0–10 per the rubric.
4. For every finding, quote what the profile currently says and write a concrete replacement — not "make it more specific" but the actual rewritten headline, bullet, or About paragraph. Ground rewrites in facts found on the profile; never invent employers, numbers, or credentials. Where a quantified bullet needs a number the profile doesn't state, put `[X]` and tell the user to fill it in.

### 5. Report

Write `REPORT.md` into the audit output directory using exactly this structure, then give the user a short inline summary (overall score, top 3 actions) and the report path.

```markdown
# LinkedIn Profile Audit — <name> (<date>)
Target role: <role>

## Scorecard
| # | Section | Score | Verdict |
|---|---------|-------|---------|
(13 rows; Verdict is one short clause, e.g. "keyword soup — trim to 4 lines")

**Overall: <n>/130**

## Top 5 actions
(ordered by impact; each one sentence, imperative)

## Section findings
### <section name> — <score>/10
**Now:** <quote or screenshot observation>
**Why it matters:** <one sentence tied to the rubric>
**Do this:** <concrete rewrite or action>
(repeat for each section with a score below 9; sections scoring 9–10 get a single "keep as is" line)
```

### 6. PDF report (the deliverable)

The **PDF is what the user gets**; `REPORT.md` stays as the machine-readable source (the edit flow reads it). After writing `REPORT.md`, always render the PDF:

1. **Preferred — the `report-pdf` skill** ([sergiubut/claude-report-pdf](https://github.com/sergiubut/claude-report-pdf) by Sergiu B). If it appears in the available skills, invoke it on `<audit-dir>/REPORT.md` — it produces a branded, mobile-optimized PDF (flat slide pages with clickable links).
2. **Fallback — bundled renderer**, when report-pdf is not installed:

```bash
node <skill-dir>/scripts/render-pdf.mjs <audit-dir>/REPORT.md
```

Writes `REPORT.pdf` next to the markdown (A4, styled scorecard table, page numbers; works on any markdown file, so `CHANGES.md` exports the same way).

In the closing summary, give the user the **PDF path** as the report; mention `REPORT.md` only as the source it was rendered from.

## Editing the profile (apply fixes)

`scripts/edit-profile.mjs` applies changes to the live profile. **Never run it without the user approving the exact text first** — draft the change set, show it (write a CHANGES.md into the audit dir), and get explicit sign-off; this is their public professional identity. Ground every claim in the user's source material and respect any provenance rules it contains.

```bash
node <skill-dir>/scripts/edit-profile.mjs <changes.mjs> <op...>
```

`changes.mjs` is an ES module default-exporting `{ profileUrl, headline: {currentSnippet, text}, about: {currentSnippet, text}, experiences: [{match, text}], skills: [...] }` (see `examples/changes.example.mjs` for a template). Ops:

- `headline`, `about` — replace those fields.
- `exp:<companyMatch>` — replace an experience description. Entries are identified by opening each edit form and checking its own field values for the company name (ancestor-text matching breaks at shadow-DOM boundaries).
- `skill:<name>` — add a NEW skill. If the skill already exists LinkedIn silently no-ops: the form closes, the op reports OK, and nothing is saved — a false positive. Use `editskill:` for existing skills.
- `editskill:<name>@<position>` — associate an EXISTING skill with a position (e.g. `editskill:React.js@Acme`), the fix for a role showing no skills line. Opens each skill's edit form (paginated list is auto-scrolled), matches the name against the form heading, clicks the position row, and verifies a checkbox actually became checked before saving. Caveat: if the association already exists, the row click would UNCHECK it — the checked-count guard aborts rather than saves in that case.
- `proj:<match>` — rewrite an existing project's name + description (from `changes.projects: [{match, name, text}]`). Fixes raw-URL project titles.
- `projadd:<nameFragment>` — add a new project (from `changes.projectAdds: [{name, text}]`) via the directly navigable `edit/forms/project/new/` overlay.
- `featurepost:<textSnippet>` — feature one of the user's own posts: Featured page → overflow menu (bilingual aria-label `overflow|depășire`) → "Add a post" picker → clicks the Feature button geometrically nearest below the post matching the snippet.
- `featurelink:<url>` — add a link to Featured via the overflow menu's "Add a link" dialog (fill URL → Add → Save). LinkedIn's preview fetcher routinely rejects apex domains and paths with "Please enter a valid link" — the `www.` form has worked every time it happened; try it before concluding the site is unfetchable.
- `topswap:<remove>@<add>` — swap a skill in the 5-capped "Top skills" showcase (inside the About edit overlay at `edit/forms/summary/new/`; per-skill remove buttons carry the skill name in their aria-label). The added skill must already exist in the general skills list.
- `otw:remove=A,B;add=C,D` — edit Open-to-work job titles at `opportunities/job-opportunities/edit/`. Titles MUST come from LinkedIn's fixed taxonomy — free text never commits (e.g. "Senior Frontend Engineer" does not exist; "Senior Web Developer" does). Probe candidates in the typeahead before assuming. Two form variants alternate (Add-title button + typeahead vs. always-visible chips input). Removal matches aria-label by substring — remove before adding, or "Frontend Developer" will match a "Senior Frontend Developer" chip.
- `featuredelete:<textMatch>` — delete a Featured card matched by its visible text. The card's own Delete sits BELOW its title — match with positive vertical distance only, or you'll click the previous card's control. The op verifies the card is gone afterwards; deletes have silently no-opped.
- `certtop:<name>|<org>|<issueMonth>|<issueYear>|<credentialId>` — put a certification on top. Certs display newest-ADDED first with no reorder control, so this deletes and immediately re-adds. It harvests the credential URL first (LinkedIn wraps external links in `/safety/go/?url=...` — unwrap before reuse) and matches the cert by form FIELD VALUES, not dialog text (the name lives in an input).
- `banner:<pngPath>` — upload a cover image. Flow: banner pencil (`aria-label` `background|fundal`) → menu item "Edit cover image"/"Editați imaginea de fundal" inside `[role="menu"]` → "Change photo" → "Upload single photo" (fires the file chooser) → "Save changes" → final "Save". Critical: the cover dialog's controls are NOT `<button>`s ("Change photo" is an `<a>`, Edit/Delete are `<div role="button">`) — always select `a, [role="button"], button` there, and never bare-text-click near Delete. Generate the image deterministically at exactly 1584×396 with `scripts/render-banner.mjs <banner.html> <out.png>` (crisp text beats image models; keep the bottom-left quadrant empty for the profile photo overlap).
- `all` — headline + about + all experiences + all skills from changes.mjs.

Each op screenshots before/after save into `<audit-dir>/edits/`. Run ops in small batches and **verify by re-capturing** — script "OK" means the dialog closed, not that LinkedIn persisted the change.

Hard-won DOM facts (July 2026): edit modals are shadow-DOM web components (no artdeco classes; fields are `[contenteditable]` divs; filter dialogs with `:visible` — hidden video.js `<dialog>`s coexist). The UI language flips between the account language and English per request — it's server-side, so pinning the browser locale does NOT stop it; never select on visible text or aria-labels except bilingually (e.g. `overflow|depășire`, `save|salvați`, `add|adăugați`). Detail pages (`details/experience`, `details/skills`) lazy-load ~10 items; scroll-collect before concluding something is missing. The "Top skills" showcase under About is capped at 5 and edited via a separate form (`edit/forms/summary/new/`) — swaps there are quickest done manually. Saving the intro form can normalize the visible location string — warn the user.

## Files

- `references/audit-criteria.md` — the 12-section rubric. Read it in full before scoring; do not audit from memory.
- `scripts/capture-profile.mjs` — Playwright capture. Takes `<profileUrl> <outDir>`.
- `scripts/edit-profile.mjs` — applies approved changes (see "Editing the profile").
- `scripts/company-edit.mjs` — edits a LinkedIn company page the user admins (Details + Buttons sections). The constants at the top are dummy examples — set the real admin URL, description, and website before running, and get the same explicit sign-off as for profile edits.
- `scripts/probe.mjs` — dumps a LinkedIn page's visible text (`node probe.mjs <url>`); selector-debugging helper.
- `scripts/render-pdf.mjs` — renders `REPORT.md` (or any markdown) to PDF via headless Chrome.
- `config.json` — saved profile URL + target role (created on first run).
- `.browser-profile/` — persistent LinkedIn session (local only; delete it to log out).
- `audits/` — one dated folder per run: captures + `REPORT.md`.
