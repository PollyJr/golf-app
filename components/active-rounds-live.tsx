"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Clock3, Radio, Users, X } from "lucide-react";
import { secureHeaders } from "@/lib/client-security";
import type { ActiveRoundSummary } from "@/lib/types";

export function ActiveRoundsLive({ initialRounds }: { initialRounds: ActiveRoundSummary[] }) {
  const [rounds, setRounds] = useState(initialRounds);
  const [answering, setAnswering] = useState("");
  const etag = useRef("");

  const refresh = useCallback(async (force = false) => {
    try {
      const response = await fetch("/api/rounds/active", {
        cache: "no-store", headers: !force && etag.current ? { "if-none-match": etag.current } : undefined,
      });
      if (response.status === 304 || !response.ok) return;
      const data = await response.json();
      etag.current = response.headers.get("etag") || "";
      setRounds(data.rounds || []);
    } catch { /* Keep the last safe snapshot visible. */ }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function respond(roundId: string, decision: "accept" | "decline") {
    setAnswering(roundId);
    try {
      const response = await fetch(`/api/rounds/${roundId}/respond`, {
        method: "POST", headers: secureHeaders(), body: JSON.stringify({ decision }),
      });
      if (response.ok) { etag.current = ""; await refresh(true); }
    } finally { setAnswering(""); }
  }

  if (!rounds.length) return null;
  return <section className="active-rounds-section">
    <div className="section-heading"><div><span className="live-kicker"><Radio size={13}/> samen spelen</span><h2>Rondes & uitnodigingen</h2></div><span>{rounds.length} {rounds.length === 1 ? "potje" : "potjes"}</span></div>
    <div className="active-round-grid">{rounds.map((round) => {
      const progress = round.totalScores ? Math.round(round.completedScores / round.totalScores * 100) : 0;
      const card = <>
        <div className="active-round-top"><span className={round.status === "active" ? "live-dot" : "invite-dot"}>{round.status === "active" ? "LIVE" : "WACHTEN"}</span><span>{round.holeCount} holes</span></div>
        <h3>{round.courseName}</h3><p>{round.myInvitationStatus === "pending" ? `${round.starterName} nodigt je uit` : `Gestart door ${round.starterName}`}</p>
        <div className="round-avatar-stack">{round.participantInitials.map((initials, index) => <span className="avatar" key={`${initials}-${index}`}>{initials}</span>)}<small><Users size={12}/>{round.participantNames.length} spelers</small></div>
        <div className="active-progress"><span style={{ width: `${progress}%` }}/></div>
      </>;
      if (round.myInvitationStatus === "pending") return <article className="card active-round-card invite-round-card" key={round.id}>{card}<footer><span><Clock3 size={12}/>{round.pendingInvitations} open</span><div className="dashboard-invite-actions"><button aria-label={`Uitnodiging voor ${round.courseName} afwijzen`} onClick={() => respond(round.id, "decline")} disabled={answering === round.id}><X size={14}/> Afwijzen</button><button aria-label={`Uitnodiging voor ${round.courseName} accepteren`} onClick={() => respond(round.id, "accept")} disabled={answering === round.id}><Check size={14}/> Accepteren</button></div></footer></article>;
      return <Link className="card active-round-card" href={`/app/play?round=${round.id}`} key={round.id}>{card}<footer><span>{round.status === "active" ? `${round.completedScores}/${round.totalScores} scores · ${progress}%` : `${round.pendingInvitations} uitnodiging${round.pendingInvitations === 1 ? "" : "en"} open`}</span><strong>{round.status === "active" ? "Verder spelen" : "Bekijk status"} <ChevronRight size={14}/></strong></footer></Link>;
    })}</div>
  </section>;
}
