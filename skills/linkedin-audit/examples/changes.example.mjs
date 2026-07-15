// Template change set for scripts/edit-profile.mjs.
// Copy into your audit directory, fill in real values, and pass its path as the first argument:
//   node scripts/edit-profile.mjs <path/to/changes.mjs> headline about exp:Acme skill:React.js
//
// Only include the sections you intend to change — every op you run must have
// a matching entry here. `currentSnippet` / `match` values are substrings used
// to locate the existing content before replacing it.
export default {
  profileUrl: 'https://www.linkedin.com/in/your-profile/',

  headline: {
    currentSnippet: 'part of the current headline, used to verify the right field',
    text: 'Software Developer | Java | Spring | React.js | delivering customer-focused solutions',
  },

  about: {
    currentSnippet: 'first words of the current About section',
    text: `New About text.
Multiple paragraphs are fine — this replaces the whole section.`,
  },

  experiences: [
    {
      match: 'Acme', // company name as it appears in the experience entry's own edit form
      text: `New description for the Acme role.

- Quantified bullet one.
- Quantified bullet two.`,
    },
  ],

  // For the `skill:<name>` op (adds NEW skills; existing skills silently no-op — use editskill: instead).
  skills: ['Next.js', 'TypeScript'],

  // For the `proj:<match>` op — rewrite an existing project.
  projects: [
    {
      match: 'substring of the current project title',
      name: 'New Project Title',
      text: 'New project description with stack and outcome.',
    },
  ],

  // For the `projadd:<nameFragment>` op — add a new project.
  projectAdds: [
    {
      name: 'My Case Study',
      text: 'What it is, the stack, and a link.',
    },
  ],
};
