import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession, verifyMutation } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { apiError } from "@/lib/http";
import { getRoundForPlayer } from "@/lib/rounds";

const createSchema = z.object({
  clientId: z.string().uuid(),
  courseId: z.string().uuid(),
  playerIds: z.array(z.string().uuid()).min(1).max(4),
}).refine((value) => new Set(value.playerIds).size === value.playerIds.length, { message: "Players must be unique", path: ["playerIds"] });

export async function GET() {
  try {
    const session = await requireApiSession(["club_owner", "club_staff"]);
    const result = await query(
      `SELECT r.id, r.completed_at, r.hole_count, COALESCE(c.name->>'nl', c.name->>'en') AS course,
              rp.display_name, rp.total_strokes, rp.total_strokes-rp.total_par AS to_par
         FROM rounds r JOIN courses c ON c.id=r.course_id AND c.club_id=$1
         JOIN round_participants rp ON rp.round_id=r.id AND rp.player_id=r.scorer_player_id AND rp.club_id=$1
        WHERE r.club_id=$1 AND r.status='pending' ORDER BY r.completed_at LIMIT 100`, [session.clubId],
    );
    return NextResponse.json({ rounds: result.rows });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiSession(["player"]);
    await verifyMutation(request, session);
    const body = createSchema.parse(await request.json());
    if (!body.playerIds.includes(session.accountId)) return NextResponse.json({ code: "STARTER_REQUIRED" }, { status: 400 });

    const roundId = await withTransaction(async (client) => {
      const course = await client.query<{ id: string; hole_count: 9 | 18; tee_id: string; total_par: number; configured_holes: number }>(
        `SELECT c.id, c.hole_count, t.id AS tee_id, sum(h.par)::int AS total_par, count(h.id)::int AS configured_holes
           FROM courses c JOIN tee_sets t ON t.course_id=c.id AND t.club_id=$2 AND t.is_default
           JOIN holes h ON h.course_id=c.id AND h.tee_set_id=t.id AND h.club_id=$2
          WHERE c.id=$1 AND c.club_id=$2 AND c.active GROUP BY c.id,t.id`, [body.courseId, session.clubId],
      );
      if (!course.rowCount || course.rows[0].hole_count === undefined) throw new Error("COURSE_NOT_FOUND");
      const selected = course.rows[0];
      if (selected.configured_holes !== selected.hole_count) throw new Error("COURSE_INCOMPLETE");
      const players = await client.query<{ id: string; display_name: string }>(
        `SELECT id, display_name FROM players WHERE club_id=$1 AND active AND id=ANY($2::uuid[])`, [session.clubId, body.playerIds],
      );
      if (players.rowCount !== body.playerIds.length) throw new Error("PLAYER_NOT_FOUND");
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO rounds(client_id,club_id,course_id,tee_set_id,scorer_player_id,hole_count,status,completed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NULL)
         ON CONFLICT (club_id,client_id) DO NOTHING RETURNING id`,
        [body.clientId, session.clubId, selected.id, selected.tee_id, session.accountId, selected.hole_count, body.playerIds.length > 1 ? "inviting" : "active"],
      );
      let id = inserted.rows[0]?.id;
      if (!id) {
        const existing = await client.query<{ id: string }>(
          `SELECT id FROM rounds WHERE club_id=$1 AND client_id=$2 AND scorer_player_id=$3`, [session.clubId, body.clientId, session.accountId],
        );
        if (!existing.rowCount) throw new Error("ROUND_CONFLICT");
        return existing.rows[0].id;
      }
      const names = new Map(players.rows.map((player) => [player.id, player.display_name]));
      for (const [index, playerId] of body.playerIds.entries()) {
        await client.query(
          `INSERT INTO round_participants(round_id,club_id,player_id,display_name,is_guest,position,total_strokes,total_par,invitation_status,responded_at)
           VALUES ($1,$2,$3,$4,false,$5,0,$6,$7,$8)`,
          [id, session.clubId, playerId, names.get(playerId), index + 1, selected.total_par,
            playerId === session.accountId ? "accepted" : "pending", playerId === session.accountId ? new Date() : null],
        );
      }
      await client.query(
        `INSERT INTO audit_log(club_id,actor_role,actor_id,action,entity_type,entity_id,metadata)
         VALUES ($1,'player',$2,$5,'round',$3,jsonb_build_object('participants',$4::int))`,
        [session.clubId, session.accountId, id, body.playerIds.length, body.playerIds.length > 1 ? "round.invitations_created" : "round.started"],
      );
      return id;
    });
    const round = await getRoundForPlayer(roundId, session.clubId!, session.accountId);
    return NextResponse.json({ round }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Error && ["COURSE_NOT_FOUND", "PLAYER_NOT_FOUND"].includes(error.message)) return NextResponse.json({ code: error.message }, { status: 404 });
    if (error instanceof Error && error.message === "COURSE_INCOMPLETE") return NextResponse.json({ code: error.message }, { status: 400 });
    if (error instanceof Error && error.message === "ROUND_CONFLICT") return NextResponse.json({ code: error.message }, { status: 409 });
    return apiError(error);
  }
}
