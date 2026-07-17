import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { assertSameOrigin, hashClientIp, randomToken, SecurityError, sha256 } from "@/lib/security";

export type AccountRole = "platform_admin" | "club_owner" | "club_staff" | "player";

export interface Session {
  id: string;
  role: AccountRole;
  accountId: string;
  clubId: string | null;
  displayName: string;
  username: string | null;
  code: string | null;
  clubName: string | null;
  clubSlug: string | null;
  initials: string;
  csrfHash: string;
}

export const SESSION_COOKIE = "fairway_session";
export const CSRF_COOKIE = "fairway_csrf";

type NewSession = Pick<Session, "role" | "accountId" | "clubId">;

export async function createSession(account: NewSession, request: Request) {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  await query("DELETE FROM sessions WHERE expires_at <= now()");
  const token = randomToken();
  const csrf = randomToken();
  const maxAge = account.role === "player" ? 60 * 60 * 24 * 30 : 60 * 60 * 12;
  await query(
    `INSERT INTO sessions(token_hash, csrf_hash, role, account_id, club_id, expires_at, ip_hash, user_agent)
     VALUES ($1, $2, $3, $4, $5, now() + ($6 * interval '1 second'), $7, $8)`,
    [sha256(token), sha256(csrf), account.role, account.accountId, account.clubId, maxAge, hashClientIp(request), request.headers.get("user-agent")?.slice(0, 500) || null],
  );
  return { token, csrf, maxAge };
}

export function setSessionCookies(response: NextResponse, values: Awaited<ReturnType<typeof createSession>>) {
  const shared = { secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge: values.maxAge };
  response.cookies.set(SESSION_COOKIE, values.token, { ...shared, httpOnly: true });
  response.cookies.set(CSRF_COOKIE, values.csrf, { ...shared, httpOnly: false });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const result = await query<{
    id: string; role: AccountRole; account_id: string; club_id: string | null; csrf_hash: string;
    display_name: string; username: string | null; code: string | null; club_name: string | null; club_slug: string | null;
  }>(
    `SELECT s.id, s.role, s.account_id, s.club_id, s.csrf_hash,
            COALESCE(p.display_name, a.display_name) AS display_name, p.username::text, p.code::text,
            c.name AS club_name, c.slug AS club_slug
       FROM sessions s
       LEFT JOIN players p ON s.role = 'player' AND p.id = s.account_id AND p.active
       LEFT JOIN admin_accounts a ON s.role <> 'player' AND a.id = s.account_id AND a.active
       LEFT JOIN clubs c ON c.id = s.club_id AND c.status IN ('trial', 'active')
      WHERE s.token_hash = $1 AND s.expires_at > now()
        AND ((s.role = 'player' AND p.id IS NOT NULL) OR (s.role <> 'player' AND a.id IS NOT NULL))
        AND (s.role = 'platform_admin' OR c.id IS NOT NULL)
      LIMIT 1`,
    [sha256(token)],
  );
  const row = result.rows[0];
  if (!row) return null;
  void query("UPDATE sessions SET last_seen_at = now() WHERE id = $1", [row.id]);
  const initials = row.display_name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return { id: row.id, role: row.role, accountId: row.account_id, clubId: row.club_id, displayName: row.display_name, username: row.username, code: row.code, clubName: row.club_name, clubSlug: row.club_slug, initials, csrfHash: row.csrf_hash };
}

export async function requireSession(roles?: AccountRole[]) {
  const session = await getSession();
  if (!session) redirect("/");
  if (roles && !roles.includes(session.role)) redirect(destinationForRole(session.role));
  return session;
}

export async function requireApiSession(roles?: AccountRole[]) {
  const session = await getSession();
  if (!session) throw new SecurityError("UNAUTHENTICATED", 401);
  if (roles && !roles.includes(session.role)) throw new SecurityError("FORBIDDEN", 403);
  return session;
}

export async function verifyMutation(request: Request, session: Session) {
  assertSameOrigin(request);
  const csrf = request.headers.get("x-csrf-token");
  const csrfCookie = (await cookies()).get(CSRF_COOKIE)?.value;
  if (!csrf || !csrfCookie || csrf !== csrfCookie || sha256(csrf) !== session.csrfHash) throw new SecurityError("INVALID_CSRF", 403);
}

export async function destroySession(response: NextResponse) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
  response.cookies.set(SESSION_COOKIE, "", { path: "/", expires: new Date(0), httpOnly: true });
  response.cookies.set(CSRF_COOKIE, "", { path: "/", expires: new Date(0) });
}

export function destinationForRole(role: AccountRole) {
  if (role === "platform_admin") return "/platform";
  if (role === "club_owner" || role === "club_staff") return "/admin";
  return "/app";
}
