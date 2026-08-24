import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = 'http://127.0.0.1:3100';
const token = process.argv[2];
const outDir = 'screenshots/sections';

const run = async () => {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  for (const theme of ['marry-monday', 'alessia', 'avril', 'aspen', 'kelsey', 'anvaya']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    await ctx.addCookies([{ name: 'preview_theme', value: theme, domain: '127.0.0.1', path: '/' }]);
    const page = await ctx.newPage();
    await page.goto(`${base}/i/${token}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Playwright scrolls a tall element to capture it, which drags position:sticky children down the
    // frame and makes them look like they are overlapping content. That is a capture artefact, not
    // the real layout, so pin them static for the shot only.
    await page.addStyleTag({
      content:
        '.schedule-day-header, .viewing-bar { position: static !important; }' +
        // position:fixed ornament (the nocturne card frame) is painted at viewport coordinates, so
        // in a tall element screenshot it appears as a stray rectangle across the content.
        ' body::after { display: none !important; }',
    });
    await page.waitForTimeout(300);

    // The schedule is the heart of the page — capture it framed rather than as a 28,000px strip.
    const sched = page.locator('#schedule');
    await sched.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await sched.screenshot({ path: `${outDir}/${theme}--schedule.png` });

    const faq = page.locator('#faq');
    if (await faq.count()) {
      await faq.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await faq.screenshot({ path: `${outDir}/${theme}--faq.png` });
    }
    console.log('sections for', theme);
    await ctx.close();
  }
  await browser.close();
};
run();
