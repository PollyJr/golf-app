import { LeaderboardLive } from "@/components/leaderboard-live";
import { requireSession } from "@/lib/auth";
import { getLeaderboard } from "@/lib/dal";

export default async function LeaderboardsPage() { const session = await requireSession(["player"]); return <LeaderboardLive initial={await getLeaderboard(session.clubId!, "week", 9)} meId={session.accountId}/>; }
