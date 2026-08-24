import 'server-only';
import { cookies, headers } from 'next/headers';

/**
 * Admin gate: one shared password, exchanged for an HMAC-signed HttpOnly cookie.
 *
 * Why not Vercel's own Password Protection: on the Hobby plan "your production domain remains
 * publicly accessible", and the real thing costs $20/mo (Pro) plus a $150/mo add-on. For a page
 * whose worst-case compromise is "someone sees the guest list", $170/mo is not proportionate.
 *
 * Web Crypto rather than node:crypto so the same code runs unchanged in both the Node and Edge
 * runtimes — which matters because Next 16 renamed middleware to proxy and changed its default
 * runtime. Nothing here should care which one it lands in.
 *
 * IMPORTANT: proxy/middleware is an optimistic UX gate ONLY. Next's own docs warn that "a matcher
 * change or a refactor that moves a Server Function to a different route can silently remove Proxy
 * coverage", so every admin action re-checks with requireAdmin().
 */

const COOKIE = 'rsvp_admin';
const TTL_MS = 12 * 60 * 60 * 1000;
const enc = new TextEncoder();

function secret(): string {
  const s = process.env.ADMIN_SECRET;
  if (!s) throw new Error('ADMIN_SECRET is not set');
  return s;
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const unb64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export async function mintCookie(ttlMs = TTL_MS): Promise<string> {
  const exp = String(Date.now() + ttlMs);
  const sig = await crypto.subtle.sign('HMAC', await key(), enc.encode(exp));
  return `${exp}.${b64url(sig)}`;
}

export async function verifyCookie(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const [exp, sig] = value.split('.');
  if (!exp || !sig) return false;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  try {
    // crypto.subtle.verify is constant-time, which a `===` on the digest would not be.
    return await crypto.subtle.verify('HMAC', await key(), unb64url(sig), enc.encode(exp));
  } catch {
    return false;
  }
}

/**
 * Compare the submitted password to the configured one WITHOUT a timing leak.
 * `input === process.env.ADMIN_PASSWORD` short-circuits on the first differing byte and leaks the
 * password one character at a time. HMAC both sides under a fresh random key and compare digests.
 */
export async function passwordMatches(input: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD ?? '';
  if (!expected) return false;

  const nonce = crypto.getRandomValues(new Uint8Array(32));
  const k = await crypto.subtle.importKey('raw', nonce, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const [a, b] = await Promise.all([
    crypto.subtle.sign('HMAC', k, enc.encode(input)),
    crypto.subtle.sign('HMAC', k, enc.encode(expected)),
  ]);
  const va = new Uint8Array(a);
  const vb = new Uint8Array(b);
  let diff = va.length ^ vb.length;
  for (let i = 0; i < Math.min(va.length, vb.length); i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

export async function isAdmin(): Promise<boolean> {
  try {
    return await verifyCookie((await cookies()).get(COOKIE)?.value);
  } catch {
    return false;
  }
}

/** Call this at the top of EVERY admin page and EVERY admin Server Action. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    const { redirect } = await import('next/navigation');
    redirect('/admin/login');
  }
}

/**
 * Only mark the cookie Secure when the request actually arrived over https.
 *
 * A Secure cookie sent over plain http is simply dropped by the browser, so setting it
 * unconditionally in a production build does not add security — it just makes the app appear to
 * sign you straight back out anywhere TLS is not terminated in front of it. On Vercel this is
 * always https, so the flag is always on where it matters.
 */
async function isHttps(): Promise<boolean> {
  try {
    const h = await headers();
    const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim();
    if (proto) return proto === 'https';
    return false;
  } catch {
    return process.env.NODE_ENV === 'production';
  }
}

export async function setAdminCookie(): Promise<void> {
  (await cookies()).set(COOKIE, await mintCookie(), {
    httpOnly: true,
    secure: await isHttps(),
    // Lax, not Strict. Strict is not sent on ANY cross-site request, including a plain GET link —
    // so following the CSV export link from an email or a bookmark looked like being signed out.
    // Lax still withholds the cookie on cross-site POST, which is what actually protects the
    // Server Actions from CSRF.
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_MS / 1000,
  });
}

export async function clearAdminCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Rotating ADMIN_SECRET invalidates every issued cookie at once — the panic button. */
export const ADMIN_COOKIE_NAME = COOKIE;
