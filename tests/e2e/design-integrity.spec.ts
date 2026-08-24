import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { THEMES } from '../../lib/themes';

/**
 * Automated enforcement of the anti-pattern checklist in docs/DESIGN-DIRECTIONS.md.
 *
 * A human (or a vision model) still has to judge whether the result is *good*. What this suite does
 * is make the mechanical tells impossible to reintroduce by accident — so a design review only ever
 * has to argue about taste, never about whether someone shipped a purple gradient at 2am.
 */

const TOKENS: { name: string; token: string }[] = JSON.parse(
  readFileSync(path.join(process.cwd(), '.data', 'tokens.json'), 'utf8'),
);
const INVITE = `/i/${TOKENS[0].token}`;
// The guest-facing surface. The theme picker used to be in this list; it now lives at
// `/admin/themes` behind a session, and is swept separately below so its accessibility is still
// checked rather than quietly dropped along with its route.
const ROUTES = ['/', INVITE, `${INVITE}/rsvp`, '/find'];

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


/** Every distinct computed value of a property across the rendered page. */
async function computedValues(page: Page, prop: string): Promise<string[]> {
  return page.evaluate((p) => {
    const out = new Set<string>();
    // Only elements that actually render. <head>, <meta> and friends carry a UA/preflight stack
    // that no reader ever sees, and judging those produces false positives.
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const cs = getComputedStyle(el);
      out.add(cs.getPropertyValue(p));
      for (const pseudo of ['::before', '::after']) {
        out.add(getComputedStyle(el, pseudo).getPropertyValue(p));
      }
    }
    return [...out].filter(Boolean);
  }, prop);
}

