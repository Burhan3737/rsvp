# Stack Decisions & Free-Tier Traps

_Researched 2026-08-23. Total recurring cost: $0 (optionally ~$12/yr for a domain)._

> **Provenance warning.** The research agent that produced this initially fabricated several source
> citations, then self-corrected in a verification pass. Every row below is now tagged:
> **[V]** = verified by direct fetch of the primary source · **[U]** = UNVERIFIED, re-check before relying on it.
> Do not promote a **[U]** to a decision without checking it first.

## Chosen stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16.3.2 App Router + React 19 + Tailwind v4 | ISR gives no-redeploy content updates |
| Hosting | Vercel Hobby **[V]** | Free; a personal wedding site is within non-commercial fair use |
| Database | **Neon Free** via Vercel Marketplace **[V]** | The only free Postgres that never *pauses* — scale-to-zero after 5 min is a sub-second auto-resuming cold start, not a pause. 0.5 GB / 100 CU-hrs / 5 GB egress |
| DB driver | `@neondatabase/serverless` (HTTP) | No TCP pool to exhaust during an invite-blast burst |
| Email | **Resend** primary, **Postmark** fallback — behind a one-function adapter | See "Email is pluggable" below. Do NOT hard-wire a vendor |
| Guest access | Per-**household** opaque token, `randomBytes(16).toString('base64url')` = 22 chars / 128 bits, stored in DB, revocable | One UPDATE kills a forwarded link; a JWT cannot be revoked |
| Printed fallback | 10-char Crockford base32 `XXXXX-XXXXX`, separate indexed column, rate-limited | Typo-tolerant (I/L->1, O->0), case-insensitive, excludes U to avoid accidental obscenity |
| Content editing | DB `site_content` table + bespoke admin form | Owner is non-technical; labelled fields ("Ceremony time: [picker]") beat any CMS's "documents/content types" |
| Admin auth | Shared password -> HMAC-signed HttpOnly cookie via **Web Crypto** | Vercel's own Password Protection is Enterprise, or a **$150/mo** Pro add-on **[V]** |
| Testing | Vitest (pure logic) + Playwright (E2E/screenshots) + @axe-core/playwright **[V]** | Async Server Components CANNOT be unit-tested by Vitest — E2E is mandatory, not optional |

## Vercel Hobby limits **[V]** (checked 2026-08-23)

100 GB bandwidth/mo · 1M function invocations · 4 CPU-hrs · 300s max duration (Fluid) ·
100 deployments/day · 1 hr log retention · **cron minimum interval = ONCE PER DAY, ±59 min precision**.

## NON-NEGOTIABLE TRAPS

1. **[V] Hobby overage takes production OFFLINE** (`503 DEPLOYMENT_PAUSED`), resumes only manually,
   possibly after 30 days. **Spend Management is Pro-only — there is no safety valve on Hobby.**
   -> Compress every image, use `next/image`, never hotlink.
   -> Recommend budgeting ~$20 for Vercel Pro for the month spanning the wedding.
2. **[V] NO donation / cash-gift / honeymoon-fund widget.** Vercel: "Asking for Donations falls under
   commercial usage" and would violate Hobby terms. Link OUT to an external registry; collect nothing on-site.
3. **[U] Corporate email scanners (Safe Links / Mimecast / Proofpoint) pre-click every link.**
   Supporting issue numbers were unverified — but adopt it as a **defensive default regardless**:
   RSVP links MUST be idempotent and re-visitable. NEVER single-use / first-click-consumes.
   The cost of being wrong is zero; the cost of being right and ignoring it is a dead link for every
   guest with a corporate mailbox.
4. **[V] robots.txt Disallow SUPPRESSES noindex.** Quoted from Google: "If the page is blocked by
   robots.txt, the crawler will never see the noindex rule, and the page can still appear in search results."
   -> Use `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` + `metadata.robots`.
   -> Do NOT Disallow token paths in robots.txt.
5. **Referrer + analytics leak tokens.** -> `Referrer-Policy: no-referrer` on token routes,
   `rel="noreferrer noopener"` on every outbound registry/venue link, exclude `/i/*` from analytics.
6. **Link-preview bots (WhatsApp/iMessage/Slack) fetch token URLs server-side.**
   -> Return a GENERIC OG card for token routes. Never leak guest names into a group-chat preview.
7. **Persist the RSVP FIRST, send email SECOND.** A failed email must never lose the response.
8. **[V] Next.js 16: `middleware.ts` is deprecated and renamed to `proxy.ts`**; Proxy defaults to the
   Node.js runtime. Confirmed independently in the installed package (`PROXY_FILENAME` in
   `next/dist/lib/constants.js`). Next's own verbatim warning:
   > "A matcher change or a refactor that moves a Server Function to a different route can silently
   > remove Proxy coverage. Always verify authentication and authorization inside each Server Function
   > rather than relying on Proxy alone."

   And: "We recommend users avoid relying on Middleware unless no other options exist."
   -> Treat proxy as an optimistic UX gate ONLY. Re-verify auth inside every admin Server Action.
