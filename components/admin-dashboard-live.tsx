"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, Check, ClipboardCheck, Flag, KeyRound, LayoutGrid, LogOut, Map, Plus, Users, X } from "lucide-react";
import { secureHeaders } from "@/lib/client-security";
import type { Course, EventItem, Player } from "@/lib/types";

type Round = { id: string; display_name: string; course: string; total_strokes: number; to_par: number; completed_at: string };
type View = "dashboard" | "players" | "rounds" | "courses" | "events";

export default function AdminDashboardLive() {
  const [view, setView] = useState<View>("dashboard");
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const responses = await Promise.all([fetch("/api/players"), fetch("/api/rounds"), fetch("/api/courses"), fetch("/api/events")]);
    if (responses.some((response) => !response.ok)) { setNotice("Clubdata kon niet volledig worden geladen."); setLoading(false); return; }
    setPlayers((await responses[0].json()).players); setRounds((await responses[1].json()).rounds); setCourses((await responses[2].json()).courses); setEvents((await responses[3].json()).events); setLoading(false);
  }
  // Loading is intentionally triggered once when this client-only admin workspace mounts.
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  async function createPlayer() {
    const displayName = window.prompt("Naam van de speler"); if (!displayName) return;
    const response = await fetch("/api/players", { method: "POST", headers: secureHeaders(), body: JSON.stringify({ displayName }) }); const data = await response.json();
    if (!response.ok) return setNotice("Spelerscode kon niet worden aangemaakt.");
    setNotice(`Deel eenmalig: code ${data.player.code}, pincode ${data.player.pin}`); await load();
  }

  async function review(id: string, decision: "approved" | "rejected") {
    const reason = decision === "rejected" ? window.prompt("Reden voor afwijzing") : undefined; if (decision === "rejected" && !reason) return;
    const response = await fetch(`/api/rounds/${id}/review`, { method: "POST", headers: secureHeaders(), body: JSON.stringify({ decision, reason }) });
    setNotice(response.ok ? `Ronde ${decision === "approved" ? "goedgekeurd" : "afgewezen"}.` : "Beoordeling is niet opgeslagen."); if (response.ok) await load();
  }

  async function createCourse() {
    const name = window.prompt("Naam van de baan"); if (!name) return;
    const holeCount = Number(window.prompt("Aantal holes: 9 of 18", "9")); if (holeCount !== 9 && holeCount !== 18) return setNotice("Kies 9 of 18 holes.");
    const distancesInput = window.prompt("Afstanden in meters, gescheiden door komma's", Array(holeCount).fill("100").join(",")); if (!distancesInput) return;
    const distances = distancesInput.split(",").map((value) => Number(value.trim()));
    if (distances.length !== holeCount || distances.some((value) => !Number.isInteger(value) || value <= 0)) return setNotice("Vul voor iedere hole een geldige afstand in.");
    const response = await fetch("/api/courses", { method: "POST", headers: secureHeaders(), body: JSON.stringify({ name, description: "", holeCount, teeName: "Club", holes: distances.map((distance) => ({ par: 3, distance })) }) });
    setNotice(response.ok ? `${holeCount}-hole baan aangemaakt.` : "Baan kon niet worden aangemaakt.");
    if (response.ok) await load();
  }

  async function createEvent() {
    const title = window.prompt("Naam van het evenement"); if (!title) return;
    const startsAt = window.prompt("Startdatum en tijd", new Date(Date.now() + 7 * 86400000).toISOString()); if (!startsAt) return;
    const response = await fetch("/api/events", { method: "POST", headers: secureHeaders(), body: JSON.stringify({ title, description: "", startsAt, published: true }) });
    setNotice(response.ok ? "Evenement gepubliceerd." : "Evenement kon niet worden aangemaakt."); if (response.ok) await load();
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST", headers: secureHeaders(false) }); window.location.href = "/admin/login"; }
  const nav = [{ id: "dashboard", label: "Dashboard", icon: LayoutGrid }, { id: "players", label: "Spelers & codes", icon: Users }, { id: "rounds", label: "Rondebeoordeling", icon: ClipboardCheck }, { id: "courses", label: "Banen", icon: Map }, { id: "events", label: "Evenementen", icon: CalendarDays }] as const;

  return <div className="admin-shell"><aside className="admin-sidebar"><div className="brand"><span className="brand-mark"><Flag size={18}/></span><span>FAIRWAY<span className="brand-dot">.</span><small>Clubbeheer</small></span></div><nav>{nav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><item.icon size={17}/>{item.label}{item.id === "rounds" && rounds.length > 0 && <em>{rounds.length}</em>}</button>)}</nav><div className="admin-side-bottom"><Link href="/app">Naar spelersapp</Link><button onClick={logout}><LogOut size={16}/> Uitloggen</button></div></aside><main className="admin-main"><div className="admin-page"><div className="admin-heading"><div><span>Beveiligde clubomgeving</span><h1>{nav.find((item) => item.id === view)?.label}</h1></div>{view === "players" && <button className="admin-primary" onClick={createPlayer}><Plus/> Nieuwe spelerscode</button>}{view === "courses" && <button className="admin-primary" onClick={createCourse}><Plus/> Nieuwe baan</button>}{view === "events" && <button className="admin-primary" onClick={createEvent}><Plus/> Nieuw evenement</button>}</div>{notice && <div className="review-banner"><KeyRound/><div><b>{notice}</b></div></div>}{loading ? <div className="admin-card empty">Clubdata laden…</div> : view === "dashboard" ? <div className="admin-metrics"><Metric label="Actieve spelers" value={players.length}/><Metric label="Rondes ter beoordeling" value={rounds.length}/><Metric label="Actieve banen" value={courses.length}/><Metric label="Aankomende events" value={events.length}/></div> : view === "players" ? <div className="admin-card manage-list">{players.map((player) => <div key={player.id}><span className="avatar">{player.initials}</span><span><b>{player.name}</b><small>{player.code} · {player.rounds} rondes</small></span></div>)}</div> : view === "rounds" ? <div className="admin-card review-list">{rounds.length ? rounds.map((round) => <div className="review-row" key={round.id}><span className="avatar">{round.display_name.split(/\s+/).map((part) => part[0]).join("").slice(0,2)}</span><div><b>{round.display_name}</b><small>{round.course} · {new Date(round.completed_at).toLocaleDateString("nl-NL")}</small></div><div className="review-score"><strong>{round.total_strokes}</strong><span>{round.to_par > 0 ? "+" : ""}{round.to_par}</span></div><button className="reject" onClick={() => review(round.id, "rejected")}><X/></button><button className="approve" onClick={() => review(round.id, "approved")}><Check/></button></div>) : <div className="empty">Geen rondes ter beoordeling.</div>}</div> : view === "courses" ? <div className="admin-course-grid">{courses.map((course) => <article className="admin-card admin-course" key={course.id}><div><h2>{course.name}</h2><p>{course.description}</p><div className="course-facts"><span><b>{course.holes}</b>Holes</span><span><b>{course.totalPar}</b>Par</span><span><b>{course.tee}</b>Tee</span></div></div></article>)}</div> : <div className="admin-card manage-list">{events.map((event) => <div key={event.id}><CalendarDays/><span><b>{event.title}</b><small>{event.date} · {event.registered}/{event.capacity}</small></span></div>)}</div>}</div></main></div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="admin-card metric"><span><LayoutGrid/></span><div><small>{label}</small><strong>{value}</strong></div></div>; }
