import type { CSSProperties } from "react";
import Link from "next/link";
import { ChevronRight, Medal, Trophy } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { formatToPar } from "@/lib/results-core";
import { getRoundHistory } from "@/lib/rounds";

export default async function ResultsPage() {
  const session = await requireSession(["player"]);
  const results = await getRoundHistory(session.clubId!, session.accountId);

  return <div className="page results-overview">
    <div className="page-heading"><div>
      <div className="eyebrow"><span/> jouw golfhistorie</div>
      <h1>Uitslagen.</h1>
      <p>Bekijk iedere afgeronde scorekaart en beleef de eindstand opnieuw.</p>
    </div></div>
    {results.length ? <div className="result-history-grid">{results.map((result, index) =>
      <Link className="card result-history-card" href={`/app/results/${result.id}`} key={result.id} style={{ "--history-delay": `${index * 70}ms` } as CSSProperties}>
        <span className={`history-medal place-${result.myRank}`}>{result.myRank <= 3 ? <Medal size={20}/> : `#${result.myRank}`}</span>
        <div>
          <span>{result.status === "approved" ? "Goedgekeurd" : result.status === "rejected" ? "Afgewezen" : "In beoordeling"}</span>
          <h2>{result.courseName}</h2>
          <p>{new Date(result.completedAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })} · {result.holeCount} holes</p>
        </div>
        <div className="history-score">
          <strong>{result.totalStrokes}</strong>
          <em>{formatToPar(result.totalStrokes - result.totalPar)}</em>
          <small>{result.participantCount > 1 ? `Winnaar: ${result.winnerName}` : "Solo ronde"}</small>
        </div>
        <ChevronRight size={18}/>
        <i/>
      </Link>,
    )}</div> : <div className="card empty result-empty">
      <Trophy size={30}/><h2>Nog geen uitslagen</h2>
      <p>Sluit je eerste complete ronde af om hem hier terug te zien.</p>
      <Link className="primary-button" href="/app/play">Start een ronde</Link>
    </div>}
  </div>;
}
