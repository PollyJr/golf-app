// Creates the first accounts of a fresh installation from BOOTSTRAP_* variables.
//
// Existing accounts are never overwritten, so it is safe to leave this in the
// deploy pipeline. To recover access, set BOOTSTRAP_RESET_CREDENTIALS=true for
// a single deploy: the passwords/PIN of the configured accounts are then
// replaced by the configured values.
import { randomBytes } from "node:crypto";
import { createScriptPool, initialsOf, slugify, usernameFor } from "./lib/connection.mjs";
import { hashSecret } from "./lib/secret-hash.mjs";

const MIN_PASSWORD_LENGTH = 12;
const env = process.env;

/** @returns {[string, string] | null} */
function pair(emailName, passwordName) {
  const email = env[emailName]?.trim();
  const password = env[passwordName];
  if (Boolean(email) !== Boolean(password)) {
    // The README says to remove the passwords after the first deploy; an
    // e-mail left behind on its own must not block every later release.
    console.log(`bootstrap: ${emailName} and ${passwordName} are not both set; skipping that account.`);
    return null;
  }
  if (!email || !password) return null;
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`${passwordName} must contain at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return [email.toLowerCase(), password];
}

const platform = pair("BOOTSTRAP_ADMIN_EMAIL", "BOOTSTRAP_ADMIN_PASSWORD");
const owner = pair("BOOTSTRAP_OWNER_EMAIL", "BOOTSTRAP_OWNER_PASSWORD");
const player = {
  name: env.BOOTSTRAP_PLAYER_NAME?.trim(),
  code: env.BOOTSTRAP_PLAYER_CODE?.trim().toUpperCase(),
  pin: env.BOOTSTRAP_PLAYER_PIN,
};
let playerValues = Object.values(player).filter(Boolean).length;
if (playerValues !== 0 && playerValues !== 3) {
  console.log("bootstrap: BOOTSTRAP_PLAYER_NAME, _CODE and _PIN are not all set; skipping the player.");
  playerValues = 0;
}
if (playerValues === 3 && !/^\d{4,12}$/.test(player.pin)) {
  throw new Error("BOOTSTRAP_PLAYER_PIN must contain 4 to 12 digits");
}
const reset = env.BOOTSTRAP_RESET_CREDENTIALS === "true";

if (!platform && !owner && playerValues === 0) {
  console.log("bootstrap: no BOOTSTRAP_* accounts configured, nothing to do.");
  process.exit(0);
}

const pool = createScriptPool();
const client = await pool.connect();

try {
  await client.query("BEGIN");

  if (platform) {
    const hash = await hashSecret(platform[1]);
    await client.query(
      `INSERT INTO admin_accounts (role, email, display_name, password_hash)
       VALUES ('platform_admin', $1, 'Platformbeheerder', $2)
       ON CONFLICT (email) DO UPDATE
         SET password_hash = CASE WHEN $3 THEN EXCLUDED.password_hash ELSE admin_accounts.password_hash END,
             failed_attempts = CASE WHEN $3 THEN 0 ELSE admin_accounts.failed_attempts END,
             locked_until = CASE WHEN $3 THEN NULL ELSE admin_accounts.locked_until END`,
      [platform[0], hash, reset],
    );
  }

  if (owner || playerValues === 3) {
    const clubName = env.BOOTSTRAP_CLUB_NAME?.trim() || "Shortgolf Twente";
    const slug = slugify(clubName) || "club";
    const club = await client.query(
      `INSERT INTO clubs (slug, name, join_code, board_token)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
       RETURNING id`,
      [slug, clubName, randomBytes(4).toString("hex").toUpperCase(), randomBytes(24).toString("hex")],
    );
    const clubId = club.rows[0].id;

    if (owner) {
      const hash = await hashSecret(owner[1]);
      await client.query(
        `INSERT INTO admin_accounts (club_id, role, email, display_name, password_hash)
         VALUES ($1, 'club_owner', $2, 'Clubeigenaar', $3)
         ON CONFLICT (email) DO UPDATE
           SET password_hash = CASE WHEN $4 THEN EXCLUDED.password_hash ELSE admin_accounts.password_hash END,
               failed_attempts = CASE WHEN $4 THEN 0 ELSE admin_accounts.failed_attempts END,
               locked_until = CASE WHEN $4 THEN NULL ELSE admin_accounts.locked_until END`,
        [clubId, owner[0], hash, reset],
      );
    }

    // A club without a course cannot start a round: give new clubs a first one.
    const courses = await client.query("SELECT 1 FROM courses WHERE club_id = $1 LIMIT 1", [clubId]);
    if (courses.rowCount === 0) {
      const course = await client.query(
        `INSERT INTO courses (club_id, name, description, hole_count)
         VALUES ($1, jsonb_build_object('nl', $2::text, 'en', $2::text),
                 '{"nl":"Een toegankelijke par-3 baan.","en":"An accessible par-3 course."}', 9)
         RETURNING id`,
        [clubId, clubName],
      );
      const tee = await client.query(
        `INSERT INTO tee_sets (club_id, course_id, name, color, is_default)
         VALUES ($1, $2, '{"nl":"Club","en":"Club"}', 'green', true) RETURNING id`,
        [clubId, course.rows[0].id],
      );
      const distances = [37, 45, 46, 31, 45, 48, 60, 32, 50];
      for (const [index, distance] of distances.entries()) {
        await client.query(
          "INSERT INTO holes (club_id, course_id, tee_set_id, number, par, distance_m) VALUES ($1, $2, $3, $4, 3, $5)",
          [clubId, course.rows[0].id, tee.rows[0].id, index + 1, distance],
        );
      }
    }

    if (playerValues === 3) {
      const hash = await hashSecret(player.pin);
      await client.query(
        `INSERT INTO players (club_id, display_name, initials, username, code, pin_hash, must_change_pin)
         VALUES ($1, $2, $3, $4, $5, $6, false)
         ON CONFLICT (code) DO UPDATE
           SET pin_hash = CASE WHEN $7 THEN EXCLUDED.pin_hash ELSE players.pin_hash END,
               failed_attempts = CASE WHEN $7 THEN 0 ELSE players.failed_attempts END,
               locked_until = CASE WHEN $7 THEN NULL ELSE players.locked_until END`,
        [clubId, player.name, initialsOf(player.name), usernameFor(player.name, player.code), player.code, hash, reset],
      );
    }
  }

  if (reset) {
    // New credentials must also end whatever sessions the old ones opened.
    const emails = [platform?.[0], owner?.[0]].filter(Boolean);
    await client.query(
      `DELETE FROM sessions
        WHERE account_id IN (SELECT id FROM admin_accounts WHERE email = ANY($1::citext[]))
           OR account_id IN (SELECT id FROM players WHERE code = $2)`,
      [emails, playerValues === 3 ? player.code : null],
    );
  }

  await client.query("COMMIT");
  console.log(`bootstrap: accounts are in place${reset ? " (credentials reset)" : ""}.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
