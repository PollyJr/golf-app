import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth";
import { getLeaderboard } from "@/lib/dal";
import { apiError } from "@/lib/http";

const schema = z.object({ period: z.enum(["day", "week", "month", "year"]).default("week"), holes: z.enum(["9", "18"]).optional() });
export async function GET(request: Request) {
  try {
    const session = await requireApiSession(["player", "club_owner", "club_staff"]);
    const params = schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return NextResponse.json({ entries: await getLeaderboard(session.clubId!, params.period, params.holes ? Number(params.holes) as 9 | 18 : undefined) });
  } catch (error) { return apiError(error); }
}
