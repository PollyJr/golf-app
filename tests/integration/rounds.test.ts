import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { many, one } from "@/server/db";
import { getLeaderboard } from "@/server/services/leaderboards";
import { listNotifications } from "@/server/services/notifications";
import { listAchievements } from "@/server/services/progress";
import {
  approveRounds,
  cancelRound,
  createRound,
  deleteRoundAsStaff,
  getRoundForPlayer,
  getSharedRound,
  leaveRound,
  listActiveRounds,
  listRoundHistory,
  listRoundsForStaff,
  removeParticipant,
  respondToInvitation,
  reviewRound,
  setScore,
  setSharing,
  startRoundNow,
  submitRound,
  type CreateRoundInput,
} from "@/server/services/rounds";
import { getPlayerOverview } from "@/server/services/stats";
import { db } from "@/server/db";
import type { ClubSession } from "@/server/auth/session";
import { closePool, createClub, createPlayer, type TestClub } from "../support/fixtures";

let club: TestClub;
let anna: ClubSession;
let bram: ClubSession;
let cato: ClubSession;

function input(overrides: Partial<CreateRoundInput> = {}): CreateRoundInput {
  return {
    clientId: randomUUID(),
    courseId: club.courseId,
    holeCount: 9,
    format: "stroke",
    trackPutts: false,
    playerIds: [],
    guests: [],
    eventId: null,
    ...overrides,
  };
}

/** Fills in a whole card for one participant. */
async function playCard(session: ClubSession, roundId: string, participantId: string, strokes: number[]): Promise<void> {
  for (const [index, value] of strokes.entries()) {
    await setScore(session, roundId, { participantId, hole: index + 1, strokes: value });
  }
}

async function soloRound(session: ClubSession, strokes: number[], overrides: Partial<CreateRoundInput> = {}): Promise<string> {
  const roundId = await createRound(session, input(overrides));
  const snapshot = await getRoundForPlayer(club.id, session.accountId, roundId, "nl");
  await playCard(session, roundId, snapshot!.participants[0].id, strokes);
  await submitRound(session, roundId);
  return roundId;
}

beforeAll(async () => {
  club = await createClub();
  anna = await createPlayer(club, "Anna Alberts");
  bram = await createPlayer(club, "Bram Bakker");
  cato = await createPlayer(club, "Cato Cornelis");
});

afterAll(closePool);

describe("starting a round", () => {
  it("starts a solo round immediately", async () => {
    const roundId = await createRound(anna, input());
    const round = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    expect(round).toMatchObject({ status: "active", holeCount: 9, format: "stroke" });
    expect(round!.startedAt).not.toBeNull();
    expect(round!.course).toMatchObject({ par: 27, name: "Testbaan" });
    expect(round!.course.holes).toHaveLength(9);
    expect(round!.viewer).toMatchObject({ isStarter: true, invitation: "accepted" });
    await cancelRound(anna, roundId);
    expect(await getRoundForPlayer(club.id, anna.accountId, roundId, "nl")).toBeNull();
  });

  it("returns the same round when the request is retried", async () => {
    const request = input();
    const first = await createRound(anna, request);
    const second = await createRound(anna, request);
    expect(second).toBe(first);
    await cancelRound(anna, first);
  });

  it("plays a nine-hole course twice for eighteen holes", async () => {
    const roundId = await createRound(anna, input({ holeCount: 18 }));
    const round = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    expect(round!.course.holes).toHaveLength(18);
    expect(round!.course.par).toBe(54);
    await setScore(anna, roundId, { participantId: round!.participants[0].id, hole: 13, strokes: 2 });
    const stored = await one<{ par_snapshot: number; distance_snapshot: number }>(
      "SELECT par_snapshot, distance_snapshot FROM hole_scores WHERE round_participant_id = $1 AND hole_number = 13",
      [round!.participants[0].id],
    );
    // Hole 13 of the round is hole 4 of the course (distance 40 + 3 * 5).
    expect(stored).toEqual({ par_snapshot: 3, distance_snapshot: 55 });
    await cancelRound(anna, roundId);
  });

  it("rejects flights that are too large or the wrong size for a match", async () => {
    await expect(createRound(anna, input({ playerIds: [bram.accountId, cato.accountId], guests: ["Gast 1", "Gast 2"] }))).rejects.toThrow("FLIGHT_FULL");
    await expect(createRound(anna, input({ format: "match" }))).rejects.toThrow("MATCH_NEEDS_TWO");
  });

  it("refuses players from another club", async () => {
    const other = await createClub();
    const stranger = await createPlayer(other, "Vreemde Vogel");
    await expect(createRound(anna, input({ playerIds: [stranger.accountId] }))).rejects.toThrow("PLAYER_NOT_FOUND");
    await expect(createRound(anna, input({ courseId: other.courseId }))).rejects.toThrow("COURSE_NOT_FOUND");
  });
});

