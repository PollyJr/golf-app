import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession, verifyMutation } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { apiError } from "@/lib/http";

const participant = z.object({ playerId: z.string().uuid().optional(), name: z.string().trim().min(1).max(100), guest: z.boolean(), scores: z.array(z.number().int().min(1).max(12)).min(9).max(18) }).refine((value) => value.guest ? !value.playerId : Boolean(value.playerId), { message: "Player identity does not match guest status" });
const schema = z.object({ clientId: z.string().uuid(), courseId: z.string().uuid(), participants: z.array(participant).min(1).max(4), completedAt: z.string().datetime().optional() });

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
    const body = schema.parse(await request.json());
    if (!body.participants.some((entry) => entry.playerId === session.accountId)) return NextResponse.json({ code: "SCORER_REQUIRED" }, { status: 400 });

    const roundId = await withTransaction(async (client) => {
      const course = await client.query<{ id: string; hole_count: number; tee_id: string }>(
        `SELECT c.id, c.hole_count, t.id AS tee_id FROM courses c JOIN tee_sets t ON t.course_id = c.id AND t.club_id = $2 AND t.is_default WHERE c.id = $1 AND c.club_id = $2 AND c.active FOR UPDATE`, [body.courseId, session.clubId],
      );
      if (!course.rowCount) throw new Error("COURSE_NOT_FOUND");
      const selected = course.rows[0];
      if (body.participants.some((entry) => entry.scores.length !== selected.hole_count)) throw new Error("INVALID_SCORE_COUNT");
      const holes = await client.query<{ number: number; par: number; distance_m: number }>(`SELECT number, par, distance_m FROM holes WHERE club_id = $1 AND course_id = $2 AND tee_set_id = $3 ORDER BY number`, [session.clubId, selected.id, selected.tee_id]);
      if (holes.rowCount !== selected.hole_count) throw new Error("COURSE_INCOMPLETE");
      const playerIds = body.participants.flatMap((entry) => entry.playerId ? [entry.playerId] : []);
      const players = await client.query<{ id: string; display_name: string }>(`SELECT id, display_name FROM players WHERE club_id = $1 AND active AND id = ANY($2::uuid[])`, [session.clubId, playerIds]);
      if (players.rowCount !== playerIds.length) throw new Error("PLAYER_NOT_FOUND");
      const names = new Map(players.rows.map((player) => [player.id, player.display_name]));
      const inserted = await client.query<{ id: string }>(`INSERT INTO rounds(client_id, club_id, course_id, tee_set_id, scorer_player_id, hole_count, completed_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (club_id, client_id) DO UPDATE SET client_id = EXCLUDED.client_id RETURNING id`, [body.clientId, session.clubId, selected.id, selected.tee_id, session.accountId, selected.hole_count, body.completedAt || new Date().toISOString()]);
      const existing = await client.query("SELECT 1 FROM round_participants WHERE round_id = $1", [inserted.rows[0].id]);
      if (existing.rowCount) return inserted.rows[0].id;
      for (const [index, entry] of body.participants.entries()) {
        const totalPar = holes.rows.reduce((sum, hole) => sum + hole.par, 0);
        const totalStrokes = entry.scores.reduce((sum, score) => sum + score, 0);
        const participantRow = await client.query<{ id: string }>(`INSERT INTO round_participants(round_id, club_id, player_id, display_name, is_guest, position, total_strokes, total_par) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [inserted.rows[0].id, session.clubId, entry.playerId || null, entry.playerId ? names.get(entry.playerId) : entry.name, entry.guest, index + 1, totalStrokes, totalPar]);
        for (const [holeIndex, strokes] of entry.scores.entries()) { const hole = holes.rows[holeIndex]; await client.query(`INSERT INTO hole_scores(round_participant_id, club_id, hole_number, strokes, par_snapshot, distance_snapshot) VALUES ($1,$2,$3,$4,$5,$6)`, [participantRow.rows[0].id, session.clubId, hole.number, strokes, hole.par, hole.distance_m]); }
      }
      await client.query(`INSERT INTO audit_log(club_id, actor_role, actor_id, action, entity_type, entity_id) VALUES ($1,'player',$2,'round.submitted','round',$3)`, [session.clubId, session.accountId, inserted.rows[0].id]);
      return inserted.rows[0].id;
    });
    return NextResponse.json({ id: roundId, status: "pending" }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && ["COURSE_NOT_FOUND", "PLAYER_NOT_FOUND"].includes(error.message)) return NextResponse.json({ code: error.message }, { status: 404 });
    if (error instanceof Error && ["INVALID_SCORE_COUNT", "COURSE_INCOMPLETE"].includes(error.message)) return NextResponse.json({ code: error.message }, { status: 400 });
    return apiError(error);
  }
}
