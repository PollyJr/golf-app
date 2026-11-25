import { Flag, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { ActiveRounds } from "@/components/app/active-rounds";
import { QrQuickActions } from "@/components/qr/qr-dialogs";
import { EventRow, NewsRow, RoundRow } from "@/components/app/rows";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, Eyebrow, SectionHeading, Stat } from "@/components/ui/card";
import { formatClubIndex } from "@/lib/golf/club-index";
import { formatToPar } from "@/lib/golf/scoring";
import { requirePlayer } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { listEvents } from "@/server/services/events";
import { getPlayerRank } from "@/server/services/leaderboards";
import { getOwnAccount } from "@/server/services/players";
import { listNews } from "@/server/services/news";
import { listRoundHistory } from "@/server/services/rounds";
import { getPlayerOverview } from "@/server/services/stats";

/** Morning, afternoon or evening at the club, for the greeting. */
function dayPart(timeZone: string): "morning" | "afternoon" | "evening" {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(new Date()));
  if (hour < 12) return "morning";
  return hour < 18 ? "afternoon" : "evening";
}

export default async function HomePage() {
  const session = await requirePlayer();
  const { t, locale } = await getT();
  const { clubId, accountId, club } = session;
  const format = { t, locale, timeZone: club.timeZone };

  const [overview, rank, recent, events, news, account] = await Promise.all([
    getPlayerOverview(clubId, accountId, locale),
    getPlayerRank(clubId, accountId, { period: "month", holeCount: 9, category: "best" }, locale),
    listRoundHistory(clubId, accountId, locale, { limit: 3 }),
    listEvents(clubId, locale, { playerId: accountId, scope: "upcoming", limit: 2 }),
    listNews(clubId, locale, { limit: 2 }),
    getOwnAccount(session),
  ]);
  const stats = overview?.stats;
  const index = overview?.player.clubIndex ?? null;
  const firstName = session.user.displayName.split(/\s+/)[0];
  const form = stats?.form ?? null;

  return (
    <>
      <header className="mb-6">
        <Eyebrow>{club.name}</Eyebrow>
        <h1 className="font-display mt-2 text-[clamp(1.9rem,6.5vw,2.9rem)] text-balance">
          {t(`app.home.${dayPart(club.timeZone)}`, { name: firstName })}
        </h1>
      </header>

      <div className="mb-8">
        <QrQuickActions qrToken={account.qrToken} name={session.user.displayName} />
      </div>

      <ActiveRounds />

      <section className="bg-ruled relative mb-8 grid gap-6 overflow-hidden rounded-[1.5rem] bg-brand p-6 text-brand-ink sm:grid-cols-[1fr_auto] sm:items-end sm:p-8">
        <div>
          <h2 className="font-display text-[clamp(1.6rem,5vw,2.3rem)] text-balance">{t("app.home.ctaTitle")}</h2>
          <p className="mt-2 max-w-sm text-[15px] opacity-80">{t("app.home.ctaLead")}</p>
          <LinkButton href="/app/play" variant="accent" size="lg" className="mt-5" icon={<Flag className="size-[1.1rem]" />}>
            {t("app.home.ctaButton")}
          </LinkButton>
        </div>
        <div className="flex items-end gap-4 border-t border-current/15 pt-5 sm:flex-col sm:items-end sm:border-t-0 sm:border-l sm:pt-0 sm:pl-8 sm:text-right">
          <div>
            <p className="font-label text-[10.5px] text-accent">{t("common.clubIndex")}</p>
            <p className="font-score mt-1 text-[4.2rem] leading-none">{formatClubIndex(index, locale)}</p>
          </div>
          <p className="max-w-[13rem] text-xs opacity-70">{index === null ? t("app.home.indexEmpty") : t("app.home.indexHint")}</p>
        </div>
      </section>

      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("app.home.statRounds")} value={stats?.rounds ?? 0} />
        <Stat
          label={t("app.home.statBest")}
          value={stats?.best ? stats.best.strokes : "–"}
          hint={stats?.best ? `${formatToPar(stats.best.toPar)} · ${stats.best.courseName}` : undefined}
          tone={stats?.best && stats.best.toPar < 0 ? "under" : "default"}
        />
        <Stat
          label={t("app.home.statRank")}
          value={rank.entry ? t("app.home.statRankValue", { rank: rank.entry.rank }) : "–"}
          hint={rank.entry ? t("app.home.statRankHint", { total: rank.total }) : undefined}
        />
        <Stat
          label={t("app.home.statForm")}
          value={
            form === null ? (
              "–"
            ) : form < -0.25 ? (
              <TrendingUp className="size-9 text-under" aria-hidden="true" />
            ) : form > 0.25 ? (
              <TrendingDown className="size-9 text-over" aria-hidden="true" />
            ) : (
              "="
            )
          }
          hint={form === null ? undefined : form < -0.25 ? t("app.home.formBetter") : form > 0.25 ? t("app.home.formWorse") : t("app.home.formSteady")}
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeading
            title={t("app.home.recentHeading")}
            action={
              recent.length > 0 ? (
                <Link href="/app/results" className="font-semibold text-brand-fg underline-offset-4 hover:underline">
                  {t("common.viewAll")}
                </Link>
              ) : null
            }
          />
          {recent.length > 0 ? (
            <ul className="flex flex-col gap-2.5">
              {recent.map((round) => (
                <li key={round.id}>
                  <RoundRow round={round} {...format} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t("app.home.recentEmpty")} />
          )}
        </section>

        <div className="flex flex-col gap-8">
          <section>
            <SectionHeading
              title={t("app.home.nextEvent")}
              action={
                <Link href="/app/events" className="font-semibold text-brand-fg underline-offset-4 hover:underline">
                  {t("common.viewAll")}
                </Link>
              }
            />
            {events.length > 0 ? (
              <ul className="flex flex-col gap-2.5">
                {events.map((event) => (
                  <li key={event.id}>
                    <EventRow event={event} {...format} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={t("app.home.noEvents")} />
            )}
          </section>

          <section>
            <SectionHeading
              title={t("app.home.newsHeading")}
              action={
                <Link href="/app/club" className="font-semibold text-brand-fg underline-offset-4 hover:underline">
                  {t("common.viewAll")}
                </Link>
              }
            />
            {news.length > 0 ? (
              <ul className="flex flex-col gap-2.5">
                {news.map((item) => (
                  <li key={item.id}>
                    <NewsRow item={item} {...format} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={t("app.home.noNews")} />
            )}
          </section>
        </div>
      </div>
    </>
  );
}
