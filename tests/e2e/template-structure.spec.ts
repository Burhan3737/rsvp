import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Structure, checked mechanically.
 *
 * A THEME is paint; a TEMPLATE is structure. This suite exists because three rounds of blind audit
 * returned the same verdict about the eighteen themes — "one skeleton, six paint jobs" — and the
 * fix was to make structure a separate axis. What has to stay true is that the axis is real: the
 * templates must actually differ from one another in the DOM, not only in CSS.
 *
 * The comparison is deliberately structural: section order, which sections exist, and the layout
 * class the schedule renders under. Two templates that agree on all three are the same template
 * wearing two names.
 */

const TOKENS: { token: string }[] = JSON.parse(
  readFileSync(path.join(process.cwd(), '.data', 'tokens.json'), 'utf8'),
);
const INVITE = `/i/${TOKENS[0].token}`;

const TEMPLATES = ['classic', 'rail', 'timeline', 'split', 'card', 'boxed', 'gate'];

/** The section ids in the order the page renders them, plus how the schedule is laid out. */
async function shapeOf(page: Page, template: string) {
  await page.goto('/themes');
  await page.evaluate((id) => {
    document.cookie = `preview_template=${id}; path=/`;
  }, template);
  await page.goto(INVITE);

  return page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll('main > section[id], main > section'))
      .map((s) => s.id)
      .filter(Boolean);
    const schedule = document.querySelector('.schedule');
    const layout = schedule
      ? (Array.from(schedule.classList).find((c) => c.startsWith('schedule-')) ?? '')
      : '';
    const nav = document.querySelector('.anchor-nav');
    return {
      sections,
      layout,
      hasNav: Boolean(nav),
      // Absent counts as not shown. Falling back to <body> here reported every template as having
      // a nav, because a body is display:block.
      navShown: Boolean(nav) && getComputedStyle(nav!).display !== 'none',
    };
  });
}

