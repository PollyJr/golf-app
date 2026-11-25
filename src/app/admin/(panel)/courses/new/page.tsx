import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CourseEditor } from "@/components/admin/course-editor";
import { PageHeader } from "@/components/ui/card";
import { requireStaff } from "@/server/auth/guards";
import { getT } from "@/server/i18n";

export const metadata: Metadata = { title: "Nieuwe baan" };

export default async function NewCoursePage() {
  await requireStaff();
  const { t } = await getT();
  return (
    <>
      <Link href="/admin/courses" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" />
        {t("admin.courses.editor.back")}
      </Link>
      <PageHeader title={t("admin.courses.editor.newTitle")} />
      <CourseEditor course={null} />
    </>
  );
}
