-- Wedding RSVP schema.
-- Postgres dialect. Runs identically on PGlite (dev/test) and Neon (production).
--
-- THE CORE IDEA: an INVITE LINK is the unit of invitation.
--
-- You create a link, tick which events that link shows, and share it with whoever you like — by
-- WhatsApp, SMS, email, or a QR code printed on a card. There is no guest list to build and no
-- names to match. Visibility lives entirely on the link.
--
-- This is deliberately simpler than how the commercial platforms work. They maintain a guest list
-- and resolve each visitor to a person by name lookup, which is where their worst failure mode
-- lives: a WeddingWire user reported name matching failing on "about 20% of invites", and both
-- market leaders match strictly enough that "Chris" will not find "Christopher". Skipping the
-- lookup skips the whole failure class.
--
-- Other design notes:
--  * Times are stored as WALL CLOCK (date + time) plus an IANA timezone string, never as timestamptz.
--    A guest reading from another country must see the VENUE's local time. Auto-converting is
--    actively dangerous because they will physically be in the venue's timezone on the day.
--  * Guests type their own names when they reply. `max_guests` on the link is what stops a party of
--    two turning into a party of six.

CREATE TABLE IF NOT EXISTS site_settings (
  id                     int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  couple_names           text NOT NULL DEFAULT '',
  partner_a              text NOT NULL DEFAULT '',
  partner_b              text NOT NULL DEFAULT '',
  tagline                text NOT NULL DEFAULT '',
  -- Rendered above the names in a non-Latin serif. Anvaya's signature move.
  script_line            text NOT NULL DEFAULT '',
  welcome_note           text NOT NULL DEFAULT '',
  theme                  text NOT NULL DEFAULT 'anvaya',
  -- THEME is paint: palette and type. TEMPLATE is structure: which sections appear, in what order,
  -- and how each is presented. They are deliberately independent axes — an owner picks one of each,
  -- so the same palette can arrive as a long editorial scroll or as a single invitation card.
  template               text NOT NULL DEFAULT 'classic',
  primary_date           date,
  timezone               text NOT NULL DEFAULT 'Asia/Karachi',
  rsvp_deadline          date,
  grace_hours            int  NOT NULL DEFAULT 24,
  show_deadline          boolean NOT NULL DEFAULT true,
  post_deadline_message  text NOT NULL DEFAULT '',
  owner_email            text NOT NULL DEFAULT '',
  contact_name           text NOT NULL DEFAULT '',
  contact_phone          text NOT NULL DEFAULT '',
  contact_email          text NOT NULL DEFAULT '',
  site_is_public         boolean NOT NULL DEFAULT false,  -- noindex + hidden by default
  show_our_story         boolean NOT NULL DEFAULT false,  -- demoted: ranks dead last with guests
  registry_url           text NOT NULL DEFAULT '',
  registry_note          text NOT NULL DEFAULT '',
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text UNIQUE NOT NULL,
  name           text NOT NULL,
  -- One explanatory sentence. Essential where a ceremony is unfamiliar to some guests.
  blurb          text NOT NULL DEFAULT '',
  description    text NOT NULL DEFAULT '',

  event_date     date NOT NULL,
  -- 'tba' is a first-class state with its own bucket. Never fake a timestamp to make a TBA sort.
  time_mode      text NOT NULL DEFAULT 'start_end' CHECK (time_mode IN ('start_only','start_end','tba')),
  start_time     time,
  end_time       time,
  arrive_by      time,
  timezone       text NOT NULL DEFAULT 'Asia/Karachi',

  venue_name     text NOT NULL DEFAULT '',
  venue_address  text NOT NULL DEFAULT '',
  venue_map_url  text NOT NULL DEFAULT '',

  -- Attire. dress_code_note and modesty_note are DIFFERENT fields: "formal" is not the same
  -- information as "cover your hair, full sleeves".
  dress_code       text NOT NULL DEFAULT '',
  dress_code_note  text NOT NULL DEFAULT '',
  modesty_note     text NOT NULL DEFAULT '',
  permission_note  text NOT NULL DEFAULT '',  -- couple-authored; only they can write this
  swatches         jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{hex,label}] wear these
  avoid_colours    jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{hex,label,why}] avoid these

  -- is_public: does this event show on the PUBLIC page, to somebody with no link at all?
  -- Everything else is decided per link. Default false: the etiquette failure mode is
  -- over-exposure, never under-exposure. The Knot: "It's rude to discuss events in front of
  -- those not invited, even on a website."
  is_public      boolean NOT NULL DEFAULT false,
  -- Independent of visibility: an event can be shown without collecting a reply.
  -- "We'd love for you to join us — no RSVP needed."
  rsvp_enabled   boolean NOT NULL DEFAULT true,
  is_main        boolean NOT NULL DEFAULT false,
  is_unplugged   boolean NOT NULL DEFAULT false,
  -- Map defaults OFF: on real published wedding sites the map is shown on only 1-2 of 4-6 events.
  show_map             boolean NOT NULL DEFAULT false,
  show_directions      boolean NOT NULL DEFAULT true,
  show_add_to_calendar boolean NOT NULL DEFAULT true,

  accent_hex     text NOT NULL DEFAULT '',
  sort_order     int  NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_order_idx ON events (event_date, start_time, sort_order);

