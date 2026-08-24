import { createHash, randomBytes } from 'node:crypto';

/**
 * Two credentials per household, deliberately separate:
 *
 *  1. `token`  — 128 bits, 22 URL chars. Goes in the link you text/email. Never typed by a human.
 *  2. `code`   — 50 bits, 10 chars in Crockford base32, shown as XXXXX-XXXXX. Printed on the invitation
 *                for anyone who won't scan a QR. Weaker, so it lives in its own indexed column and gets
 *                its own stricter rate limit.
 *
 * Collisions are the wrong thing to worry about. With a few hundred live tokens in a 2^128 space a blind
 * guess is hopeless; beyond ~96 bits more entropy buys nothing and rate limiting buys everything.
 */

/** 128-bit URL-safe token. 22 characters, no padding, double-click-selectable (no dashes). */
export function newToken(): string {
  return randomBytes(16).toString('base64url');
}

/**
 * Crockford base32 — chosen deliberately over plain base32/hex:
 *  - excludes I, L, O and U
 *  - decodes I and L to 1, and O to 0, so the most common transcription typos still resolve
 *  - is case-insensitive
 *  - excludes U specifically to avoid accidental obscenity, which genuinely matters when you are
 *    printing a hundred random codes onto wedding stationery
 */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function newCode(length = 10): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += CROCKFORD[bytes[i] % 32];
  return out;
}

/** Display form: ABCDE-FGHJK. Hyphen is presentational only and is stripped on input. */
export function formatCode(code: string): string {
  const c = normaliseCode(code);
  if (c.length <= 5) return c;
  return `${c.slice(0, 5)}-${c.slice(5)}`;
}

/**
 * Canonicalise user-typed input to the stored form.
 * Applies Crockford's forgiving substitutions so "oil" and "01L" both land on "011".
 */
export function normaliseCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s\-_]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')
    .split('')
    .filter((ch) => CROCKFORD.includes(ch))
    .join('');
}

export function isValidCodeShape(input: string, length = 10): boolean {
  return normaliseCode(input).length === length;
}

/**
 * Hash an IP for the rate-limit table. We never want raw addresses at rest, and the salt means the
 * table is not a rainbow-table lookup if it leaks.
 */
export function hashIp(ip: string, salt = process.env.IP_SALT ?? 'rsvp-dev-salt'): string {
  // A plain SHA-256 is right here: this is not a password, it never needs to be slow, and the salt
  // is what stops the table being a rainbow-table lookup if it ever leaks.
  return createHash('sha256').update(`${salt}:${ip}`).digest('base64url').slice(0, 22);
}
