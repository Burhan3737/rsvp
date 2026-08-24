import { describe, expect, it } from 'vitest';
import {
  isConfident,
  isNicknameMatch,
  levenshtein,
  maskName,
  matchGuests,
  nameParts,
  normaliseName,
  scorePart,
  type GuestLike,
} from '@/lib/names';

const g = (id: string, first: string, last: string, household = `h-${id}`): GuestLike => ({
  id,
  first_name: first,
  last_name: last,
  household_id: household,
});

// A guest list with the traps that break naive matching: a nickname, a diacritic, a transliteration
// variant, two people sharing a first name, and two people sharing a surname in one household.
const GUESTS: GuestLike[] = [
  g('1', 'Christopher', 'Smith', 'hA'),
  g('2', 'Zoë', 'Bergström', 'hB'),
  g('3', 'Muhammad', 'Qureshi', 'hC'),
  g('4', 'Ayesha', 'Qureshi', 'hC'),
  g('5', 'Sarah', 'Khan', 'hD'),
  g('6', 'Sarah', 'Okonkwo', 'hE'),
  g('7', 'Katherine', 'Wing-Lam', 'hF'),
  g('8', "Niamh", "O'Brien", 'hG'),
];

describe('normaliseName', () => {
  it('strips diacritics', () => {
    expect(normaliseName('Zoë Bergström')).toBe('zoe bergstrom');
    expect(normaliseName('José')).toBe('jose');
  });

  it('strips honorifics and punctuation', () => {
    expect(normaliseName("Dr. Niamh O'Brien")).toBe('niamh obrien');
    expect(normaliseName('Mrs Katherine Wing-Lam')).toBe('katherine wing lam');
  });

  it('collapses whitespace and lowercases', () => {
    expect(normaliseName('  CHRIS   SMITH  ')).toBe('chris smith');
  });

  it('returns empty string for junk input', () => {
    expect(normaliseName('   !!!  ')).toBe('');
    expect(nameParts('!!!')).toEqual([]);
  });
});

describe('levenshtein', () => {
  it('computes known distances', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('smith', 'smyth')).toBe(1);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('same', 'same')).toBe(0);
  });
});

describe('nickname classes', () => {
  it('links western nicknames both ways', () => {
    expect(isNicknameMatch('chris', 'christopher')).toBe(true);
    expect(isNicknameMatch('christopher', 'chris')).toBe(true);
    expect(isNicknameMatch('bill', 'william')).toBe(true);
  });

  it('links transliteration variants', () => {
    expect(isNicknameMatch('mohammed', 'muhammad')).toBe(true);
    expect(isNicknameMatch('ayesha', 'aisha')).toBe(true);
    expect(isNicknameMatch('chowdhury', 'chaudhry')).toBe(true);
  });

  it('does not link unrelated names', () => {
    expect(isNicknameMatch('chris', 'david')).toBe(false);
    expect(isNicknameMatch('sarah', 'khan')).toBe(false);
  });
});

describe('scorePart', () => {
  it('scores exact highest, then nickname, then prefix, then typo', () => {
    expect(scorePart('smith', 'smith')).toBe(1);
    expect(scorePart('chris', 'christopher')).toBeGreaterThan(0.8);
    expect(scorePart('smyth', 'smith')).toBeGreaterThan(0);
    expect(scorePart('zzzz', 'smith')).toBe(0);
  });

  it('is strict on very short parts', () => {
    // 3 chars or fewer get zero edit tolerance, so "ali" must not match "aly" by distance...
    expect(levenshtein('ali', 'aly')).toBe(1);
    // ...but the nickname class covers that pair deliberately.
    expect(scorePart('aly', 'ali')).toBeGreaterThan(0.9);
  });
});

describe('matchGuests — the cases that break strict matching', () => {
  it('matches the exact full name', () => {
    const m = matchGuests('Christopher Smith', GUESTS);
    expect(m[0].guest.id).toBe('1');
    expect(isConfident(m)).toBe(true);
  });

  it('matches a nickname to the formal name (WithJoy fails this)', () => {
    const m = matchGuests('Chris Smith', GUESTS);
    expect(m[0].guest.id).toBe('1');
    expect(isConfident(m)).toBe(true);
  });

  it('matches despite a missing diacritic', () => {
    const m = matchGuests('Zoe Bergstrom', GUESTS);
    expect(m[0].guest.id).toBe('2');
    expect(isConfident(m)).toBe(true);
  });

  it('matches a transliteration variant', () => {
    const m = matchGuests('Mohammed Qureshi', GUESTS);
    expect(m[0].guest.id).toBe('3');
    expect(isConfident(m)).toBe(true);
  });

  it('matches a typo', () => {
    const m = matchGuests('Cristopher Smith', GUESTS);
    expect(m[0].guest.id).toBe('1');
  });

  it('matches reversed name order', () => {
    const m = matchGuests('Smith Christopher', GUESTS);
    expect(m[0].guest.id).toBe('1');
  });

  it('tolerates an extra middle name', () => {
    const m = matchGuests('Christopher John Smith', GUESTS);
    expect(m[0].guest.id).toBe('1');
  });

  it('matches on surname alone and surfaces the whole household', () => {
    const ids = matchGuests('Qureshi', GUESTS).map((c) => c.guest.id);
    expect(ids).toContain('3');
    expect(ids).toContain('4');
  });

  it('is NOT confident when two different households share a first name', () => {
    const m = matchGuests('Sarah', GUESTS);
    const top = m.slice(0, 2).map((c) => c.guest.id).sort();
    expect(top).toEqual(['5', '6']);
    // Both Sarahs are in different households, so we must disambiguate rather than guess.
    expect(isConfident(m)).toBe(false);
  });

  it('IS confident when the tie is inside one household', () => {
    // Both Qureshis live in household hC, so either identity resolves to the same invite.
    const m = matchGuests('Qureshi', GUESTS).filter((c) => c.guest.household_id === 'hC');
    expect(isConfident(m)).toBe(true);
  });

  it('returns nothing for an unrelated name', () => {
    expect(matchGuests('Wolfgang Amadeus', GUESTS)).toHaveLength(0);
    expect(isConfident([])).toBe(false);
  });

  it('returns nothing for empty input', () => {
    expect(matchGuests('', GUESTS)).toHaveLength(0);
    expect(matchGuests('   ', GUESTS)).toHaveLength(0);
  });

  it('handles an apostrophe surname', () => {
    const m = matchGuests("Niamh O'Brien", GUESTS);
    expect(m[0].guest.id).toBe('8');
    // ...and the same name typed without the apostrophe.
    expect(matchGuests('Niamh OBrien', GUESTS)[0].guest.id).toBe('8');
  });

  it('handles a hyphenated surname typed with a space', () => {
    expect(matchGuests('Katherine Wing Lam', GUESTS)[0].guest.id).toBe('7');
    expect(matchGuests('Katie Wing-Lam', GUESTS)[0].guest.id).toBe('7');
  });
});

describe('maskName', () => {
  it('never reveals a full surname to an unauthenticated visitor', () => {
    expect(maskName(g('5', 'Sarah', 'Khan'))).toBe('Sarah K.');
    expect(maskName(g('9', 'Prince', ''))).toBe('Prince');
  });
});
