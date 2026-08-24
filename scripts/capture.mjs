#!/usr/bin/env node
/**
 * Design-review screenshot harness.
 * Usage: node scripts/capture.mjs --base http://127.0.0.1:3100 --out screenshots/round-1 --routes "/,/schedule,/rsvp"
 * Captures full-page + above-the-fold shots at desktop and mobile for each route.
 */
import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const base = arg('base', 'http://127.0.0.1:3100').replace(/\/$/, '');
const outDir = arg('out', 'screenshots/latest');
const routes = arg('routes', '/').split(',').map((r) => r.trim()).filter(Boolean);
// Optional theme override, applied via the same preview cookie the /themes picker uses.
const theme = arg('theme', '');

// Never put the token in a filename: it changes on every reseed and silently breaks every
// downstream reference to the shot.
const slug = (r) => {
  if (r === '/') return 'home';
  const m = r.match(/^\/i\/[^/]+(\/.*)?$/);
  if (m) return 'invite' + (m[1] ? m[1].replace(/\//g, '-') : '');
  return r.replace(/^\//, '').replace(/[\/?=&]/g, '-');
};

const viewports = [
  { key: 'desktop', opts: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 } },
  { key: 'mobile', opts: { ...devices['iPhone 13'] } },
];

const run = async () => {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const failures = [];

  for (const vp of viewports) {
    const ctx = await browser.newContext({ ...vp.opts, reducedMotion: 'no-preference' });
    if (theme) {
      const { hostname } = new URL(base);
      await ctx.addCookies([{ name: 'preview_theme', value: theme, domain: hostname, path: '/' }]);
    }
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(String(e)));

    for (const route of routes) {
      const url = `${base}${route}`;
      try {
        const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
        if (res && res.status() >= 400) failures.push(`${url} -> HTTP ${res.status()}`);
        // let entrance animations settle
        await page.waitForTimeout(1400);
        // scroll through to trigger any reveal-on-scroll, then return to top
        await page.evaluate(async () => {
          const step = window.innerHeight * 0.8;
          for (let y = 0; y < document.body.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 220));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(900);

        const stem = path.join(outDir, `${theme ? theme + '--' : ''}${slug(route)}--${vp.key}`);
        await page.screenshot({ path: `${stem}--fold.png` });
        // `scale: 'css'` for the full-page shot, deliberately.
        // At deviceScaleFactor 2 a long invitation renders a 22,000px-tall image, which exceeds
        // Chromium's capture surface: the tail comes back BLANK WHITE. A reviewer then reports the
        // last section as empty, which is a finding about the harness, not the page. Capturing the
        // full page at CSS scale halves the height and the tail is real again.
        await page.screenshot({ path: `${stem}--full.png`, fullPage: true, scale: 'css' });
        console.log(`captured ${vp.key} ${route}`);
      } catch (err) {
        failures.push(`${url} [${vp.key}] -> ${err.message}`);
        console.error(`FAILED ${vp.key} ${route}: ${err.message}`);
      }
    }
    if (consoleErrors.length) {
      console.error(`console errors (${vp.key}):`);
      [...new Set(consoleErrors)].slice(0, 20).forEach((e) => console.error('  - ' + e));
    }
    await ctx.close();
  }

  await browser.close();
  if (failures.length) {
    console.error('\nCAPTURE FAILURES:\n' + failures.map((f) => '  - ' + f).join('\n'));
    process.exit(1);
  }
  console.log(`\nAll shots written to ${outDir}`);
};

run();
