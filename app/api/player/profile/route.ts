import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession, verifyMutation } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { apiError } from "@/lib/http";
import { normalizeUsername, usernamePattern } from "@/lib/player-core";
import { hashClientIp, hashSecret, verifySecret } from "@/lib/security";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("username"), username: z.string().trim().min(3).max(30) }),
  z.object({ action: z.literal("pin"), currentPin: z.string().regex(/^\d{4,12}$/), newPin: z.string().regex(/^\d{4,12}$/) }),
]);

export async function PATCH(request: Request) {
  try {
    const session = await requireApiSession(["player"]); await verifyMutation(request, session);
    const body = schema.parse(await request.json());
    if (body.action === "username") {
      const username = normalizeUsername(body.username);
      if (!usernamePattern.test(username)) return NextResponse.json({ code: "INVALID_USERNAME" }, { status: 400 });
      try {
        await query(`UPDATE players SET username=$1 WHERE id=$2 AND club_id=$3`, [username, session.accountId, session.clubId]);
      } catch (error) {
        if ((error as { code?: string }).code === "23505") return NextResponse.json({ code: "USERNAME_TAKEN" }, { status: 409 });
        throw error;
      }
      await query(`INSERT INTO audit_log(club_id,actor_role,actor_id,action,entity_type,entity_id,ip_hash) VALUES ($1,'player',$2,'player.username_changed','player',$3,$4)`, [session.clubId, session.accountId, session.accountId, hashClientIp(request)]);
      return NextResponse.json({ username });
    }

    if (body.currentPin === body.newPin) return NextResponse.json({ code: "PIN_UNCHANGED" }, { status: 400 });
    const player = await query<{ pin_hash: string }>(`SELECT pin_hash FROM players WHERE id=$1 AND club_id=$2 AND active`, [session.accountId, session.clubId]);
    if (!player.rowCount || !await verifySecret(body.currentPin, player.rows[0].pin_hash)) return NextResponse.json({ code: "CURRENT_PIN_INVALID" }, { status: 403 });
    const newHash = await hashSecret(body.newPin);
    const updated = await withTransaction(async (client) => {
      const changed = await client.query(`UPDATE players SET pin_hash=$1,must_change_pin=false,failed_attempts=0,locked_until=NULL WHERE id=$2 AND club_id=$3 AND pin_hash=$4 RETURNING id`, [newHash, session.accountId, session.clubId, player.rows[0].pin_hash]);
      if (!changed.rowCount) return false;
      await client.query(`DELETE FROM sessions WHERE role='player' AND account_id=$1 AND id<>$2 AND club_id=$3`, [session.accountId, session.id, session.clubId]);
      await client.query(`INSERT INTO audit_log(club_id,actor_role,actor_id,action,entity_type,entity_id,ip_hash) VALUES ($1,'player',$2,'player.pin_changed','player',$3,$4)`, [session.clubId, session.accountId, session.accountId, hashClientIp(request)]);
      return true;
    });
    if (!updated) return NextResponse.json({ code: "PIN_CHANGED_CONCURRENTLY" }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
