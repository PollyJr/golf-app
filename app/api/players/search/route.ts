import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { apiError } from "@/lib/http";
import { normalizeUsername } from "@/lib/player-core";

const schema = z.string().trim().min(2).max(30).regex(/^[a-zA-Z0-9._-]+$/);

export async function GET(request: Request) {
  try {
    const session = await requireApiSession(["player"]);
    const search = normalizeUsername(schema.parse(new URL(request.url).searchParams.get("q") || ""));
    const result = await query<{ id: string; display_name: string; initials: string; username: string; rounds: number }>(
      `SELECT p.id,p.display_name,p.initials,p.username::text,
              count(DISTINCT rp.round_id) FILTER (WHERE r.status='approved')::int AS rounds
         FROM players p
         LEFT JOIN round_participants rp ON rp.player_id=p.id AND rp.club_id=p.club_id
         LEFT JOIN rounds r ON r.id=rp.round_id AND r.club_id=p.club_id
        WHERE p.club_id=$1 AND p.active AND p.id<>$2 AND left(p.username::text,length($3))=$3
        GROUP BY p.id
        ORDER BY CASE WHEN p.username::text=$3 THEN 0 ELSE 1 END,p.username
        LIMIT 8`,
      [session.clubId, session.accountId, search],
    );
    return NextResponse.json({ players: result.rows.map((player) => ({
      id: player.id, name: player.display_name, initials: player.initials,
      username: player.username, code: "", rounds: player.rounds,
    })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
