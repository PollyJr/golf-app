import "server-only";

import { db, many, one } from "../db";
import { getPlayerSummary } from "./players";
import { listAchievements, loadPlayerRounds } from "./progress";
import { initialsOf } from "@/lib/format";
import { summarizeRounds, type PlayerStats } from "@/lib/golf/stats";
import { pickText, type Locale, type LocalizedText } from "@/lib/i18n/core";
import type { AccountRole, AchievementDto, PlayerSummary } from "@/lib/types";

export interface PlayerOverview {
  player: PlayerSummary;
  stats: PlayerStats;
  achievements: AchievementDto[];
  memberSince: string;
}

/** Statistics of one member; the same data backs "my stats" and member profiles. */
export async function getPlayerOverview(clubId: string, playerId: string, locale: Locale): Promise<PlayerOverview | null> {
  const player = await getPlayerSummary(clubId, playerId);
  if (!player) return null;
  const [rounds, achievements, meta] = await Promise.all([
    loadPlayerRounds(db, clubId, playerId, locale),
    listAchievements(db, clubId, playerId),
    one<{ created_at: Date }>("SELECT created_at FROM players WHERE id = $1", [playerId]),
  ]);
  return { player, stats: summarizeRounds(rounds), achievements, memberSince: meta.created_at.toISOString() };
}

// ------------------------------------------------------------ dashboard --

export interface ClubDashboard {
  activePlayers: number;
  pendingRegistrations: number;
  pendingRounds: number;
  liveRounds: number;
  roundsThisWeek: number;
  roundsLastWeek: number;
  roundsThisMonth: number;
  upcomingEvents: number;
  /** Finished rounds per day, oldest first, for the last 30 days. */
  roundsPerDay: Array<{ day: string; rounds: number }>;
  courses: Array<{ name: string; rounds: number }>;
  topPlayers: Array<{ id: string; name: string; initials: string; rounds: number }>;
}

export async function getClubDashboard(clubId: string, locale: Locale): Promise<ClubDashboard> {
  const [counts, perDay, courses, topPlayers] = await Promise.all([
    one<{
      active_players: number;
      pending_registrations: number;
      pending_rounds: number;
      live_rounds: number;
      rounds_this_week: number;
      rounds_last_week: number;
      rounds_this_month: number;
      upcoming_events: number;
    }>(
      `WITH club AS (SELECT id, timezone FROM clubs WHERE id = $1),
            week AS (SELECT date_trunc('week', now() AT TIME ZONE timezone) AT TIME ZONE timezone AS start FROM club),
            month AS (SELECT date_trunc('month', now() AT TIME ZONE timezone) AT TIME ZONE timezone AS start FROM club),
            finished AS (SELECT completed_at FROM rounds WHERE club_id = $1 AND status IN ('pending', 'approved'))
       SELECT
         (SELECT count(*)::int FROM players WHERE club_id = $1 AND active AND registration_status = 'approved') AS active_players,
         (SELECT count(*)::int FROM players WHERE club_id = $1 AND registration_status = 'pending') AS pending_registrations,
         (SELECT count(*)::int FROM rounds WHERE club_id = $1 AND status = 'pending') AS pending_rounds,
         (SELECT count(*)::int FROM rounds WHERE club_id = $1 AND status = 'active' AND updated_at > now() - interval '8 hours') AS live_rounds,
         (SELECT count(*)::int FROM finished, week WHERE completed_at >= week.start) AS rounds_this_week,
         (SELECT count(*)::int FROM finished, week
           WHERE completed_at >= week.start - interval '7 days' AND completed_at < week.start) AS rounds_last_week,
         (SELECT count(*)::int FROM finished, month WHERE completed_at >= month.start) AS rounds_this_month,
         (SELECT count(*)::int FROM events WHERE club_id = $1 AND published AND starts_at >= now()) AS upcoming_events`,
      [clubId],
    ),
    many<{ day: string; rounds: number }>(
      `WITH club AS (SELECT timezone FROM clubs WHERE id = $1),
            days AS (
              SELECT generate_series(
                       (now() AT TIME ZONE (SELECT timezone FROM club))::date - 29,
                       (now() AT TIME ZONE (SELECT timezone FROM club))::date,
                       interval '1 day')::date AS day
            )
       SELECT to_char(days.day, 'YYYY-MM-DD') AS day, count(r.id)::int AS rounds
         FROM days
         LEFT JOIN rounds r
                ON r.club_id = $1 AND r.status IN ('pending', 'approved')
               AND (r.completed_at AT TIME ZONE (SELECT timezone FROM club))::date = days.day
        GROUP BY days.day
        ORDER BY days.day`,
      [clubId],
    ),
    many<{ name: LocalizedText; rounds: number }>(
      `SELECT c.name, count(r.id)::int AS rounds
         FROM courses c
         LEFT JOIN rounds r ON r.course_id = c.id AND r.status IN ('pending', 'approved')
                           AND r.completed_at > now() - interval '30 days'
        WHERE c.club_id = $1 AND c.active
        GROUP BY c.id
        ORDER BY rounds DESC, c.created_at`,
      [clubId],
    ),
    many<{ id: string; display_name: string; rounds: number }>(
      `SELECT p.id, p.display_name, count(*)::int AS rounds
         FROM round_participants rp
         JOIN rounds r ON r.id = rp.round_id AND r.status IN ('pending', 'approved')
                      AND r.completed_at > now() - interval '30 days'
         JOIN players p ON p.id = rp.player_id
        WHERE rp.club_id = $1
        GROUP BY p.id
        ORDER BY rounds DESC, p.display_name
        LIMIT 5`,
      [clubId],
    ),
  ]);

  return {
    activePlayers: counts.active_players,
    pendingRegistrations: counts.pending_registrations,
    pendingRounds: counts.pending_rounds,
    liveRounds: counts.live_rounds,
    roundsThisWeek: counts.rounds_this_week,
    roundsLastWeek: counts.rounds_last_week,
    roundsThisMonth: counts.rounds_this_month,
    upcomingEvents: counts.upcoming_events,
    roundsPerDay: perDay,
    courses: courses.map((course) => ({ name: pickText(course.name, locale), rounds: course.rounds })),
    topPlayers: topPlayers.map((player) => ({
      id: player.id,
      name: player.display_name,
      initials: initialsOf(player.display_name),
      rounds: player.rounds,
    })),
  };
}

