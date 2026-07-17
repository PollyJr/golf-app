"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronRight, Copy, Link2, Minus, Plus, Save, Share2, Trash2, UserPlus, Wifi, WifiOff, X } from "lucide-react";
import { secureHeaders } from "@/lib/client-security";
import type { Course, LiveRoundSnapshot, Player } from "@/lib/types";

type ScoreIntent = { participantId: string; holeNumber: number; strokes: number };

function withOptimisticScore(round: LiveRoundSnapshot, participantId: string, holeIndex: number, strokes: number) {
  const participants = round.participants.map((participant) => {
    if (participant.id !== participantId) return participant;
    const scores = participant.scores.map((score, index) => index === holeIndex ? strokes : score);
    return { ...participant, scores, totalStrokes: scores.reduce<number>((sum, score) => sum + (score ?? 0), 0) };
  });
  return { ...round, participants, completedScores: participants.reduce((sum, participant) => sum + participant.scores.filter((score) => score !== null).length, 0) };
}

export function ScorecardLive({ courses, players, me, initialRound = null }: { courses: Course[]; players: Player[]; me: Player; initialRound?: LiveRoundSnapshot | null }) {
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [playerIds, setPlayerIds] = useState([me.id]);
  const [round, setRound] = useState<LiveRoundSnapshot | null>(initialRound);
  const [activeHole, setActiveHole] = useState(0);
  const [connected, setConnected] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [addPlayerId, setAddPlayerId] = useState("");
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  const roundRef = useRef(round);
  const etagRef = useRef("");
  const desiredScores = useRef(new Map<string, ScoreIntent>());
  const processingScores = useRef(new Set<string>());

  useEffect(() => { roundRef.current = round; }, [round]);
  const refreshRound = useCallback(async (force = false) => {
    const current = roundRef.current;
    if (!current) return;
    try {
      const response = await fetch(`/api/rounds/${current.id}`, { cache: "no-store", headers: !force && etagRef.current ? { "if-none-match": etagRef.current } : undefined });
      if (response.status === 304) { setConnected(true); return; }
      if (!response.ok) throw new Error("ROUND_REFRESH_FAILED");
      const data = await response.json();
      etagRef.current = response.headers.get("etag") || "";
      setRound(data.round); setConnected(true); setError("");
    } catch { setConnected(false); }
  }, []);

  useEffect(() => {
    if (!round?.id || round.status !== "active") return;
    const timer = window.setInterval(() => void refreshRound(), 2000);
    const online = () => void refreshRound(true);
    window.addEventListener("online", online);
    return () => { window.clearInterval(timer); window.removeEventListener("online", online); };
  }, [round?.id, round?.status, refreshRound]);

  const course = round?.course || courses.find((item) => item.id === courseId);
  const availablePlayers = players.filter((player) => !round?.participants.some((participant) => participant.playerId === player.id));
  const isComplete = Boolean(round && round.completedScores === round.totalScores && round.totalScores > 0);
  const progress = round?.totalScores ? Math.round((round.completedScores / round.totalScores) * 100) : 0;

  async function startRound() {
    if (!course || saving) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/rounds", { method: "POST", headers: secureHeaders(), body: JSON.stringify({ clientId: crypto.randomUUID(), courseId: course.id, playerIds }) });
      const data = await response.json();
      if (!response.ok || !data.round) throw new Error(data.code || "ROUND_CREATE_FAILED");
      setRound(data.round); roundRef.current = data.round;
      const firstIncomplete = data.round.course.layout.findIndex((_: unknown, index: number) => data.round.participants.some((participant: LiveRoundSnapshot["participants"][number]) => participant.scores[index] === null));
      setActiveHole(Math.max(0, firstIncomplete));
      window.history.replaceState(null, "", `/app/play?round=${data.round.id}`);
    } catch { setError("De ronde kon niet veilig worden gestart. Probeer het opnieuw."); }
    finally { setSaving(false); }
  }

  async function flushScore(key: string) {
    if (processingScores.current.has(key)) return;
    processingScores.current.add(key);
    setSavingCells((current) => new Set(current).add(key));
    try {
      while (desiredScores.current.has(key)) {
        const intent = desiredScores.current.get(key)!; desiredScores.current.delete(key);
        const currentRound = roundRef.current; if (!currentRound) return;
        const response = await fetch(`/api/rounds/${currentRound.id}/scores`, { method: "PATCH", headers: secureHeaders(), body: JSON.stringify(intent) });
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
    const current = roundRef.current; const hole = current?.course.layout[holeIndex];
    if (!current || !hole || current.status !== "active" || !connected) return;
    const participant = current.participants.find((entry) => entry.id === participantId); if (!participant) return;
    const existing = participant.scores[holeIndex];
    const next = existing === null ? Math.max(1, hole.par + (delta < 0 ? -1 : 0)) : Math.max(1, Math.min(12, existing + delta));
    const optimistic = withOptimisticScore(current, participantId, holeIndex, next);
    roundRef.current = optimistic; setRound(optimistic);
    const key = `${participantId}:${hole.number}`;
    desiredScores.current.set(key, { participantId, holeNumber: hole.number, strokes: next });
    void flushScore(key);
  }

  async function manageParticipant(action: "add" | "remove", playerId: string) {
    if (!round || saving) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/rounds/${round.id}/participants`, { method: "PATCH", headers: secureHeaders(), body: JSON.stringify({ action, playerId }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.code || "PARTICIPANT_FAILED");
      setAddPlayerId(""); await refreshRound(true);
    } catch { setError(action === "add" ? "Deze speler kon niet worden toegevoegd." : "Deze speler kon niet worden verwijderd."); }
    finally { setSaving(false); }
  }

  async function shareRound() {
    if (!round || saving) return;
    setSaving(true); setShareMessage("");
    try {
      const response = await fetch(`/api/rounds/${round.id}/share`, { method: "POST", headers: secureHeaders(false) });
      const data = await response.json(); if (!response.ok || !data.url) throw new Error("SHARE_FAILED");
      try {
        if (navigator.share) await navigator.share({ title: `Live scorekaart ${round.course.name}`, text: "Volg deze ronde live via Fairway.", url: data.url });
        else { await navigator.clipboard.writeText(data.url); setShareMessage("De live link is gekopieerd."); }
      } catch { await navigator.clipboard.writeText(data.url); setShareMessage("De live link is gekopieerd."); }
    } catch { setError("Er kon geen veilige deellink worden gemaakt."); }
    finally { setSaving(false); }
  }

  async function revokeShares() {
    if (!round || saving) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/rounds/${round.id}/share`, { method: "DELETE", headers: secureHeaders(false) });
      if (!response.ok) throw new Error("REVOKE_FAILED"); setShareMessage("Alle openbare links zijn ingetrokken.");
    } catch { setError("De openbare links konden niet worden ingetrokken."); }
    finally { setSaving(false); }
  }

  async function submitRound() {
    if (!round || !isComplete || saving) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/rounds/${round.id}/submit`, { method: "POST", headers: secureHeaders(false) });
      const data = await response.json(); if (!response.ok) throw new Error(data.code || "SUBMIT_FAILED");
      const pending = { ...round, status: "pending" as const, completedAt: new Date().toISOString() };
      roundRef.current = pending; setRound(pending);
    } catch { setError("De ronde is nog niet volledig of kon niet worden ingediend."); }
    finally { setSaving(false); }
  }

  if (!courses.length && !round) return <div className="page"><div className="card empty"><h2>Nog geen baan ingericht</h2><p>Vraag de clubbeheerder eerst een 9- of 18-hole baan te configureren.</p></div></div>;

  if (!round) return <div className="page"><div className="page-heading"><div><div className="eyebrow"><span/> nieuwe scorekaart</div><h1>Stel je ronde samen.</h1><p>Kies een 9- of 18-hole baan en maximaal vier geregistreerde spelers.</p></div></div>{error && <p className="login-error">{error}</p>}<div className="setup-grid"><section><div className="section-heading"><h2>1. Kies je baan</h2></div><div className="course-options">{courses.map((item) => <button key={item.id} onClick={() => setCourseId(item.id)} className={`card course-option ${courseId === item.id ? "selected" : ""}`}><span className="course-orb" style={{ background: item.accent }}>{item.holes}</span><span><b>{item.name}</b><small>{item.holes} holes · par {item.totalPar} · tee {item.tee}</small></span>{courseId === item.id && <Check size={18}/>}</button>)}</div></section><section><div className="section-heading"><h2>2. Wie speelt er?</h2><span className="badge">{playerIds.length}/4 spelers</span></div><div className="player-options">{players.map((player) => { const chosen = playerIds.includes(player.id); return <button key={player.id} className={`card add-player ${chosen ? "selected-player" : ""}`} onClick={() => setPlayerIds((current) => chosen ? (player.id === me.id ? current : current.filter((id) => id !== player.id)) : current.length < 4 ? [...current, player.id] : current)}><span className="avatar">{player.initials}</span><span><b>{player.name}</b><small>{player.id === me.id ? "Jij · starter" : player.code}</small></span>{chosen ? <Check size={17}/> : <Plus size={17}/>}</button>; })}</div></section></div><button className="start-round" onClick={startRound} disabled={saving}>{saving ? "Ronde starten…" : `Start ronde op ${course?.name}`}<ChevronRight size={18}/></button></div>;

  if (round.status !== "active") return <div className="page"><div className="submitted card"><span className="submitted-icon"><Check size={34}/></span><div className="eyebrow"><span/> ronde ingediend</div><h1>Goed gespeeld!</h1><p>De scorekaart is vergrendeld en wacht op goedkeuring van de club. Openbare links verlopen 24 uur na het indienen.</p><div className="submitted-score"><small>Voortgang</small><strong>{round.course.holes}/{round.course.holes}</strong><span>compleet</span></div>{round.isStarter && <button className="secondary-button share-revoke" onClick={revokeShares} disabled={saving}><X size={16}/> Openbare links intrekken</button>}<Link className="primary-button submitted-home" href="/app">Terug naar overzicht</Link></div></div>;

  const hole = round.course.layout[activeHole];
  return <div className="live-score-page">
    <header className="score-header live-score-header"><Link href="/app" aria-label="Terug naar overzicht"><ArrowLeft/></Link><div><small>{round.course.name} · {round.course.tee}</small><b>Hole {hole.number} <span>van {round.course.holes}</span></b></div><span className={`connection-badge ${connected ? "online" : "offline"}`}>{connected ? <Wifi size={13}/> : <WifiOff size={13}/>} {connected ? "Live verbonden" : "Offline · alleen bekijken"}</span>{round.isStarter && <button className="header-share" onClick={shareRound} disabled={!connected || saving}><Share2 size={16}/> Delen</button>}</header>
    <div className="hole-progress">{round.course.layout.map((item, index) => <button aria-label={`Hole ${item.number}`} key={item.number} onClick={() => setActiveHole(index)} className={`${index === activeHole ? "active" : ""} ${round.participants.every((participant) => participant.scores[index] !== null) ? "done" : ""}`}>{item.number}</button>)}</div>
    <div className="live-score-layout"><main className="score-main"><section className="hole-hero"><div><span>HOLE</span><strong>{hole.number}</strong></div><div className="hole-info"><span><small>PAR</small><b>{hole.par}</b></span><i/><span><small>AFSTAND</small><b>{hole.distance} m</b></span></div></section>{error && <p className="score-error">{error}</p>}<div className="score-players">{round.participants.map((participant) => { const value = participant.scores[activeHole]; const key = `${participant.id}:${hole.number}`; const played = participant.scores.filter((score) => score !== null).length; return <article className="card score-player" key={participant.id}><div className="score-person"><span className="avatar">{participant.initials}</span><div><b>{participant.name}{participant.playerId === me.id && <em>Jij</em>}</b><small>{played}/{round.course.holes} holes · totaal {played ? participant.totalStrokes : "—"}</small></div></div><div className="stepper"><button aria-label={`Verlaag score van ${participant.name}`} disabled={!connected || savingCells.has(key)} onClick={() => changeScore(participant.id, activeHole, -1)}><Minus/></button><strong className={value !== null ? value < hole.par ? "under" : value === hole.par ? "even" : "over" : ""}>{value ?? "·"}</strong><button aria-label={`Verhoog score van ${participant.name}`} disabled={!connected || savingCells.has(key)} onClick={() => changeScore(participant.id, activeHole, 1)}><Plus/></button></div><div className="score-label">{savingCells.has(key) ? "Synchroniseren…" : value === null ? "Nog geen score" : value === 1 ? "Hole-in-one!" : value === hole.par ? "Par" : value < hole.par ? `${hole.par - value} onder par` : `${value - hole.par} boven par`}</div></article>; })}</div></main>
      <aside className="round-panel card"><div className="round-panel-head"><div><span>LIVE RONDE</span><h2>Flightoverzicht</h2></div><strong>{progress}%</strong></div><div className="round-progress"><span style={{ width: `${progress}%` }}/></div><div className="flight-list">{round.participants.map((participant) => <div key={participant.id}><span className="avatar">{participant.initials}</span><span><b>{participant.name}</b><small>{participant.scores.filter((score) => score !== null).length}/{round.course.holes} ingevuld</small></span><strong>{participant.scores.some((score) => score !== null) ? participant.totalStrokes : "—"}</strong>{round.isStarter && participant.playerId !== me.id && <button aria-label={`Verwijder ${participant.name}`} onClick={() => manageParticipant("remove", participant.playerId)} disabled={saving}><Trash2 size={14}/></button>}</div>)}</div>{round.isStarter && availablePlayers.length > 0 && round.participants.length < 4 && <div className="flight-add"><label htmlFor="flight-player">Speler toevoegen</label><div><select id="flight-player" value={addPlayerId} onChange={(event) => setAddPlayerId(event.target.value)}><option value="">Kies een speler</option>{availablePlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select><button onClick={() => addPlayerId && manageParticipant("add", addPlayerId)} disabled={!addPlayerId || saving}><UserPlus size={15}/></button></div></div>}<div className="round-panel-actions">{round.isStarter && <><button onClick={shareRound} disabled={!connected || saving}><Link2 size={15}/> Nieuwe live link</button><button onClick={revokeShares} disabled={saving}><X size={15}/> Links intrekken</button></>}<small>{round.isStarter ? "Alleen jij kunt de flight beheren en indienen." : `Gestart door ${round.participants.find((participant) => participant.playerId === round.starterPlayerId)?.name || "de starter"}.`}</small>{shareMessage && <p><Copy size={13}/>{shareMessage}</p>}</div></aside>
    </div>
    <footer className="score-footer"><button disabled={activeHole === 0} onClick={() => setActiveHole((current) => current - 1)}><ArrowLeft/> Vorige</button><div><span>{activeHole + 1}/{round.course.holes}</span></div>{activeHole < round.course.holes - 1 ? <button className="next" onClick={() => setActiveHole((current) => current + 1)}>Volgende <ChevronRight/></button> : round.isStarter ? <button className="next" disabled={!isComplete || !connected || saving} onClick={submitRound}><Save/> {isComplete ? "Ronde indienen" : "Nog niet compleet"}</button> : <span className="waiting-starter">Wachten op starter</span>}</footer>
  </div>;
}
