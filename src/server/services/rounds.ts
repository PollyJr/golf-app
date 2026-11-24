import "server-only";

import type { ClubSession } from "../auth/session";
import { audit } from "../audit";
import { db, many, maybeOne, one, transaction, type Db } from "../db";
import { badRequest, conflict, forbidden, isUniqueViolation, notFound } from "../errors";
import { publish, topics } from "../realtime/hub";
import { randomToken } from "../security";
import { notify } from "./notifications";
import { refreshPlayerProgress } from "./progress";
import { initialsOf } from "@/lib/format";
import {
  expandLayout,
  layoutPar,
  MAX_FLIGHT_SIZE,
  roundPar,
  sourceHoleNumber,
  type HoleCount,
  type HoleInfo,
  type RoundFormat,
  type Strokes,
} from "@/lib/golf/scoring";
import { pickText, type Locale, type LocalizedText } from "@/lib/i18n/core";
import type {
  ActiveRoundSummary,
  AdminRoundRow,
  InvitationStatus,
  RoundHistoryItem,
  RoundParticipantDto,
  RoundSnapshot,
  RoundStatus,
} from "@/lib/types";

/** How long a finished round stays visible through its share link. */
const SHARE_DAYS_AFTER_FINISH = 7;

// ------------------------------------------------------------- snapshot --

interface RoundBaseRow {
  id: string;
  club_id: string;
  revision: number;
  status: RoundStatus;
  format: RoundFormat;
  track_putts: boolean;
  hole_count: HoleCount;
  starter_player_id: string;
  starter_name: string;
  club_name: string;
  timezone: string;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  rejection_reason: string | null;
  share_token: string | null;
  course_id: string;
  course_name: LocalizedText;
  accent_color: string;
  tee_set_id: string;
  tee_name: LocalizedText;
  event_id: string | null;
  event_title: LocalizedText;
}

const ROUND_BASE = `
  SELECT r.id, r.club_id, r.revision, r.status, r.format, r.track_putts, r.hole_count,
         r.starter_player_id, starter.display_name AS starter_name,
         club.name AS club_name, club.timezone,
         r.created_at, r.started_at, r.completed_at, r.rejection_reason, r.share_token,
         r.course_id, c.name AS course_name, c.accent_color,
         r.tee_set_id, t.name AS tee_name,
         r.event_id, e.title AS event_title
    FROM rounds r
    JOIN clubs club ON club.id = r.club_id
    JOIN players starter ON starter.id = r.starter_player_id
    JOIN courses c ON c.id = r.course_id
    JOIN tee_sets t ON t.id = r.tee_set_id
    LEFT JOIN events e ON e.id = r.event_id`;

async function buildSnapshot(base: RoundBaseRow, locale: Locale, on: Db = db): Promise<RoundSnapshot> {
  const [holes, participants, scores] = await Promise.all([
    many<{ number: number; par: number; distance_m: number; name: LocalizedText; description: LocalizedText }>(
      "SELECT number, par, distance_m, name, description FROM holes WHERE tee_set_id = $1 ORDER BY number",
      [base.tee_set_id],
      on,
    ),
    many<{ id: string; player_id: string | null; display_name: string; is_guest: boolean; position: number; invitation_status: InvitationStatus }>(
      `SELECT id, player_id, display_name, is_guest, position, invitation_status
         FROM round_participants WHERE round_id = $1 ORDER BY position`,
      [base.id],
      on,
    ),
    many<{ round_participant_id: string; hole_number: number; strokes: number; putts: number | null }>(
      `SELECT hs.round_participant_id, hs.hole_number, hs.strokes, hs.putts
         FROM hole_scores hs
         JOIN round_participants rp ON rp.id = hs.round_participant_id
        WHERE rp.round_id = $1`,
      [base.id],
      on,
    ),
  ]);

  const layout: HoleInfo[] = expandLayout(
    holes.map((hole) => ({
      number: hole.number,
      par: hole.par,
      distance: hole.distance_m,
      name: pickText(hole.name, locale) || null,
      tip: pickText(hole.description, locale) || null,
    })),
    base.hole_count,
  );

  const byParticipant = new Map<string, { strokes: Strokes[]; putts: (number | null)[] }>();
  for (const participant of participants) {
    byParticipant.set(participant.id, {
      strokes: Array.from({ length: base.hole_count }, () => null),
      putts: Array.from({ length: base.hole_count }, () => null),
    });
  }
  for (const score of scores) {
    const entry = byParticipant.get(score.round_participant_id);
    if (!entry || score.hole_number < 1 || score.hole_number > base.hole_count) continue;
    entry.strokes[score.hole_number - 1] = score.strokes;
    entry.putts[score.hole_number - 1] = score.putts;
  }

  const participantDtos: RoundParticipantDto[] = participants.map((participant) => ({
    id: participant.id,
    playerId: participant.player_id,
    name: participant.display_name,
    initials: initialsOf(participant.display_name),
    guest: participant.is_guest,
    position: participant.position,
    invitation: participant.invitation_status,
    scores: byParticipant.get(participant.id)?.strokes ?? [],
    putts: byParticipant.get(participant.id)?.putts ?? [],
  }));

  return {
    id: base.id,
    revision: base.revision,
    status: base.status,
    format: base.format,
    trackPutts: base.track_putts,
    holeCount: base.hole_count,
    starterId: base.starter_player_id,
    starterName: base.starter_name,
    clubName: base.club_name,
    timeZone: base.timezone,
    createdAt: base.created_at.toISOString(),
    startedAt: base.started_at?.toISOString() ?? null,
    completedAt: base.completed_at?.toISOString() ?? null,
    rejectionReason: base.rejection_reason,
    course: {
      id: base.course_id,
      name: pickText(base.course_name, locale),
      accent: base.accent_color,
      tee: pickText(base.tee_name, locale),
      par: layoutPar(layout),
      holes: layout,
    },
    event: base.event_id ? { id: base.event_id, title: pickText(base.event_title, locale) } : null,
    participants: participantDtos,
  };
}

