CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE account_role AS ENUM ('platform_admin', 'club_owner', 'club_staff', 'player');
CREATE TYPE round_status AS ENUM ('active', 'pending', 'approved', 'rejected');
CREATE TYPE content_kind AS ENUM ('news', 'announcement', 'rules');

CREATE TABLE clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('trial', 'active', 'suspended')),
  timezone text NOT NULL DEFAULT 'Europe/Amsterdam',
  default_language text NOT NULL DEFAULT 'nl' CHECK (default_language IN ('nl', 'en')),
  supported_languages text[] NOT NULL DEFAULT ARRAY['nl', 'en'],
  logo_url text,
  primary_color text NOT NULL DEFAULT '#103f2c',
  accent_color text NOT NULL DEFAULT '#c6f04d',
  contact_email citext,
  phone text,
  address text,
  opening_hours jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  role account_role NOT NULL CHECK (role IN ('platform_admin', 'club_owner', 'club_staff')),
  email citext NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'platform_admin' AND club_id IS NULL) OR (role <> 'platform_admin' AND club_id IS NOT NULL))
);

CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  initials text NOT NULL,
  code citext NOT NULL UNIQUE,
  pin_hash text NOT NULL,
  preferred_language text NOT NULL DEFAULT 'nl' CHECK (preferred_language IN ('nl', 'en')),
  active boolean NOT NULL DEFAULT true,
  must_change_pin boolean NOT NULL DEFAULT true,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  csrf_hash text NOT NULL,
  role account_role NOT NULL,
  account_id uuid NOT NULL,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'platform_admin' AND club_id IS NULL) OR (role <> 'platform_admin' AND club_id IS NOT NULL))
);

CREATE TABLE auth_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identifier_hash text NOT NULL,
  ip_hash text,
  success boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name jsonb NOT NULL,
  description jsonb NOT NULL DEFAULT '{}',
  hole_count integer NOT NULL CHECK (hole_count IN (9, 18)),
  accent_color text NOT NULL DEFAULT '#c6f04d',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, id)
);

CREATE TABLE tee_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name jsonb NOT NULL,
  color text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  UNIQUE (course_id, id)
);

CREATE UNIQUE INDEX one_default_tee_per_course ON tee_sets(course_id) WHERE is_default;

CREATE TABLE holes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tee_set_id uuid NOT NULL REFERENCES tee_sets(id) ON DELETE CASCADE,
  number integer NOT NULL CHECK (number BETWEEN 1 AND 18),
  par integer NOT NULL CHECK (par BETWEEN 2 AND 6),
  distance_m integer NOT NULL CHECK (distance_m > 0),
  name jsonb NOT NULL DEFAULT '{}',
  description jsonb NOT NULL DEFAULT '{}',
  image_url text,
  UNIQUE (tee_set_id, number)
);

CREATE TABLE rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id),
  tee_set_id uuid NOT NULL REFERENCES tee_sets(id),
  scorer_player_id uuid NOT NULL REFERENCES players(id),
  hole_count integer NOT NULL CHECK (hole_count IN (9, 18)),
  status round_status NOT NULL DEFAULT 'pending',
  completed_at timestamptz NOT NULL,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES admin_accounts(id),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, client_id)
);

CREATE TABLE round_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id),
  display_name text NOT NULL,
  is_guest boolean NOT NULL DEFAULT false,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 4),
  total_strokes integer NOT NULL CHECK (total_strokes > 0),
  total_par integer NOT NULL CHECK (total_par > 0),
  UNIQUE (round_id, position),
  CHECK ((is_guest AND player_id IS NULL) OR (NOT is_guest AND player_id IS NOT NULL))
);

CREATE TABLE hole_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_participant_id uuid NOT NULL REFERENCES round_participants(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  hole_number integer NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  strokes integer NOT NULL CHECK (strokes BETWEEN 1 AND 12),
  par_snapshot integer NOT NULL CHECK (par_snapshot BETWEEN 2 AND 6),
  distance_snapshot integer NOT NULL CHECK (distance_snapshot > 0),
  UNIQUE (round_participant_id, hole_number)
);

CREATE TABLE round_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES admin_accounts(id),
  decision round_status NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  course_id uuid REFERENCES courses(id),
  title jsonb NOT NULL,
  description jsonb NOT NULL DEFAULT '{}',
  image_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  capacity integer CHECK (capacity > 0),
  leaderboard_enabled boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE event_registrations (
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, player_id)
);

CREATE TABLE content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  kind content_kind NOT NULL,
  title jsonb NOT NULL,
  body jsonb NOT NULL,
  image_url text,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  actor_role account_role,
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  ip_hash text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_token_expiry ON sessions(token_hash, expires_at);
CREATE INDEX sessions_account ON sessions(role, account_id);
CREATE INDEX auth_attempts_identifier_time ON auth_attempts(identifier_hash, attempted_at DESC);
CREATE INDEX courses_club_active ON courses(club_id, active);
CREATE INDEX rounds_club_status_date ON rounds(club_id, status, completed_at DESC);
CREATE INDEX participants_player ON round_participants(club_id, player_id);
CREATE INDEX events_club_start ON events(club_id, starts_at);
CREATE INDEX registrations_player ON event_registrations(club_id, player_id);
CREATE INDEX content_club_publish ON content_items(club_id, published_at DESC);
CREATE INDEX audit_club_time ON audit_log(club_id, created_at DESC);

CREATE VIEW leaderboard_entries AS
SELECT r.club_id, r.course_id, r.hole_count, r.completed_at, rp.player_id,
       rp.display_name, rp.total_strokes, rp.total_strokes - rp.total_par AS score_to_par
FROM rounds r
JOIN round_participants rp ON rp.round_id = r.id
WHERE r.status = 'approved' AND NOT rp.is_guest;
