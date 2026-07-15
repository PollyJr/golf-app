import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, setSessionCookies } from "@/lib/auth";
import { query } from "@/lib/db";
import { apiError } from "@/lib/http";
import { assertSameOrigin, hashClientIp, sha256, verifySecret } from "@/lib/security";

const schema = z.object({ code: z.string().trim().min(4).max(64), pin: z.string().regex(/^\d{4,12}$/) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = schema.parse(await request.json());
    const identifierHash = sha256(`${process.env.SESSION_SECRET}:${body.code.toUpperCase()}`);
    const ipHash = hashClientIp(request);
    const recent = await query<{ failures: number }>(
      `SELECT count(*)::int AS failures FROM auth_attempts
       WHERE attempted_at > now() - interval '15 minutes' AND NOT success
         AND (identifier_hash = $1 OR ($2::text IS NOT NULL AND ip_hash = $2))`,
      [identifierHash, ipHash],
    );
    if ((recent.rows[0]?.failures || 0) >= 8) return NextResponse.json({ code: "TOO_MANY_ATTEMPTS" }, { status: 429 });

    const result = await query<{ id: string; club_id: string; pin_hash: string; failed_attempts: number; locked: boolean }>(
      `SELECT id, club_id, pin_hash, failed_attempts, locked_until > now() AS locked
       FROM players WHERE code = $1 AND active LIMIT 1`,
      [body.code.toUpperCase()],
    );
    const player = result.rows[0];
    const valid = Boolean(player && !player.locked && await verifySecret(body.pin, player.pin_hash));
    await query("INSERT INTO auth_attempts(identifier_hash, ip_hash, success) VALUES ($1, $2, $3)", [identifierHash, ipHash, valid]);

    if (!valid) {
      if (player) await query(
        `UPDATE players SET failed_attempts = failed_attempts + 1,
         locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
         WHERE id = $1`,
        [player.id],
      );
      return NextResponse.json({ code: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    await query("UPDATE players SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1", [player.id]);
    const session = await createSession({ role: "player", accountId: player.id, clubId: player.club_id }, request);
    const response = NextResponse.json({ ok: true, redirectTo: "/app" });
    setSessionCookies(response, session);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
