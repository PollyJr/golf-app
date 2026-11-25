import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireStaff } from "@/server/auth/guards";
import { countPendingRegistrations } from "@/server/services/players";
import { countPendingRounds } from "@/server/services/rounds";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // The password page itself must stay reachable for accounts that still have
  // to replace a one-time password; every other page redirects there.
  const session = await requireStaff({ allowPasswordChange: true });
  const [rounds, players] = await Promise.all([
    countPendingRounds(session.clubId),
    countPendingRegistrations(session.clubId),
  ]);

  return (
    <AdminShell
      clubName={session.club.name}
      user={{ displayName: session.user.displayName, initials: session.user.initials }}
      isOwner={session.role === "club_owner"}
      badges={{ rounds, players }}
    >
      {children}
    </AdminShell>
  );
}
