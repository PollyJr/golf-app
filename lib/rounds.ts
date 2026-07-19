import "server-only";

import type { QueryResultRow } from "pg";
import { query } from "@/lib/db";
import { completedScoreCount } from "@/lib/rounds-core";
import { expandCourseLayout } from "@/lib/round-format";
import type { ActiveRoundSummary, InvitationStatus, LiveRoundParticipant, LiveRoundSnapshot, PublicRoundSnapshot, RoundResultSummary, RoundStatus } from "@/lib/types";

type RoundBase = QueryResultRow & {
  id: string; club_id: string; revision: string; status: RoundStatus; scorer_player_id: string;
  created_at: string; completed_at: string | null; club_name: string;
  course_id: string; course_name: string; course_description: string; hole_count: 9 | 18; course_hole_count: 9 | 18;
  accent_color: string; tee_name: string;
};

async function buildSnapshot(base: RoundBase): Promise<LiveRoundSnapshot> {
  const [holes, participants, scores] = await Promise.all([
    query<{ number: number; par: number; distance_m: number }>(
      `SELECT number, par, distance_m FROM holes WHERE club_id=$1 AND course_id=$2 AND tee_set_id=(SELECT tee_set_id FROM rounds WHERE id=$3 AND club_id=$1) ORDER BY number`,
      [base.club_id, base.course_id, base.id],
    ),
    query<{ id: string; player_id: string; display_name: string; initials: string; position: number; invitation_status: InvitationStatus; total_strokes: number; total_par: number }>(
      `SELECT rp.id, rp.player_id, rp.display_name, p.initials, rp.position, rp.invitation_status, rp.total_strokes, rp.total_par
         FROM round_participants rp JOIN players p ON p.id=rp.player_id AND p.club_id=rp.club_id
        WHERE rp.round_id=$1 AND rp.club_id=$2 ORDER BY rp.position`, [base.id, base.club_id],
    ),
    query<{ round_participant_id: string; hole_number: number; strokes: number }>(
      `SELECT round_participant_id, hole_number, strokes FROM hole_scores WHERE club_id=$1 AND round_participant_id IN (SELECT id FROM round_participants WHERE round_id=$2 AND club_id=$1) ORDER BY hole_number`,
      [base.club_id, base.id],
    ),
  ]);
  const byParticipant = new Map<string, Map<number, number>>();
  for (const score of scores.rows) {
    const values = byParticipant.get(score.round_participant_id) || new Map<number, number>();
    values.set(score.hole_number, score.strokes); byParticipant.set(score.round_participant_id, values);
  }
  const layout = expandCourseLayout(
    holes.rows.map((hole) => ({ number: hole.number, par: hole.par, distance: hole.distance_m })),
    base.hole_count,
  );
  const mapped: LiveRoundParticipant[] = participants.rows.map((participant) => ({
    id: participant.id, playerId: participant.player_id, name: participant.display_name,
    initials: participant.initials, position: participant.position, invitationStatus: participant.invitation_status,
    totalStrokes: participant.total_strokes, totalPar: participant.total_par,
    scores: layout.map((hole) => byParticipant.get(participant.id)?.get(hole.number) ?? null),
  }));
  return {
    id: base.id, revision: Number(base.revision), status: base.status,
    starterPlayerId: base.scorer_player_id, isStarter: false,
    createdAt: new Date(base.created_at).toISOString(), completedAt: base.completed_at ? new Date(base.completed_at).toISOString() : null,
    course: { id: base.course_id, name: base.course_name, description: base.course_description, holes: base.hole_count,
      accent: base.accent_color, tee: base.tee_name, totalPar: layout.reduce((sum, hole) => sum + hole.par, 0),
      layout },
    participants: mapped, completedScores: completedScoreCount(mapped), totalScores: mapped.length * base.hole_count,
  };
}

