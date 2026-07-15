import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, destinationForRole, setSessionCookies, type AccountRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { apiError } from "@/lib/http";
import { assertSameOrigin, hashClientIp, sha256, verifySecret } from "@/lib/security";

const schema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(256) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = schema.parse(await request.json());
    const email = body.email.toLowerCase();
    const identifierHash = sha256(`${process.env.SESSION_SECRET}:${email}`);
    const ipHash = hashClientIp(request);
    const recent = await query<{ failures: number }>(
      `SELECT count(*)::int AS failures FROM auth_attempts
       WHERE attempted_at > now() - interval '15 minutes' AND NOT success
         AND (identifier_hash = $1 OR ($2::text IS NOT NULL AND ip_hash = $2))`,
      [identifierHash, ipHash],
    );
    if ((recent.rows[0]?.failures || 0) >= 8) return NextResponse.json({ code: "TOO_MANY_ATTEMPTS" }, { status: 429 });
    const result = await query<{ id: string; club_id: string | null; role: AccountRole; password_hash: string; locked: boolean }>(
      `SELECT id, club_id, role, password_hash, locked_until > now() AS locked FROM admin_accounts WHERE email = $1 AND active LIMIT 1`, [email],
    );
    const admin = result.rows[0];
    const valid = Boolean(admin && !admin.locked && await verifySecret(body.password, admin.password_hash));
    await query("INSERT INTO auth_attempts(identifier_hash, ip_hash, success) VALUES ($1, $2, $3)", [identifierHash, ipHash, valid]);
    if (!valid) {
      if (admin) await query(`UPDATE admin_accounts SET failed_attempts = failed_attempts + 1, locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END WHERE id = $1`, [admin.id]);
      return NextResponse.json({ code: "INVALID_CREDENTIALS" }, { status: 401 });
    }
    await query("UPDATE admin_accounts SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1", [admin.id]);
    const session = await createSession({ role: admin.role, accountId: admin.id, clubId: admin.club_id }, request);
    const response = NextResponse.json({ ok: true, redirectTo: destinationForRole(admin.role) });
    setSessionCookies(response, session);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