9. **Never `input === process.env.ADMIN_PASSWORD`** (timing leak). HMAC both sides, compare digests.
   Rate-limit login via a DB attempt counter (serverless has no shared memory): ~5 attempts/IP/15min.
10. **Scope each token to that household's own data only** — never the full guest list, never other
    guests' addresses.
11. Set a token kill-date ~2 weeks post-wedding (respond 410 Gone).

## Email is pluggable — do not hard-wire a vendor

The one claim that would have made this simple ("`onboarding@resend.dev` sends freely to your own account
address, no DNS needed") is **[U]** — Resend's docs actually state *"You must add and verify at least one
domain to send emails."* So:

- Define a single `sendOwnerNotification()` adapter. Vendor choice is one env var.
- **Resend [V]**: 100/day, 3,000/mo, **3 domains** (not 1 — earlier error), 30-day retention. Best Next.js SDK.
- **Postmark [V]**: 100/month free that "never expires or runs out", no credit card, **no approval gate**
  on any plan. Earlier report wrongly called this high-friction; it is genuinely competitive and has
  excellent deliverability. Strong fallback for owner-only notification at our volume.
- **Mailgun [V]**: 100/day free.
- **Brevo [U]**: likely the best no-domain option for *guest* emails; 300/day figure UNCONFIRMED (pages 403'd).
- **SendGrid: ruled out [V]** — 60-day trial only, no permanent free plan.
- **A ~$12/yr domain removes every one of these constraints** and is the only non-free item worth buying.

## Rejected

- **[V] Supabase free** — quoted: *"Free projects are paused after 1 week of inactivity."* That is EXACTLY
  the wedding failure mode: build Sep, collect Oct, quiet Nov, dead Dec, discovered by a guest.
  This single fact is the most important in the whole document.
- **[V] MongoDB Atlas M0** — paused after 30 days inactivity (data preserved), manual resume. ToS also
  reserves the right to deactivate idle free clusters.
- **[V] PlanetScale** — no free tier; cheapest PS-5 Postgres non-HA at $5/mo. **Xata [U]** — believed no free tier.
- **[V] Lucia** — deprecated March 2025, reframed as a learning resource, not a library.
- **[V] Sanity** — free datasets are **public-only**. Fine for marketing copy, NEVER for the guest list.
- **JSON/MDX edited via GitHub web UI** — one stray comma = a failed build the owner cannot diagnose.
- **Payload v3 on Vercel [U]** — reported 3-5s admin cold starts and PG connection exhaustion.

### Retracted from the first draft (were fabricated — do not reintroduce)

- ~~"Upstash Redis archived after ~30 days inactivity, endpoint URL changes"~~ — **invented.** Upstash free is
  256 MB / 500K commands/mo / 1 DB **[V]**; the only documented deletion is for *API-created temporary* DBs.
- ~~"SendGrid free plan retired 2025-05-27"~~ — date invented; the conclusion (no free plan) is still correct.
- ~~"Turso archives after ~10 days idle"~~ — **[U]**, the pricing page is silent in both directions.
  Turso free is generous (5 GB, 500M rows read/mo) but the company is mid-pivot; not worth the risk here.
- ~~"Cloudflare D1 does not sleep"~~ — that was an inference from silence, not a guarantee. **[U]**
- ~~"Firestore Spark hard-cliffs at quota"~~ — **[U]**; quotas confirmed, cutoff behaviour not.
- ~~AWS SES free tier closure date, Formspree/Web3Forms/Getform limits, Contentful/Prismic/Hygraph/
  Airtable/Notion rows~~ — all **[U]**.

## Optional hardening

- Nightly Vercel Cron -> mirror RSVPs into a Google Sheet. Free, never sleeps, and gives the family a
  spreadsheet they can actually use for seating.
  **[V] Sheets API: 300 read + 300 write per minute per project, 60/min per user, and explicitly
  "no limit to the number of requests that you can make per day."** At 500 guests we are ~4 orders of
  magnitude inside every limit.
  **[U] but design around it:** plain concurrent `values.append` can silently drop rows (it writes into
  existing cells). Use an atomic `batchUpdate` (`insertDimension` + `updateCells`), or serialize writes.
  Service-account `private_key` arrives from Vercel env with literal `\n` — `.replace(/\\n/g, '\n')`.
- UptimeRobot free monitor on production. Every critical risk above is either silent or needs manual
  intervention; a monitor converts "discovered by a guest" into "discovered by you."

## Windows / testing notes

- Playwright browsers live in `%USERPROFILE%\AppData\Local\ms-playwright`, not `node_modules` — they
  survive `rm -rf node_modules` but need re-download after a cache clear.
- `--with-deps` is Linux-CI only; a no-op locally. Don't cargo-cult it into local scripts.
- Use `webServer` in `playwright.config.ts` rather than a manual terminal — avoids orphaned processes,
  which don't clean up as reliably on Windows.
- Pin headless vs headed for screenshot baselines — font rendering differs and visual diffs will flap.
- `fullPage: true` is required for full-page screenshots (the most common omission).
- If PowerShell blocks npm: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.
