import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getBoard } from "@/server/services/board";
import { deleteCourse, getCourse, listCourses, saveCourse, setCourseActive } from "@/server/services/courses";
import {
  buildCalendarFile,
  cancelEventRegistration,
  getEvent,
  getEventLeaderboard,
  listEventParticipants,
  listEvents,
  listPlayableEvents,
  registerForEvent,
  saveEvent,
} from "@/server/services/events";
import { getAces, getCourseRecords } from "@/server/services/leaderboards";
import { deleteNewsItem, getNewsItem, listNews, listNewsForStaff, saveNewsItem } from "@/server/services/news";
import { countUnread, listNotifications, markRead } from "@/server/services/notifications";
import { createRound, getRoundForPlayer, setScore, submitRound } from "@/server/services/rounds";
import { getClubDashboard } from "@/server/services/stats";
import type { ClubSession } from "@/server/auth/session";
import type { CourseBody, EventBody } from "@/lib/validation";
import { closePool, createClub, createPlayer, type TestClub } from "../support/fixtures";

let club: TestClub;
let anna: ClubSession;
let bram: ClubSession;
let cato: ClubSession;

const HOUR = 60 * 60 * 1000;

function eventInput(overrides: Partial<EventBody> = {}): EventBody {
  return {
    title: "Zomer Cup",
    description: "Een gezellige wedstrijd.",
    kind: "tournament",
    startsAt: new Date(Date.now() + 48 * HOUR).toISOString(),
    endsAt: null,
    registrationClosesAt: null,
    location: "Clubhuis",
    courseId: null,
    capacity: null,
    leaderboardEnabled: false,
    published: true,
    ...overrides,
  };
}

beforeAll(async () => {
  club = await createClub({ autoApprove: true });
  anna = await createPlayer(club, "Anna Alberts");
  bram = await createPlayer(club, "Bram Bakker");
  cato = await createPlayer(club, "Cato Cornelis");
});

afterAll(closePool);

describe("courses", () => {
  const body = (overrides: Partial<CourseBody> = {}): CourseBody => ({
    name: "De Heidebaan",
    description: "Glooiend en technisch.",
    holeCount: 9,
    teeName: "Geel",
    accent: "#f3a953",
    holes: Array.from({ length: 9 }, (_, index) => ({ par: index === 3 ? 4 : 3, distance: 90 + index, name: index === 0 ? "De Opener" : null, tip: null })),
    ...overrides,
  });

  it("creates, edits and lists a course with its holes", async () => {
    const id = await saveCourse(club.owner, null, body());
    const created = await getCourse(club.id, id, "nl");
    expect(created).toMatchObject({ name: "De Heidebaan", tee: "Geel", par: 28, length: 846, holeCount: 9, active: true });
    expect(created!.holes[0]).toMatchObject({ number: 1, par: 3, distance: 90, name: "De Opener" });

    const eighteen = Array.from({ length: 18 }, () => ({ par: 4, distance: 300, name: null, tip: "Blijf links." }));
    await saveCourse(club.owner, id, body({ name: "De Grote Heide", holeCount: 18, holes: eighteen }));
    const edited = await getCourse(club.id, id, "nl");
    expect(edited).toMatchObject({ name: "De Grote Heide", holeCount: 18, par: 72 });
    expect(edited!.holes).toHaveLength(18);
    expect(edited!.holes[0]).toMatchObject({ name: null, tip: "Blijf links." });

    await saveCourse(club.owner, id, body());
    expect((await getCourse(club.id, id, "nl"))!.holes).toHaveLength(9);

    await setCourseActive(club.owner, id, false);
    expect((await listCourses(club.id, "nl")).map((course) => course.id)).not.toContain(id);
    expect((await listCourses(club.id, "nl", { includeArchived: true })).map((course) => course.id)).toContain(id);
    await deleteCourse(club.owner, id);
    expect(await getCourse(club.id, id, "nl")).toBeNull();
  });

  it("protects courses that have been played", async () => {
    const roundId = await createRound(anna, { clientId: randomUUID(), courseId: club.courseId, holeCount: 9, format: "stroke", trackPutts: false, playerIds: [], guests: [], eventId: null });
    expect(roundId).toBeTruthy();
    await expect(deleteCourse(club.owner, club.courseId)).rejects.toThrow("COURSE_HAS_ROUNDS");
    const eighteen = Array.from({ length: 18 }, () => ({ par: 3, distance: 50, name: null, tip: null }));
    await expect(saveCourse(club.owner, club.courseId, body({ holeCount: 18, holes: eighteen }))).rejects.toThrow("COURSE_HAS_ROUNDS");
    const other = await createClub();
    await expect(saveCourse(other.owner, club.courseId, body())).rejects.toThrow("COURSE_NOT_FOUND");
  });
});

