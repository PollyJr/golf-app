"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Radio, Wifi, WifiOff } from "lucide-react";
import type { PublicRoundSnapshot } from "@/lib/types";

export function PublicRoundLive({ token, initialRound }: { token: string; initialRound: PublicRoundSnapshot }) {
  const [round, setRound] = useState(initialRound);
  const [activeHole, setActiveHole] = useState(0);
  const [connected, setConnected] = useState(true);
  const [expired, setExpired] = useState(false);
  const etag = useRef("");
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const response = await fetch(`/api/live/${token}`, { cache: "no-store", headers: etag.current ? { "if-none-match": etag.current } : undefined });
        if (!active) return;
        if (response.status === 304) { setConnected(true); return; }
        if (response.status === 404) { setExpired(true); return; }
        if (!response.ok) throw new Error("LIVE_REFRESH_FAILED");
        const data = await response.json(); etag.current = response.headers.get("etag") || "";
        setRound(data.round); setConnected(true);
      } catch { if (active) setConnected(false); }
    }
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token]);
  if (expired) return <main className="public-live-expired"><span><Eye size={25}/></span><h1>Deze live link is verlopen.</h1><p>Vraag de starter van de ronde om een nieuwe link.</p></main>;
  const hole = round.course.layout[activeHole];
  const progress = round.totalScores ? Math.round(round.completedScores / round.totalScores * 100) : 0;
  return <div className="public-live-page"><header className="public-live-brand"><strong>FAIRWAY<span>.</span></strong><div><Eye size={16}/> Alleen live meekijken</div></header><section className="public-live-title"><div><span className="public-live-kicker"><Radio size={13}/> {round.status === "active" ? "live ronde" : "eindscore"}</span><h1>{round.course.name}</h1><p>{round.clubName} · {round.course.holes} holes · par {round.course.totalPar}</p></div><span className={`connection-badge ${connected ? "online" : "offline"}`}>{connected ? <Wifi size={13}/> : <WifiOff size={13}/>} {connected ? "Live verbonden" : "Verbinding verbroken"}</span></section><div className="public-live-grid"><main><div className="hole-progress public-hole-progress">{round.course.layout.map((item, index) => <button aria-label={`Bekijk hole ${item.number}`} key={item.number} onClick={() => setActiveHole(index)} className={`${index === activeHole ? "active" : ""} ${round.participants.every((participant) => participant.scores[index] !== null) ? "done" : ""}`}>{item.number}</button>)}</div><section className="hole-hero public-hole-hero"><div><span>HOLE</span><strong>{hole.number}</strong></div><div className="hole-info"><span><small>PAR</small><b>{hole.par}</b></span><i/><span><small>AFSTAND</small><b>{hole.distance} m</b></span></div></section><div className="public-player-list">{round.participants.map((participant) => { const value = participant.scores[activeHole]; return <article className="card public-player" key={participant.position}><div className="score-person"><span className="avatar">{participant.initials}</span><div><b>{participant.name}</b><small>Totaal {participant.scores.some((score) => score !== null) ? participant.totalStrokes : "—"}</small></div></div><strong className={value !== null ? value < hole.par ? "under" : value === hole.par ? "even" : "over" : ""}>{value ?? "·"}</strong><span>{value === null ? "Nog niet ingevuld" : value === hole.par ? "Par" : value < hole.par ? `${hole.par - value} onder par` : `${value - hole.par} boven par`}</span></article>; })}</div><nav className="public-hole-nav"><button disabled={activeHole === 0} onClick={() => setActiveHole((current) => current - 1)}><ChevronLeft/> Vorige</button><span>{activeHole + 1}/{round.course.holes}</span><button disabled={activeHole === round.course.holes - 1} onClick={() => setActiveHole((current) => current + 1)}>Volgende <ChevronRight/></button></nav></main><aside className="card public-live-summary"><span className="public-live-kicker"><Radio size={12}/> flightstatus</span><div className="public-progress-number"><strong>{progress}%</strong><small>{round.completedScores} van {round.totalScores} scores</small></div><div className="round-progress"><span style={{ width: `${progress}%` }}/></div>{round.participants.map((participant) => <div className="public-summary-player" key={participant.position}><span className="avatar">{participant.initials}</span><span><b>{participant.name}</b><small>{participant.scores.filter((score) => score !== null).length}/{round.course.holes} holes</small></span><strong>{participant.scores.some((score) => score !== null) ? participant.totalStrokes : "—"}</strong></div>)}<p>Deze pagina is alleen-lezen. Updates verschijnen automatisch binnen twee seconden.</p></aside></div></div>;
}
