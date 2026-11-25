import "server-only";

import { many, maybeOne } from "../db";
import { getClubByBoardToken } from "./clubs";
import { listEvents } from "./events";
import { getAces, getLeaderboard } from "./leaderboards";
import { listNews } from "./news";
import { initialsOf } from "@/lib/format";
import type { HoleCount, RoundFormat } from "@/lib/golf/scoring";
import { pickText, type Locale, type LocalizedText } from "@/lib/i18n/core";
import type { AceEntry, ClubDetails, EventDto, LeaderboardEntry, NewsItem } from "@/lib/types";

/**
 * The clubhouse board: a read-only, token-protected page for a screen on the
 * wall. It shows who is on the course right now, today's and this week's
 * ranking, the next events and pinned announcements.
 */

export interface LiveFlight {
  id: string;
  courseName: string;
  holeCount: HoleCount;
  format: RoundFormat;
  startedAt: string | null;
  players: Array<{ id: string; name: string; initials: string; thru: number; strokes: number; toPar: number }>;
  /** The flight's most recent score, for the "just in" line and celebrations. */
  latest: { playerId: string; name: string; hole: number; strokes: number; par: number; at: string } | null;
}

export interface BoardData {
  club: ClubDetails;
  generatedAt: string;
  live: LiveFlight[];
  today: LeaderboardEntry[];
  week: LeaderboardEntry[];
  month: LeaderboardEntry[];
  events: EventDto[];
  announcements: NewsItem[];
  aces: AceEntry[];
  holeCount: HoleCount;
  /** For the "join in" QR code; `null` when the club does not take sign-ups. */
  joinCode: string | null;
}

export async function listLiveFlights(clubId: string, locale: Locale): Promise<LiveFlight[]> {
  const rows = await many<{
    id: string;
    course_name: LocalizedText;
    hole_count: HoleCount;
    format: RoundFormat;
    started_at: Date | null;
    players: Array<{ id: string; name: string; thru: number; strokes: number; par: number }>;
    latest: { player_id: string; name: string; hole: number; strokes: number; par: number; at: string } | null;
  }>(
    `SELECT r.id, c.name AS course_name, r.hole_count, r.format, r.started_at,
            (SELECT json_build_object('player_id', rp.id, 'name', rp.display_name, 'hole', hs.hole_number,
                                      'strokes', hs.strokes, 'par', hs.par_snapshot, 'at', hs.updated_at)
               FROM hole_scores hs JOIN round_participants rp ON rp.id = hs.round_participant_id
              WHERE rp.round_id = r.id
              ORDER BY hs.updated_at DESC, hs.hole_number DESC
              LIMIT 1) AS latest,
            (SELECT json_agg(json_build_object(
                      'id', rp.id,
                      'name', rp.display_name,
                      'strokes', rp.total_strokes,
                      'thru', (SELECT count(*) FROM hole_scores hs WHERE hs.round_participant_id = rp.id),
                      'par', (SELECT COALESCE(sum(hs.par_snapshot), 0) FROM hole_scores hs WHERE hs.round_participant_id = rp.id)
                    ) ORDER BY rp.position)
               FROM round_participants rp WHERE rp.round_id = r.id) AS players
       FROM rounds r
       JOIN courses c ON c.id = r.course_id
      WHERE r.club_id = $1 AND r.status = 'active' AND r.updated_at > now() - interval '8 hours'
      ORDER BY r.updated_at DESC
      LIMIT 8`,
    [clubId],
  );
  return rows.map((row) => ({
    id: row.id,
    courseName: pickText(row.course_name, locale),
    holeCount: row.hole_count,
    format: row.format,
    startedAt: row.started_at?.toISOString() ?? null,
    players: (row.players ?? []).map((player) => ({
      id: player.id,
      name: player.name,
      initials: initialsOf(player.name),
      thru: Number(player.thru),
      strokes: player.strokes,
      toPar: player.strokes - Number(player.par),
    })),
    latest: row.latest
      ? {
          playerId: row.latest.player_id,
          name: row.latest.name,
          hole: row.latest.hole,
          strokes: row.latest.strokes,
          par: row.latest.par,
          at: new Date(row.latest.at).toISOString(),
        }
      : null,
  }));
}

/** The round length most played at this club decides which ranking the board shows. */
async function dominantHoleCount(clubId: string): Promise<HoleCount> {
  const rows = await many<{ hole_count: HoleCount }>(
    `SELECT hole_count FROM rounds
      WHERE club_id = $1 AND status = 'approved' AND completed_at > now() - interval '90 days'
      GROUP BY hole_count ORDER BY count(*) DESC LIMIT 1`,
    [clubId],
  );
  return rows[0]?.hole_count ?? 9;
}

export async function getBoard(boardToken: string, locale: Locale): Promise<BoardData | null> {
  const club = await getClubByBoardToken(boardToken);
  if (!club) return null;
  const holeCount = await dominantHoleCount(club.id);
  const ranking = (period: "day" | "week" | "month") =>
    getLeaderboard(club.id, { period, holeCount, category: "best" }, locale).then((rows) => rows.slice(0, 10));

  const [live, today, week, month, events, announcements, aces, join] = await Promise.all([
    listLiveFlights(club.id, locale),
    ranking("day"),
    ranking("week"),
    ranking("month"),
    listEvents(club.id, locale, { scope: "upcoming", limit: 4 }),
    listNews(club.id, locale, { kinds: ["announcement", "news"], limit: 3 }),
    getAces(club.id, locale, 3),
    maybeOne<{ join_code: string }>("SELECT join_code FROM clubs WHERE id = $1 AND self_registration <> 'closed'", [club.id]),
  ]);

  return {
    club,
    generatedAt: new Date().toISOString(),
    live,
    today,
    week,
    month,
    events,
    announcements,
    aces,
    holeCount,
    joinCode: join?.join_code ?? null,
  };
}
