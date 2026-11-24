import "server-only";

import { createSession, destroyAccountSessions, type ClubSession, type IssuedSession } from "../auth/session";
import { audit } from "../audit";
import { db, many, maybeOne, one, transaction, type Db } from "../db";
import { AppError, badRequest, conflict, forbidden, isUniqueViolation, notFound, tooManyRequests } from "../errors";
import { friendlyCode, hashClientIp, hashIdentifier, hashSecret, randomPin, verifySecret } from "../security";
import { initialsOf } from "@/lib/format";
import type { Locale } from "@/lib/i18n/core";
import type { AdminPlayer, IssuedCredentials, PlayerSummary, RegistrationStatus } from "@/lib/types";
import { USERNAME_PATTERN, usernameFromName } from "@/lib/validation";

const CODE_PREFIX = "FW";
const MAX_INSERT_ATTEMPTS = 5;
const SEARCH_LIMIT = 8;
const REGISTRATIONS_PER_WINDOW = 5;

interface SummaryRow {
  id: string;
  display_name: string;
  username: string;
  club_index: number | null;
}

function toSummary(row: SummaryRow): PlayerSummary {
  return {
    id: row.id,
    name: row.display_name,
    initials: initialsOf(row.display_name),
    username: row.username,
    clubIndex: row.club_index,
  };
}

// --------------------------------------------------------------- lookup --

export async function getPlayerSummary(clubId: string, playerId: string, on: Db = db): Promise<PlayerSummary | null> {
  const row = await maybeOne<SummaryRow>(
    `SELECT id, display_name, username::text AS username, club_index
       FROM players
      WHERE club_id = $1 AND id = $2 AND active AND registration_status = 'approved'`,
    [clubId, playerId],
    on,
  );
  return row ? toSummary(row) : null;
}

/** Finds club mates by name or username, for composing a flight. */
export async function searchPlayers(clubId: string, selfId: string, query: string): Promise<PlayerSummary[]> {
  const term = query.trim().toLowerCase().replace(/^@/, "");
  if (term.length < 2) return [];
  const escaped = term.replace(/[\\%_]/g, (match) => `\\${match}`);
  const rows = await many<SummaryRow>(
    `SELECT id, display_name, username::text AS username, club_index
       FROM players
      WHERE club_id = $1 AND active AND registration_status = 'approved' AND id <> $2
        AND (lower(display_name) LIKE '%' || $3 || '%' OR lower(username::text) LIKE $3 || '%')
      ORDER BY (lower(username::text) = $4) DESC, (lower(display_name) LIKE $3 || '%') DESC, display_name
      LIMIT ${SEARCH_LIMIT}`,
    [clubId, selfId, escaped, term],
  );
  return rows.map(toSummary);
}

/** The club mates a player has shared a flight with most recently. */
export async function recentPartners(clubId: string, playerId: string, limit = 6): Promise<PlayerSummary[]> {
  const rows = await many<SummaryRow>(
    `SELECT p.id, p.display_name, p.username::text AS username, p.club_index
       FROM players p
       JOIN (
         SELECT other.player_id, max(r.created_at) AS last_played
           FROM round_participants mine
           JOIN rounds r ON r.id = mine.round_id AND r.club_id = $1
           JOIN round_participants other ON other.round_id = r.id AND other.player_id IS NOT NULL AND other.player_id <> $2
          WHERE mine.player_id = $2
          GROUP BY other.player_id
       ) partners ON partners.player_id = p.id
      WHERE p.club_id = $1 AND p.active AND p.registration_status = 'approved'
      ORDER BY partners.last_played DESC
      LIMIT $3`,
    [clubId, playerId, limit],
  );
  return rows.map(toSummary);
}

// ------------------------------------------------------- self-service --

