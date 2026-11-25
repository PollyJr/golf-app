import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ClubSession } from "@/server/auth/session";
import { one } from "@/server/db";
import { signInPlayer } from "@/server/services/auth";
import { listNotifications } from "@/server/services/notifications";
import { changeEmail, createPlayers, findPlayerByQrToken, getOwnAccount, regenerateQrToken, registerPlayer, updatePlayer } from "@/server/services/players";
import { addParticipantByQr, createRound, getJoinPreview, getRoundForPlayer, joinRoundByToken, setScore, submitRound, type CreateRoundInput } from "@/server/services/rounds";
import { closePool, createClub, createPlayer, fakeRequest, type TestClub } from "../support/fixtures";

let club: TestClub;
let anna: ClubSession;
let bram: ClubSession;
let cato: ClubSession;
let dirk: ClubSession;

function roundInput(overrides: Partial<CreateRoundInput> = {}): CreateRoundInput {
  return { clientId: randomUUID(), courseId: club.courseId, holeCount: 9, format: "stroke", trackPutts: false, playerIds: [], guests: [], eventId: null, ...overrides };
}

const qrOf = async (session: ClubSession) => (await getOwnAccount(session)).qrToken;

beforeAll(async () => {
  club = await createClub();
  anna = await createPlayer(club, "Anna Alberts");
  bram = await createPlayer(club, "Bram Bakker");
  cato = await createPlayer(club, "Cato Cornelis");
  dirk = await createPlayer(club, "Dirk Dekker");
});

afterAll(closePool);

describe("signing in with an e-mail address", () => {
  it("works for any letter case, alongside the code", async () => {
    const player = await createPlayer(club, "Mail Speler", "3141");
    expect(await changeEmail(player, "  Mail.Speler@Example.TEST ", fakeRequest())).toBe("mail.speler@example.test");
    await signInPlayer("mail.speler@example.test", "3141", fakeRequest("192.0.2.60"));
    await signInPlayer("MAIL.SPELER@EXAMPLE.TEST", "3141", fakeRequest("192.0.2.60"));
    await signInPlayer(player.user.code!, "3141", fakeRequest("192.0.2.60"));
    await expect(signInPlayer("mail.speler@example.test", "0000", fakeRequest("192.0.2.61"))).rejects.toThrow("INVALID_CREDENTIALS");
    await expect(signInPlayer("nobody@example.test", "3141", fakeRequest("192.0.2.61"))).rejects.toThrow("INVALID_CREDENTIALS");
  });

  it("keeps addresses unique across clubs and everywhere they are set", async () => {
    const owner = await createPlayer(club, "Eerste Eigenaar");
    await changeEmail(owner, "dubbel@example.test", fakeRequest());
    const rival = await createPlayer(club, "Tweede Poging");
    await expect(changeEmail(rival, "DUBBEL@example.test", fakeRequest())).rejects.toThrow("EMAIL_TAKEN");
    await expect(updatePlayer(club.owner, rival.accountId, { displayName: "Tweede Poging", email: "dubbel@example.test" })).rejects.toThrow("EMAIL_TAKEN");
    await expect(createPlayers(club.owner, [{ displayName: "Derde", email: "dubbel@example.test" }], fakeRequest())).rejects.toThrow("EMAIL_TAKEN");

    const elsewhere = await createClub({ selfRegistration: "open" });
    await expect(
      registerPlayer({ joinCode: elsewhere.joinCode, displayName: "Andere Club", username: "andere.club", pin: "1234", email: "dubbel@example.test" }, fakeRequest("192.0.2.62")),
    ).rejects.toThrow("EMAIL_TAKEN");

    // Clearing an address frees it.
    expect(await changeEmail(owner, null, fakeRequest())).toBeNull();
    await changeEmail(rival, "dubbel@example.test", fakeRequest());
  });

  it("signs a new member in with the address they registered with", async () => {
    const open = await createClub({ selfRegistration: "open" });
    await registerPlayer({ joinCode: open.joinCode, displayName: "Nieuw Lid", username: "nieuw.lid", pin: "8642", email: "nieuw.lid@example.test" }, fakeRequest("192.0.2.63"));
    const result = await signInPlayer("nieuw.lid@example.test", "8642", fakeRequest("192.0.2.64"));
    expect(result.role).toBe("player");
  });
});

