import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseEditor } from "@/components/admin/course-editor";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/card";
import { requireStaff } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { getCourse } from "@/server/services/courses";

export const metadata: Metadata = { title: "Baan bewerken" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaff();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  // Staff edit the text in the club's own language, whatever their interface language.
  const [{ t }, course] = await Promise.all([getT(), getCourse(session.clubId, id, session.club.defaultLanguage)]);
  if (!course) notFound();

  return (
    <>
      <Link href="/admin/courses" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" />
        {t("admin.courses.editor.back")}
      </Link>
      <PageHeader
        eyebrow={t("admin.courses.editor.editTitle")}
        title={course.name}
        actions={course.active ? null : <Badge>{t("admin.courses.archived")}</Badge>}
      />
      <CourseEditor key={`${course.id}-${course.active}`} course={course} />
    </>
  );
}
