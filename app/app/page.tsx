import Link from "next/link";
import { CalendarDays, Flag, MapPin, Medal, Trophy } from "lucide-react";
import { ActiveRoundsLive } from "@/components/active-rounds-live";
import { requireSession } from "@/lib/auth";
import { getCourses, getEvents, getLeaderboard } from "@/lib/dal";
import { getActiveRounds } from "@/lib/rounds";

export default async function Dashboard() {
  const session = await requireSession(["player"]);
  const [courses, events, ranking, activeRounds] = await Promise.all([
    getCourses(session.clubId!),
    getEvents(session.clubId!, session.accountId),
    getLeaderboard(session.clubId!, "week"),
    getActiveRounds(session.clubId!, session.accountId),
  ]);
  const mine = ranking.find((entry) => entry.id === session.accountId);

  return <div className="page">
    <div className="page-heading"><div><div className="eyebrow"><span/> jouw club</div><h1>Welkom, {session.displayName.split(" ")[0]}.</h1><p>Klaar voor een nieuwe ronde?</p></div></div>
    <ActiveRoundsLive initialRounds={activeRounds}/>
    <section className="hero"><div className="hero-content"><span className="badge">Veilige scorekaart</span><h2>De green roept.<br/>Jij hoeft alleen te spelen.</h2><p>Start een ronde voor jezelf en maximaal drie clubgenoten.</p><Link href="/app/play" className="primary-button"><Flag/> Start een ronde</Link></div><div className="hero-stat"><strong>{courses[0]?.holes || 9}</strong><span>holes · par {courses[0]?.totalPar || "—"}</span></div></section>
    <div className="section-heading"><h2>Jouw clubomgeving</h2></div>
    <div className="course-grid">
      <Link href="/app/results" className="card course-card"><Medal/><h3>Mijn uitslagen</h3><p>Bekijk je afgeronde rondes en beleef de eindstand opnieuw.</p></Link>
      <Link href="/app/leaderboards" className="card course-card"><Trophy/><h3>Weekklassement</h3><p>{mine ? `Je staat op #${mine.rank} met ${mine.toPar > 0 ? "+" : ""}${mine.toPar}.` : "Speel een goedgekeurde ronde om binnen te komen."}</p></Link>
      <Link href="/app/courses" className="card course-card"><MapPin/><h3>{courses.length} {courses.length === 1 ? "golfbaan" : "golfbanen"}</h3><p>Bekijk 9- en 18-hole layouts, tees en afstanden.</p></Link>
      <Link href="/app/events" className="card course-card"><CalendarDays/><h3>{events.length} komende events</h3><p>Schrijf je veilig in voor clubactiviteiten.</p></Link>
    </div>
  </div>;
}
