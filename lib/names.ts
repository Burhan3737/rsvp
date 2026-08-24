/**
 * Tolerant guest-name matching.
 *
 * This exists because strict matching is the wedding industry's open wound. WithJoy's own documentation
 * concedes that "Chris Smith" will only match "Chris Smith", not "Christopher Smith". Zola temporarily
 * locks a guest out after repeated failures. A WeddingWire user reported lookup problems "affecting about
 * 20% of invites". And the failure message a guest actually receives reads as "you are not invited".
 *
 * So: normalise aggressively, allow small edit distances, understand nicknames and common transliteration
 * variants, and always return candidates rather than a yes/no.
 *
 * Pure functions only — no DB, no I/O — so this is fully unit-testable.
 */

export interface GuestLike {
  id: string;
  first_name: string;
  last_name: string;
  household_id: string;
}

export interface MatchCandidate {
  guest: GuestLike;
  score: number; // 0..1, higher is better
}

/** Lowercase, strip diacritics, drop punctuation and honorifics, collapse whitespace. */
export function normaliseName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining accents
    .toLowerCase()
    .replace(/\b(mr|mrs|ms|miss|dr|prof|sir|dame|shri|smt|hafiz|syed|sh|mx)\.?\b/g, ' ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nameParts(input: string): string[] {
  return normaliseName(input).split(' ').filter(Boolean);
}

/**
 * Nickname equivalence classes. Each inner array is a set of mutually-interchangeable forms.
 * Includes the South Asian and Arabic transliteration variants that break naive matching, since those
 * are exactly the names a Latin-alphabet exact-match will fail on.
 */
const NICKNAME_CLASSES: string[][] = [
  ['christopher', 'chris', 'kris'],
  ['william', 'will', 'bill', 'billy', 'liam'],
  ['katherine', 'catherine', 'kathryn', 'kate', 'katie', 'kathy', 'cathy', 'kat'],
  ['david', 'dave', 'davy'],
  ['michael', 'mike', 'mick', 'micky'],
  ['robert', 'rob', 'bob', 'bobby', 'bert'],
  ['richard', 'rick', 'dick', 'richie'],
  ['elizabeth', 'liz', 'beth', 'betty', 'eliza', 'lizzie'],
  ['margaret', 'maggie', 'meg', 'peggy'],
  ['jennifer', 'jen', 'jenny'],
  ['jonathan', 'jon', 'john', 'johnny', 'jack'],
  ['james', 'jim', 'jimmy', 'jamie'],
  ['thomas', 'tom', 'tommy'],
  ['anthony', 'tony', 'ant'],
  ['nicholas', 'nick', 'nicky'],
  ['alexander', 'alex', 'xander', 'sasha'],
  ['samuel', 'sam', 'sammy'],
  ['daniel', 'dan', 'danny'],
  ['matthew', 'matt'],
  ['benjamin', 'ben', 'benji'],
  ['stephen', 'steven', 'steve'],
  ['patricia', 'pat', 'patty', 'tricia'],
  ['rebecca', 'becca', 'becky'],
  ['susan', 'sue', 'susie'],
  ['deborah', 'deb', 'debbie'],
  ['charles', 'charlie', 'chuck'],
  ['edward', 'ed', 'eddie', 'ted'],
  ['joseph', 'joe', 'joey'],
  ['andrew', 'andy', 'drew'],
  // South Asian / Arabic transliteration variants
  ['muhammad', 'mohammad', 'mohammed', 'mohamed', 'muhammed', 'mohd', 'md'],
  ['ahmed', 'ahmad'],
  ['abdul', 'abd', 'abdel'],
  ['hussain', 'hussein', 'husain', 'hosein'],
  ['hasan', 'hassan'],
  ['aisha', 'ayesha', 'aysha'],
  ['fatima', 'fatimah', 'fathima'],
  ['imran', 'emran'],
  ['zainab', 'zaynab', 'zeinab'],
  ['khadija', 'khadeeja', 'khadijah'],
  ['yusuf', 'yousuf', 'yousaf', 'youssef', 'joseph'],
  ['ibrahim', 'ebrahim'],
  ['sara', 'sarah'],
  ['maryam', 'mariam', 'marium'],
  ['ali', 'aly'],
  ['omar', 'umar'],
  ['usman', 'uthman', 'osman'],
  ['siddiqui', 'siddiqi', 'sidiqui'],
  ['qureshi', 'quraishi', 'kureshi'],
  ['chaudhry', 'chaudhary', 'chowdhury', 'choudhry', 'chaudry'],
  ['sheikh', 'shaikh', 'shaykh'],
  ['rehman', 'rahman', 'urrehman'],
  ['priya', 'preeya'],
  ['sanjay', 'sanjai'],
];

