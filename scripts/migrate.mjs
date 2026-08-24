/**
 * Apply the schema, and nothing else.
 *
 * Run: node scripts/migrate.mjs
 *
 * This exists because of a deployment trap. `lib/db/index.ts` applies `schema.sql` automatically
 * on the PGlite path — but NOT on the Neon path, which only wraps the query function. So a fresh
 * Neon database has no tables, and the first request to the deployed site fails on a missing
 * relation. The README used to say "/admin creates it on first query"; that was true locally and
 * false in production, which is the worst way for a claim to be wrong.
 *
 * The only other thing that applied the schema was `seed.mjs`, which also inserts the entire demo
 * wedding — fictional couple, six invented events, five demo households with working invite links.
 * Following the old instructions put all of that on a real public site.
 *
 * LOCALLY: stop `next dev` / `next start` first. PGlite is a single-process store — a running
 * server holds the directory lock, and this script will WAIT on it rather than failing, which
 * looks like a hang. With DATABASE_URL set (i.e. in production) there is no lock and no issue.
 *
 * Every statement in schema.sql is `CREATE ... IF NOT EXISTS` or an additive `ALTER TABLE ... ADD
 * COLUMN IF NOT EXISTS`, so this is safe to run against a live database and safe to run twice.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

const url = process.env.DATABASE_URL;

/** Split on semicolons that are not inside a quoted string or a line comment. */
function splitStatements(sql) {
  const out = [];
  let buf = '';
  let quote = null;
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
    if (quote) {
      if (ch === quote) quote = null;
      buf += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === ';') {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

const sql = readFileSync(path.join(process.cwd(), 'lib', 'db', 'schema.sql'), 'utf8');

if (url) {
  const { neon } = await import('@neondatabase/serverless');
  const run = neon(url);
  // Neon's HTTP driver takes one statement per call.
  const statements = splitStatements(sql);
  for (const stmt of statements) await run.query(stmt);
  console.log(`Schema applied to Neon (${statements.length} statements). No content was inserted.`);
} else {
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), '.data', 'pglite');
  const db = await PGlite.create(dir);
  await db.exec(sql);
  console.log(`Schema applied to the local PGlite store at ${dir}. No content was inserted.`);
}
