import { ArrowRight, ClipboardCheck, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { auditActionLabel } from "@/components/admin/labels";
import { RankedBars } from "@/components/admin/ranked-bars";
import { RoundsChart } from "@/components/admin/rounds-chart";
import { Avatar } from "@/components/ui/avatar";
import { Card, PageHeader, SectionHeading, Stat } from "@/components/ui/card";
import { formatDateTime, formatLongDate, formatShortDate } from "@/lib/format";
import { requireStaff } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { getClubDashboard, listAuditLog } from "@/server/services/stats";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const session = await requireStaff();
  const { locale, t } = await getT();
  const timeZone = session.club.timeZone;
  const [dashboard, activity] = await Promise.all([
    getClubDashboard(session.clubId, locale),
    listAuditLog(session.clubId, { limit: 8 }),
  ]);

  const weekDelta = dashboard.roundsThisWeek - dashboard.roundsLastWeek;
  const total30 = dashboard.roundsPerDay.reduce((sum, day) => sum + day.rounds, 0);
  const busiest = dashboard.roundsPerDay.reduce<{ day: string; rounds: number } | null>(
    (best, day) => (day.rounds > (best?.rounds ?? 0) ? day : best),
    null,
  );
  const attention = [
    dashboard.pendingRounds > 0
      ? { href: "/admin/rounds", icon: ClipboardCheck, text: t("admin.dashboard.pendingRounds", { count: dashboard.pendingRounds }) }
      : null,
    dashboard.pendingRegistrations > 0
      ? { href: "/admin/players?filter=pending", icon: UserPlus, text: t("admin.dashboard.pendingRegistrations", { count: dashboard.pendingRegistrations }) }
      : null,
  ].filter((item) => item !== null);

  return (
    <>
      <PageHeader
        eyebrow={formatLongDate(new Date(), locale, timeZone)}
        title={t("admin.dashboard.title")}
        description={t("admin.dashboard.lead")}
      />

      {attention.length > 0 ? (
        <section aria-label={t("admin.dashboard.attention")} className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {attention.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 rounded-card border border-transparent bg-gold-soft px-4 py-3.5 text-gold transition hover:brightness-95"
            >
              <item.icon className="size-5 shrink-0" />
              <span className="min-w-0 flex-1 text-sm font-semibold">{item.text}</span>
              <span className="font-label inline-flex shrink-0 items-center gap-1 text-[11px]">
                {t("admin.dashboard.review")}
                <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </section>
      ) : null}

      <section className="stagger-children grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={t("admin.dashboard.kpi.activePlayers")} value={dashboard.activePlayers} />
        <Stat
          label={t("admin.dashboard.kpi.roundsWeek")}
          value={dashboard.roundsThisWeek}
          hint={
            weekDelta === 0
              ? t("admin.dashboard.kpi.sameAsLastWeek")
              : t("admin.dashboard.kpi.vsLastWeek", { delta: weekDelta > 0 ? `+${weekDelta}` : `−${Math.abs(weekDelta)}` })
          }
        />
        <Stat label={t("admin.dashboard.kpi.roundsMonth")} value={dashboard.roundsThisMonth} />
        <Stat
          label={t("admin.dashboard.kpi.live")}
          value={dashboard.liveRounds}
          hint={t("admin.dashboard.kpi.liveHint", { count: dashboard.liveRounds })}
        />
        <Stat label={t("admin.dashboard.kpi.upcomingEvents")} value={dashboard.upcomingEvents} className="col-span-2 lg:col-span-1" />
      </section>

      <Card className="mt-6" padding="lg">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
          <div>
            <h2 className="font-display text-xl">{t("admin.dashboard.chart.title")}</h2>
            <p className="mt-1 text-sm text-ink-2">{t("admin.dashboard.chart.lead")}</p>
          </div>
          {total30 > 0 ? (
            <p className="text-sm text-ink-2">
              <span className="font-semibold text-ink">{t("admin.dashboard.chart.total", { count: total30 })}</span>
              {busiest ? (
                <>
                  {" · "}
                  {t("admin.dashboard.chart.busiest", {
                    date: formatShortDate(new Date(`${busiest.day}T12:00:00Z`), locale, "UTC"),
                    count: busiest.rounds,
                  })}
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <RoundsChart data={dashboard.roundsPerDay} />
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <SectionHeading title={t("admin.dashboard.courses.title")} eyebrow={t("admin.dashboard.courses.lead")} />
          {dashboard.courses.length > 0 ? (
            <RankedBars rows={dashboard.courses.map((course) => ({ name: course.name, value: course.rounds }))} unit={(value) => t("common.rounds", { count: value })} />
          ) : (
            <p className="text-sm text-ink-3">{t("admin.dashboard.courses.empty")}</p>
          )}
        </Card>

        <Card padding="lg">
          <SectionHeading title={t("admin.dashboard.topPlayers.title")} eyebrow={t("admin.dashboard.topPlayers.lead")} />
          {dashboard.topPlayers.length > 0 ? (
            <ol className="stagger-children flex flex-col">
              {dashboard.topPlayers.map((player, index) => (
                <li key={player.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                  <span className="font-score w-5 text-center text-base text-ink-3">{index + 1}</span>
                  <Avatar name={player.name} initials={player.initials} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{player.name}</span>
                  <span className="text-sm text-ink-2">{t("common.rounds", { count: player.rounds })}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-ink-3">{t("admin.dashboard.topPlayers.empty")}</p>
          )}
        </Card>
      </div>

      <Card className="mt-6" padding="lg">
        <SectionHeading
          title={t("admin.dashboard.activity.title")}
          action={
            <Link href="/admin/audit" className="inline-flex items-center gap-1 font-semibold text-brand-fg hover:underline">
              {t("admin.dashboard.activity.viewAll")}
              <ArrowRight className="size-3.5" />
            </Link>
          }
        />
        {activity.length > 0 ? (
          <ul className="stagger-children flex flex-col">
            {activity.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-line py-2.5 last:border-b-0">
                <span className="text-sm">
                  <span className="font-semibold">{auditActionLabel(t, entry.action)}</span>
                  <span className="text-ink-3"> · {entry.actorName ?? t("admin.audit.system")}</span>
                </span>
                <time dateTime={entry.createdAt} className="tabular text-xs text-ink-3">
                  {formatDateTime(entry.createdAt, locale, timeZone)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">{t("admin.dashboard.activity.empty")}</p>
        )}
      </Card>
    </>
  );
}
