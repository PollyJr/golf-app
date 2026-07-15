import "server-only";

import { query } from "@/lib/db";
import type { Course, EventItem, LeaderboardEntry, Player } from "@/lib/types";

export async function getCourses(clubId: string): Promise<Course[]> {
  const result = await query<{ course_id: string; name: string; description: string; hole_count: 9 | 18; accent_color: string; tee_name: string; number: number; par: number; distance_m: number }>(
    `SELECT c.id AS course_id, COALESCE(c.name->>'nl', c.name->>'en') AS name,
            COALESCE(c.description->>'nl', c.description->>'en', '') AS description,
            c.hole_count, c.accent_color, COALESCE(t.name->>'nl', t.name->>'en') AS tee_name,
            h.number, h.par, h.distance_m
       FROM courses c JOIN tee_sets t ON t.course_id = c.id AND t.club_id = $1 AND t.is_default
       JOIN holes h ON h.tee_set_id = t.id AND h.club_id = $1
      WHERE c.club_id = $1 AND c.active ORDER BY c.created_at, h.number`, [clubId],
  );
  const grouped = new Map<string, Course>();
  for (const row of result.rows) {
    const course = grouped.get(row.course_id) || { id: row.course_id, name: row.name, holes: row.hole_count, accent: row.accent_color, description: row.description, tee: row.tee_name, totalPar: 0, layout: [] };
    course.layout.push({ number: row.number, par: row.par, distance: row.distance_m });
    course.totalPar += row.par;
    grouped.set(row.course_id, course);
  }
  return [...grouped.values()];
}

export async function getClubPlayers(clubId: string): Promise<Player[]> {
  const result = await query<{ id: string; display_name: string; initials: string; code: string; rounds: number }>(
    `SELECT p.id, p.display_name, p.initials, p.code::text,
            count(DISTINCT rp.round_id) FILTER (WHERE r.status = 'approved')::int AS rounds
       FROM players p LEFT JOIN round_participants rp ON rp.player_id = p.id AND rp.club_id = $1
       LEFT JOIN rounds r ON r.id = rp.round_id AND r.club_id = $1
      WHERE p.club_id = $1 AND p.active GROUP BY p.id ORDER BY p.display_name`, [clubId],
  );
  return result.rows.map((row) => ({ id: row.id, name: row.display_name, initials: row.initials, code: row.code, rounds: row.rounds }));
}

export async function getLeaderboard(clubId: string, period: "day" | "week" | "month" | "year", holeCount?: 9 | 18): Promise<LeaderboardEntry[]> {
  const start = { day: "day", week: "week", month: "month", year: "year" }[period];
  const result = await query<{ player_id: string; display_name: string; initials: string; total_strokes: number; score_to_par: number; course_name: string; rounds: number; rank: number }>(
    `WITH ranked AS (
       SELECT l.player_id, l.display_name, p.initials, l.total_strokes, l.score_to_par,
              COALESCE(c.name->>'nl', c.name->>'en') AS course_name,
              count(*) OVER (PARTITION BY l.player_id)::int AS rounds,
              row_number() OVER (PARTITION BY l.player_id ORDER BY l.score_to_par, l.total_strokes, l.completed_at) AS best
         FROM leaderboard_entries l JOIN players p ON p.id = l.player_id AND p.club_id = $1
         JOIN courses c ON c.id = l.course_id AND c.club_id = $1
        WHERE l.club_id = $1 AND l.completed_at >= date_trunc($2, now())
          AND ($3::int IS NULL OR l.hole_count = $3)
     ) SELECT *, rank() OVER (ORDER BY score_to_par, total_strokes)::int AS rank
       FROM ranked WHERE best = 1 ORDER BY rank, display_name LIMIT 100`, [clubId, start, holeCount || null],
  );
  return result.rows.map((row) => ({ id: row.player_id, rank: row.rank, name: row.display_name, initials: row.initials, score: row.total_strokes, toPar: row.score_to_par, course: row.course_name, rounds: row.rounds, movement: 0 }));
}

export async function getEvents(clubId: string, playerId?: string): Promise<EventItem[]> {
  const result = await query<{ id: string; title: string; description: string; starts_at: string; course_id: string | null; capacity: number | null; registered: number; joined: boolean }>(
    `SELECT e.id, COALESCE(e.title->>'nl', e.title->>'en') AS title,
            COALESCE(e.description->>'nl', e.description->>'en', '') AS description,
            e.starts_at, e.course_id, e.capacity,
            count(er.player_id) FILTER (WHERE er.status = 'registered')::int AS registered,
            bool_or(er.player_id = $2 AND er.status = 'registered') AS joined
       FROM events e LEFT JOIN event_registrations er ON er.event_id = e.id AND er.club_id = $1
      WHERE e.club_id = $1 AND e.published AND e.starts_at >= now()
      GROUP BY e.id ORDER BY e.starts_at LIMIT 50`, [clubId, playerId || null],
  );
  return result.rows.map((row) => { const date = new Date(row.starts_at); return { id: row.id, title: row.title, date: date.toISOString().slice(0, 10), time: date.toISOString().slice(11, 16), courseId: row.course_id || "", description: row.description, capacity: row.capacity || 9999, registered: row.registered, joined: row.joined }; });
}
