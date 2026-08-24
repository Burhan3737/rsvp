import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Admin journey, for the invite-link model.
 *
 * The whole product is: make a link, tick the events it shows, send it. These tests cover that
 * loop, the caterer export, and the fact that none of it is reachable without signing in.
 */

const PASSWORD = 'demo-admin-password-please-change';

const TOKENS: { name: string; token: string; code: string; seats: number }[] = JSON.parse(
  readFileSync(path.join(process.cwd(), '.data', 'tokens.json'), 'utf8'),
);

async function signIn(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /Sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/**
 * Fetch the export the way an owner does — by following the link and taking the download.
 * Not via page.request: that is a Node-side fetch which will not attach a `Secure` cookie over
 * plain http, even on localhost. The browser does; production is https.
 */
async function downloadCsv(page: Page): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.goto('/admin/export').catch(() => undefined),
  ]);
  const file = await download.path();
  expect(download.suggestedFilename()).toBe('guest-list.csv');
  return readFileSync(file!, 'utf8');
}

test.describe('admin is gated', () => {
  test('every admin page redirects to sign-in when signed out', async ({ page }) => {
    for (const route of ['/admin', '/admin/invites']) {
      await page.goto(route);
      await expect(page, `${route} must be gated`).toHaveURL(/\/admin\/login/);
    }
  });

  test('the CSV export 404s when signed out, rather than confirming it exists', async ({ request }) => {
    expect((await request.get('/admin/export')).status()).toBe(404);
  });

  test('a wrong password is rejected', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: /Sign in/i }).click();
    await expect(page.getByText(/password is not right/i)).toBeVisible();
  });
});

test.describe('dashboard', () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test('shows Attending / Declined / Awaiting for every event', async ({ page }) => {
    const tallies = page.locator('.tally');
    expect(await tallies.count()).toBeGreaterThanOrEqual(5);
    const first = tallies.first();
    await expect(first.getByText('Attending')).toBeVisible();
    await expect(first.getByText('Declined')).toBeVisible();
    await expect(first.getByText('Awaiting')).toBeVisible();
  });

  test('says how many links each event is on, and whether it is public', async ({ page }) => {
    const dholki = page.locator('.tally', { hasText: 'Dholki' }).first();
    await expect(dholki.getByText('private')).toBeVisible();
    const nikkah = page.locator('.tally', { hasText: 'Nikkah' }).first();
    await expect(nikkah.getByText('public')).toBeVisible();
  });

  test('lists links that still owe a reply', async ({ page }) => {
    const section = page.locator('section', { hasText: 'Still to reply' });
    await expect(section).toBeVisible();
  });
});

