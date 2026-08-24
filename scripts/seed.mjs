#!/usr/bin/env node
/**
 * Seed demo data.
 *
 * Run: node scripts/seed.mjs [--reset]
 * Targets Neon when DATABASE_URL is set, otherwise the local PGlite store under .data/pglite.
 *
 * The demo wedding is deliberately a multi-day one with events of very different sizes, because that
 * is the case every commercial platform handles badly. Guest lists here are overlapping circles, not
 * tiers: the dholki is family-only, the mehndi is friends-and-family, the nikkah is everyone, and the
 * brunch is a small subset that cuts across all of them.
 *
 * Dress-code content is drawn from sourced guest guidance for Pakistani weddings rather than invented:
 * mehndi is bright and informal; nikkah is formal and modest with head covering at a mosque; baraat is
 * comparable to Western black-tie; walima is formal but softer, with pastels. Guests are told to avoid
 * red (the bride’s colour), white (associated with mourning), and all-black in daytime.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const newToken = () => randomBytes(16).toString('base64url');
const newCode = () => {
  const b = randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i++) out += CROCKFORD[b[i] % 32];
  return out;
};

const reset = process.argv.includes('--reset');

async function getDb() {
  if (process.env.DATABASE_URL) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    return { query: (t, p = []) => sql.query(t, p), kind: 'neon' };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), '.data', 'pglite');
  const db = await PGlite.create(dir);
  return { query: async (t, p = []) => (await db.query(t, p)).rows, exec: (s) => db.exec(s), kind: 'pglite' };
}

// Split on semicolons outside quotes and line comments.
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
    if (!quote && ch === '-' && next === '-') { lineComment = true; buf += ch; continue; }
    if (!quote && (ch === "'" || ch === '"')) { quote = ch; buf += ch; continue; }
    if (quote && ch === quote) {
      if (next === quote) { buf += ch + next; i++; continue; }
      quote = null; buf += ch; continue;
    }
    if (!quote && ch === ';') { if (buf.trim()) out.push(buf.trim()); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

const EVENTS = [
  {
    slug: 'dholki',
    name: 'Dholki',
    blurb: 'An evening of drumming and singing at home, in the week before the wedding.',
    description:
      'The dholki takes its name from the two-headed drum that sits in the middle of the room all night. There is no programme and no seating plan. People take turns on the dhol, everyone else claps along and sings, and it usually runs later than anyone intends. Come as you are.',
    event_date: '2027-02-24', start_time: '20:00', end_time: null, arrive_by: null,
    venue_name: 'The Qureshi home', venue_address: '14 Khayaban-e-Shahbaz, DHA Phase 6, Karachi',
    dress_code: 'Casual',
    dress_code_note: 'Kurta, shalwar kameez, or whatever you can sit cross-legged on the floor in for four hours.',
    modesty_note: '', permission_note: '',
    swatches: [], avoid_colours: [],
    is_public: false, rsvp_enabled: true,
    is_main: false, is_unplugged: false, show_map: false, time_mode: 'start_only',
    accent_hex: '#7A6A2E',
  },
  {
    slug: 'mayoun',
    name: 'Mayoun',
    blurb: 'A small daytime gathering where the bride is dressed in yellow and kept out of the sun.',
    description:
      'Traditionally the bride stops going out in the days before the wedding and wears yellow. Turmeric paste (ubtan) is applied by close family. It is a short, bright, slightly chaotic afternoon and the photographs from it are usually the best ones of the week.',
    event_date: '2027-02-25', start_time: '15:00', end_time: '18:00', arrive_by: null,
    venue_name: 'The Qureshi home', venue_address: '14 Khayaban-e-Shahbaz, DHA Phase 6, Karachi',
    dress_code: 'Yellow, informal',
    dress_code_note:
      'Wear yellow if you have it. Wear something you do not mind losing. Turmeric does not come out of fabric, and that is the point.',
    modesty_note: '', permission_note: '',
    swatches: [{ hex: '#C9A227', label: 'Turmeric' }, { hex: '#E8C86A', label: 'Marigold' }],
    avoid_colours: [{ hex: '#FFFFFF', label: 'White', why: 'associated with mourning' }],
    is_public: false, rsvp_enabled: true,
    is_main: false, is_unplugged: false, show_map: false, time_mode: 'start_end',
    accent_hex: '#C9A227',
  },
  {
    slug: 'mehndi',
    name: 'Mehndi',
    blurb: 'Henna, dancing, and two sides of the family competing at it.',
    description:
      'The mehndi is the loud one. Henna is applied to the bride and to anyone else who sits still long enough, both families perform dances they have been rehearsing in secret, and dinner is served late. If you intend to dance, you will be found and made to dance, so you may as well plan for it.',
    event_date: '2027-02-26', start_time: '19:30', end_time: '01:00', arrive_by: '19:45',
    venue_name: 'Ivy House Lawn', venue_address: 'Ivy House, Sunset Boulevard, DHA Phase 5, Karachi',
    dress_code: 'Festive — bright colours',
    dress_code_note:
      'Greens, yellows, oranges, hot pink. This is the least formal of the big events and the most colourful. Flat shoes: the lawn is grass and you will be on your feet.',
    modesty_note: '', permission_note: '',
    swatches: [
      { hex: '#7A6A2E', label: 'Henna green' },
      { hex: '#C9A227', label: 'Marigold' },
      { hex: '#C1572F', label: 'Saffron' },
    ],
    avoid_colours: [
      { hex: '#B02E2E', label: 'Red', why: "the bride’s colour" },
      { hex: '#FFFFFF', label: 'White', why: 'associated with mourning' },
    ],
    is_public: false, rsvp_enabled: true,
    is_main: false, is_unplugged: false, show_map: true, time_mode: 'start_end',
    accent_hex: '#7A6A2E',
  },
  {
    slug: 'nikkah',
    name: 'Nikkah & Baraat',
    blurb: 'The ceremony itself, followed by dinner. Everyone is invited.',
    description:
      'The nikkah is the marriage contract and the ceremony proper. It is short, usually under half an hour, and it starts on time. That is the one event of the week where that is true. The baraat and dinner follow immediately afterwards in the same venue.',
    event_date: '2027-02-27', start_time: '18:00', end_time: '23:30', arrive_by: '17:30',
    venue_name: 'Mohatta Palace Gardens', venue_address: '7 Hatim Alvi Road, Clifton, Karachi',
    dress_code: 'Formal',
    dress_code_note:
      'Comparable to black tie. Sherwani, suit, or formal shalwar kameez; sari, lehenga, gharara, or a formal gown.',
    modesty_note:
      'The nikkah is held in the garden pavilion rather than a mosque, so there is no head-covering requirement. Shawls will be available at the entrance for anyone who would prefer one.',
    permission_note:
      'If you are not South Asian and would like to wear shalwar kameez, a sari, or a sherwani, please do. It is very welcome and nobody will think it odd. Western formal is equally welcome. Wear whichever you will be comfortable in for six hours.',
    swatches: [{ hex: '#1C4E4A', label: 'Deep teal' }, { hex: '#5D3B42', label: 'Oxblood' }, { hex: '#C9A227', label: 'Gold' }],
    avoid_colours: [
      { hex: '#B02E2E', label: 'Red', why: "the bride’s colour" },
      { hex: '#FFFFFF', label: 'White', why: 'associated with mourning' },
      { hex: '#111111', label: 'All black', why: 'avoided at daytime functions' },
    ],
    is_public: true, rsvp_enabled: true,
    is_main: true, is_unplugged: true, show_map: true, time_mode: 'start_end',
    accent_hex: '#1C4E4A',
  },
  {
    slug: 'walima',
    name: 'Walima',
    blurb: "The reception, hosted by the groom’s family.",
    description:
      "The walima is the reception that follows the nikkah, hosted by the groom’s side. It is formal but a little softer than the night before: more sitting, more eating, more talking to people you have not seen in years.",
    event_date: '2027-02-28', start_time: '19:00', end_time: '23:00', arrive_by: '19:00',
    venue_name: 'Beach Luxury Hotel, Ballroom', venue_address: 'M.T. Khan Road, Karachi',
    dress_code: 'Formal — pastels',
    dress_code_note: 'Formal, but lighter than the nikkah. Pastels and soft neutrals are traditional for the walima.',
    modesty_note: '', permission_note: '',
    swatches: [{ hex: '#E8CDB6', label: 'Champagne' }, { hex: '#C2CAAC', label: 'Sage' }, { hex: '#BCD5F4', label: 'Powder blue' }],
    avoid_colours: [
      { hex: '#B02E2E', label: 'Red', why: "the bride’s colour" },
      { hex: '#FFFFFF', label: 'White', why: 'associated with mourning' },
    ],
    is_public: true, rsvp_enabled: true,
    is_main: false, is_unplugged: false, show_map: false, time_mode: 'start_end',
    accent_hex: '#B56A4A',
  },
  {
    slug: 'brunch',
    name: 'Day-after brunch',
    blurb: 'A quiet one, for anyone who travelled.',
    description:
      'If you have flown in, come and eat before you fly out. Nothing is scheduled and nobody will make a speech. Drop in any time in the window.',
    event_date: '2027-03-01', start_time: '11:00', end_time: '14:00', arrive_by: null,
    venue_name: 'Cafe Flo', venue_address: '3 Ch. Khaliquzzaman Road, Clifton, Karachi',
    dress_code: 'Come as you are',
    dress_code_note: '', modesty_note: '', permission_note: '',
    swatches: [], avoid_colours: [],
    is_public: false, rsvp_enabled: false,
    is_main: false, is_unplugged: false, show_map: false, time_mode: 'start_end',
    accent_hex: '#3B6072',
  },
];

// Invite links. Each one ticks a DIFFERENT set of events — that is the entire demo.
// Note there is no guest list here: the label is only for the couple's own reference, and the
// people coming type their own names when they reply.
const INVITES = [
  {
    label: 'Close family',
    note: 'Everything, including the two at the house',
    seats: 4,
    events: ['dholki', 'mayoun', 'mehndi', 'nikkah', 'walima', 'brunch'],
  },
  {
    label: 'Sarah Khan + guest',
    note: 'Old friend, flying in from London',
    seats: 2,
    events: ['dholki', 'mehndi', 'nikkah', 'walima', 'brunch'],
  },
  {
    label: 'The Okonkwos',
    note: 'Travelling — brunch included',
    seats: 2,
    events: ['mehndi', 'nikkah', 'walima', 'brunch'],
  },
  {
    label: 'Work colleagues',
    note: 'Reception only',
    seats: 1,
    events: ['nikkah', 'walima'],
  },
  {
    label: 'The Bergströms',
    note: '',
    seats: 2,
    events: ['mehndi', 'nikkah', 'walima'],
  },
];


const FAQS = [
  ['What time should I actually arrive?',
   'For the nikkah, please be seated by 5:30pm — the ceremony genuinely starts at 6:00 and the doors close. For everything else, the times listed are when things begin, and arriving within half an hour of them is normal and expected.'],
  ['Are children invited?',
   'Yes, to every event. There is a supervised room with food and a projector at the walima for anyone under ten who has run out of patience.'],
  ['Can I bring a plus-one?',
   'If your invitation includes one, it will already be showing on your RSVP page as a second name to fill in. If it does not, we have had to keep numbers down — we hope you understand, and we would rather tell you plainly than leave you guessing.'],
  ['Is there parking?',
   'Mohatta Palace has valet parking at the Hatim Alvi Road gate. Beach Luxury has its own car park. Ivy House does not, so please use a rideshare or the shuttle.'],
  ['Is there a shuttle?',
   'Yes, between Beach Luxury Hotel and both the mehndi and the nikkah. Departure times are on each event above, and it runs back twice at the end of each night.'],
  ['What is the weather like in late February?',
   'Karachi in February is about 26°C in the daytime and drops to 16°C after dark. Both the mehndi and the nikkah are outdoors, so bring a shawl or a jacket for the evening.'],
  ['I have a dietary requirement — will there be something for me?',
   'Yes. There is a separate field on the RSVP for medical requirements and allergies, and another for preferences. The first goes straight to the caterer; the second helps us plan. All meat served is halal, and there is a vegetarian option at every event.'],
  ['Is the venue wheelchair accessible?',
   'Mohatta Palace and Beach Luxury are both step-free with accessible toilets. Ivy House has three steps at the entrance and a grass lawn. Tell us on your RSVP and we will arrange a ramp and a firm path.'],
  ['Can I take photographs?',
   'Everywhere except during the nikkah itself, which is about twenty minutes. We will ask you to put phones away for that part, and the photographer will share everything afterwards.'],
  ['What should I do about gifts?',
   'Your being there is genuinely the whole thing. If you would like to mark the occasion anyway, there is a note on the registry page.'],
  ['Who do I call on the day if something goes wrong?',
   'Bilal, who is handling logistics, on the number in the footer. He will have his phone on him for all five days.'],
];

async function main() {
  const db = await getDb();
  const schema = readFileSync(path.join(process.cwd(), 'lib', 'db', 'schema.sql'), 'utf8');

  if (db.exec) await db.exec(schema);
  else for (const stmt of splitStatements(schema)) await db.query(stmt);

  if (reset) {
    for (const t of ['attendance', 'attendees', 'responses', 'response_log', 'invite_events',
                     'invites', 'meal_options', 'events', 'content_blocks', 'messages', 'attempts']) {
      await db.query(`DELETE FROM ${t}`);
    }
    await db.query(`DELETE FROM site_settings`);
  }

  const existing = await db.query(`SELECT count(*)::int AS n FROM events`);
  if (Number(existing[0].n) > 0 && !reset) {
    console.log('Already seeded. Pass --reset to wipe and reseed.');
    return;
  }

  await db.query(
    `INSERT INTO site_settings (id, couple_names, partner_a, partner_b, tagline, script_line, welcome_note, theme,
       primary_date, timezone, rsvp_deadline, grace_hours, show_deadline, post_deadline_message,
       owner_email, contact_name, contact_phone, contact_email, site_is_public,
       show_our_story, registry_url, registry_note)
     VALUES (1, $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
     ON CONFLICT (id) DO UPDATE SET
       couple_names = EXCLUDED.couple_names,
       -- Also restore the LOOK on a reseed. Choosing a theme in the picker writes it here, so
       -- without this a demo database keeps whatever was last clicked and every later run of the
       -- test suite silently measures a different one of the 126 theme x template combinations
       -- than the run before it. That is how a genuine WCAG failure on the goundry theme sat
       -- unnoticed while the suite reported green on anvaya.
       theme = EXCLUDED.theme,
       template = 'classic'`,
    [
      'Ayesha & Imran', 'Ayesha', 'Imran',
      'Five days, one family, Karachi in February.',
      // Rendered above the Latin names in a Nastaliq serif — Anvaya's signature move.
      'عائشہ و عمران',
      'We are getting married at the end of February and we would love you to be there. Not every event is a whole-family affair, so your own link shows the ones you are invited to. Everything you need is on this page: times, addresses, what to wear, where to park. If something is missing, call Bilal.',
      'anvaya',
      '2027-02-27', 'Asia/Karachi', '2027-01-15', 24, true,
      'Our RSVP deadline has passed and we have given final numbers to the caterer. If your plans have changed, please call or message Bilal directly rather than using the form — we will do our best to accommodate you.',
      'demo-owner@example.com', 'Bilal Qureshi', '+92 300 1234567', 'demo-bilal@example.com',
      false, false, '', 'Your being there is the whole thing. If you would like to mark the occasion, we are collecting for a school library in our grandmother’s name.',
    ],
  );

  const eventIds = {};
  for (const [i, e] of EVENTS.entries()) {
    const r = await db.query(
      `INSERT INTO events (slug,name,blurb,description,event_date,start_time,end_time,arrive_by,timezone,
         venue_name,venue_address,venue_map_url,dress_code,dress_code_note,modesty_note,permission_note,
         swatches,avoid_colours,is_public,rsvp_enabled,accent_hex,sort_order,
         is_main,is_unplugged,show_map,time_mode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
         $23,$24,$25,$26)
       RETURNING id`,
      [e.slug, e.name, e.blurb, e.description, e.event_date, e.start_time, e.end_time, e.arrive_by,
       'Asia/Karachi', e.venue_name, e.venue_address,
       `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.venue_address)}`,
       e.dress_code, e.dress_code_note, e.modesty_note, e.permission_note,
       JSON.stringify(e.swatches), JSON.stringify(e.avoid_colours),
       e.is_public, e.rsvp_enabled, e.accent_hex, i,
       e.is_main, e.is_unplugged, e.show_map, e.time_mode],
    );
    eventIds[e.slug] = r[0].id;
    // Meal options only on the two sit-down dinners.
    if (e.slug === 'nikkah' || e.slug === 'walima') {
      const meals = [
        ['Chicken karahi', 'Boneless chicken, tomato, green chilli, ginger.', 'adult'],
        ['Mutton biryani', 'Slow-cooked with saffron rice.', 'adult'],
        ['Palak paneer', 'Vegetarian. Spinach and fresh cheese.', 'any'],
        ['Chicken & chips', 'For the under-tens.', 'child'],
      ];
      for (const [j, [name, desc, aud]] of meals.entries()) {
        await db.query(
          `INSERT INTO meal_options (event_id,name,description,audience,sort_order) VALUES ($1,$2,$3,$4,$5)`,
          [r[0].id, name, desc, aud, j],
        );
      }
    }
  }

  // The links. Each ticks a different set of events; nothing else distinguishes them.
  const links = [];
  for (const inv of INVITES) {
    const token = newToken();
    const code = newCode();
    const ir = await db.query(
      `INSERT INTO invites (label, note, token, code, max_guests) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [inv.label, inv.note, token, code, inv.seats],
    );
    for (const slug of inv.events) {
      const eventId = eventIds[slug];
      if (!eventId) throw new Error(`Invite "${inv.label}" references unknown event slug "${slug}"`);
      await db.query(`INSERT INTO invite_events (invite_id, event_id) VALUES ($1,$2)`,
        [ir[0].id, eventId]);
    }
    links.push({ name: inv.label, token, code, shows: inv.events.length, seats: inv.seats });
  }

  for (const [i, [q, a]] of FAQS.entries()) {
    await db.query(
      `INSERT INTO content_blocks (section,title,body,sort_order) VALUES ('faq',$1,$2,$3)`, [q, a, i]);
  }

  const travel = [
    ['Getting to Karachi', 'Jinnah International (KHI) is 30–45 minutes from Clifton depending on traffic. Most international guests connect through Dubai, Doha, or Istanbul.', ''],
    ['Where to stay', 'We have held rooms at Beach Luxury Hotel at a reduced rate under "QURESHI-2027" until 20 January. It is where the shuttle runs from, so it is the easiest base.', 'https://example.com/hotel'],
    ['Getting around', 'Careem and inDrive both work well and are the way most people get around. Ask for a car at the Hatim Alvi gate rather than the main road.', ''],
    ['Visas', 'Most nationalities can now get a Pakistani e-visa online in about a week. Tell us if you need a formal invitation letter and we will send one.', ''],
  ];
  for (const [i, [t, b, u]] of travel.entries()) {
    await db.query(
      `INSERT INTO content_blocks (section,title,body,link_url,sort_order) VALUES ('travel',$1,$2,$3,$4)`,
      [t, b, u, i]);
  }

  // --- Story beats -----------------------------------------------------------
  //
  // Both Zola and The Knot break the couple's story into NAMED beats rather than one prose block.
  // The names below are the canonical ones by real frequency across 352 published Zola sites that
  // have a story section: "How We Met" appears ~129 times, "The Proposal" ~70, and How We Met ->
  // The Proposal is the commonest ordered pair. Median beat length there is 527 characters, which
  // is roughly what these are.
  //
  // The DATE is this project's own addition: Zola's story schema is title/subtitle/description with
  // no date field, but The Knot's PhotoTimelineItem does carry one per entry, and a beat without a
  // date cannot drive a timeline. It is optional — a beat with no date still renders. The
  // `story-first` and `timeline` templates lead with these; the others place them lower or not at
  // all. All of it is editable in the admin; this is only a starting set.
  const story = [
    ['March 2019', 'How We Met',
     'At a mutual friend’s dholki in Karachi, where Imran was in charge of the speakers and Ayesha was in charge of telling him the speakers were too loud. They argued about it for an hour and neither of them changed their mind.'],
    ['August 2019', 'Our First Date',
     'Dinner at Kolachi that ran so late the staff started stacking chairs around them. Ayesha ordered for both of them without asking, which Imran has decided to find charming rather than alarming.'],
    ['December 2022', 'Moving countries',
     'Two years of a five-hour time difference, then Imran took a job in Dubai and the phone calls turned into evenings. Both sets of parents pretended to be surprised.'],
    ['June 2026', 'The Proposal',
     'On the roof at Ayesha’s grandmother’s house in Clifton, at the end of a family dinner nobody had told her was a set-up. Her grandmother had the sweets ready before she said yes.'],
  ];
  for (const [i, [when, t, b]] of story.entries()) {
    await db.query(
      `INSERT INTO content_blocks (section,title,meta,body,sort_order) VALUES ('story',$1,$2,$3,$4)`,
      [t, when, b, i]);
  }

  // --- Wedding party ----------------------------------------------------------
  // Role above name, which is the order both platforms use.
  const party = [
    ['Maid of Honour', 'Sana Qureshi', 'Ayesha’s younger sister, and the reason the mehndi choreography exists at all.'],
    ['Best Man', 'Bilal Ahmed', 'Imran’s flatmate for six years in Lahore. He has stories and has been asked, politely, not to tell them.'],
    ['Bridesmaid', 'Hira Malik', 'Friends with Ayesha since the first week of university and unbeaten at Ludo since roughly then.'],
    ['Bridesmaid', 'Fatima Sheikh', 'Ayesha’s cousin, and the person who will find you if you look lost at any point over the five days.'],
    ['Groomsman', 'Daniyal Raza', 'Imran’s brother. Will be running the baraat, and has been practising.'],
    ['Groomsman', 'Omar Farooq', 'Met Imran in a queue at a cricket match in 2014 and neither of them has been able to shake the other since.'],
  ];
  for (const [i, [role, name, bio]] of party.entries()) {
    await db.query(
      `INSERT INTO content_blocks (section,title,meta,body,sort_order) VALUES ('party',$1,$2,$3,$4)`,
      [name, role, bio, i]);
  }

  // --- Things to do -----------------------------------------------------------
  // Zola ships this as one of its nine pages; couples routinely repurpose it, which is a sign it is
  // the most useful of the optional ones.
  const things = [
    ['Food', 'Burns Road at night', 'The old food street. Go for the nihari, stay for the rabri. Busiest after 9pm, which is the correct time to go.', ''],
    ['Sea', 'Clifton Beach and the camels', 'Ten minutes from the hotel. Best at sunset, and yes you can ride a camel; agree the price first.', ''],
    ['History', 'Mohatta Palace', 'A 1920s palace turned museum, and the coolest building in the city in both senses. Closed Mondays.', 'https://example.com/mohatta'],
    ['Shopping', 'Zainab Market', 'For lawn, leather and the kind of haggling that is expected rather than rude. Take small notes.', ''],
    ['Quiet', 'Frere Hall gardens', 'Somewhere to sit down between events, with a bookstall on Sundays and shade that actually works.', ''],
  ];
  for (const [i, [kind, t, b, u]] of things.entries()) {
    await db.query(
      `INSERT INTO content_blocks (section,title,meta,body,link_url,sort_order) VALUES ('things_to_do',$1,$2,$3,$4,$5)`,
      [t, kind, b, u, i]);
  }

  // The E2E suite reads these. Writing them here keeps the tests in step with a reseed instead of
  // silently testing against tokens that no longer exist.
  const { writeFileSync } = await import('node:fs');
  writeFileSync(path.join(process.cwd(), '.data', 'tokens.json'), JSON.stringify(links, null, 2));

  console.log('\nSeeded. Demo invite links:\n');
  for (const l of links) {
    console.log(
      `  ${l.name.padEnd(22)} /i/${l.token}  ${String(l.shows).padStart(2)} events  ${l.code.slice(0, 5)}-${l.code.slice(5)}`,
    );
  }
  console.log('');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
