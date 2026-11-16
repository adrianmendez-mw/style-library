// Capture a screenshot for the library.
// Usage:
//   node tools/shot.mjs <url> <slug> [--full] [--selector ".hero"] [--width 1440]
// Saves shots/<slug>.jpg. Then set "image": "shots/<slug>.jpg" on the entry.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const [url, slug, ...rest] = process.argv.slice(2);
if (!url || !slug) {
  console.error('Usage: node tools/shot.mjs <url> <slug> [--full] [--selector ".hero"] [--width 1440]');
  process.exit(1);
}
const flag = name => { const i = rest.indexOf(name); return i === -1 ? null : rest[i + 1] ?? true; };
const width = Number(flag("--width")) || 1440;
const selector = flag("--selector");
const full = rest.includes("--full");

await mkdir("shots", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1500); // let load-in animations settle
const path = `shots/${slug}.jpg`;
if (selector) await page.locator(selector).first().screenshot({ path, type: "jpeg", quality: 82 });
else await page.screenshot({ path, type: "jpeg", quality: 82, fullPage: full });
await browser.close();
console.log(`Saved ${path}`);
