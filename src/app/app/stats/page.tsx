import { ChartNoAxesColumn } from "lucide-react";
import type { Metadata } from "next";
import { PlayerStats } from "@/components/app/player-stats";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { requirePlayer } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { getPlayerOverview } from "@/server/services/stats";

export const metadata: Metadata = { title: "Statistieken" };

export default async function StatsPage() {
  const session = await requirePlayer();
  const { t, locale } = await getT();
  const overview = await getPlayerOverview(session.clubId, session.accountId, locale);

  return (
    <>
      <PageHeader eyebrow={t("app.stats.eyebrow")} title={t("app.stats.title")} description={t("app.stats.lead")} />
      {overview && overview.stats.holes > 0 ? (
        <PlayerStats overview={overview} t={t} locale={locale} timeZone={session.club.timeZone} />
      ) : (
        <EmptyState
          icon={<ChartNoAxesColumn className="size-5" />}
          title={t("app.stats.empty")}
          description={t("app.stats.emptyLead")}
          action={
            <LinkButton href="/app/play" variant="accent">
              {t("app.results.startRound")}
            </LinkButton>
          }
        />
      )}
    </>
  );
}
