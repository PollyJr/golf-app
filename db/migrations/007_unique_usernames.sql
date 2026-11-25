-- Usernames are sign-in names, so they have to be unique across clubs, not
-- just within one. Where two clubs already share a username, the later
-- account gets a short suffix (it can still sign in with its player code and
-- pick another name in the app).
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY lower(username::text) ORDER BY created_at, id) AS position
    FROM players
)
UPDATE players p
   SET username = left(p.username::text, 24) || '-' || substr(replace(p.id::text, '-', ''), 1, 5)
  FROM ranked
 WHERE ranked.id = p.id AND ranked.position > 1;

CREATE UNIQUE INDEX players_username_unique ON players (lower(username::text));
