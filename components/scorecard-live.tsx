"use client";

import { useMemo, useState } from "react";
import { Check, Minus, Plus, Save } from "lucide-react";
import { secureHeaders } from "@/lib/client-security";
import { formatToPar } from "@/lib/score";
import type { Course, Player } from "@/lib/types";

export function ScorecardLive({ courses, players, me }: { courses: Course[]; players: Player[]; me: Player }) {
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [playerIds, setPlayerIds] = useState([me.id]);
  const [scores, setScores] = useState<Record<string, number[]>>({});
  const [stage, setStage] = useState<"setup" | "score" | "submitted">("setup");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const course = courses.find((item) => item.id === courseId);
  const selected = playerIds.map((id) => players.find((player) => player.id === id) || me);

  function start() {
    if (!course) return;
    setScores(Object.fromEntries(selected.map((player) => [player.id, course.layout.map((hole) => hole.par)])));
    setStage("score");
  }
  function change(playerId: string, hole: number, delta: number) { setScores((current) => ({ ...current, [playerId]: current[playerId].map((value, index) => index === hole ? Math.max(1, Math.min(12, value + delta)) : value) })); }
  const totals = useMemo(() => Object.fromEntries(Object.entries(scores).map(([id, values]) => [id, values.reduce((sum, value) => sum + value, 0)])), [scores]);

  async function submit() {
    if (!course) return;
    setSaving(true); setError("");
    const response = await fetch("/api/rounds", { method: "POST", headers: secureHeaders(), body: JSON.stringify({ clientId: crypto.randomUUID(), courseId: course.id, participants: selected.map((player) => ({ playerId: player.id, name: player.name, guest: false, scores: scores[player.id] })) }) });
    if (response.ok) setStage("submitted"); else setError("De scorekaart kon niet veilig worden opgeslagen. Controleer de invoer en probeer opnieuw.");
    setSaving(false);
  }

  if (!courses.length) return <div className="page"><div className="card empty"><h2>Nog geen baan ingericht</h2><p>Vraag de clubbeheerder eerst een 9- of 18-hole baan te configureren.</p></div></div>;
  if (stage === "submitted") return <div className="page"><div className="submitted card"><span className="submitted-icon"><Check size={34}/></span><h1>Goed gespeeld!</h1><p>Je scorekaart staat veilig klaar voor beoordeling door de club.</p><button className="primary-button" onClick={() => setStage("setup")}>Nieuwe ronde</button></div></div>;
  if (stage === "setup") return <div className="page"><div className="page-heading"><div><div className="eyebrow"><span/> nieuwe scorekaart</div><h1>Stel je ronde samen.</h1><p>Kies een 9- of 18-hole baan en maximaal vier geregistreerde spelers.</p></div></div><div className="setup-grid"><section><h2>1. Kies je baan</h2><div className="course-options">{courses.map((item) => <button key={item.id} onClick={() => setCourseId(item.id)} className={`card course-option ${courseId === item.id ? "selected" : ""}`}><span className="course-orb" style={{ background: item.accent }}>{item.holes}</span><span><b>{item.name}</b><small>{item.holes} holes · par {item.totalPar} · tee {item.tee}</small></span>{courseId === item.id && <Check/>}</button>)}</div></section><section><h2>2. Wie speelt er?</h2><div className="player-options">{players.map((player) => { const chosen = playerIds.includes(player.id); return <button key={player.id} className={`card add-player ${chosen ? "selected-player" : ""}`} onClick={() => setPlayerIds((current) => chosen ? (player.id === me.id ? current : current.filter((id) => id !== player.id)) : current.length < 4 ? [...current, player.id] : current)}><span className="avatar">{player.initials}</span><span><b>{player.name}</b><small>{player.id === me.id ? "Jij" : player.code}</small></span>{chosen ? <Check/> : <Plus/>}</button>; })}</div></section></div><button className="primary-button setup-start" onClick={start}>Start scorekaart</button></div>;
  return <div className="page"><div className="page-heading"><div><div className="eyebrow"><span/> scorekaart</div><h1>{course?.name}</h1><p>{course?.holes} holes · par {course?.totalPar}</p></div><button className="primary-button" onClick={submit} disabled={saving}><Save/> {saving ? "Opslaan…" : "Ronde indienen"}</button></div>{error && <p className="login-error">{error}</p>}<div className="score-table card"><div className="score-tr score-head"><span>Hole</span><span>Par</span><span>Afstand</span>{selected.map((player) => <span key={player.id}>{player.initials}</span>)}</div>{course?.layout.map((hole, index) => <div className="score-tr" key={hole.number}><strong>{hole.number}</strong><span>{hole.par}</span><span>{hole.distance}m</span>{selected.map((player) => <div className="score-control" key={player.id}><button onClick={() => change(player.id, index, -1)}><Minus/></button><b>{scores[player.id]?.[index]}</b><button onClick={() => change(player.id, index, 1)}><Plus/></button></div>)}</div>)}<div className="score-tr score-total"><strong>Totaal</strong><span>{course?.totalPar}</span><span/>{selected.map((player) => <span key={player.id}><b>{totals[player.id]}</b><small>{formatToPar((totals[player.id] || 0) - (course?.totalPar || 0))}</small></span>)}</div></div></div>;
}
