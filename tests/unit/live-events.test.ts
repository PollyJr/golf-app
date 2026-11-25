import { describe, expect, it } from "vitest";
import { celebrationsOf, currentHole, diffRounds, isCelebrated, newHighlights, soleLeader } from "@/lib/live-events";
import type { Strokes } from "@/lib/golf/scoring";
import type { RoundParticipantDto, RoundSnapshot } from "@/lib/types";

const PARS = [3, 3, 4, 3, 3, 3, 3, 3, 3];

function player(id: string, name: string, scores: Strokes[], position = 1): RoundParticipantDto {
  return {
    id,
    playerId: null,
    name,
    initials: name.slice(0, 2).toUpperCase(),
    guest: false,
    position,
    invitation: "accepted",
    scores: [...scores, ...Array<Strokes>(PARS.length - scores.length).fill(null)],
    putts: Array(PARS.length).fill(null),
  };
}

function round(participants: RoundParticipantDto[], overrides: Partial<RoundSnapshot> = {}): RoundSnapshot {
  return {
    id: "round-1",
    revision: 1,
    status: "active",
    format: "stroke",
    trackPutts: false,
    holeCount: 9,
    starterId: "",
    starterName: "Sanne",
    clubName: "Club",
    theme: { primaryColor: "#0f3b2a", accentColor: "#c9f04b" },
    timeZone: "Europe/Amsterdam",
    createdAt: "2026-11-25T10:00:00.000Z",
    startedAt: "2026-11-25T10:00:00.000Z",
    completedAt: null,
    rejectionReason: null,
    course: {
      id: "course-1",
      name: "De Baan",
      accent: "#1b7447",
      tee: "Geel",
      par: PARS.reduce((sum, par) => sum + par, 0),
      holes: PARS.map((par, index) => ({ number: index + 1, par, distance: 60 })),
    },
    event: null,
    participants,
    activity: [],
    ...overrides,
  };
}

describe("diffRounds", () => {
  it("reports nothing when nothing changed", () => {
    const snapshot = round([player("a", "Sanne", [3]), player("b", "Daan", [3], 2)]);
    expect(diffRounds(snapshot, structuredClone(snapshot))).toEqual([]);
  });

  it("turns a new score into an event with its result", () => {
    const before = round([player("a", "Sanne", [3])]);
    const after = round([player("a", "Sanne", [3, 2])]);
    expect(diffRounds(before, after)).toEqual([
      { kind: "score", participantId: "a", name: "Sanne", hole: 2, strokes: 2, par: 3, result: "birdie", corrected: false },
    ]);
  });

  it("marks a changed score as a correction and a removed one as cleared", () => {
    const before = round([player("a", "Sanne", [3, 4])]);
    const after = round([player("a", "Sanne", [2, null])]);
    expect(diffRounds(before, after)).toEqual([
      { kind: "score", participantId: "a", name: "Sanne", hole: 1, strokes: 2, par: 3, result: "birdie", corrected: true },
      { kind: "cleared", participantId: "a", name: "Sanne", hole: 2 },
    ]);
  });

  it("orders scores hole by hole, then by player", () => {
    const before = round([player("a", "Sanne", []), player("b", "Daan", [], 2)]);
    const after = round([player("a", "Sanne", [3, 3]), player("b", "Daan", [4], 2)]);
    const holes = diffRounds(before, after).map((event) => (event.kind === "score" ? `${event.hole}${event.participantId}` : event.kind));
    expect(holes).toEqual(["1a", "1b", "2a"]);
  });

  it("reports players who joined or left", () => {
    const before = round([player("a", "Sanne", []), player("b", "Daan", [], 2)]);
    const after = round([player("a", "Sanne", []), player("c", "Mila", [], 3)]);
    expect(diffRounds(before, after)).toEqual([
      { kind: "joined", participantId: "c", name: "Mila" },
      { kind: "left", participantId: "b", name: "Daan" },
    ]);
  });

  it("announces a new sole leader once scoring has begun", () => {
    const before = round([player("a", "Sanne", [3]), player("b", "Daan", [3], 2)]);
    const after = round([player("a", "Sanne", [3, 4]), player("b", "Daan", [3, 2], 2)]);
    expect(diffRounds(before, after)).toContainEqual({ kind: "lead", participantId: "b", name: "Daan" });
  });

  it("does not call the first score of the round a change of lead", () => {
    const before = round([player("a", "Sanne", []), player("b", "Daan", [], 2)]);
    const after = round([player("a", "Sanne", [2]), player("b", "Daan", [], 2)]);
    expect(diffRounds(before, after).some((event) => event.kind === "lead")).toBe(false);
  });

  it("does not repeat the lead when the same player extends it", () => {
    const before = round([player("a", "Sanne", [2]), player("b", "Daan", [3], 2)]);
    const after = round([player("a", "Sanne", [2, 2]), player("b", "Daan", [3, 3], 2)]);
    expect(diffRounds(before, after).some((event) => event.kind === "lead")).toBe(false);
  });

  it("reports a change of status", () => {
    const before = round([player("a", "Sanne", [])], { status: "inviting" });
    const after = round([player("a", "Sanne", [])], { status: "active" });
    expect(diffRounds(before, after)).toEqual([{ kind: "status", from: "inviting", to: "active" }]);
  });

  it("compares nothing across different rounds", () => {
    const before = round([player("a", "Sanne", [])]);
    const after = round([player("a", "Sanne", [1])], { id: "round-2" });
    expect(diffRounds(before, after)).toEqual([]);
  });
});

