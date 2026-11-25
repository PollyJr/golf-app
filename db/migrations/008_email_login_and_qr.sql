-- Players sign in with their e-mail address, and add each other to a round by
-- scanning a QR code.

-- E-mail is a sign-in name now, so it must be unique across all clubs. Where
-- two players share an address, the oldest account keeps it.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY lower(email::text) ORDER BY created_at, id) AS position
    FROM players
   WHERE email IS NOT NULL
)
UPDATE players p SET email = NULL
  FROM ranked
 WHERE ranked.id = p.id AND ranked.position > 1;

UPDATE players SET email = NULL WHERE email IS NOT NULL AND btrim(email::text) = '';

CREATE UNIQUE INDEX players_email_unique ON players (lower(email::text)) WHERE email IS NOT NULL;

-- A personal token behind each player's QR code. Whoever scans it may add
-- that player to their round; the player can replace it at any time.
ALTER TABLE players
  ADD COLUMN qr_token text NOT NULL DEFAULT translate(encode(gen_random_bytes(18), 'base64'), '+/', '-_');
CREATE UNIQUE INDEX players_qr_token_unique ON players (qr_token);

-- A token per round behind its "join this round" QR code.
ALTER TABLE rounds ADD COLUMN join_token text;
UPDATE rounds SET join_token = translate(encode(gen_random_bytes(18), 'base64'), '+/', '-_')
 WHERE status IN ('inviting', 'active');
ALTER TABLE rounds ALTER COLUMN join_token SET DEFAULT translate(encode(gen_random_bytes(18), 'base64'), '+/', '-_');
CREATE UNIQUE INDEX rounds_join_token_unique ON rounds (join_token) WHERE join_token IS NOT NULL;