/**
 * A round as seen by a club member: participants always, other members once
 * the round is approved (so leaderboard entries can be opened).
 */
export async function getRoundForPlayer(
  clubId: string,
  playerId: string,
  roundId: string,
  locale: Locale,
): Promise<RoundSnapshot | null> {
  const base = await maybeOne<RoundBaseRow>(
    `${ROUND_BASE}
      WHERE r.id = $1 AND r.club_id = $2
        AND (r.status = 'approved'
             OR EXISTS (SELECT 1 FROM round_participants me WHERE me.round_id = r.id AND me.player_id = $3))`,
    [roundId, clubId, playerId],
  );
  if (!base) return null;
  const snapshot = await buildSnapshot(base, locale);
  const mine = snapshot.participants.find((participant) => participant.playerId === playerId) ?? null;
  snapshot.viewer = {
    playerId,
    participantId: mine?.id ?? null,
    isStarter: snapshot.starterId === playerId,
    invitation: mine?.invitation ?? null,
  };
  snapshot.shareToken = mine ? base.share_token : null;
  return snapshot;
}

export async function getRoundForStaff(clubId: string, roundId: string, locale: Locale): Promise<RoundSnapshot | null> {
  const base = await maybeOne<RoundBaseRow>(`${ROUND_BASE} WHERE r.id = $1 AND r.club_id = $2`, [roundId, clubId]);
  return base ? buildSnapshot(base, locale) : null;
}

/** Read-only view behind a share link. Works while playing and for a week after. */
export async function getSharedRound(shareToken: string, locale: Locale): Promise<RoundSnapshot | null> {
  const base = await maybeOne<RoundBaseRow>(
    `${ROUND_BASE}
      WHERE r.share_token = $1
        AND club.status IN ('trial', 'active')
        AND (r.completed_at IS NULL OR r.completed_at > now() - interval '${SHARE_DAYS_AFTER_FINISH} days')`,
    [shareToken],
  );
  return base ? buildSnapshot(base, locale) : null;
}

/** Revision and club of a shared round, for the public stream. */
export async function getSharedRoundRef(shareToken: string): Promise<{ id: string; revision: number } | null> {
  return maybeOne<{ id: string; revision: number }>(
    `SELECT r.id, r.revision FROM rounds r JOIN clubs club ON club.id = r.club_id
      WHERE r.share_token = $1 AND club.status IN ('trial', 'active')
        AND (r.completed_at IS NULL OR r.completed_at > now() - interval '${SHARE_DAYS_AFTER_FINISH} days')`,
    [shareToken],
  );
}

/** Whether a player may subscribe to a round's stream. */
export async function canFollowRound(clubId: string, playerId: string, roundId: string): Promise<boolean> {
  const row = await maybeOne(
    `SELECT 1 FROM rounds r
      WHERE r.id = $1 AND r.club_id = $2
        AND EXISTS (SELECT 1 FROM round_participants me WHERE me.round_id = r.id AND me.player_id = $3)`,
    [roundId, clubId, playerId],
  );
  return row !== null;
}

// ------------------------------------------------------------- internals --

async function participantPlayerIds(on: Db, roundId: string): Promise<string[]> {
  const rows = await many<{ player_id: string }>(
    "SELECT player_id FROM round_participants WHERE round_id = $1 AND player_id IS NOT NULL",
    [roundId],
    on,
  );
  return rows.map((row) => row.player_id);
}

