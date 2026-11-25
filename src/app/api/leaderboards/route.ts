import { route } from "@/server/http/route";
import { getLocale } from "@/server/i18n";
import { getLeaderboard } from "@/server/services/leaderboards";
import { leaderboardQuerySchema } from "@/lib/validation";

export const GET = route({ access: "player", query: leaderboardQuerySchema }, async ({ session, query }) => ({
  entries: await getLeaderboard(
    session.clubId,
    { period: query.period, holeCount: query.holes === "18" ? 18 : 9, category: query.category, courseId: query.course ?? null },
    await getLocale(),
  ),
}));
