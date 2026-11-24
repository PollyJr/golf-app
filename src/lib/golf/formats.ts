/**
 * Game formats built on top of plain stroke counts: Stableford points, match
 * play status and the ranking of a flight. Stroke counts are the only thing
 * stored; every format is derived, so a round can be re-read in any format.
 */
import { holesPlayed, toPar, totalStrokes, type RoundFormat, type Strokes } from "./scoring";

// ------------------------------------------------------------ stableford --

/** Gross Stableford: par = 2 points, each stroke better adds one, bogey = 1. */
export function stablefordPoints(strokes: number, par: number): number {
  return Math.max(0, 2 + par - strokes);
}

export function stablefordTotal(scores: readonly Strokes[], pars: readonly number[]): number {
  return scores.reduce<number>(
    (total, strokes, index) => total + (strokes === null ? 0 : stablefordPoints(strokes, pars[index] ?? 3)),
    0,
  );
}

// ------------------------------------------------------------ match play --

export type HoleWinner = "a" | "b" | "halved" | null;

export interface MatchState {
  /** Winner per hole; `null` while either player still has to score it. */
  holes: HoleWinner[];
  /** Holes up for player A. Negative when B leads. */
  lead: number;
  played: number;
  remaining: number;
  /** True once the trailing player can no longer catch up, or all holes are played. */
  decided: boolean;
  winner: "a" | "b" | "halved" | null;
  /** Conventional notation: `AS`, `2 UP`, `3&2`, `1 UP` (final), `DORMIE` is not used. */
  label: string;
}

/**
 * Computes the state of a match between two players. Holes count in order;
 * once the match is decided, later holes no longer change the result.
 */
export function matchState(a: readonly Strokes[], b: readonly Strokes[], holeCount: number): MatchState {
  const holes: HoleWinner[] = [];
  let lead = 0;
  let played = 0;
  let decided = false;
  let decidedLead = 0;
  let decidedRemaining = 0;

  for (let index = 0; index < holeCount; index += 1) {
    const strokesA = a[index] ?? null;
    const strokesB = b[index] ?? null;
    if (strokesA === null || strokesB === null) {
      holes.push(null);
      continue;
    }
    const winner: HoleWinner = strokesA < strokesB ? "a" : strokesB < strokesA ? "b" : "halved";
    holes.push(winner);
    if (decided) continue;
    played += 1;
    if (winner === "a") lead += 1;
    if (winner === "b") lead -= 1;
    // Holes still to be decided, wherever they are on the card: scores may be
    // entered out of order.
    const remaining = holeCount - played;
    if (Math.abs(lead) > remaining) {
      decided = true;
      decidedLead = lead;
      decidedRemaining = remaining;
    }
  }

  const allPlayed = holes.every((hole) => hole !== null);
  if (decided) {
    const margin = Math.abs(decidedLead);
    return {
      holes,
      lead: decidedLead,
      played,
      remaining: decidedRemaining,
      decided: true,
      winner: decidedLead > 0 ? "a" : "b",
      label: decidedRemaining === 0 ? `${margin} UP` : `${margin}&${decidedRemaining}`,
    };
  }

  const remaining = holeCount - played;
  if (allPlayed) {
    return {
      holes,
      lead,
      played,
      remaining: 0,
      decided: true,
      winner: lead === 0 ? "halved" : lead > 0 ? "a" : "b",
      label: lead === 0 ? "AS" : `${Math.abs(lead)} UP`,
    };
  }
  return {
    holes,
    lead,
    played,
    remaining,
    decided: false,
    winner: null,
    label: lead === 0 ? "AS" : `${Math.abs(lead)} UP`,
  };
}

// --------------------------------------------------------------- ranking --

export interface RankInput {
  id: string;
  position: number;
  scores: readonly Strokes[];
}

export interface Ranked<T extends RankInput> {
  participant: T;
  rank: number;
  tied: boolean;
  strokes: number;
  toPar: number;
  points: number;
  thru: number;
}

/**
 * Ranks a flight for the given format.
 *  - stroke:     lowest score to par over the holes played, then fewer strokes.
 *  - stableford: most points.
 *  - match:      the match winner first (two players only); otherwise as stroke.
 * Players who have not started rank last. Equal results share a rank.
 */
export function rankFlight<T extends RankInput>(
  participants: readonly T[],
  pars: readonly number[],
  format: RoundFormat,
): Ranked<T>[] {
  const holeCount = pars.length;
  const rows = participants.map((participant) => ({
    participant,
    strokes: totalStrokes(participant.scores),
    toPar: toPar(participant.scores, pars),
    points: stablefordTotal(participant.scores, pars),
    thru: holesPlayed(participant.scores),
  }));

  let matchLead: Map<string, number> | null = null;
  if (format === "match" && participants.length === 2) {
    const state = matchState(participants[0].scores, participants[1].scores, holeCount);
    matchLead = new Map([
      [participants[0].id, state.lead],
      [participants[1].id, -state.lead],
    ]);
  }

  const key = (row: (typeof rows)[number]): number[] => {
    if (row.thru === 0) return [1, 0, 0];
    if (matchLead) return [0, -(matchLead.get(row.participant.id) ?? 0), 0];
    if (format === "stableford") return [0, -row.points, 0];
    return [0, row.toPar, row.strokes];
  };

  const compare = (left: number[], right: number[]) => {
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) return left[index] - right[index];
    }
    return 0;
  };

  const sorted = [...rows].sort(
    (left, right) => compare(key(left), key(right)) || left.participant.position - right.participant.position,
  );

  const ranked: Ranked<T>[] = [];
  sorted.forEach((row, index) => {
    const previous = index > 0 ? sorted[index - 1] : null;
    const sameAsPrevious = previous !== null && compare(key(previous), key(row)) === 0;
    ranked.push({ ...row, rank: sameAsPrevious ? ranked[index - 1].rank : index + 1, tied: false });
  });
  for (const row of ranked) {
    row.tied = ranked.filter((other) => other.rank === row.rank).length > 1;
  }
  return ranked;
}