export async function changeUsername(session: ClubSession, username: string, request: Request): Promise<string> {
  const normalized = username.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(normalized)) throw badRequest("INVALID_USERNAME");
  try {
    await db.query("UPDATE players SET username = $1, updated_at = now() WHERE id = $2 AND club_id = $3", [
      normalized,
      session.accountId,
      session.clubId,
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("USERNAME_TAKEN");
    throw error;
  }
  await audit({ clubId: session.clubId, actor: session, action: "player.username_changed", entityType: "player", entityId: session.accountId, request });
  return normalized;
}

/** Changes the PIN and signs the player out everywhere else. */
export async function changePin(session: ClubSession, currentPin: string, newPin: string, request: Request): Promise<void> {
  if (currentPin === newPin) throw badRequest("PIN_UNCHANGED");
  const player = await maybeOne<{ pin_hash: string }>(
    "SELECT pin_hash FROM players WHERE id = $1 AND club_id = $2 AND active",
    [session.accountId, session.clubId],
  );
  if (!player || !(await verifySecret(currentPin, player.pin_hash))) throw new AppError("CURRENT_PIN_INVALID", 403);
  const newHash = await hashSecret(newPin);
  await transaction(async (tx) => {
    const changed = await tx.query(
      `UPDATE players SET pin_hash = $1, must_change_pin = false, failed_attempts = 0, locked_until = NULL, updated_at = now()
        WHERE id = $2 AND club_id = $3 AND pin_hash = $4`,
      [newHash, session.accountId, session.clubId, player.pin_hash],
    );
    if (changed.rowCount === 0) throw conflict("PIN_CHANGED_CONCURRENTLY");
    await destroyAccountSessions("player", session.accountId, session.id, tx);
    await audit({ clubId: session.clubId, actor: session, action: "player.pin_changed", entityType: "player", entityId: session.accountId, request }, tx);
  });
}

export async function setPreferredLanguage(session: ClubSession, locale: Locale): Promise<void> {
  await db.query("UPDATE players SET preferred_language = $1 WHERE id = $2 AND club_id = $3", [
    locale,
    session.accountId,
    session.clubId,
  ]);
}

// --------------------------------------------------------- registration --

interface NewPlayer {
  displayName: string;
  email?: string | null;
  username?: string;
  pinHash: string;
  mustChangePin: boolean;
  registrationStatus: RegistrationStatus;
}

/** Inserts a player with a fresh code, retrying when a random code collides. */
async function insertPlayer(on: Db, clubId: string, player: NewPlayer): Promise<{ id: string; code: string; username: string }> {
  for (let attempt = 0; attempt < MAX_INSERT_ATTEMPTS; attempt += 1) {
    const code = `${CODE_PREFIX}-${friendlyCode(6)}`;
    const username = player.username ?? usernameFromName(player.displayName, code);
    // A savepoint keeps the surrounding transaction usable after a collision.
    await on.query("SAVEPOINT insert_player");
    try {
      const row = await one<{ id: string }>(
        `INSERT INTO players (club_id, display_name, initials, username, code, pin_hash, email,
                              must_change_pin, registration_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          clubId,
          player.displayName,
          initialsOf(player.displayName),
          username,
          code,
          player.pinHash,
          player.email || null,
          player.mustChangePin,
          player.registrationStatus,
        ],
        on,
      );
      await on.query("RELEASE SAVEPOINT insert_player");
      return { id: row.id, code, username };
    } catch (error) {
      await on.query("ROLLBACK TO SAVEPOINT insert_player");
      if (!isUniqueViolation(error)) throw error;
      // A chosen username that is taken is the caller's problem; a random
      // code or generated username colliding is ours, so try again.
      if (player.username && isUniqueViolation(error, "players_club_username_unique")) throw conflict("USERNAME_TAKEN");
    }
  }
  throw new Error("Could not generate a unique player code");
}

export interface RegistrationInput {
  joinCode: string;
  displayName: string;
  username: string;
  pin: string;
  email: string | null;
}

export interface RegistrationResult {
  status: "approved" | "pending";
  code: string;
  issued: IssuedSession | null;
}

/** A new member signs up with the club's join code. */
export async function registerPlayer(input: RegistrationInput, request: Request): Promise<RegistrationResult> {
  const ipHash = hashClientIp(request);
  const budgetKey = hashIdentifier("register");
  const recent = await one<{ count: number }>(
    `SELECT count(*)::int AS count FROM auth_attempts
      WHERE identifier_hash = $1 AND ip_hash = $2 AND attempted_at > now() - interval '15 minutes'`,
    [budgetKey, ipHash],
  );
  if (recent.count >= REGISTRATIONS_PER_WINDOW) throw tooManyRequests();
  await db.query("INSERT INTO auth_attempts (identifier_hash, ip_hash, success) VALUES ($1, $2, true)", [budgetKey, ipHash]);

  const username = input.username.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) throw badRequest("INVALID_USERNAME");
  const pinHash = await hashSecret(input.pin);

  const created = await transaction(async (tx) => {
    const club = await maybeOne<{ id: string; self_registration: string }>(
      "SELECT id, self_registration FROM clubs WHERE upper(join_code) = upper($1) AND status IN ('trial', 'active')",
      [input.joinCode.trim()],
      tx,
    );
    if (!club) throw notFound("JOIN_CODE_INVALID");
    if (club.self_registration === "closed") throw forbidden("REGISTRATION_CLOSED");
    const status: "approved" | "pending" = club.self_registration === "open" ? "approved" : "pending";
    const player = await insertPlayer(tx, club.id, {
      displayName: input.displayName.trim(),
      email: input.email,
      username,
      pinHash,
      mustChangePin: false,
      registrationStatus: status,
    });
    await audit(
      { clubId: club.id, actor: { role: "player", accountId: player.id }, action: "player.registered", entityType: "player", entityId: player.id, metadata: { status }, request },
      tx,
    );
    return { ...player, clubId: club.id, status };
  });

  const issued =
    created.status === "approved"
      ? await createSession({ role: "player", accountId: created.id, clubId: created.clubId }, request)
      : null;
  return { status: created.status, code: created.code, issued };
}

// ---------------------------------------------------------------- staff --

export type PlayerFilter = "all" | "active" | "inactive" | "pending";

export async function listPlayersForStaff(clubId: string, filter: PlayerFilter = "all"): Promise<AdminPlayer[]> {
  const rows = await many<{
    id: string;
    display_name: string;
    username: string;
    code: string;
    email: string | null;
    active: boolean;
    registration_status: RegistrationStatus;
    must_change_pin: boolean;
    locked: boolean | null;
    club_index: number | null;
    rounds: number;
    last_login_at: Date | null;
    created_at: Date;
  }>(
    `SELECT p.id, p.display_name, p.username::text AS username, p.code::text AS code, p.email::text AS email,
            p.active, p.registration_status, p.must_change_pin, p.locked_until > now() AS locked, p.club_index,
            (SELECT count(*)::int FROM round_participants rp
               JOIN rounds r ON r.id = rp.round_id AND r.status = 'approved'
              WHERE rp.player_id = p.id) AS rounds,
            p.last_login_at, p.created_at
       FROM players p
      WHERE p.club_id = $1
        AND CASE $2
              WHEN 'active' THEN p.active AND p.registration_status = 'approved'
              WHEN 'inactive' THEN NOT p.active AND p.registration_status = 'approved'
              WHEN 'pending' THEN p.registration_status = 'pending'
              ELSE p.registration_status <> 'rejected'
            END
      ORDER BY (p.registration_status = 'pending') DESC, p.display_name`,
    [clubId, filter],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.display_name,
    initials: initialsOf(row.display_name),
    username: row.username,
    clubIndex: row.club_index,
    code: row.code,
    email: row.email,
    active: row.active,
    registrationStatus: row.registration_status,
    mustChangePin: row.must_change_pin,
    locked: row.locked === true,
    rounds: row.rounds,
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function countPendingRegistrations(clubId: string): Promise<number> {
  const row = await one<{ count: number }>(
    "SELECT count(*)::int AS count FROM players WHERE club_id = $1 AND registration_status = 'pending'",
    [clubId],
  );
  return row.count;
}

/**
 * Staff create accounts for members. The generated PIN is returned exactly
 * once, to hand over; the player must choose their own at first sign-in.
 */
export async function createPlayers(
  session: ClubSession,
  players: ReadonlyArray<{ displayName: string; email?: string | null }>,
  request: Request,
): Promise<IssuedCredentials[]> {
  const prepared = await Promise.all(
    players.map(async (player) => {
      const pin = randomPin();
      return { ...player, displayName: player.displayName.trim(), pin, pinHash: await hashSecret(pin) };
    }),
  );
  return transaction(async (tx) => {
    const issued: IssuedCredentials[] = [];
    for (const player of prepared) {
      const created = await insertPlayer(tx, session.clubId, {
        displayName: player.displayName,
        email: player.email,
        pinHash: player.pinHash,
        mustChangePin: true,
        registrationStatus: "approved",
      });
      issued.push({ id: created.id, name: player.displayName, code: created.code, username: created.username, pin: player.pin });
      await audit({ clubId: session.clubId, actor: session, action: "player.created", entityType: "player", entityId: created.id, request }, tx);
    }
    return issued;
  });
}

export async function updatePlayer(
  session: ClubSession,
  playerId: string,
  changes: { displayName: string; email: string | null },
): Promise<void> {
  const name = changes.displayName.trim();
  const updated = await db.query(
    `UPDATE players SET display_name = $3, initials = $4, email = $5, updated_at = now()
      WHERE club_id = $1 AND id = $2`,
    [session.clubId, playerId, name, initialsOf(name), changes.email || null],
  );
  if (updated.rowCount === 0) throw notFound("PLAYER_NOT_FOUND");
  await audit({ clubId: session.clubId, actor: session, action: "player.updated", entityType: "player", entityId: playerId });
}

export async function setPlayerActive(session: ClubSession, playerId: string, active: boolean): Promise<void> {
  await transaction(async (tx) => {
    const updated = await tx.query(
      "UPDATE players SET active = $3, failed_attempts = 0, locked_until = NULL, updated_at = now() WHERE club_id = $1 AND id = $2",
      [session.clubId, playerId, active],
    );
    if (updated.rowCount === 0) throw notFound("PLAYER_NOT_FOUND");
    if (!active) await destroyAccountSessions("player", playerId, undefined, tx);
    await audit(
      { clubId: session.clubId, actor: session, action: active ? "player.activated" : "player.deactivated", entityType: "player", entityId: playerId },
      tx,
    );
  });
}

/** Issues a new one-time PIN and signs the player out everywhere. */
export async function resetPlayerPin(session: ClubSession, playerId: string): Promise<IssuedCredentials> {
  const pin = randomPin();
  const pinHash = await hashSecret(pin);
  return transaction(async (tx) => {
    const player = await maybeOne<{ display_name: string; code: string; username: string }>(
      `UPDATE players
          SET pin_hash = $3, must_change_pin = true, failed_attempts = 0, locked_until = NULL, updated_at = now()
        WHERE club_id = $1 AND id = $2
        RETURNING display_name, code::text AS code, username::text AS username`,
      [session.clubId, playerId, pinHash],
      tx,
    );
    if (!player) throw notFound("PLAYER_NOT_FOUND");
    await destroyAccountSessions("player", playerId, undefined, tx);
    await audit({ clubId: session.clubId, actor: session, action: "player.pin_reset", entityType: "player", entityId: playerId }, tx);
    return { id: playerId, name: player.display_name, code: player.code, username: player.username, pin };
  });
}

/** Approves a self-registration, or removes it so the username is free again. */
export async function decideRegistration(session: ClubSession, playerId: string, approve: boolean): Promise<void> {
  const result = approve
    ? await db.query(
        `UPDATE players SET registration_status = 'approved', updated_at = now()
          WHERE club_id = $1 AND id = $2 AND registration_status = 'pending'`,
        [session.clubId, playerId],
      )
    : await db.query("DELETE FROM players WHERE club_id = $1 AND id = $2 AND registration_status = 'pending'", [
        session.clubId,
        playerId,
      ]);
  if (result.rowCount === 0) throw notFound("PLAYER_NOT_FOUND");
  await audit({
    clubId: session.clubId,
    actor: session,
    action: approve ? "player.registration_approved" : "player.registration_rejected",
    entityType: "player",
    entityId: playerId,
  });
}
