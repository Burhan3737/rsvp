import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { isAdmin, passwordMatches, setAdminCookie } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { hashIp } from '@/lib/tokens';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

/**
 * Rate limiting is the real vulnerability here, far more than any crypto detail: a single shared
 * password with unlimited guesses is the whole attack. Serverless has no shared memory, so the
 * counter lives in the database we already have.
 */
async function currentIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  return hashIp(ip);
}

/** Only FAILED guesses count. A correct password is not evidence of an attack. */
async function tooManyFailures(ipHash: string): Promise<boolean> {
  const row = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM attempts
      WHERE kind = 'admin_login' AND ip_hash = $1 AND at > now() - interval '15 minutes'`,
    [ipHash],
  );
  return Number(row?.n ?? 0) >= 5;
}

async function signIn(formData: FormData) {
  'use server';
  const ipHash = await currentIpHash();
  if (await tooManyFailures(ipHash)) redirect('/admin/login?e=throttled');

  const password = String(formData.get('password') ?? '');

  if (!(await passwordMatches(password))) {
    // Record the FAILURE only. Counting successful sign-ins towards a lockout meant an owner who
    // mistyped twice, succeeded, and came back later was locked out of their own guest list.
    await query(`INSERT INTO attempts (kind, ip_hash) VALUES ('admin_login', $1)`, [ipHash]);
    redirect('/admin/login?e=bad');
  }

  // A correct password clears the slate for this address.
  await query(`DELETE FROM attempts WHERE kind = 'admin_login' AND ip_hash = $1`, [ipHash]);

  await setAdminCookie();
  redirect('/admin');
}

export default async function AdminLogin({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  if (await isAdmin()) redirect('/admin');
  const { e } = await searchParams;
  const configured = Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_SECRET);

  return (
    <main id="main" className="section admin">
      <div className="shell" style={{ maxWidth: 420 }}>
        <h1 className="display display-md">Organisers</h1>

        {!configured ? (
          <p className="notice notice-warn">
            Admin is not configured yet. Set <code>ADMIN_PASSWORD</code> and <code>ADMIN_SECRET</code>{' '}
            in your environment, then reload. See <code>.env.example</code>.
          </p>
        ) : null}

        {e === 'bad' ? (
          <p className="notice notice-warn" role="alert">That password is not right.</p>
        ) : null}
        {e === 'throttled' ? (
          <p className="notice notice-warn" role="alert">
            Too many attempts. Wait fifteen minutes and try again.
          </p>
        ) : null}

        <form action={signIn}>
          <p className="field-row">
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              className="field"
              autoComplete="current-password"
              required
            />
          </p>
          <button className="btn" type="submit" disabled={!configured}>Sign in</button>
        </form>
      </div>
    </main>
  );
}
