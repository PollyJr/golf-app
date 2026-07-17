import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession, verifyMutation } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { apiError } from "@/lib/http";

const schema = z.object({ participantId: z.string().uuid(), holeNumber: z.number().int().min(1).max(18), strokes: z.number().int().min(1).max(12) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession(["player"]); await verifyMutation(request, session);
    const body = schema.parse(await request.json()); const { id } = await params; z.string().uuid().parse(id);
    const result = await withTransaction(async (client) => {
      const round = await client.query<{ course_id: string; tee_set_id: string }>(
        `SELECT r.course_id,r.tee_set_id FROM rounds r
          WHERE r.id=$1 AND r.club_id=$2 AND r.status='active'
            AND EXISTS (SELECT 1 FROM round_participants mine WHERE mine.round_id=r.id AND mine.club_id=r.club_id AND mine.player_id=$3)
          FOR UPDATE`, [id, session.clubId, session.accountId],
      );
      if (!round.rowCount) return null;
      const participant = await client.query(
        `SELECT id FROM round_participants WHERE id=$1 AND round_id=$2 AND club_id=$3 AND player_id IS NOT NULL`,
        [body.participantId, id, session.clubId],
      );
      if (!participant.rowCount) throw new Error("PARTICIPANT_NOT_FOUND");
      const hole = await client.query<{ par: number; distance_m: number }>(
        `SELECT par,distance_m FROM holes WHERE club_id=$1 AND course_id=$2 AND tee_set_id=$3 AND number=$4`,
        [session.clubId, round.rows[0].course_id, round.rows[0].tee_set_id, body.holeNumber],
      );
      if (!hole.rowCount) throw new Error("HOLE_NOT_FOUND");
      await client.query(
        `INSERT INTO hole_scores(round_participant_id,club_id,hole_number,strokes,par_snapshot,distance_snapshot,updated_by_player_id,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,now())
         ON CONFLICT (round_participant_id,hole_number) DO UPDATE SET strokes=EXCLUDED.strokes,
           par_snapshot=EXCLUDED.par_snapshot,distance_snapshot=EXCLUDED.distance_snapshot,
           updated_by_player_id=EXCLUDED.updated_by_player_id,updated_at=now()`,
        [body.participantId, session.clubId, body.holeNumber, body.strokes, hole.rows[0].par, hole.rows[0].distance_m, session.accountId],
      );
      await client.query(
        `UPDATE round_participants SET total_strokes=(SELECT COALESCE(sum(strokes),0)::int FROM hole_scores WHERE round_participant_id=$1),updated_at=now() WHERE id=$1 AND club_id=$2`,
        [body.participantId, session.clubId],
      );
      const updated = await client.query<{ revision: string }>(`UPDATE rounds SET revision=revision+1 WHERE id=$1 AND club_id=$2 RETURNING revision`, [id, session.clubId]);
      await client.query(
        `INSERT INTO audit_log(club_id,actor_role,actor_id,action,entity_type,entity_id,metadata)
         VALUES ($1,'player',$2,'round.score_updated','round',$3,jsonb_build_object('participantId',$4::text,'hole',$5::int))`,
        [session.clubId, session.accountId, id, body.participantId, body.holeNumber],
      );
      return Number(updated.rows[0].revision);
    });
    if (result === null) return NextResponse.json({ code: "ROUND_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ revision: result });
  } catch (error) {
    if (error instanceof Error && ["PARTICIPANT_NOT_FOUND", "HOLE_NOT_FOUND"].includes(error.message)) return NextResponse.json({ code: error.message }, { status: 404 });
    return apiError(error);
  }
}
