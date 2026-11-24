/**
 * Core golf scoring helpers. Everything here is pure and shared between the
 * server (authoritative totals, statistics) and the client (optimistic UI).
 */

export type HoleCount = 9 | 18;
export type RoundFormat = "stroke" | "stableford" | "match";
export type Strokes = number | null;

export const ROUND_FORMATS: readonly RoundFormat[] = ["stroke", "stableford", "match"];
export const MIN_STROKES = 1;
export const MAX_STROKES = 12;
export const MAX_PUTTS = 12;
export const MAX_FLIGHT_SIZE = 4;

export interface HoleInfo {
  number: number;
  par: number;
  distance: number;
  name?: string | null;
  tip?: string | null;
}

export type ScoreKind = "ace" | "albatross" | "eagle" | "birdie" | "par" | "bogey" | "double" | "worse";

export const SCORE_KINDS: readonly ScoreKind[] = ["ace", "albatross", "eagle", "birdie", "par", "bogey", "double", "worse"];

/** Classifies one hole result. A hole-in-one is always an ace, whatever the par. */
export function scoreKind(strokes: number, par: number): ScoreKind {
  if (strokes === 1) return "ace";
  const diff = strokes - par;
  if (diff <= -3) return "albatross";
  if (diff === -2) return "eagle";
  if (diff === -1) return "birdie";
  if (diff === 0) return "par";
  if (diff === 1) return "bogey";
  if (diff === 2) return "double";
  return "worse";
}

/** `E`, `+3`, `−2`. Uses a real minus sign so columns of scores line up. */
export function formatToPar(value: number): string {
  if (value === 0) return "E";
  return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
}

/**
 * A 9-hole course can be played as an 18-hole round by going round twice.
 * Maps a hole of the round (1–18) to the hole of the course it is played on.
 */
export function sourceHoleNumber(roundHoleNumber: number, courseHoleCount: number): number {
  return ((roundHoleNumber - 1) % courseHoleCount) + 1;
}

/** Expands a course layout to the number of holes of the round. */
export function expandLayout<T extends { number: number }>(layout: readonly T[], holeCount: number): T[] {
  if (layout.length === 0) return [];
  return Array.from({ length: holeCount }, (_, index) => ({
    ...layout[index % layout.length],
    number: index + 1,
  }));
}

export function layoutPar(layout: readonly { par: number }[]): number {
  return layout.reduce((total, hole) => total + hole.par, 0);
}

export function roundPar(courseLayout: readonly { par: number }[], holeCount: number): number {
  if (courseLayout.length === 0) return 0;
  let total = 0;
  for (let index = 0; index < holeCount; index += 1) total += courseLayout[index % courseLayout.length].par;
  return total;
}

export function totalStrokes(scores: readonly Strokes[]): number {
  return scores.reduce<number>((total, strokes) => total + (strokes ?? 0), 0);
}

export function holesPlayed(scores: readonly Strokes[]): number {
  return scores.reduce<number>((count, strokes) => count + (strokes === null ? 0 : 1), 0);
}

/** Score relative to par over the holes that have been played so far. */
export function toPar(scores: readonly Strokes[], pars: readonly number[]): number {
  let total = 0;
  scores.forEach((strokes, index) => {
    if (strokes !== null) total += strokes - (pars[index] ?? 0);
  });
  return total;
}

export function isComplete(scores: readonly Strokes[], holeCount: number): boolean {
  return scores.length === holeCount && scores.every((strokes) => strokes !== null);
}

/** Next hole (0-based) that still misses a score for anyone, or the last hole. */
export function nextOpenHole(scoresByPlayer: readonly (readonly Strokes[])[], holeCount: number): number {
  for (let hole = 0; hole < holeCount; hole += 1) {
    if (scoresByPlayer.some((scores) => (scores[hole] ?? null) === null)) return hole;
  }
  return Math.max(0, holeCount - 1);
}

export interface ScoreDistribution {
  ace: number;
  albatross: number;
  eagle: number;
  birdie: number;
  par: number;
  bogey: number;
  double: number;
  worse: number;
}

export function emptyDistribution(): ScoreDistribution {
  return { ace: 0, albatross: 0, eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0, worse: 0 };
}

export function distributionOf(scores: readonly Strokes[], pars: readonly number[]): ScoreDistribution {
  const distribution = emptyDistribution();
  scores.forEach((strokes, index) => {
    if (strokes !== null) distribution[scoreKind(strokes, pars[index] ?? 3)] += 1;
  });
  return distribution;
}

/** Longest run of consecutive holes at birdie or better. */
export function longestBirdieStreak(scores: readonly Strokes[], pars: readonly number[]): number {
  let best = 0;
  let current = 0;
  scores.forEach((strokes, index) => {
    if (strokes !== null && strokes < (pars[index] ?? 3)) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });
  return best;
}
