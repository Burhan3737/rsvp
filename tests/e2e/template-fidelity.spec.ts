import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Template fidelity, checked mechanically.
 *
 * Every theme is a copy of a specific published template. The values below were harvested from
 * those templates' own stylesheets by scripts/harvest.mjs — the counts are how many times each hex
 * appears in the source CSS. This suite asserts the copy still renders them.
 *
 * A blind agent still judges whether the copy *looks* like the original. This is the half that can
 * be automated: if somebody nudges a hex or swaps a typeface, it fails here rather than surviving
 * to a review round.
 *
 * Sources and provenance: docs/TEMPLATE-SOURCES.md
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


const rgb = (hex: string) => {
  const h = hex.replace('#', '');
  const n = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgb(${n[0]}, ${n[1]}, ${n[2]})`;
};

interface Fidelity {
  theme: string;
  source: string;
  /** Harvested from the source's own CSS. */
  ground: string;
  /** The colour the display type is set in. */
  displayInk: string;
  /** First family in the display stack, as the source uses. */
  displayFont: string;
  bodyFont: string;
}

const EXPECTED: Fidelity[] = [
  {
    theme: 'marry-monday',
    source: 'veleyross.wedding',
    ground: '#f3f2f1', // x11 in source CSS
    displayInk: '#284135', // x13
    displayFont: 'Fraunces', // Canela substitute
    bodyFont: 'Archivo', // Founders Grotesk substitute
  },
  {
    theme: 'alessia',
    source: 'myblissandbone.com/alessia',
    ground: '#fffaf1', // x23
    displayInk: '#9c0a0d', // x61 — the theme colour
    // The source's headings are a heavy wide geometric caps sans (OlivieSans); the marker face is
    // its CAPTION face. Montserrat rather than Poppins so this theme and Aspen do not converge.
    displayFont: 'Montserrat',
    // `body { font: 16px/1.5em "PermanentMarker-Regular" }` — the marker IS this template's
    // running text, which only became visible once the harvest learned to read @font-face.
    bodyFont: 'Permanent Marker',
  },
  {
    theme: 'avril',
    source: 'myblissandbone.com/avril',
    ground: '#fffaf1', // x21
    displayInk: '#013ab2', // x65 — the theme colour
    displayFont: 'Allura', // SaintAmour substitute
    bodyFont: 'Inter', // the template's own body face
  },
  {
    theme: 'aspen',
    source: 'myblissandbone.com/aspen',
    ground: '#ffffff', // x17 — genuinely white in the source
    displayInk: '#595141', // x39
    displayFont: 'Poppins', // the template's own, and its only face
    bodyFont: 'Poppins',
  },
  {
    theme: 'kelsey',
    source: 'myblissandbone.com/kelsey',
    // `html { background: #7F4928 }` with `body { color: #E0D8CB }`, read off the source directly.
    // The frequency census says #e0d8cb x56 — but that is the TEXT colour, not the ground, and
    // reading it as the ground inverted this whole theme for a round.
    ground: '#7f4928',
    // With the page rust, the type on it is the tan: `body { color: #E0D8CB }`. The rust is the
    // GROUND here (#7f4928, x21), which is the inversion the whole theme exists for.
    displayInk: '#e0d8cb',
    displayFont: 'EB Garamond', // the template's own, and its only face
    bodyFont: 'EB Garamond',
  },
  {
    theme: 'anvaya',
    source: 'anvaya.love',
    ground: '#fbf9f5', // --background
    displayInk: '#1b1c1a', // --foreground
    // The source's h1 is Cormorant Garamond at weight 300; its running text is a neutral sans.
    displayFont: 'Cormorant Garamond',
    bodyFont: 'Inter',
  },

  /* ------------------------------------------------------------------ Zola
     Zola publishes `public_theme_v2` inside every live couple's site, so these
     are its own token values rather than measurements off a screenshot. */
  {
    theme: 'malina',
    source: 'zola.com/wedding/latoyaandtyran2018',
    ground: '#131313', // Zola's own swatch_color for this variant
    displayInk: '#f5efe8',
    displayFont: 'Prata', // Fifty Fifty substitute
    bodyFont: 'Jost', // Circular substitute
  },
  {
    theme: 'morrison',
    source: 'zola.com/wedding/jamesandtorrie2022',
    ground: '#f8f8f8',
    displayInk: '#141414',
    displayFont: 'Cardo', // the template's own face
    bodyFont: 'Jost', // Circular substitute
  },
  {
    theme: 'goundry',
    source: 'zola.com/wedding/lucy-gavin',
    ground: '#bd989f', // a mid-tone COLOURED ground — nothing else in the set has one
    displayInk: '#49323c',
    displayFont: 'Cormorant SC', // Mrs Eaves Roman Small Caps substitute — true small caps
    bodyFont: 'Libre Baskerville', // the template's own face
  },
  {
    theme: 'buxton',
    source: 'zola.com/wedding/winsteadgalindowedding',
    ground: '#e2ddd7',
    displayInk: '#364153',
    displayFont: 'Libre Baskerville',
    bodyFont: 'Libre Baskerville', // one face throughout, as the source has it
  },
  {
    theme: 'galata',
    source: 'zola.com/wedding/langponcerwedding',
    ground: '#ffffff',
    displayInk: '#000000',
    displayFont: 'Cormorant Garamond',
    bodyFont: 'Libre Baskerville',
  },
  {
    theme: 'abbey',
    source: 'zola.com/wedding/blakeandhannahmay23',
    ground: '#f7f5f2',
    displayInk: '#4e4e4e',
    displayFont: 'Pinyon Script', // the template's own face
    bodyFont: 'Libre Baskerville',
  },

  /* -------------------------------------------------------------- The Knot
     The Knot ships no per-theme stylesheet — a theme is a JSON token object
     applied at runtime — and every face it names is already a Google Font, so
     none of these six is substituted. */
  {
    theme: 'hollywood',
    source: 'theknot.com themeId 4642',
    ground: '#231f20',
    displayInk: '#e9b970', // gold as the INK, which only works on a ground this dark
    displayFont: 'Playfair Display',
    bodyFont: 'Jost',
  },
  {
    theme: 'lucky',
    source: 'theknot.com — Lucky Circle (Red)',
    ground: '#d82b45', // the PAGE is the red, not an accent on pale paper
    displayInk: '#ffffff',
    displayFont: 'Arsenal',
    bodyFont: 'Jost',
  },
  {
    theme: 'surround',
    source: 'theknot.com — Surround (Yellow)',
    ground: '#dcba6a',
    displayInk: '#67471e',
    displayFont: 'Bellefair',
    bodyFont: 'EB Garamond',
  },
  {
    theme: 'marrakesh',
    source: 'theknot.com — Marrakesh Tile (Teal)',
    ground: '#ffffff',
    displayInk: '#2d808b',
    displayFont: 'La Belle Aurore',
    bodyFont: 'Averia Serif Libre',
  },
  {
    theme: 'official',
    source: 'theknot.com — Officially Official (Cream)',
    ground: '#fae2c3',
    displayInk: '#c42412',
    displayFont: 'Oswald',
    bodyFont: 'DM Mono', // the only monospace in the set
  },
  {
    theme: 'industrial',
    source: 'theknot.com — Elegant Industrial',
    ground: '#f7f6f4',
    displayInk: '#595c58',
    displayFont: 'Saira Extra Condensed',
    bodyFont: 'Darker Grotesque',
  },
];

