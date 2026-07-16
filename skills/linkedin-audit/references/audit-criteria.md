# LinkedIn Audit Rubric

Source: recruiter-focused "LINKEDIN AUDIT" course notes. Governing principle: **a recruiter spends 6–10 seconds on a profile before deciding whether to invest more**. The first line of hiring is almost always a non-technical recruiter, so every section must communicate value that a non-technical reader understands. Secondary principles that recur across sections: **don't bury the lede** (best content first, always), **quantify** (real numbers, not "several" or "20+"), and **show what you can do today**, not what you aspire to.

Score each section 0–10. 0 = section missing or actively harmful; 5 = present but generic; 10 = fully meets the criteria below. When a section is empty on the profile, that is a finding (usually 0–2), not a skipped row.

## 1. Banner image (visual — check the screenshot)

- Not generic filler (trees, abstract art, default LinkedIn blue). Generic = wasted real estate.
- Best use: call-to-action content — portfolio URL, email, website, a one-line value statement.
- Red flag: default banner (scores ≤2).

## 2. Profile photo (visual — check the screenshot)

- Professional appearance: dressed as they would for an office/networking event.
- **Bright** — meaning colorful, not just well-lit. The photo thumbnail in LinkedIn search results is tiny; a bright/high-contrast background (even AI-replaced) makes it pop instead of blending in.
- Good lighting, face front and center.
- No current-employer logo or branding in the photo (or banner) — the profile markets the person, not their employer, and it dates instantly on departure.
- Red flags: no photo (0), casual/dark/cluttered photo, subject small in frame.

## 3. Headline

The three S's: **short, sweet, specific**. This is the profile's main SEO surface.

- Uses **common industry titles** ("Software Developer"), never internal/quirky ones ("Software Builder", "Code Ninja").
- Conveys what they can do **today** — "Aspiring X" is a red flag (recruiters search for skills they can hire now).
- Pipe format is the recommended pattern: `Software Developer | Java | Spring | React.js | delivering customer-focused solutions` — title first, then top searchable skills, optionally a short value clause.
- **Max ~110 characters** — that's roughly what search results and mobile show before truncation. Count it; over the cap means the tail (usually the value clause) is invisible where it matters.
- Skills in the headline should match the **target role's** most-searched terms.
- Red flags: only a company title, "aspiring/future/wannabe", no skills, a paragraph-length headline.

## 4. About section

- **Concise**: if LinkedIn truncates it behind "…see more", it is probably too long. No college essays, no autobiography — its only job is to make the reader want a conversation.
- Demonstrates competency in context: "developed the front end using React and TypeScript to enhance customer experience" beats a list of nouns.
- **No keyword soup** — a wall of comma-separated technologies hurts both SEO and the human reader (scores ≤3).
- Written so a **non-technical recruiter** understands the impact; if a recruiter gets it, an engineer will too.
- **Passes the say-it-out-loud test** — no "passionate professional with a proven track record", no "I sit at the intersection of…", no ChatGPT cadence. If a sentence wouldn't be said in a coffee chat, it reads as filler (and recruiters increasingly discount AI-sounding About text). Apply the same test to any rewrite you propose.
- A direct contact line (email) at the end is a judgment call: it lets recruiters skip the InMail wall, but it also invites scraping/spam. Flag its absence as an option, not a defect — ask the user's preference.
- Covers: what they do, key technologies *in context of what they built*, and the value orientation (customer-first, business needs).

## 5. Featured section

- Exists and is curated — it's the only section where the user dictates what's valuable. Missing entirely: ≤2.
- Showcases **finished work / solved problems**, not things currently being learned.
- Prefers **text posts with a bright image and a hook first line** ("My website kept breaking because of X…") over external links — links (GitHub included) navigate recruiters *off* the profile and they may not come back. GitHub is for the technical reviewer later in the pipeline, not the recruiter doing the first pass.
- At least one of their most impressive projects should appear here, not only in the Projects section.

## 6. Work experience

- **3–5 bullet points per role** (more only for very long tenures).
- **Best bullet first** in every role — don't bury the lede at bullet three.
- Bullets describe **problems solved and contributions**, not job duties ("responsible for…" is a duty; "reduced checkout errors by rewriting validation" is a contribution).
- **Quantified with real numbers**: "several pages" → "9 pages"; "20+" → the actual number; percentages, counts, survey scores. Vague quantities score ≤5 even if the content is otherwise good.
- Non-tech roles still count when written as contributions ("translated disgruntled-customer requests into business requirements") — relevant for career changers.
- **Timeline red flags**: positions under ~6 months read as failed stints — flag them and advise reframing (contract engagement, project-based) or removal; overlapping full-time dates between roles create doubt and need an explanation or a fix.
- Titles should reflect the **target role's market language**, not the employer's internal label — "Software Engineer II" at a no-name company undersells against "Senior Frontend Engineer" if that's what the work was.
- Each role should use LinkedIn's **per-role skills tagging** (the skills line under the description) for its relevant technologies — it feeds recruiter-search relevance per position. A role showing no skills line is a finding (and fixable via the `editskill:` op).

