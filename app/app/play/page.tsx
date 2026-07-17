import { ScorecardLive } from "@/components/scorecard-live";
import { requireSession } from "@/lib/auth";
import { getCourses } from "@/lib/dal";
import { getRoundForPlayer } from "@/lib/rounds";

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ round?: string }> }){
  const session=await requireSession(["player"]);
  const { round: roundId }=await searchParams;
  const [courses,initialRound]=await Promise.all([getCourses(session.clubId!),roundId ? getRoundForPlayer(roundId,session.clubId!,session.accountId) : Promise.resolve(null)]);
  const me={id:session.accountId,name:session.displayName,initials:session.initials,username:session.username || "",code:session.code || "",rounds:0};
  return <ScorecardLive courses={courses} me={me} initialRound={initialRound}/>;
}
