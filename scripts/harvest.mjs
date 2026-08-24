#!/usr/bin/env node
/**
 * Harvest a live template: pull the HTML, follow its stylesheets, and extract the real colour and
 * type values. Copying from a page beats approximating from a description.
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const TARGETS = [
  // Awwwards Site of the Day — a real couple's site, type-led, forest green.
  ['veleyross', 'https://veleyross.wedding/'],
  // Bliss & Bone published templates. blissandbone.com/preview/<x> is only chrome; the real
  // server-rendered site is myblissandbone.com/<slug>, with its own styles.css.
  ['alessia', 'https://myblissandbone.com/alessia'],
  ['avril', 'https://myblissandbone.com/avril'],
  ['aspen', 'https://myblissandbone.com/aspen'],
  ['kelsey', 'https://myblissandbone.com/kelsey'],
  // Purpose-built for South Asian multi-event weddings; ships a full named design-token set.
  ['anvaya', 'https://anvaya.love/'],
];

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' };

const get = async (url) => {
  const res = await fetch(url, { headers: UA, redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
};

const abs = (href, base) => { try { return new URL(href, base).href; } catch { return null; } };

for (const [name, url] of TARGETS) {
  try {
    const html = await get(url);
    mkdirSync(`.data/harvest/${name}`, { recursive: true });
    writeFileSync(`.data/harvest/${name}/page.html`, html);

    // Stylesheets
    const sheets = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)]
      .map((m) => m[0].match(/href=["']([^"']+)["']/i)?.[1])
      .filter(Boolean).map((h) => abs(h, url)).filter(Boolean);

    let css = '';
    // Bliss & Bone exposes /<slug>/styles.css directly; try it whether or not it is linked.
    const dir = url.endsWith('/') ? url : url + '/';
    try {
      css += String.fromCharCode(10) + (await get(new URL('styles.css', dir).href));
    } catch {
      /* not that shape */
    }
    for (const s of sheets.slice(0, 8)) {
      try { css += '\n/* ' + s + ' */\n' + (await get(s)); } catch { /* some 403 */ }
    }
    // Inline <style> blocks carry the theme kit on WP/Elementor sites.
    for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) css += '\n' + m[1];
    writeFileSync(`.data/harvest/${name}/styles.css`, css);

    // Block colours set INLINE in the page.
    //
    // All four Bliss & Bone templates keep their section block colours in inline styles, not in the
    // stylesheet — so a CSS-only census misses them entirely, and three colours were invented to
    // fill the gap and then written into comments as harvested fact. Read the page too.
    const inlineCounts = new Map();
    for (const m of html.matchAll(/#([0-9a-fA-F]{6})/g)) {
      const h = m[1].toLowerCase();
      inlineCounts.set(h, (inlineCounts.get(h) ?? 0) + 1);
    }
    const inlineTop = [...inlineCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);

    // Colour frequency
    const counts = new Map();
    for (const m of css.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
      let h = m[1].toLowerCase();
      if (h.length === 3) h = h.split('').map((c) => c + c).join('');
      counts.set(h, (counts.get(h) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22);

    // CSS custom properties (Webflow exposes the whole palette this way)
    const vars = [...css.matchAll(/(--[a-z0-9-]*(?:color|colour|brand|neutral|primary|secondary|action|background|text|grey|gray|white|black|accent|pink|green|orange|yellow)[a-z0-9-]*)\s*:\s*([^;]{1,40});/gi)]
      .map((m) => `${m[1]}: ${m[2].trim()}`);

    // Fonts.
    //
    // A bare `font-family:` sweep is NOT enough and reading it as the answer produced real errors.
    // Every Bliss & Bone template SELF-HOSTS its faces in @font-face blocks and then refers to them
    // by name, so a naive sweep returned literally one family — `bootstrap-icons` — and four rounds
    // of type decisions were argued from evidence the harvest did not contain. Pull the @font-face
    // names, and pull the family that each structural selector actually resolves to.
    const faces = [...new Set(
      [...css.matchAll(/@font-face\s*\{[^}]*?font-family\s*:\s*["']?([^;"'}]+)["']?\s*;[^}]*\}/gi)]
        .map((m) => m[1].trim()),
    )];
    const families = [...new Set([...css.matchAll(/font-family\s*:\s*([^;}"']+)/gi)].map((m) => m[1].trim()))];
    const googleLinks = [...new Set([...html.matchAll(/fonts\.googleapis\.com[^"']+/gi)].map((m) => m[0]))];

    /**
     * What one selector actually declares, taking the LAST rule that sets it.
     *
     * Deliberately a scanner rather than a regex: building the selector into a RegExp means
     * escaping `.` and `[` for every call site, and the escaping is where this went wrong the
     * first time. Walk the rule blocks instead.
     */
    const declFor = (sel, prop) => {
      let last = null;
      let i = 0;
      while (i < css.length) {
        const open = css.indexOf('{', i);
        if (open === -1) break;
        const close = css.indexOf('}', open);
        if (close === -1) break;
        const head = css.slice(css.lastIndexOf('}', open - 1) + 1, open);
        const body = css.slice(open + 1, close);
        const selectors = head.split(',').map((t) => t.trim().toLowerCase());
        if (selectors.includes(sel.toLowerCase())) {
          for (const decl of body.split(';')) {
            const c = decl.indexOf(':');
            if (c === -1) continue;
            if (decl.slice(0, c).trim().toLowerCase() === prop) last = decl.slice(c + 1).trim();
          }
        }
        i = close + 1;
      }
      return last;
    };

    // Which colour is the PAGE and which is the TYPE. A frequency census counts declarations, not
    // painted area, and cannot tell a foreground from a background — reading `#e0d8cb x56` as "the
    // ground" when it is the body TEXT colour inverted a whole theme for a round.
    const grounds = [
      ['html background', declFor('html', 'background') ?? declFor('html', 'background-color')],
      ['body background', declFor('body', 'background') ?? declFor('body', 'background-color')],
      ['body color', declFor('body', 'color')],
    ].filter(([, v]) => v);

    const roles = [];
    for (const sel of ['body', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', '.button', 'input']) {
      const parts = [];
      for (const prop of ['font-family', 'font-size', 'font-weight', 'letter-spacing', 'color']) {
        const v = declFor(sel, prop);
        if (v) parts.push(`${prop}: ${v}`);
      }
      // `font:` shorthand is how Bliss & Bone writes most of these.
      const short = declFor(sel, 'font');
      if (short) parts.push(`font: ${short}`);
      if (parts.length) roles.push(`  ${sel}  ->  ${parts.join(' · ')}`);
    }

    // Structure: headings and nav in document order
    const headings = [...html.matchAll(/<h([1-4])[^>]*>([\s\S]{0,140}?)<\/h\1>/gi)]
      .map((m) => `h${m[1]}: ${m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()}`)
      .filter((t) => t.length > 5).slice(0, 40);

    const report = [
      `# ${name}`, url, '',
      '## Top colours (frequency)',
      ...top.map(([h, n]) => `  #${h}  x${n}`),
      '', '## CSS custom properties',
      ...[...new Set(vars)].slice(0, 40).map((v) => '  ' + v),
      '', '## Block colours, from the PAGE (inline styles — not in the stylesheet)',
      ...(inlineTop.length ? inlineTop.map(([h, n]) => `  #${h}  x${n}`) : ['  (none)']),
      '', '## Which colour is the GROUND, and which is the TYPE',
      '   (frequency counts declarations, not painted area — read these, not the census above)',
      ...(grounds.length ? grounds.map(([k, v]) => `  ${k}: ${v}`) : ['  (none declared)']),
      '', '## @font-face — the faces the template actually ships',
      ...(faces.length ? faces.map((f) => '  ' + f) : ['  (none — the faces are linked, see below)']),
      '', '## What each structural selector resolves to',
      ...(roles.length ? roles : ['  (none found)']),
      '', '## font-family declarations (raw sweep)',
      ...families.slice(0, 25).map((f) => '  ' + f),
      '', '## Google Fonts requests',
      ...googleLinks.slice(0, 6).map((f) => '  ' + f),
      '', '## Headings in document order',
      ...headings.map((h) => '  ' + h),
    ].join('\n');

    writeFileSync(`.data/harvest/${name}/report.txt`, report);
    console.log(`${name}: ${html.length} bytes html, ${css.length} bytes css, ${top.length} colours, ${headings.length} headings`);
  } catch (err) {
    console.error(`${name}: FAILED ${err.message}`);
  }
}