CREATE TABLE IF NOT EXISTS meal_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  -- A $30 adult entree selected for a 10-year-old is real money, so kids get their own menu.
  audience    text NOT NULL DEFAULT 'adult' CHECK (audience IN ('adult','child','any')),
  sort_order  int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS meal_options_event_idx ON meal_options (event_id, sort_order);

-- ---------------------------------------------------------------------------
-- INVITE LINKS — the whole visibility model
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Your own reference only. Never shown to the guest — it exists so the admin table is readable.
  label       text NOT NULL,
  note        text NOT NULL DEFAULT '',

  -- 128 bits, randomBytes(16).base64url, 22 chars. Goes in the link you send.
  token       text UNIQUE NOT NULL,
  -- 10-char Crockford base32, printable on stationery, typo-tolerant, case-insensitive.
  code        text UNIQUE NOT NULL,

  -- The cap on how many people this link may bring. This is what replaces plus-one policing:
  -- guests type their own names, and the link decides how many name fields they get.
  max_guests  int NOT NULL DEFAULT 2 CHECK (max_guests BETWEEN 1 AND 20),

  -- One UPDATE kills a forwarded link. This is why tokens are random rows and not signed JWTs,
  -- which cannot be revoked.
  revoked_at  timestamptz,
  expires_at  timestamptz,      -- kill date ~2 weeks post-wedding -> 410 Gone
  opened_at   timestamptz,      -- first time anyone opened it; useful for chasing
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invites_token_idx ON invites (token);
CREATE INDEX IF NOT EXISTS invites_code_idx  ON invites (code);

-- WHICH EVENTS THIS LINK SHOWS. That is the entire access-control model.
CREATE TABLE IF NOT EXISTS invite_events (
  invite_id uuid NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  event_id  uuid NOT NULL REFERENCES events(id)  ON DELETE CASCADE,
  PRIMARY KEY (invite_id, event_id)
);

-- ---------------------------------------------------------------------------
-- RSVPs — guests supply their own details
-- ---------------------------------------------------------------------------

-- One reply per link. Re-submitting UPDATES it, so a guest can change their mind, and a corporate
-- mail scanner pre-clicking the link cannot create a duplicate.
CREATE TABLE IF NOT EXISTS responses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id      uuid UNIQUE NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  contact_name   text NOT NULL DEFAULT '',
  contact_email  text NOT NULL DEFAULT '',
  contact_phone  text NOT NULL DEFAULT '',
  -- Multi-day specific: drives airport pickups, welcome bags, day-after brunch numbers.
  arrival_date   date,
  departure_date date,
  travelling_from text NOT NULL DEFAULT '',
  needs_shuttle  boolean,
  needs_accommodation boolean,
  song_request   text NOT NULL DEFAULT '',
  message        text NOT NULL DEFAULT '',
  submitted_at   timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- The people actually coming, as typed by the guest.
