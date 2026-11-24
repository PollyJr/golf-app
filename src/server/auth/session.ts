import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { db, maybeOne } from "../db";
import { env } from "../env";
import { AppError, forbidden, unauthenticated } from "../errors";
import { assertSameOrigin, hashClientIp, randomToken, sha256 } from "../security";
import { initialsOf } from "@/lib/format";
import { isLocale, type Locale } from "@/lib/i18n/core";
import type { AccountRole, ClubBranding, SessionUser } from "@/lib/types";

export const SESSION_COOKIE = "fairway_session";
export const CSRF_COOKIE = "fairway_csrf";
export const CSRF_HEADER = "x-csrf-token";

const PLAYER_SESSION_SECONDS = 60 * 60 * 24 * 60;
const ADMIN_SESSION_SECONDS = 60 * 60 * 12;

export interface Session {
  id: string;
  role: AccountRole;
  accountId: string;
  /** `null` for platform administrators only. */
  clubId: string | null;
  csrfHash: string;
  user: SessionUser;
  club: ClubBranding | null;
  preferredLanguage: Locale | null;
}

/** A session that is guaranteed to belong to a club. */
export type ClubSession = Session & { clubId: string; club: ClubBranding };

export const STAFF_ROLES: readonly AccountRole[] = ["club_owner", "club_staff"];

interface NewSession {
  role: AccountRole;
  accountId: string;
  clubId: string | null;
}

export interface IssuedSession {
  token: string;
  csrf: string;
  maxAge: number;
}

export async function createSession(account: NewSession, request: Request): Promise<IssuedSession> {
  const token = randomToken();
  const csrf = randomToken();
  const maxAge = account.role === "player" ? PLAYER_SESSION_SECONDS : ADMIN_SESSION_SECONDS;
  await db.query("DELETE FROM sessions WHERE expires_at <= now()");
  await db.query(
    `INSERT INTO sessions (token_hash, csrf_hash, role, account_id, club_id, expires_at, ip_hash, user_agent)
     VALUES ($1, $2, $3, $4, $5, now() + ($6 * interval '1 second'), $7, $8)`,
    [
      sha256(token),
      sha256(csrf),
      account.role,
      account.accountId,
      account.clubId,
      maxAge,
      hashClientIp(request),
      request.headers.get("user-agent")?.slice(0, 300) ?? null,
    ],
  );
  return { token, csrf, maxAge };
}

export function setSessionCookies(response: NextResponse, issued: IssuedSession): void {
  const shared = { secure: env.isProduction, sameSite: "lax" as const, path: "/", maxAge: issued.maxAge };
  response.cookies.set(SESSION_COOKIE, issued.token, { ...shared, httpOnly: true });
  // Readable by our own scripts on purpose: it is echoed back in a header.
  response.cookies.set(CSRF_COOKIE, issued.csrf, { ...shared, httpOnly: false });
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true });
  response.cookies.set(CSRF_COOKIE, "", { path: "/", maxAge: 0 });
}

interface SessionRow {
  id: string;
  role: AccountRole;
  account_id: string;
  club_id: string | null;
  csrf_hash: string;
  display_name: string;
  username: string | null;
  code: string | null;
  must_change: boolean;
  preferred_language: string | null;
  club_slug: string | null;
  club_name: string | null;
  club_tagline: string | null;
  primary_color: string | null;
  accent_color: string | null;
  timezone: string | null;
  default_language: string | null;
}

