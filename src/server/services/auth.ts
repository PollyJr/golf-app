import "server-only";

import { createSession, type IssuedSession } from "../auth/session";
import { audit } from "../audit";
import { db, maybeOne, one } from "../db";
import { AppError, tooManyRequests } from "../errors";
import { DUMMY_HASH, hashClientIp, hashIdentifier, verifySecret } from "../security";
import type { AccountRole } from "@/lib/types";

const WINDOW_MINUTES = 15;
/** Wrong guesses allowed per account (or other secret) in one window. */
const MAX_FAILURES_PER_IDENTIFIER = 8;
/** Per client address the budget is wider: a whole clubhouse may share one. */
const MAX_FAILURES_PER_ADDRESS = 20;
const LOCK_AFTER_FAILURES = 5;

/**
 * Sign-in for players and administrators. Both share the same defences:
 * a failure budget per identifier and per client address, a temporary lock on
 * the account after repeated failures, and a response that does not reveal
 * whether the account exists.
 */

/**
 * Books a guess *before* the secret is checked and refuses it when the budget
 * is spent. Booking first is what makes the limit hold under concurrency: of
 * any number of simultaneous requests, only the first few can ever see a count
 * within budget. A guess that turns out right is un-booked with `confirmGuess`.
 */
export async function reserveGuess(identifier: string, request: Request): Promise<number> {
  const identifierHash = hashIdentifier(identifier);
  const ipHash = hashClientIp(request);
  const attempt = await one<{ id: number }>(
    "INSERT INTO auth_attempts (identifier_hash, ip_hash, success) VALUES ($1, $2, false) RETURNING id",
    [identifierHash, ipHash],
  );
  const recent = await one<{ by_identifier: number; by_address: number }>(
    `SELECT count(*) FILTER (WHERE identifier_hash = $1)::int AS by_identifier,
            count(*) FILTER (WHERE ip_hash = $2)::int AS by_address
       FROM auth_attempts
      WHERE attempted_at > now() - interval '${WINDOW_MINUTES} minutes' AND NOT success
        AND (identifier_hash = $1 OR ip_hash = $2)`,
    [identifierHash, ipHash],
  );
  // Opportunistic housekeeping; the table only matters for the last minutes.
  if (Math.random() < 0.02) {
    void db.query("DELETE FROM auth_attempts WHERE attempted_at < now() - interval '1 day'").catch(() => {});
  }
  if (recent.by_identifier > MAX_FAILURES_PER_IDENTIFIER || recent.by_address > MAX_FAILURES_PER_ADDRESS) {
    throw tooManyRequests();
  }
  return attempt.id;
}

export async function confirmGuess(attemptId: number): Promise<void> {
  await db.query("UPDATE auth_attempts SET success = true WHERE id = $1", [attemptId]);
}

/**
 * Counts a wrong secret against the account and locks it after too many. A
 * lock is never extended by further attempts, and the count starts afresh once
 * a lock has run out.
 */
async function registerFailure(table: "players" | "admin_accounts", accountId: string): Promise<void> {
  await db.query(
    `UPDATE ${table}
        SET failed_attempts = CASE WHEN locked_until IS NOT NULL THEN 1 ELSE failed_attempts + 1 END,
            locked_until = CASE
              WHEN (CASE WHEN locked_until IS NOT NULL THEN 1 ELSE failed_attempts + 1 END) >= ${LOCK_AFTER_FAILURES}
              THEN now() + interval '${WINDOW_MINUTES} minutes'
            END
      WHERE id = $1 AND (locked_until IS NULL OR locked_until <= now())`,
    [accountId],
  );
}

/** Clears the failure count; succeeds only while the account is not locked. */
async function registerSuccess(table: "players" | "admin_accounts", accountId: string): Promise<boolean> {
  const result = await db.query(
    `UPDATE ${table}
        SET failed_attempts = 0, locked_until = NULL, last_login_at = now()
      WHERE id = $1 AND (locked_until IS NULL OR locked_until <= now())`,
    [accountId],
  );
  return result.rowCount === 1;
}

