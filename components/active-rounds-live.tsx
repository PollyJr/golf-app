"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Radio, Users } from "lucide-react";
import type { ActiveRoundSummary } from "@/lib/types";

export function ActiveRoundsLive({ initialRounds }: { initialRounds: ActiveRoundSummary[] }) {
  const [rounds, setRounds] = useState(initialRounds);
  const etag = useRef("");
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const response = await fetch("/api/rounds/active", { cache: "no-store", headers: etag.current ? { "if-none-match": etag.current } : undefined });
        if (!active || response.status === 304 || !response.ok) return;
        const data = await response.json(); etag.current = response.headers.get("etag") || ""; setRounds(data.rounds || []);
      } catch { /* Keep the last safe snapshot visible. */ }
    }
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  if (!rounds.length) return null;
  return <section className="active-rounds-section"><div className="section-heading"><div><span className="live-kicker"><Radio size={13}/> live</span><h2>Actieve rondes</h2></div><span>{rounds.length} {rounds.length === 1 ? "potje" : "potjes"}</span></div><div className="active-round-grid">{rounds.map((round) => { const progress = round.totalScores ? Math.round(round.completedScores / round.totalScores * 100) : 0; return <Link className="card active-round-card" href={`/app/play?round=${round.id}`} key={round.id}><div className="active-round-top"><span className="live-dot">LIVE</span><span>{round.holeCount} holes</span></div><h3>{round.courseName}</h3><p>Gestart door {round.starterName}</p><div className="round-avatar-stack">{round.participantInitials.map((initials, index) => <span className="avatar" key={`${initials}-${index}`}>{initials}</span>)}<small><Users size={12}/>{round.participantNames.length} spelers</small></div><div className="active-progress"><span style={{ width: `${progress}%` }}/></div><footer><span>{round.completedScores}/{round.totalScores} scores · {progress}%</span><strong>Verder spelen <ChevronRight size={14}/></strong></footer></Link>; })}</div></section>;
}
