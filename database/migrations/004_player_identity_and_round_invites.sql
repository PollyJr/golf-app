ALTER TYPE round_status ADD VALUE IF NOT EXISTS 'inviting' BEFORE 'active';

ALTER TABLE players ADD COLUMN username citext;

UPDATE players
   SET username = left(COALESCE(NULLIF(regexp_replace(lower(display_name), '[^a-z0-9]+', '', 'g'), ''), 'speler'), 24)
                  || '-' || lower(right(code::text, 4));

ALTER TABLE players ALTER COLUMN username SET NOT NULL;
ALTER TABLE players ADD CONSTRAINT players_username_format_check
  CHECK (username::text ~ '^[a-z0-9][a-z0-9._-]{2,29}$');
CREATE UNIQUE INDEX players_club_username_unique ON players(club_id, username);

ALTER TABLE round_participants
  ADD COLUMN invitation_status text NOT NULL DEFAULT 'accepted'
    CHECK (invitation_status IN ('pending', 'accepted')),
  ADD COLUMN invited_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN responded_at timestamptz;

CREATE INDEX round_pending_invites
  ON round_participants(club_id, player_id, invited_at DESC)
  WHERE invitation_status = 'pending';

CREATE INDEX rounds_inviting_participant_lookup
  ON rounds(club_id, status, created_at DESC)
  WHERE status = 'inviting';