test.describe('each theme renders its source template values', () => {
  for (const t of EXPECTED) {
    test(`${t.theme} matches ${t.source}`, async ({ page }) => {
      await page.goto('/find');
      await page.evaluate((id) => {
        document.cookie = `preview_theme=${id}; path=/`;
      }, t.theme);
      await page.goto(INVITE);

      const actual = await page.evaluate(() => {
        const h1 = document.querySelector('h1')!;
        const body = document.body;
        return {
          ground: getComputedStyle(document.documentElement).backgroundColor,
          displayInk: getComputedStyle(h1).color,
          displayFont: getComputedStyle(h1).fontFamily,
          bodyFont: getComputedStyle(body).fontFamily,
        };
      });

      expect(actual.ground, `${t.theme} ground must be the harvested ${t.ground}`).toBe(rgb(t.ground));
      expect(actual.displayInk, `${t.theme} display ink must be ${t.displayInk}`).toBe(rgb(t.displayInk));
      expect(actual.displayFont.toLowerCase()).toContain(t.displayFont.toLowerCase());
      expect(actual.bodyFont.toLowerCase()).toContain(t.bodyFont.toLowerCase());
    });
  }

  test('every theme offered to an owner is covered by this suite', async ({ page }) => {
    // Adding a theme without an expectation here would let it drift silently, which is the whole
    // failure mode this file exists to prevent. Read from the picker rather than importing the
    // registry: the picker is what an owner can actually choose, and it is the surface that
    // matters if the two ever disagree.
    await signIn(page);
    await page.goto('/admin/themes');
    // Scoped to THEME cards. The picker now offers two axes — structure and look — and both use
    // the same card, so an unscoped selector picks up the templates, which have no palette to
    // assert against.
    const offered = await page.locator('.theme-card[data-theme-id]').evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.themeId ?? ''),
    );
    expect(offered.length, 'the picker must list themes').toBeGreaterThan(0);
    const covered = new Set(EXPECTED.map((e) => e.theme));
    const missing = offered.filter((id) => !covered.has(id));
    expect(missing, `themes with no fidelity expectation: ${missing.join(', ')}`).toEqual([]);
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/find');
    await page.evaluate(() => {
      document.cookie = 'preview_theme=; path=/; max-age=0';
    });
    await page.close();
  });
});

