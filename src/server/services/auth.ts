import "server-only";

import { createSession, type IssuedSession } from "../auth/session";
import { audit } from "../audit";
import { db, maybeOne, one } from "../db";
import { AppError, tooManyRequests } from "../errors";
import { DUMMY_HASH, hashClientIp, hashIdentifier, verifySecret } from "../security";
import type { AccountRole } from "@/lib/types";

const WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_WINDOW = 8;
const LOCK_AFTER_FAILURES = 5;

/**
 * Sign-in for players and administrators. Both share the same defences:
 * a failure budget per identifier and per client address, a temporary lock on
 * the account after repeated failures, and a response that does not reveal
 * whether the account exists.
 */

async function assertWithinBudget(identifierHash: string, ipHash: string): Promise<void> {
  const recent = await one<{ failures: number }>(
    `SELECT count(*)::int AS failures FROM auth_attempts
      WHERE attempted_at > now() - interval '${WINDOW_MINUTES} minutes' AND NOT success
        AND (identifier_hash = $1 OR ip_hash = $2)`,
    [identifierHash, ipHash],
  );
  if (recent.failures >= MAX_FAILURES_PER_WINDOW) throw tooManyRequests();
}

async function recordAttempt(identifierHash: string, ipHash: string, success: boolean): Promise<void> {
  await db.query("INSERT INTO auth_attempts (identifier_hash, ip_hash, success) VALUES ($1, $2, $3)", [
    identifierHash,
    ipHash,
    success,
  ]);
  // Opportunistic housekeeping; the table only matters for the last minutes.
  if (Math.random() < 0.02) {
    void db.query("DELETE FROM auth_attempts WHERE attempted_at < now() - interval '1 day'").catch(() => {});
  }
}

export interface SignInResult {
  issued: IssuedSession;
  role: AccountRole;
  mustChangeSecret: boolean;
}

const invalidCredentials = () => new AppError("INVALID_CREDENTIALS", 401);

/** Players sign in with their player code or username, plus their PIN. */
export async function signInPlayer(identifier: string, pin: string, request: Request): Promise<SignInResult> {
  const normalized = identifier.trim().toLowerCase().replace(/^@/, "");
  const identifierHash = hashIdentifier(`player:${normalized}`);
  const ipHash = hashClientIp(request);
  await assertWithinBudget(identifierHash, ipHash);

  // A username is only unique within a club, so it must match exactly one
  // player across clubs to be usable here; the player code always is unique.
  const candidates = await db.query<{
    id: string;
    club_id: string;
    pin_hash: string;
    locked: boolean | null;
    must_change_pin: boolean;
    registration_status: string;
  }>(
    `SELECT p.id, p.club_id, p.pin_hash, p.locked_until > now() AS locked, p.must_change_pin, p.registration_status
       FROM players p
       JOIN clubs c ON c.id = p.club_id AND c.status IN ('trial', 'active')
      WHERE p.active AND (lower(p.code::text) = $1 OR lower(p.username::text) = $1)
      LIMIT 2`,
    [normalized],
  );
  const player = candidates.rows.length === 1 ? candidates.rows[0] : null;
  const pinMatches = await verifySecret(pin, player?.pin_hash ?? DUMMY_HASH);
  const valid = Boolean(player && !player.locked && pinMatches);
  await recordAttempt(identifierHash, ipHash, valid);

  if (!player || !valid) {
    if (player) {
      await db.query(
        `UPDATE players
            SET failed_attempts = failed_attempts + 1,
                locked_until = CASE WHEN failed_attempts + 1 >= ${LOCK_AFTER_FAILURES}
                                    THEN now() + interval '${WINDOW_MINUTES} minutes' ELSE locked_until END
          WHERE id = $1`,
        [player.id],
      );
    }
    throw invalidCredentials();
  }
  if (player.registration_status !== "approved") {
    throw new AppError(player.registration_status === "pending" ? "REGISTRATION_PENDING" : "REGISTRATION_REJECTED", 403);
  }

  await db.query("UPDATE players SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1", [player.id]);
  const issued = await createSession({ role: "player", accountId: player.id, clubId: player.club_id }, request);
  return { issued, role: "player", mustChangeSecret: player.must_change_pin };
}

/** Club staff and platform administrators sign in with e-mail and password. */
export async function signInAdmin(email: string, password: string, request: Request): Promise<SignInResult> {
  const normalized = email.trim().toLowerCase();
  const identifierHash = hashIdentifier(`admin:${normalized}`);
  const ipHash = hashClientIp(request);
  await assertWithinBudget(identifierHash, ipHash);

  const admin = await maybeOne<{
    id: string;
    club_id: string | null;
    role: AccountRole;
    password_hash: string;
    locked: boolean | null;
    must_change_password: boolean;
  }>(
    `SELECT a.id, a.club_id, a.role, a.password_hash, a.locked_until > now() AS locked, a.must_change_password
       FROM admin_accounts a
       LEFT JOIN clubs c ON c.id = a.club_id
      WHERE a.email = $1 AND a.active
        AND (a.role = 'platform_admin' OR c.status IN ('trial', 'active'))`,
    [normalized],
  );
  const passwordMatches = await verifySecret(password, admin?.password_hash ?? DUMMY_HASH);
  const valid = Boolean(admin && !admin.locked && passwordMatches);
  await recordAttempt(identifierHash, ipHash, valid);

  if (!admin || !valid) {
    if (admin) {
      await db.query(
        `UPDATE admin_accounts
            SET failed_attempts = failed_attempts + 1,
                locked_until = CASE WHEN failed_attempts + 1 >= ${LOCK_AFTER_FAILURES}
                                    THEN now() + interval '${WINDOW_MINUTES} minutes' ELSE locked_until END
          WHERE id = $1`,
        [admin.id],
      );
    }
    throw invalidCredentials();
  }

  await db.query("UPDATE admin_accounts SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1", [admin.id]);
  const issued = await createSession({ role: admin.role, accountId: admin.id, clubId: admin.club_id }, request);
  await audit({ clubId: admin.club_id, actor: { role: admin.role, accountId: admin.id }, action: "admin.signed_in", entityType: "admin", entityId: admin.id, request });
  return { issued, role: admin.role, mustChangeSecret: admin.must_change_password };
}
