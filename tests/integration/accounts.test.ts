import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { one } from "@/server/db";
import { signInAdmin, signInPlayer } from "@/server/services/auth";
import { createClub as createPlatformClub, getClubAdminSettings, getClubByJoinCode, listClubsForPlatform, regenerateJoinCode, setClubStatus, updateClubSettings } from "@/server/services/clubs";
import {
  changePin,
  changeUsername,
  createPlayers,
  decideRegistration,
  listPlayersForStaff,
  recentPartners,
  registerPlayer,
  resetPlayerPin,
  searchPlayers,
  setPlayerActive,
  updatePlayer,
} from "@/server/services/players";
import { applyStaffAction, changeOwnPassword, createStaff, listStaff } from "@/server/services/staff";
import { listAuditLog } from "@/server/services/stats";
import type { Session } from "@/server/auth/session";
import { closePool, createClub, createPlayer, fakeRequest, type TestClub } from "../support/fixtures";

let club: TestClub;

beforeAll(async () => {
  club = await createClub();
});

afterAll(closePool);

describe("player accounts", () => {
  it("issues a code and one-time PIN that sign in, then force a new PIN", async () => {
    const [issued] = await createPlayers(club.owner, [{ displayName: "Nina Nieuw" }], fakeRequest());
    expect(issued.code).toMatch(/^FW-[A-Z2-9]{6}$/);
    expect(issued.pin).toMatch(/^\d{6}$/);
    expect(issued.username).toMatch(/^ninanieuw-/);

    const result = await signInPlayer(issued.code.toLowerCase(), issued.pin, fakeRequest("198.51.100.1"));
    expect(result).toMatchObject({ role: "player", mustChangeSecret: true });
    expect(result.issued.token).toHaveLength(43);
    // The username works as well, with or without the at sign.
    await signInPlayer(`@${issued.username}`, issued.pin, fakeRequest("198.51.100.1"));
    await expect(signInPlayer(issued.code, "000000", fakeRequest("198.51.100.1"))).rejects.toThrow("INVALID_CREDENTIALS");
    await expect(signInPlayer("FW-NOBODY", issued.pin, fakeRequest("198.51.100.1"))).rejects.toThrow("INVALID_CREDENTIALS");
  });

  it("locks an account after repeated wrong PINs", async () => {
    const player = await createPlayer(club, "Lars Locked", "4321");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(signInPlayer(player.user.code!, "9999", fakeRequest("198.51.100.2"))).rejects.toThrow("INVALID_CREDENTIALS");
    }
    // Even the right PIN is refused while the lock holds.
    await expect(signInPlayer(player.user.code!, "4321", fakeRequest("198.51.100.3"))).rejects.toThrow("INVALID_CREDENTIALS");
    const listed = (await listPlayersForStaff(club.id)).find((row) => row.id === player.accountId);
    expect(listed?.locked).toBe(true);
    // Staff can unlock by reactivating.
    await setPlayerActive(club.owner, player.accountId, true);
    await signInPlayer(player.user.code!, "4321", fakeRequest("198.51.100.3"));
  });

  it("limits attempts per client address", async () => {
    const request = () => fakeRequest("198.51.100.44");
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await expect(signInPlayer(`FW-GUESS${attempt}`, "1234", request())).rejects.toThrow("INVALID_CREDENTIALS");
    }
    await expect(signInPlayer("FW-GUESS99", "1234", request())).rejects.toThrow("TOO_MANY_ATTEMPTS");
  });

  it("changes username and PIN", async () => {
    const player = await createPlayer(club, "Wendy Wijzig", "1111");
    const other = await createPlayer(club, "Otto Ander");
    expect(await changeUsername(player, "Wendy.W", fakeRequest())).toBe("wendy.w");
    await expect(changeUsername(player, "x", fakeRequest())).rejects.toThrow("INVALID_USERNAME");
    await expect(changeUsername(other, "wendy.w", fakeRequest())).rejects.toThrow("USERNAME_TAKEN");

    await expect(changePin(player, "0000", "2222", fakeRequest())).rejects.toThrow("CURRENT_PIN_INVALID");
    await expect(changePin(player, "1111", "1111", fakeRequest())).rejects.toThrow("PIN_UNCHANGED");
    await changePin(player, "1111", "2222", fakeRequest());
    await signInPlayer("wendy.w", "2222", fakeRequest("198.51.100.5"));
  });

  it("lets staff choose the username and e-mail of a member", async () => {
    const [issued] = await createPlayers(
      club.owner,
      [{ displayName: "Sem Tuu", email: "Sem.Tuu@Example.test", username: "Seytuu" }],
      fakeRequest(),
    );
    expect(issued.username).toBe("seytuu");
    expect((await signInPlayer("sem.tuu@example.test", issued.pin, fakeRequest("198.51.100.20"))).mustChangeSecret).toBe(true);
    expect((await signInPlayer("seytuu", issued.pin, fakeRequest("198.51.100.20"))).mustChangeSecret).toBe(true);

    await expect(createPlayers(club.owner, [{ displayName: "Tweede Sem", username: "seytuu" }], fakeRequest())).rejects.toThrow("USERNAME_TAKEN");
    await expect(createPlayers(club.owner, [{ displayName: "Code Kaper", username: issued.code }], fakeRequest())).rejects.toThrow("USERNAME_TAKEN");
    await expect(createPlayers(club.owner, [{ displayName: "Te Kort", username: "x" }], fakeRequest())).rejects.toThrow("INVALID_USERNAME");

    // Editing: a new username, the e-mail added later; leaving it out keeps the username.
    const mini = await createPlayer(club, "Mini Muis");
    await updatePlayer(club.owner, mini.accountId, { displayName: "Mini Muis", email: "minimuis77@example.test", username: "minimuis" });
    await updatePlayer(club.owner, mini.accountId, { displayName: "Mini Muis", email: "minimuis77@example.test" });
    await signInPlayer("minimuis", "1234", fakeRequest("198.51.100.21"));
    await signInPlayer("minimuis77@example.test", "1234", fakeRequest("198.51.100.21"));
    await expect(
      updatePlayer(club.owner, mini.accountId, { displayName: "Mini Muis", email: null, username: "seytuu" }),
    ).rejects.toThrow("USERNAME_TAKEN");
  });

  it("lets staff edit, deactivate and reset", async () => {
    const player = await createPlayer(club, "Bea Beheer", "5555");
    await updatePlayer(club.owner, player.accountId, { displayName: "Bea van Beheer", email: "bea@example.test" });
    const reset = await resetPlayerPin(club.owner, player.accountId);
    expect(reset).toMatchObject({ name: "Bea van Beheer", code: player.user.code });
    await expect(signInPlayer(player.user.code!, "5555", fakeRequest("198.51.100.6"))).rejects.toThrow();
    expect((await signInPlayer(player.user.code!, reset.pin, fakeRequest("198.51.100.7"))).mustChangeSecret).toBe(true);

    await setPlayerActive(club.owner, player.accountId, false);
    await expect(signInPlayer(player.user.code!, reset.pin, fakeRequest("198.51.100.8"))).rejects.toThrow("INVALID_CREDENTIALS");
    expect((await listPlayersForStaff(club.id, "inactive")).map((row) => row.id)).toContain(player.accountId);

    const stranger = await createClub();
    await expect(setPlayerActive(stranger.owner, player.accountId, true)).rejects.toThrow("PLAYER_NOT_FOUND");
    await expect(resetPlayerPin(stranger.owner, player.accountId)).rejects.toThrow("PLAYER_NOT_FOUND");
  });

  it("finds club mates by name or username, never outside the club", async () => {
    const searcher = await createPlayer(club, "Zoe Zoeker");
    const target = await createPlayer(club, "Quinten Quist");
    const elsewhere = await createClub();
    await createPlayer(elsewhere, "Quinten Elders");

    const byName = await searchPlayers(club.id, searcher.accountId, "quin");
    expect(byName.map((row) => row.id)).toEqual([target.accountId]);
    expect((await searchPlayers(club.id, searcher.accountId, `@${target.user.username}`)).map((row) => row.id)).toEqual([target.accountId]);
    expect(await searchPlayers(club.id, searcher.accountId, "q")).toEqual([]);
    expect(await searchPlayers(club.id, searcher.accountId, "100%")).toEqual([]);
    expect(await recentPartners(club.id, searcher.accountId)).toEqual([]);
  });
});