export async function getRoundForPlayer(roundId: string, clubId: string, playerId: string) {
  const result = await query<RoundBase>(
    `SELECT r.id, r.club_id, r.revision, r.status, r.scorer_player_id, r.created_at, r.completed_at,
            c.name AS club_name, cse.id AS course_id, COALESCE(cse.name->>'nl',cse.name->>'en') AS course_name,
            COALESCE(cse.description->>'nl',cse.description->>'en','') AS course_description,
            r.hole_count, cse.hole_count AS course_hole_count, cse.accent_color, COALESCE(t.name->>'nl',t.name->>'en') AS tee_name
       FROM rounds r JOIN clubs c ON c.id=r.club_id
       JOIN courses cse ON cse.id=r.course_id AND cse.club_id=r.club_id
       JOIN tee_sets t ON t.id=r.tee_set_id AND t.club_id=r.club_id
      WHERE r.id=$1 AND r.club_id=$2
        AND EXISTS (SELECT 1 FROM round_participants mine WHERE mine.round_id=r.id AND mine.club_id=r.club_id AND mine.player_id=$3)
      LIMIT 1`, [roundId, clubId, playerId],
  );
  if (!result.rowCount) return null;
  const snapshot = await buildSnapshot(result.rows[0]);
  snapshot.isStarter = snapshot.starterPlayerId === playerId;
  return snapshot;
}

export async function getPublicRound(tokenHash: string): Promise<PublicRoundSnapshot | null> {
  const result = await query<RoundBase>(
    `SELECT r.id, r.club_id, r.revision, r.status, r.scorer_player_id, r.created_at, r.completed_at,
            c.name AS club_name, cse.id AS course_id, COALESCE(cse.name->>'nl',cse.name->>'en') AS course_name,
            COALESCE(cse.description->>'nl',cse.description->>'en','') AS course_description,
            r.hole_count, cse.hole_count AS course_hole_count, cse.accent_color, COALESCE(t.name->>'nl',t.name->>'en') AS tee_name
       FROM round_share_links l JOIN rounds r ON r.id=l.round_id AND r.club_id=l.club_id
       JOIN clubs c ON c.id=r.club_id AND c.status IN ('trial','active')
       JOIN courses cse ON cse.id=r.course_id AND cse.club_id=r.club_id
       JOIN tee_sets t ON t.id=r.tee_set_id AND t.club_id=r.club_id
      WHERE l.token_hash=$1 AND l.revoked_at IS NULL
        AND (r.status='active' OR (l.expires_at IS NOT NULL AND l.expires_at>now())) LIMIT 1`, [tokenHash],
  );
  if (!result.rowCount) return null;
  const snapshot = await buildSnapshot(result.rows[0]);
  return {
    revision: snapshot.revision, status: snapshot.status, clubName: result.rows[0].club_name,
    createdAt: snapshot.createdAt, completedAt: snapshot.completedAt,
    course: { name: snapshot.course.name, description: snapshot.course.description, holes: snapshot.course.holes,
      accent: snapshot.course.accent, tee: snapshot.course.tee, totalPar: snapshot.course.totalPar, layout: snapshot.course.layout },
    participants: snapshot.participants.map((participant) => ({ position: participant.position, name: participant.name,
      initials: participant.initials, totalStrokes: participant.totalStrokes, totalPar: participant.totalPar, scores: participant.scores })),
    completedScores: snapshot.completedScores, totalScores: snapshot.totalScores,
  };
}

