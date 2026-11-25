import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import { RoundRow } from "@/components/app/rows";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { requirePlayer } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { listRoundHistory } from "@/server/services/rounds";

export const metadata: Metadata = { title: "Uitslagen" };

export default async function ResultsPage() {
  const session = await requirePlayer();
  const { t, locale } = await getT();
  const rounds = await listRoundHistory(session.clubId, session.accountId, locale, { limit: 100 });

  return (
    <>
      <PageHeader eyebrow={t("app.results.eyebrow")} title={t("app.results.title")} description={t("app.results.lead")} />
      {rounds.length > 0 ? (
        <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {rounds.map((round) => (
            <li key={round.id}>
              <RoundRow round={round} t={t} locale={locale} timeZone={session.club.timeZone} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<ClipboardList className="size-5" />}
          title={t("app.results.empty")}
          description={t("app.results.emptyLead")}
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