describe("self-registration", () => {
  const form = (joinCode: string, username: string) => ({ joinCode, displayName: "Rik Registratie", username, pin: "2468", email: null });

  it("waits for approval by default", async () => {
    const result = await registerPlayer(form(club.joinCode.toLowerCase(), "rik.wacht"), fakeRequest("192.0.2.1"));
    expect(result).toMatchObject({ status: "pending", issued: null });
    await expect(signInPlayer(result.code, "2468", fakeRequest("192.0.2.2"))).rejects.toThrow("REGISTRATION_PENDING");

    const pending = await listPlayersForStaff(club.id, "pending");
    expect(pending).toHaveLength(1);
    await decideRegistration(club.owner, pending[0].id, true);
    expect((await signInPlayer(result.code, "2468", fakeRequest("192.0.2.2"))).mustChangeSecret).toBe(false);
  });

  it("frees the username when staff decline", async () => {
    const result = await registerPlayer(form(club.joinCode, "rik.nee"), fakeRequest("192.0.2.3"));
    const pending = await listPlayersForStaff(club.id, "pending");
    await decideRegistration(club.owner, pending[0].id, false);
    await expect(signInPlayer(result.code, "2468", fakeRequest("192.0.2.4"))).rejects.toThrow("INVALID_CREDENTIALS");
    await registerPlayer(form(club.joinCode, "rik.nee"), fakeRequest("192.0.2.5"));
  });

  it("signs in straight away at open clubs and refuses at closed ones", async () => {
    const open = await createClub({ selfRegistration: "open" });
    const result = await registerPlayer(form(open.joinCode, "rik.open"), fakeRequest("192.0.2.6"));
    expect(result.status).toBe("approved");
    expect(result.issued?.token).toBeTruthy();
    await expect(registerPlayer(form(open.joinCode, "rik.open"), fakeRequest("192.0.2.7"))).rejects.toThrow("USERNAME_TAKEN");

    const closed = await createClub({ selfRegistration: "closed" });
    await expect(registerPlayer(form(closed.joinCode, "rik.dicht"), fakeRequest("192.0.2.8"))).rejects.toThrow("REGISTRATION_CLOSED");
    await expect(registerPlayer(form("NOPE1234", "rik.fout"), fakeRequest("192.0.2.9"))).rejects.toThrow("JOIN_CODE_INVALID");
  });

  it("stops a flood of registrations from one address", async () => {
    const open = await createClub({ selfRegistration: "open" });
    for (let index = 0; index < 5; index += 1) {
      await registerPlayer(form(open.joinCode, `flood.${index}`), fakeRequest("192.0.2.99"));
    }
    await expect(registerPlayer(form(open.joinCode, "flood.x"), fakeRequest("192.0.2.99"))).rejects.toThrow("TOO_MANY_ATTEMPTS");
  });
});

