import "server-only";

import type { ClubSession } from "../auth/session";
import { audit } from "../audit";
import { db, many, maybeOne, one, transaction, type Db } from "../db";
import { conflict, notFound } from "../errors";
import { publish, topics } from "../realtime/hub";
import { notify, notifyClub } from "./notifications";
import { initialsOf } from "@/lib/format";
import type { HoleCount } from "@/lib/golf/scoring";
import { pickText, type Locale, type LocalizedText } from "@/lib/i18n/core";
import type { EventDto, EventKind, EventLeaderboardRow, EventParticipant, EventRegistrationStatus } from "@/lib/types";
import type { EventBody } from "@/lib/validation";

interface EventRow {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  kind: EventKind;
  starts_at: Date;
  ends_at: Date | null;
  registration_closes_at: Date | null;
  location: string | null;
  course_id: string | null;
  course_name: LocalizedText;
  capacity: number | null;
  leaderboard_enabled: boolean;
  published: boolean;
  registered: number;
  waitlisted: number;
  my_status: EventRegistrationStatus | null;
}

const EVENT_SELECT = `
  SELECT e.id, e.title, e.description, e.kind, e.starts_at, e.ends_at, e.registration_closes_at, e.location,
         e.course_id, c.name AS course_name, e.capacity, e.leaderboard_enabled, e.published,
         (SELECT count(*)::int FROM event_registrations er WHERE er.event_id = e.id AND er.status = 'registered') AS registered,
         (SELECT count(*)::int FROM event_registrations er WHERE er.event_id = e.id AND er.status = 'waitlisted') AS waitlisted,
         (SELECT er.status FROM event_registrations er
           WHERE er.event_id = e.id AND er.player_id = $2 AND er.status <> 'cancelled') AS my_status
    FROM events e
    LEFT JOIN courses c ON c.id = e.course_id`;

function toEvent(row: EventRow, locale: Locale): EventDto {
  const closesAt = row.registration_closes_at ?? row.starts_at;
  return {
    id: row.id,
    title: pickText(row.title, locale),
    description: pickText(row.description, locale),
    kind: row.kind,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at?.toISOString() ?? null,
    registrationClosesAt: row.registration_closes_at?.toISOString() ?? null,
    location: row.location,
    courseId: row.course_id,
    courseName: pickText(row.course_name, locale) || null,
    capacity: row.capacity,
    registered: row.registered,
    waitlisted: row.waitlisted,
    leaderboardEnabled: row.leaderboard_enabled,
    published: row.published,
    myStatus: row.my_status,
    registrationOpen: row.published && closesAt.getTime() > Date.now(),
  };
}

export type EventScope = "upcoming" | "past" | "all";

export async function listEvents(
  clubId: string,
  locale: Locale,
  options: { playerId?: string | null; scope?: EventScope; includeDrafts?: boolean; limit?: number } = {},
): Promise<EventDto[]> {
  const scope = options.scope ?? "upcoming";
  const rows = await many<EventRow>(
    `${EVENT_SELECT}
      WHERE e.club_id = $1 AND (e.published OR $3)
        AND CASE $4
              WHEN 'upcoming' THEN COALESCE(e.ends_at, e.starts_at + interval '6 hours') >= now()
              WHEN 'past' THEN COALESCE(e.ends_at, e.starts_at + interval '6 hours') < now()
              ELSE true
            END
      ORDER BY e.starts_at ${scope === "upcoming" ? "ASC" : "DESC"}
      LIMIT $5`,
    [clubId, options.playerId ?? null, options.includeDrafts ?? false, scope, options.limit ?? 100],
  );
  return rows.map((row) => toEvent(row, locale));
}

export async function getEvent(
  clubId: string,
  eventId: string,
  locale: Locale,
  options: { playerId?: string | null; includeDrafts?: boolean } = {},
): Promise<EventDto | null> {
  const row = await maybeOne<EventRow>(
    `${EVENT_SELECT} WHERE e.club_id = $1 AND e.id = $3 AND (e.published OR $4)`,
    [clubId, options.playerId ?? null, eventId, options.includeDrafts ?? false],
  );
  return row ? toEvent(row, locale) : null;
}