test.describe('signatures the sources are recognisable by', () => {
  test('dates and times are written LONGHAND, as Bliss & Bone sets them', async ({ page }) => {
    // Harvested from myblissandbone.com/kelsey: "August Fifteenth Two Thousand Twenty Four" and
    // "Five in the Afternoon". Not one numeral appears in a Bliss & Bone event block.
    await page.goto(INVITE);
    // Case-insensitive: the eyebrow is uppercased by CSS, so innerText returns caps.
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/Two Thousand Twenty Seven/i);
    expect(body).toMatch(/(in the Evening|in the Afternoon|in the Morning|at Night)/i);
    expect(body).toMatch(/February Twenty Seventh/i);
  });

  test('Alessia keeps the marker face — as a CAPTION face, which is where its source uses it', async ({ page }) => {
    // The source sets headings in a heavy geometric caps sans and reserves the marker for small
    // labels ("Pool Chic"). An earlier round had these exactly inverted, so both halves are pinned.
    await page.goto('/find');
    await page.evaluate(() => {
      document.cookie = 'preview_theme=alessia; path=/';
    });
    await page.goto(INVITE);

    const heading = await page.locator('.section-title').first().evaluate(
      (el) => getComputedStyle(el).fontFamily.toLowerCase(),
    );
    expect(heading).toContain('montserrat');
    expect(heading).not.toContain('permanent marker');

    const caption = await page.locator('.dresscode-label').first().evaluate(
      (el) => getComputedStyle(el).fontFamily.toLowerCase(),
    );
    expect(caption).toContain('permanent marker');

    await page.evaluate(() => {
      document.cookie = 'preview_theme=; path=/; max-age=0';
    });
  });

  test('Anvaya sets a non-Latin script beside the Latin names', async ({ page }) => {
    // anvaya.love loads Noto Serif in four Indic scripts precisely so it can do this.
    await page.goto('/find');
    await page.evaluate(() => {
      document.cookie = 'preview_theme=anvaya; path=/';
    });
    await page.goto(INVITE);

    const indic = page.locator('.hero-indic');
    await expect(indic).toBeVisible();
    const text = await indic.innerText();
    // Perso-Arabic range — the demo wedding is Pakistani.
    expect(text).toMatch(/[؀-ۿ]/);

    await page.evaluate(() => {
      document.cookie = 'preview_theme=; path=/; max-age=0';
    });
  });

  test('Marry Monday pins a second bar to the bottom of the window', async ({ page }) => {
    // veleyross.wedding carries a sticky bottom bar as well as a sticky top nav.
    await page.goto('/find');
    await page.evaluate(() => {
      document.cookie = 'preview_theme=marry-monday; path=/';
    });
    await page.goto(INVITE);

    const rail = page.locator('.footer-rail');
    await expect(rail).toBeVisible();
    const pinned = await rail.evaluate((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { position: cs.position, atBottom: Math.abs(r.bottom - window.innerHeight) < 2 };
    });
    expect(pinned.position).toBe('fixed');
    expect(pinned.atBottom).toBe(true);

    await page.evaluate(() => {
      document.cookie = 'preview_theme=; path=/; max-age=0';
    });
  });

  test('Aspen uses no serif anywhere — its source loads Poppins and nothing else', async ({ page }) => {
    await page.goto('/find');
    await page.evaluate(() => {
      document.cookie = 'preview_theme=aspen; path=/';
    });
    await page.goto(INVITE);

    const families = await page.evaluate(() =>
      [...new Set(Array.from(document.body.querySelectorAll('*')).map((el) => getComputedStyle(el).fontFamily))].join(' | '),
    );
    for (const serif of ['garamond', 'bodoni', 'fraunces', 'cormorant']) {
      expect(families.toLowerCase(), `${serif} must not appear in Aspen`).not.toContain(serif);
    }

    await page.evaluate(() => {
      document.cookie = 'preview_theme=; path=/; max-age=0';
    });
  });

  test('Kelsey is inverted — a RUST page, with light blocks set into it', async ({ page }) => {
    await page.goto('/find');
    await page.evaluate(() => {
      document.cookie = 'preview_theme=kelsey; path=/';
    });
    await page.goto(INVITE);

    const { ground, ink, blocks } = await page.evaluate(() => ({
      ground: getComputedStyle(document.documentElement).backgroundColor,
      ink: getComputedStyle(document.body).color,
      blocks: [...document.querySelectorAll('main > section.section')]
        .map((s) => getComputedStyle(s).backgroundColor)
        .filter((c) => c !== 'rgba(0, 0, 0, 0)' && c !== 'rgb(127, 73, 40)').length,
    }));
    // The PAGE is the rust, and the type on it is the tan. This is the whole reason the theme is
    // in the set — every other wedding site in the category is dark ink on pale paper.
    expect(ground).toBe('rgb(127, 73, 40)');
    expect(ink).toBe('rgb(224, 216, 203)');
    // The source sets LIGHT blocks into that rust field, in three colours. Running one colour end
    // to end — which earlier rounds did, in both directions — loses the rhythm that identifies it.
    expect(blocks, 'kelsey must set light blocks into the rust').toBeGreaterThanOrEqual(2);

    await page.evaluate(() => {
      document.cookie = 'preview_theme=; path=/; max-age=0';
    });
  });
});