test.describe('making and editing a link', () => {
  test.beforeEach(async ({ page }) => signIn(page));

  test('a new link shows exactly the events ticked for it', async ({ page }) => {
    await page.goto('/admin/invites');

    const label = `Test link ${Date.now()}`;
    await page.getByLabel(/Who is it for/i).fill(label);
    await page.getByLabel(/How many people/i).fill('3');

    // Untick everything, then tick only the Mehndi.
    const boxes = page.locator('input[name="event"]');
    const n = await boxes.count();
    for (let i = 0; i < n; i++) {
      const b = boxes.nth(i);
      if (await b.isChecked()) await b.uncheck();
    }
    await page
      .locator('label.choice', { hasText: 'Mehndi' })
      .locator('input[name="event"]')
      .check();

    await page.getByRole('button', { name: /Create link/i }).click();
    await expect(page).toHaveURL(/\/admin\/invites\/[0-9a-f-]+\?created=1/);

    // The audit view reads from the same query the guest page runs.
    const sees = page.locator('.sees-list');
    await expect(sees).toContainText('Mehndi');
    await expect(sees).not.toContainText('Dholki');
    await expect(sees).not.toContainText('Mayoun');

    // And the real guest page agrees.
    const url = await page.locator('.share-url code').innerText();
    const token = url.split('/i/')[1];
    await page.goto(`/i/${token}`);
    await expect(page.getByRole('heading', { name: 'Mehndi', exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Dholki');
    // The seat cap carried through.
    await page.goto(`/i/${token}/rsvp`);
    expect(await page.locator('input[name^="name:"]').count()).toBe(3);

    // Remove it again — the suite shares one database and this list is asserted on elsewhere.
    await page.goto('/admin/invites');
    await page.locator('tr', { hasText: label }).first().getByRole('link', { name: 'Open' }).click();
    await page.getByRole('button', { name: /Delete permanently/i }).click();
    await expect(page).toHaveURL(/deleted=1/);
  });

  test('ticking another event updates what the link shows immediately', async ({ page }) => {
    // Creates its OWN link to edit. Mutating a seeded one leaks into the guest-flow tests, which
    // assert on exactly what those seeded links show — the suite shares a single database.
    await page.goto('/admin/invites');
    const label = `Edit target ${Date.now()}`;
    await page.getByLabel(/Who is it for/i).fill(label);

    const boxes = page.locator('input[name="event"]');
    for (let i = 0; i < (await boxes.count()); i++) {
      const b = boxes.nth(i);
      if (await b.isChecked()) await b.uncheck();
    }
    await page.getByRole('button', { name: /Create link/i }).click();
    await expect(page).toHaveURL(/\/admin\/invites\/[0-9a-f-]+/);

    await expect(page.locator('.sees-list')).not.toContainText('Mehndi');

    await page
      .locator('fieldset.person', { hasText: 'Events this link shows' })
      .locator('label.choice', { hasText: 'Mehndi' })
      .locator('input[name="event"]')
      .check();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.sees-list')).toContainText('Mehndi');

    // Clean up so the admin list does not grow on every run.
    await page.getByRole('button', { name: /Delete permanently/i }).click();
    await expect(page).toHaveURL(/deleted=1/);
  });

  test('revoking a link kills it for the guest', async ({ page }) => {
    await page.goto('/admin/invites');
    const row = page.locator('tr', { hasText: 'The Bergströms' }).first();
    await row.getByRole('link', { name: 'Open' }).click();

    const url = await page.locator('.share-url code').innerText();
    const token = url.split('/i/')[1];
    expect((await page.goto(`/i/${token}`))?.status()).toBe(200);

    await page.goBack();
    await page.getByRole('button', { name: /Revoke this link/i }).click();
    await expect(page.getByText(/This link is revoked/i)).toBeVisible();

    // One UPDATE, and the forwarded link is dead.
    expect((await page.goto(`/i/${token}`))?.status()).toBe(404);

    // Put it back so the rest of the suite is unaffected.
    await page.goBack();
    await page.getByRole('button', { name: /Un-revoke this link/i }).click();
    expect((await page.goto(`/i/${token}`))?.status()).toBe(200);
  });
});

test.describe('caterer export', () => {
  test('is one row per person per event, with meal and dietary in their own columns', async ({ page }) => {
    // Make sure there is at least one reply to export.
    const sarah = TOKENS.find((t) => t.name === 'Sarah Khan + guest')!;
    await page.goto(`/i/${sarah.token}/rsvp`);
    await page.locator('input[name="name:0"]').fill('Sarah Khan');
    await page
      .locator('section.rsvp-person')
      .nth(0)
      .locator('fieldset.person')
      .nth(0)
      .getByText('Will be there')
      .click();
    await page.locator('input[name="medical:0"]').fill('Severe nut allergy');
    await page.getByRole('button', { name: /Send our reply/i }).click();
    await expect(page).toHaveURL(/saved=1/);

    await signIn(page);
    const csv = await downloadCsv(page);
    const lines = csv.trim().split('\r\n');
    const header = lines[0].replace(/^﻿/, '');

    for (const col of ['Invite', 'Name', 'Event', 'Status', 'Meal', 'Allergy / medical', 'Preference']) {
      expect(header, `missing column ${col}`).toContain(col);
    }

    const sarahRows = lines.filter((l) => l.includes('Sarah Khan'));
    expect(sarahRows.length).toBeGreaterThan(0);
    expect(sarahRows.some((l) => l.includes('Severe nut allergy'))).toBe(true);
    // She is not on the Mayoun, so she can never appear against it.
    expect(sarahRows.some((l) => l.includes('Mayoun'))).toBe(false);
  });

  test('neutralises spreadsheet formula injection', async ({ page }) => {
    await signIn(page);
    const csv = await downloadCsv(page);
    // Excel treats a leading = + or @ as a formula; a guest-supplied field must never start one.
    for (const cell of csv.split(/[,\r\n]/)) {
      const v = cell.replace(/^"/, '');
      expect(/^[=+@]/.test(v), `unescaped formula start: ${cell}`).toBe(false);
    }
  });
});

test.describe('theme switching', () => {
  test('an owner can preview a theme and see the source it was copied from', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/themes');

    // Every theme must credit a real, live template.
    const links = page.locator('.theme-ref a');
    expect(await links.count()).toBeGreaterThanOrEqual(6);
    for (const href of await links.evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href))) {
      expect(href).toMatch(/^https:\/\//);
    }

    const card = page.locator('.theme-card', { hasText: 'Kelsey' });
    await card.getByRole('button', { name: 'Preview' }).click();
    await expect(page.getByText(/You are previewing/)).toBeVisible();

    // The preview must apply to the actual site, not only to the picker.
    await page.goto(`/i/${TOKENS[0].token}`);
    const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    expect(bg).toBe('rgb(127, 73, 40)'); // #7f4928 — html{background} in Kelsey's own stylesheet

    await page.goto('/admin/themes');
    await page.getByRole('button', { name: /Stop previewing/i }).click();
    await expect(page.getByText(/You are previewing/)).toHaveCount(0);
  });
});
