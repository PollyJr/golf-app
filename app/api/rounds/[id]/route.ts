import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession, verifyMutation } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { apiError } from "@/lib/http";
import { etagMatches, revisionEtag } from "@/lib/rounds-core";
import { getRoundForPlayer } from "@/lib/rounds";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession(["player"]);
    const { id } = await params; z.string().uuid().parse(id);
    const round = await getRoundForPlayer(id, session.clubId!, session.accountId);
    if (!round) return NextResponse.json({ code: "ROUND_NOT_FOUND" }, { status: 404 });
    const etag = revisionEtag(round.revision);
    if (etagMatches(request.headers.get("if-none-match"), round.revision)) return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": "private, no-store" } });
    return NextResponse.json({ round }, { headers: { ETag: etag, "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession(["player"]); await verifyMutation(request, session);
    const { id } = await params; z.string().uuid().parse(id);
    const cancelled = await withTransaction(async (client) => {
      const round = await client.query(`SELECT id FROM rounds WHERE id=$1 AND club_id=$2 AND scorer_player_id=$3 AND status IN ('inviting','active') FOR UPDATE`, [id, session.clubId, session.accountId]);
      if (!round.rowCount) return false;
      await client.query(`DELETE FROM rounds WHERE id=$1 AND club_id=$2`, [id, session.clubId]);
      await client.query(`INSERT INTO audit_log(club_id,actor_role,actor_id,action,entity_type,entity_id) VALUES ($1,'player',$2,'round.cancelled','round',$3)`, [session.clubId, session.accountId, id]);
      return true;
    });
    if (!cancelled) return NextResponse.json({ code: "ROUND_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ cancelled: true });
  } catch (error) { return apiError(error); }
}
