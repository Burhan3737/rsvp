/**
 * Spacing and rhythm across all 126 theme x template combinations.
 *
 * Run: node scripts/spacing-audit.mjs           (server up on PORT, default 3000)
 *      node scripts/spacing-audit.mjs --theme anvaya
 *      node scripts/spacing-audit.mjs --shots    (also write PNGs)
 *
 * WHY THIS IS SEPARATE FROM THE CONTRAST SWEEP. `npm run sweep` answers "is anything unreadable,
 * overflowing, invisible or clipped" — hard, binary failures. It reported 1,008 of 1,008 page loads
 * clean while event cards on the default theme were rendering their text hard against the card's
 * left border, because asymmetric padding is not any of those four things. Spacing is the layer
 * below correctness: nothing is broken, and it still looks wrong.
 *
 * WHAT IT MEASURES, per combination, at two widths. Everything here is a number a human would
 * otherwise have to eyeball across 126 pages:
 *
 *   padSymmetry   left vs right padding on the blocks that carry text. A card with 24px on one
 *                 side and 0 on the other is the defect that prompted this file.
 *   tightText     text whose distance to its own container's edge is under a floor. Includes the
 *                 case where a child's box is wider than the parent's content box.
 *   rhythm        the vertical gaps between consecutive sections, and between a section's heading
 *                 and its first content. Wildly uneven gaps read as accidental.
 *   crowding      adjacent siblings whose boxes are closer than a few pixels — text touching text.
 *   runts         a line box narrower than a small fraction of its container, i.e. a single word
 *                 stranded on its own line.
 *
 * Output: `.data/spacing.json` with every measurement, a ranked summary to stdout, and with
 * `--shots`, `.data/shots/<theme>--<template>--<viewport>.png` for a human or a vision model.
 */

import { chromium, devices } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT ?? 3000;
const BASE = `http://127.0.0.1:${PORT}`;

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? true);
};

const THEMES = [
  ...readFileSync(path.join(process.cwd(), 'lib', 'themes.ts'), 'utf8').matchAll(/^\s{4}id: '([a-z-]+)',$/gm),
].map((m) => m[1]);
const TEMPLATES = [
  ...readFileSync(path.join(process.cwd(), 'lib', 'templates.ts'), 'utf8').matchAll(/^\s{4}id: '([a-z-]+)',$/gm),
].map((m) => m[1]);

const onlyTheme = arg('theme');
const themes = onlyTheme && onlyTheme !== true ? [onlyTheme] : THEMES;
const wantShots = Boolean(arg('shots'));

const TOKEN = JSON.parse(readFileSync(path.join(process.cwd(), '.data', 'tokens.json'), 'utf8'))[0].token;
const INVITE = `${BASE}/i/${TOKEN}`;

