import { describe, expect, it } from "vitest";
import { computeClubIndex, differential, differentialsUsed, formatClubIndex } from "@/lib/golf/club-index";

const round = (over: number, holeCount = 9) => ({ strokes: holeCount * 3 + over, par: holeCount * 3, holeCount });

describe("club index", () => {
  it("needs three rounds", () => {
    expect(computeClubIndex([])).toBeNull();
    expect(computeClubIndex([round(4), round(5)])).toBeNull();
    expect(computeClubIndex([round(4), round(5), round(6)])).toBe(4);
  });

  it("averages the best differentials of the window", () => {
    expect(differentialsUsed(6)).toBe(2);
    expect(computeClubIndex([round(6), round(2), round(9), round(4), round(8), round(7)])).toBe(3);
  });

  it("uses eight of twenty and ignores older rounds", () => {
    expect(differentialsUsed(20)).toBe(8);
    const recent = Array.from({ length: 20 }, () => round(5));
    const oldAndBrilliant = Array.from({ length: 10 }, () => round(-3));
    expect(computeClubIndex([...recent, ...oldAndBrilliant])).toBe(5);
  });

  it("normalises eighteen-hole rounds to nine holes", () => {
    expect(differential(round(8, 18))).toBe(4);
  });

  it("can be better than par", () => {
    expect(computeClubIndex([round(-1), round(-1), round(-1)])).toBe(-1);
  });

  it("formats like a handicap", () => {
    expect(formatClubIndex(4.2, "nl")).toBe("4,2");
    expect(formatClubIndex(4.2, "en")).toBe("4.2");
    expect(formatClubIndex(-1.5, "en")).toBe("+1.5");
    expect(formatClubIndex(null)).toBe("–");
  });
});
