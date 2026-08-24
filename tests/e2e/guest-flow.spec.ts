import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * End-to-end guest journey.
 *
 * Runs against the real built app and the real database, driving it exactly as a guest would.
 * This is the only way to cover the RSVP page at all: it is an async Server Component, and Next's
 * own testing guide states Vitest cannot unit-test those.
 */

interface TokenRow {
  name: string;
  token: string;
  code: string;
  seats: number;
}

const TOKENS: Record<string, TokenRow> = (() => {
  const rows: TokenRow[] = JSON.parse(
    readFileSync(path.join(process.cwd(), '.data', 'tokens.json'), 'utf8'),
  );
  return Object.fromEntries(rows.map((r) => [r.name, r]));
})();

const FAMILY = TOKENS['Close family'].token;
const SARAH = TOKENS['Sarah Khan + guest'].token;
const WORK = TOKENS['Work colleagues'].token;

test.describe('the public front door', () => {
  test('shows only events marked public, and leaks nothing else', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Ayesha');

    await expect(page.getByRole('heading', { name: /Nikkah/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Walima', exact: true })).toBeVisible();

    // The private ones are absent from the DOM entirely, not merely hidden with CSS.
    for (const secret of ['Dholki', 'Mayoun', 'Mehndi']) {
      await expect(page.locator('body')).not.toContainText(secret);
    }
  });

  test('offers a way in for somebody who has only the printed card', async ({ page }) => {
    await page.goto('/');
    // By destination, not by wording. The call to action now speaks in the active template's own
    // voice — "Kindly find your invitation" on the stationery card, "Find your invitation" on the
    // side rail — so a matcher on one phrasing only passes for whichever template happens to be
    // live. What must be true is that the front page offers a way to the code form.
    await page.locator('.hero-cta a[href="/find"]').click();
    await expect(page).toHaveURL(/\/find/);
    await expect(page.getByLabel(/Invitation code/i)).toBeVisible();
  });
});

test.describe('a link shows exactly what was ticked for it', () => {
  test('the family link shows every event', async ({ page }) => {
    await page.goto(`/i/${FAMILY}`);
    for (const name of ['Dholki', 'Mayoun', 'Mehndi', 'Walima']) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }
    // Chronological, with the private Dholki first — not appended after the public ones.
    const headings = await page.locator('.schedule-name').allTextContents();
    expect(headings[0]).toBe('Dholki');
    expect(headings[1]).toBe('Mayoun');
  });

  test('a friend link shows its own subset and nothing more', async ({ page }) => {
    await page.goto(`/i/${SARAH}`);
    await expect(page.getByRole('heading', { name: 'Dholki', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mehndi', exact: true })).toBeVisible();
    // NOT ticked for her — the family-only afternoon.
    await expect(page.locator('body')).not.toContainText('Mayoun');
  });

  test('a link with nothing private ticked sees only the public events', async ({ page }) => {
    await page.goto(`/i/${WORK}`);
    // Scoped to the SCHEDULE, not the whole body: the FAQ copy legitimately mentions the mehndi
    // ("both the mehndi and the nikkah are outdoors") without listing it as an event.
    const scheduled = await page.locator('.schedule-name').allTextContents();
    expect(scheduled.sort()).toEqual(['Nikkah & Baraat', 'Walima']);
    // No greyed-out card, no "you are not invited" state, no gap in the timeline.
    await expect(page.locator('body')).not.toContainText(/not invited/i);
  });

  test('never reveals the owner private label for the link', async ({ page }) => {
    // "Close family" is the couple's own note to themselves. A forwarded link must not show it.
    await page.goto(`/i/${FAMILY}`);
    await expect(page.locator('body')).not.toContainText('Close family');
  });

  test('shows dress-code colours as swatches, not just words', async ({ page }) => {
    await page.goto(`/i/${FAMILY}`);
    expect(await page.locator('.swatch-dot').count()).toBeGreaterThan(3);
    await expect(page.getByText('Turmeric', { exact: true })).toBeVisible();
    await expect(page.getByText(/Not Red/).first()).toBeVisible();
  });

  test('names the timezone and never converts it', async ({ page }) => {
    await page.goto(`/i/${FAMILY}`);
    await expect(page.getByText(/Karachi time/).first()).toBeVisible();
  });

  test('the link is idempotent and re-visitable', async ({ page }) => {
    // Corporate mail scanners pre-click links; a single-use link would be dead on arrival.
    for (let i = 0; i < 3; i++) {
      expect((await page.goto(`/i/${FAMILY}`))?.status()).toBe(200);
    }
  });

  test('an unknown token 404s without revealing whether it ever existed', async ({ page }) => {
    expect((await page.goto('/i/definitely-not-a-real-token-x'))?.status()).toBe(404);
  });
});

test.describe('opening by printed code', () => {
  test('a valid code opens the right invitation', async ({ page }) => {
    await page.goto('/find');
    await page.getByLabel(/Invitation code/i).fill(TOKENS['The Okonkwos'].code);
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(TOKENS['The Okonkwos'].token));
  });

  test('a code is forgiving about case and dashes', async ({ page }) => {
    const code = TOKENS['The Bergströms'].code;
    // Lowercase and dashed, the way somebody reading a card would actually type it.
    const typed = `${code.slice(0, 5)}-${code.slice(5)}`.toLowerCase();
    await page.goto('/find');
    await page.getByLabel(/Invitation code/i).fill(typed);
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(TOKENS['The Bergströms'].token));
  });

  test('a wrong code fails kindly and never dead-ends', async ({ page }) => {
    await page.goto('/find');
    await page.getByLabel(/Invitation code/i).fill('ZZZZZ-ZZZZZ');
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page.getByText(/did not match/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Lost the link/i })).toBeVisible();
  });
});

