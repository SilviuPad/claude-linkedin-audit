# claude-linkedin-audit

Audit your LinkedIn profile the way a recruiter reads it — then fix it, from Claude Code.

A Claude Code skill that captures your **live** LinkedIn profile with Playwright (using a login session that never leaves your machine), scores it against a 12-section recruiter-focused rubric, writes a prioritized report with concrete rewrites, and — after your explicit approval — applies the changes directly to your profile.

![linkedin-audit architecture](assets/architecture.svg)

## What it does

- **Capture** — visits your profile plus every detail page (experience, education, skills, certifications, projects, recommendations, featured, volunteering, activity), expands "see more", and saves extracted text, full-page screenshots, and a URL manifest.
- **Score** — 12 sections, 0–10 each (120 total), against a rubric built on one principle: *a recruiter spends 6–10 seconds deciding whether your profile is worth more time.* Banner and photo are judged from the screenshots, not just text.
- **Report** — `REPORT.md` with a scorecard, top-5 actions ordered by impact, and for every finding a quote of what the profile says now plus the actual rewritten replacement — never "make it more specific".
- **Apply** — 15+ Playwright edit operations: headline, About, experience descriptions, skills (add + associate with positions), Top-skills showcase swaps, projects (rewrite + add), Featured (posts, links, deletes), certification reordering, open-to-work titles, and banner upload (with a deterministic HTML→PNG banner renderer). Every op screenshots before/after and is verified by re-capture.

The edit layer encodes months of hard-won LinkedIn DOM knowledge: shadow-DOM edit modals, server-side language flipping (all selectors are bilingual), lazy-loaded detail pages, silent no-op saves, and geometric button matching where aria-labels lie.

## Install

### Plugin marketplace (recommended)

```
/plugin marketplace add SilviuPad/claude-linkedin-audit
/plugin install linkedin-audit@silviupad-claude-linkedin-audit
```

### Manual (as a user-level skill)

```bash
git clone --depth 1 https://github.com/SilviuPad/claude-linkedin-audit.git
cp -r claude-linkedin-audit/skills/linkedin-audit ~/.claude/skills/
cd ~/.claude/skills/linkedin-audit/scripts && npm install
```

The capture script prefers your system Chrome/Edge. If neither is installed: `npx playwright install chromium`.

## First run

Ask Claude Code to audit your LinkedIn profile. It will:

1. Ask for your profile URL and target role (saved to `config.json` so it never asks again).
2. Open a **visible** browser window — log in to LinkedIn manually, once. The session is stored in `.browser-profile/` inside the skill directory and reused on every later run.
3. Capture, score, and write the report into `audits/<date>/`.

Edits are a separate, explicit step: Claude drafts a change set (`CHANGES.md` + `changes.mjs`), shows it to you, and only runs `edit-profile.mjs` after you approve the exact text.

## Privacy & responsible use

- Your login session, captures, and reports stay in the skill directory on your machine. Nothing is sent anywhere.
- The skill audits **your own profile** (or one you explicitly manage) — one profile per run. It is not a scraping tool; don't point it at other people's profiles.
- Browser automation of LinkedIn may conflict with LinkedIn's Terms of Service. You're driving your own logged-in browser at human speed, but use it at your own discretion and risk.

## Repository layout

```
.claude-plugin/          marketplace.json + plugin.json
skills/linkedin-audit/
  SKILL.md               the skill: workflow, rubric pointers, edit-op reference
  references/
    audit-criteria.md    the full 12-section scoring rubric
  scripts/
    capture-profile.mjs  Playwright capture (profile + 9 detail pages)
    edit-profile.mjs     15+ edit operations with verify + screenshots
    render-banner.mjs    deterministic 1584×396 banner rendering
  examples/
    changes.example.mjs  template change set for edit-profile.mjs
  config.example.json    profile URL + target role template
assets/                  animated architecture diagram
```

## Runtime artifacts (never committed)

`config.json`, `.browser-profile/` (your session), `audits/` (your captures and reports), and `node_modules/` are created at runtime inside the skill directory and are gitignored.

## License

MIT
