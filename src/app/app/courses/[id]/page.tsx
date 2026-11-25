import { Flag, Lightbulb, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkButton } from "@/components/ui/button";
import { Card, Eyebrow, SectionHeading, Stat } from "@/components/ui/card";
import { formatNumber, formatShortDate } from "@/lib/format";
import { formatToPar } from "@/lib/golf/scoring";
import { requirePlayer } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { getCourse } from "@/server/services/courses";
import { getCourseRecords } from "@/server/services/leaderboards";
import { getPlayerOverview } from "@/server/services/stats";
import { NAV_BACK } from "@/components/motion/page-transition";

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlayer();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { t, locale } = await getT();
  const [course, records, overview] = await Promise.all([
    getCourse(session.clubId, id, locale),
    getCourseRecords(session.clubId, locale),
    getPlayerOverview(session.clubId, session.accountId, locale),
  ]);
  if (!course || !course.active) notFound();
  const record = records.find((item) => item.courseId === course.id && item.holeCount === course.holeCount);
  const myHoles = new Map((overview?.stats.courses.find((item) => item.courseId === course.id)?.holes ?? []).map((hole) => [hole.hole, hole]));

  return (
    <div className="flex flex-col gap-7">
      <Link href="/app/courses" transitionTypes={NAV_BACK} className="text-sm font-semibold text-ink-2 hover:text-ink">
        ← {t("app.courses.backToCourses")}
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <Eyebrow>
            {t("common.holes", { count: course.holeCount })} · {t("app.courses.tee")} {course.tee}
          </Eyebrow>
          <h1 className="font-display mt-2 text-[clamp(1.9rem,6vw,2.9rem)] text-balance">{course.name}</h1>
          {course.description ? <p className="mt-2 text-ink-2">{course.description}</p> : null}
        </div>
        <LinkButton href={`/app/play?course=${course.id}`} variant="accent" size="lg" icon={<Flag className="size-4" />}>
          {t("app.courses.play")}
        </LinkButton>
      </header>

      <section className="stagger-children grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label={t("app.courses.par")} value={course.par} />
        <Stat label={t("app.courses.length")} value={`${formatNumber(course.length, locale)} ${t("app.courses.meters")}`} />
        <div className="col-span-2 lg:col-span-1">
          {record ? (
            <Link href={`/app/results/${record.roundId}`} className="block h-full">
              <Stat
                className="h-full transition hover:border-line-strong"
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <Trophy className="size-3 text-gold" /> {t("app.courses.record")}
                  </span>
                }
                value={
                  <>
                    {record.strokes} <span className="text-lg text-ink-3">{formatToPar(record.toPar)}</span>
                  </>
                }
                hint={t("app.courses.recordBy", { name: record.playerName, date: formatShortDate(record.completedAt, locale, session.club.timeZone) })}
              />
            </Link>
          ) : (
            <Stat className="h-full" label={t("app.courses.record")} value="–" hint={t("app.courses.noRecord")} />
          )}
        </div>
      </section>

      <section>
        <SectionHeading title={t("app.courses.holeGuide")} />
        <Card padding="none">
          <ol className="stagger-children divide-y divide-line">
            {course.holes.map((hole) => {
              const mine = myHoles.get(hole.number);
              return (
                <li key={hole.number} className="flex gap-4 px-4 py-4">
                  <span className="font-score grid size-11 shrink-0 place-items-center rounded-full bg-brand text-xl text-brand-ink">{hole.number}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{hole.name || `${t("common.hole")} ${hole.number}`}</p>
                    <p className="text-[13px] text-ink-3">
                      {t("common.par")} {hole.par} · {t("common.distance", { meters: hole.distance })}
                    </p>
                    {hole.tip ? (
                      <p className="mt-2 flex gap-2 text-sm text-ink-2">
                        <Lightbulb className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden="true" />
                        {hole.tip}
                      </p>
                    ) : null}
                  </div>
                  {mine ? (
                    <div className="text-right">
                      <p className="font-label text-[9.5px] text-ink-3">{t("app.courses.yourAverage")}</p>
                      <p className={`font-score mt-1 text-2xl ${mine.toPar > 0.05 ? "text-over" : mine.toPar < -0.05 ? "text-under" : ""}`}>
                        {formatNumber(mine.average, locale, 1)}
                      </p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </Card>
      </section>
    </div>
  );
}
