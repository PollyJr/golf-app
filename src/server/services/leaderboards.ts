import "server-only";

import { many, maybeOne } from "../db";
import { initialsOf } from "@/lib/format";
import type { HoleCount } from "@/lib/golf/scoring";
import { pickText, type Locale, type LocalizedText } from "@/lib/i18n/core";
import type { AceEntry, CourseRecord, LeaderboardCategory, LeaderboardEntry, Period } from "@/lib/types";

const LIMIT = 100;

export interface LeaderboardQuery {
  period: Period;
  holeCount: HoleCount;
  category: LeaderboardCategory;
  courseId?: string | null;
}

interface Bounds {
  start: Date | null;
  end: Date | null;
  previousStart: Date | null;
}

/** Start of the current and the previous period, in the club's own time zone. */
async function periodBounds(clubId: string, period: Period): Promise<Bounds> {
  if (period === "all") return { start: null, end: null, previousStart: null };
  const row = await maybeOne<{ start: Date; previous_start: Date }>(
    `SELECT date_trunc($2, now() AT TIME ZONE timezone) AT TIME ZONE timezone AS start,
            (date_trunc($2, now() AT TIME ZONE timezone) - ('1 ' || $2)::interval) AT TIME ZONE timezone AS previous_start
       FROM clubs WHERE id = $1`,
    [clubId, period],
  );
  if (!row) return { start: null, end: null, previousStart: null };
  return { start: row.start, end: null, previousStart: row.previous_start };
}

/** Fewer rounds are needed for an average over a short period. */
function minimumRoundsForAverage(period: Period): number {
  if (period === "day") return 1;
  if (period === "week") return 2;
  return 3;
}

interface RankRow {
  player_id: string;
  display_name: string;
  value: number;
  to_par: number | null;
  rounds: number;
  course_name: LocalizedText;
  rank: number;
}

// Approved rounds of registered players inside the requested window.
const SCOPE = `
  SELECT rp.id AS participant_id, rp.player_id, rp.total_strokes AS strokes,
         rp.total_strokes - rp.total_par AS to_par, r.completed_at, c.name AS course_name
    FROM rounds r
    JOIN round_participants rp ON rp.round_id = r.id AND rp.player_id IS NOT NULL
    JOIN courses c ON c.id = r.course_id
   WHERE r.club_id = $1 AND r.status = 'approved' AND r.hole_count = $2
     AND ($3::timestamptz IS NULL OR r.completed_at >= $3)
     AND ($4::timestamptz IS NULL OR r.completed_at < $4)
     AND ($5::uuid IS NULL OR r.course_id = $5)`;

const RANKINGS: Record<LeaderboardCategory, string> = {
  // Best single round relative to par; fewer strokes breaks ties.
  best: `
    WITH scope AS (${SCOPE}),
    ranked AS (
      SELECT DISTINCT ON (player_id) player_id, strokes::float AS value, to_par, course_name,
             count(*) OVER (PARTITION BY player_id)::int AS rounds
        FROM scope
       ORDER BY player_id, to_par, strokes, completed_at
    )
    SELECT ranked.*, p.display_name, rank() OVER (ORDER BY ranked.to_par, ranked.value)::int AS rank
      FROM ranked JOIN players p ON p.id = ranked.player_id AND p.active`,
  // Average score to par, for players with enough rounds to mean something.
  average: `
    WITH scope AS (${SCOPE}),
    ranked AS (
      SELECT player_id, avg(to_par)::float AS value, NULL::int AS to_par, NULL::jsonb AS course_name,
             count(*)::int AS rounds
        FROM scope GROUP BY player_id HAVING count(*) >= $6
    )
    SELECT ranked.*, p.display_name, rank() OVER (ORDER BY ranked.value)::int AS rank
      FROM ranked JOIN players p ON p.id = ranked.player_id AND p.active`,
  rounds: `
    WITH scope AS (${SCOPE}),
    ranked AS (
      SELECT player_id, count(*)::float AS value, NULL::int AS to_par, NULL::jsonb AS course_name,
             count(*)::int AS rounds
        FROM scope GROUP BY player_id
    )
    SELECT ranked.*, p.display_name, rank() OVER (ORDER BY ranked.value DESC)::int AS rank
      FROM ranked JOIN players p ON p.id = ranked.player_id AND p.active`,
  // Holes played under par.
  birdies: `
    WITH scope AS (${SCOPE}),
    ranked AS (
      SELECT scope.player_id, count(*) FILTER (WHERE hs.strokes < hs.par_snapshot)::float AS value,
             NULL::int AS to_par, NULL::jsonb AS course_name,
             count(DISTINCT scope.participant_id)::int AS rounds
        FROM scope JOIN hole_scores hs ON hs.round_participant_id = scope.participant_id
       GROUP BY scope.player_id
      HAVING count(*) FILTER (WHERE hs.strokes < hs.par_snapshot) > 0
    )
    SELECT ranked.*, p.display_name, rank() OVER (ORDER BY ranked.value DESC)::int AS rank
      FROM ranked JOIN players p ON p.id = ranked.player_id AND p.active`,
};

