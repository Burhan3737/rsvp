import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Dual-driver Postgres access.
 *
 *  - Production (DATABASE_URL set): @neondatabase/serverless over HTTP. Chosen because the HTTP driver
 *    has no TCP pool to exhaust when the invitations land and every guest opens their link at once.
 *  - Dev / test (no DATABASE_URL): PGlite, real Postgres compiled to WASM, persisted under .data/pglite.
 *
 * Both speak the same dialect, so lib/db/schema.sql runs unmodified against either.
 */

export type Row = Record<string, unknown>;

interface Driver {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  kind: 'neon' | 'pglite';
}

let driverPromise: Promise<Driver> | null = null;

async function makeNeon(url: string): Promise<Driver> {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url);
  return {
    kind: 'neon',
    async query<T = Row>(text: string, params: unknown[] = []) {
      return (await sql.query(text, params)) as T[];
    },
  };
}

// PGlite must be a true singleton: two instances on the same directory corrupt each other, and Next's
// dev server re-evaluates modules on HMR. Stash it on globalThis so it survives reloads.
const PGLITE_KEY = Symbol.for('rsvp.pglite');

async function makePglite(): Promise<Driver> {
  const g = globalThis as unknown as Record<symbol, unknown>;
  if (!g[PGLITE_KEY]) {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), '.data', 'pglite');
    const db = await PGlite.create(dir);
    await db.exec(readFileSync(path.join(process.cwd(), 'lib', 'db', 'schema.sql'), 'utf8'));
    g[PGLITE_KEY] = db;
  }
  const db = g[PGLITE_KEY] as import('@electric-sql/pglite').PGlite;
  return {
    kind: 'pglite',
    async query<T = Row>(text: string, params: unknown[] = []) {
      const res = await db.query(text, params as never[]);
      return res.rows as T[];
    },
  };
}

function getDriver(): Promise<Driver> {
  if (!driverPromise) {
    const url = process.env.DATABASE_URL;
    driverPromise = url ? makeNeon(url) : makePglite();
  }
  return driverPromise;
}

/** Run a parameterised query. Always use $1/$2 placeholders — never interpolate into the string. */
export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const driver = await getDriver();
  return driver.query<T>(text, params);
}

/** Single-row convenience. Returns null rather than throwing when nothing matches. */
export async function queryOne<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Apply schema.sql. Idempotent — every statement is CREATE ... IF NOT EXISTS. */
export async function migrate(): Promise<void> {
  const driver = await getDriver();
  const sql = readFileSync(path.join(process.cwd(), 'lib', 'db', 'schema.sql'), 'utf8');
  if (driver.kind === 'pglite') {
    const g = globalThis as unknown as Record<symbol, unknown>;
    await (g[PGLITE_KEY] as import('@electric-sql/pglite').PGlite).exec(sql);
    return;
  }
  // Neon's HTTP driver runs one statement per call, so split on statement boundaries.
  for (const stmt of splitStatements(sql)) await driver.query(stmt);
}

/** Split SQL on semicolons that are not inside a quoted string or a line comment. */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = '';
  let quote: "'" | '"' | null = null;
  let lineComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      buf += ch;
      continue;
    }
    if (!quote && ch === '-' && next === '-') {
      lineComment = true;
      buf += ch;
      continue;
    }
    if (!quote && (ch === "'" || ch === '"')) {
      quote = ch;
      buf += ch;
      continue;
    }
    if (quote && ch === quote) {
      // Doubled quote is an escaped literal, not a terminator.
      if (next === quote) {
        buf += ch + next;
        i++;
        continue;
      }
      quote = null;
      buf += ch;
      continue;
    }
    if (!quote && ch === ';') {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