test.describe('structure is a real axis, not a second set of colours', () => {
  test('no two templates render the same shape', async ({ page }) => {
    const shapes = new Map<string, string>();
    for (const t of TEMPLATES) {
      const s = await shapeOf(page, t);
      // Order matters: two templates with the same sections in a different order are different.
      shapes.set(t, `${s.sections.join('>')}|${s.layout}`);
    }

    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const [t, shape] of shapes) {
      const first = seen.get(shape);
      if (first) clashes.push(`${t} is identical to ${first}: ${shape}`);
      else seen.set(shape, t);
    }
    expect(clashes, clashes.join('\n')).toEqual([]);

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('the schedule — the densest thing on the page — is laid out differently', async ({ page }) => {
    const layouts = new Set<string>();
    for (const t of TEMPLATES) {
      layouts.add((await shapeOf(page, t)).layout);
    }
    // Five distinct treatments across six templates: two may legitimately share one.
    expect(layouts.size, `only ${layouts.size} schedule layouts: ${[...layouts].join(', ')}`)
      .toBeGreaterThanOrEqual(4);

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('templates that carry a nav have one, and the rest do not', async ({ page }) => {
    const withNav = await shapeOf(page, 'timeline');
    expect(withNav.navShown, 'timeline must show its anchor nav').toBe(true);

    const without = await shapeOf(page, 'classic');
    expect(without.navShown, 'classic must not show a nav').toBe(false);

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('a template can add a section the others do not have', async ({ page }) => {
    // The story beats and the wedding party are the two sections the real builders treat as
    // optional, and they are what makes `story` a different document rather than a restyled one.
    const rail = await shapeOf(page, 'rail');
    expect(rail.sections).toContain('story');
    expect(rail.sections).toContain('party');

    // Contrasted against `gate`, which is the minimal structure by design — its source shows the
    // names, the date and two links, and nothing else until you ask. `classic` is no longer the
    // contrast: it carries Zola's full canonical order, which includes the wedding party.
    const gate = await shapeOf(page, 'gate');
    expect(gate.sections).not.toContain('story');
    expect(gate.sections).not.toContain('party');
    expect(gate.sections).not.toContain('things');

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('story beats carry a date, which is what makes them beats', async ({ page }) => {
    await shapeOf(page, 'rail');
    const whens = await page.locator('.story-when').allTextContents();
    expect(whens.length, 'every story beat needs its date').toBeGreaterThanOrEqual(3);

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('the timeline actually alternates, rather than declaring that it does', async ({ page, isMobile }) => {
    // Desktop only, and that is the design rather than a dodge: two 46% columns on a 390px screen
    // would be about twenty characters a line. The source templates gate their alternation the same
    // way. On a phone the timeline is one column down a single rule.
    test.skip(isMobile, 'alternation is gated at 900px by design');
    // The first distinctness audit found this template's defining CSS was unreachable: the schedule
    // opened a separate list per day, and with one event per day `nth-child(even)` never matched a
    // single element. Everything looked configured and nothing alternated. A claim in a registry is
    // not a structure; this is the assertion that makes it one.
    await shapeOf(page, 'timeline');
    const xs = await page
      .locator('.schedule-item')
      .evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().x)))]);
    expect(xs.length, `timeline items all sit at x=${xs.join(',')}`).toBeGreaterThanOrEqual(2);

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('the cover is not the same first screen four times over', async ({ page }) => {
    // Round 1's sharpest evidence was duplicate FILES: split and gate shared a desktop fold
    // byte-for-byte, and card, split and gate shared a mobile fold. A guest's entire first
    // impression of four of the seven was one image.
    const shapes: string[] = [];
    for (const t of ['split', 'card', 'boxed', 'gate']) {
      await shapeOf(page, t);
      shapes.push(
        await page.evaluate(() => {
          const s = document.querySelector('.splash');
          if (!s) return 'none';
          const cs = getComputedStyle(s);
          const r = s.getBoundingClientRect();
          return [
            cs.justifyContent,
            cs.flexDirection,
            Math.round(r.height),
            s.textContent?.trim().length ?? 0,
            s.querySelectorAll('a').length,
          ].join('|');
        }),
      );
    }
    expect(new Set(shapes).size, `covers are identical: ${shapes.join(' / ')}`).toBeGreaterThanOrEqual(3);

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('gate shows the date and both doors on its first screen', async ({ page }) => {
    // Its whole claim. It used to be names only, aria-hidden, with the date and a single link on a
    // second full-height screen below.
    await shapeOf(page, 'gate');
    const splash = page.locator('.splash');
    await expect(splash.locator('.gate-date')).toBeVisible();
    expect(await splash.locator('a').count(), 'two doors').toBeGreaterThanOrEqual(2);

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('each structure still exists on a phone', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'this is the mobile projection of the axis');
    // Every structural rule used to sit behind a min-width gate, so at 390px all seven rendered one
    // identical column and two pairs of screenshots were byte-identical.
    const widths = new Map<string, string>();
    for (const t of TEMPLATES) {
      await shapeOf(page, t);
      widths.set(
        t,
        await page.evaluate(() => {
          const m = document.querySelector('main')!.getBoundingClientRect();
          const nav = document.querySelector('.anchor-nav');
          const shown = Boolean(nav) && getComputedStyle(nav!).display !== 'none';
          return `${Math.round(m.x)},${Math.round(m.width)}|${shown}`;
        }),
      );
    }
    // Not all seven need to differ on a phone, but "one page, seven times" is the thing to prevent.
    expect(new Set(widths.values()).size, `mobile shapes: ${[...widths].map(([k, v]) => k + '=' + v).join(' ')}`)
      .toBeGreaterThanOrEqual(3);
  });

  test('no template selector is left at a specificity the theme layer beats', async () => {
    // The theme layer writes `html:not([data-theme='x']) .thing` — (0,2,1). A bare
    // `[data-template='y'] .thing` is (0,2,0) and loses silently, which is how "nothing is centred"
    // ended up centred. This has been claimed and half-delivered twice: the first sweep missed
    // every INDENTED selector, i.e. every rule inside an @media block, which is most of them.
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('app/templates.css', 'utf8')
      // Strip comments so the paragraph explaining the problem does not trip the check.
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const bare = [...css.matchAll(/(?<!html)\[data-template=[^\]]+\]/g)].map((m) => m[0]);
    expect(bare, `bare template selectors: ${[...new Set(bare)].join(', ')}`).toEqual([]);
  });

  test('the schedule is a different object in every template, on a phone too', async ({ page }) => {
    // The densest section, and the one the audits weigh most. At 390px six of seven used to render
    // one identical stack — the axis existed on a desktop and not on the device guests use.
    const sigs = new Map<string, string>();
    for (const t of TEMPLATES) {
      await shapeOf(page, t);
      sigs.set(
        t,
        await page.evaluate(() => {
          const item = document.querySelector('.schedule-item');
          const list = document.querySelector('.schedule-list');
          const node = document.querySelector('.schedule-node');
          const xs = [
            ...new Set(
              [...document.querySelectorAll('.schedule-item')].map((e) =>
                Math.round(e.getBoundingClientRect().x),
              ),
            ),
          ];
          const body = document.querySelector('.schedule-body');
          return [
            xs.join('/'),
            item ? Math.round(item.getBoundingClientRect().height) : 0,
            body ? getComputedStyle(body).textAlign : '',
            node ? getComputedStyle(node).display : '',
            list ? getComputedStyle(list, '::before').display : '',
          ].join('|');
        }),
      );
    }
    const clashes: string[] = [];
    const seen = new Map<string, string>();
    for (const [t, sig] of sigs) {
      const first = seen.get(sig);
      if (first) clashes.push(`${t} renders the same schedule as ${first} (${sig})`);
      else seen.set(sig, t);
    }
    expect(clashes, clashes.join(' | ')).toEqual([]);

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('every template in the picker is covered by this suite', async ({ page }) => {
    await page.goto('/themes');
    const offered = await page
      .locator('.theme-card[data-template-id]')
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.templateId ?? ''));
    expect(offered.length).toBeGreaterThan(0);
    const missing = offered.filter((id) => !TEMPLATES.includes(id));
    expect(missing, `templates with no structural test: ${missing.join(', ')}`).toEqual([]);
  });
});