## 7. Volunteering

- Present as its own section (it never expires — old volunteering still counts).
- Describes **what the organization does**, not just its name — don't assume the reader knows the charity.
- Missing volunteering is a mild gap (5–6 if everything else is strong), not a failure.

## 8. Education

- More than just the degree line: student associations, extracurriculars, workshops led.
- **No Udemy/short-course certificates in Education** — that's overcompensating and it backfires; they belong in Licenses & Certifications. Presence here: ≤4.
- No degree is fine — the answer is a strong Projects section, not padding Education.

## 9. Projects

- **Descriptive titles**: "A simple CRUD application" or "Employee tracker" discounts the work — if you discount yourself before the conversation, others will match that energy. Titles should carry the problem or the impact.
- Descriptions explain the problem, the solution, and the technologies in context.
- The single most impressive project should *also* be in Featured.

## 10. Licenses & Certifications

- Heavyweight certs first: AWS / GCP / Azure / vendor certifications that were genuinely hard to earn.
- Don't bury them under a stack of Udemy/LinkedIn Learning certificates — ordering is the whole game here.
- Lightweight certs are fine to include, just never on top.

## 11. Skills & Recommendations

- Skills **ordered for the target role**: if the role needs Java most, Java is #1. WordPress on top of a full-stack-Java profile: instant finding.
- Skills use **common search terms**, not niche synonyms.
- **At least ~25 technical skills listed** — the skills list is a search index; a thin list simply matches fewer recruiter queries. Under 25 is a finding with specific suggestions drawn from tech already evidenced elsewhere on the profile.
- **No soft skills in the skills list** (Teamwork, Critical Thinking, Time Management…) — they dilute the technical signal and match no recruiter search worth ranking for. Their presence is an instant finding.
- **Ecosystem guard before recommending removals**: check how the profile's stacks relate before pruning — a niche-looking tool that belongs to one of their 1–2 primary ecosystems stays. Only flag skills from a genuinely unrelated specialty; fewer than 3 removals is normal, zero is fine.
- Endorsements on the top skills add credibility (others vouching beats self-reporting).
- **At least 2 written recommendations.** Zero recommendations after years of professional work reads as a yellow flag to recruiters ("nobody would vouch for them?") — and the empty section simply doesn't render, so the profile silently loses a credibility surface.

## 12. Activity / Posts

- Some original posting on a steady cadence — roughly **one quality post every ~2 weeks**. Daily posting and virality are non-goals; LinkedIn's algorithm surfaces quality older posts.
- Posts should share process and complete thoughts (problem → solution → why), which doubles as Featured-section material.
- **Repost ratio red flag**: an activity feed that is overwhelmingly reposts buries the user's own voice — "an employer may as well hire the person you're reposting from."
- Obvious generative-AI filler content is a red flag: confident-but-wrong or generic text misaligned with the person's real background undermines trust.

## 13. Profile mechanics

Small settings that gate search placement and inbound quality; all checkable from the capture except where noted.

- **Custom profile URL**: `linkedin.com/in/firstname-lastname`, no default random digits. The trailing-numbers URL reads as a neglected profile and looks worse everywhere it's pasted (resume, email signature).
- **Open to Work mode**: the public green `#OpenToWork` photo ring signals desperation and lowers inbound quality — it should be **recruiters-only**. The green ring is visible on the captured photo; if it's absent, the recruiters-only setting can't be seen externally — ask the user which mode is set rather than assuming. Job-title targets in the setting should match the target role (fixable via the `otw:` op).
- **Connections ≥ 500**: LinkedIn displays "500+" as a threshold and surfaces larger networks more in search. Under it, the concrete advice is connecting with recruiters and engineers at target companies, not indiscriminate adding.
- **Language/locale consistency**: profile sections shouldn't mix languages unintentionally (relevant for bilingual profiles — the reader should get one coherent language per surface).

## Scoring the report

- Overall = sum of the 13 sections, out of 130.
- The Top 5 actions should be picked by *recruiter impact*, not by lowest score: headline and photo/banner problems outrank a weak volunteering section every time, because they gate the 6–10-second first impression and search placement.
- Every rewrite must be grounded in what the profile actually contains. Never fabricate numbers, employers, or credentials; use `[X]` placeholders where the user must supply the real figure.
