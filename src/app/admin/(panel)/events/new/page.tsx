import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EventEditor } from "@/components/admin/event-editor";
import { PageHeader } from "@/components/ui/card";
import { requireStaff } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { listCourses } from "@/server/services/courses";

export const metadata: Metadata = { title: "Nieuw event" };

export default async function NewEventPage() {
  const session = await requireStaff();
  const [{ t }, courses] = await Promise.all([getT(), listCourses(session.clubId, session.club.defaultLanguage)]);
  return (
    <>
      <Link href="/admin/events" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" />
        {t("admin.events.editor.back")}
      </Link>
      <PageHeader title={t("admin.events.editor.newTitle")} />
      <EventEditor event={null} courses={courses.map((course) => ({ id: course.id, name: course.name }))} timeZone={session.club.timeZone} />
    </>
  );
}
