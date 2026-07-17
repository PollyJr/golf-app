import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession, verifyMutation } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { apiError } from "@/lib/http";
import { externalOrigin, randomToken, sha256 } from "@/lib/security";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession(["player"]); await verifyMutation(request, session);
    const { id } = await params; z.string().uuid().parse(id);
    const token = randomToken();
    const created = await withTransaction(async (client) => {
      const owner = await client.query(`SELECT id FROM rounds WHERE id=$1 AND club_id=$2 AND status='active' AND scorer_player_id=$3 FOR UPDATE`, [id, session.clubId, session.accountId]);
      if (!owner.rowCount) return false;
      await client.query(`INSERT INTO round_share_links(round_id,club_id,created_by_player_id,token_hash) VALUES ($1,$2,$3,$4)`, [id, session.clubId, session.accountId, sha256(token)]);
      await client.query(`INSERT INTO audit_log(club_id,actor_role,actor_id,action,entity_type,entity_id) VALUES ($1,'player',$2,'round.share_created','round',$3)`, [session.clubId, session.accountId, id]);
      return true;
    });
    if (!created) return NextResponse.json({ code: "ROUND_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ url: `${externalOrigin(request)}/live/${token}` }, { status: 201 });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession(["player"]); await verifyMutation(request, session);
    const { id } = await params; z.string().uuid().parse(id);
    const owner = await query(`SELECT id FROM rounds WHERE id=$1 AND club_id=$2 AND scorer_player_id=$3`, [id, session.clubId, session.accountId]);
    if (!owner.rowCount) return NextResponse.json({ code: "ROUND_NOT_FOUND" }, { status: 404 });
    const revoked = await query(`UPDATE round_share_links SET revoked_at=now() WHERE round_id=$1 AND club_id=$2 AND revoked_at IS NULL`, [id, session.clubId]);
    await query(`INSERT INTO audit_log(club_id,actor_role,actor_id,action,entity_type,entity_id,metadata) VALUES ($1,'player',$2,'round.shares_revoked','round',$3,jsonb_build_object('count',$4::int))`, [session.clubId, session.accountId, id, revoked.rowCount || 0]);
    return NextResponse.json({ revoked: revoked.rowCount || 0 });
  } catch (error) { return apiError(error); }
}