test.describe('AI-slop tells are structurally impossible', () => {
  for (const route of ROUTES) {
    test(`${route} — no gradients anywhere`, async ({ page }) => {
      await page.goto(route);
      // Rule #1 and #2 of the checklist. Real stationery has no gradients; ink is flat, and foil is
      // a flat metallic with a hard specular edge, not a linear-gradient.
      for (const prop of ['background-image', 'background']) {
        const values = await computedValues(page, prop);
        expect(values.filter((v) => v.includes('gradient'))).toEqual([]);
      }
    });

    test(`${route} — typefaces match the source template`, async ({ page }) => {
      await page.goto(route);
      const fonts = (await computedValues(page, 'font-family')).join(' ').toLowerCase();

      // This check used to ban Inter, Poppins and friends outright as tells of generated design.
      // It no longer can, and that is deliberate: every theme is a copy of a specific published
      // template, and those templates' own @font-face blocks name the faces —
      //   myblissandbone.com/aspen  ships Poppins-Light and Poppins-ExtraLight and NOTHING else
      //   myblissandbone.com/avril  ships Inter-Light as its body face
      //   myblissandbone.com/alessia ships OlivieSans, stood in for by Montserrat
      // Montserrat was still listed below for a round after it shipped, so this suite and
      // template-fidelity.spec.ts asserted opposite things about the same page. The rule is now
      // what it always meant: no face that NO source template uses.
      for (const neverUsed of ['roboto', 'lato', 'open sans', 'nunito', 'raleway']) {
        expect(fonts, `${neverUsed} is in no source template and must not appear`).not.toContain(neverUsed);
      }
    });

    test(`${route} — no pure #FFF ground or pure #000 ink`, async ({ page }) => {
      await page.goto(route);
      // Measure what a READER actually sees, not what <body> claims.
      //
      // Two reasons this walks the tree instead of reading document.body:
      //  1. A transparent body shows whatever <html> paints behind it, so the effective ground can
      //     legitimately live on the root element.
      //  2. WebKit was observed reporting bogus computed values on <body> for one route — black
      //     text and -webkit-standard — while the page rendered correctly and every real element,
      //     including <h1>, reported the right values. Verified against a screenshot.
      const { bg, fg } = await page.evaluate(() => {
        const transparent = (v: string) => !v || v === 'rgba(0, 0, 0, 0)' || v === 'transparent';
        const h = getComputedStyle(document.documentElement);
        const b = getComputedStyle(document.body);

        // First painted ancestor wins, body then root.
        const bg = !transparent(b.backgroundColor) ? b.backgroundColor : h.backgroundColor;

        // Ink is read off a real heading — an element that definitely renders text.
        const heading = document.querySelector('h1, h2, .display');
        const fg = heading ? getComputedStyle(heading).color : b.color;
        return { bg, fg };
      });
      // Pure #000 ink is still banned: no source template uses it, and every one of them picks a
      // near-black that carries a hue.
      expect(fg).not.toBe('rgb(0, 0, 0)');
      // Nothing may be unpainted.
      expect(bg).not.toBe('rgba(0, 0, 0, 0)');
      // Pure #FFFFFF is NOT banned any more. myblissandbone.com/aspen genuinely grounds on white
      // (17 occurrences in its own CSS), so banning it would mean refusing to copy the template
      // faithfully. The alternating #FFF/#F5F5F5 rhythm is the actual tell, and that is checked by
      // the section-background test rather than by outlawing a colour.
    });

    test(`${route} — no soft drop shadows on content`, async ({ page }) => {
      await page.goto(route);
      const shadows = await page.evaluate(() => {
        const bad: string[] = [];
        for (const el of Array.from(document.querySelectorAll('*'))) {
          const s = getComputedStyle(el).boxShadow;
          if (!s || s === 'none') continue;
          // The letterpress hairline is a deliberate 1px hard line with NO blur; a blurred shadow
          // is the template tell, because paper does not cast one onto other paper.
          const blur = Number(s.match(/(-?\d+(?:\.\d+)?)px/g)?.[2]?.replace('px', '') ?? 0);
          if (blur > 2) bad.push(`${el.tagName}.${el.className}: ${s}`);
        }
        return bad;
      });
      expect(shadows).toEqual([]);
    });

    test(`${route} — no emoji used as an icon`, async ({ page }) => {
      await page.goto(route);
      const text = (await page.locator('body').innerText()) ?? '';
      const emoji = text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? [];
      expect(emoji).toEqual([]);
    });

    test(`${route} — body copy is at least 16px`, async ({ page }) => {
      await page.goto(route);
      const size = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
      // Body text under 16px reads as cheap, and on iOS under 16px makes Safari zoom on focus.
      expect(size).toBeGreaterThanOrEqual(16);
    });
  }

  test('display type dwarfs body type — a ratio under 4:1 reads as a template', async ({ page, isMobile }) => {
    // Desktop only, and that is a finding rather than a dodge. The source templates size their
    // cover type in viewport units — Bliss & Bone at 9.375-10.54vw, veleyross.wedding at 22.22vw —
    // which on a 390px screen lands around 37-41px against 17px body: roughly 2.4:1. Holding a copy
    // to 4:1 on mobile would mean deliberately not copying it.
    test.skip(isMobile, 'source templates use vw-scaled cover type; ~2.4:1 on a phone is faithful');
    await page.goto('/');
    const ratio = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      if (!h1) return 0;
      return parseFloat(getComputedStyle(h1).fontSize) / parseFloat(getComputedStyle(document.body).fontSize);
    });
    expect(ratio).toBeGreaterThan(4);
  });

  test('uppercase labels carry real tracking, not the browser default', async ({ page }) => {
    await page.goto('/');
    const tracking = await page.evaluate(() => {
      const el = document.querySelector('.label');
      return el ? getComputedStyle(el).letterSpacing : '0px';
    });
    expect(parseFloat(tracking)).toBeGreaterThan(1);
  });

  test('every theme keeps its palette and its own typeface', async ({ page }) => {
    const seenFonts = new Set<string>();
    for (const theme of THEMES) {
      await page.goto('/find');
      await page.evaluate((id) => {
        document.cookie = `preview_theme=${id}; path=/`;
      }, theme.id);
      await page.goto('/');

      // The ground must be the theme's own, whatever that is — including Aspen's genuine white.
      const bg = await page.evaluate(
        () => getComputedStyle(document.documentElement).backgroundColor,
      );
      expect(bg, `${theme.name} must paint a ground`).not.toBe('rgba(0, 0, 0, 0)');

      const display = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        return h1 ? getComputedStyle(h1).fontFamily : '';
      });
      seenFonts.add(display.split(',')[0].trim());
    }
    // Six templates, six type systems — they must not converge.
    expect(seenFonts.size).toBeGreaterThanOrEqual(5);

    await page.evaluate(() => {
      document.cookie = 'preview_theme=; path=/; max-age=0';
    });
  });
});

