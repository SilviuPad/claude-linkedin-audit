import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [htmlPath, outPath] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1584, height: 396 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.resolve(htmlPath)).href);
await page.waitForTimeout(800);
await page.screenshot({ path: path.resolve(outPath), clip: { x: 0, y: 0, width: 1584, height: 396 } });
await browser.close();
console.log('rendered', outPath);
