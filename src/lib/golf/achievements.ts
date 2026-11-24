/**
 * Achievements are earned from approved rounds. The evaluation is pure: given a
 * player's history it returns every key earned, so the server can diff against
 * what is stored and award the new ones.
 */
import { longestBirdieStreak, scoreKind, type Strokes } from "./scoring";

export const ACHIEVEMENT_KEYS = [
  "first_round",
  "rounds_10",
  "rounds_25",
  "rounds_50",
  "rounds_100",
  "first_birdie",
  "ace",
  "level_par",
  "under_par",
  "bogey_free",
  "birdie_streak",
  "full_eighteen",
  "flight_winner",
  "social",
  "regular",
] as const;

export type AchievementKey = (typeof ACHIEVEMENT_KEYS)[number];

export type AchievementTier = "bronze" | "silver" | "gold";

export const ACHIEVEMENT_TIERS: Record<AchievementKey, AchievementTier> = {
  first_round: "bronze",
  rounds_10: "bronze",
  rounds_25: "silver",
  rounds_50: "silver",
  rounds_100: "gold",
  first_birdie: "bronze",
  ace: "gold",
  level_par: "silver",
  under_par: "gold",
  bogey_free: "silver",
  birdie_streak: "gold",
  full_eighteen: "bronze",
  flight_winner: "silver",
  social: "bronze",
  regular: "silver",
};

export function isAchievementKey(value: string): value is AchievementKey {
  return (ACHIEVEMENT_KEYS as readonly string[]).includes(value);
}

export interface HistoryRound {
  roundId: string;
  completedAt: Date;
  holeCount: number;
  scores: readonly Strokes[];
  pars: readonly number[];
  /** Ids of the other registered players in the flight. */
  partnerIds: readonly string[];
  /** True when this player won a flight of two or more outright. */
  wonFlight: boolean;
}

const WINS_FOR_FLIGHT_WINNER = 5;
const PARTNERS_FOR_SOCIAL = 5;
const WEEKS_FOR_REGULAR = 4;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Monday-based week number since the epoch, good enough to detect consecutive weeks. */
function weekNumber(date: Date): number {
  const thursdayOffset = 3 * 24 * 60 * 60 * 1000;
  return Math.floor((date.getTime() + thursdayOffset) / MS_PER_WEEK);
}

function longestWeekStreak(rounds: readonly HistoryRound[]): number {
  const weeks = [...new Set(rounds.map((round) => weekNumber(round.completedAt)))].sort((a, b) => a - b);
  let best = 0;
  let current = 0;
  weeks.forEach((week, index) => {
    current = index > 0 && week === weeks[index - 1] + 1 ? current + 1 : 1;
    best = Math.max(best, current);
  });
  return best;
}

/**
 * @returns for every earned key the round that (first) earned it, when one
 * round can be pointed at; count-based achievements point at the round that
 * crossed the threshold.
 */
export function evaluateAchievements(history: readonly HistoryRound[]): Map<AchievementKey, string | null> {
  const earned = new Map<AchievementKey, string | null>();
  const rounds = [...history].sort((left, right) => left.completedAt.getTime() - right.completedAt.getTime());
  const award = (key: AchievementKey, roundId: string | null) => {
    if (!earned.has(key)) earned.set(key, roundId);
  };

  const countThresholds: Array<[number, AchievementKey]> = [
    [1, "first_round"],
    [10, "rounds_10"],
    [25, "rounds_25"],
    [50, "rounds_50"],
    [100, "rounds_100"],
  ];
  for (const [threshold, key] of countThresholds) {
    if (rounds.length >= threshold) award(key, rounds[threshold - 1].roundId);
  }

  const partners = new Set<string>();
  let wins = 0;

  for (const round of rounds) {
    const complete = round.scores.length === round.holeCount && round.scores.every((strokes) => strokes !== null);
    let strokes = 0;
    let par = 0;
    let overPar = false;

    round.scores.forEach((value, index) => {
      if (value === null) return;
      const holePar = round.pars[index] ?? 3;
      strokes += value;
      par += holePar;
      const kind = scoreKind(value, holePar);
      if (kind === "ace") award("ace", round.roundId);
      if (kind === "ace" || kind === "albatross" || kind === "eagle" || kind === "birdie") {
        award("first_birdie", round.roundId);
      }
      if (value > holePar) overPar = true;
    });

    if (complete) {
      if (strokes <= par) award("level_par", round.roundId);
      if (strokes < par) award("under_par", round.roundId);
      if (!overPar) award("bogey_free", round.roundId);
      if (round.holeCount === 18) award("full_eighteen", round.roundId);
    }
    if (longestBirdieStreak(round.scores, round.pars) >= 3) award("birdie_streak", round.roundId);

    if (round.wonFlight) {
      wins += 1;
      if (wins >= WINS_FOR_FLIGHT_WINNER) award("flight_winner", round.roundId);
    }
    for (const partnerId of round.partnerIds) partners.add(partnerId);
    if (partners.size >= PARTNERS_FOR_SOCIAL) award("social", round.roundId);
  }

  if (longestWeekStreak(rounds) >= WEEKS_FOR_REGULAR) award("regular", null);
  return earned;
}
