import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_KEYS, ACHIEVEMENT_TIERS, evaluateAchievements, type HistoryRound } from "@/lib/golf/achievements";

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 0, 5); // a Monday

function round(day: number, scores: (number | null)[], extra: Partial<HistoryRound> = {}): HistoryRound {
  return {
    roundId: `r${day}`,
    completedAt: new Date(START + day * DAY),
    holeCount: scores.length,
    scores,
    pars: scores.map(() => 3),
    partnerIds: [],
    wonFlight: false,
    ...extra,
  };
}

const bogeyGolf = Array(9).fill(4);

describe("achievements", () => {
  it("has a tier for every key", () => {
    for (const key of ACHIEVEMENT_KEYS) expect(ACHIEVEMENT_TIERS[key]).toBeDefined();
  });

  it("awards nothing without rounds", () => {
    expect(evaluateAchievements([]).size).toBe(0);
  });

  it("awards the first round and points at it", () => {
    const earned = evaluateAchievements([round(0, bogeyGolf)]);
    expect([...earned.keys()]).toEqual(["first_round"]);
    expect(earned.get("first_round")).toBe("r0");
  });

  it("points count milestones at the round that crossed the line", () => {
    const history = Array.from({ length: 12 }, (_, index) => round(index * 30, bogeyGolf));
    const earned = evaluateAchievements(history);
    expect(earned.get("rounds_10")).toBe("r270");
    expect(earned.has("rounds_25")).toBe(false);
  });

  it("recognises scoring feats", () => {
    const earned = evaluateAchievements([round(0, [1, 2, 2, 2, 3, 3, 3, 3, 3])]);
    for (const key of ["ace", "first_birdie", "birdie_streak", "under_par", "level_par", "bogey_free"] as const) {
      expect(earned.has(key), key).toBe(true);
    }
  });

  it("requires a complete card for whole-round achievements", () => {
    const earned = evaluateAchievements([round(0, [2, 2, 2, null, null, null, null, null, null])]);
    expect(earned.has("under_par")).toBe(false);
    expect(earned.has("bogey_free")).toBe(false);
    expect(earned.has("birdie_streak")).toBe(true);
  });

  it("awards an eighteen-hole round", () => {
    expect(evaluateAchievements([round(0, Array(18).fill(4))]).has("full_eighteen")).toBe(true);
  });

  it("counts flight wins and distinct partners", () => {
    const history = Array.from({ length: 5 }, (_, index) =>
      round(index * 30, bogeyGolf, { wonFlight: true, partnerIds: [`p${index}`] }),
    );
    const earned = evaluateAchievements(history);
    expect(earned.get("flight_winner")).toBe("r120");
    expect(earned.get("social")).toBe("r120");
    expect(evaluateAchievements(history.slice(0, 4)).has("flight_winner")).toBe(false);
  });

  it("awards regular play for four consecutive weeks only", () => {
    const weekly = [0, 7, 14, 21].map((day) => round(day, bogeyGolf));
    expect(evaluateAchievements(weekly).has("regular")).toBe(true);
    const gapped = [0, 7, 21, 28].map((day) => round(day, bogeyGolf));
    expect(evaluateAchievements(gapped).has("regular")).toBe(false);
  });
});