describe("invitations", () => {
  it("waits for invited members and starts when the last one answers", async () => {
    const roundId = await createRound(anna, input({ playerIds: [bram.accountId, cato.accountId], guests: ["Oom Gerard"] }));
    const lobby = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    expect(lobby!.status).toBe("inviting");
    expect(lobby!.participants.map((participant) => [participant.name, participant.guest, participant.invitation])).toEqual([
      ["Anna Alberts", false, "accepted"],
      ["Bram Bakker", false, "pending"],
      ["Cato Cornelis", false, "pending"],
      ["Oom Gerard", true, "accepted"],
    ]);

    const invites = await listNotifications(club.id, bram.accountId);
    expect(invites[0]).toMatchObject({ kind: "round_invite", data: { roundId, starterName: "Anna Alberts", courseName: "Testbaan" } });
    expect((await listActiveRounds(club.id, bram.accountId, "nl"))[0]).toMatchObject({ id: roundId, myInvitation: "pending", isStarter: false });

    // Nobody can score before the round has started.
    await expect(setScore(anna, roundId, { participantId: lobby!.participants[0].id, hole: 1, strokes: 3 })).rejects.toThrow("ROUND_NOT_ACTIVE");

    await respondToInvitation(bram, roundId, "accept");
    expect((await getRoundForPlayer(club.id, anna.accountId, roundId, "nl"))!.status).toBe("inviting");
    await respondToInvitation(cato, roundId, "decline");

    const started = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    expect(started!.status).toBe("active");
    expect(started!.participants.map((participant) => participant.name)).toEqual(["Anna Alberts", "Bram Bakker", "Oom Gerard"]);
    expect(await getRoundForPlayer(club.id, cato.accountId, roundId, "nl")).toBeNull();
    await expect(respondToInvitation(bram, roundId, "accept")).rejects.toThrow("ROUND_NOT_FOUND");
    await cancelRound(anna, roundId);
  });

  it("lets the starter stop waiting or remove someone", async () => {
    const roundId = await createRound(anna, input({ playerIds: [bram.accountId, cato.accountId] }));
    const lobby = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    const bramRow = lobby!.participants.find((participant) => participant.playerId === bram.accountId)!;

    await expect(removeParticipant(bram, roundId, bramRow.id)).rejects.toThrow("STARTER_ONLY");
    await expect(startRoundNow(bram, roundId)).rejects.toThrow("STARTER_ONLY");
    await removeParticipant(anna, roundId, bramRow.id);
    await startRoundNow(anna, roundId);

    const started = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    expect(started!.status).toBe("active");
    expect(started!.participants).toHaveLength(1);
    await cancelRound(anna, roundId);
  });

  it("falls back to stroke play when a match loses a player", async () => {
    const roundId = await createRound(anna, input({ format: "match", playerIds: [bram.accountId] }));
    await respondToInvitation(bram, roundId, "accept");
    expect((await getRoundForPlayer(club.id, anna.accountId, roundId, "nl"))!.format).toBe("match");
    await expect(leaveRound(anna, roundId)).rejects.toThrow("STARTER_CANNOT_LEAVE");
    await leaveRound(bram, roundId);
    const round = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    expect(round).toMatchObject({ format: "stroke", status: "active" });
    await expect(cancelRound(bram, roundId)).rejects.toThrow();
    await cancelRound(anna, roundId);
  });
});

