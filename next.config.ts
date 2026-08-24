import type { NextConfig } from 'next';

/**
 * Header policy for invitation-token routes.
 *
 * A token in a URL is a bearer credential in plaintext. The headers below close the three ways it
 * leaks without anyone doing anything wrong:
 *
 *  - `Referrer-Policy: no-referrer` — a wedding site is full of outbound links (venues, hotels,
 *    registries). Any weaker policy sends the full path, INCLUDING the token, to those third parties.
 *  - `X-Robots-Tag` — belt and braces with the per-route `metadata.robots`. Note we deliberately do
 *    NOT add a robots.txt Disallow for /i/: Google is explicit that a page blocked by robots.txt is
 *    never crawled, so the crawler never sees `noindex`, and the URL can still be indexed.
 *  - `Cache-Control: private, no-store` — keeps a household's page out of any shared cache.
 */
const TOKEN_HEADERS = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // PGlite ships a WASM binary and resolves its own assets from disk at runtime. Bundling it breaks
  // that resolution (it ends up handing a URL where a path string is expected), so it must stay
  // external. Only used in dev/test; production uses the Neon HTTP driver.
  serverExternalPackages: ['@electric-sql/pglite'],

  async headers() {
    // ORDER MATTERS. Next applies every matching rule in order and a later rule wins for the same
    // header key, so the broad baseline must come FIRST and the stricter token rules LAST. With the
    // order reversed, the catch-all silently downgraded /i/* to strict-origin-when-cross-origin,
    // which leaks the invitation token to every outbound venue and registry link.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      { source: '/i/:token*', headers: TOKEN_HEADERS },
      { source: '/find', headers: TOKEN_HEADERS },
      { source: '/admin/:path*', headers: TOKEN_HEADERS },
    ];
  },
};

export default nextConfig;
