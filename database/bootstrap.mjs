import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: 2,
});

function hashSecret(value) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(value, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `scrypt$16384$8$1$${salt}$${hash}`;
}

function requirePair(nameA, nameB) {
  const a = process.env[nameA];
  const b = process.env[nameB];
  if ((a && !b) || (!a && b)) throw new Error(`${nameA} and ${nameB} must be configured together`);
  return a && b ? [a, b] : null;
}

function slugify(value) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function playerUsername(value, code) {
  const base = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "speler";
  return `${base}-${code.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-4).padStart(4, "0")}`;
}

const platform = requirePair("BOOTSTRAP_ADMIN_EMAIL", "BOOTSTRAP_ADMIN_PASSWORD");
const owner = requirePair("BOOTSTRAP_OWNER_EMAIL", "BOOTSTRAP_OWNER_PASSWORD");
const playerCode = process.env.BOOTSTRAP_PLAYER_CODE;
const playerPin = process.env.BOOTSTRAP_PLAYER_PIN;
const playerName = process.env.BOOTSTRAP_PLAYER_NAME;

for (const credentials of [platform, owner]) {
  if (credentials && credentials[1].length < 12) throw new Error("Bootstrap admin passwords must contain at least 12 characters");
}
if ([playerCode, playerPin, playerName].some(Boolean) && ![playerCode, playerPin, playerName].every(Boolean)) {
  throw new Error("BOOTSTRAP_PLAYER_NAME, BOOTSTRAP_PLAYER_CODE and BOOTSTRAP_PLAYER_PIN must be configured together");
}
if (playerPin && !/^\d{4,12}$/.test(playerPin)) throw new Error("BOOTSTRAP_PLAYER_PIN must contain 4-12 digits");

const client = await pool.connect();
try {
  await client.query("BEGIN");

  if (platform) {
    await client.query(
      `INSERT INTO admin_accounts(role, email, display_name, password_hash)
       VALUES ('platform_admin', $1, 'Platformbeheerder', $2)
       ON CONFLICT (email) DO NOTHING`,
      [platform[0].toLowerCase(), hashSecret(platform[1])],
    );
  }

  if (owner || playerCode) {
    const clubName = process.env.BOOTSTRAP_CLUB_NAME || "Shortgolf Twente";
    const slug = slugify(clubName);
    const clubResult = await client.query(
      `INSERT INTO clubs(slug, name) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [slug, clubName],
    );
    const clubId = clubResult.rows[0].id;

    if (owner) {
      await client.query(
        `INSERT INTO admin_accounts(club_id, role, email, display_name, password_hash)
         VALUES ($1, 'club_owner', $2, 'Clubeigenaar', $3)
         ON CONFLICT (email) DO NOTHING`,
        [clubId, owner[0].toLowerCase(), hashSecret(owner[1])],
      );
    }

    const existingCourse = await client.query("SELECT id FROM courses WHERE club_id = $1 LIMIT 1", [clubId]);
    if (!existingCourse.rowCount) {
      const course = await client.query(
        `INSERT INTO courses(club_id, name, description, hole_count)
         VALUES ($1, '{"nl":"Shortgolf Twente","en":"Shortgolf Twente"}',
                 '{"nl":"Een toegankelijke par-3 baan in het Twentse groen.","en":"An accessible par-3 course in the Twente countryside."}', 9)
         RETURNING id`,
        [clubId],
      );
      const tee = await client.query(
        `INSERT INTO tee_sets(club_id, course_id, name, color, is_default)
         VALUES ($1, $2, '{"nl":"Club","en":"Club"}', 'green', true) RETURNING id`,
        [clubId, course.rows[0].id],
      );
      const distances = [37, 45, 46, 31, 45, 48, 60, 32, 50];
      for (let index = 0; index < distances.length; index += 1) {
        await client.query(
          `INSERT INTO holes(club_id, course_id, tee_set_id, number, par, distance_m)
           VALUES ($1, $2, $3, $4, 3, $5)`,
          [clubId, course.rows[0].id, tee.rows[0].id, index + 1, distances[index]],
        );
      }
    }

    if (playerCode) {
      const initials = playerName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
      await client.query(
        `INSERT INTO players(club_id, display_name, initials, username, code, pin_hash)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO NOTHING`,
        [clubId, playerName, initials, playerUsername(playerName, playerCode), playerCode.toUpperCase(), hashSecret(playerPin)],
      );
    }
  }

  await client.query("COMMIT");
  console.log("Bootstrap completed without exposing credentials.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
