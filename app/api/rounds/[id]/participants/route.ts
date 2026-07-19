import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession, verifyMutation } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { apiError } from "@/lib/http";
import { calculateRoundPar } from "@/lib/round-format";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), playerId: z.string().uuid() }),
  z.object({ action: z.literal("remove"), playerId: z.string().uuid() }),
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession(["player"]); await verifyMutation(request, session);
    const body = schema.parse(await request.json()); const { id } = await params; z.string().uuid().parse(id);
    const outcome = await withTransaction(async (client) => {
      const round = await client.query<{ scorer_player_id: string; hole_count: 9 | 18; course_id: string; tee_set_id: string }>(
        `SELECT r.scorer_player_id,r.hole_count,r.course_id,r.tee_set_id
           FROM rounds r WHERE r.id=$1 AND r.club_id=$2 AND r.status='inviting' AND r.scorer_player_id=$3 FOR UPDATE`,
        [id, session.clubId, session.accountId],
      );
      if (!round.rowCount) return "ROUND_NOT_FOUND";
      const holes = await client.query<{ par: number }>(
        `SELECT par FROM holes WHERE club_id=$1 AND course_id=$2 AND tee_set_id=$3 ORDER BY number`,
        [session.clubId, round.rows[0].course_id, round.rows[0].tee_set_id],
      );
      const totalPar = calculateRoundPar(holes.rows, round.rows[0].hole_count);
      if (body.action === "remove") {
        if (body.playerId === round.rows[0].scorer_player_id) return "STARTER_REQUIRED";
        const removed = await client.query(`DELETE FROM round_participants WHERE round_id=$1 AND club_id=$2 AND player_id=$3 RETURNING id`, [id, session.clubId, body.playerId]);
        if (!removed.rowCount) return "PARTICIPANT_NOT_FOUND";
      } else {
        const count = await client.query<{ count: number }>(`SELECT count(*)::int AS count FROM round_participants WHERE round_id=$1 AND club_id=$2`, [id, session.clubId]);
        if (count.rows[0].count >= 4) return "FLIGHT_FULL";
        const player = await client.query<{ display_name: string }>(`SELECT display_name FROM players WHERE id=$1 AND club_id=$2 AND active`, [body.playerId, session.clubId]);
        if (!player.rowCount) return "PLAYER_NOT_FOUND";
        const position = await client.query<{ position: number }>(
          `SELECT slots.position FROM generate_series(1,4) AS slots(position) WHERE NOT EXISTS (SELECT 1 FROM round_participants rp WHERE rp.round_id=$1 AND rp.club_id=$2 AND rp.position=slots.position) ORDER BY slots.position LIMIT 1`,
          [id, session.clubId],
        );
        try {
          await client.query(
            `INSERT INTO round_participants(round_id,club_id,player_id,display_name,is_guest,position,total_strokes,total_par,invitation_status)
             VALUES ($1,$2,$3,$4,false,$5,0,$6,'pending')`,
            [id, session.clubId, body.playerId, player.rows[0].display_name, position.rows[0].position, totalPar],
          );
        } catch (error) {
          if ((error as { code?: string }).code === "23505") return "PARTICIPANT_EXISTS";
          throw error;
        }
      }
      const pending = await client.query<{ count: number }>(`SELECT count(*)::int AS count FROM round_participants WHERE round_id=$1 AND club_id=$2 AND invitation_status='pending'`, [id, session.clubId]);
      await client.query(`UPDATE rounds SET status=CASE WHEN $3=0 THEN 'active'::round_status ELSE status END,revision=revision+1 WHERE id=$1 AND club_id=$2`, [id, session.clubId, pending.rows[0].count]);
      await client.query(
        `INSERT INTO audit_log(club_id,actor_role,actor_id,action,entity_type,entity_id,metadata)
         VALUES ($1,'player',$2,$3,'round',$4,jsonb_build_object('playerId',$5::text))`,
        [session.clubId, session.accountId, `round.participant_${body.action === "add" ? "added" : "removed"}`, id, body.playerId],
      );
      return "OK";
    });
    if (outcome !== "OK") {
      const status = ["ROUND_NOT_FOUND", "PARTICIPANT_NOT_FOUND", "PLAYER_NOT_FOUND"].includes(outcome) ? 404 : 409;
      return NextResponse.json({ code: outcome }, { status });
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
