import { describe, expect, it } from "vitest";
import { matchState, rankFlight, stablefordPoints, stablefordTotal } from "@/lib/golf/formats";

const PAR3 = Array(9).fill(3);

describe("stableford", () => {
  it("awards two points for par and one more per stroke gained", () => {
    expect(stablefordPoints(3, 3)).toBe(2);
    expect(stablefordPoints(2, 3)).toBe(3);
    expect(stablefordPoints(1, 3)).toBe(4);
    expect(stablefordPoints(4, 3)).toBe(1);
    expect(stablefordPoints(5, 3)).toBe(0);
    expect(stablefordPoints(9, 3)).toBe(0);
  });

  it("ignores holes without a score", () => {
    expect(stablefordTotal([3, null, 2], [3, 3, 3])).toBe(5);
  });
});

describe("match play", () => {
  it("is all square before anyone has won a hole", () => {
    const state = matchState([3, 3], [3, 3], 9);
    expect(state).toMatchObject({ lead: 0, label: "AS", decided: false, played: 2, remaining: 7 });
  });

  it("reports the leader's margin while the match is open", () => {
    const state = matchState([2, 3, 2], [3, 3, 3], 9);
    expect(state).toMatchObject({ lead: 2, label: "2 UP", decided: false, winner: null });
  });

  it("ends as soon as the lead exceeds the holes left", () => {
    // A wins the first five holes of nine: 5 up with 4 to play.
    const a = [2, 2, 2, 2, 2, null, null, null, null];
    const b = [3, 3, 3, 3, 3, null, null, null, null];
    expect(matchState(a, b, 9)).toMatchObject({ decided: true, winner: "a", label: "5&4" });
  });

  it("does not let later holes change a decided match", () => {
    const a = [2, 2, 2, 2, 2, 9, 9, 9, 9];
    const b = [3, 3, 3, 3, 3, 3, 3, 3, 3];
    expect(matchState(a, b, 9)).toMatchObject({ decided: true, winner: "a", label: "5&4" });
  });

  it("finishes one up or halved on the last hole", () => {
    const b = Array(9).fill(3);
    expect(matchState([2, ...Array(8).fill(3)], b, 9)).toMatchObject({ decided: true, winner: "a", label: "1 UP" });
    expect(matchState(Array(9).fill(3), b, 9)).toMatchObject({ decided: true, winner: "halved", label: "AS" });
  });

  it("gives the lead to player B as a negative number", () => {
    expect(matchState([4], [3], 9)).toMatchObject({ lead: -1, label: "1 UP" });
  });

  it("copes with holes scored out of order", () => {
    // Only holes 5 to 9 are in: A is five up with four still to be played.
    const a = [null, null, null, null, 2, 2, 2, 2, 2];
    const b = [null, null, null, null, 3, 3, 3, 3, 3];
    expect(matchState(a, b, 9)).toMatchObject({ decided: true, label: "5&4" });
  });
});

describe("rankFlight", () => {
  const flight = [
    { id: "a", position: 1, scores: [3, 3, 3] },
    { id: "b", position: 2, scores: [2, 3, 3] },
    { id: "c", position: 3, scores: [3, 3, 3] },
    { id: "d", position: 4, scores: [null, null, null] },
  ];

  it("ranks stroke play by score to par and shares ranks on ties", () => {
    const ranked = rankFlight(flight, [3, 3, 3], "stroke");
    expect(ranked.map((row) => [row.participant.id, row.rank, row.tied])).toEqual([
      ["b", 1, false],
      ["a", 2, true],
      ["c", 2, true],
      ["d", 4, false],
    ]);
  });

  it("compares players on the holes they have played so far", () => {
    const ranked = rankFlight(
      [
        { id: "slow", position: 1, scores: [2, null, null] },
        { id: "fast", position: 2, scores: [3, 3, 3] },
      ],
      [3, 3, 3],
      "stroke",
    );
    expect(ranked[0].participant.id).toBe("slow");
    expect(ranked[0]).toMatchObject({ toPar: -1, thru: 1 });
  });

  it("ranks stableford by points, highest first", () => {
    const ranked = rankFlight(
      [
        { id: "steady", position: 1, scores: [3, 3, 3] }, // 6 points
        { id: "wild", position: 2, scores: [1, 6, 6] }, // 4 points, more strokes
        { id: "sharp", position: 3, scores: [2, 2, 5] }, // 6 points
      ],
      [3, 3, 3],
      "stableford",
    );
    expect(ranked.map((row) => [row.participant.id, row.rank])).toEqual([
      ["steady", 1],
      ["sharp", 1],
      ["wild", 3],
    ]);
  });

  it("puts the match winner first even with more strokes", () => {
    const ranked = rankFlight(
      [
        { id: "a", position: 1, scores: [2, 2, 9] },
        { id: "b", position: 2, scores: [3, 3, 3] },
      ],
      [3, 3, 3],
      "match",
    );
    expect(ranked[0].participant.id).toBe("a");
    expect(ranked[0].strokes).toBeGreaterThan(ranked[1].strokes);
  });

  it("uses the par list length as the hole count", () => {
    expect(rankFlight([{ id: "a", position: 1, scores: PAR3 }], PAR3, "stroke")[0]).toMatchObject({ rank: 1, thru: 9, toPar: 0 });
  });
});
