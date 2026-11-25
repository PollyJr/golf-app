import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ClubSession } from "@/server/auth/session";
import { db, one } from "@/server/db";
import { runStartupMaintenance } from "@/server/maintenance";
import { clientIp } from "@/server/security";
import { signInPlayer } from "@/server/services/auth";
import { saveCourse } from "@/server/services/courses";
import { saveEvent } from "@/server/services/events";
import { changePin, changeUsername, registerPlayer } from "@/server/services/players";
import { listAchievements } from "@/server/services/progress";
import { createRound, getRoundForPlayer, getSharedRound, reviewRound, setScore, setSharing, submitRound, type CreateRoundInput } from "@/server/services/rounds";
import { applyStaffAction, createStaff, listStaff } from "@/server/services/staff";
import { closePool, createClub, createCourse, createPlayer, fakeRequest, type TestClub } from "../support/fixtures";

/**
 * Regression tests for defects found in review: each one failed before its fix.
 */

let club: TestClub;
let anna: ClubSession;

function roundInput(overrides: Partial<CreateRoundInput> = {}): CreateRoundInput {
  return { clientId: randomUUID(), courseId: club.courseId, holeCount: 9, format: "stroke", trackPutts: false, playerIds: [], guests: [], eventId: null, ...overrides };
}

async function finishedRound(session: ClubSession, strokes: number[], overrides: Partial<CreateRoundInput> = {}): Promise<string> {
  const roundId = await createRound(session, roundInput(overrides));
  const round = await getRoundForPlayer(session.clubId, session.accountId, roundId, "nl");
  for (const [index, value] of strokes.entries()) {
    await setScore(session, roundId, { participantId: round!.participants[0].id, hole: index + 1, strokes: value });
  }
  await submitRound(session, roundId);
  return roundId;
}

beforeAll(async () => {
  club = await createClub();
  anna = await createPlayer(club, "Anna Alberts");
});

afterAll(closePool);

