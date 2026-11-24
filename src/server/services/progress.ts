import "server-only";

import { many, type Db } from "../db";
import { notify } from "./notifications";
import { evaluateAchievements, isAchievementKey, type AchievementKey, type HistoryRound } from "@/lib/golf/achievements";
import { computeClubIndex, INDEX_WINDOW } from "@/lib/golf/club-index";
import type { StatRound } from "@/lib/golf/stats";
import type { Strokes } from "@/lib/golf/scoring";
import { pickText, type Locale, type LocalizedText } from "@/lib/i18n/core";
import type { AchievementDto } from "@/lib/types";

/**
 * Everything that follows from a player's approved rounds: the club index,
 * achievements, and the raw history that statistics are computed from.
 */

interface HistoryRow {
  id: string;
  completed_at: Date;
  hole_count: number;
  course_id: string;
  course_name: LocalizedText;
  course_hole_count: number;
  holes: Array<{ h: number; s: number; p: number; u: number | null }> | null;
  partner_ids: string[];
  flight_size: number;
  best_in_flight: boolean;
}

export interface PlayerRound extends StatRound, HistoryRound {}

/** A player's approved rounds, oldest first, with hole-by-hole detail. */
export async function loadPlayerRounds(on: Db, clubId: string, playerId: string, locale: Locale = "nl"): Promise<PlayerRound[]> {
  const rows = await many<HistoryRow>(
    `SELECT r.id, r.completed_at, r.hole_count, r.course_id, c.name AS course_name,
            c.hole_count AS course_hole_count,
            (SELECT json_agg(json_build_object('h', hs.hole_number, 's', hs.strokes, 'p', hs.par_snapshot, 'u', hs.putts)
                             ORDER BY hs.hole_number)
               FROM hole_scores hs
              WHERE hs.round_participant_id = rp.id) AS holes,
            ARRAY(SELECT o.player_id FROM round_participants o
                   WHERE o.round_id = r.id AND o.id <> rp.id AND o.player_id IS NOT NULL) AS partner_ids,
            (SELECT count(*)::int FROM round_participants o WHERE o.round_id = r.id) AS flight_size,
            NOT EXISTS (
              SELECT 1 FROM round_participants o
               WHERE o.round_id = r.id AND o.id <> rp.id
                 AND (o.total_strokes - o.total_par) <= (rp.total_strokes - rp.total_par)
            ) AS best_in_flight
       FROM rounds r
       JOIN round_participants rp ON rp.round_id = r.id AND rp.player_id = $2
       JOIN courses c ON c.id = r.course_id
      WHERE r.club_id = $1 AND r.status = 'approved' AND r.completed_at IS NOT NULL
      ORDER BY r.completed_at`,
    [clubId, playerId],
    on,
  );

  return rows.map((row) => {
    const scores: Strokes[] = Array.from({ length: row.hole_count }, () => null);
    const pars: number[] = Array.from({ length: row.hole_count }, () => 3);
    const putts: (number | null)[] = Array.from({ length: row.hole_count }, () => null);
    for (const hole of row.holes ?? []) {
      if (hole.h < 1 || hole.h > row.hole_count) continue;
      scores[hole.h - 1] = hole.s;
      pars[hole.h - 1] = hole.p;
      putts[hole.h - 1] = hole.u;
    }
    return {
      roundId: row.id,
      completedAt: row.completed_at,
      courseId: row.course_id,
      courseName: pickText(row.course_name, locale),
      holeCount: row.hole_count,
      courseHoleCount: row.course_hole_count,
      scores,
      pars,
      putts,
      partnerIds: row.partner_ids,
      wonFlight: row.flight_size > 1 && row.best_in_flight,
    };
  });
}

/** Recomputes and stores the club index from the most recent approved rounds. */
export async function refreshClubIndex(on: Db, clubId: string, playerId: string): Promise<number | null> {
  const rounds = await many<{ strokes: number; par: number; hole_count: number }>(
    `SELECT rp.total_strokes AS strokes, rp.total_par AS par, r.hole_count
       FROM rounds r
       JOIN round_participants rp ON rp.round_id = r.id AND rp.player_id = $2
      WHERE r.club_id = $1 AND r.status = 'approved' AND r.completed_at IS NOT NULL
      ORDER BY r.completed_at DESC
      LIMIT ${INDEX_WINDOW}`,
    [clubId, playerId],
    on,
  );
  const index = computeClubIndex(rounds.map((round) => ({ strokes: round.strokes, par: round.par, holeCount: round.hole_count })));
  await on.query("UPDATE players SET club_index = $3 WHERE club_id = $1 AND id = $2", [clubId, playerId, index]);
  return index;
}

/** Awards achievements the player has earned but not yet received. */
export async function awardAchievements(on: Db, clubId: string, playerId: string, announce = true): Promise<AchievementKey[]> {
  const earned = evaluateAchievements(await loadPlayerRounds(on, clubId, playerId));
  if (earned.size === 0) return [];
  const keys = [...earned.keys()];
  const inserted = await many<{ key: string }>(
    `INSERT INTO player_achievements (club_id, player_id, key, round_id)
     SELECT $1, $2, item.key, item.round_id
       FROM unnest($3::text[], $4::uuid[]) AS item(key, round_id)
     ON CONFLICT (player_id, key) DO NOTHING
     RETURNING key`,
    [clubId, playerId, keys, keys.map((key) => earned.get(key) ?? null)],
    on,
  );
  const fresh = inserted.map((row) => row.key).filter(isAchievementKey);
  if (announce) {
    for (const key of fresh) await notify(on, clubId, [playerId], "achievement", { key });
  }
  return fresh;
}

export async function listAchievements(on: Db, clubId: string, playerId: string): Promise<AchievementDto[]> {
  const rows = await many<{ key: string; achieved_at: Date; round_id: string | null }>(
    "SELECT key, achieved_at, round_id FROM player_achievements WHERE club_id = $1 AND player_id = $2 ORDER BY achieved_at DESC",
    [clubId, playerId],
    on,
  );
  return rows.flatMap((row) =>
    isAchievementKey(row.key)
      ? [{ key: row.key, achievedAt: row.achieved_at.toISOString(), roundId: row.round_id }]
      : [],
  );
}

/** Run after a round's approval state changed, for each registered participant. */
export async function refreshPlayerProgress(on: Db, clubId: string, playerIds: readonly string[], announce = true): Promise<void> {
  for (const playerId of playerIds) {
    await refreshClubIndex(on, clubId, playerId);
    await awardAchievements(on, clubId, playerId, announce);
  }
}