async function rankPlayers(
  clubId: string,
  query: LeaderboardQuery,
  from: Date | null,
  to: Date | null,
): Promise<RankRow[]> {
  const values: unknown[] = [clubId, query.holeCount, from, to, query.courseId ?? null];
  if (query.category === "average") values.push(minimumRoundsForAverage(query.period));
  return many<RankRow>(`${RANKINGS[query.category]} ORDER BY rank, display_name LIMIT ${LIMIT}`, values);
}

export async function getLeaderboard(clubId: string, query: LeaderboardQuery, locale: Locale): Promise<LeaderboardEntry[]> {
  const bounds = await periodBounds(clubId, query.period);
  const [current, previous] = await Promise.all([
    rankPlayers(clubId, query, bounds.start, bounds.end),
    bounds.previousStart ? rankPlayers(clubId, query, bounds.previousStart, bounds.start) : Promise.resolve([]),
  ]);
  const previousRank = new Map(previous.map((row) => [row.player_id, row.rank]));

  return current.map((row) => {
    const before = previousRank.get(row.player_id);
    return {
      playerId: row.player_id,
      rank: row.rank,
      name: row.display_name,
      initials: initialsOf(row.display_name),
      value: row.value,
      toPar: row.to_par,
      rounds: row.rounds,
      courseName: pickText(row.course_name, locale) || null,
      movement: before === undefined ? null : before - row.rank,
    };
  });
}

/** A player's position in a ranking, without loading the whole board twice. */
export async function getPlayerRank(
  clubId: string,
  playerId: string,
  query: LeaderboardQuery,
  locale: Locale,
): Promise<{ entry: LeaderboardEntry | null; total: number }> {
  const board = await getLeaderboard(clubId, query, locale);
  return { entry: board.find((row) => row.playerId === playerId) ?? null, total: board.length };
}

/** The best approved round on every course, per round length. */
export async function getCourseRecords(clubId: string, locale: Locale): Promise<CourseRecord[]> {
  const rows = await many<{
    course_id: string;
    course_name: LocalizedText;
    hole_count: HoleCount;
    player_id: string;
    display_name: string;
    strokes: number;
    to_par: number;
    completed_at: Date;
    round_id: string;
  }>(
    `SELECT DISTINCT ON (r.course_id, r.hole_count)
            r.course_id, c.name AS course_name, r.hole_count, rp.player_id, p.display_name,
            rp.total_strokes AS strokes, rp.total_strokes - rp.total_par AS to_par,
            r.completed_at, r.id AS round_id
       FROM rounds r
       JOIN round_participants rp ON rp.round_id = r.id AND rp.player_id IS NOT NULL
       JOIN players p ON p.id = rp.player_id
       JOIN courses c ON c.id = r.course_id AND c.active
      WHERE r.club_id = $1 AND r.status = 'approved'
      ORDER BY r.course_id, r.hole_count, rp.total_strokes, r.completed_at`,
    [clubId],
  );
  return rows.map((row) => ({
    courseId: row.course_id,
    courseName: pickText(row.course_name, locale),
    holeCount: row.hole_count,
    playerId: row.player_id,
    playerName: row.display_name,
    initials: initialsOf(row.display_name),
    strokes: row.strokes,
    toPar: row.to_par,
    completedAt: row.completed_at.toISOString(),
    roundId: row.round_id,
  }));
}

/** Every hole-in-one in an approved round, newest first. */
export async function getAces(clubId: string, locale: Locale, limit = 30): Promise<AceEntry[]> {
  const rows = await many<{
    player_id: string;
    display_name: string;
    course_name: LocalizedText;
    hole_number: number;
    distance_snapshot: number;
    completed_at: Date;
    round_id: string;
  }>(
    `SELECT rp.player_id, p.display_name, c.name AS course_name, hs.hole_number, hs.distance_snapshot,
            r.completed_at, r.id AS round_id
       FROM hole_scores hs
       JOIN round_participants rp ON rp.id = hs.round_participant_id AND rp.player_id IS NOT NULL
       JOIN rounds r ON r.id = rp.round_id AND r.status = 'approved'
       JOIN players p ON p.id = rp.player_id
       JOIN courses c ON c.id = r.course_id
      WHERE r.club_id = $1 AND hs.strokes = 1
      ORDER BY r.completed_at DESC
      LIMIT $2`,
    [clubId, limit],
  );
  return rows.map((row) => ({
    playerId: row.player_id,
    playerName: row.display_name,
    initials: initialsOf(row.display_name),
    courseName: pickText(row.course_name, locale),
    hole: row.hole_number,
    distance: row.distance_snapshot,
    completedAt: row.completed_at.toISOString(),
    roundId: row.round_id,
  }));
}
