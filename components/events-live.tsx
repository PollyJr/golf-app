"use client";

import { useState } from "react";
import { CalendarCheck, Check, Clock3, MapPin, Users } from "lucide-react";
import { secureHeaders } from "@/lib/client-security";
import type { Course, EventItem } from "@/lib/types";

export function EventsLive({ initialEvents, courses }: { initialEvents: EventItem[]; courses: Course[] }) {
  const [events, setEvents] = useState(initialEvents);
  async function register(event: EventItem) { if (event.joined) return; const response = await fetch(`/api/events/${event.id}/register`, { method: "POST", headers: secureHeaders(false) }); if (response.ok) setEvents((current) => current.map((item) => item.id === event.id ? { ...item, joined: true, registered: item.registered + 1 } : item)); }
  return <div className="page"><div className="page-heading"><div><div className="eyebrow"><span/> clubagenda</div><h1>Samen speelt beter.</h1><p>Wedstrijden, clinics en gezellige rondes bij jouw club.</p></div></div><div className="event-list">{events.map((event,index) => { const course = courses.find((item) => item.id === event.courseId); return <article className="card event-list-card" key={event.id}><div className={`event-list-art art-${index % 3}`}><div className="event-date"><b>{new Date(event.date).getDate()}</b><span>{new Intl.DateTimeFormat("nl",{month:"short"}).format(new Date(event.date))}</span></div></div><div className="event-list-body"><div><h2>{event.title}</h2><p>{event.description}</p><div className="event-meta"><span><Clock3/>{event.time}</span>{course && <span><MapPin/>{course.name}</span>}<span><Users/>{event.registered}/{event.capacity}</span></div></div><button onClick={() => register(event)} className={event.joined ? "joined" : ""}>{event.joined ? <><Check/> Ingeschreven</> : <><CalendarCheck/> Inschrijven</>}</button></div></article>; })}{!events.length && <div className="card empty"><p>Er staan nog geen evenementen gepland.</p></div>}</div></div>;
}
