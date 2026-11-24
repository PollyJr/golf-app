import "server-only";

import type { ClubSession, Session } from "../auth/session";
import { audit } from "../audit";
import { db, many, maybeOne, one, transaction } from "../db";
import { conflict, isUniqueViolation, notFound } from "../errors";
import { publish, topics } from "../realtime/hub";
import { friendlyCode, hashSecret, randomToken } from "../security";
import { isLocale } from "@/lib/i18n/core";
import type { ClubAdminSettings, ClubBranding, ClubDetails, ClubStatus, SelfRegistration } from "@/lib/types";
import type { ClubSettingsBody } from "@/lib/validation";

interface ClubRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  status: ClubStatus;
  primary_color: string;
  accent_color: string;
  timezone: string;
  default_language: string;
  contact_email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  opening_hours_text: string | null;
  self_registration: SelfRegistration;
  auto_approve_rounds: boolean;
  join_code: string;
  board_token: string;
}

const CLUB_COLUMNS = `id, slug, name, tagline, status, primary_color, accent_color, timezone, default_language,
  contact_email::text AS contact_email, phone, address, website, opening_hours_text,
  self_registration, auto_approve_rounds, join_code, board_token`;

function toBranding(row: ClubRow): ClubBranding {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    timeZone: row.timezone,
    defaultLanguage: isLocale(row.default_language) ? row.default_language : "nl",
  };
}

function toDetails(row: ClubRow): ClubDetails {
  return {
    ...toBranding(row),
    status: row.status,
    contactEmail: row.contact_email,
    phone: row.phone,
    address: row.address,
    website: row.website,
    openingHours: row.opening_hours_text,
    selfRegistration: row.self_registration,
    autoApproveRounds: row.auto_approve_rounds,
  };
}

export async function getClubDetails(clubId: string): Promise<ClubDetails | null> {
  const row = await maybeOne<ClubRow>(`SELECT ${CLUB_COLUMNS} FROM clubs WHERE id = $1`, [clubId]);
  return row ? toDetails(row) : null;
}

export async function getClubAdminSettings(clubId: string): Promise<ClubAdminSettings> {
  const row = await one<ClubRow>(`SELECT ${CLUB_COLUMNS} FROM clubs WHERE id = $1`, [clubId]);
  return { ...toDetails(row), joinCode: row.join_code, boardToken: row.board_token };
}

/** The club behind a join code, if it accepts new members. */
export async function getClubByJoinCode(joinCode: string): Promise<ClubDetails | null> {
  const row = await maybeOne<ClubRow>(
    `SELECT ${CLUB_COLUMNS} FROM clubs WHERE upper(join_code) = upper($1) AND status IN ('trial', 'active')`,
    [joinCode.trim()],
  );
  return row ? toDetails(row) : null;
}

export async function getClubByBoardToken(boardToken: string): Promise<ClubDetails | null> {
  const row = await maybeOne<ClubRow>(
    `SELECT ${CLUB_COLUMNS} FROM clubs WHERE board_token = $1 AND status IN ('trial', 'active')`,
    [boardToken],
  );
  return row ? toDetails(row) : null;
}

/** With a single club on the platform, the sign-in page can wear its colours. */
export async function getSoleClubBranding(): Promise<ClubBranding | null> {
  const rows = await many<ClubRow>(`SELECT ${CLUB_COLUMNS} FROM clubs WHERE status IN ('trial', 'active') LIMIT 2`);
  return rows.length === 1 ? toBranding(rows[0]) : null;
}

export async function updateClubSettings(session: ClubSession, settings: ClubSettingsBody): Promise<void> {
  await db.query(
    `UPDATE clubs
        SET name = $2, tagline = $3, primary_color = $4, accent_color = $5, contact_email = $6, phone = $7,
            address = $8, website = $9, opening_hours_text = $10, default_language = $11,
            self_registration = $12, auto_approve_rounds = $13, updated_at = now()
      WHERE id = $1`,
    [
      session.clubId,
      settings.name,
      settings.tagline,
      settings.primaryColor.toLowerCase(),
      settings.accentColor.toLowerCase(),
      settings.contactEmail,
      settings.phone,
      settings.address,
      settings.website,
      settings.openingHours,
      settings.defaultLanguage,
      settings.selfRegistration,
      settings.autoApproveRounds,
    ],
  );
  await audit({ clubId: session.clubId, actor: session, action: "club.settings_updated", entityType: "club", entityId: session.clubId });
  await publish(db, [topics.club(session.clubId)], "club");
}

async function uniqueJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = friendlyCode(6);
    const taken = await maybeOne("SELECT 1 FROM clubs WHERE upper(join_code) = $1", [code]);
    if (!taken) return code;
  }
  return friendlyCode(8);
}

