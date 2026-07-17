import { ScorecardLive } from "@/components/scorecard-live";
import { requireSession } from "@/lib/auth";
import { getClubPlayers, getCourses } from "@/lib/dal";
import { getRoundForPlayer } from "@/lib/rounds";

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ round?: string }> }){
  const session=await requireSession(["player"]);
  const { round: roundId }=await searchParams;
  const [courses,players,initialRound]=await Promise.all([getCourses(session.clubId!),getClubPlayers(session.clubId!),roundId ? getRoundForPlayer(roundId,session.clubId!,session.accountId) : Promise.resolve(null)]);
  const me=players.find((player)=>player.id===session.accountId) || {id:session.accountId,name:session.displayName,initials:session.initials,code:session.code || "",rounds:0};
  return <ScorecardLive courses={courses} players={players} me={me} initialRound={initialRound}/>;
}
