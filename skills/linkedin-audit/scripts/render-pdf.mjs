#!/usr/bin/env node
// Render an audit REPORT.md (or any markdown file) to a print-quality PDF.
// Usage: node render-pdf.mjs <report.md> [out.pdf]
// Uses the same browser resolution order as capture-profile.mjs: system Chrome,
// then Edge, then Playwright's bundled Chromium (page.pdf requires headless).

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { marked } from "marked";

const [, , mdPath, outArg] = process.argv;
if (!mdPath) {
  console.error("Usage: node render-pdf.mjs <report.md> [out.pdf]");
  process.exit(1);
}
const outPath = outArg || mdPath.replace(/\.md$/i, "") + ".pdf";

const markdown = await readFile(mdPath, "utf8");
const body = marked.parse(markdown, { gfm: true });

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  :root { --ink: #111; --accent: #FFE600; --muted: #6b6b66; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    color: var(--ink); font-size: 11.5px; line-height: 1.55;
    margin: 0; padding: 0;
  }
  h1 {
    font-size: 21px; letter-spacing: -0.02em; margin: 0 0 4px;
    padding: 14px 16px; background: var(--accent);
    border: 3px solid var(--ink); box-shadow: 5px 5px 0 var(--ink);
  }
  h1 + p { margin-top: 14px; }
  h2 {
    font-size: 15px; text-transform: uppercase; letter-spacing: 0.04em;
    border-bottom: 3px solid var(--ink); padding-bottom: 4px; margin: 26px 0 10px;
    page-break-after: avoid;
  }
  h3 {
    font-size: 12.5px; margin: 18px 0 6px;
    page-break-after: avoid;
  }
  p { margin: 6px 0; }
  strong { font-weight: 700; }
  table {
    border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 11px;
    page-break-inside: avoid;
  }
  th, td { border: 1.5px solid var(--ink); padding: 4px 8px; text-align: left; vertical-align: top; }
  th { background: var(--accent); text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.04em; }
  tr:nth-child(even) td { background: #faf9f2; }
  ul, ol { margin: 6px 0; padding-left: 22px; }
  li { margin: 3px 0; }
  code {
    font-family: ui-monospace, Consolas, monospace; font-size: 10.5px;
    background: #f4f3ea; border: 1px solid #ddd; padding: 0 3px;
  }
  pre { background: #f4f3ea; border: 1.5px solid var(--ink); padding: 8px 10px; overflow: hidden; white-space: pre-wrap; }
  blockquote { border-left: 4px solid var(--accent); margin: 8px 0; padding: 2px 12px; color: var(--muted); }
  hr { border: none; border-top: 2px solid var(--ink); margin: 18px 0; }
  h3 { page-break-inside: avoid; }
</style>
</head>
<body>${body}</body>
</html>`;

async function launchBrowser() {
  for (const channel of ["chrome", "msedge"]) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch {
      /* channel not installed — try the next option */
    }
  }
  return chromium.launch({ headless: true });
}

const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: outPath,
    format: "A4",
    printBackground: true,
    margin: { top: "14mm", bottom: "16mm", left: "13mm", right: "13mm" },
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `
      <div style="width:100%; font-size:8px; color:#6b6b66; padding:0 13mm; display:flex; justify-content:space-between;">
        <span>${path.basename(mdPath)}</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`,
  });
  console.log(`PDF written: ${path.resolve(outPath)}`);
} finally {
  await browser.close();
}