describe("sign-in throttling", () => {
  it("holds under a burst of simultaneous guesses", async () => {
    const victim = await createPlayer(club, "Burst Victim", "7391");
    const guesses = Array.from({ length: 40 }, (_, index) =>
      signInPlayer(victim.user.code!, String(1000 + index), fakeRequest("198.51.100.200")).then(
        () => "signed-in",
        (error: Error) => error.message,
      ),
    );
    const outcomes = await Promise.all(guesses);
    expect(outcomes.filter((outcome) => outcome === "signed-in")).toHaveLength(0);
    // Only the budget's worth of guesses is ever compared with the PIN.
    expect(outcomes.filter((outcome) => outcome === "INVALID_CREDENTIALS").length).toBeLessThanOrEqual(8);
    expect(outcomes.filter((outcome) => outcome === "TOO_MANY_ATTEMPTS").length).toBeGreaterThanOrEqual(32);
  });

  it("starts counting afresh once a lock has run out, and never extends a running lock", async () => {
    const player = await createPlayer(club, "Lock Reset", "2580");
    const state = () => one<{ failed_attempts: number; locked: boolean }>("SELECT failed_attempts, COALESCE(locked_until > now(), false) AS locked FROM players WHERE id = $1", [player.accountId]);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(signInPlayer(player.user.code!, "0000", fakeRequest(`198.51.101.${attempt}`))).rejects.toThrow("INVALID_CREDENTIALS");
    }
    expect(await state()).toEqual({ failed_attempts: 5, locked: true });

    // The guesses above used up this account's budget; a later window starts clean.
    await db.query("DELETE FROM auth_attempts");
    const lockedUntil = await one<{ locked_until: Date }>("SELECT locked_until FROM players WHERE id = $1", [player.accountId]);
    await expect(signInPlayer(player.user.code!, "0000", fakeRequest("198.51.101.50"))).rejects.toThrow("INVALID_CREDENTIALS");
    expect((await one<{ locked_until: Date }>("SELECT locked_until FROM players WHERE id = $1", [player.accountId])).locked_until).toEqual(lockedUntil.locked_until);

    await db.query("UPDATE players SET locked_until = now() - interval '1 minute' WHERE id = $1", [player.accountId]);
    await expect(signInPlayer(player.user.code!, "0000", fakeRequest("198.51.101.51"))).rejects.toThrow("INVALID_CREDENTIALS");
    expect(await state()).toEqual({ failed_attempts: 1, locked: false });
    await signInPlayer(player.user.code!, "2580", fakeRequest("198.51.101.52"));
    expect(await state()).toEqual({ failed_attempts: 0, locked: false });
  });

  it("limits guesses of the current PIN as well", async () => {
    const player = await createPlayer(club, "Pin Guess", "4826");
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await expect(changePin(player, String(1000 + attempt), "9999", fakeRequest("198.51.102.1"))).rejects.toThrow("CURRENT_PIN_INVALID");
    }
    await expect(changePin(player, "4826", "9999", fakeRequest("198.51.102.1"))).rejects.toThrow("TOO_MANY_ATTEMPTS");
  });

  it("identifies the client by the proxy's header, not by what the client claims", () => {
    const request = (headers: Record<string, string>) => new Request("http://localhost/", { headers });
    expect(clientIp(request({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "10.0.0.1, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp(request({ "x-forwarded-for": "10.9.8.7, 10.9.8.8, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(request({}))).toBe("unknown");
  });
});

describe("usernames", () => {
  it("cannot shadow a player code or a username in another club", async () => {
    const victim = await createPlayer(club, "Vera Victim", "1357");
    const mate = await createPlayer(club, "Mallory Mate", "2468");
    await expect(changeUsername(mate, victim.user.code!.toLowerCase(), fakeRequest())).rejects.toThrow("USERNAME_TAKEN");

    const elsewhere = await createClub({ selfRegistration: "open" });
    await expect(
      registerPlayer({ joinCode: elsewhere.joinCode, displayName: "Copy Cat", username: victim.user.username!, pin: "1111", email: null }, fakeRequest("198.51.103.1")),
    ).rejects.toThrow("USERNAME_TAKEN");

    // The victim still signs in, by code and by username.
    await signInPlayer(victim.user.code!, "1357", fakeRequest("198.51.103.2"));
    await signInPlayer(victim.user.username!, "1357", fakeRequest("198.51.103.2"));
  });
});

describe("scorecards", () => {
  it("does not invent putts when a score is corrected", async () => {
    const roundId = await createRound(anna, roundInput());
    const round = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    const participantId = round!.participants[0].id;
    await setScore(anna, roundId, { participantId, hole: 1, strokes: 3 });
    await setScore(anna, roundId, { participantId, hole: 1, strokes: 6 });
    const after = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    expect(after!.participants[0].scores[0]).toBe(6);
    expect(after!.participants[0].putts[0]).toBeNull();
  });

  it("keeps the par of a finished card when the course is edited later", async () => {
    const courseId = await createCourse(club.id, Array(9).fill(3), "Herzien");
    const roundId = await finishedRound(anna, Array(9).fill(3), { courseId });
    await saveCourse(club.owner, courseId, {
      name: "Herzien",
      description: "",
      holeCount: 9,
      teeName: "Club",
      accent: "#c9f04b",
      holes: Array.from({ length: 9 }, (_, index) => ({ par: index === 0 ? 5 : 3, distance: 200, name: null, tip: null })),
    });
    const round = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    expect(round!.course.par).toBe(27);
    expect(round!.course.holes[0]).toMatchObject({ par: 3, distance: 40 });
  });

  it("only counts a round for an event on the event's course", async () => {
    const otherCourse = await createCourse(club.id, Array(9).fill(3), "Oefenbaan");
    const eventId = await saveEvent(club.owner, null, {
      title: "Baankampioenschap",
      description: "",
      kind: "tournament",
      startsAt: new Date(Date.now() - 3_600_000).toISOString(),
      endsAt: new Date(Date.now() + 3_600_000).toISOString(),
      registrationClosesAt: null,
      location: null,
      courseId: club.courseId,
      capacity: null,
      leaderboardEnabled: true,
      published: true,
    });
    await expect(createRound(anna, roundInput({ courseId: otherCourse, eventId }))).rejects.toThrow("EVENT_NOT_PLAYABLE");
    await createRound(anna, roundInput({ eventId }));
  });

  it("returns the same round when a duplicate request arrives at the same moment", async () => {
    const request = roundInput();
    const [first, second] = await Promise.all([createRound(anna, request), createRound(anna, request)]);
    expect(second).toBe(first);
  });

  it("hides a rejected round, and account ids, behind its share link", async () => {
    const bram = await createPlayer(club, "Bram Bakker");
    const roundId = await createRound(bram, roundInput());
    const token = (await setSharing(bram, roundId, true))!;
    const shared = await getSharedRound(token, "nl");
    expect(shared).toMatchObject({ starterId: "", rejectionReason: null });
    expect(shared!.participants.every((participant) => participant.playerId === null)).toBe(true);

    const card = await getRoundForPlayer(club.id, bram.accountId, roundId, "nl");
    for (let hole = 1; hole <= 9; hole += 1) await setScore(bram, roundId, { participantId: card!.participants[0].id, hole, strokes: 3 });
    await submitRound(bram, roundId);
    expect(await getSharedRound(token, "nl")).not.toBeNull();
    await reviewRound(club.owner, roundId, "rejected", "Niet volgens de regels");
    expect(await getSharedRound(token, "nl")).toBeNull();
  });
});

describe("derived data", () => {
  it("takes achievements back when the round that earned them is rejected", async () => {
    const player = await createPlayer(club, "Ace Ventura");
    const roundId = await finishedRound(player, [1, 3, 3, 3, 3, 3, 3, 3, 3]);
    await reviewRound(club.owner, roundId, "approved", null);
    const keys = async () => (await listAchievements(db, club.id, player.accountId)).map((achievement) => achievement.key);
    expect(await keys()).toEqual(expect.arrayContaining(["ace", "under_par", "first_round"]));
    await reviewRound(club.owner, roundId, "rejected", "Verkeerd ingevuld");
    expect(await keys()).toEqual([]);
  });

  it("rebuilds index and achievements for rounds approved before they existed", async () => {
    const player = await createPlayer(club, "Legacy Larry");
    for (let count = 0; count < 3; count += 1) {
      const roundId = await finishedRound(player, Array(9).fill(4));
      await reviewRound(club.owner, roundId, "approved", null);
    }
    // Simulate data migrated from version 1: approved rounds, nothing derived.
    await db.query("DELETE FROM player_achievements WHERE player_id = $1", [player.accountId]);
    await db.query("DELETE FROM notifications WHERE player_id = $1", [player.accountId]);
    await db.query("UPDATE players SET club_index = NULL WHERE id = $1", [player.accountId]);

    await runStartupMaintenance();
    const row = await one<{ club_index: number | null }>("SELECT club_index FROM players WHERE id = $1", [player.accountId]);
    expect(row.club_index).toBe(9);
    expect((await listAchievements(db, club.id, player.accountId)).map((achievement) => achievement.key)).toContain("first_round");
    // Old feats are restored quietly.
    expect((await one<{ count: number }>("SELECT count(*)::int AS count FROM notifications WHERE player_id = $1", [player.accountId])).count).toBe(0);
  });
});

describe("club owners", () => {
  it("cannot remove each other at the same moment", async () => {
    const issued = await createStaff(club.owner, { displayName: "Olga Owner", email: `olga-${randomUUID().slice(0, 6)}@example.test`, role: "club_owner" });
    const olga = (await listStaff(club.owner)).find((member) => member.email === issued.email)!;
    const olgaSession = { ...club.owner, accountId: olga.id } as ClubSession;
    const outcomes = await Promise.allSettled([
      applyStaffAction(club.owner, olga.id, { action: "deactivate" }),
      applyStaffAction(olgaSession, club.owner.accountId, { action: "deactivate" }),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const active = await one<{ count: number }>("SELECT count(*)::int AS count FROM admin_accounts WHERE club_id = $1 AND role = 'club_owner' AND active", [club.id]);
    expect(active.count).toBe(1);
  });
});
