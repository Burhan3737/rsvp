/**
 * The 18 x 7 sweep.
 *
 * Run: node scripts/sweep-matrix.mjs        (server must be up on PORT, default 3000)
 *      node scripts/sweep-matrix.mjs --theme goundry    (one theme)
 *      node scripts/sweep-matrix.mjs --quick            (desktop only)
 *
 * WHY THIS EXISTS. Theme and template are independent axes: 18 palettes, 7 structures, 126
 * combinations a guest could be shown. Every test in the suite measures exactly ONE of them —
 * whichever pair happens to be live in the database. Two real defects got through that gap in a
 * single week:
 *
 *   - `card` quieted the attire block with `opacity: 0.86`. Opacity composites against whatever is
 *     behind it, so the contrast it produces depends on the ground, and the ground is the THEME's
 *     decision. On 17 themes it was fine. On `goundry` — the one mid-tone coloured page in the set
 *     — it put 27 WCAG AA failures on the dress code, the most-read block in the schedule.
 *
 *   - A Postgres `date` came back as a Date object while the type said string. Invisible until one
 *     specific form read it directly, at which point it silently erased the wedding date.
 *
 * Both were invisible on the default pair. Neither was a subtle judgement call — each was a hard,
 * measurable failure sitting in plain sight in a combination nothing ever loaded.
 *
 * WHAT IT CHECKS, per combination, at two widths:
 *   contrast   axe-core's colour-contrast rule only. This is the check that catches paint applied
 *              over a ground it was never tested against.
 *   overflow   the document scrolling sideways — a structure that does not fit a palette's type.
 *   invisible  text whose colour matches what is painted behind it, which axe reports as a pass
 *              when the computed values happen to be identical.
 *   clipped    an element whose content box is shorter than the text inside it.
 *
 * Output: a table to stdout, and the full detail as JSON so a fix can be checked against it.
 */

import { chromium, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT ?? 3000;
const BASE = `http://127.0.0.1:${PORT}`;

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? true);
};

const source = readFileSync(path.join(process.cwd(), 'lib', 'themes.ts'), 'utf8');
const THEMES = [...source.matchAll(/^\s{4}id: '([a-z-]+)',$/gm)].map((m) => m[1]);

const templateSource = readFileSync(path.join(process.cwd(), 'lib', 'templates.ts'), 'utf8');
const TEMPLATES = [...templateSource.matchAll(/^\s{4}id: '([a-z-]+)',$/gm)].map((m) => m[1]);

const onlyTheme = arg('theme');
const themes = onlyTheme && onlyTheme !== true ? [onlyTheme] : THEMES;
const viewports = arg('quick')
  ? [['desktop', { viewport: { width: 1440, height: 900 } }]]
  : [
      ['desktop', { viewport: { width: 1440, height: 900 } }],
      ['mobile', devices['iPhone 13']],
    ];

const TOKEN = JSON.parse(readFileSync(path.join(process.cwd(), '.data', 'tokens.json'), 'utf8'))[0].token;

/**
 * The guest-facing routes, all of which inherit the theme and the template.
 *
 * The first version of this sweep checked the invitation page alone. That is the longest page and
 * the one with the most paint on it, but it is not where a guest TYPES. The reply form carries every
 * interactive control in the product — text inputs, radios, checkboxes, a select, the submit — and
 * each of those has its own foreground, its own border and its own placeholder, none of which
 * appear on the invitation page at all. It had been seen on one of the 126 combinations.
 *
 * `/find` matters for the same reason at a smaller scale: it is the way in for somebody holding a
 * printed card, so it is the first thing they see, and it is one input and one button.
 */
const ROUTES = [
  ['invite', `${BASE}/i/${TOKEN}`],
  ['rsvp', `${BASE}/i/${TOKEN}/rsvp`],
  ['find', `${BASE}/find`],
  ['home', `${BASE}/`],
];

/**
 * Text painted in the colour of the thing behind it.
 *
 * axe scores this as a PASS — identical foreground and background give a contrast ratio it treats
 * as a non-issue rather than the worst possible one — so it needs its own check. Walks up for the
 * first ancestor that actually paints, because a transparent parent is not the background.
 */
function invisibleText() {
  const painted = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      node = node.parentElement;
    }
    return getComputedStyle(document.documentElement).backgroundColor;
  };

  const out = [];
  for (const el of document.body.querySelectorAll('*')) {
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join('');
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (cs.color === painted(el)) {
      out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} "${text.slice(0, 30)}"`);
    }
  }
  return [...new Set(out)];
}

/** An element whose box is materially shorter than the text it contains. */
function clippedText() {
  const out = [];
  for (const el of document.body.querySelectorAll('h1, h2, h3, h4, p, li, dt, dd, a, button, summary')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.overflow === 'visible') continue;
    if (el.scrollHeight > el.clientHeight + 4 && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll') {
      out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} ${el.scrollHeight}>${el.clientHeight}`);
    }
  }
  return [...new Set(out)].slice(0, 6);
}