/** Everything measured in one pass, so the page is only laid out once. */
function measure() {
  const px = (v) => Math.round(parseFloat(v) || 0);
  const cs = (el) => getComputedStyle(el);
  const out = { padSymmetry: [], tightText: [], rhythm: {}, crowding: [], runts: [] };

  /* --- padding symmetry on anything that paints itself as a block ---------- */
  const blocks = document.querySelectorAll(
    '.schedule-item, .block, .faq-item, .story-beat, .party-member, .gifts-body, .welcome-note, .choice, .tally, .footer-inner',
  );
  for (const el of blocks) {
    const s = cs(el);
    if (s.display === 'none') continue;
    const l = px(s.paddingLeft);
    const r = px(s.paddingRight);
    // Only a FULL box counts — something with a ground or an edge on both sides, which is what
    // makes flush text look broken. A single-edge rule (split's 2px left tick, timeline's spine)
    // is asymmetric ON PURPOSE: the indent is the design, and there is no right-hand edge for the
    // text to sit against. Flagging those produced six findings per page of pure noise.
    const fullBox =
      (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)') ||
      (px(s.borderLeftWidth) > 0 && px(s.borderRightWidth) > 0);
    if (!fullBox) continue;
    const diff = Math.abs(l - r);
    // A deliberate gutter (a label column) is asymmetric on purpose and large; a broken reset is
    // asymmetric AND leaves one side at or near zero.
    if (diff >= 8 && Math.min(l, r) <= 4) {
      out.padSymmetry.push(`${el.className.toString().slice(0, 34)} L${l}/R${r}`);
    }
  }

  /* --- text too close to the edge that contains it ------------------------ */
  const FLOOR = 8;
  for (const el of blocks) {
    const s = cs(el);
    if (s.display === 'none') continue;
    const fullBox =
      (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)') ||
      (px(s.borderLeftWidth) > 0 && px(s.borderRightWidth) > 0);
    if (!fullBox) continue;
    const box = el.getBoundingClientRect();
    for (const child of el.children) {
      // A timeline node is an absolutely positioned dot that sits OUTSIDE its item on purpose;
      // measuring it against the item's edges reported L-39/R469 and similar nonsense.
      const ccs = cs(child);
      if (ccs.position === 'absolute' || ccs.position === 'fixed') continue;
      const c = child.getBoundingClientRect();
      if (c.width < 2 || c.height < 2) continue;
      const left = Math.round(c.left - box.left);
      const right = Math.round(box.right - c.right);
      if (left < FLOOR || right < FLOOR) {
        out.tightText.push(
          `${el.className.toString().slice(0, 26)} > ${child.tagName.toLowerCase()} L${left}/R${right}`,
        );
      }
    }
  }

  /* --- vertical rhythm ----------------------------------------------------- */
  const sections = [...document.querySelectorAll('main > section.section')];
  const gaps = [];
  for (let i = 1; i < sections.length; i++) {
    const a = sections[i - 1].getBoundingClientRect();
    const b = sections[i].getBoundingClientRect();
    // Sections butt against each other and carry their own padding, so the real gap between
    // CONTENT is the two paddings plus any margin.
    gaps.push(
      Math.round(b.top - a.bottom) +
        px(cs(sections[i - 1]).paddingBottom) +
        px(cs(sections[i]).paddingTop),
    );
  }
  out.rhythm.sectionGaps = gaps;
  out.rhythm.sectionPadTop = sections[0] ? px(cs(sections[0]).paddingTop) : 0;

  const headToBody = [];
  for (const title of document.querySelectorAll('.section-title')) {
    const next = title.nextElementSibling;
    if (!next) continue;
    const g = Math.round(next.getBoundingClientRect().top - title.getBoundingClientRect().bottom);
    if (g >= 0) headToBody.push(g);
  }
  out.rhythm.headingToBody = headToBody;

  /* --- siblings whose boxes touch ------------------------------------------ */
  for (const parent of document.querySelectorAll('.schedule-body, .shell, .blocks, .faq, .party, .story')) {
    const kids = [...parent.children].filter((k) => {
      const r = k.getBoundingClientRect();
      return r.height > 2 && cs(k).display !== 'none';
    });
    for (let i = 1; i < kids.length; i++) {
      const a = kids[i - 1].getBoundingClientRect();
      const b = kids[i].getBoundingClientRect();
      if (Math.abs(a.left - b.left) > 40) continue; // different columns, not stacked
      // Two boxes touching is only crowding if the TEXT is crowded. A tile with its own
      // padding-block, or a rule between rows, gives the reader the space; the boxes meeting is
      // how a stack of bordered rows is supposed to look.
      const pad =
        px(cs(kids[i - 1]).paddingBottom) +
        px(cs(kids[i]).paddingTop) +
        px(cs(kids[i]).borderTopWidth);
      const gap = Math.round(b.top - a.bottom) + pad;
      // Actually touching, not merely close. A 6px gap between a 12px label and the heading it
      // introduces is how a label is supposed to sit; an 8px floor reported 744 of those across
      // the matrix and buried the handful of real collisions.
      if (gap <= 1 && gap > -40) {
        out.crowding.push(
          `${kids[i - 1].tagName.toLowerCase()}.${kids[i - 1].className.toString().slice(0, 20)} → ${kids[i].tagName.toLowerCase()} ${gap}px`,
        );
      }
    }
  }

  /* --- a single word stranded on its own last line ------------------------- */
  for (const el of document.querySelectorAll('.schedule-blurb, .block-body, .faq-a, .story-body, .welcome-note, .prose p')) {
    const s = cs(el);
    if (s.display === 'none') continue;
    const range = document.createRange();
    range.selectNodeContents(el);
    const lines = [...range.getClientRects()].filter((r) => r.width > 0);
    if (lines.length < 2) continue;
    const width = el.getBoundingClientRect().width;
    const last = lines[lines.length - 1];
    // A short last line is ordinary typography. A runt is one stranded word: narrow in absolute
    // terms as well as relative, on a paragraph wide enough that it had room not to be.
    if (width > 260 && last.width < 70 && last.width / width < 0.12) {
      out.runts.push(`${el.className.toString().slice(0, 28)} last line ${Math.round(last.width)}/${Math.round(width)}`);
    }
  }

  for (const k of ['padSymmetry', 'tightText', 'crowding', 'runts']) {
    out[k] = [...new Set(out[k])].slice(0, 8);
  }
  return out;
}