/** Events with a leaderboard that take place today: a round can count for them. */
export async function listPlayableEvents(clubId: string, locale: Locale): Promise<Array<{ id: string; title: string; courseId: string | null }>> {
  const rows = await many<{ id: string; title: LocalizedText; course_id: string | null }>(
    `SELECT e.id, e.title, e.course_id
       FROM events e JOIN clubs club ON club.id = e.club_id
      WHERE e.club_id = $1 AND e.published AND e.leaderboard_enabled
        AND (e.starts_at AT TIME ZONE club.timezone)::date <= (now() AT TIME ZONE club.timezone)::date
        AND (COALESCE(e.ends_at, e.starts_at) AT TIME ZONE club.timezone)::date >= (now() AT TIME ZONE club.timezone)::date
      ORDER BY e.starts_at`,
    [clubId],
  );
  return rows.map((row) => ({ id: row.id, title: pickText(row.title, locale), courseId: row.course_id }));
}

export async function listEventParticipants(clubId: string, eventId: string): Promise<EventParticipant[]> {
  const rows = await many<{ player_id: string; display_name: string; status: EventRegistrationStatus; created_at: Date }>(
    `SELECT er.player_id, p.display_name, er.status, er.created_at
       FROM event_registrations er
       JOIN players p ON p.id = er.player_id
      WHERE er.club_id = $1 AND er.event_id = $2 AND er.status <> 'cancelled'
      ORDER BY (er.status = 'registered') DESC, er.created_at`,
    [clubId, eventId],
  );
  return rows.map((row) => ({
    playerId: row.player_id,
    name: row.display_name,
    initials: initialsOf(row.display_name),
    status: row.status,
    registeredAt: row.created_at.toISOString(),
  }));
}

// --------------------------------------------------------- registration --

/** Signs the player up; when the event is full they join the waiting list. */
export async function registerForEvent(session: ClubSession, eventId: string): Promise<EventRegistrationStatus> {
  return transaction(async (tx) => {
    const event = await maybeOne<{ capacity: number | null }>(
      `SELECT capacity FROM events
        WHERE id = $1 AND club_id = $2 AND published
          AND COALESCE(registration_closes_at, starts_at) > now()
          FOR UPDATE`,
      [eventId, session.clubId],
      tx,
    );
    if (!event) throw notFound("EVENT_NOT_OPEN");

    const existing = await maybeOne<{ status: EventRegistrationStatus }>(
      "SELECT status FROM event_registrations WHERE event_id = $1 AND player_id = $2",
      [eventId, session.accountId],
      tx,
    );
    if (existing && existing.status !== "cancelled") return existing.status;

    const taken = await one<{ count: number }>(
      "SELECT count(*)::int AS count FROM event_registrations WHERE event_id = $1 AND status = 'registered'",
      [eventId],
      tx,
    );
    const status: EventRegistrationStatus = event.capacity !== null && taken.count >= event.capacity ? "waitlisted" : "registered";
    await tx.query(
      `INSERT INTO event_registrations (event_id, club_id, player_id, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id, player_id) DO UPDATE SET status = EXCLUDED.status, created_at = now(), updated_at = now()`,
      [eventId, session.clubId, session.accountId, status],
    );
    await publish(tx, [topics.club(session.clubId)], "events");
    return status;
  });
}

/** Withdraws the player; the first person on the waiting list takes the place. */
export async function cancelEventRegistration(session: ClubSession, eventId: string): Promise<void> {
  await transaction(async (tx) => {
    const event = await maybeOne<{ capacity: number | null; title: LocalizedText }>(
      "SELECT capacity, title FROM events WHERE id = $1 AND club_id = $2 FOR UPDATE",
      [eventId, session.clubId],
      tx,
    );
    if (!event) throw notFound("EVENT_NOT_FOUND");
    const removed = await maybeOne<{ status: EventRegistrationStatus }>(
      "DELETE FROM event_registrations WHERE event_id = $1 AND player_id = $2 RETURNING status",
      [eventId, session.accountId],
      tx,
    );
    if (!removed) return;
    if (removed.status === "registered") {
      await promoteFromWaitlist(tx, session.clubId, eventId, event.capacity, pickText(event.title, session.club.defaultLanguage));
    }
    await publish(tx, [topics.club(session.clubId)], "events");
  });
}