/** Invalidates the old join code: links and QR codes handed out before stop working. */
export async function regenerateJoinCode(session: ClubSession): Promise<string> {
  const code = await uniqueJoinCode();
  await db.query("UPDATE clubs SET join_code = $2, updated_at = now() WHERE id = $1", [session.clubId, code]);
  await audit({ clubId: session.clubId, actor: session, action: "club.join_code_regenerated", entityType: "club", entityId: session.clubId });
  return code;
}

export async function regenerateBoardToken(session: ClubSession): Promise<string> {
  const token = randomToken(24);
  await db.query("UPDATE clubs SET board_token = $2, updated_at = now() WHERE id = $1", [session.clubId, token]);
  await audit({ clubId: session.clubId, actor: session, action: "club.board_token_regenerated", entityType: "club", entityId: session.clubId });
  return token;
}

// ------------------------------------------------------------- platform --

export interface PlatformClub {
  id: string;
  slug: string;
  name: string;
  status: ClubStatus;
  players: number;
  staff: number;
  rounds: number;
  roundsLast30Days: number;
  createdAt: string;
}

export async function listClubsForPlatform(): Promise<PlatformClub[]> {
  const rows = await many<{
    id: string;
    slug: string;
    name: string;
    status: ClubStatus;
    players: number;
    staff: number;
    rounds: number;
    recent_rounds: number;
    created_at: Date;
  }>(
    `SELECT c.id, c.slug, c.name, c.status, c.created_at,
            (SELECT count(*)::int FROM players p WHERE p.club_id = c.id AND p.active AND p.registration_status = 'approved') AS players,
            (SELECT count(*)::int FROM admin_accounts a WHERE a.club_id = c.id AND a.active) AS staff,
            (SELECT count(*)::int FROM rounds r WHERE r.club_id = c.id AND r.status IN ('pending', 'approved')) AS rounds,
            (SELECT count(*)::int FROM rounds r
              WHERE r.club_id = c.id AND r.status IN ('pending', 'approved')
                AND r.completed_at > now() - interval '30 days') AS recent_rounds
       FROM clubs c
      ORDER BY c.name`,
  );
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    players: row.players,
    staff: row.staff,
    rounds: row.rounds,
    roundsLast30Days: row.recent_rounds,
    createdAt: row.created_at.toISOString(),
  }));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface CreatedClub {
  id: string;
  ownerEmail: string;
  ownerPassword: string;
}

/** Creates a club with its first owner account. The password is shown once. */
export async function createClub(
  session: Session,
  input: { name: string; ownerName: string; ownerEmail: string },
): Promise<CreatedClub> {
  const ownerPassword = randomToken(12);
  const passwordHash = await hashSecret(ownerPassword);
  const joinCode = await uniqueJoinCode();
  const baseSlug = slugify(input.name) || "club";

  try {
    return await transaction(async (tx) => {
      const taken = await many<{ slug: string }>("SELECT slug FROM clubs WHERE slug = $1 OR slug LIKE $1 || '-%'", [baseSlug], tx);
      const slug = taken.length === 0 ? baseSlug : `${baseSlug}-${taken.length + 1}`;
      const club = await one<{ id: string }>(
        `INSERT INTO clubs (slug, name, status, join_code, board_token)
         VALUES ($1, $2, 'active', $3, $4) RETURNING id`,
        [slug, input.name, joinCode, randomToken(24)],
        tx,
      );
      await tx.query(
        `INSERT INTO admin_accounts (club_id, role, email, display_name, password_hash, must_change_password)
         VALUES ($1, 'club_owner', $2, $3, $4, true)`,
        [club.id, input.ownerEmail.toLowerCase(), input.ownerName, passwordHash],
      );
      await audit({ clubId: club.id, actor: session, action: "club.created", entityType: "club", entityId: club.id }, tx);
      return { id: club.id, ownerEmail: input.ownerEmail.toLowerCase(), ownerPassword };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("EMAIL_TAKEN");
    throw error;
  }
}

/** Suspending a club signs everyone out; its data is kept. */
export async function setClubStatus(session: Session, clubId: string, status: ClubStatus): Promise<void> {
  await transaction(async (tx) => {
    const updated = await tx.query("UPDATE clubs SET status = $2, updated_at = now() WHERE id = $1", [clubId, status]);
    if (updated.rowCount === 0) throw notFound("CLUB_NOT_FOUND");
    if (status === "suspended") await tx.query("DELETE FROM sessions WHERE club_id = $1", [clubId]);
    await audit({ clubId, actor: session, action: `club.${status}`, entityType: "club", entityId: clubId }, tx);
  });
}
