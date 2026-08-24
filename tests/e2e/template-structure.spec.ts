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


/**
 * The theme and template picker moved to `/admin/themes`, so reaching it needs a session.
 * Choosing the look of the wedding is an owner's decision; the page used to be public and gated
 * only its "Use this" buttons.
 */
const ADMIN_PASSWORD = 'demo-admin-password-please-change';

async function signIn(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /Sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

const TEMPLATES = ['classic', 'rail', 'timeline', 'split', 'card', 'boxed', 'gate'];

/** The section ids in the order the page renders them, plus how the schedule is laid out. */
async function shapeOf(page: Page, template: string) {
  // Any page on this origin will do — the picker moved behind the admin gate, and all this
  // navigation ever needed was a document to write a cookie from.
  await page.goto('/find');
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

  test('the sections below the schedule are not one object seven times', async ({ page }) => {
    // Round 5 measured `.blocks` as a single full-width grid track and `.faq` as `display: block`
    // in all seven, and found no rule anywhere for `.faq-item`, `.faq-q`, `.block` or the `.blocks`
    // grid. Those sections are 42% of classic's document, 57% of gate's and 30% of card's — most
    // of what a guest scrolls through was identical whichever template they had been sent.
    const sigs = new Map<string, string>();
    for (const t of TEMPLATES) {
      await shapeOf(page, t);
      sigs.set(
        t,
        await page.evaluate(() => {
          const cs = (el: Element | null, prop: string) =>
            el ? (getComputedStyle(el) as unknown as Record<string, string>)[prop] : '';
          const box = (el: Element | null) => {
            if (!el) return '';
            const r = el.getBoundingClientRect();
            return `${Math.round(r.x)},${Math.round(r.width)}`;
          };
          const blocks = document.querySelector('.blocks');
          const block = document.querySelector('#travel .block');
          const item = document.querySelector('.faq-item');
          const q = document.querySelector('.faq-q');
          return [
            cs(blocks, 'gridTemplateColumns'),
            box(block),
            cs(block, 'textAlign'),
            cs(block, 'borderLeftWidth'),
            cs(item, 'display'),
            cs(item, 'borderTopWidth'),
            cs(item, 'paddingLeft'),
            box(item),
            cs(q, 'display'),
            cs(q, 'fontSize'),
            cs(q, 'textAlign'),
          ].join('|');
        }),
      );
    }
    const clashes: string[] = [];
    const seen = new Map<string, string>();
    for (const [t, sig] of sigs) {
      const first = seen.get(sig);
      if (first) clashes.push(`${t} renders travel and the FAQ exactly as ${first} does (${sig})`);
      else seen.set(sig, t);
    }
    expect(clashes, clashes.join(' | ')).toEqual([]);

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('the templates do not all say the same words', async ({ page }) => {
    // One `TITLES` map served all seven, so every structure printed the same eight headings in the
    // same order and the copy carried no information about which document you were reading.
    const heads = new Map<string, string>();
    for (const t of TEMPLATES) {
      await shapeOf(page, t);
      heads.set(
        t,
        (await page.locator('h2.section-title').allTextContents()).map((x) => x.trim()).join(' | '),
      );
    }
    const clashes: string[] = [];
    const seen = new Map<string, string>();
    for (const [t, h] of heads) {
      const first = seen.get(h);
      if (first) clashes.push(`${t} uses ${first}'s headings verbatim: ${h}`);
      else seen.set(h, t);
    }
    expect(clashes, clashes.join(' | ')).toEqual([]);

    // Distinct sets are not enough on their own: most templates need at least one heading that no
    // other template uses, or this is one vocabulary shuffled.
    const all = [...heads.values()].flatMap((h) => h.split(' | '));
    const withOwnWords = [...heads.values()].filter((h) =>
      h.split(' | ').some((x) => all.filter((y) => y === x).length === 1),
    );
    expect(withOwnWords.length, 'templates with a heading of their own').toBeGreaterThanOrEqual(4);

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('the section ground is a template decision, not a DOM index', async ({ page }) => {
    // The largest painted surface on the page used to be
    // `main > section.section:nth-of-type(even)` in the theme layer — an index that counts the
    // splash and the hero. Deleting a welcome note flipped classic's schedule from cream to
    // maroon, and any two templates carrying the same number of sections banded identically.
    const bands = new Map<string, string>();
    for (const t of TEMPLATES) {
      await shapeOf(page, t);
      bands.set(
        t,
        await page.evaluate(() =>
          [...document.querySelectorAll('main > section.section')]
            .map((sec) => (sec as HTMLElement).dataset.band ?? '-')
            .join(''),
        ),
      );

      // Every painted section must be painted BECAUSE it carries a band. One painted without a
      // band means an index rule is still live somewhere.
      const stray = await page.evaluate(() => {
        const ground = getComputedStyle(document.body).backgroundColor;
        return [...document.querySelectorAll('main > section.section')]
          .filter((sec) => {
            const bg = getComputedStyle(sec).backgroundColor;
            const painted = bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && bg !== ground;
            return painted && !(sec as HTMLElement).dataset.band;
          })
          .map((sec) => sec.id || '?');
      });
      expect(stray, `${t}: painted with no band, so an index rule survived: ${stray.join(', ')}`).toEqual([]);
    }

    expect(
      new Set(bands.values()).size,
      `band rhythms: ${[...bands].map(([k, v]) => k + '=' + v).join(' / ')}`,
    ).toBeGreaterThanOrEqual(6);

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('no stylesheet still bands a section by counting it', async () => {
    const { readFileSync } = await import('node:fs');
    const css = ['app/compositions.css', 'app/templates.css', 'app/globals.css']
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    // A ground keyed on a section's ORDINAL is the defect itself. Two things are deliberately not
    // matched:
    //   `:nth-of-type(n)` — matches every element, so it carries no index meaning at all. It is
    //     used here purely to add one to the class column of a selector that has to out-specify a
    //     theme rule, which is a separate long-running problem in this codebase.
    //   rules whose subject is a descendant — `… section:nth-of-type(n) .schedule-item` paints an
    //     item inside a section, not the section's ground.
    const rules = [...css.matchAll(/([^{}]*)\{([^}]*)\}/g)];
    const offenders = rules
      .filter(([, sel, body]) => {
        if (!/(^|[;\s])(background|background-color|--bg)\s*:/.test(body)) return false;
        return sel
          .split(',')
          .map((one) => one.replace(/:nth-of-type\(\s*n\s*\)/g, '').trim())
          .some((one) => /section\.section:nth-of-type\([^)]*\)(::?[a-z-]+)?$/.test(one));
      })
      .map(([whole]) => whole.split('{')[0].trim().replace(/\s+/g, ' ').slice(0, 90));
    expect(offenders, `ground still keyed on section index: ${offenders.join(' / ')}`).toEqual([]);
  });

  test('the first screen tells a guest which document they are in', async ({ page }) => {
    // classic and timeline used to open on the identical hero — same elements, same order, same
    // centring, same 104px names — with timeline adding a nav bar above and a hairline below.
    const heroes = new Map<string, string>();
    for (const t of TEMPLATES) {
      await shapeOf(page, t);
      heroes.set(
        t,
        await page.evaluate(() => {
          const el = document.querySelector('.hero-inner');
          const splash = document.querySelector('.splash');
          const cover = splash
            ? [
                Math.round(splash.getBoundingClientRect().height),
                getComputedStyle(splash).flexDirection,
                getComputedStyle(splash).justifyContent,
                splash.querySelectorAll('a').length,
              ].join(',')
            : 'no-cover';
          if (!el) return `${cover}/none`;
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const names = document.querySelector('.hero-names');
          return [
            cover,
            cs.textAlign,
            cs.display,
            cs.paddingLeft,
            cs.borderTopWidth,
            Math.round(r.x),
            Math.round(r.width),
            names ? getComputedStyle(names).fontSize : '',
          ].join('|');
        }),
      );
    }
    const clashes: string[] = [];
    const seen = new Map<string, string>();
    for (const [t, h] of heroes) {
      const first = seen.get(h);
      if (first) clashes.push(`${t} opens on exactly ${first}'s hero (${h})`);
      else seen.set(h, t);
    }
    expect(clashes, clashes.join(' | ')).toEqual([]);

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('boxed keeps a contents page, not a slab pinned over the document', async ({ page }) => {
    // Stacked, its index measured 338px tall and stayed `position: sticky` for the whole scroll —
    // 38% of a 900px window, permanently, with the page text running underneath it.
    await shapeOf(page, 'boxed');
    const position = await page.evaluate(
      () => getComputedStyle(document.querySelector('.anchor-nav')!).position,
    );
    expect(position, 'a full table of contents cannot be pinned to the viewport').not.toBe('sticky');

    // timeline's, by contrast, stays: it is the bar you navigate a long sequence with.
    await shapeOf(page, 'timeline');
    const tl = await page.evaluate(
      () => getComputedStyle(document.querySelector('.anchor-nav')!).position,
    );
    expect(tl, 'timeline keeps its sticky bar').toBe('sticky');

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('numbered templates start at 01', async ({ page }) => {
    // `numberOf()` gave the welcome section `01` and the welcome branch never rendered the eyebrow,
    // so classic visibly ran 02 to 07 and split ran 02 to 06.
    for (const t of ['classic', 'split']) {
      await shapeOf(page, t);
      const nums = await page.locator('.section-num').allTextContents();
      expect(nums[0], `${t} starts at ${nums[0]}`).toBe('01');
    }

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('gifts, welcome and the footer are on the axis too', async ({ page }) => {
    // Round 6: gifts was "a heading and a paragraph, seven times" — the last thing every guest
    // reads, and the one prose section never given a treatment. The footer was 283px, block,
    // text-align:start, identical under seven structures that agree about nothing else, and was
    // called "the single largest shared surface left in the set".
    const parts = ['#gifts .gifts-body', '.footer-inner'] as const;
    for (const selector of parts) {
      const sigs = new Map<string, string>();
      for (const t of TEMPLATES) {
        await shapeOf(page, t);
        sigs.set(
          t,
          await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return 'absent';
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return [
              cs.display,
              cs.gridTemplateColumns,
              cs.textAlign,
              cs.borderTopWidth,
              cs.borderLeftWidth,
              cs.paddingLeft,
              Math.round(r.width),
            ].join('|');
          }, selector),
        );
      }
      const clashes: string[] = [];
      const seen = new Map<string, string>();
      for (const [t, sig] of sigs) {
        if (sig === 'absent') continue;
        const first = seen.get(sig);
        if (first) clashes.push(`${selector}: ${t} is identical to ${first} (${sig})`);
        else seen.set(sig, t);
      }
      expect(clashes, clashes.join(' | ')).toEqual([]);
    }

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('the welcome heading is something a guest can actually see', async ({ page }) => {
    // Six templates carry their own word for this section — "A note", "With pleasure", "Read this
    // first", "Before anything else" — and every one rendered zero pixels, because the heading was
    // `visually-hidden`. Registry strings that reach nobody are the whole pattern this suite exists
    // to catch, and this one had six instances in a single element.
    const seen = new Set<string>();
    for (const t of TEMPLATES) {
      await shapeOf(page, t);
      const head = page.locator('#welcome h2');
      if ((await head.count()) === 0) continue;
      await expect(head, `${t}'s welcome heading must be visible`).toBeVisible();
      expect(
        (await head.boundingBox())!.height,
        `${t}'s welcome heading occupies no space`,
      ).toBeGreaterThan(16);
      seen.add((await head.textContent())!.trim());
    }
    expect(seen.size, `only ${seen.size} distinct welcome headings: ${[...seen].join(', ')}`)
      .toBeGreaterThanOrEqual(4);

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('the reply button does not ask in the same words seven times', async ({ page }) => {
    // The single most-pressed control on the page. All seven said "Reply to your invitation".
    const labels = new Set<string>();
    for (const t of TEMPLATES) {
      await shapeOf(page, t);
      const btn = page.locator('.hero-cta .btn, .gate-doors .btn').first();
      labels.add((await btn.textContent())!.trim());
    }
    expect(labels.size, `reply labels: ${[...labels].join(' / ')}`).toBeGreaterThanOrEqual(5);

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('no copy override quietly restates the shared default', async () => {
    // Four `copy` entries repeated `TITLES` verbatim, so the registry read as though those
    // templates had made a choice they had not made.
    const { readFileSync } = await import('node:fs');
    const registry = readFileSync('lib/templates.ts', 'utf8');
    const page_ = readFileSync('components/WeddingPage.tsx', 'utf8');

    const defaults = new Map<string, string>();
    const titles = page_.slice(page_.indexOf('const TITLES'), page_.indexOf('const NAV_LABELS'));
    for (const m of titles.matchAll(/(\w+):\s*'([^']+)'/g)) defaults.set(m[1], m[2]);
    expect(defaults.size, 'could not read the TITLES map').toBeGreaterThan(4);

    const noops: string[] = [];
    for (const block of registry.matchAll(/copy:\s*\{([^}]*)\}/g)) {
      for (const entry of block[1].matchAll(/(\w+):\s*'([^']+)'/g)) {
        if (defaults.get(entry[1]) === entry[2]) noops.push(`${entry[1]}: '${entry[2]}'`);
      }
    }
    // classic is the template the shared wording belongs to, so it may legitimately restate it.
    const beyondClassic = noops.filter(
      (n) => !['welcome:', 'schedule:', 'gifts:'].some((k) => n.startsWith(k)),
    );
    expect(beyondClassic, `copy overrides that change nothing: ${beyondClassic.join(', ')}`).toEqual([]);
  });

  test('the wedding party is not three identical stacks on a phone', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'this is the defect at phone width');
    // Four registry values — grid, rows, list, bands — resolved to three indistinguishable 350px
    // stacks at 390, because every party treatment sat inside a min-width gate. Only `bands`
    // survived. A field with four values and two renderings is the pattern from round one.
    const sigs = new Map<string, string>();
    for (const t of TEMPLATES) {
      await shapeOf(page, t);
      const sig = await page.evaluate(() => {
        const list = document.querySelector('.party');
        if (!list) return 'absent';
        const member = document.querySelector('.party-member');
        const cs = getComputedStyle(list);
        const ms = member ? getComputedStyle(member) : null;
        const r = member?.getBoundingClientRect();
        return [
          cs.display,
          cs.gridTemplateColumns,
          ms?.display ?? '',
          ms?.gridTemplateColumns ?? '',
          ms?.borderLeftWidth ?? '',
          r ? Math.round(r.width) : 0,
        ].join('|');
      });
      if (sig !== 'absent') sigs.set(t, sig);
    }
    const clashes: string[] = [];
    const seen = new Map<string, string>();
    for (const [t, sig] of sigs) {
      const first = seen.get(sig);
      if (first) clashes.push(`${t}'s party is ${first}'s at 390 (${sig})`);
      else seen.set(sig, t);
    }
    expect(clashes, clashes.join(' | ')).toEqual([]);

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('nothing collides or collapses at 390', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'these are phone-width failures');
    for (const t of TEMPLATES) {
      await shapeOf(page, t);

      // boxed's panel head put the names' right edge and the date's left edge both at x=211 —
      // a gap of zero, with the glyphs touching.
      const overlap = await page.evaluate(() => {
        const a = document.querySelector('.splash-names');
        const b = document.querySelector('.splash-date');
        if (!a || !b) return null;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const sameRow = Math.abs(ra.top - rb.top) < ra.height * 0.5;
        return sameRow ? Math.round(rb.left - ra.right) : null;
      });
      if (overlap !== null) {
        expect(overlap, `${t}: cover names and date are ${overlap}px apart`).toBeGreaterThanOrEqual(12);
      }

      // card's agenda gutter was 88px wide holding "EIGHT IN THE EVENING · 8:00 PM KARACHI TIME" —
      // six wrapped lines beside a two-line event.
      const time = await page.evaluate(() => {
        const el = document.querySelector('.schedule-time');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const line = parseFloat(getComputedStyle(el).lineHeight) || 16;
        return Math.round(r.height / line);
      });
      if (time !== null) {
        expect(time, `${t}: the event time wraps onto ${time} lines`).toBeLessThanOrEqual(3);
      }
    }

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('no answer column is narrower than the question that introduces it', async ({ page }) => {
    // gate set `grid-template-columns: 240px 168px` — a 15rem question column against a 168px
    // answer inside a 440px measure. 21 characters a line, one answer 365px tall, and the FAQ
    // 45% of the entire document.
    for (const t of TEMPLATES) {
      await shapeOf(page, t);
      const ratio = await page.evaluate(() => {
        const item = document.querySelector('.faq-item');
        if (!item || getComputedStyle(item).display !== 'grid') return null;
        const cols = getComputedStyle(item)
          .gridTemplateColumns.split(' ')
          .map((c) => parseFloat(c))
          .filter((n) => !Number.isNaN(n));
        if (cols.length < 2) return null;
        return cols[cols.length - 1] / cols.reduce((a, b) => a + b, 0);
      });
      if (ratio !== null) {
        expect(ratio, `${t}: the answer gets ${Math.round(ratio * 100)}% of the measure`)
          .toBeGreaterThan(0.5);
      }
    }

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('rail keeps its monogram and says its nav scrolls', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the rail only becomes a bar at phone width');
    // Below 1024px the monogram was `display: none` and the link list measured 651px inside a 390px
    // box with `overflow-x: auto` and no affordance — the last two sections sat off-screen with
    // nothing to indicate they existed.
    await shapeOf(page, 'rail');
    await expect(page.locator('.rail-monogram'), 'rail without its monogram is not rail').toBeVisible();
    const fade = await page.evaluate(() => {
      const nav = document.querySelector('.anchor-nav-rail')!;
      const after = getComputedStyle(nav, '::after');
      const ul = nav.querySelector('ul')!;
      return {
        scrolls: ul.scrollWidth > ul.clientWidth + 1,
        // A MARK, not a fade. The first version of this affordance was a linear-gradient, which
        // breaks the project's own no-gradients rule — so the check is that something is drawn at
        // the edge and carries a direction, not that a particular technique was used.
        hasFade: after.content !== 'none' && after.content !== '' && after.backgroundColor !== 'rgba(0, 0, 0, 0)',
      };
    });
    if (fade.scrolls) {
      expect(fade.hasFade, 'a scroller that overflows needs to show that it does').toBe(true);
    }

    await page.evaluate(() => {
      document.cookie = 'preview_template=; path=/; max-age=0';
    });
  });

  test('every template in the picker is covered by this suite', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/themes');
    const offered = await page
      .locator('.theme-card[data-template-id]')
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.templateId ?? ''));
    expect(offered.length).toBeGreaterThan(0);
    const missing = offered.filter((id) => !TEMPLATES.includes(id));
    expect(missing, `templates with no structural test: ${missing.join(', ')}`).toEqual([]);
  });
});
