/**
 * What happened between two versions of a round. The live views compare each
 * snapshot that streams in with the one before it and turn the difference
 * into events: a score, a player joining, someone taking the lead. The
 * events drive the animations and announcements; the snapshots stay the
 * source of truth for what is on screen.
 */
import { rankFlight } from "./golf/formats";
import { scoreKind, type ScoreKind } from "./golf/scoring";
import type { RoundSnapshot, RoundStatus } from "./types";

export type LiveEvent =
  | {
      kind: "score";
      participantId: string;
      name: string;
      hole: number;
      strokes: number;
      par: number;
      result: ScoreKind;
      /** The hole already had a score that was changed. */
      corrected: boolean;
    }
  | { kind: "cleared"; participantId: string; name: string; hole: number }
  | { kind: "joined"; participantId: string; name: string }
  | { kind: "left"; participantId: string; name: string }
  | { kind: "lead"; participantId: string; name: string }
  | { kind: "status"; from: RoundStatus; to: RoundStatus };

export type ScoreEvent = Extract<LiveEvent, { kind: "score" }>;

/** Results worth a celebration, best first. */
const CELEBRATED: readonly ScoreKind[] = ["ace", "albatross", "eagle", "birdie"];

/** The participant leading on their own, if anyone has played and nobody shares the lead. */
export function soleLeader(round: RoundSnapshot): { id: string; name: string } | null {
  if (round.participants.length < 2) return null;
  const pars = round.course.holes.map((hole) => hole.par);
  const ranked = rankFlight(round.participants, pars, round.format);
  const first = ranked[0];
  if (!first || first.thru === 0 || first.tied) return null;
  return { id: first.participant.id, name: first.participant.name };
}

function anyScore(round: RoundSnapshot): boolean {
  return round.participants.some((participant) => participant.scores.some((strokes) => strokes !== null));
}

/**
 * The events that turn `previous` into `next`, in the order they are best
 * told: who joined or left, the scores hole by hole, a new leader, and a
 * change of the round's status.
 */
export function diffRounds(previous: RoundSnapshot, next: RoundSnapshot): LiveEvent[] {
  if (previous.id !== next.id) return [];
  const events: LiveEvent[] = [];
  const before = new Map(previous.participants.map((participant) => [participant.id, participant]));
  const after = new Map(next.participants.map((participant) => [participant.id, participant]));

  for (const participant of next.participants) {
    if (!before.has(participant.id)) events.push({ kind: "joined", participantId: participant.id, name: participant.name });
  }
  for (const participant of previous.participants) {
    if (!after.has(participant.id)) events.push({ kind: "left", participantId: participant.id, name: participant.name });
  }

  const scores: LiveEvent[] = [];
  next.course.holes.forEach((hole, index) => {
    for (const participant of next.participants) {
      const old = before.get(participant.id);
      if (!old) continue;
      const was = old.scores[index] ?? null;
      const now = participant.scores[index] ?? null;
      if (was === now) continue;
      if (now === null) {
        scores.push({ kind: "cleared", participantId: participant.id, name: participant.name, hole: hole.number });
      } else {
        scores.push({
          kind: "score",
          participantId: participant.id,
          name: participant.name,
          hole: hole.number,
          strokes: now,
          par: hole.par,
          result: scoreKind(now, hole.par),
          corrected: was !== null,
        });
      }
    }
  });
  events.push(...scores);

  // A new leader is news once scoring has begun; the very first score of a
  // round making someone "leader" is not.
  const leaderBefore = soleLeader(previous);
  const leaderNow = soleLeader(next);
  if (leaderNow && anyScore(previous) && leaderNow.id !== leaderBefore?.id) {
    events.push({ kind: "lead", participantId: leaderNow.id, name: leaderNow.name });
  }

  if (previous.status !== next.status) events.push({ kind: "status", from: previous.status, to: next.status });
  return events;
}

/** A fresh score of birdie or better; corrections are not celebrated twice. */
export function isCelebrated(event: LiveEvent): event is ScoreEvent {
  return event.kind === "score" && !event.corrected && CELEBRATED.includes(event.result);
}

/** The best-scoring celebrations first, so a burst of updates leads with the hole-in-one. */
export function celebrationsOf(events: readonly LiveEvent[]): ScoreEvent[] {
  return events.filter(isCelebrated).sort((left, right) => CELEBRATED.indexOf(left.result) - CELEBRATED.indexOf(right.result));
}

/** The 1-based hole the flight is on: the first one somebody still has to score. */
export function currentHole(round: RoundSnapshot): number {
  for (let index = 0; index < round.holeCount; index += 1) {
    if (round.participants.some((participant) => (participant.scores[index] ?? null) === null)) return index + 1;
  }
  return round.holeCount;
}

/** The latest score of a flight, as the clubhouse board receives it. */
export interface FlightLatest {
  playerId: string;
  name: string;
  hole: number;
  strokes: number;
  par: number;
  at: string;
}

/**
 * Scores of birdie or better that came in between two refreshes of the
 * clubhouse board, one per flight at most (the board only knows each flight's
 * latest score). A flight that just appeared brings nothing to celebrate:
 * its score may be old news.
 */
export function newHighlights(
  previous: ReadonlyArray<{ id: string; latest: FlightLatest | null }>,
  next: ReadonlyArray<{ id: string; latest: FlightLatest | null }>,
): FlightLatest[] {
  const before = new Map(previous.map((flight) => [flight.id, flight.latest]));
  const found: FlightLatest[] = [];
  for (const flight of next) {
    if (!before.has(flight.id) || !flight.latest) continue;
    const old = before.get(flight.id);
    const latest = flight.latest;
    if (old && old.at === latest.at && old.playerId === latest.playerId && old.hole === latest.hole) continue;
    if (CELEBRATED.includes(scoreKind(latest.strokes, latest.par))) found.push(latest);
  }
  return found.sort(
    (left, right) =>
      CELEBRATED.indexOf(scoreKind(left.strokes, left.par)) - CELEBRATED.indexOf(scoreKind(right.strokes, right.par)),
  );
}