describe("celebrations", () => {
  it("celebrates fresh birdies and better, not corrections or pars", () => {
    const before = round([player("a", "Sanne", [3, 3]), player("b", "Daan", [], 2)]);
    const after = round([player("a", "Sanne", [2, 3, 4]), player("b", "Daan", [1, 2], 2)]);
    const events = diffRounds(before, after);
    expect(events.filter(isCelebrated).map((event) => `${event.participantId}${event.hole}`)).toEqual(["b1", "b2"]);
  });

  it("puts the best result first", () => {
    const before = round([player("a", "Sanne", []), player("b", "Daan", [], 2)]);
    const after = round([player("a", "Sanne", [2, 2, 2]), player("b", "Daan", [3, 1], 2)]);
    expect(celebrationsOf(diffRounds(before, after)).map((event) => event.result)).toEqual(["ace", "eagle", "birdie", "birdie"]);
  });
});

describe("soleLeader and currentHole", () => {
  it("names nobody while the lead is shared or nobody has played", () => {
    expect(soleLeader(round([player("a", "Sanne", []), player("b", "Daan", [], 2)]))).toBeNull();
    expect(soleLeader(round([player("a", "Sanne", [3]), player("b", "Daan", [3], 2)]))).toBeNull();
    expect(soleLeader(round([player("a", "Sanne", [2]), player("b", "Daan", [3], 2)]))).toEqual({ id: "a", name: "Sanne" });
  });

  it("has no leader in a round played alone", () => {
    expect(soleLeader(round([player("a", "Sanne", [2])]))).toBeNull();
  });

  it("is on the first hole somebody still has to score", () => {
    expect(currentHole(round([player("a", "Sanne", [3, 3]), player("b", "Daan", [3], 2)]))).toBe(2);
    expect(currentHole(round([player("a", "Sanne", Array(9).fill(3))]))).toBe(9);
  });
});

describe("newHighlights", () => {
  const latest = (hole: number, strokes: number, par = 3, at = `2026-11-25T10:0${hole}:00.000Z`) => ({
    playerId: "p1",
    name: "Daan",
    hole,
    strokes,
    par,
    at,
  });

  it("reports a new birdie or better in a flight that was already on the board", () => {
    expect(newHighlights([{ id: "f1", latest: latest(1, 3) }], [{ id: "f1", latest: latest(2, 2) }])).toEqual([latest(2, 2)]);
  });

  it("ignores pars and worse, unchanged scores and flights that just appeared", () => {
    expect(newHighlights([{ id: "f1", latest: latest(1, 3) }], [{ id: "f1", latest: latest(2, 4) }])).toEqual([]);
    expect(newHighlights([{ id: "f1", latest: latest(2, 2) }], [{ id: "f1", latest: latest(2, 2) }])).toEqual([]);
    expect(newHighlights([], [{ id: "f2", latest: latest(1, 1) }])).toEqual([]);
  });

  it("puts a hole-in-one before a birdie", () => {
    const flights = [
      { id: "f1", latest: null },
      { id: "f2", latest: null },
    ];
    const result = newHighlights(flights, [
      { id: "f1", latest: latest(4, 2) },
      { id: "f2", latest: { ...latest(5, 1), playerId: "p2", name: "Mila" } },
    ]);
    expect(result.map((item) => item.name)).toEqual(["Mila", "Daan"]);
  });
});