export interface SignInResult {
  issued: IssuedSession;
  role: AccountRole;
  mustChangeSecret: boolean;
  /** Players only: the interface language they chose earlier. */
  preferredLanguage: string | null;
}

const invalidCredentials = () => new AppError("INVALID_CREDENTIALS", 401);

interface PlayerRow {
  id: string;
  club_id: string;
  pin_hash: string;
  must_change_pin: boolean;
  registration_status: string;
  preferred_language: string | null;
}

const PLAYER_LOOKUP = `
  SELECT p.id, p.club_id, p.pin_hash, p.must_change_pin, p.registration_status, p.preferred_language
    FROM players p
    JOIN clubs c ON c.id = p.club_id AND c.status IN ('trial', 'active')
   WHERE p.active`;

/** A player code always wins; a username only counts when no code matches. */
async function findPlayer(identifier: string): Promise<PlayerRow | null> {
  const byCode = await maybeOne<PlayerRow>(`${PLAYER_LOOKUP} AND lower(p.code::text) = $1`, [identifier]);
  if (byCode) return byCode;
  return maybeOne<PlayerRow>(`${PLAYER_LOOKUP} AND lower(p.username::text) = $1`, [identifier]);
}

/** Players sign in with their player code or username, plus their PIN. */
export async function signInPlayer(identifier: string, pin: string, request: Request): Promise<SignInResult> {
  const normalized = identifier.trim().toLowerCase().replace(/^@/, "");
  const attemptId = await reserveGuess(`player:${normalized}`, request);

  const player = await findPlayer(normalized);
  const pinMatches = await verifySecret(pin, player?.pin_hash ?? DUMMY_HASH);
  if (!player || !pinMatches) {
    if (player) await registerFailure("players", player.id);
    throw invalidCredentials();
  }
  // While locked even the right PIN is refused, and the guess stays booked.
  if (!(await registerSuccess("players", player.id))) throw invalidCredentials();
  await confirmGuess(attemptId);

  if (player.registration_status !== "approved") {
    throw new AppError(player.registration_status === "pending" ? "REGISTRATION_PENDING" : "REGISTRATION_REJECTED", 403);
  }
  const issued = await createSession({ role: "player", accountId: player.id, clubId: player.club_id }, request);
  return { issued, role: "player", mustChangeSecret: player.must_change_pin, preferredLanguage: player.preferred_language };
}

/** Club staff and platform administrators sign in with e-mail and password. */
export async function signInAdmin(email: string, password: string, request: Request): Promise<SignInResult> {
  const normalized = email.trim().toLowerCase();
  const attemptId = await reserveGuess(`admin:${normalized}`, request);

  const admin = await maybeOne<{
    id: string;
    club_id: string | null;
    role: AccountRole;
    password_hash: string;
    must_change_password: boolean;
  }>(
    `SELECT a.id, a.club_id, a.role, a.password_hash, a.must_change_password
       FROM admin_accounts a
       LEFT JOIN clubs c ON c.id = a.club_id
      WHERE a.email = $1 AND a.active
        AND (a.role = 'platform_admin' OR c.status IN ('trial', 'active'))`,
    [normalized],
  );
  const passwordMatches = await verifySecret(password, admin?.password_hash ?? DUMMY_HASH);
  if (!admin || !passwordMatches) {
    if (admin) await registerFailure("admin_accounts", admin.id);
    throw invalidCredentials();
  }
  if (!(await registerSuccess("admin_accounts", admin.id))) throw invalidCredentials();
  await confirmGuess(attemptId);

  const issued = await createSession({ role: admin.role, accountId: admin.id, clubId: admin.club_id }, request);
  await audit({
    clubId: admin.club_id,
    actor: { role: admin.role, accountId: admin.id },
    action: "admin.signed_in",
    entityType: "admin",
    entityId: admin.id,
    request,
  });
  return { issued, role: admin.role, mustChangeSecret: admin.must_change_password, preferredLanguage: null };
}
