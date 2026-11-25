import type { Metadata } from "next";
import { PlayersManager } from "@/components/admin/players-manager";
import { PageHeader } from "@/components/ui/card";
import { requireStaff } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { listPlayersForStaff } from "@/server/services/players";

export const metadata: Metadata = { title: "Spelers" };

const FILTERS = ["all", "active", "inactive", "pending"] as const;

export default async function AdminPlayersPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const session = await requireStaff();
  const [{ t }, players, { filter }] = await Promise.all([getT(), listPlayersForStaff(session.clubId), searchParams]);
  const initialFilter = FILTERS.find((value) => value === filter) ?? "all";

  return (
    <>
      <PageHeader eyebrow={session.club.name} title={t("admin.players.title")} description={t("admin.players.lead")} />
      <PlayersManager players={players} initialFilter={initialFilter} clubName={session.club.name} />
    </>
  );
}
