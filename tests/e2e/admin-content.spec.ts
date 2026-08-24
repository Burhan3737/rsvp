import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Editing the wedding from the browser.
 *
 * The product promised "no redeploy needed to change a time or a venue" while the only writable
 * things in the admin were invite links and the theme. Everything a guest actually reads — the
 * names, the date, the schedule, the dress code, the questions — lived in `scripts/seed.mjs`, so
 * changing a venue meant a code edit, a commit and a deploy.
 *
 * What these tests hold to is the round trip: an owner types something in the admin, and a guest
 * sees it. Not that a form exists — that a save reaches the page a guest opens.
 */

const PASSWORD = 'demo-admin-password-please-change';

const TOKENS: { name: string; token: string }[] = JSON.parse(
  readFileSync(path.join(process.cwd(), '.data', 'tokens.json'), 'utf8'),
);
const INVITE = `/i/${TOKENS[0].token}`;

/**
 * The block whose title field holds this text.
 *
 * NOT `locator('.admin-block', { hasText })` — every title here lives in an `<input>`, and an
 * input's value is an attribute, not text content, so a text filter matches nothing at all.
 */
function blockTitled(page: Page, value: string) {
  return page.locator('.admin-block').filter({ has: page.locator(`input[value="${value}"]`) });
}

async function signIn(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /Sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe('the wedding is editable without a deploy', () => {
  test('none of the content editors are reachable signed out', async ({ page }) => {
    // Every one of these can write to the database. The gate is checked in the page AND in each
    // Server Action, because this app has no proxy or middleware to rely on.
    for (const route of ['/admin/content', '/admin/events', '/admin/pages']) {
      await page.goto(route);
      await expect(page, `${route} must send a stranger to the login`).toHaveURL(/\/admin\/login/);
    }
  });

  test('changing the tagline changes what a guest reads', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/content');

    // Everything here writes to the one row every other spec in the suite reads from, and the
    // runner is single-worker and ordered — so a test that changes the wedding and walks away
    // hands its mess to every file that runs after it. Captured and restored.
    const original = await page.getByLabel('Tagline').inputValue();
    const date = await page.getByLabel('The date').inputValue();

    const tagline = `Five days in Karachi ${Date.now().toString().slice(-5)}`;
    await page.getByLabel('Tagline').fill(tagline);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/Saved/)).toBeVisible();

    // The round trip that matters: the guest page, not the form we just submitted.
    await page.goto(INVITE);
    await expect(page.locator('.hero-tagline')).toHaveText(tagline);

    // The date must have survived a save it was not even about. It did not, once: the field was
    // handed a Date object, rendered blank, and saved the blank back over the wedding date.
    await page.goto('/admin/content');
    expect(await page.getByLabel('The date').inputValue(), 'saving cleared the wedding date').toBe(date);

    await page.getByLabel('Tagline').fill(original);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/Saved/)).toBeVisible();
  });

  test('an event can be created, filled in, seen by a guest, and removed', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/events');

    const name = `Qawwali night ${Date.now().toString().slice(-5)}`;
    await page.getByLabel('Add an event').fill(name);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText(/Event created/)).toBeVisible();

    const editorUrl = page.url();

    await page.getByLabel('Venue', { exact: true }).fill('Mohatta Palace');
    await page.getByLabel('Dress code', { exact: true }).fill('Anything you can sit on the floor in');
    // Public, so an anonymous visitor can see it without an invite link — which is what makes the
    // next assertion a real end-to-end check rather than an admin-only one.
    await page.getByLabel(/Show on the public page/).check();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/Saved/)).toBeVisible();

    await page.goto('/');
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(page.locator('body')).toContainText('Mohatta Palace');
    await expect(page.locator('body')).toContainText('Anything you can sit on the floor in');

    await page.goto(editorUrl);
    await page.getByText('Delete this event', { exact: true }).click();
    await page.getByRole('button', { name: /Yes, delete it/i }).click();
    await expect(page.getByText(/Event deleted/)).toBeVisible();

    await page.goto('/');
    await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(0);
  });

  test('every event row offers Edit and Delete by name', async ({ page }) => {
    // Both actions existed from the first version of this page, reachable only by clicking the
    // event's NAME — which reads as a heading, not a control. Somebody looking for "edit" did not
    // find it, and an action nobody can find is an action that is not there.
    await signIn(page);
    await page.goto('/admin/events');

    const rows = page.locator('.admin-row');
    const n = await rows.count();
    expect(n, 'the seed has events to list').toBeGreaterThan(0);

    for (let i = 0; i < n; i++) {
      const row = rows.nth(i);
      await expect(row.getByRole('link', { name: 'Edit' })).toBeVisible();
      await expect(row.getByText('Delete', { exact: true })).toBeVisible();
    }

    // Edit goes to the editor for THAT event, not merely to some editor.
    const name = await rows.first().locator('.admin-row-title').innerText();
    await rows.first().getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(name);
  });

  test('deleting from the list takes two deliberate steps', async ({ page }) => {
    // A list of eight similar rows is exactly where a mis-aimed click costs you an event and the
    // replies guests already gave for it. The confirmation is a native <details>, so it works with
    // JavaScript off — the same reason every form in this project is a plain form.
    await signIn(page);
    await page.goto('/admin/events');

    const name = `Doomed event ${Date.now().toString().slice(-5)}`;
    await page.getByLabel('Add an event').fill(name);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText(/Event created/)).toBeVisible();

    await page.goto('/admin/events');
    const row = page.locator('.admin-row').filter({ hasText: name });
    await expect(row).toHaveCount(1);

    // Closed by default: the button that actually deletes must not be reachable in one click.
    const confirm = row.getByRole('button', { name: /Yes, delete it/i });
    await expect(confirm).toBeHidden();

    await row.getByText('Delete', { exact: true }).click();
    await expect(row.getByText(/There is no undo/)).toBeVisible();
    await confirm.click();

    await expect(page.getByText(/Event deleted/)).toBeVisible();
    await expect(page.locator('.admin-row').filter({ hasText: name })).toHaveCount(0);
  });

  test('colour swatches survive the round trip as colours, not words', async ({ page }) => {
    // The swatches are the reason the attire block exists: a guest sees the exact marigold rather
    // than the word "yellow". They are stored as JSON and edited as text, so the parse in both
    // directions is worth holding down.
    await signIn(page);

    // Edit an event this invitation can actually SEE. "The first row in the admin list" is not that
    // — the list holds every event in the wedding, and a new event defaults to today's date, so
    // anything created and left behind sorts above the real schedule. Taking the name off the guest
    // page first makes the round trip a genuine one instead of an assumption.
    await page.goto(INVITE);
    const target = (await page.locator('.schedule-name').first().innerText()).trim();

    await page.goto('/admin/events');
    await page.locator('.admin-row').filter({ hasText: target }).first()
      .getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(target);

    const wear = await page.getByLabel('Colours to wear').inputValue();
    const avoid = await page.getByLabel('Colours to avoid').inputValue();

    await page.getByLabel('Colours to wear').fill('#f4c430 Marigold\n#0b6e4f Deep green');
    await page.getByLabel('Colours to avoid').fill('#ffffff White | the bride wears white');
    const editor = page.url();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/Saved/)).toBeVisible();

    // Re-read the form: what was parsed must be what is shown back, or an owner loses edits.
    await expect(page.getByLabel('Colours to wear')).toHaveValue(
      '#f4c430 Marigold\n#0b6e4f Deep green',
    );
    await expect(page.getByLabel('Colours to avoid')).toHaveValue(
      '#ffffff White | the bride wears white',
    );

    // And the guest sees actual swatch colours.
    await page.goto(INVITE);
    const dots = page.locator('.swatch-dot');
    expect(await dots.count()).toBeGreaterThan(0);
    const colours = await dots.evaluateAll((els) =>
      els.map((e) => getComputedStyle(e).backgroundColor),
    );
    expect(colours).toContain('rgb(244, 196, 48)');

    // Put the event's own colours back — later specs assert against the seeded palette.
    await page.goto(editor);
    await page.getByLabel('Colours to wear').fill(wear);
    await page.getByLabel('Colours to avoid').fill(avoid);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/Saved/)).toBeVisible();
  });

  test('a question added in the admin appears in the FAQ', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/pages?section=faq');

    const question = `Is there parking at the hall ${Date.now().toString().slice(-5)}?`;
    await page.getByLabel('Question').last().fill(question);
    await page.getByLabel('Answer').last().fill('Yes, and it is free after six.');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('Saved').first()).toBeVisible();

    await page.goto(INVITE);
    await expect(page.locator('.faq')).toContainText(question);
    await expect(page.locator('.faq')).toContainText('Yes, and it is free after six.');

    // Clean up so the suite can run twice.
    await page.goto('/admin/pages?section=faq');
    const row = blockTitled(page, question);
    await row.getByText('Delete', { exact: true }).click();
    await row.getByRole('button', { name: /Yes, delete it/i }).click();
    await expect(page.getByText(/Deleted/)).toBeVisible();
  });

  test('hiding a block removes it from the site but keeps it in the editor', async ({ page }) => {
    // Otherwise the only way to take something down is to delete it, and the only way to put it
    // back is to remember what it said.
    await signIn(page);
    await page.goto('/admin/pages?section=travel');

    const first = page.locator('.admin-block').first();
    const title = await first.getByLabel('Heading').inputValue();
    await first.getByLabel('Show on the site').uncheck();
    await first.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/Saved/)).toBeVisible();

    await page.goto(INVITE);
    await expect(page.locator('#travel')).not.toContainText(title);

    await page.goto('/admin/pages?section=travel');
    const back = blockTitled(page, title);
    await expect(back).toHaveCount(1);
    await back.getByLabel('Show on the site').check();
    await back.getByRole('button', { name: 'Save', exact: true }).click();

    await page.goto(INVITE);
    await expect(page.locator('#travel')).toContainText(title);
  });

  test('a submitted form cannot write past what the field allows', async ({ page }) => {
    // `maxlength` is a convenience for the person typing, not a constraint on what arrives — a
    // Server Action is a public endpoint. The clamping happens server-side; this checks it does.
    await signIn(page);
    await page.goto('/admin/content');

    const before = await page.getByLabel('Grace period (hours)').inputValue();
    await page.getByLabel('Grace period (hours)').evaluate((el: HTMLInputElement) => {
      el.removeAttribute('max');
      el.value = '99999';
    });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/Saved/)).toBeVisible();
    // 168 is the documented ceiling — a week.
    await expect(page.getByLabel('Grace period (hours)')).toHaveValue('168');

    await page.getByLabel('Grace period (hours)').fill(String(before));
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/Saved/)).toBeVisible();
  });
});