const browser = await chromium.launch();
const rows = [];
if (wantShots) mkdirSync('.data/shots', { recursive: true });

for (const [vpName, vpOpts] of [
  ['desktop', { viewport: { width: 1440, height: 900 } }],
  ['mobile', devices['iPhone 13']],
]) {
  const ctx = await browser.newContext({ ...vpOpts, baseURL: BASE });
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const theme of themes) {
    for (const template of TEMPLATES) {
      await ctx.addCookies([
        { name: 'preview_theme', value: theme, domain: '127.0.0.1', path: '/' },
        { name: 'preview_template', value: template, domain: '127.0.0.1', path: '/' },
      ]);
      await page.goto(INVITE, { waitUntil: 'networkidle' });

      const m = await page.evaluate(measure);
      // Runts are recorded but not scored. `text-wrap: pretty` is already applied to this text, so
      // what remains is a function of the words and the measure rather than a defect anyone can
      // fix in CSS — and 112 unfixable findings would drown the ones that matter.
      const score = m.padSymmetry.length * 4 + m.tightText.length * 3 + m.crowding.length * 2;
      rows.push({ theme, template, viewport: vpName, score, ...m });

      if (wantShots && score > 0) {
        await page.evaluate(() => document.querySelector('#schedule')?.scrollIntoView());
        await page.waitForTimeout(120);
        await page.screenshot({
          path: path.join('.data', 'shots', `${theme}--${template}--${vpName}.png`),
        });
      }

      if (score > 0) {
        const bits = [
          m.padSymmetry.length ? `${m.padSymmetry.length} lopsided` : '',
          m.tightText.length ? `${m.tightText.length} tight` : '',
          m.crowding.length ? `${m.crowding.length} touching` : '',
          m.runts.length ? `${m.runts.length} runt` : '',
        ].filter(Boolean);
        console.log(`  ${theme}/${template} ${vpName}: ${bits.join(', ')}`);
      }
    }
    console.log(`${theme} ${vpName} done`);
  }
  await ctx.close();
}

await browser.close();
mkdirSync('.data', { recursive: true });
writeFileSync('.data/spacing.json', JSON.stringify(rows, null, 1));

const bad = rows.filter((r) => r.score > 0);
console.log(`\n${rows.length} combinations measured, ${bad.length} with spacing findings.`);

if (bad.length) {
  const byTheme = new Map();
  const byTemplate = new Map();
  for (const r of bad) {
    byTheme.set(r.theme, (byTheme.get(r.theme) ?? 0) + r.score);
    byTemplate.set(r.template, (byTemplate.get(r.template) ?? 0) + r.score);
  }
  console.log('\nWorst themes:');
  for (const [t, n] of [...byTheme].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${t.padEnd(15)} ${n}`);
  console.log('\nWorst templates:');
  for (const [t, n] of [...byTemplate].sort((a, b) => b[1] - a[1])) console.log(`  ${t.padEnd(15)} ${n}`);
  console.log('\nFull detail in .data/spacing.json');
  process.exitCode = 1;
} else {
  console.log('Nothing found.');
}