test.describe('accessibility', () => {
  for (const route of ROUTES) {
    test(`${route} — no WCAG A/AA violations`, async ({ page }) => {
      // Measure the SETTLED page. Entrance animations pass through low-opacity states, and scanning
      // mid-fade reports a contrast failure that does not exist once the page has arrived.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      // Print something useful rather than an opaque array if this ever fails.
      const summary = results.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.help}`);
      expect(summary, summary.join('\n')).toEqual([]);
    });
  }

  test('/admin/themes — no WCAG A/AA violations', async ({ page }) => {
    // Swept on its own because it needs a session. It came off the public ROUTES list when the
    // picker moved behind the admin gate, and a route that quietly loses its accessibility check
    // by being moved is how these things rot.
    await signIn(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/admin/themes');
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const summary = results.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.help}`);
    expect(summary, summary.join('\n')).toEqual([]);
  });


  test('interactive targets are at least 44px', async ({ page }) => {
    await page.goto(INVITE);
    const small = await page.evaluate(() => {
      const bad: string[] = [];
      const els = document.querySelectorAll('a, button, input, select, textarea, label.choice');
      for (const el of Array.from(els)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue; // not rendered
        // WCAG 2.2 SC 2.5.8 exempts a link that sits inline within a sentence — enlarging it would
        // break the paragraph. Only standalone controls are held to the floor.
        const cs = getComputedStyle(el);
        const inlineInProse = cs.display === 'inline' && el.closest('p, li, dd, span') !== null;
        if (inlineInProse) continue;
        // Guest lists skew elderly and this is read on phones; 44px is the floor.
        if (r.height < 44) bad.push(`${el.tagName}: ${Math.round(r.height)}px — ${el.textContent?.slice(0, 30)}`);
      }
      return bad;
    });
    expect(small, small.join('\n')).toEqual([]);
  });

  test('a pinned day header never hides behind the viewing bar', async ({ page }) => {
    // Both are position:sticky at the top. Without an explicit offset the day name pins underneath
    // the bar and vanishes exactly when a guest is scrolling the schedule looking for it.
    await page.goto(INVITE);
    await page.evaluate(() => window.scrollTo(0, 2600));
    await page.waitForTimeout(400);
    const collides = await page.evaluate(() => {
      const bar = document.querySelector('.viewing-bar')?.getBoundingClientRect();
      if (!bar) return null;
      // A header that has finished its day slides fully UNDER the bar on its way out — it is
      // completely hidden, which is correct. What must never happen is a header STRADDLING the
      // bar's lower edge, where the top of the text is clipped but the bottom is on screen.
      // Only STICKY headers. A static one passing under the bar as the page scrolls is ordinary
      // document behaviour — every other line of text does the same, and flagging it would mean
      // asserting that nothing may ever scroll beneath a fixed bar. The defect this guards against
      // is a header that PINS itself underneath the bar and stays there, which is why the test is
      // named for a pinned header. Templates set this per layout: classic and rail pin theirs,
      // card moves its day into the agenda's time gutter and leaves it static.
      const bad = [...document.querySelectorAll('.schedule-day-header')]
        .filter((h) => getComputedStyle(h).position === 'sticky')
        .map((h) => ({ r: h.getBoundingClientRect(), txt: (h.textContent ?? '').trim() }))
        .filter(({ r }) => r.top < bar.bottom - 1 && r.bottom > bar.bottom + 1)
        .map(({ r, txt }) => `${txt} straddles the bar (top ${Math.round(r.top)}, bar bottom ${Math.round(bar.bottom)})`);
      return bad;
    });
    expect(collides ?? [], (collides ?? []).join('; ')).toEqual([]);
  });

  test('the page still works with all motion disabled', async ({ page }) => {
    // "A truly high-end website would still feel high-end if you stripped out every hover effect
    // and scroll animation." If content only appears via animation, reduced-motion users see a
    // blank page — so this asserts the content is there regardless.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(INVITE);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mehndi', exact: true })).toBeVisible();
  });
});

test.describe('mobile layout', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile-only');

  test('nothing scrolls the page sideways', async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route);
      const overflow = await page.evaluate(() =>
        Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      );
      expect(overflow, `${route} overflows by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });

  test('the RSVP call to action is above the fold', async ({ page }) => {
    // The RSVP is the most-used feature on a wedding site; it must not sit behind a hero-scroll.
    await page.goto(INVITE);
    // Located by role in the page, not by one template's wording — see the note in guest-flow.
    // gate answers with its two doors on the cover; everyone else with the hero button.
    const cta = page.locator('.hero-cta .btn, .gate-doors .btn').last();
    const box = await cta.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(box!.y).toBeLessThan(viewport!.height);
  });
});
