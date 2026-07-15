"use client";

import { useEffect, useState } from "react";
import { Minus } from "lucide-react";
import { formatToPar } from "@/lib/score";
import type { LeaderboardEntry, Period } from "@/lib/types";

export function LeaderboardLive({ initial, meId }: { initial: LeaderboardEntry[]; meId: string }) {
  const [period, setPeriod] = useState<Period>("week");
  const [holes, setHoles] = useState<9 | 18>(9);
  const [entries, setEntries] = useState(initial);
  useEffect(() => { let active = true; fetch(`/api/leaderboards?period=${period}&holes=${holes}`).then((response) => response.json()).then((data) => { if (active) setEntries(data.entries || []); }); return () => { active = false; }; }, [period, holes]);
  const mine = entries.find((entry) => entry.id === meId);
  return <div className="page"><div className="page-heading"><div><div className="eyebrow"><span/> clubklassement</div><h1>Wie staat er bovenaan?</h1><p>Beste goedgekeurde ronde ten opzichte van par.</p></div><div className="tabs">{(["day","week","month","year"] as Period[]).map((value) => <button key={value} onClick={() => setPeriod(value)} className={period === value ? "active" : ""}>{{day:"Dag",week:"Week",month:"Maand",year:"Jaar"}[value]}</button>)}</div></div>{mine && <div className="my-position"><strong>#{mine.rank}</strong><span className="avatar">{mine.initials}</span><div><b>Jouw positie</b><p>Beste goedgekeurde ronde</p></div><div className="position-score"><strong>{mine.score}</strong><span>{formatToPar(mine.toPar)} par</span></div></div>}<div className="filters"><select className="select" value={holes} onChange={(event) => setHoles(Number(event.target.value) as 9 | 18)}><option value={9}>9 holes</option><option value={18}>18 holes</option></select></div><div className="card leaderboard-card"><div className="leader-head"><span>Pos.</span><span>Speler</span><span>Baan</span><span>Rondes</span><span>Score</span></div>{entries.map((entry) => <div key={entry.id} className={`leader-row ${entry.id === meId ? "me" : ""}`}><span className={`rank ${entry.rank <= 3 ? "podium" : ""}`}>{entry.rank}</span><div className="leader-person"><span className="avatar">{entry.initials}</span><span><b>{entry.name}</b><small><Minus size={9}/> gelijk</small></span></div><span className="leader-course">{entry.course}</span><span className="leader-rounds">{entry.rounds} rondes</span><span className="leader-score"><strong>{entry.score}</strong><span>{formatToPar(entry.toPar)}</span></span></div>)}{!entries.length && <div className="empty"><p>Nog geen goedgekeurde rondes in deze periode.</p></div>}</div><p className="ranking-note">Alleen door de club goedgekeurde rondes tellen mee.</p></div>;
}