describe("events", () => {
  it("fills up, queues and promotes from the waiting list", async () => {
    const id = await saveEvent(club.owner, null, eventInput({ capacity: 1 }));
    expect((await listNotifications(club.id, anna.accountId))[0]).toMatchObject({ kind: "event_published", data: { eventId: id, title: "Zomer Cup" } });

    expect(await registerForEvent(anna, id)).toBe("registered");
    expect(await registerForEvent(anna, id)).toBe("registered");
    expect(await registerForEvent(bram, id)).toBe("waitlisted");
    expect(await registerForEvent(cato, id)).toBe("waitlisted");

    const event = await getEvent(club.id, id, "nl", { playerId: bram.accountId });
    expect(event).toMatchObject({ registered: 1, waitlisted: 2, myStatus: "waitlisted", registrationOpen: true, capacity: 1 });

    await cancelEventRegistration(anna, id);
    const participants = await listEventParticipants(club.id, id);
    expect(participants.map((row) => [row.name, row.status])).toEqual([
      ["Bram Bakker", "registered"],
      ["Cato Cornelis", "waitlisted"],
    ]);
    expect((await listNotifications(club.id, bram.accountId))[0].kind).toBe("event_promoted");

    // More room: the next in line moves up.
    await saveEvent(club.owner, id, eventInput({ capacity: 5 }));
    expect((await getEvent(club.id, id, "nl", { playerId: cato.accountId }))!.myStatus).toBe("registered");
  });

  it("hides drafts and closes registration", async () => {
    const draft = await saveEvent(club.owner, null, eventInput({ title: "Concept", published: false }));
    expect(await getEvent(club.id, draft, "nl")).toBeNull();
    expect(await getEvent(club.id, draft, "nl", { includeDrafts: true })).toMatchObject({ title: "Concept", published: false });
    await expect(registerForEvent(anna, draft)).rejects.toThrow("EVENT_NOT_OPEN");

    const closed = await saveEvent(club.owner, null, eventInput({ title: "Dicht", registrationClosesAt: new Date(Date.now() - HOUR).toISOString() }));
    await expect(registerForEvent(anna, closed)).rejects.toThrow("EVENT_NOT_OPEN");
    expect((await getEvent(club.id, closed, "nl"))!.registrationOpen).toBe(false);

    const past = await saveEvent(club.owner, null, eventInput({ title: "Geweest", startsAt: new Date(Date.now() - 72 * HOUR).toISOString() }));
    expect((await listEvents(club.id, "nl", { scope: "upcoming" })).map((row) => row.id)).not.toContain(past);
    expect((await listEvents(club.id, "nl", { scope: "past" })).map((row) => row.id)).toContain(past);
  });

  it("ranks rounds played for today's event", async () => {
    const id = await saveEvent(club.owner, null, eventInput({
      title: "Dagwedstrijd",
      // Spans "now" whatever the time of day, so the test also holds around midnight.
      startsAt: new Date(Date.now() - HOUR).toISOString(),
      endsAt: new Date(Date.now() + HOUR).toISOString(),
      leaderboardEnabled: true,
    }));
    expect((await listPlayableEvents(club.id, "nl")).map((row) => row.id)).toEqual([id]);

    for (const [player, strokes] of [[anna, 4], [bram, 3]] as const) {
      const roundId = await createRound(player, { clientId: randomUUID(), courseId: club.courseId, holeCount: 9, format: "stroke", trackPutts: false, playerIds: [], guests: [], eventId: id });
      const round = await getRoundForPlayer(club.id, player.accountId, roundId, "nl");
      expect(round!.event).toEqual({ id, title: "Dagwedstrijd" });
      for (let hole = 1; hole <= 9; hole += 1) await setScore(player, roundId, { participantId: round!.participants[0].id, hole, strokes: hole === 1 && player === bram ? 1 : strokes });
      await submitRound(player, roundId);
    }

    const board = await getEventLeaderboard(club.id, id);
    expect(board.map((row) => [row.name, row.rank, row.toPar, row.provisional])).toEqual([
      ["Bram Bakker", 1, -2, false],
      ["Anna Alberts", 2, 9, false],
    ]);

    const future = await saveEvent(club.owner, null, eventInput({ leaderboardEnabled: true }));
    await expect(createRound(anna, { clientId: randomUUID(), courseId: club.courseId, holeCount: 9, format: "stroke", trackPutts: false, playerIds: [], guests: [], eventId: future })).rejects.toThrow("EVENT_NOT_PLAYABLE");

    const aces = await getAces(club.id, "nl");
    expect(aces[0]).toMatchObject({ playerName: "Bram Bakker", hole: 1, distance: 40 });
    const records = await getCourseRecords(club.id, "nl");
    expect(records).toEqual([expect.objectContaining({ courseId: club.courseId, playerName: "Bram Bakker", strokes: 25, holeCount: 9 })]);
  });

  it("exports a calendar entry", async () => {
    const id = await saveEvent(club.owner, null, eventInput({ title: "Borrel; met, komma" }));
    const event = (await getEvent(club.id, id, "nl"))!;
    const file = buildCalendarFile(event, club.name, "https://example.test/app/events/1");
    expect(file).toContain("BEGIN:VEVENT\r\n");
    expect(file).toContain(String.raw`SUMMARY:Borrel\; met\, komma`);
    expect(file).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    expect(file.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

describe("news and notifications", () => {
  it("publishes, pins, expires and deletes", async () => {
    const news = await saveNewsItem(club.owner, null, { kind: "news", title: "Nieuwe greens", body: "De greens zijn vernieuwd.", pinned: false, published: true, expiresAt: null });
    const pinned = await saveNewsItem(club.owner, null, { kind: "announcement", title: "Baan dicht", body: "Maandag onderhoud.", pinned: true, published: true, expiresAt: null });
    const draft = await saveNewsItem(club.owner, null, { kind: "news", title: "Concept", body: "Nog niet af.", pinned: false, published: false, expiresAt: null });
    await saveNewsItem(club.owner, null, { kind: "rules", title: "Baanregels", body: "Repareer pitchmarks.", pinned: false, published: true, expiresAt: null });

    expect((await listNews(club.id, "nl")).map((item) => item.id)).toEqual([pinned, news]);
    expect((await listNews(club.id, "nl", { kinds: ["rules"] })).map((item) => item.title)).toEqual(["Baanregels"]);
    expect(await getNewsItem(club.id, draft, "nl")).toBeNull();
    expect((await listNewsForStaff(club.id, "nl")).length).toBe(4);
    expect((await getNewsItem(club.id, news, "nl"))!.authorName).toBe("Eva Eigenaar");

    const kinds = (await listNotifications(club.id, cato.accountId)).map((notification) => notification.kind);
    expect(kinds.filter((kind) => kind === "news_published")).toHaveLength(2);

    await saveNewsItem(club.owner, news, { kind: "news", title: "Nieuwe greens", body: "Bijgewerkt.", pinned: false, published: true, expiresAt: new Date(Date.now() - HOUR).toISOString() });
    expect((await listNews(club.id, "nl")).map((item) => item.id)).toEqual([pinned]);
    await deleteNewsItem(club.owner, pinned);
    expect(await listNews(club.id, "nl")).toEqual([]);
  });

  it("tracks unread notifications per player", async () => {
    const unread = await countUnread(club.id, cato.accountId);
    expect(unread).toBeGreaterThan(0);
    const [latest] = await listNotifications(club.id, cato.accountId);
    await markRead(club.id, cato.accountId, latest.id);
    expect(await countUnread(club.id, cato.accountId)).toBe(unread - 1);
    await markRead(club.id, cato.accountId);
    expect(await countUnread(club.id, cato.accountId)).toBe(0);
    expect(await countUnread(club.id, anna.accountId)).toBeGreaterThan(0);
  });
});

describe("dashboards", () => {
  it("summarises the club for staff", async () => {
    const dashboard = await getClubDashboard(club.id, "nl");
    expect(dashboard).toMatchObject({ activePlayers: 3, pendingRounds: 0, pendingRegistrations: 0, roundsThisMonth: 2 });
    expect(dashboard.roundsPerDay).toHaveLength(30);
    expect(dashboard.roundsPerDay.at(-1)!.rounds).toBe(2);
    expect(dashboard.liveRounds).toBe(1);
    expect(dashboard.topPlayers.map((player) => player.name).sort()).toEqual(["Anna Alberts", "Bram Bakker"]);
    expect(dashboard.courses[0]).toMatchObject({ name: "Testbaan", rounds: 2 });
  });

  it("feeds the clubhouse board through its token only", async () => {
    const board = await getBoard(club.boardToken, "nl");
    expect(board).not.toBeNull();
    expect(board!.club.name).toBe(club.name);
    expect(board!.holeCount).toBe(9);
    expect(board!.today.map((row) => row.name)).toEqual(["Bram Bakker", "Anna Alberts"]);
    expect(board!.live).toHaveLength(1);
    expect(board!.live[0].players[0]).toMatchObject({ name: "Anna Alberts", thru: 0, toPar: 0 });
    expect(board!.events.length).toBeGreaterThan(0);
    expect(board!.aces).toHaveLength(1);
    expect(await getBoard("not-a-token", "nl")).toBeNull();
  });
});
