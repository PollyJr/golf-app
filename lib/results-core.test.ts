import { describe, expect, it } from "vitest";
import { formatToPar, rankRoundParticipants } from "./results-core";
import type { LiveRoundParticipant } from "./types";

function participant(name: string, position: number, strokes: number, par = 27): LiveRoundParticipant {
  return { id: name, playerId: name, name, initials: name.slice(0, 1), position, invitationStatus: "accepted", totalStrokes: strokes, totalPar: par, scores: Array(9).fill(3) };
}

describe("round results", () => {
  it("ranks the lowest score to par first and preserves ties", () => {
    const ranked = rankRoundParticipants([participant("B", 2, 30), participant("A", 1, 25), participant("C", 3, 30)]);
    expect(ranked.map((entry) => [entry.name, entry.rank])).toEqual([["A", 1], ["B", 2], ["C", 2]]);
  });

  it("keeps a shared first place for a three-way tie", () => {
    const ranked = rankRoundParticipants([participant("A", 1, 27), participant("B", 2, 27), participant("C", 3, 27)]);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 1, 1]);
  });

  it("formats relative scores for the result board", () => {
    expect([formatToPar(-2), formatToPar(0), formatToPar(3)]).toEqual(["-2", "E", "+3"]);
  });
});
