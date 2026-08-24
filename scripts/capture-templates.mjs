/**
 * Template screenshots, for the distinctness audits.
 *
 * One theme is held constant (`anvaya` by default) so that the images show STRUCTURE and nothing
 * else. If two templates look alike here, they are alike — no palette is doing the separating.
 *
 * THE 16384px TRAP. Round 6 of the audit found that every previous `*--mobile--full.png` was blank
 * below native row 16384: Chromium's surface cap. At the iPhone 13's device scale factor of 3 that
 * is 5,461 CSS pixels, and classic's phone page is 13,587 — so travel, the wedding party, the FAQ
 * and gifts had never appeared in the mobile evidence at all, for five of the seven templates. Four
 * rounds of auditors were shown white space and asked to judge it.
 *
 * Full-page shots are therefore taken at `deviceScaleFactor: 1`, which puts the cap at 16,384 CSS
 * pixels — above the tallest page here — while the fold shots keep the real DSF so that type
 * rendering is honest where it is actually being looked at. The script fails loudly if any page is
 * still too tall for its surface rather than writing a truncated image.
 */

import { chromium, devices } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT ?? 3000;
const BASE = `http://127.0.0.1:${PORT}`;
const THEME = process.env.THEME ?? 'anvaya';
const OUT = path.join('screenshots', 'templates');

const TEMPLATES = ['classic', 'rail', 'timeline', 'split', 'card', 'boxed', 'gate'];
const SURFACE_CAP = 16384;

const TOKEN = JSON.parse(readFileSync('.data/tokens.json', 'utf8'))[0].token;
const iphone = devices['iPhone 13'];

const VIEWPORTS = [
  { key: 'desktop', fold: { viewport: { width: 1440, height: 900 } }, full: { viewport: { width: 1440, height: 900 } } },
  // Same viewport for both, different scale factors — see the note above.
  { key: 'mobile', fold: iphone, full: { ...iphone, deviceScaleFactor: 1 } },
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const tooTall = [];

for (const vp of VIEWPORTS) {
  for (const [kind, opts] of [
    ['fold', vp.fold],
    ['full', vp.full],
  ]) {
    const ctx = await browser.newContext({ ...opts, baseURL: BASE });
    const page = await ctx.newPage();

    for (const t of TEMPLATES) {
      await page.goto(`${BASE}/find`);
      await page.evaluate(
        ([template, theme]) => {
          document.cookie = `preview_template=${template}; path=/`;
          document.cookie = `preview_theme=${theme}; path=/`;
        },
        [t, THEME],
      );
      await page.goto(`${BASE}/i/${TOKEN}`, { waitUntil: 'networkidle' });

      if (kind === 'full') {
        const { height, dsf } = await page.evaluate(() => ({
          height: document.documentElement.scrollHeight,
          dsf: window.devicePixelRatio,
        }));
        if (height * dsf > SURFACE_CAP) {
          tooTall.push(`${t} ${vp.key}: ${height}px x ${dsf} = ${Math.round(height * dsf)} > ${SURFACE_CAP}`);
        }
      }

      const file = path.join(OUT, `${t}--${vp.key}--${kind}.png`);
      await page.screenshot({ path: file, fullPage: kind === 'full' });
      console.log(file);
    }

    await ctx.close();
  }
}

await browser.close();

if (tooTall.length) {
  console.error('\nTRUNCATED — these images do not show the whole page:');
  for (const line of tooTall) console.error(`  ${line}`);
  process.exit(1);
}
