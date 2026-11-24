-- Fairway 2.0 — schema changes for the rebuilt application.
--
-- This migration evolves the 1.x schema in place: every existing club, player,
-- course and round is kept. It adds what the new features need (formats,
-- guests, putts, self-registration, notifications, achievements, club
-- settings) and removes two artefacts nothing reads any more.

-- ---------------------------------------------------------------- clubs --
ALTER TABLE clubs
  ADD COLUMN join_code text,
  ADD COLUMN self_registration text NOT NULL DEFAULT 'approval'
    CHECK (self_registration IN ('closed', 'approval', 'open')),
  ADD COLUMN auto_approve_rounds boolean NOT NULL DEFAULT false,
  ADD COLUMN board_token text,
  ADD COLUMN tagline text,
  ADD COLUMN website text,
  ADD COLUMN opening_hours_text text;

UPDATE clubs
   SET join_code = upper(encode(gen_random_bytes(4), 'hex')),
       board_token = encode(gen_random_bytes(24), 'hex');

ALTER TABLE clubs
  ALTER COLUMN join_code SET NOT NULL,
  ALTER COLUMN board_token SET NOT NULL;

CREATE UNIQUE INDEX clubs_join_code_unique ON clubs (join_code);
CREATE UNIQUE INDEX clubs_board_token_unique ON clubs (board_token);

-- ------------------------------------------------------- admin accounts --
ALTER TABLE admin_accounts
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- -------------------------------------------------------------- players --
ALTER TABLE players
  ADD COLUMN registration_status text NOT NULL DEFAULT 'approved'
    CHECK (registration_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN email citext,
  ADD COLUMN club_index numeric(4, 1),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX players_club_registration ON players (club_id, registration_status);

-- --------------------------------------------------------------- rounds --
ALTER TABLE rounds RENAME COLUMN scorer_player_id TO starter_player_id;
ALTER TABLE rounds RENAME CONSTRAINT rounds_scorer_tenant_fk TO rounds_starter_tenant_fk;

ALTER TABLE rounds
  ADD COLUMN format text NOT NULL DEFAULT 'stroke'
    CHECK (format IN ('stroke', 'stableford', 'match')),
  ADD COLUMN track_putts boolean NOT NULL DEFAULT false,
  ADD COLUMN event_id uuid,
  ADD COLUMN share_token text,
  ADD COLUMN started_at timestamptz,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

UPDATE rounds SET started_at = created_at WHERE status <> 'inviting';

ALTER TABLE rounds
  ADD CONSTRAINT rounds_event_tenant_fk
    FOREIGN KEY (club_id, event_id) REFERENCES events (club_id, id)
    ON DELETE SET NULL (event_id);

CREATE UNIQUE INDEX rounds_share_token_unique ON rounds (share_token) WHERE share_token IS NOT NULL;
CREATE INDEX rounds_event ON rounds (club_id, event_id) WHERE event_id IS NOT NULL;
CREATE INDEX rounds_club_completed ON rounds (club_id, completed_at DESC) WHERE completed_at IS NOT NULL;

-- Share links moved onto the round itself (one revocable link per round).
DROP TABLE round_share_links;

-- The leaderboard view is replaced by queries that know about time zones,
-- formats and filters.
DROP VIEW leaderboard_entries;

-- ---------------------------------------------------------- hole scores --
ALTER TABLE hole_scores
  ADD COLUMN putts smallint CHECK (putts BETWEEN 0 AND 12);

-- --------------------------------------------------------------- events --
ALTER TABLE events
  ADD COLUMN kind text NOT NULL DEFAULT 'tournament'
    CHECK (kind IN ('tournament', 'clinic', 'social')),
  ADD COLUMN location text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE event_registrations DROP CONSTRAINT IF EXISTS event_registrations_status_check;
ALTER TABLE event_registrations
  ADD CONSTRAINT event_registrations_status_check
    CHECK (status IN ('registered', 'waitlisted', 'cancelled')),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX registrations_event_status ON event_registrations (event_id, status, created_at);

-- -------------------------------------------------------------- content --
ALTER TABLE content_items
  ADD COLUMN pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN author_id uuid REFERENCES admin_accounts (id) ON DELETE SET NULL,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- -------------------------------------------------------------- courses --
ALTER TABLE courses
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- -------------------------------------------------------- notifications --
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs (id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  kind text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_player_tenant_fk
    FOREIGN KEY (club_id, player_id) REFERENCES players (club_id, id) ON DELETE CASCADE
);

CREATE INDEX notifications_player_time ON notifications (player_id, created_at DESC);
CREATE INDEX notifications_player_unread ON notifications (player_id) WHERE read_at IS NULL;

-- --------------------------------------------------------- achievements --
CREATE TABLE player_achievements (
  club_id uuid NOT NULL REFERENCES clubs (id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  key text NOT NULL,
  round_id uuid REFERENCES rounds (id) ON DELETE SET NULL,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, key),
  CONSTRAINT achievements_player_tenant_fk
    FOREIGN KEY (club_id, player_id) REFERENCES players (club_id, id) ON DELETE CASCADE
);

CREATE INDEX achievements_club_time ON player_achievements (club_id, achieved_at DESC);

-- ------------------------------------------------------------- sessions --
CREATE INDEX sessions_expiry ON sessions (expires_at);
CREATE INDEX auth_attempts_time ON auth_attempts (attempted_at);
