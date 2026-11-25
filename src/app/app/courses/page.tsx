import { LandPlot } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { requirePlayer } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { listCourses } from "@/server/services/courses";
import { getCourseRecords } from "@/server/services/leaderboards";

export const metadata: Metadata = { title: "Banen" };

export default async function CoursesPage() {
  const session = await requirePlayer();
  const { t, locale } = await getT();
  const [courses, records] = await Promise.all([listCourses(session.clubId, locale), getCourseRecords(session.clubId, locale)]);

  return (
    <>
      <PageHeader eyebrow={t("app.courses.eyebrow")} title={t("app.courses.title")} description={t("app.courses.lead")} />
      {courses.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {courses.map((course) => {
            const record = records.find((item) => item.courseId === course.id && item.holeCount === course.holeCount);
            return (
              <li key={course.id}>
                <Link
                  href={`/app/courses/${course.id}`}
                  className="flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card transition hover:border-line-strong active:scale-[0.99]"
                >
                  <div className="bg-ruled relative flex items-end justify-between gap-4 bg-brand px-5 pt-8 pb-4 text-brand-ink">
                    <h2 className="font-display text-2xl text-balance">{course.name}</h2>
                    <span className="font-score grid size-12 shrink-0 place-items-center rounded-full text-xl text-[#10291d]" style={{ backgroundColor: course.accent }}>
                      {course.holeCount}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    {course.description ? <p className="line-clamp-2 text-sm text-ink-2">{course.description}</p> : null}
                    <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-line pt-4">
                      <div>
                        <dt className="font-label text-[10px] text-ink-3">{t("app.courses.par")}</dt>
                        <dd className="font-score mt-1 text-2xl">{course.par}</dd>
                      </div>
                      <div>
                        <dt className="font-label text-[10px] text-ink-3">{t("app.courses.length")}</dt>
                        <dd className="font-score mt-1 text-2xl">
                          {course.length}
                          <span className="ml-0.5 text-sm text-ink-3">{t("app.courses.meters")}</span>
                        </dd>
                      </div>
                      <div>
                        <dt className="font-label text-[10px] text-ink-3">{t("app.courses.record")}</dt>
                        <dd className="font-score mt-1 text-2xl">{record ? record.strokes : "–"}</dd>
                      </div>
                    </dl>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<LandPlot className="size-5" />} title={t("app.courses.empty")} />
      )}
    </>
  );
}
