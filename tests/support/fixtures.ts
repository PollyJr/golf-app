import { randomUUID } from "node:crypto";
import type { ClubSession } from "@/server/auth/session";
import { getPool, one } from "@/server/db";
import { hashSecret } from "@/server/security";
import { initialsOf } from "@/lib/format";

/**
 * Builders for integration tests. Every club gets unique names, so test files
 * never see each other's data even though they share a database.
 */

export interface TestClub {
  id: string;
  name: string;
  joinCode: string;
  boardToken: string;
  courseId: string;
  owner: ClubSession;
}

const BRANDING = {
  tagline: null,
  primaryColor: "#0f3b2a",
  accentColor: "#c9f04b",
  timeZone: "Europe/Amsterdam",
  defaultLanguage: "nl" as const,
};

function unique(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export async function createClub(
  options: { autoApprove?: boolean; selfRegistration?: "closed" | "approval" | "open"; pars?: number[] } = {},
): Promise<TestClub> {
  const slug = unique("club");
  const name = `Testclub ${slug}`;
  const club = await one<{ id: string; join_code: string; board_token: string }>(
    `INSERT INTO clubs (slug, name, join_code, board_token, auto_approve_rounds, self_registration)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, join_code, board_token`,
    [slug, name, unique("JOIN").toUpperCase(), randomUUID().replace(/-/g, ""), options.autoApprove ?? false, options.selfRegistration ?? "approval"],
  );
  const ownerEmail = `${slug}@owner.test`;
  const owner = await one<{ id: string }>(
    `INSERT INTO admin_accounts (club_id, role, email, display_name, password_hash)
     VALUES ($1, 'club_owner', $2, 'Eva Eigenaar', $3) RETURNING id`,
    [club.id, ownerEmail, await hashSecret("owner-password-123")],
  );
  const courseId = await createCourse(club.id, options.pars ?? Array.from({ length: 9 }, () => 3));
  return {
    id: club.id,
    name,
    joinCode: club.join_code,
    boardToken: club.board_token,
    courseId,
    owner: sessionFor("club_owner", owner.id, "Eva Eigenaar", club.id, name, slug),
  };
}

export async function createCourse(clubId: string, pars: number[], name = "Testbaan"): Promise<string> {
  const course = await one<{ id: string }>(
    `INSERT INTO courses (club_id, name, description, hole_count)
     VALUES ($1, jsonb_build_object('nl', $2::text), '{}', $3) RETURNING id`,
    [clubId, name, pars.length],
  );
  const tee = await one<{ id: string }>(
    `INSERT INTO tee_sets (club_id, course_id, name, color, is_default)
     VALUES ($1, $2, '{"nl":"Club"}', 'green', true) RETURNING id`,
    [clubId, course.id],
  );
  for (const [index, par] of pars.entries()) {
    await getPool().query(
      "INSERT INTO holes (club_id, course_id, tee_set_id, number, par, distance_m) VALUES ($1, $2, $3, $4, $5, $6)",
      [clubId, course.id, tee.id, index + 1, par, 40 + index * 5],
    );
  }
  return course.id;
}

export async function createPlayer(club: TestClub, displayName: string, pin = "1234"): Promise<ClubSession> {
  const code = `T-${unique("P").toUpperCase()}`;
  const username = `${displayName.toLowerCase().replace(/[^a-z0-9]/g, "")}-${randomUUID().slice(0, 4)}`;
  const player = await one<{ id: string }>(
    `INSERT INTO players (club_id, display_name, initials, username, code, pin_hash, must_change_pin)
     VALUES ($1, $2, $3, $4, $5, $6, false) RETURNING id`,
    [club.id, displayName, initialsOf(displayName), username, code, await hashSecret(pin)],
  );
  const session = sessionFor("player", player.id, displayName, club.id, club.name, "test");
  session.user.username = username;
  session.user.code = code;
  return session;
}

function sessionFor(
  role: ClubSession["role"],
  accountId: string,
  displayName: string,
  clubId: string,
  clubName: string,
  slug: string,
): ClubSession {
  return {
    id: randomUUID(),
    role,
    accountId,
    clubId,
    csrfHash: "",
    preferredLanguage: null,
    club: { id: clubId, slug, name: clubName, ...BRANDING },
    user: {
      role,
      accountId,
      displayName,
      initials: initialsOf(displayName),
      username: null,
      code: null,
      mustChangeSecret: false,
    },
  };
}

export function fakeRequest(ip = "203.0.113.10"): Request {
  return new Request("http://localhost/test", {
    method: "POST",
    headers: { "x-forwarded-for": ip, "user-agent": "vitest", origin: "http://localhost" },
  });
}

export async function closePool(): Promise<void> {
  await getPool().end();
  globalThis.fairwayPool = undefined;
}