const NICKNAME_MAP = (() => {
  const map = new Map<string, number>();
  NICKNAME_CLASSES.forEach((cls, i) => cls.forEach((n) => map.set(n, i)));
  return map;
})();

/** True when two name parts are the same person's name in a different form. */
export function isNicknameMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const ca = NICKNAME_MAP.get(a);
  const cb = NICKNAME_MAP.get(b);
  return ca !== undefined && ca === cb;
}

/** Iterative Levenshtein with a single rolling row. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Edit-distance tolerance that scales with length: short names get less slack than long ones. */
function tolerance(len: number): number {
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  return 2;
}

/** Score a single typed part against a single stored part. 0 = no match. */
export function scorePart(typed: string, stored: string): number {
  if (!typed || !stored) return 0;
  if (typed === stored) return 1;
  if (isNicknameMatch(typed, stored)) return 0.95;
  // A confident prefix: "chris" typed against "christopher" stored, or an initial.
  if (stored.startsWith(typed) && typed.length >= 3) return 0.85;
  if (typed.startsWith(stored) && stored.length >= 3) return 0.85;
  const dist = levenshtein(typed, stored);
  const allowed = tolerance(Math.max(typed.length, stored.length));
  if (dist <= allowed) return Math.max(0, 0.8 - dist * 0.15);
  return 0;
}

/**
 * Match typed input against the guest list.
 *
 * Handles: full name, first only, last only, reversed order, extra middle names, and typos.
 * Returns every plausible candidate sorted best-first — the caller decides whether one is confident
 * enough to auto-select or whether to show a disambiguation list.
 */
export function matchGuests(input: string, guests: GuestLike[], minScore = 0.5): MatchCandidate[] {
  const typed = nameParts(input);
  if (!typed.length) return [];

  const results: MatchCandidate[] = [];

  for (const guest of guests) {
    const first = normaliseName(guest.first_name);
    const last = normaliseName(guest.last_name);
    const stored = [...first.split(' '), ...last.split(' ')].filter(Boolean);
    if (!stored.length) continue;

    // Greedy best-pairing: each typed part claims its best unused stored part.
    const used = new Set<number>();
    let total = 0;
    for (const t of typed) {
      let best = 0;
      let bestIdx = -1;
      stored.forEach((s, i) => {
        if (used.has(i)) return;
        const sc = scorePart(t, s);
        if (sc > best) {
          best = sc;
          bestIdx = i;
        }
      });
      if (bestIdx >= 0) {
        used.add(bestIdx);
        total += best;
      }
    }

    // Normalise by how much the guest typed, so "sarah" against "Sarah Khan" is a strong single-part
    // match rather than a half-failed two-part one. Then damp single-part matches slightly, because a
    // first name alone is genuinely more ambiguous than a full name.
    let score = total / typed.length;
    const matchedParts = used.size;
    if (matchedParts === 0) continue;
    if (typed.length === 1 && stored.length > 1) score *= 0.82;
    // Reward matching both a first and a last name.
    if (matchedParts >= 2) score = Math.min(1, score * 1.05);

    if (score >= minScore) results.push({ guest, score: Number(score.toFixed(4)) });
  }

  return results.sort((a, b) => b.score - a.score || a.guest.id.localeCompare(b.guest.id));
}

/**
 * Mask a candidate for display to someone we have NOT yet authenticated.
 * "Sarah Khan" -> "Sarah K." Never reveal full surnames or addresses on a disambiguation screen:
 * an open lookup that echoes full names is an information leak, and real users have complained that a
 * failed lookup showed them "a list of similar names & the town that guest was from".
 */
export function maskName(guest: GuestLike): string {
  const last = guest.last_name.trim();
  return last ? `${guest.first_name.trim()} ${last[0].toUpperCase()}.` : guest.first_name.trim();
}

/** True when the top candidate is clearly ahead of the runner-up and strong on its own. */
export function isConfident(candidates: MatchCandidate[]): boolean {
  if (!candidates.length) return false;
  const [top, second] = candidates;
  if (top.score < 0.82) return false;
  if (!second) return true;
  // Same household means the disambiguation is cosmetic; we can proceed either way.
  if (second.guest.household_id === top.guest.household_id) return true;
  return top.score - second.score >= 0.12;
}
