import "server-only";

import { destroyAccountSessions, type ClubSession, type Session } from "../auth/session";
import { audit } from "../audit";
import { many, maybeOne, one, transaction, type Db } from "../db";
import { AppError, conflict, isUniqueViolation, notFound } from "../errors";
import { hashSecret, randomToken, verifySecret } from "../security";
import { initialsOf } from "@/lib/format";

export interface StaffMember {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: "club_owner" | "club_staff";
  active: boolean;
  lastLoginAt: string | null;
  isSelf: boolean;
}

export async function listStaff(session: ClubSession): Promise<StaffMember[]> {
  const rows = await many<{
    id: string;
    display_name: string;
    email: string;
    role: "club_owner" | "club_staff";
    active: boolean;
    last_login_at: Date | null;
  }>(
    `SELECT id, display_name, email::text AS email, role, active, last_login_at
       FROM admin_accounts WHERE club_id = $1
      ORDER BY (role = 'club_owner') DESC, display_name`,
    [session.clubId],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.display_name,
    initials: initialsOf(row.display_name),
    email: row.email,
    role: row.role,
    active: row.active,
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
    isSelf: row.id === session.accountId,
  }));
}

export interface IssuedPassword {
  email: string;
  password: string;
}

/** Adds a colleague. They receive a one-time password and must replace it. */
export async function createStaff(
  session: ClubSession,
  input: { displayName: string; email: string; role: "club_owner" | "club_staff" },
): Promise<IssuedPassword> {
  const password = randomToken(12);
  const email = input.email.toLowerCase();
  try {
    const created = await one<{ id: string }>(
      `INSERT INTO admin_accounts (club_id, role, email, display_name, password_hash, must_change_password)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
      [session.clubId, input.role, email, input.displayName.trim(), await hashSecret(password)],
    );
    await audit({ clubId: session.clubId, actor: session, action: "staff.created", entityType: "admin", entityId: created.id, metadata: { role: input.role } });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("EMAIL_TAKEN");
    throw error;
  }
  return { email, password };
}

/** A club must always keep at least one owner who can sign in. */
async function assertAnotherOwner(tx: Db, clubId: string, exceptId: string): Promise<void> {
  const others = await one<{ count: number }>(
    "SELECT count(*)::int AS count FROM admin_accounts WHERE club_id = $1 AND role = 'club_owner' AND active AND id <> $2",
    [clubId, exceptId],
    tx,
  );
  if (others.count === 0) throw conflict("LAST_OWNER");
}

export type StaffAction =
  | { action: "activate" }
  | { action: "deactivate" }
  | { action: "reset-password" }
  | { action: "role"; role: "club_owner" | "club_staff" };

export async function applyStaffAction(session: ClubSession, staffId: string, input: StaffAction): Promise<IssuedPassword | null> {
  const password = input.action === "reset-password" ? randomToken(12) : null;
  const passwordHash = password ? await hashSecret(password) : null;

  return transaction(async (tx) => {
    const member = await maybeOne<{ email: string; role: string; active: boolean }>(
      "SELECT email::text AS email, role, active FROM admin_accounts WHERE id = $1 AND club_id = $2 FOR UPDATE",
      [staffId, session.clubId],
      tx,
    );
    if (!member) throw notFound("STAFF_NOT_FOUND");
    const self = staffId === session.accountId;

    switch (input.action) {
      case "activate":
        await tx.query("UPDATE admin_accounts SET active = true, failed_attempts = 0, locked_until = NULL, updated_at = now() WHERE id = $1", [staffId]);
        break;
      case "deactivate":
        if (self) throw conflict("CANNOT_CHANGE_SELF");
        if (member.role === "club_owner") await assertAnotherOwner(tx, session.clubId, staffId);
        await tx.query("UPDATE admin_accounts SET active = false, updated_at = now() WHERE id = $1", [staffId]);
        await destroyAccountSessions("club_staff", staffId, undefined, tx);
        break;
      case "role":
        if (self) throw conflict("CANNOT_CHANGE_SELF");
        if (member.role === "club_owner" && input.role !== "club_owner") await assertAnotherOwner(tx, session.clubId, staffId);
        await tx.query("UPDATE admin_accounts SET role = $2, updated_at = now() WHERE id = $1", [staffId, input.role]);
        await tx.query("UPDATE sessions SET role = $2 WHERE account_id = $1 AND role <> 'player'", [staffId, input.role]);
        break;
      case "reset-password":
        await tx.query(
          `UPDATE admin_accounts
              SET password_hash = $2, must_change_password = true, failed_attempts = 0, locked_until = NULL, updated_at = now()
            WHERE id = $1`,
          [staffId, passwordHash],
        );
        await destroyAccountSessions("club_staff", staffId, self ? session.id : undefined, tx);
        break;
    }

    await audit({ clubId: session.clubId, actor: session, action: `staff.${input.action}`, entityType: "admin", entityId: staffId }, tx);
    return password ? { email: member.email, password } : null;
  });
}

/** Any administrator changes their own password; other sessions end. */
export async function changeOwnPassword(session: Session, currentPassword: string, newPassword: string, request: Request): Promise<void> {
  if (currentPassword === newPassword) throw new AppError("PASSWORD_UNCHANGED", 400);
  const account = await maybeOne<{ password_hash: string }>(
    "SELECT password_hash FROM admin_accounts WHERE id = $1 AND active",
    [session.accountId],
  );
  if (!account || !(await verifySecret(currentPassword, account.password_hash))) {
    throw new AppError("CURRENT_PASSWORD_INVALID", 403);
  }
  const newHash = await hashSecret(newPassword);
  await transaction(async (tx) => {
    await tx.query(
      "UPDATE admin_accounts SET password_hash = $2, must_change_password = false, updated_at = now() WHERE id = $1",
      [session.accountId, newHash],
    );
    await destroyAccountSessions(session.role, session.accountId, session.id, tx);
    await audit({ clubId: session.clubId, actor: session, action: "admin.password_changed", entityType: "admin", entityId: session.accountId, request }, tx);
  });
}

export async function getAdminProfile(session: Session): Promise<{ email: string; name: string }> {
  const row = await one<{ email: string; display_name: string }>(
    "SELECT email::text AS email, display_name FROM admin_accounts WHERE id = $1",
    [session.accountId],
  );
  return { email: row.email, name: row.display_name };
}
