import { AchievementGrid } from "./achievement-grid";
import { HoleSection } from "./hole-section";
import { Distribution } from "@/components/charts/distribution";
import { TrendChart } from "@/components/charts/trend-chart";
import { Card, SectionHeading, Stat } from "@/components/ui/card";
import { formatNumber, formatPercent, formatShortDate, formatSigned } from "@/lib/format";
import { ACHIEVEMENT_KEYS } from "@/lib/golf/achievements";
import { formatClubIndex } from "@/lib/golf/club-index";
import { formatToPar } from "@/lib/golf/scoring";
import type { Locale } from "@/lib/i18n/core";
import type { AppTranslate } from "@/lib/i18n/dictionaries";
import type { PlayerOverview } from "@/server/services/stats";

interface PlayerStatsProps {
  overview: PlayerOverview;
  t: AppTranslate;
  locale: Locale;
  timeZone: string;
  /** A club mate's profile shows less detail than your own statistics. */
  compact?: boolean;
}

/** The statistics of one player; "my statistics" and member profiles share it. */
export function PlayerStats({ overview, t, locale, timeZone, compact }: PlayerStatsProps) {
  const { stats, player, achievements } = overview;

  return (
    <div className="flex flex-col gap-8">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label={t("app.stats.index")} value={formatClubIndex(player.clubIndex, locale)} hint={t("app.stats.indexHint")} />
        <Stat label={t("app.stats.rounds")} value={stats.rounds} hint={t("app.stats.holesPlayed", { count: stats.holes })} />
        <Stat
          label={t("app.stats.average")}
          value={stats.averagePer9 === null ? "–" : formatSigned(stats.averagePer9, locale)}
          hint={t("app.stats.averageHint")}
        />
        <Stat
          label={t("app.stats.best")}
          value={stats.best ? stats.best.strokes : "–"}
          hint={stats.best ? `${formatToPar(stats.best.toPar)} · ${stats.best.courseName}` : undefined}
          tone={stats.best && stats.best.toPar < 0 ? "under" : "default"}
        />
        <Stat
          label={t("app.stats.parRate")}
          value={stats.parOrBetterRate === null ? "–" : formatPercent(stats.parOrBetterRate, locale)}
          hint={t("app.stats.parRateHint")}
        />
        {stats.averagePutts !== null ? (
          <Stat label={t("app.stats.putts")} value={formatNumber(stats.averagePutts, locale, 1)} hint={t("app.stats.puttsHint", { count: stats.puttHoles })} />
        ) : null}
      </section>

      <section>
        <SectionHeading title={t("app.stats.trendHeading")} />
        <Card>
          {stats.trend.length >= 2 ? (
            <>
              <p className="mb-3 text-[13px] text-ink-3">{t("app.stats.trendLead", { count: stats.trend.length })}</p>
              <TrendChart points={stats.trend} label={`${t("app.stats.trendHeading")}: ${t("app.stats.trendLead", { count: stats.trend.length })}`} />
              {compact ? null : (
                <details className="mt-3 border-t border-line pt-3">
                  <summary className="text-[13px] font-semibold text-ink-2">{t("app.stats.trendTableCaption")}</summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="tabular w-full text-sm">
                      <thead>
                        <tr className="font-label text-[10px] text-ink-3">
                          <th scope="col" className="py-1.5 text-left font-[inherit]">{t("app.stats.date")}</th>
                          <th scope="col" className="py-1.5 text-left font-[inherit]">{t("app.stats.course")}</th>
                          <th scope="col" className="py-1.5 text-right font-[inherit]">{t("common.score")}</th>
                          <th scope="col" className="py-1.5 text-right font-[inherit]">{t("app.stats.average")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...stats.trend].reverse().map((point) => (
                          <tr key={point.roundId} className="border-t border-line">
                            <td className="py-1.5">{formatShortDate(point.completedAt, locale, timeZone)}</td>
                            <td className="py-1.5 text-ink-2">{point.courseName}</td>
                            <td className="py-1.5 text-right">
                              {point.strokes} <span className="text-xs text-ink-3">({formatToPar(point.toPar)})</span>
                            </td>
                            <td className="py-1.5 text-right font-semibold">{formatSigned(point.per9, locale)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </>
          ) : (
            <p className="py-6 text-center text-sm text-ink-3">{t("app.stats.trendNeedsMore")}</p>
          )}
        </Card>
      </section>

      <section>
        <SectionHeading title={t("app.stats.distributionHeading")} />
        <Card>
          <p className="mb-4 text-[13px] text-ink-3">{t("app.stats.distributionLead")}</p>
          <Distribution distribution={stats.distribution} t={t} locale={locale} />
        </Card>
      </section>

      {compact ? null : (
        <section>
          <SectionHeading title={t("app.stats.holesHeading")} />
          <p className="-mt-1 mb-3 text-[13px] text-ink-3">{t("app.stats.holesLead")}</p>
          <HoleSection courses={stats.courses} />
        </section>
      )}

      <section>
        <SectionHeading
          title={t("app.stats.achievementsHeading")}
          action={
            <span className="text-ink-3">{t("app.stats.achievementsLead", { earned: achievements.length, total: ACHIEVEMENT_KEYS.length })}</span>
          }
        />
        <AchievementGrid earned={achievements} t={t} locale={locale} timeZone={timeZone} earnedOnly={compact} />
      </section>
    </div>
  );
}
