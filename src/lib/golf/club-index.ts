/**
 * The club index is an unofficial, handicap-like number: how many strokes over
 * par a player typically needs for nine holes on a good day. It follows the
 * shape of the World Handicap System (best differentials out of the most
 * recent twenty rounds) but uses par instead of course rating and slope, which
 * short courses usually do not have. It is not a WHS handicap.
 */

export const INDEX_WINDOW = 20;
export const INDEX_MIN_ROUNDS = 3;

export interface IndexRound {
  strokes: number;
  par: number;
  holeCount: number;
}

/** How many of the best differentials count for a given number of rounds. */
export function differentialsUsed(roundCount: number): number {
  if (roundCount < INDEX_MIN_ROUNDS) return 0;
  if (roundCount <= 5) return 1;
  if (roundCount <= 8) return 2;
  if (roundCount <= 11) return 3;
  if (roundCount <= 14) return 4;
  if (roundCount <= 16) return 5;
  if (roundCount <= 18) return 6;
  if (roundCount === 19) return 7;
  return 8;
}

/** Strokes over par, normalised to nine holes. */
export function differential(round: IndexRound): number {
  return ((round.strokes - round.par) * 9) / round.holeCount;
}

/**
 * @param recentFirst approved rounds, most recent first
 * @returns the index rounded to one decimal, or `null` below three rounds
 */
export function computeClubIndex(recentFirst: readonly IndexRound[]): number | null {
  const window = recentFirst.slice(0, INDEX_WINDOW);
  const used = differentialsUsed(window.length);
  if (used === 0) return null;
  const best = window
    .map(differential)
    .sort((left, right) => left - right)
    .slice(0, used);
  const average = best.reduce((total, value) => total + value, 0) / best.length;
  return Math.round(average * 10) / 10;
}

/** `4.2`, `0.0`, `+1.5` (better than par, written golf-style with a plus). */
export function formatClubIndex(value: number | null, locale: string = "nl"): string {
  if (value === null) return "–";
  const absolute = Math.abs(value).toLocaleString(locale === "nl" ? "nl-NL" : "en-GB", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return value < 0 ? `+${absolute}` : absolute;
}
