import { Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Leaderboard } from "@/components/app/leaderboard";
import { ToPar } from "@/components/golf/score-mark";
import { Avatar } from "@/components/ui/avatar";
import { Card, PageHeader, SectionHeading } from "@/components/ui/card";
import { formatShortDate } from "@/lib/format";
import { requirePlayer } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { listCourses } from "@/server/services/courses";
import { getAces, getCourseRecords, getLeaderboard } from "@/server/services/leaderboards";

export const metadata: Metadata = { title: "Klassement" };

export default async function LeaderboardsPage() {
  const session = await requirePlayer();
  const { t, locale } = await getT();
  const timeZone = session.club.timeZone;
  const initialQuery = { period: "month" as const, category: "best" as const, holes: 9 as const };

  const [entries, courses, records, aces] = await Promise.all([
    getLeaderboard(session.clubId, { period: initialQuery.period, category: initialQuery.category, holeCount: initialQuery.holes }, locale),
    listCourses(session.clubId, locale),
    getCourseRecords(session.clubId, locale),
    getAces(session.clubId, locale, 12),
  ]);

  return (
    <>
      <PageHeader eyebrow={t("app.leaderboards.eyebrow")} title={t("app.leaderboards.title")} description={t("app.leaderboards.lead")} />
      <Leaderboard initial={entries} initialQuery={initialQuery} courses={courses.map((course) => ({ id: course.id, name: course.name }))} meId={session.accountId} />

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeading title={t("app.leaderboards.recordsHeading")} />
          {records.length > 0 ? (
            <Card padding="none" className="divide-y divide-line">
              {records.map((record) => (
                <Link key={`${record.courseId}-${record.holeCount}`} href={`/app/results/${record.roundId}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-well">
                  <Avatar name={record.playerName} initials={record.initials} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{record.courseName}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {t("common.holes", { count: record.holeCount })} · {record.playerName} · {formatShortDate(record.completedAt, locale, timeZone)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="font-score block text-2xl">{record.strokes}</span>
                    <ToPar value={record.toPar} className="text-xs" />
                  </span>
                </Link>
              ))}
            </Card>
          ) : (
            <p className="text-sm text-ink-3">{t("app.leaderboards.recordsEmpty")}</p>
          )}
        </section>

        <section>
          <SectionHeading title={t("app.leaderboards.acesHeading")} />
          {aces.length > 0 ? (
            <Card padding="none" className="divide-y divide-line">
              {aces.map((ace) => (
                <Link key={`${ace.roundId}-${ace.playerId}-${ace.hole}`} href={`/app/results/${ace.roundId}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-well">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold-soft text-gold">
                    <Target className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{ace.playerName}</span>
                    <span className="block truncate text-xs text-ink-3">{t("app.leaderboards.aceLine", { hole: ace.hole, distance: ace.distance, course: ace.courseName })}</span>
                  </span>
                  <span className="text-xs text-ink-3">{formatShortDate(ace.completedAt, locale, timeZone)}</span>
                </Link>
              ))}
            </Card>
          ) : (
            <p className="text-sm text-ink-3">{t("app.leaderboards.acesEmpty")}</p>
          )}
        </section>
      </div>
    </>
  );
}
