import { describe, expect, it } from "vitest";
import { completedScoreCount, etagMatches, invitationsComplete, revisionEtag, roundIsComplete, shareExpiry } from "./rounds-core";

describe("live round rules", () => {
  it("counts only entered scores", () => {
    expect(completedScoreCount([{ scores: [3, null, 4] }, { scores: [null, 2, 3] }])).toBe(4);
  });

  it("requires every score for every participant", () => {
    expect(roundIsComplete([{ scores: Array(9).fill(3) }, { scores: Array(9).fill(4) }], 9)).toBe(true);
    expect(roundIsComplete([{ scores: [...Array(8).fill(3), null] }], 9)).toBe(false);
    expect(roundIsComplete([], 9)).toBe(false);
  });

  it("supports complete 18-hole rounds", () => {
    expect(roundIsComplete([{ scores: Array(18).fill(4) }], 18)).toBe(true);
  });

  it("keeps a shared round locked until every invitation is accepted", () => {
    expect(invitationsComplete([{ invitationStatus: "accepted" }, { invitationStatus: "pending" }])).toBe(false);
    expect(invitationsComplete([{ invitationStatus: "accepted" }, { invitationStatus: "accepted" }])).toBe(true);
  });

  it("expires public links exactly 24 hours after completion", () => {
    const completed = new Date("2026-07-17T10:00:00.000Z");
    expect(shareExpiry(completed).toISOString()).toBe("2026-07-18T10:00:00.000Z");
  });

  it("uses stable revision ETags", () => {
    expect(revisionEtag(7)).toBe('"round-7"');
    expect(etagMatches('"other", "round-7"', 7)).toBe(true);
    expect(etagMatches('"round-8"', 7)).toBe(false);
  });
});
