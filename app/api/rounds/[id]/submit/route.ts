import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession, verifyMutation } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { apiError } from "@/lib/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession(["player"]); await verifyMutation(request, session);
    const { id } = await params; z.string().uuid().parse(id);
    const outcome = await withTransaction(async (client) => {
      const round = await client.query<{ hole_count: number }>(
        `SELECT hole_count FROM rounds WHERE id=$1 AND club_id=$2 AND status='active' AND scorer_player_id=$3 FOR UPDATE`,
        [id, session.clubId, session.accountId],
      );
      if (!round.rowCount) return "ROUND_NOT_FOUND";
      const completeness = await client.query<{ participants: number; complete_participants: number }>(
        `SELECT count(*)::int AS participants,
                count(*) FILTER (WHERE score_count=$2)::int AS complete_participants
           FROM (SELECT rp.id,count(hs.id)::int AS score_count FROM round_participants rp
                 LEFT JOIN hole_scores hs ON hs.round_participant_id=rp.id AND hs.club_id=rp.club_id
                 WHERE rp.round_id=$1 AND rp.club_id=$3 GROUP BY rp.id) scored`,
        [id, round.rows[0].hole_count, session.clubId],
      );
      if (!completeness.rows[0].participants || completeness.rows[0].participants !== completeness.rows[0].complete_participants) return "ROUND_INCOMPLETE";
      await client.query(`UPDATE rounds SET status='pending',completed_at=now(),revision=revision+1 WHERE id=$1 AND club_id=$2`, [id, session.clubId]);
      await client.query(`UPDATE round_share_links SET expires_at=now()+interval '24 hours' WHERE round_id=$1 AND club_id=$2 AND revoked_at IS NULL`, [id, session.clubId]);
      await client.query(`INSERT INTO audit_log(club_id,actor_role,actor_id,action,entity_type,entity_id) VALUES ($1,'player',$2,'round.submitted','round',$3)`, [session.clubId, session.accountId, id]);
      return "OK";
    });
    if (outcome !== "OK") return NextResponse.json({ code: outcome }, { status: outcome === "ROUND_INCOMPLETE" ? 400 : 404 });
    return NextResponse.json({ status: "pending" });
  } catch (error) { return apiError(error); }
}