describe("staff and club settings", () => {
  it("signs in administrators and rotates passwords", async () => {
    const email = (await one<{ email: string }>("SELECT email::text AS email FROM admin_accounts WHERE id = $1", [club.owner.accountId])).email;
    const result = await signInAdmin(email.toUpperCase(), "owner-password-123", fakeRequest("192.0.2.20"));
    expect(result).toMatchObject({ role: "club_owner", mustChangeSecret: false });
    await expect(signInAdmin(email, "wrong", fakeRequest("192.0.2.20"))).rejects.toThrow("INVALID_CREDENTIALS");

    await expect(changeOwnPassword(club.owner, "wrong", "a-brand-new-password", fakeRequest())).rejects.toThrow("CURRENT_PASSWORD_INVALID");
    await changeOwnPassword(club.owner, "owner-password-123", "a-brand-new-password", fakeRequest());
    await signInAdmin(email, "a-brand-new-password", fakeRequest("192.0.2.21"));
  });

  it("manages colleagues but always keeps an owner", async () => {
    const issued = await createStaff(club.owner, { displayName: "Sam Staf", email: "Sam.Staf@Example.test", role: "club_staff" });
    expect(issued.email).toBe("sam.staf@example.test");
    expect((await signInAdmin(issued.email, issued.password, fakeRequest("192.0.2.30"))).mustChangeSecret).toBe(true);
    await expect(createStaff(club.owner, { displayName: "Dubbel", email: issued.email, role: "club_staff" })).rejects.toThrow("EMAIL_TAKEN");

    const staff = await listStaff(club.owner);
    const sam = staff.find((member) => member.email === issued.email)!;
    expect(staff.find((member) => member.isSelf)?.role).toBe("club_owner");

    await expect(applyStaffAction(club.owner, club.owner.accountId, { action: "deactivate" })).rejects.toThrow("CANNOT_CHANGE_SELF");
    await applyStaffAction(club.owner, sam.id, { action: "role", role: "club_owner" });
    // Sam, now an owner, may not strand the club by demoting the other owner... but can while two remain.
    const samSession = { ...club.owner, accountId: sam.id } as typeof club.owner;
    await applyStaffAction(samSession, club.owner.accountId, { action: "role", role: "club_staff" });
    await expect(applyStaffAction(club.owner, sam.id, { action: "deactivate" })).rejects.toThrow("LAST_OWNER");
    await applyStaffAction(samSession, club.owner.accountId, { action: "role", role: "club_owner" });

    const reset = await applyStaffAction(club.owner, sam.id, { action: "reset-password" });
    expect(reset?.password).toBeTruthy();
    await applyStaffAction(club.owner, sam.id, { action: "deactivate" });
    await expect(signInAdmin(issued.email, reset!.password, fakeRequest("192.0.2.31"))).rejects.toThrow("INVALID_CREDENTIALS");
  });

  it("updates settings and rotates the join code", async () => {
    const before = await getClubAdminSettings(club.id);
    await updateClubSettings(club.owner, {
      name: "Golfclub De Test",
      tagline: "Altijd op par",
      primaryColor: "#123456",
      accentColor: "#ABCDEF",
      contactEmail: "info@example.test",
      phone: null,
      address: "Fairway 1",
      website: null,
      openingHours: "Dagelijks 9-18",
      defaultLanguage: "en",
      selfRegistration: "open",
      autoApproveRounds: true,
    });
    const after = await getClubAdminSettings(club.id);
    expect(after).toMatchObject({ name: "Golfclub De Test", accentColor: "#abcdef", defaultLanguage: "en", autoApproveRounds: true, joinCode: before.joinCode });

    const code = await regenerateJoinCode(club.owner);
    expect(code).not.toBe(before.joinCode);
    expect(await getClubByJoinCode(before.joinCode)).toBeNull();
    expect((await getClubByJoinCode(code))?.id).toBe(club.id);

    const actions = (await listAuditLog(club.id)).map((entry) => entry.action);
    expect(actions).toEqual(expect.arrayContaining(["club.settings_updated", "club.join_code_regenerated", "staff.created"]));
    expect((await listAuditLog(club.id))[0].actorName).toBe("Eva Eigenaar");
  });

  it("lets the platform create and suspend clubs", async () => {
    const platform = { id: "s", role: "platform_admin", accountId: club.owner.accountId, clubId: null, csrfHash: "", club: null, preferredLanguage: null, user: club.owner.user } as Session;
    const created = await createPlatformClub(platform, { name: "Nieuwe Club", ownerName: "Nora Nieuw", ownerEmail: `nora-${Date.now()}@example.test` });
    expect((await signInAdmin(created.ownerEmail, created.ownerPassword, fakeRequest("192.0.2.40"))).mustChangeSecret).toBe(true);
    expect((await listClubsForPlatform()).find((row) => row.id === created.id)).toMatchObject({ status: "active", staff: 1, players: 0 });

    await setClubStatus(platform, created.id, "suspended");
    await expect(signInAdmin(created.ownerEmail, created.ownerPassword, fakeRequest("192.0.2.41"))).rejects.toThrow("INVALID_CREDENTIALS");
  });
});
