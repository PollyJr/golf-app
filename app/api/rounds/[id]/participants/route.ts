import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession, verifyMutation } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { apiError } from "@/lib/http";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), playerId: z.string().uuid() }),
  z.object({ action: z.literal("remove"), playerId: z.string().uuid() }),
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiSession(["player"]); await verifyMutation(request, session);
    const body = schema.parse(await request.json()); const { id } = await params; z.string().uuid().parse(id);
    const outcome = await withTransaction(async (client) => {
      const round = await client.query<{ scorer_player_id: string; total_par: number }>(
        `SELECT r.scorer_player_id,(SELECT sum(par)::int FROM holes WHERE club_id=r.club_id AND course_id=r.course_id AND tee_set_id=r.tee_set_id) AS total_par
           FROM rounds r WHERE r.id=$1 AND r.club_id=$2 AND r.status='active' AND r.scorer_player_id=$3 FOR UPDATE`,
        [id, session.clubId, session.accountId],
      );
      if (!round.rowCount) return "ROUND_NOT_FOUND";
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
            `INSERT INTO round_participants(round_id,club_id,player_id,display_name,is_guest,position,total_strokes,total_par)
             VALUES ($1,$2,$3,$4,false,$5,0,$6)`,
            [id, session.clubId, body.playerId, player.rows[0].display_name, position.rows[0].position, round.rows[0].total_par],
          );
        } catch (error) {
          if ((error as { code?: string }).code === "23505") return "PARTICIPANT_EXISTS";
          throw error;
        }
      }
      await client.query(`UPDATE rounds SET revision=revision+1 WHERE id=$1 AND club_id=$2`, [id, session.clubId]);
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
