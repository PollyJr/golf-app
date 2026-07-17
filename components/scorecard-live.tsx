"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Check, ChevronRight, Clock3, Copy, Link2, Minus, Plus, Save,
  Search, Share2, Trash2, Wifi, WifiOff, X,
} from "lucide-react";
import { secureHeaders } from "@/lib/client-security";
import { RoundResultView } from "@/components/round-result-view";
import type { Course, LiveRoundSnapshot, Player } from "@/lib/types";

type ScoreIntent = { participantId: string; holeNumber: number; strokes: number };

function withOptimisticScore(round: LiveRoundSnapshot, participantId: string, holeIndex: number, strokes: number) {
  const participants = round.participants.map((participant) => {
    if (participant.id !== participantId) return participant;
    const scores = participant.scores.map((score, index) => index === holeIndex ? strokes : score);
    return { ...participant, scores, totalStrokes: scores.reduce<number>((sum, score) => sum + (score ?? 0), 0) };
  });
  return {
    ...round,
    participants,
    completedScores: participants.reduce((sum, participant) => sum + participant.scores.filter((score) => score !== null).length, 0),
  };
}

export function ScorecardLive({ courses, me, initialRound = null }: {
  courses: Course[];
  me: Player;
  initialRound?: LiveRoundSnapshot | null;
}) {
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([me]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [searching, setSearching] = useState(false);
  const [round, setRound] = useState<LiveRoundSnapshot | null>(initialRound);
  const [activeHole, setActiveHole] = useState(0);
  const [connected, setConnected] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  const roundRef = useRef(round);
  const etagRef = useRef("");
  const desiredScores = useRef(new Map<string, ScoreIntent>());
  const processingScores = useRef(new Set<string>());

  useEffect(() => { roundRef.current = round; }, [round]);

  useEffect(() => {
    if (round || playerSearch.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/players/search?q=${encodeURIComponent(playerSearch.trim())}`, {
          cache: "no-store", signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok) setSearchResults(data.players || []);
      } catch { if (!controller.signal.aborted) setSearchResults([]); }
      finally { if (!controller.signal.aborted) setSearching(false); }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [playerSearch, round]);

  const refreshRound = useCallback(async (force = false) => {
    const current = roundRef.current;
    if (!current) return;
    try {
      const response = await fetch(`/api/rounds/${current.id}`, {
        cache: "no-store",
        headers: !force && etagRef.current ? { "if-none-match": etagRef.current } : undefined,
      });
      if (response.status === 304) { setConnected(true); return; }
      if (!response.ok) throw new Error("ROUND_REFRESH_FAILED");
      const data = await response.json();
      etagRef.current = response.headers.get("etag") || "";
      setRound(data.round); setConnected(true); setError("");
    } catch { setConnected(false); }
  }, []);

  useEffect(() => {
    if (!round?.id || !["inviting", "active"].includes(round.status)) return;
    const timer = window.setInterval(() => void refreshRound(), 2000);
    const online = () => void refreshRound(true);
    window.addEventListener("online", online);
    return () => { window.clearInterval(timer); window.removeEventListener("online", online); };
  }, [round?.id, round?.status, refreshRound]);

  const course = round?.course || courses.find((item) => item.id === courseId);
  const isComplete = Boolean(round && round.completedScores === round.totalScores && round.totalScores > 0);
  const progress = round?.totalScores ? Math.round((round.completedScores / round.totalScores) * 100) : 0;

  async function startRound() {
    if (!course || saving) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/rounds", {
        method: "POST", headers: secureHeaders(),
        body: JSON.stringify({ clientId: crypto.randomUUID(), courseId: course.id, playerIds: selectedPlayers.map((player) => player.id) }),
      });
      const data = await response.json();
      if (!response.ok || !data.round) throw new Error(data.code || "ROUND_CREATE_FAILED");
      setRound(data.round); roundRef.current = data.round;
      window.history.replaceState(null, "", `/app/play?round=${data.round.id}`);
    } catch { setError("De ronde kon niet veilig worden aangemaakt. Probeer het opnieuw."); }
    finally { setSaving(false); }
  }

  async function respondInvitation(decision: "accept" | "decline") {
    if (!round || saving) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/rounds/${round.id}/respond`, {
        method: "POST", headers: secureHeaders(), body: JSON.stringify({ decision }),
      });
      if (!response.ok) throw new Error("INVITATION_FAILED");
      if (decision === "decline") { window.location.assign("/app"); return; }
      await refreshRound(true);
    } catch { setError("Je antwoord kon niet veilig worden opgeslagen."); }
    finally { setSaving(false); }
  }

  async function removeInvitedPlayer(playerId: string) {
    if (!round || saving) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/rounds/${round.id}/participants`, {
        method: "PATCH", headers: secureHeaders(), body: JSON.stringify({ action: "remove", playerId }),
      });
      if (!response.ok) throw new Error("PARTICIPANT_FAILED");
      await refreshRound(true);
    } catch { setError("Deze uitnodiging kon niet worden verwijderd."); }
    finally { setSaving(false); }
  }

  async function flushScore(key: string) {
    if (processingScores.current.has(key)) return;
    processingScores.current.add(key);
    setSavingCells((current) => new Set(current).add(key));
    try {
      while (desiredScores.current.has(key)) {
        const intent = desiredScores.current.get(key)!;
        desiredScores.current.delete(key);
        const currentRound = roundRef.current;
        if (!currentRound) return;
        const response = await fetch(`/api/rounds/${currentRound.id}/scores`, {
          method: "PATCH", headers: secureHeaders(), body: JSON.stringify(intent),
        });
        if (!response.ok) throw new Error("SCORE_SAVE_FAILED");
      }
      setConnected(true); await refreshRound(true);
    } catch {
      desiredScores.current.delete(key); setConnected(false);
      setError("De score is niet gesynchroniseerd. Controleer je verbinding; bewerken is tijdelijk geblokkeerd.");
    } finally {
      processingScores.current.delete(key);
      setSavingCells((current) => { const next = new Set(current); next.delete(key); return next; });
    }
  }

  function changeScore(participantId: string, holeIndex: number, delta: number) {
    const current = roundRef.current;
    const hole = current?.course.layout[holeIndex];
    if (!current || !hole || current.status !== "active" || !connected) return;
    const participant = current.participants.find((entry) => entry.id === participantId);
    if (!participant) return;
    const existing = participant.scores[holeIndex];
    const next = existing === null ? Math.max(1, hole.par + (delta < 0 ? -1 : 0)) : Math.max(1, Math.min(12, existing + delta));
    const optimistic = withOptimisticScore(current, participantId, holeIndex, next);
    roundRef.current = optimistic; setRound(optimistic);
    const key = `${participantId}:${hole.number}`;
    desiredScores.current.set(key, { participantId, holeNumber: hole.number, strokes: next });
    void flushScore(key);
  }

  async function shareRound() {
    if (!round || saving) return;
    setSaving(true); setShareMessage(""); setError("");
    try {
      const response = await fetch(`/api/rounds/${round.id}/share`, { method: "POST", headers: secureHeaders(false) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error("SHARE_FAILED");
      setShareUrl(data.url);
      try { await navigator.clipboard.writeText(data.url); setShareMessage("De live link is gekopieerd."); }
      catch { setShareMessage("Je live link staat hieronder klaar."); }
    } catch { setError("Er kon geen veilige deellink worden gemaakt."); }
    finally { setSaving(false); }
  }

  async function revokeShares() {
    if (!round || saving) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/rounds/${round.id}/share`, { method: "DELETE", headers: secureHeaders(false) });
      if (!response.ok) throw new Error("REVOKE_FAILED");
      setShareUrl(""); setShareMessage("Alle openbare links zijn ingetrokken.");
    } catch { setError("De openbare links konden niet worden ingetrokken."); }
    finally { setSaving(false); }
  }

  async function submitRound() {
    if (!round || !isComplete || saving) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/rounds/${round.id}/submit`, { method: "POST", headers: secureHeaders(false) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.code || "SUBMIT_FAILED");
      const pending = { ...round, status: "pending" as const, completedAt: new Date().toISOString() };
      roundRef.current = pending; setRound(pending);
    } catch { setError("De ronde is nog niet volledig of kon niet worden ingediend."); }
    finally { setSaving(false); }
  }

  async function cancelRound() {
    if (!round || !round.isStarter || saving) return;
    if (!window.confirm("Weet je zeker dat je deze ronde wilt annuleren? Alle scores, uitnodigingen en openbare links worden verwijderd.")) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/rounds/${round.id}`, { method: "DELETE", headers: secureHeaders(false) });
      if (!response.ok) throw new Error("CANCEL_FAILED");
      window.location.assign("/app");
    } catch { setError("De ronde kon niet veilig worden geannuleerd."); }
    finally { setSaving(false); }
  }

  if (!courses.length && !round) return <div className="page"><div className="card empty"><h2>Nog geen baan ingericht</h2><p>Vraag de clubbeheerder eerst een 9- of 18-hole baan te configureren.</p></div></div>;

  if (!round) {
    const visibleResults = searchResults.filter((player) => !selectedPlayers.some((selected) => selected.id === player.id));
    return <div className="page round-setup-page">
      <div className="page-heading"><div><div className="eyebrow"><span/> nieuwe scorekaart</div><h1>Stel je ronde samen.</h1><p>Zoek clubgenoten op hun unieke gebruikersnaam. Zij moeten eerst accepteren.</p></div></div>
      {error && <p className="login-error">{error}</p>}
      <div className="setup-grid">
        <section><div className="section-heading"><h2>1. Kies je baan</h2></div><div className="course-options">{courses.map((item) => <button key={item.id} onClick={() => setCourseId(item.id)} className={`card course-option ${courseId === item.id ? "selected" : ""}`}><span className="course-orb" style={{ background: item.accent }}>{item.holes}</span><span><b>{item.name}</b><small>{item.holes} holes · par {item.totalPar} · tee {item.tee}</small></span>{courseId === item.id && <Check size={18}/>}</button>)}</div></section>
        <section>
          <div className="section-heading"><h2>2. Nodig je flight uit</h2><span className="badge">{selectedPlayers.length}/4 spelers</span></div>
          <div className="username-search"><Search size={16}/><input aria-label="Zoek op gebruikersnaam" placeholder="Zoek @gebruikersnaam" value={playerSearch} onChange={(event) => { setPlayerSearch(event.target.value.toLowerCase()); setSearchResults([]); setSearching(false); }} autoCapitalize="none" autoCorrect="off" spellCheck={false}/>{searching && <span>Zoeken…</span>}</div>
          {playerSearch.trim().length >= 2 && <div className="player-search-results">{visibleResults.length ? visibleResults.map((player) => <button className="card add-player" key={player.id} disabled={selectedPlayers.length >= 4} onClick={() => { setSelectedPlayers((current) => [...current, player]); setPlayerSearch(""); }}><span className="avatar">{player.initials}</span><span><b>{player.name}</b><small>@{player.username}</small></span><Plus size={17}/></button>) : !searching && <p>Geen speler gevonden met deze gebruikersnaam.</p>}</div>}
          <div className="selected-flight">{selectedPlayers.map((player) => <div className="card selected-player" key={player.id}><span className="avatar">{player.initials}</span><span><b>{player.name}</b><small>{player.id === me.id ? `@${player.username} · jij bent starter` : `@${player.username} · uitnodiging vereist`}</small></span>{player.id === me.id ? <Check size={17}/> : <button aria-label={`Verwijder ${player.name}`} onClick={() => setSelectedPlayers((current) => current.filter((entry) => entry.id !== player.id))}><X size={16}/></button>}</div>)}</div>
        </section>
      </div>
      <button className="start-round" onClick={startRound} disabled={saving}>{saving ? "Uitnodigingen versturen…" : selectedPlayers.length > 1 ? `Uitnodigingen versturen voor ${course?.name}` : `Start ronde op ${course?.name}`}<ChevronRight size={18}/></button>
    </div>;
  }

  if (round.status === "inviting") {
    const mine = round.participants.find((participant) => participant.playerId === me.id);
    const pending = round.participants.filter((participant) => participant.invitationStatus === "pending");
    return <div className="page invitation-page">
      <Link href="/app" className="invitation-back"><ArrowLeft size={16}/> Terug naar overzicht</Link>
      <section className="card invitation-card">
        <span className="invitation-icon"><Clock3 size={25}/></span>
        <div className="eyebrow"><span/> ronde-uitnodiging</div>
        <h1>{round.isStarter ? "Wachten op je flight." : `${round.participants.find((participant) => participant.playerId === round.starterPlayerId)?.name || "Een clubgenoot"} nodigt je uit.`}</h1>
        <p>{round.course.name} · {round.course.holes} holes · tee {round.course.tee}</p>
        {error && <p className="score-error">{error}</p>}
        <div className="invitation-flight">{round.participants.map((participant) => <div key={participant.id}><span className="avatar">{participant.initials}</span><span><b>{participant.name}</b><small>{participant.playerId === round.starterPlayerId ? "Starter" : participant.invitationStatus === "accepted" ? "Geaccepteerd" : "Wacht op antwoord"}</small></span><strong className={participant.invitationStatus}>{participant.invitationStatus === "accepted" ? <><Check size={14}/> Akkoord</> : <><Clock3 size={14}/> Open</>}</strong>{round.isStarter && participant.playerId !== me.id && participant.invitationStatus === "pending" && <button aria-label={`Trek uitnodiging voor ${participant.name} in`} onClick={() => removeInvitedPlayer(participant.playerId)} disabled={saving}><Trash2 size={15}/></button>}</div>)}</div>
        {mine?.invitationStatus === "pending" ? <div className="invitation-actions"><button className="decline" onClick={() => respondInvitation("decline")} disabled={saving}><X size={16}/> Afwijzen</button><button className="accept" onClick={() => respondInvitation("accept")} disabled={saving}><Check size={16}/> Accepteren</button></div> : <p className="invitation-wait"><Clock3 size={14}/>{pending.length} {pending.length === 1 ? "uitnodiging staat" : "uitnodigingen staan"} nog open. Het speelveld start automatisch zodra iedereen akkoord is.</p>}
        {round.isStarter && <button className="invitation-cancel" onClick={cancelRound} disabled={saving}><Trash2 size={15}/> Ronde annuleren</button>}
      </section>
    </div>;
  }

  if (round.status !== "active") return <RoundResultView round={round}/>;

  const hole = round.course.layout[activeHole];
  return <div className="live-score-page">
    <header className="score-header live-score-header"><Link href="/app" aria-label="Terug naar overzicht"><ArrowLeft/></Link><div><small>{round.course.name} · {round.course.tee}</small><b>Hole {hole.number} <span>van {round.course.holes}</span></b></div><span className={`connection-badge ${connected ? "online" : "offline"}`}>{connected ? <Wifi size={13}/> : <WifiOff size={13}/>} {connected ? "Live verbonden" : "Offline · alleen bekijken"}</span>{round.isStarter && <button className="header-share" onClick={shareRound} disabled={!connected || saving}><Share2 size={16}/> Delen</button>}</header>
    <div className="hole-progress">{round.course.layout.map((item, index) => <button aria-label={`Hole ${item.number}`} key={item.number} onClick={() => setActiveHole(index)} className={`${index === activeHole ? "active" : ""} ${round.participants.every((participant) => participant.scores[index] !== null) ? "done" : ""}`}>{item.number}</button>)}</div>
    <div className="live-score-layout"><main className="score-main">
      <section className="hole-hero"><div><span>HOLE</span><strong>{hole.number}</strong></div><div className="hole-info"><span><small>PAR</small><b>{hole.par}</b></span><i/><span><small>AFSTAND</small><b>{hole.distance} m</b></span></div></section>
      {error && <p className="score-error">{error}</p>}
      <div className="score-players">{round.participants.map((participant) => { const value = participant.scores[activeHole]; const key = `${participant.id}:${hole.number}`; const played = participant.scores.filter((score) => score !== null).length; return <article className="card score-player" key={participant.id}><div className="score-person"><span className="avatar">{participant.initials}</span><div><b>{participant.name}{participant.playerId === me.id && <em>Jij</em>}</b><small>{played}/{round.course.holes} holes · totaal {played ? participant.totalStrokes : "—"}</small></div></div><div className="stepper"><button aria-label={`Verlaag score van ${participant.name}`} disabled={!connected || savingCells.has(key)} onClick={() => changeScore(participant.id, activeHole, -1)}><Minus/></button><strong className={value !== null ? value < hole.par ? "under" : value === hole.par ? "even" : "over" : ""}>{value ?? "·"}</strong><button aria-label={`Verhoog score van ${participant.name}`} disabled={!connected || savingCells.has(key)} onClick={() => changeScore(participant.id, activeHole, 1)}><Plus/></button></div><div className="score-label">{savingCells.has(key) ? "Synchroniseren…" : value === null ? "Nog geen score" : value === 1 ? "Hole-in-one!" : value === hole.par ? "Par" : value < hole.par ? `${hole.par - value} onder par` : `${value - hole.par} boven par`}</div></article>; })}</div>
    </main><aside className="round-panel card"><div className="round-panel-head"><div><span>LIVE RONDE</span><h2>Flightoverzicht</h2></div><strong>{progress}%</strong></div><div className="round-progress"><span style={{ width: `${progress}%` }}/></div><div className="flight-list">{round.participants.map((participant) => <div key={participant.id}><span className="avatar">{participant.initials}</span><span><b>{participant.name}</b><small>{participant.scores.filter((score) => score !== null).length}/{round.course.holes} ingevuld</small></span><strong>{participant.scores.some((score) => score !== null) ? participant.totalStrokes : "—"}</strong></div>)}</div><div className="round-panel-actions">{round.isStarter && <><button className="finish-round-action" onClick={submitRound} disabled={!isComplete || !connected || saving}><Save size={15}/> {isComplete ? "Ronde afsluiten" : `Nog ${round.totalScores - round.completedScores} scores nodig`}</button><button onClick={shareRound} disabled={!connected || saving}><Link2 size={15}/> Nieuwe live link</button><button onClick={revokeShares} disabled={saving}><X size={15}/> Links intrekken</button><button className="cancel-round-action" onClick={cancelRound} disabled={saving}><Trash2 size={15}/> Ronde annuleren</button></>}<small>De flight is door alle spelers bevestigd en tijdens de ronde vergrendeld.</small>{shareMessage && <p><Copy size={13}/>{shareMessage}</p>}{shareUrl && <a className="share-open-link" href={shareUrl} target="_blank" rel="noreferrer">Open liveweergave <ChevronRight size={14}/></a>}</div></aside></div>
    <footer className="score-footer"><button disabled={activeHole === 0} onClick={() => setActiveHole((current) => current - 1)}><ArrowLeft/> Vorige</button><div><span>{activeHole + 1}/{round.course.holes}</span></div>{activeHole < round.course.holes - 1 ? <button className="next" onClick={() => setActiveHole((current) => current + 1)}>Volgende <ChevronRight/></button> : round.isStarter ? <button className="next" disabled={!isComplete || !connected || saving} onClick={submitRound}><Save/> {isComplete ? "Ronde afsluiten" : "Nog niet compleet"}</button> : <span className="waiting-starter">Wachten op starter</span>}</footer>
  </div>;
}