/**
 * Form controls a guest cannot see the edge of, or type into legibly.
 *
 * A text input is the one element whose BORDER carries meaning — it is what says "type here" — and
 * a border is not text, so no contrast rule looks at it. WCAG asks for 3:1 on the visual boundary
 * of a control. An input whose border matches its own fill is a rectangle a guest has to guess at,
 * and it passes every automated check in this project.
 */
function unreadableFields() {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a] = m[1].split(',').map((n) => parseFloat(n));
    return a === 0 ? null : [r, g, b];
  };
  const lum = (rgb) => {
    const s = rgb.map((v) => v / 255).map((u) => (u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4)));
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  };
  const ratio = (a, b) => {
    const x = lum(a);
    const y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  const out = [];
  for (const el of document.querySelectorAll('input, select, textarea')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.type === 'hidden') continue;

    const border = parse(cs.borderTopColor);
    if (!border || parseFloat(cs.borderTopWidth) === 0) continue;

    // The ground the border is drawn against: the field's own fill, else the first painted ancestor.
    let ground = parse(cs.backgroundColor);
    if (!ground) {
      let node = el.parentElement;
      while (node && !ground) {
        ground = parse(getComputedStyle(node).backgroundColor);
        node = node.parentElement;
      }
    }
    if (!ground) continue;

    const r = ratio(border, ground);
    if (r < 3) {
      out.push(`${el.tagName.toLowerCase()}[${el.type ?? ''}] border ${r.toFixed(2)}:1`);
    }
  }
  return [...new Set(out)].slice(0, 6);
}

const browser = await chromium.launch();
const findings = [];
let checked = 0;

for (const [vpName, vpOpts] of viewports) {
  const ctx = await browser.newContext({ ...vpOpts, baseURL: BASE });
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const theme of themes) {
    for (const template of TEMPLATES) {
      await ctx.addCookies([
        { name: 'preview_theme', value: theme, domain: '127.0.0.1', path: '/' },
        { name: 'preview_template', value: template, domain: '127.0.0.1', path: '/' },
      ]);
      for (const [routeName, url] of ROUTES) {
        await page.goto(url, { waitUntil: 'networkidle' });
        checked++;

        const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
        const contrast = results.violations.flatMap((v) =>
          v.nodes.map((n) => ({
            target: n.target.join(' ').slice(0, 90),
            detail:
              (n.failureSummary || '').replace(/\s+/g, ' ').match(/contrast of ([\d.]+)/)?.[1] ?? '?',
          })),
        );

        const overflow = await page.evaluate(
          () => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        );
        const invisible = await page.evaluate(invisibleText);
        const clipped = await page.evaluate(clippedText);
        const fields = await page.evaluate(unreadableFields);

        if (contrast.length || overflow > 1 || invisible.length || clipped.length || fields.length) {
          findings.push({
            theme, template, viewport: vpName, route: routeName,
            contrast, overflow, invisible, clipped, fields,
          });
          const bits = [
            contrast.length ? `${contrast.length} contrast` : '',
            overflow > 1 ? `${overflow}px sideways` : '',
            invisible.length ? `${invisible.length} invisible` : '',
            clipped.length ? `${clipped.length} clipped` : '',
            fields.length ? `${fields.length} field` : '',
          ].filter(Boolean);
          console.log(`  ${theme}/${template} ${vpName} ${routeName}: ${bits.join(', ')}`);
        }
      }
    }
    console.log(`${theme} ${vpName} done`);
  }

  await ctx.close();
}

await browser.close();

mkdirSync('.data', { recursive: true });
writeFileSync('.data/sweep.json', JSON.stringify(findings, null, 1));

/* ------------------------------------------------------------------- summary */

const byTheme = new Map();
const byTemplate = new Map();
for (const f of findings) {
  const weight =
    f.contrast.length +
    f.invisible.length * 3 +
    (f.overflow > 1 ? 2 : 0) +
    f.clipped.length +
    (f.fields?.length ?? 0) * 2;
  byTheme.set(f.theme, (byTheme.get(f.theme) ?? 0) + weight);
  byTemplate.set(f.template, (byTemplate.get(f.template) ?? 0) + weight);
}

console.log(`\n${checked} page loads checked across ${themes.length * TEMPLATES.length} combinations, ${findings.length} with findings.`);

if (findings.length) {
  const byRoute = new Map();
  for (const f of findings) byRoute.set(f.route, (byRoute.get(f.route) ?? 0) + 1);
  console.log('\nBy route:');
  for (const [r, n] of [...byRoute].sort((a, b) => b[1] - a[1])) console.log(`  ${r.padEnd(10)} ${n}`);
}

if (findings.length) {
  console.log('\nWorst themes:');
  for (const [t, n] of [...byTheme].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`  ${t.padEnd(16)} ${n}`);
  }
  console.log('\nWorst templates:');
  for (const [t, n] of [...byTemplate].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t.padEnd(16)} ${n}`);
  }
  console.log('\nFull detail in .data/sweep.json');
  process.exitCode = 1;
} else {
  console.log('Nothing found.');
}
