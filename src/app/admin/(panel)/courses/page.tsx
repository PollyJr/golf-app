import { ChevronRight, Flag, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { requireStaff } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { listCourses } from "@/server/services/courses";

export const metadata: Metadata = { title: "Banen" };

export default async function AdminCoursesPage() {
  const session = await requireStaff();
  const { locale, t } = await getT();
  const courses = await listCourses(session.clubId, locale, { includeArchived: true });

  return (
    <>
      <PageHeader
        eyebrow={session.club.name}
        title={t("admin.courses.title")}
        description={t("admin.courses.lead")}
        actions={
          <LinkButton href="/admin/courses/new" icon={<Plus className="size-4" />}>
            {t("admin.courses.add")}
          </LinkButton>
        }
      />

      {courses.length === 0 ? (
        <EmptyState
          icon={<Flag className="size-5" />}
          title={t("admin.courses.empty")}
          description={t("admin.courses.emptyLead")}
          action={
            <LinkButton href="/admin/courses/new" icon={<Plus className="size-4" />}>
              {t("admin.courses.add")}
            </LinkButton>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <li key={course.id}>
              <Link
                href={`/admin/courses/${course.id}`}
                className={`group flex h-full flex-col rounded-card border border-line bg-surface p-5 shadow-card transition hover:border-line-strong ${course.active ? "" : "opacity-70"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="font-score grid size-12 shrink-0 place-items-center rounded-2xl text-xl text-ink"
                    style={{ backgroundColor: `color-mix(in oklab, ${course.accent} 55%, var(--surface))` }}
                  >
                    {course.holeCount}
                  </span>
                  {course.active ? null : <Badge>{t("admin.courses.archived")}</Badge>}
                </div>
                <h2 className="font-display mt-4 text-xl">{course.name}</h2>
                <p className="mt-1.5 text-sm text-ink-2">
                  {t("admin.courses.meta", { par: course.par, length: course.length, tee: course.tee })}
                </p>
                {course.description ? <p className="mt-2 line-clamp-2 text-sm text-ink-3">{course.description}</p> : null}
                <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-brand-fg">
                  {t("common.edit")}
                  <ChevronRight className="size-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
