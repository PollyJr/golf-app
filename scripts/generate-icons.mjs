// Renders the PNG app icons from the flag mark. Run it after changing the
// mark or the brand colours:
//
//   node scripts/generate-icons.mjs
//
// It needs Playwright with Chromium, which is a tool on the developer's
// machine and deliberately not a dependency of the app. The generated files
// in public/icons are committed.
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
/** @type {import("playwright")} */
const { chromium } = require("playwright");

const BRAND = "#0f3b2a";
const ACCENT = "#c9f04b";
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

// The mark of src/components/brand.tsx on its 48×48 grid; it is about 35 wide
// and 30 high, centred near (23.5, 23).
const MARK = `
  <path d="M8 36c8-6 17-6.5 26-2.2 2.4 1.1 4.4 1.2 6 .5"/>
  <path d="M20 36.5V10"/>
  <path d="M22.5 11h16l-4.8 5.25 4.8 5.25h-16z" fill="${ACCENT}" stroke="none"/>`;

/**
 * @param {object} options
 * @param {number} options.radius  corner radius on the 512 grid; 0 is full bleed
 * @param {number} options.scale   size of the mark; 7.4 fills about half the icon
 */
function iconSvg({ radius, scale }) {
  const x = 256 - 23.5 * scale;
  const y = 256 - 23 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="${BRAND}"/>
  <g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${ACCENT}" stroke-width="3.6" stroke-linecap="round">${MARK}
  </g>
</svg>`;
}

const ICONS = [
  // "any" icons keep the rounded square and transparent corners.
  { file: "icon-192.png", size: 192, radius: 116, scale: 7.4, transparent: true },
  { file: "icon-512.png", size: 512, radius: 116, scale: 7.4, transparent: true },
  // Maskable: full bleed, with the mark inside the central safe zone.
  { file: "maskable-512.png", size: 512, radius: 0, scale: 5.8, transparent: false },
  // iOS applies its own mask and does not support transparency.
  { file: "apple-touch-icon.png", size: 180, radius: 0, scale: 6.6, transparent: false },
];

const browser = await chromium.launch();
try {
  for (const icon of ICONS) {
    const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size }, deviceScaleFactor: 1 });
    const svg = iconSvg(icon).replace("<svg ", `<svg width="${icon.size}" height="${icon.size}" `);
    await page.setContent(`<!doctype html><html><body style="margin:0;background:${icon.transparent ? "transparent" : BRAND}">${svg}</body></html>`);
    const png = await page.screenshot({ omitBackground: icon.transparent, clip: { x: 0, y: 0, width: icon.size, height: icon.size } });
    await writeFile(path.join(outDir, icon.file), png);
    await page.close();
    console.log(`icons: wrote ${icon.file} (${icon.size}×${icon.size})`);
  }
} finally {
  await browser.close();
}
