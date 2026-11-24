import { describe, expect, it } from "vitest";
import {
  distributionOf,
  expandLayout,
  formatToPar,
  holesPlayed,
  isComplete,
  longestBirdieStreak,
  nextOpenHole,
  roundPar,
  scoreKind,
  sourceHoleNumber,
  toPar,
  totalStrokes,
} from "@/lib/golf/scoring";

describe("scoreKind", () => {
  it("names results relative to par", () => {
    expect(scoreKind(2, 3)).toBe("birdie");
    expect(scoreKind(3, 3)).toBe("par");
    expect(scoreKind(4, 3)).toBe("bogey");
    expect(scoreKind(5, 3)).toBe("double");
    expect(scoreKind(7, 3)).toBe("worse");
    expect(scoreKind(3, 5)).toBe("eagle");
    expect(scoreKind(2, 5)).toBe("albatross");
  });

  it("calls every hole-in-one an ace, whatever the par", () => {
    expect(scoreKind(1, 3)).toBe("ace");
    expect(scoreKind(1, 4)).toBe("ace");
  });
});

describe("formatToPar", () => {
  it("writes level par as E and uses a real minus sign", () => {
    expect(formatToPar(0)).toBe("E");
    expect(formatToPar(3)).toBe("+3");
    expect(formatToPar(-2)).toBe("−2");
  });
});

describe("layouts", () => {
  const nine = Array.from({ length: 9 }, (_, index) => ({ number: index + 1, par: index === 3 ? 4 : 3, distance: 50 }));

  it("plays a nine-hole course twice for an eighteen-hole round", () => {
    const layout = expandLayout(nine, 18);
    expect(layout).toHaveLength(18);
    expect(layout[12]).toMatchObject({ number: 13, par: 4 });
    expect(sourceHoleNumber(13, 9)).toBe(4);
    expect(sourceHoleNumber(9, 9)).toBe(9);
    expect(sourceHoleNumber(10, 18)).toBe(10);
  });

  it("plays only the first nine of an eighteen-hole course for a short round", () => {
    const eighteen = Array.from({ length: 18 }, (_, index) => ({ number: index + 1, par: index < 9 ? 3 : 5, distance: 100 }));
    expect(expandLayout(eighteen, 9).map((hole) => hole.par)).toEqual(Array(9).fill(3));
  });

  it("sums par over the holes of the round", () => {
    expect(roundPar(nine, 9)).toBe(28);
    expect(roundPar(nine, 18)).toBe(56);
    expect(roundPar([], 9)).toBe(0);
  });
});

describe("totals", () => {
  const pars = [3, 3, 3, 3];

  it("counts only holes that have a score", () => {
    const scores = [3, null, 2, null];
    expect(totalStrokes(scores)).toBe(5);
    expect(holesPlayed(scores)).toBe(2);
    expect(toPar(scores, pars)).toBe(-1);
    expect(isComplete(scores, 4)).toBe(false);
    expect(isComplete([3, 3, 3, 3], 4)).toBe(true);
  });

  it("finds the first hole someone still has to score", () => {
    expect(nextOpenHole([[3, 3, null], [3, null, null]], 3)).toBe(1);
    expect(nextOpenHole([[3, 3, 3]], 3)).toBe(2);
  });

  it("tallies the distribution and the longest birdie run", () => {
    const scores = [1, 2, 2, 3, 4, 2, 2, 2, 6];
    const par = Array(9).fill(3);
    expect(distributionOf(scores, par)).toMatchObject({ ace: 1, birdie: 5, par: 1, bogey: 1, worse: 1 });
    expect(longestBirdieStreak(scores, par)).toBe(3);
  });
});