test.describe('replying', () => {
  test('offers exactly the seats the link allows', async ({ page }) => {
    await page.goto(`/i/${WORK}/rsvp`);
    expect(await page.locator('input[name^="name:"]').count()).toBe(TOKENS['Work colleagues'].seats);

    await page.goto(`/i/${FAMILY}/rsvp`);
    expect(await page.locator('input[name^="name:"]').count()).toBe(TOKENS['Close family'].seats);
  });

  test('asks about the events on the link, and only those', async ({ page }) => {
    await page.goto(`/i/${WORK}/rsvp`);
    // The form's own event legends, not the whole page.
    const asked = await page.locator('section.rsvp-person').first().locator('legend.person-name').allTextContents();
    const names = asked.map((t) => t.split('·')[0].trim());
    expect(names.sort()).toEqual(['Nikkah & Baraat', 'Walima']);
  });

  test('does not ask about an event that collects no reply', async ({ page }) => {
    // The day-after brunch is display-only, so it shows on the schedule but not on the form.
    await page.goto(`/i/${FAMILY}`);
    await expect(page.locator('body')).toContainText('Day-after brunch');
    await page.goto(`/i/${FAMILY}/rsvp`);
    await expect(page.locator('body')).not.toContainText('Day-after brunch');
  });

  test('saves a reply, persists it, and shows it again on return', async ({ page }) => {
    await page.goto(`/i/${SARAH}/rsvp`);

    await page.locator('input[name="name:0"]').fill('Sarah Khan');
    await page.locator('input[name="name:1"]').fill('Dilnawaz Rahim');

    const p1 = page.locator('section.rsvp-person').nth(0);
    const p2 = page.locator('section.rsvp-person').nth(1);
    await p1.locator('fieldset.person').nth(0).getByText('Will be there').click();
    await p2.locator('fieldset.person').nth(0).getByText(/Can.t make it/).click();

    await page.locator('input[name="medical:0"]').fill('Severe nut allergy');
    await page.getByLabel(/song that will get you dancing/i).fill('Aaj Rapat Jaayen');

    await page.getByRole('button', { name: /Send our reply/i }).click();
    await expect(page).toHaveURL(/saved=1/);
    await expect(page.getByText(/Saved, thank you/)).toBeVisible();

    // Reload from the database and confirm every field round-tripped.
    await page.goto(`/i/${SARAH}/rsvp`);
    await expect(page.locator('input[name="name:0"]')).toHaveValue('Sarah Khan');
    await expect(page.locator('input[name="name:1"]')).toHaveValue('Dilnawaz Rahim');
    await expect(page.locator('input[name="medical:0"]')).toHaveValue('Severe nut allergy');
    await expect(p1.locator('fieldset.person').nth(0).locator('input[value="attending"]')).toBeChecked();
    await expect(p2.locator('fieldset.person').nth(0).locator('input[value="declined"]')).toBeChecked();
  });

  test('a resubmission updates rather than duplicating', async ({ page }) => {
    await page.goto(`/i/${SARAH}/rsvp`);
    // Clear the second guest — they should disappear, not linger.
    await page.locator('input[name="name:1"]').fill('');
    await page.getByRole('button', { name: /Send our reply/i }).click();
    await expect(page).toHaveURL(/saved=1/);

    await page.goto(`/i/${SARAH}/rsvp`);
    await expect(page.locator('input[name="name:0"]')).toHaveValue('Sarah Khan');
    await expect(page.locator('input[name="name:1"]')).toHaveValue('');
  });

  test('offers adult meals to an adult, and not the kids menu', async ({ page }) => {
    await page.goto(`/i/${FAMILY}/rsvp`);
    const adult = page.locator('section.rsvp-person').nth(0);
    const nikkah = adult.locator('fieldset.person', { hasText: 'Nikkah' }).first();
    const options = (await nikkah.locator('select option').allTextContents()).join(' ');
    expect(options).toContain('Mutton biryani');
    // A $30 adult entree selected for a 10-year-old is real money, so the reverse must hold too.
    expect(options).not.toContain('Chicken & chips');
  });
});

test.describe('privacy headers', () => {
  test('token routes are noindex, no-referrer and uncached', async ({ request }) => {
    const h = (await request.get(`/i/${FAMILY}`)).headers();
    expect(h['x-robots-tag']).toContain('noindex');
    // A wedding site is full of outbound links; a weaker policy leaks the token to all of them.
    expect(h['referrer-policy']).toBe('no-referrer');
    expect(h['cache-control']).toContain('no-store');
  });

  test('the invitation page carries a GENERIC preview card', async ({ page }) => {
    // WhatsApp and iMessage fetch this server-side. It must say nothing about who or what.
    await page.goto(`/i/${FAMILY}`);
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBe('Your invitation');
  });

  test('robots.txt does not Disallow token paths', async ({ request }) => {
    // Disallowing them would stop the crawler ever seeing the noindex, so they could still be indexed.
    const res = await request.get('/robots.txt');
    if (res.status() === 200) {
      expect((await res.text()).toLowerCase()).not.toContain('disallow: /i');
    }
  });
});
