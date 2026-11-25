import { Flag } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { PlayerStats } from "@/components/app/player-stats";
import { Avatar } from "@/components/ui/avatar";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, Eyebrow } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { requirePlayer } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { getPlayerOverview } from "@/server/services/stats";

/** A club mate's profile: who they are and how they play. */
export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlayer();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  if (id === session.accountId) redirect("/app/stats");
  const { t, locale } = await getT();
  const overview = await getPlayerOverview(session.clubId, id, locale);
  if (!overview) notFound();
  const { player } = overview;

  return (
    <>
      <header className="mb-8 flex flex-wrap items-center gap-5">
        <Avatar name={player.name} initials={player.initials} size="xl" />
        <div className="min-w-0 flex-1">
          <Eyebrow>{t("app.member.eyebrow")}</Eyebrow>
          <h1 className="font-display mt-1.5 text-[clamp(1.8rem,6vw,2.6rem)] text-balance">{player.name}</h1>
          <p className="mt-1 text-sm text-ink-3">
            @{player.username} · {t("app.member.memberSince", { date: formatDate(overview.memberSince, locale, session.club.timeZone) })}
          </p>
        </div>
        <LinkButton href={`/app/play?with=${player.id}`} variant="accent" icon={<Flag className="size-4" />}>
          {t("app.member.invite")}
        </LinkButton>
      </header>

      {overview.stats.holes > 0 ? (
        <PlayerStats overview={overview} t={t} locale={locale} timeZone={session.club.timeZone} compact />
      ) : (
        <EmptyState title={t("app.member.noRounds", { name: player.name.split(/\s+/)[0] })} />
      )}
    </>
  );
}