CREATE TABLE IF NOT EXISTS attendees (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id  uuid NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  slot         int NOT NULL,           -- 0-based position in the form, keeps ordering stable
  name         text NOT NULL,
  is_child     boolean NOT NULL DEFAULT false,
  -- Checkboxes PLUS free text, never one or the other: allergies never fit a dropdown, and an open
  -- box alone produces "he won't eat broccoli" filed next to a genuine nut allergy.
  dietary_tags       jsonb NOT NULL DEFAULT '[]'::jsonb,
  dietary_medical    text NOT NULL DEFAULT '',
  dietary_preference text NOT NULL DEFAULT '',
  accessibility      text NOT NULL DEFAULT '',
  UNIQUE (response_id, slot)
);

-- Per attendee, per event. This shape is what makes a caterer-ready export possible.
CREATE TABLE IF NOT EXISTS attendance (
  attendee_id    uuid NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  event_id       uuid NOT NULL REFERENCES events(id)    ON DELETE CASCADE,
  -- Attending / declined ONLY. No guest-facing "Maybe": it produces uncountable headcounts and
  -- caterers reject it. No major platform exposes it either.
  status         text NOT NULL CHECK (status IN ('attending','declined')),
  meal_option_id uuid REFERENCES meal_options(id) ON DELETE SET NULL,
  PRIMARY KEY (attendee_id, event_id)
);
CREATE INDEX IF NOT EXISTS attendance_event_idx ON attendance (event_id, status);

-- Append-only trail. Who changed what, and whether it came from the guest or was keyed in by the
-- owner after a phone call.
CREATE TABLE IF NOT EXISTS response_log (
  id         bigserial PRIMARY KEY,
  invite_id  uuid NOT NULL,
  actor      text NOT NULL CHECK (actor IN ('guest','owner')),
  summary    text NOT NULL,
  at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS response_log_at_idx ON response_log (at DESC);

-- Free-text notes go to a REVIEW QUEUE and never touch a headcount. A notes field is where guests
-- try to add extra people.
CREATE TABLE IF NOT EXISTS messages (
  id            bigserial PRIMARY KEY,
  invite_id     uuid REFERENCES invites(id) ON DELETE SET NULL,
  from_name     text NOT NULL DEFAULT '',
  contact       text NOT NULL DEFAULT '',
  body          text NOT NULL,
  status        text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_status_idx ON messages (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Content the owner edits without a redeploy
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_blocks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section    text NOT NULL,     -- 'travel' | 'stay' | 'faq' | 'things_to_do' | 'story' | 'party'
  title      text NOT NULL DEFAULT '',
  -- A short line above the title. On a story beat it carries the date ("June 2019"); on a wedding
  -- party member it carries the role ("Maid of Honour"). Zola and The Knot both key their story and
  -- party sections off exactly these two fields.
  meta       text NOT NULL DEFAULT '',
  body       text NOT NULL DEFAULT '',
  link_url   text NOT NULL DEFAULT '',
  link_label text NOT NULL DEFAULT '',
  visible    boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS content_section_idx ON content_blocks (section, sort_order);

-- ---------------------------------------------------------------------------
-- Rate limiting. Serverless has no shared memory, so the counter lives in the database.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attempts (
  id       bigserial PRIMARY KEY,
  kind     text NOT NULL,     -- 'code' | 'admin_login'
  ip_hash  text NOT NULL,
  at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attempts_lookup_idx ON attempts (kind, ip_hash, at DESC);

-- ---------------------------------------------------------------------------
-- Additive migrations.
--
-- Everything above is CREATE TABLE IF NOT EXISTS, which does nothing to a table
-- that already exists — so a column added later has to be stated separately or
-- an existing database never gets it.
-- ---------------------------------------------------------------------------

ALTER TABLE site_settings  ADD COLUMN IF NOT EXISTS template text NOT NULL DEFAULT 'classic';
ALTER TABLE content_blocks ADD COLUMN IF NOT EXISTS meta     text NOT NULL DEFAULT '';