async function loadSession(token: string): Promise<Session | null> {
  const row = await maybeOne<SessionRow>(
    `SELECT s.id, s.role, s.account_id, s.club_id, s.csrf_hash,
            COALESCE(p.display_name, a.display_name) AS display_name,
            p.username::text AS username, p.code::text AS code,
            COALESCE(p.must_change_pin, a.must_change_password, false) AS must_change,
            p.preferred_language,
            c.slug AS club_slug, c.name AS club_name, c.tagline AS club_tagline,
            c.primary_color, c.accent_color, c.timezone, c.default_language
       FROM sessions s
       LEFT JOIN players p
              ON s.role = 'player' AND p.id = s.account_id AND p.active AND p.registration_status = 'approved'
       LEFT JOIN admin_accounts a ON s.role <> 'player' AND a.id = s.account_id AND a.active
       LEFT JOIN clubs c ON c.id = s.club_id AND c.status IN ('trial', 'active')
      WHERE s.token_hash = $1
        AND s.expires_at > now()
        AND ((s.role = 'player' AND p.id IS NOT NULL) OR (s.role <> 'player' AND a.id IS NOT NULL))
        AND (s.role = 'platform_admin' OR c.id IS NOT NULL)
      LIMIT 1`,
    [sha256(token)],
  );
  if (!row) return null;

  void db
    .query("UPDATE sessions SET last_seen_at = now() WHERE id = $1 AND last_seen_at < now() - interval '5 minutes'", [row.id])
    .catch(() => {});

  const club: ClubBranding | null =
    row.club_id && row.club_slug && row.club_name
      ? {
          id: row.club_id,
          slug: row.club_slug,
          name: row.club_name,
          tagline: row.club_tagline,
          primaryColor: row.primary_color ?? "#0f3b2a",
          accentColor: row.accent_color ?? "#c9f04b",
          timeZone: row.timezone ?? "Europe/Amsterdam",
          defaultLanguage: isLocale(row.default_language) ? row.default_language : "nl",
        }
      : null;

  return {
    id: row.id,
    role: row.role,
    accountId: row.account_id,
    clubId: row.club_id,
    csrfHash: row.csrf_hash,
    preferredLanguage: isLocale(row.preferred_language) ? row.preferred_language : null,
    club,
    user: {
      role: row.role,
      accountId: row.account_id,
      displayName: row.display_name,
      initials: initialsOf(row.display_name),
      username: row.username,
      code: row.code,
      mustChangeSecret: row.must_change,
    },
  };
}

/** The current session, or `null`. Resolved once per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return loadSession(token);
});

export async function destroyCurrentSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await db.query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
}

/** Ends every session of an account, optionally keeping the current one. */
export async function destroyAccountSessions(role: AccountRole, accountId: string, exceptSessionId?: string, on = db): Promise<void> {
  const playerRole = role === "player";
  await on.query(
    `DELETE FROM sessions
      WHERE account_id = $1 AND (role = 'player') = $2 AND ($3::uuid IS NULL OR id <> $3)`,
    [accountId, playerRole, exceptSessionId ?? null],
  );
}

/** Double-submit CSRF check, bound to the session. Call for every mutation. */
export async function verifyMutation(request: Request, session: Session): Promise<void> {
  assertSameOrigin(request);
  const header = request.headers.get(CSRF_HEADER);
  const cookie = (await cookies()).get(CSRF_COOKIE)?.value;
  if (!header || !cookie || header !== cookie || sha256(header) !== session.csrfHash) {
    throw new AppError("INVALID_CSRF", 403);
  }
}

export type Access = "public" | "player" | "staff" | "owner" | "platform";

export function roleAllowed(role: AccountRole, access: Exclude<Access, "public">): boolean {
  switch (access) {
    case "player":
      return role === "player";
    case "staff":
      return role === "club_owner" || role === "club_staff";
    case "owner":
      return role === "club_owner";
    case "platform":
      return role === "platform_admin";
  }
}

/** For API routes: throws 401/403 instead of redirecting. */
export async function requireApiSession(access: Exclude<Access, "public">): Promise<Session> {
  const session = await getSession();
  if (!session) throw unauthenticated();
  if (!roleAllowed(session.role, access)) throw forbidden();
  return session;
}

export function homeForRole(role: AccountRole): string {
  if (role === "platform_admin") return "/platform";
  if (role === "club_owner" || role === "club_staff") return "/admin";
  return "/app";
}
