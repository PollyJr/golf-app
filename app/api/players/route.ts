import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession, verifyMutation } from "@/lib/auth";
import { getClubPlayers } from "@/lib/dal";
import { query } from "@/lib/db";
import { apiError } from "@/lib/http";
import { hashClientIp, hashSecret, randomToken } from "@/lib/security";
import { usernameFromDisplayName } from "@/lib/player-core";

const createSchema = z.object({ displayName: z.string().trim().min(2).max(100), pin: z.string().regex(/^\d{4,12}$/).optional() });

export async function GET() {
  try {
    const session = await requireApiSession(["player", "club_owner", "club_staff"]);
    return NextResponse.json({ players: await getClubPlayers(session.clubId!) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiSession(["club_owner", "club_staff"]);
    await verifyMutation(request, session);
    const body = createSchema.parse(await request.json());
    const pin = body.pin || String(Math.floor(100000 + Math.random() * 900000));
    const code = `FW-${randomToken(6).replace(/[^A-Z0-9]/gi, "").slice(0, 8).toUpperCase()}`;
    const username = usernameFromDisplayName(body.displayName, code);
    const initials = body.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    const result = await query<{ id: string }>(
      `INSERT INTO players(club_id, display_name, initials, username, code, pin_hash) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [session.clubId, body.displayName, initials, username, code, await hashSecret(pin)],
    );
    await query(`INSERT INTO audit_log(club_id, actor_role, actor_id, action, entity_type, entity_id, ip_hash) VALUES ($1,$2,$3,'player.created','player',$4,$5)`, [session.clubId, session.role, session.accountId, result.rows[0].id, hashClientIp(request)]);
    return NextResponse.json({ player: { id: result.rows[0].id, displayName: body.displayName, username, code, pin } }, { status: 201 });
  } catch (error) { return apiError(error); }
}
