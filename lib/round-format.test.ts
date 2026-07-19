import { describe, expect, it } from "vitest";
import { calculateRoundPar, expandCourseLayout, sourceHoleNumber } from "./round-format";

const nineHoles = Array.from({ length: 9 }, (_, index) => ({ number: index + 1, par: 3, distance: 50 + index }));
const eighteenHoles = Array.from({ length: 18 }, (_, index) => ({ number: index + 1, par: index < 9 ? 3 : 4, distance: 80 + index }));

describe("round format", () => {
  it("repeats a nine-hole course for an eighteen-hole round", () => {
    const layout = expandCourseLayout(nineHoles, 18);
    expect(layout).toHaveLength(18);
    expect(layout[9]).toEqual({ ...nineHoles[0], number: 10 });
    expect(calculateRoundPar(nineHoles, 18)).toBe(54);
  });

  it("uses the first nine holes of an eighteen-hole course", () => {
    const layout = expandCourseLayout(eighteenHoles, 9);
    expect(layout.map((hole) => hole.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(calculateRoundPar(eighteenHoles, 9)).toBe(27);
  });

  it("maps the second loop back to the source course holes", () => {
    expect(sourceHoleNumber(1, 9)).toBe(1);
    expect(sourceHoleNumber(10, 9)).toBe(1);
    expect(sourceHoleNumber(18, 9)).toBe(9);
  });
});