export async function getActiveRounds(clubId: string, playerId: string): Promise<ActiveRoundSummary[]> {
  const result = await query<{ id: string; revision: string; status: "inviting" | "active"; my_invitation_status: InvitationStatus; course_name: string; hole_count: 9 | 18; created_at: string; starter_name: string; participant_names: string[]; participant_initials: string[]; pending_invitations: number; completed_scores: number; total_scores: number }>(
    `SELECT r.id, r.revision, r.status, mine.invitation_status AS my_invitation_status,
            COALESCE(c.name->>'nl',c.name->>'en') AS course_name, r.hole_count, r.created_at,
            starter.display_name AS starter_name,
            (SELECT array_agg(rp2.display_name ORDER BY rp2.position) FROM round_participants rp2 WHERE rp2.round_id=r.id AND rp2.club_id=r.club_id) AS participant_names,
            (SELECT array_agg(p2.initials ORDER BY rp2.position) FROM round_participants rp2 JOIN players p2 ON p2.id=rp2.player_id AND p2.club_id=rp2.club_id WHERE rp2.round_id=r.id AND rp2.club_id=r.club_id) AS participant_initials,
            (SELECT count(*)::int FROM round_participants rp2 WHERE rp2.round_id=r.id AND rp2.club_id=r.club_id AND rp2.invitation_status='pending') AS pending_invitations,
            (SELECT count(hs.id)::int FROM round_participants rp2 LEFT JOIN hole_scores hs ON hs.round_participant_id=rp2.id AND hs.club_id=rp2.club_id WHERE rp2.round_id=r.id AND rp2.club_id=r.club_id) AS completed_scores,
            (r.hole_count * (SELECT count(*) FROM round_participants rp2 WHERE rp2.round_id=r.id AND rp2.club_id=r.club_id))::int AS total_scores
       FROM rounds r JOIN courses c ON c.id=r.course_id AND c.club_id=r.club_id
       JOIN players starter ON starter.id=r.scorer_player_id AND starter.club_id=r.club_id
       JOIN round_participants mine ON mine.round_id=r.id AND mine.club_id=r.club_id AND mine.player_id=$2
      WHERE r.club_id=$1 AND r.status IN ('inviting','active')
      ORDER BY r.created_at DESC`, [clubId, playerId],
  );
  return result.rows.map((row) => ({ id: row.id, revision: Number(row.revision), status: row.status,
    myInvitationStatus: row.my_invitation_status, courseName: row.course_name,
    holeCount: row.hole_count, createdAt: new Date(row.created_at).toISOString(), starterName: row.starter_name,
    participantNames: row.participant_names, participantInitials: row.participant_initials,
    pendingInvitations: row.pending_invitations, completedScores: row.completed_scores, totalScores: row.total_scores }));
}

export async function getRoundHistory(clubId: string, playerId: string, limit = 50): Promise<RoundResultSummary[]> {
  const result = await query<{ id: string; status: "pending" | "approved" | "rejected"; course_name: string; hole_count: 9 | 18; completed_at: string; total_strokes: number; total_par: number; participant_count: number; winner_name: string; my_rank: number }>(
    `WITH ranked AS (
       SELECT r.id,r.status,r.completed_at,r.hole_count,COALESCE(c.name->>'nl',c.name->>'en') AS course_name,
              rp.player_id,rp.display_name,rp.total_strokes,rp.total_par,
              rank() OVER (PARTITION BY r.id ORDER BY rp.total_strokes-rp.total_par,rp.total_strokes)::int AS result_rank,
              count(*) OVER (PARTITION BY r.id)::int AS participant_count
         FROM rounds r JOIN courses c ON c.id=r.course_id AND c.club_id=r.club_id
         JOIN round_participants rp ON rp.round_id=r.id AND rp.club_id=r.club_id
        WHERE r.club_id=$1 AND r.status IN ('pending','approved','rejected')
          AND EXISTS (SELECT 1 FROM round_participants mine WHERE mine.round_id=r.id AND mine.club_id=r.club_id AND mine.player_id=$2)
     )
     SELECT mine.id,mine.status,mine.course_name,mine.hole_count,mine.completed_at,mine.total_strokes,mine.total_par,
            mine.participant_count,(SELECT winner.display_name FROM ranked winner WHERE winner.id=mine.id AND winner.result_rank=1 ORDER BY winner.display_name LIMIT 1) AS winner_name,
            mine.result_rank AS my_rank
       FROM ranked mine
      WHERE mine.player_id=$2
      ORDER BY mine.completed_at DESC LIMIT $3`,
    [clubId, playerId, limit],
  );
  return result.rows.map((row) => ({ id: row.id, status: row.status, courseName: row.course_name,
    holeCount: row.hole_count, completedAt: new Date(row.completed_at).toISOString(), totalStrokes: row.total_strokes,
    totalPar: row.total_par, participantCount: row.participant_count, winnerName: row.winner_name, myRank: row.my_rank }));
}