/** Increments the revision and tells everyone who is watching. */
async function bumpRound(
  tx: Db,
  clubId: string,
  roundId: string,
  type: string,
  options: { players?: readonly string[] } = {},
): Promise<number> {
  const row = await one<{ revision: number }>(
    "UPDATE rounds SET revision = revision + 1, updated_at = now() WHERE id = $1 AND club_id = $2 RETURNING revision",
    [roundId, clubId],
    tx,
  );
  await publish(
    tx,
    [topics.round(roundId), topics.club(clubId), ...(options.players ?? []).map(topics.player)],
    type,
  );
  return row.revision;
}

/**
 * Brings a lobby into a consistent state after someone answered or left:
 * match play needs exactly two players, and the round starts as soon as no
 * invitation is open any more.
 */
async function settleLobby(tx: Db, roundId: string, status: RoundStatus, format: RoundFormat): Promise<void> {
  const counts = await one<{ total: number; pending: number }>(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE invitation_status = 'pending')::int AS pending
       FROM round_participants WHERE round_id = $1`,
    [roundId],
    tx,
  );
  if (format === "match" && counts.total !== 2) {
    await tx.query("UPDATE rounds SET format = 'stroke' WHERE id = $1", [roundId]);
  }
  if (status === "inviting" && counts.pending === 0) {
    await tx.query("UPDATE rounds SET status = 'active', started_at = now() WHERE id = $1", [roundId]);
  }
}

// --------------------------------------------------------------- create --

export interface CreateRoundInput {
  clientId: string;
  courseId: string;
  holeCount: HoleCount;
  format: RoundFormat;
  trackPutts: boolean;
  playerIds: string[];
  guests: string[];
  eventId: string | null;
}

export async function createRound(session: ClubSession, input: CreateRoundInput): Promise<string> {
  const clubId = session.clubId;
  const starterId = session.accountId;
  const invited = [...new Set(input.playerIds)].filter((id) => id !== starterId);
  const guests = input.guests.map((name) => name.trim()).filter(Boolean);
  const flightSize = 1 + invited.length + guests.length;

  if (flightSize > MAX_FLIGHT_SIZE) throw badRequest("FLIGHT_FULL");
  if (input.format === "match" && flightSize !== 2) throw badRequest("MATCH_NEEDS_TWO");

  try {
    return await transaction(async (tx) => {
      // Idempotent: a retried request (flaky connection) returns the same round.
      const existing = await maybeOne<{ id: string }>(
        "SELECT id FROM rounds WHERE club_id = $1 AND client_id = $2 AND starter_player_id = $3",
        [clubId, input.clientId, starterId],
        tx,
      );
      if (existing) return existing.id;

      const course = await maybeOne<{ id: string; hole_count: number; tee_id: string; name: LocalizedText; pars: number[] }>(
        `SELECT c.id, c.hole_count, c.name, t.id AS tee_id, array_agg(h.par ORDER BY h.number) AS pars
           FROM courses c
           JOIN tee_sets t ON t.course_id = c.id AND t.is_default
           JOIN holes h ON h.tee_set_id = t.id
          WHERE c.id = $1 AND c.club_id = $2 AND c.active
          GROUP BY c.id, t.id`,
        [input.courseId, clubId],
        tx,
      );
      if (!course) throw notFound("COURSE_NOT_FOUND");
      if (course.pars.length !== course.hole_count) throw badRequest("COURSE_INCOMPLETE");

      const players = await many<{ id: string; display_name: string }>(
        `SELECT id, display_name FROM players
          WHERE club_id = $1 AND active AND registration_status = 'approved' AND id = ANY($2::uuid[])`,
        [clubId, [starterId, ...invited]],
        tx,
      );
      if (players.length !== invited.length + 1) throw notFound("PLAYER_NOT_FOUND");
      const names = new Map(players.map((player) => [player.id, player.display_name]));

      if (input.eventId) {
        const event = await maybeOne(
          `SELECT 1 FROM events e JOIN clubs club ON club.id = e.club_id
            WHERE e.id = $1 AND e.club_id = $2 AND e.published AND e.leaderboard_enabled
              AND (e.starts_at AT TIME ZONE club.timezone)::date <= (now() AT TIME ZONE club.timezone)::date
              AND (COALESCE(e.ends_at, e.starts_at) AT TIME ZONE club.timezone)::date >= (now() AT TIME ZONE club.timezone)::date`,
          [input.eventId, clubId],
          tx,
        );
        if (!event) throw badRequest("EVENT_NOT_PLAYABLE");
      }

      const par = roundPar(course.pars.map((value) => ({ par: value })), input.holeCount);
      const inviting = invited.length > 0;
      const round = await one<{ id: string }>(
        `INSERT INTO rounds (client_id, club_id, course_id, tee_set_id, starter_player_id, hole_count,
                             status, format, track_putts, event_id, started_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::round_status, $8, $9, $10,
                 CASE WHEN $7::round_status = 'active' THEN now() END)
         RETURNING id`,
        [
          input.clientId,
          clubId,
          course.id,
          course.tee_id,
          starterId,
          input.holeCount,
          inviting ? "inviting" : "active",
          input.format,
          input.trackPutts,
          input.eventId,
        ],
        tx,
      );

      const rows: Array<[string | null, string, boolean, InvitationStatus]> = [
        [starterId, names.get(starterId) ?? session.user.displayName, false, "accepted"],
        ...invited.map((id): [string, string, boolean, InvitationStatus] => [id, names.get(id) ?? "", false, "pending"]),
        ...guests.map((name): [null, string, boolean, InvitationStatus] => [null, name.slice(0, 60), true, "accepted"]),
      ];
      for (const [index, [playerId, name, guest, invitation]] of rows.entries()) {
        await tx.query(
          `INSERT INTO round_participants (round_id, club_id, player_id, display_name, is_guest, position,
                                           total_strokes, total_par, invitation_status, responded_at)
           VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8::text, CASE WHEN $8::text = 'accepted' THEN now() END)`,
          [round.id, clubId, playerId, name, guest, index + 1, par, invitation],
        );
      }

      await notify(tx, clubId, invited, "round_invite", {
        roundId: round.id,
        starterName: session.user.displayName,
        courseName: pickText(course.name, session.club.defaultLanguage),
      });
      await publish(tx, [topics.club(clubId), ...[starterId, ...invited].map(topics.player)], "rounds");
      await audit(
        {
          clubId,
          actor: session,
          action: inviting ? "round.invited" : "round.started",
          entityType: "round",
          entityId: round.id,
          metadata: { players: flightSize, holes: input.holeCount, format: input.format },
        },
        tx,
      );
      return round.id;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("ROUND_CONFLICT");
    throw error;
  }
}

// ---------------------------------------------------------------- lobby --

interface LockedRound {
  id: string;
  status: RoundStatus;
  format: RoundFormat;
  starter_player_id: string;
  hole_count: HoleCount;
}

async function lockRound(tx: Db, clubId: string, roundId: string, statuses: readonly RoundStatus[]): Promise<LockedRound> {
  const round = await maybeOne<LockedRound>(
    `SELECT id, status, format, starter_player_id, hole_count
       FROM rounds WHERE id = $1 AND club_id = $2 AND status = ANY($3::round_status[])
        FOR UPDATE`,
    [roundId, clubId, statuses],
    tx,
  );
  if (!round) throw notFound("ROUND_NOT_FOUND");
  return round;
}

export async function respondToInvitation(session: ClubSession, roundId: string, decision: "accept" | "decline"): Promise<void> {
  await transaction(async (tx) => {
    const round = await lockRound(tx, session.clubId, roundId, ["inviting"]);
    const invitation = await maybeOne<{ id: string }>(
      `SELECT id FROM round_participants
        WHERE round_id = $1 AND player_id = $2 AND invitation_status = 'pending' FOR UPDATE`,
      [roundId, session.accountId],
      tx,
    );
    if (!invitation) throw conflict("INVITATION_NOT_FOUND");
    const players = await participantPlayerIds(tx, roundId);

    if (decision === "accept") {
      await tx.query(
        "UPDATE round_participants SET invitation_status = 'accepted', responded_at = now(), updated_at = now() WHERE id = $1",
        [invitation.id],
      );
    } else {
      await tx.query("DELETE FROM round_participants WHERE id = $1", [invitation.id]);
    }
    await settleLobby(tx, roundId, round.status, round.format);
    await bumpRound(tx, session.clubId, roundId, "lobby", { players });
    await audit(
      {
        clubId: session.clubId,
        actor: session,
        action: decision === "accept" ? "round.invitation_accepted" : "round.invitation_declined",
        entityType: "round",
        entityId: roundId,
      },
      tx,
    );
  });
}

/** The starter removes someone from the lobby before play begins. */
export async function removeParticipant(session: ClubSession, roundId: string, participantId: string): Promise<void> {
  await transaction(async (tx) => {
    const round = await lockRound(tx, session.clubId, roundId, ["inviting"]);
    if (round.starter_player_id !== session.accountId) throw forbidden("STARTER_ONLY");
    const players = await participantPlayerIds(tx, roundId);
    const removed = await maybeOne<{ player_id: string | null }>(
      `DELETE FROM round_participants
        WHERE id = $1 AND round_id = $2 AND (player_id IS NULL OR player_id <> $3)
        RETURNING player_id`,
      [participantId, roundId, session.accountId],
      tx,
    );
    if (!removed) throw notFound("PARTICIPANT_NOT_FOUND");
    await settleLobby(tx, roundId, round.status, round.format);
    await bumpRound(tx, session.clubId, roundId, "lobby", { players });
  });
}

/** The starter stops waiting: open invitations are withdrawn and play begins. */
export async function startRoundNow(session: ClubSession, roundId: string): Promise<void> {
  await transaction(async (tx) => {
    const round = await lockRound(tx, session.clubId, roundId, ["inviting"]);
    if (round.starter_player_id !== session.accountId) throw forbidden("STARTER_ONLY");
    const players = await participantPlayerIds(tx, roundId);
    await tx.query("DELETE FROM round_participants WHERE round_id = $1 AND invitation_status = 'pending'", [roundId]);
    await settleLobby(tx, roundId, round.status, round.format);
    await bumpRound(tx, session.clubId, roundId, "lobby", { players });
    await audit({ clubId: session.clubId, actor: session, action: "round.started", entityType: "round", entityId: roundId }, tx);
  });
}

/** A participant other than the starter steps out of a round that is not finished. */
export async function leaveRound(session: ClubSession, roundId: string): Promise<void> {
  await transaction(async (tx) => {
    const round = await lockRound(tx, session.clubId, roundId, ["inviting", "active"]);
    if (round.starter_player_id === session.accountId) throw conflict("STARTER_CANNOT_LEAVE");
    const players = await participantPlayerIds(tx, roundId);
    const removed = await maybeOne(
      "DELETE FROM round_participants WHERE round_id = $1 AND player_id = $2 RETURNING id",
      [roundId, session.accountId],
      tx,
    );
    if (!removed) throw notFound("PARTICIPANT_NOT_FOUND");
    await settleLobby(tx, roundId, round.status, round.format);
    await bumpRound(tx, session.clubId, roundId, "lobby", { players });
    await audit({ clubId: session.clubId, actor: session, action: "round.left", entityType: "round", entityId: roundId }, tx);
  });
}

export async function cancelRound(session: ClubSession, roundId: string): Promise<void> {
  await transaction(async (tx) => {
    const round = await lockRound(tx, session.clubId, roundId, ["inviting", "active"]);
    if (round.starter_player_id !== session.accountId) throw forbidden("STARTER_ONLY");
    const players = await participantPlayerIds(tx, roundId);
    await tx.query("DELETE FROM notifications WHERE club_id = $1 AND kind = 'round_invite' AND data->>'roundId' = $2", [
      session.clubId,
      roundId,
    ]);
    await tx.query("DELETE FROM rounds WHERE id = $1 AND club_id = $2", [roundId, session.clubId]);
    await publish(tx, [topics.round(roundId), topics.club(session.clubId), ...players.map(topics.player)], "cancelled");
    await audit({ clubId: session.clubId, actor: session, action: "round.cancelled", entityType: "round", entityId: roundId }, tx);
  });
}

// --------------------------------------------------------------- scoring --

export interface ScoreInput {
  participantId: string;
  hole: number;
  /** `null` clears the score for that hole. */
  strokes: number | null;
  /** Omit to leave putts as they are. */
  putts?: number | null;
}

/** Any accepted participant may keep score for anyone in the flight. */
export async function setScore(session: ClubSession, roundId: string, input: ScoreInput): Promise<{ revision: number }> {
  return transaction(async (tx) => {
    const round = await maybeOne<{ hole_count: number; track_putts: boolean; tee_set_id: string; course_hole_count: number }>(
      `SELECT r.hole_count, r.track_putts, r.tee_set_id, c.hole_count AS course_hole_count
         FROM rounds r
         JOIN courses c ON c.id = r.course_id
        WHERE r.id = $1 AND r.club_id = $2 AND r.status = 'active'
          AND EXISTS (SELECT 1 FROM round_participants me
                       WHERE me.round_id = r.id AND me.player_id = $3 AND me.invitation_status = 'accepted')
          FOR UPDATE OF r`,
      [roundId, session.clubId, session.accountId],
      tx,
    );
    if (!round) throw notFound("ROUND_NOT_ACTIVE");
    if (input.hole < 1 || input.hole > round.hole_count) throw notFound("HOLE_NOT_FOUND");

    const participant = await maybeOne("SELECT 1 FROM round_participants WHERE id = $1 AND round_id = $2", [
      input.participantId,
      roundId,
    ], tx);
    if (!participant) throw notFound("PARTICIPANT_NOT_FOUND");

    if (input.strokes === null) {
      await tx.query("DELETE FROM hole_scores WHERE round_participant_id = $1 AND hole_number = $2", [
        input.participantId,
        input.hole,
      ]);
    } else {
      const hole = await maybeOne<{ par: number; distance_m: number }>(
        "SELECT par, distance_m FROM holes WHERE tee_set_id = $1 AND number = $2",
        [round.tee_set_id, sourceHoleNumber(input.hole, round.course_hole_count)],
        tx,
      );
      if (!hole) throw notFound("HOLE_NOT_FOUND");
      const puttsGiven = round.track_putts && input.putts !== undefined;
      const putts = puttsGiven && input.putts !== null ? Math.min(input.putts as number, input.strokes) : null;
      await tx.query(
        `INSERT INTO hole_scores (round_participant_id, club_id, hole_number, strokes, par_snapshot,
                                  distance_snapshot, putts, updated_by_player_id, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
         ON CONFLICT (round_participant_id, hole_number) DO UPDATE
           SET strokes = EXCLUDED.strokes,
               par_snapshot = EXCLUDED.par_snapshot,
               distance_snapshot = EXCLUDED.distance_snapshot,
               putts = CASE WHEN $9 THEN EXCLUDED.putts ELSE LEAST(hole_scores.putts, EXCLUDED.strokes) END,
               updated_by_player_id = EXCLUDED.updated_by_player_id,
               updated_at = now()`,
        [input.participantId, session.clubId, input.hole, input.strokes, hole.par, hole.distance_m, putts, session.accountId, puttsGiven],
      );
    }

    await tx.query(
      `UPDATE round_participants
          SET total_strokes = (SELECT COALESCE(sum(strokes), 0)::int FROM hole_scores WHERE round_participant_id = $1),
              updated_at = now()
        WHERE id = $1`,
      [input.participantId],
    );
    const revision = await bumpRound(tx, session.clubId, roundId, "score");
    return { revision };
  });
}

/** Hands in a finished card: to the club for review, or straight to approved. */
export async function submitRound(session: ClubSession, roundId: string): Promise<{ status: RoundStatus }> {
  return transaction(async (tx) => {
    const round = await maybeOne<{ hole_count: number; auto_approve_rounds: boolean; course_name: LocalizedText }>(
      `SELECT r.hole_count, club.auto_approve_rounds, c.name AS course_name
         FROM rounds r
         JOIN clubs club ON club.id = r.club_id
         JOIN courses c ON c.id = r.course_id
        WHERE r.id = $1 AND r.club_id = $2 AND r.status = 'active'
          AND EXISTS (SELECT 1 FROM round_participants me
                       WHERE me.round_id = r.id AND me.player_id = $3 AND me.invitation_status = 'accepted')
          FOR UPDATE OF r`,
      [roundId, session.clubId, session.accountId],
      tx,
    );
    if (!round) throw notFound("ROUND_NOT_ACTIVE");

    const completeness = await one<{ participants: number; complete: number }>(
      `SELECT count(*)::int AS participants,
              count(*) FILTER (WHERE scored = $2)::int AS complete
         FROM (SELECT (SELECT count(*) FROM hole_scores hs WHERE hs.round_participant_id = rp.id) AS scored
                 FROM round_participants rp WHERE rp.round_id = $1) AS card`,
      [roundId, round.hole_count],
      tx,
    );
    if (completeness.participants === 0 || completeness.participants !== completeness.complete) {
      throw badRequest("ROUND_INCOMPLETE");
    }

    const status: RoundStatus = round.auto_approve_rounds ? "approved" : "pending";
    await tx.query(
      `UPDATE rounds
          SET status = $2::round_status, completed_at = now(),
              reviewed_at = CASE WHEN $2::round_status = 'approved' THEN now() END
        WHERE id = $1`,
      [roundId, status],
    );
    const players = await participantPlayerIds(tx, roundId);
    if (status === "approved") {
      await refreshPlayerProgress(tx, session.clubId, players);
      await notify(tx, session.clubId, players, "round_approved", {
        roundId,
        courseName: pickText(round.course_name, session.club.defaultLanguage),
      });
    }
    await bumpRound(tx, session.clubId, roundId, "status", { players });
    await audit(
      { clubId: session.clubId, actor: session, action: "round.submitted", entityType: "round", entityId: roundId, metadata: { status } },
      tx,
    );
    return { status };
  });
}

/** Turns the public share link on or off. Returns the token while it is on. */
export async function setSharing(session: ClubSession, roundId: string, enabled: boolean): Promise<string | null> {
  return transaction(async (tx) => {
    const round = await maybeOne<{ share_token: string | null }>(
      `SELECT r.share_token FROM rounds r
        WHERE r.id = $1 AND r.club_id = $2
          AND EXISTS (SELECT 1 FROM round_participants me
                       WHERE me.round_id = r.id AND me.player_id = $3 AND me.invitation_status = 'accepted')
          FOR UPDATE OF r`,
      [roundId, session.clubId, session.accountId],
      tx,
    );
    if (!round) throw notFound("ROUND_NOT_FOUND");
    const token = enabled ? (round.share_token ?? randomToken(24)) : null;
    if (token !== round.share_token) {
      await tx.query("UPDATE rounds SET share_token = $2 WHERE id = $1", [roundId, token]);
      await bumpRound(tx, session.clubId, roundId, "share");
      await audit(
        { clubId: session.clubId, actor: session, action: enabled ? "round.shared" : "round.unshared", entityType: "round", entityId: roundId },
        tx,
      );
    }
    return token;
  });
}

// ---------------------------------------------------------------- lists --

export async function listActiveRounds(clubId: string, playerId: string, locale: Locale): Promise<ActiveRoundSummary[]> {
  const rows = await many<{
    id: string;
    revision: number;
    status: "inviting" | "active";
    format: RoundFormat;
    course_name: LocalizedText;
    hole_count: HoleCount;
    created_at: Date;
    starter_name: string;
    is_starter: boolean;
    my_invitation: InvitationStatus;
    participants: Array<{ name: string; guest: boolean; invitation: InvitationStatus }>;
    completed_scores: number;
    total_scores: number;
  }>(
    `SELECT r.id, r.revision, r.status, r.format, c.name AS course_name, r.hole_count, r.created_at,
            starter.display_name AS starter_name, r.starter_player_id = $2 AS is_starter,
            mine.invitation_status AS my_invitation,
            (SELECT json_agg(json_build_object('name', rp.display_name, 'guest', rp.is_guest,
                                               'invitation', rp.invitation_status) ORDER BY rp.position)
               FROM round_participants rp WHERE rp.round_id = r.id) AS participants,
            (SELECT count(*)::int FROM hole_scores hs
               JOIN round_participants rp ON rp.id = hs.round_participant_id
              WHERE rp.round_id = r.id) AS completed_scores,
            (r.hole_count * (SELECT count(*) FROM round_participants rp WHERE rp.round_id = r.id))::int AS total_scores
       FROM rounds r
       JOIN courses c ON c.id = r.course_id
       JOIN players starter ON starter.id = r.starter_player_id
       JOIN round_participants mine ON mine.round_id = r.id AND mine.player_id = $2
      WHERE r.club_id = $1 AND r.status IN ('inviting', 'active')
      ORDER BY r.created_at DESC`,
    [clubId, playerId],
  );
  return rows.map((row) => ({
    id: row.id,
    revision: row.revision,
    status: row.status,
    format: row.format,
    courseName: pickText(row.course_name, locale),
    holeCount: row.hole_count,
    createdAt: row.created_at.toISOString(),
    starterName: row.starter_name,
    isStarter: row.is_starter,
    myInvitation: row.my_invitation,
    participants: (row.participants ?? []).map((participant) => ({ ...participant, initials: initialsOf(participant.name) })),
    completedScores: row.completed_scores,
    totalScores: row.total_scores,
  }));
}

export async function listRoundHistory(
  clubId: string,
  playerId: string,
  locale: Locale,
  options: { limit?: number; offset?: number } = {},
): Promise<RoundHistoryItem[]> {
  const rows = await many<{
    id: string;
    status: "pending" | "approved" | "rejected";
    format: RoundFormat;
    course_name: LocalizedText;
    hole_count: HoleCount;
    completed_at: Date;
    total_strokes: number;
    total_par: number;
    participant_count: number;
    event_title: LocalizedText;
  }>(
    `SELECT r.id, r.status, r.format, c.name AS course_name, r.hole_count, r.completed_at,
            rp.total_strokes, rp.total_par, e.title AS event_title,
            (SELECT count(*)::int FROM round_participants o WHERE o.round_id = r.id) AS participant_count
       FROM rounds r
       JOIN round_participants rp ON rp.round_id = r.id AND rp.player_id = $2
       JOIN courses c ON c.id = r.course_id
       LEFT JOIN events e ON e.id = r.event_id
      WHERE r.club_id = $1 AND r.status IN ('pending', 'approved', 'rejected')
      ORDER BY r.completed_at DESC
      LIMIT $3 OFFSET $4`,
    [clubId, playerId, options.limit ?? 50, options.offset ?? 0],
  );
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    format: row.format,
    courseName: pickText(row.course_name, locale),
    holeCount: row.hole_count,
    completedAt: row.completed_at.toISOString(),
    strokes: row.total_strokes,
    par: row.total_par,
    participantCount: row.participant_count,
    eventTitle: pickText(row.event_title, locale) || null,
  }));
}

// ---------------------------------------------------------------- staff --

export async function listRoundsForStaff(
  clubId: string,
  locale: Locale,
  options: { status?: RoundStatus | null; limit?: number } = {},
): Promise<AdminRoundRow[]> {
  const rows = await many<{
    id: string;
    status: RoundStatus;
    format: RoundFormat;
    course_name: LocalizedText;
    hole_count: HoleCount;
    created_at: Date;
    completed_at: Date | null;
    starter_name: string;
    event_title: LocalizedText;
    participants: Array<{ name: string; guest: boolean; strokes: number; par: number }>;
  }>(
    `SELECT r.id, r.status, r.format, c.name AS course_name, r.hole_count, r.created_at, r.completed_at,
            starter.display_name AS starter_name, e.title AS event_title,
            (SELECT json_agg(json_build_object('name', rp.display_name, 'guest', rp.is_guest,
                                               'strokes', rp.total_strokes, 'par', rp.total_par) ORDER BY rp.position)
               FROM round_participants rp WHERE rp.round_id = r.id) AS participants
       FROM rounds r
       JOIN courses c ON c.id = r.course_id
       JOIN players starter ON starter.id = r.starter_player_id
       LEFT JOIN events e ON e.id = r.event_id
      WHERE r.club_id = $1 AND ($2::round_status IS NULL OR r.status = $2)
      ORDER BY COALESCE(r.completed_at, r.created_at) ${options.status === "pending" ? "ASC" : "DESC"}
      LIMIT $3`,
    [clubId, options.status ?? null, options.limit ?? 200],
  );
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    format: row.format,
    courseName: pickText(row.course_name, locale),
    holeCount: row.hole_count,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    starterName: row.starter_name,
    eventTitle: pickText(row.event_title, locale) || null,
    participants: (row.participants ?? []).map((participant) => ({ ...participant, initials: initialsOf(participant.name) })),
  }));
}

/**
 * Approves or rejects a finished round. A decision can be revisited later;
 * leaderboards, indexes and achievements follow the latest decision.
 */
export async function reviewRound(
  session: ClubSession,
  roundId: string,
  decision: "approved" | "rejected",
  reason: string | null,
): Promise<boolean> {
  return transaction(async (tx) => {
    const round = await maybeOne<{ status: RoundStatus; course_name: LocalizedText }>(
      `SELECT r.status, c.name AS course_name
         FROM rounds r JOIN courses c ON c.id = r.course_id
        WHERE r.id = $1 AND r.club_id = $2 AND r.status IN ('pending', 'approved', 'rejected')
          FOR UPDATE OF r`,
      [roundId, session.clubId],
      tx,
    );
    if (!round) throw notFound("ROUND_NOT_FOUND");
    if (round.status === decision) return false;
    const rejectionReason = decision === "rejected" ? (reason?.trim() || null) : null;
    if (decision === "rejected" && !rejectionReason) throw badRequest("REASON_REQUIRED");

    await tx.query(
      "UPDATE rounds SET status = $2::round_status, reviewed_at = now(), reviewed_by = $3, rejection_reason = $4 WHERE id = $1",
      [roundId, decision, session.accountId, rejectionReason],
    );
    await tx.query(
      "INSERT INTO round_reviews (round_id, club_id, reviewer_id, decision, reason) VALUES ($1, $2, $3, $4::round_status, $5)",
      [roundId, session.clubId, session.accountId, decision, rejectionReason],
    );

    const players = await participantPlayerIds(tx, roundId);
    await refreshPlayerProgress(tx, session.clubId, players);
    await notify(tx, session.clubId, players, decision === "approved" ? "round_approved" : "round_rejected", {
      roundId,
      courseName: pickText(round.course_name, session.club.defaultLanguage),
      ...(rejectionReason ? { reason: rejectionReason } : {}),
    });
    await bumpRound(tx, session.clubId, roundId, "status", { players });
    await audit(
      { clubId: session.clubId, actor: session, action: `round.${decision}`, entityType: "round", entityId: roundId },
      tx,
    );
    return true;
  });
}

export async function approveRounds(session: ClubSession, roundIds: readonly string[]): Promise<number> {
  let approved = 0;
  for (const roundId of roundIds) {
    try {
      if (await reviewRound(session, roundId, "approved", null)) approved += 1;
    } catch (error) {
      // One stale id must not block the rest of the batch.
      if (!(error instanceof Error && error.message === "ROUND_NOT_FOUND")) throw error;
    }
  }
  return approved;
}

export async function deleteRoundAsStaff(session: ClubSession, roundId: string): Promise<void> {
  await transaction(async (tx) => {
    const round = await maybeOne<{ status: RoundStatus }>(
      "SELECT status FROM rounds WHERE id = $1 AND club_id = $2 FOR UPDATE",
      [roundId, session.clubId],
      tx,
    );
    if (!round) throw notFound("ROUND_NOT_FOUND");
    const players = await participantPlayerIds(tx, roundId);
    await tx.query("DELETE FROM rounds WHERE id = $1 AND club_id = $2", [roundId, session.clubId]);
    if (round.status === "approved") await refreshPlayerProgress(tx, session.clubId, players, false);
    await publish(tx, [topics.round(roundId), topics.club(session.clubId), ...players.map(topics.player)], "cancelled");
    await audit(
      { clubId: session.clubId, actor: session, action: "round.deleted", entityType: "round", entityId: roundId, metadata: { status: round.status } },
      tx,
    );
  });
}

export async function countPendingRounds(clubId: string): Promise<number> {
  const row = await one<{ count: number }>(
    "SELECT count(*)::int AS count FROM rounds WHERE club_id = $1 AND status = 'pending'",
    [clubId],
  );
  return row.count;
}
