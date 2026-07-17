ALTER TABLE rounds ALTER COLUMN completed_at DROP NOT NULL;
ALTER TABLE rounds ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE rounds ADD COLUMN revision bigint NOT NULL DEFAULT 0;

ALTER TABLE round_participants DROP CONSTRAINT IF EXISTS round_participants_total_strokes_check;
ALTER TABLE round_participants ALTER COLUMN total_strokes SET DEFAULT 0;
ALTER TABLE round_participants ADD CONSTRAINT round_participants_total_strokes_check CHECK (total_strokes >= 0);
ALTER TABLE round_participants ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX round_registered_participant_unique
  ON round_participants(round_id, player_id)
  WHERE player_id IS NOT NULL;

ALTER TABLE hole_scores ADD COLUMN updated_by_player_id uuid;
ALTER TABLE hole_scores ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE hole_scores ADD CONSTRAINT scores_updated_by_tenant_fk
  FOREIGN KEY (club_id, updated_by_player_id) REFERENCES players (club_id, id);

CREATE TABLE round_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_by_player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT share_round_tenant_fk FOREIGN KEY (club_id, round_id) REFERENCES rounds (club_id, id),
  CONSTRAINT share_creator_tenant_fk FOREIGN KEY (club_id, created_by_player_id) REFERENCES players (club_id, id)
);

CREATE INDEX round_share_token_active ON round_share_links(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX round_share_round_active ON round_share_links(club_id, round_id) WHERE revoked_at IS NULL;
CREATE INDEX rounds_active_participant_lookup ON rounds(club_id, status, created_at DESC) WHERE status = 'active';
