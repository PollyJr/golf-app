import type { Metadata } from "next";
import { PlatformConsole } from "@/components/admin/platform-console";
import { Wordmark } from "@/components/brand";
import { LanguageSwitch, SignOutButton } from "@/components/preferences";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Stat } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { listClubsForPlatform } from "@/server/services/clubs";
import { getPlatformTotals } from "@/server/services/stats";

export const metadata: Metadata = { title: "Platform" };

export default async function PlatformPage() {
  const session = await requirePlatformAdmin();
  const [{ t }, totals, clubs] = await Promise.all([getT(), getPlatformTotals(), listClubsForPlatform()]);

  return (
    // While a print sheet (issued credentials) is mounted, only that sheet prints.
    <div className="min-h-dvh print:[[data-print-sheet]_&]:hidden">
      <header className="safe-top sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <Wordmark />
            <Badge tone="brand">{t("admin.platform.label")}</Badge>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-ink-2">
            <span className="mr-2 hidden text-sm font-semibold text-ink sm:inline">{session.user.displayName}</span>
            <LanguageSwitch variant="compact" />
            <SignOutButton redirectTo="/admin/login" iconOnly />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16 sm:px-6 lg:px-10">
        <PageHeader eyebrow={t("admin.platform.label")} title={t("admin.platform.title")} description={t("admin.platform.lead")} />
        <section className="stagger-children mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={t("admin.platform.totals.clubs")} value={totals.clubs} />
          <Stat label={t("admin.platform.totals.players")} value={totals.players} />
          <Stat label={t("admin.platform.totals.rounds")} value={totals.rounds} />
          <Stat label={t("admin.platform.totals.recent")} value={totals.roundsLast30Days} />
        </section>
        <PlatformConsole clubs={clubs} />
      </main>
    </div>
  );
}