describe("scoring and finishing", () => {
  it("keeps totals, revisions and putts consistent", async () => {
    const roundId = await createRound(anna, input({ trackPutts: true, guests: ["Gast"] }));
    const round = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    const [mine, guest] = round!.participants;

    const first = await setScore(anna, roundId, { participantId: mine.id, hole: 1, strokes: 4, putts: 2 });
    const second = await setScore(anna, roundId, { participantId: mine.id, hole: 1, strokes: 2 });
    expect(second.revision).toBeGreaterThan(first.revision);
    await setScore(anna, roundId, { participantId: guest.id, hole: 1, strokes: 5, putts: 9 });

    let snapshot = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    // Putts were not sent the second time: kept, but never more than the strokes.
    expect(snapshot!.participants[0]).toMatchObject({ scores: [2, ...Array(8).fill(null)], putts: [2, ...Array(8).fill(null)] });
    expect(snapshot!.participants[1].putts[0]).toBe(5);

    await setScore(anna, roundId, { participantId: mine.id, hole: 1, strokes: null });
    snapshot = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    expect(snapshot!.participants[0].scores[0]).toBeNull();

    await expect(setScore(anna, roundId, { participantId: mine.id, hole: 10, strokes: 3 })).rejects.toThrow("HOLE_NOT_FOUND");
    await expect(setScore(anna, roundId, { participantId: randomUUID(), hole: 1, strokes: 3 })).rejects.toThrow("PARTICIPANT_NOT_FOUND");
    await expect(setScore(bram, roundId, { participantId: mine.id, hole: 1, strokes: 3 })).rejects.toThrow("ROUND_NOT_ACTIVE");
    await expect(submitRound(anna, roundId)).rejects.toThrow("ROUND_INCOMPLETE");
    await cancelRound(anna, roundId);
  });

  it("sends a finished card to the club and applies the review", async () => {
    const roundId = await soloRound(anna, [3, 3, 2, 3, 3, 3, 3, 3, 3]);
    expect((await getRoundForPlayer(club.id, anna.accountId, roundId, "nl"))!.status).toBe("pending");
    // Not on the leaderboard, and hidden from other members, until approved.
    expect(await getRoundForPlayer(club.id, bram.accountId, roundId, "nl")).toBeNull();
    expect(await getLeaderboard(club.id, { period: "all", holeCount: 9, category: "best" }, "nl")).toEqual([]);
    expect((await listRoundsForStaff(club.id, "nl", { status: "pending" })).map((row) => row.id)).toContain(roundId);

    await expect(reviewRound(club.owner, roundId, "rejected", null)).rejects.toThrow("REASON_REQUIRED");
    expect(await reviewRound(club.owner, roundId, "approved", null)).toBe(true);
    expect(await reviewRound(club.owner, roundId, "approved", null)).toBe(false);

    const board = await getLeaderboard(club.id, { period: "all", holeCount: 9, category: "best" }, "nl");
    expect(board[0]).toMatchObject({ playerId: anna.accountId, rank: 1, value: 26, toPar: -1, rounds: 1, courseName: "Testbaan" });
    expect(await getRoundForPlayer(club.id, bram.accountId, roundId, "nl")).toMatchObject({ status: "approved" });

    const keys = (await listAchievements(db, club.id, anna.accountId)).map((achievement) => achievement.key);
    expect(keys).toEqual(expect.arrayContaining(["first_round", "first_birdie", "under_par", "bogey_free"]));
    const kinds = (await listNotifications(club.id, anna.accountId)).map((notification) => notification.kind);
    expect(kinds).toEqual(expect.arrayContaining(["round_approved", "achievement"]));

    // The club changes its mind: the round leaves the leaderboard again.
    await reviewRound(club.owner, roundId, "rejected", "Verkeerde baan ingevuld");
    expect(await getLeaderboard(club.id, { period: "all", holeCount: 9, category: "best" }, "nl")).toEqual([]);
    const rejected = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    expect(rejected).toMatchObject({ status: "rejected", rejectionReason: "Verkeerde baan ingevuld" });
    await deleteRoundAsStaff(club.owner, roundId);
  });

  it("builds an index, statistics and rankings from approved rounds", async () => {
    const cards = [
      [3, 3, 3, 3, 3, 3, 3, 3, 3],
      [4, 4, 4, 4, 4, 4, 4, 4, 4],
      [3, 4, 3, 4, 3, 4, 3, 4, 3],
    ];
    const ids: string[] = [];
    for (const card of cards) ids.push(await soloRound(bram, card));
    ids.push(await soloRound(cato, [4, 3, 3, 3, 3, 3, 3, 3, 3]));
    expect(await approveRounds(club.owner, [...ids, randomUUID()])).toBe(4);

    const index = await one<{ club_index: number | null }>("SELECT club_index FROM players WHERE id = $1", [bram.accountId]);
    expect(index.club_index).toBe(0);

    const overview = await getPlayerOverview(club.id, bram.accountId, "nl");
    expect(overview!.stats).toMatchObject({ rounds: 3, holes: 27 });
    expect(overview!.stats.averagePer9).toBeCloseTo(13 / 3);
    expect(overview!.stats.best).toMatchObject({ toPar: 0 });
    expect(overview!.player.clubIndex).toBe(0);

    const best = await getLeaderboard(club.id, { period: "month", holeCount: 9, category: "best" }, "nl");
    expect(best.map((row) => [row.name, row.rank, row.toPar])).toEqual([
      ["Bram Bakker", 1, 0],
      ["Cato Cornelis", 2, 1],
    ]);
    const average = await getLeaderboard(club.id, { period: "month", holeCount: 9, category: "average" }, "nl");
    expect(average.map((row) => row.name)).toEqual(["Bram Bakker"]);
    const rounds = await getLeaderboard(club.id, { period: "month", holeCount: 9, category: "rounds" }, "nl");
    expect(rounds[0]).toMatchObject({ name: "Bram Bakker", value: 3 });
    expect(await getLeaderboard(club.id, { period: "month", holeCount: 18, category: "best" }, "nl")).toEqual([]);

    const history = await listRoundHistory(club.id, bram.accountId, "nl");
    expect(history).toHaveLength(3);
    expect(history[0]).toMatchObject({ status: "approved", strokes: 31, par: 27, participantCount: 1 });
  });

  it("approves immediately for clubs that trust their members", async () => {
    const trusting = await createClub({ autoApprove: true });
    const player = await createPlayer(trusting, "Dirk Direct");
    const roundId = await createRound(player, { ...input(), courseId: trusting.courseId });
    const round = await getRoundForPlayer(trusting.id, player.accountId, roundId, "nl");
    await playCard(player, roundId, round!.participants[0].id, Array(9).fill(3));
    expect(await submitRound(player, roundId)).toEqual({ status: "approved" });
    const board = await getLeaderboard(trusting.id, { period: "day", holeCount: 9, category: "best" }, "nl");
    expect(board).toHaveLength(1);
  });
});

