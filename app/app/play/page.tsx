import { ScorecardLive } from "@/components/scorecard-live";
import { requireSession } from "@/lib/auth";
import { getClubPlayers, getCourses } from "@/lib/dal";

export default async function PlayPage(){
  const session=await requireSession(["player"]);
  const [courses,players]=await Promise.all([getCourses(session.clubId!),getClubPlayers(session.clubId!)]);
  const me=players.find((player)=>player.id===session.accountId) || {id:session.accountId,name:session.displayName,initials:session.initials,code:session.code || "",rounds:0};
  return <ScorecardLive courses={courses} players={players} me={me}/>;
}
