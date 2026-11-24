import "server-only";

import { redirect } from "next/navigation";
import { getSession, homeForRole, roleAllowed, type ClubSession, type Session } from "./session";

/**
 * Page guards. Each returns the session for the right kind of account, and
 * redirects everyone else to where they belong.
 */

export async function requirePlayer(options: { allowPinChange?: boolean } = {}): Promise<ClubSession> {
  const session = await getSession();
  if (!session) redirect("/");
  if (!roleAllowed(session.role, "player") || !session.clubId || !session.club) redirect(homeForRole(session.role));
  if (session.user.mustChangeSecret && !options.allowPinChange) redirect("/app/welcome");
  return session as ClubSession;
}

export async function requireStaff(options: { ownerOnly?: boolean; allowPasswordChange?: boolean } = {}): Promise<ClubSession> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!roleAllowed(session.role, "staff") || !session.clubId || !session.club) redirect(homeForRole(session.role));
  if (options.ownerOnly && session.role !== "club_owner") redirect("/admin");
  if (session.user.mustChangeSecret && !options.allowPasswordChange) redirect("/admin/account?welcome=1");
  return session as ClubSession;
}

export async function requirePlatformAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!roleAllowed(session.role, "platform")) redirect(homeForRole(session.role));
  return session;
}