// ---------------------------------------------------------------- audit --

export interface AuditEntry {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  actorRole: AccountRole | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function listAuditLog(clubId: string, options: { limit?: number; before?: number | null } = {}): Promise<AuditEntry[]> {
  const rows = await many<{
    id: number;
    action: string;
    entity_type: string;
    entity_id: string | null;
    actor_role: AccountRole | null;
    actor_name: string | null;
    metadata: Record<string, unknown>;
    created_at: Date;
  }>(
    `SELECT l.id, l.action, l.entity_type, l.entity_id, l.actor_role, l.metadata, l.created_at,
            COALESCE(p.display_name, a.display_name) AS actor_name
       FROM audit_log l
       LEFT JOIN players p ON l.actor_role = 'player' AND p.id = l.actor_id
       LEFT JOIN admin_accounts a ON l.actor_role <> 'player' AND a.id = l.actor_id
      WHERE l.club_id = $1 AND ($3::bigint IS NULL OR l.id < $3)
      ORDER BY l.id DESC
      LIMIT $2`,
    [clubId, options.limit ?? 100, options.before ?? null],
  );
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
  }));
}

// ------------------------------------------------------------- platform --

export interface PlatformTotals {
  clubs: number;
  players: number;
  rounds: number;
  roundsLast30Days: number;
}

export async function getPlatformTotals(): Promise<PlatformTotals> {
  const row = await one<{ clubs: number; players: number; rounds: number; recent: number }>(
    `SELECT (SELECT count(*)::int FROM clubs) AS clubs,
            (SELECT count(*)::int FROM players WHERE active AND registration_status = 'approved') AS players,
            (SELECT count(*)::int FROM rounds WHERE status IN ('pending', 'approved')) AS rounds,
            (SELECT count(*)::int FROM rounds WHERE status IN ('pending', 'approved')
                                                AND completed_at > now() - interval '30 days') AS recent`,
  );
  return { clubs: row.clubs, players: row.players, rounds: row.rounds, roundsLast30Days: row.recent };
}
