import { describe, expect, it } from "vitest";
import { summarizeRounds, type StatRound } from "@/lib/golf/stats";

function round(index: number, scores: (number | null)[], extra: Partial<StatRound> = {}): StatRound {
  return {
    roundId: `r${index}`,
    completedAt: new Date(Date.UTC(2026, 0, 1 + index)),
    courseId: "course",
    courseName: "Testbaan",
    holeCount: scores.length,
    courseHoleCount: 9,
    scores,
    pars: scores.map(() => 3),
    putts: scores.map(() => null),
    ...extra,
  };
}

describe("summarizeRounds", () => {
  it("returns empty statistics without rounds", () => {
    const stats = summarizeRounds([]);
    expect(stats).toMatchObject({ rounds: 0, holes: 0, averagePer9: null, best: null, form: null, lastPlayedAt: null });
  });

  it("averages per nine holes so short and long rounds compare", () => {
    const stats = summarizeRounds([round(0, Array(9).fill(4)), round(1, Array(18).fill(4))]);
    expect(stats.rounds).toBe(2);
    expect(stats.holes).toBe(27);
    expect(stats.averagePer9).toBe(9);
    expect(stats.distribution.bogey).toBe(27);
    expect(stats.parOrBetterRate).toBe(0);
  });

  it("picks the best round relative to par per nine", () => {
    const stats = summarizeRounds([round(0, Array(9).fill(4)), round(1, [...Array(8).fill(3), 2]), round(2, Array(9).fill(5))]);
    expect(stats.best).toMatchObject({ roundId: "r1", toPar: -1, strokes: 26 });
    expect(stats.trend.map((point) => point.roundId)).toEqual(["r0", "r1", "r2"]);
  });

  it("folds the second loop of a nine-hole course onto the same holes", () => {
    const card = [3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 3, 3, 3, 3, 3, 3, 3, 3];
    const course = summarizeRounds([round(0, card)]).courses[0];
    expect(course.holes).toHaveLength(9);
    expect(course.holes[0]).toMatchObject({ hole: 1, rounds: 2, average: 4, best: 3, toPar: 1 });
  });

  it("reports putts only for holes where they were tracked", () => {
    const stats = summarizeRounds([round(0, Array(9).fill(3), { putts: [2, 2, 1, null, null, null, null, null, null] })]);
    expect(stats.puttHoles).toBe(3);
    expect(stats.averagePutts).toBeCloseTo(5 / 3);
  });

  it("measures form as recent five against the five before", () => {
    const worse = Array.from({ length: 5 }, (_, index) => round(index, Array(9).fill(5)));
    const better = Array.from({ length: 5 }, (_, index) => round(5 + index, Array(9).fill(4)));
    expect(summarizeRounds([...worse, ...better]).form).toBe(-9);
    expect(summarizeRounds(worse).form).toBeNull();
  });

  it("leaves unfinished cards out of round counts but keeps their holes", () => {
    const stats = summarizeRounds([round(0, [3, 3, null, null, null, null, null, null, null])]);
    expect(stats.rounds).toBe(0);
    expect(stats.holes).toBe(2);
  });
});