describe("sharing", () => {
  it("exposes a read-only snapshot through a revocable link", async () => {
    const roundId = await createRound(anna, input());
    const token = await setSharing(anna, roundId, true);
    expect(token).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(await setSharing(anna, roundId, true)).toBe(token);

    const shared = await getSharedRound(token!, "nl");
    expect(shared).toMatchObject({ id: roundId, status: "active" });
    expect(shared!.viewer).toBeUndefined();
    expect(shared!.shareToken).toBeUndefined();
    await expect(setSharing(bram, roundId, false)).rejects.toThrow("ROUND_NOT_FOUND");

    await setSharing(anna, roundId, false);
    expect(await getSharedRound(token!, "nl")).toBeNull();
    await cancelRound(anna, roundId);
  });

  it("lists the latest scores newest first, a correction as the newest", async () => {
    const roundId = await createRound(anna, input({ guests: ["Gijs Gast"] }));
    const card = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    const [me, guest] = card!.participants.map((participant) => participant.id);
    expect(card!.activity).toEqual([]);

    await setScore(anna, roundId, { participantId: me, hole: 1, strokes: 3 });
    await setScore(anna, roundId, { participantId: guest, hole: 1, strokes: 2 });
    await setScore(anna, roundId, { participantId: me, hole: 2, strokes: 4 });
    await setScore(anna, roundId, { participantId: me, hole: 1, strokes: 2 });

    const token = (await setSharing(anna, roundId, true))!;
    const shared = await getSharedRound(token, "nl");
    expect(shared!.activity.map((item) => `${item.participantId === me ? "me" : "guest"}:${item.hole}:${item.strokes}`)).toEqual([
      "me:1:2",
      "me:2:4",
      "guest:1:2",
    ]);
    expect(shared!.activity[0]).toMatchObject({ par: card!.course.holes[0].par });
    expect(Date.parse(shared!.activity[0].at)).not.toBeNaN();
    await cancelRound(anna, roundId);
  });
});

describe("tenancy", () => {
  it("keeps every round inside its own club", async () => {
    const other = await createClub();
    const outsider = await createPlayer(other, "Olga Outsider");
    const roundId = await createRound(anna, input());
    const round = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");

    expect(await getRoundForPlayer(other.id, outsider.accountId, roundId, "nl")).toBeNull();
    await expect(setScore(outsider, roundId, { participantId: round!.participants[0].id, hole: 1, strokes: 3 })).rejects.toThrow("ROUND_NOT_ACTIVE");
    await expect(reviewRound(other.owner, roundId, "approved", null)).rejects.toThrow("ROUND_NOT_FOUND");
    await expect(deleteRoundAsStaff(other.owner, roundId)).rejects.toThrow("ROUND_NOT_FOUND");
    expect(await many("SELECT 1 FROM rounds WHERE id = $1", [roundId])).toHaveLength(1);
    await cancelRound(anna, roundId);
  });
});