describe("personal QR codes", () => {
  it("lead to the player within the club only, until they are replaced", async () => {
    const token = await qrOf(bram);
    expect(token).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect((await findPlayerByQrToken(club.id, token))?.id).toBe(bram.accountId);
    const elsewhere = await createClub();
    expect(await findPlayerByQrToken(elsewhere.id, token)).toBeNull();

    const fresh = await regenerateQrToken(bram);
    expect(fresh).not.toBe(token);
    expect(await findPlayerByQrToken(club.id, token)).toBeNull();
    expect((await findPlayerByQrToken(club.id, fresh))?.id).toBe(bram.accountId);
  });

  it("put scanned players straight into a new round", async () => {
    const roundId = await createRound(anna, roundInput({ qrTokens: [await qrOf(bram)] }));
    const round = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    // Nobody to wait for: the round starts right away.
    expect(round!.status).toBe("active");
    expect(round!.participants.map((participant) => [participant.name, participant.invitation])).toEqual([
      ["Anna Alberts", "accepted"],
      ["Bram Bakker", "accepted"],
    ]);
    expect((await listNotifications(club.id, bram.accountId))[0]).toMatchObject({ kind: "round_joined", data: { roundId, starterName: "Anna Alberts" } });
  });

  it("mix with invitations, and reject codes from another club", async () => {
    const roundId = await createRound(anna, roundInput({ qrTokens: [await qrOf(bram)], playerIds: [cato.accountId] }));
    const round = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    expect(round!.status).toBe("inviting");
    expect(round!.participants.find((participant) => participant.playerId === cato.accountId)?.invitation).toBe("pending");

    const elsewhere = await createClub();
    const stranger = await createPlayer(elsewhere, "Vreemde Eend");
    await expect(createRound(anna, roundInput({ qrTokens: [await qrOf(stranger)] }))).rejects.toThrow("QR_CODE_UNKNOWN");
  });

  it("add a club mate to a round that is already being played", async () => {
    const roundId = await createRound(anna, roundInput());
    const before = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    await setScore(anna, roundId, { participantId: before!.participants[0].id, hole: 1, strokes: 3 });

    expect(await addParticipantByQr(anna, roundId, await qrOf(cato))).toEqual({ name: "Cato Cornelis", outcome: "added" });
    expect(await addParticipantByQr(anna, roundId, await qrOf(cato))).toEqual({ name: "Cato Cornelis", outcome: "already" });
    const after = await getRoundForPlayer(club.id, cato.accountId, roundId, "nl");
    expect(after!.participants.map((participant) => participant.name)).toEqual(["Anna Alberts", "Cato Cornelis"]);
    expect(after!.participants[1]).toMatchObject({ invitation: "accepted", scores: Array(9).fill(null) });

    // Only someone in the flight may add players.
    await expect(addParticipantByQr(dirk, roundId, await qrOf(bram))).rejects.toThrow("ROUND_NOT_FOUND");
    // The new player's card must be complete before the round can be handed in.
    for (let hole = 2; hole <= 9; hole += 1) await setScore(anna, roundId, { participantId: before!.participants[0].id, hole, strokes: 3 });
    await expect(submitRound(anna, roundId)).rejects.toThrow("ROUND_INCOMPLETE");
  });

  it("accept a pending invitation when the invitee is scanned", async () => {
    const roundId = await createRound(anna, roundInput({ playerIds: [dirk.accountId] }));
    expect((await getRoundForPlayer(club.id, anna.accountId, roundId, "nl"))!.status).toBe("inviting");
    expect((await addParticipantByQr(anna, roundId, await qrOf(dirk))).outcome).toBe("accepted");
    expect((await getRoundForPlayer(club.id, anna.accountId, roundId, "nl"))!.status).toBe("active");
  });

  it("respect the size of a flight and of a match", async () => {
    const roundId = await createRound(anna, roundInput({ qrTokens: [await qrOf(bram), await qrOf(cato)], guests: ["Gast"] }));
    await expect(addParticipantByQr(anna, roundId, await qrOf(dirk))).rejects.toThrow("FLIGHT_FULL");

    const match = await createRound(anna, roundInput({ format: "match", qrTokens: [await qrOf(bram)] }));
    await expect(addParticipantByQr(anna, match, await qrOf(cato))).rejects.toThrow("MATCH_FULL");
  });
});

describe("round QR codes", () => {
  it("let a club mate preview and join, once", async () => {
    const roundId = await createRound(anna, roundInput());
    const round = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    const token = round!.joinToken!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{24}$/);

    const preview = await getJoinPreview(bram, token, "nl");
    expect(preview).toMatchObject({ roundId, open: true, alreadyIn: false, full: false, starterName: "Anna Alberts", courseName: "Testbaan" });
    expect(await joinRoundByToken(bram, token)).toBe(roundId);
    expect(await joinRoundByToken(bram, token)).toBe(roundId);
    expect((await getJoinPreview(bram, token, "nl"))!.alreadyIn).toBe(true);
    const joined = await getRoundForPlayer(club.id, bram.accountId, roundId, "nl");
    expect(joined!.participants.map((participant) => participant.name)).toEqual(["Anna Alberts", "Bram Bakker"]);
  });

  it("are not handed out to outsiders and stop working when the round ends", async () => {
    const roundId = await createRound(anna, roundInput());
    const token = (await getRoundForPlayer(club.id, anna.accountId, roundId, "nl"))!.joinToken!;
    // Someone who is not in the round sees no join code.
    const outsiderView = await getRoundForPlayer(club.id, cato.accountId, roundId, "nl");
    expect(outsiderView).toBeNull();

    const elsewhere = await createClub();
    const stranger = await createPlayer(elsewhere, "Vreemde Vogel");
    expect(await getJoinPreview(stranger, token, "nl")).toBeNull();
    await expect(joinRoundByToken(stranger, token)).rejects.toThrow("ROUND_NOT_FOUND");

    const card = await getRoundForPlayer(club.id, anna.accountId, roundId, "nl");
    for (let hole = 1; hole <= 9; hole += 1) await setScore(anna, roundId, { participantId: card!.participants[0].id, hole, strokes: 3 });
    await submitRound(anna, roundId);
    expect((await getJoinPreview(cato, token, "nl"))!.open).toBe(false);
    await expect(joinRoundByToken(cato, token)).rejects.toThrow("ROUND_NOT_FOUND");
    expect((await getRoundForPlayer(club.id, anna.accountId, roundId, "nl"))!.joinToken).toBeNull();
  });

  it("refuse a full flight", async () => {
    const roundId = await createRound(anna, roundInput({ guests: ["Gast 1", "Gast 2", "Gast 3"] }));
    const token = (await getRoundForPlayer(club.id, anna.accountId, roundId, "nl"))!.joinToken!;
    expect((await getJoinPreview(dirk, token, "nl"))!.full).toBe(true);
    await expect(joinRoundByToken(dirk, token)).rejects.toThrow("FLIGHT_FULL");
    const count = await one<{ count: number }>("SELECT count(*)::int AS count FROM round_participants WHERE round_id = $1", [roundId]);
    expect(count.count).toBe(4);
  });
});
