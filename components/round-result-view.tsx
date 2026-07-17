import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronRight, Clock3, Medal, RotateCcw, ShieldCheck, Trophy, X } from "lucide-react";
import { formatToPar, rankRoundParticipants } from "@/lib/results-core";
import { ResultShareControl } from "@/components/result-share-control";
import type { LiveRoundSnapshot } from "@/lib/types";

const statusCopy = {
  pending: { label: "Wacht op clubcontrole", icon: Clock3 },
  approved: { label: "Goedgekeurd", icon: ShieldCheck },
  rejected: { label: "Afgewezen", icon: X },
} as const;

export function RoundResultView({ round }: { round: LiveRoundSnapshot }) {
  const ranked = rankRoundParticipants(round.participants);
  const winner = ranked[0];
  const status = statusCopy[round.status as keyof typeof statusCopy] || statusCopy.pending;
  const StatusIcon = status.icon;

  return <div className="round-result-page">
    <div className="result-confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index}/>)}</div>
    <header className="result-topbar">
      <Link href="/app/results"><ArrowLeft size={17}/> Alle uitslagen</Link>
      <span className={`result-status ${round.status}`}><StatusIcon size={14}/>{status.label}</span>
    </header>
    <section className="result-celebration">
      <span className="result-trophy"><Trophy size={34}/></span>
      <div className="eyebrow light"><span/> officiële scorekaart</div>
      <h1>{ranked.length > 1 ? `${winner.name} wint de ronde!` : "Ronde voltooid!"}</h1>
      <p>{round.course.name} · {round.course.holes} holes · {new Date(round.completedAt || round.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}</p>
      <div className="winner-score"><strong>{winner.totalStrokes}</strong><span>slagen</span><em>{formatToPar(winner.scoreToPar)}</em></div>
    </section>
    <main className="result-content">
      <section className="card result-ranking">
        <div className="result-section-head"><div><span>EINDSTAND</span><h2>Uitslag</h2></div><Medal size={21}/></div>
        <div className="result-list">{ranked.map((participant, index) =>
          <article key={participant.id} className={`result-row rank-${participant.rank}`} style={{ "--result-delay": `${140 + index * 110}ms` } as CSSProperties}>
            <strong className="result-rank">{participant.rank}</strong>
            <span className="avatar">{participant.initials}</span>
            <span><b>{participant.name}</b><small>{participant.playerId === round.starterPlayerId ? "Starter" : "Flightgenoot"}</small></span>
            <span className="result-total"><b>{participant.totalStrokes}</b><small>slagen</small></span>
            <em>{formatToPar(participant.scoreToPar)}</em>
          </article>,
        )}</div>
      </section>
      <section className="card result-scorecard">
        <div className="result-section-head"><div><span>SCOREKAART</span><h2>Hole voor hole</h2></div><Check size={21}/></div>
        <div className="result-score-scroll" style={{ "--result-holes": round.course.holes } as CSSProperties}>
          <div className="result-score-head"><span>Speler</span>{round.course.layout.map((hole) => <span key={hole.number}><b>{hole.number}</b><small>p{hole.par}</small></span>)}<span>Totaal</span></div>
          {ranked.map((participant) => <div className="result-score-line" key={participant.id}>
            <span><i className="avatar">{participant.initials}</i><b>{participant.name}</b></span>
            {participant.scores.map((score, index) => <span className={score === null ? "" : score < round.course.layout[index].par ? "under" : score > round.course.layout[index].par ? "over" : "even"} key={round.course.layout[index].number}>{score ?? "—"}</span>)}
            <strong>{participant.totalStrokes}</strong>
          </div>)}
        </div>
      </section>
      <footer className="result-actions">
        {round.isStarter && <ResultShareControl roundId={round.id}/>}
        <Link href="/app/results"><RotateCcw size={16}/> Bekijk eerdere uitslagen</Link>
        <Link href="/app/play">Nieuwe ronde <ChevronRight size={16}/></Link>
      </footer>
    </main>
  </div>;
}