async function promoteFromWaitlist(
  tx: Db,
  clubId: string,
  eventId: string,
  capacity: number | null,
  title: string,
): Promise<void> {
  const taken = await one<{ count: number }>(
    "SELECT count(*)::int AS count FROM event_registrations WHERE event_id = $1 AND status = 'registered'",
    [eventId],
    tx,
  );
  const free = capacity === null ? Number.MAX_SAFE_INTEGER : capacity - taken.count;
  if (free <= 0) return;
  const promoted = await many<{ player_id: string }>(
    `UPDATE event_registrations SET status = 'registered', updated_at = now()
      WHERE event_id = $1 AND player_id IN (
        SELECT player_id FROM event_registrations
         WHERE event_id = $1 AND status = 'waitlisted'
         ORDER BY created_at LIMIT $2
      )
      RETURNING player_id`,
    [eventId, Math.min(free, 1000)],
    tx,
  );
  await notify(tx, clubId, promoted.map((row) => row.player_id), "event_promoted", { eventId, title });
}

// ---------------------------------------------------------------- staff --

export async function saveEvent(session: ClubSession, eventId: string | null, input: EventBody): Promise<string> {
  const language = session.club.defaultLanguage;
  const clubId = session.clubId;

  return transaction(async (tx) => {
    if (input.courseId) {
      const course = await maybeOne("SELECT 1 FROM courses WHERE id = $1 AND club_id = $2", [input.courseId, clubId], tx);
      if (!course) throw notFound("COURSE_NOT_FOUND");
    }

    let id = eventId;
    let announce = false;
    if (id) {
      const existing = await maybeOne<{ published: boolean }>(
        "SELECT published FROM events WHERE id = $1 AND club_id = $2 FOR UPDATE",
        [id, clubId],
        tx,
      );
      if (!existing) throw notFound("EVENT_NOT_FOUND");
      announce = !existing.published && input.published;
      await tx.query(
        `UPDATE events
            SET title = COALESCE(title, '{}'::jsonb) || jsonb_build_object($3::text, $4::text),
                description = COALESCE(description, '{}'::jsonb) || jsonb_build_object($3::text, $5::text),
                kind = $6, starts_at = $7, ends_at = $8, registration_closes_at = $9, location = $10,
                course_id = $11, capacity = $12, leaderboard_enabled = $13, published = $14, updated_at = now()
          WHERE id = $1 AND club_id = $2`,
        [
          id, clubId, language, input.title, input.description, input.kind, input.startsAt, input.endsAt,
          input.registrationClosesAt, input.location, input.courseId, input.capacity, input.leaderboardEnabled, input.published,
        ],
      );
      // A larger capacity may free places for people on the waiting list.
      await promoteFromWaitlist(tx, clubId, id, input.capacity, input.title);
    } else {
      const created = await one<{ id: string }>(
        `INSERT INTO events (club_id, title, description, kind, starts_at, ends_at, registration_closes_at, location,
                             course_id, capacity, leaderboard_enabled, published)
         VALUES ($1, jsonb_build_object($2::text, $3::text), jsonb_build_object($2::text, $4::text),
                 $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [
          clubId, language, input.title, input.description, input.kind, input.startsAt, input.endsAt,
          input.registrationClosesAt, input.location, input.courseId, input.capacity, input.leaderboardEnabled, input.published,
        ],
        tx,
      );
      id = created.id;
      announce = input.published;
    }

    if (announce && new Date(input.startsAt).getTime() > Date.now()) {
      await notifyClub(tx, clubId, "event_published", { eventId: id, title: input.title });
    }
    await audit({ clubId, actor: session, action: eventId ? "event.updated" : "event.created", entityType: "event", entityId: id }, tx);
    await publish(tx, [topics.club(clubId)], "events");
    return id;
  });
}

export async function deleteEvent(session: ClubSession, eventId: string): Promise<void> {
  const deleted = await db.query("DELETE FROM events WHERE id = $1 AND club_id = $2", [eventId, session.clubId]);
  if (deleted.rowCount === 0) throw notFound("EVENT_NOT_FOUND");
  await audit({ clubId: session.clubId, actor: session, action: "event.deleted", entityType: "event", entityId: eventId });
  await publish(db, [topics.club(session.clubId)], "events");
}

/** Staff remove a single registration, e.g. after a phone call. */
export async function removeEventRegistration(session: ClubSession, eventId: string, playerId: string): Promise<void> {
  await transaction(async (tx) => {
    const event = await maybeOne<{ capacity: number | null; title: LocalizedText }>(
      "SELECT capacity, title FROM events WHERE id = $1 AND club_id = $2 FOR UPDATE",
      [eventId, session.clubId],
      tx,
    );
    if (!event) throw notFound("EVENT_NOT_FOUND");
    const removed = await maybeOne("DELETE FROM event_registrations WHERE event_id = $1 AND player_id = $2 RETURNING status", [
      eventId,
      playerId,
    ], tx);
    if (!removed) throw conflict("REGISTRATION_NOT_FOUND");
    await promoteFromWaitlist(tx, session.clubId, eventId, event.capacity, pickText(event.title, session.club.defaultLanguage));
    await publish(tx, [topics.club(session.clubId)], "events");
  });
}

// ---------------------------------------------------------- leaderboard --

/** Best round per player among the rounds played for this event. */
export async function getEventLeaderboard(clubId: string, eventId: string): Promise<EventLeaderboardRow[]> {
  const rows = await many<{
    player_id: string;
    display_name: string;
    strokes: number;
    to_par: number;
    hole_count: HoleCount;
    provisional: boolean;
    round_id: string;
  }>(
    `SELECT DISTINCT ON (rp.player_id)
            rp.player_id, p.display_name, rp.total_strokes AS strokes,
            rp.total_strokes - rp.total_par AS to_par, r.hole_count,
            r.status = 'pending' AS provisional, r.id AS round_id
       FROM rounds r
       JOIN round_participants rp ON rp.round_id = r.id AND rp.player_id IS NOT NULL
       JOIN players p ON p.id = rp.player_id
      WHERE r.club_id = $1 AND r.event_id = $2 AND r.status IN ('pending', 'approved')
      ORDER BY rp.player_id, rp.total_strokes - rp.total_par, rp.total_strokes`,
    [clubId, eventId],
  );
  const sorted = [...rows].sort((left, right) => left.to_par - right.to_par || left.strokes - right.strokes);
  let rank = 0;
  return sorted.map((row, index) => {
    const previous = index > 0 ? sorted[index - 1] : null;
    if (!previous || previous.to_par !== row.to_par || previous.strokes !== row.strokes) rank = index + 1;
    return {
      rank,
      playerId: row.player_id,
      name: row.display_name,
      initials: initialsOf(row.display_name),
      strokes: row.strokes,
      toPar: row.to_par,
      holeCount: row.hole_count,
      provisional: row.provisional,
      roundId: row.round_id,
    };
  });
}

// ------------------------------------------------------------- calendar --

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function icsDate(value: string): string {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** A single-event iCalendar file, for "add to calendar". */
export function buildCalendarFile(event: EventDto, clubName: string, url: string): string {
  const start = event.startsAt;
  const end = event.endsAt ?? new Date(new Date(start).getTime() + 2 * 60 * 60 * 1000).toISOString();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fairway Club//Events//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@fairway.club`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape([event.description, url].filter(Boolean).join("\n\n"))}`,
    `LOCATION:${icsEscape(event.location || event.courseName || clubName)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
