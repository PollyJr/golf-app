import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventEditor } from "@/components/admin/event-editor";
import { EventParticipants } from "@/components/admin/event-participants";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/card";
import { requireStaff } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { listCourses } from "@/server/services/courses";
import { getEvent, listEventParticipants } from "@/server/services/events";

export const metadata: Metadata = { title: "Event bewerken" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaff();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const language = session.club.defaultLanguage;
  const [{ t }, event, participants, courses] = await Promise.all([
    getT(),
    getEvent(session.clubId, id, language, { includeDrafts: true }),
    listEventParticipants(session.clubId, id),
    listCourses(session.clubId, language, { includeArchived: true }),
  ]);
  if (!event) notFound();

  return (
    <>
      <Link href="/admin/events" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" />
        {t("admin.events.editor.back")}
      </Link>
      <PageHeader
        eyebrow={t("admin.events.editor.editTitle")}
        title={event.title}
        actions={event.published ? null : <Badge tone="gold">{t("admin.events.draft")}</Badge>}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <EventEditor
          key={event.id}
          event={event}
          courses={courses.filter((course) => course.active || course.id === event.courseId).map((course) => ({ id: course.id, name: course.name }))}
          timeZone={session.club.timeZone}
        />
        <EventParticipants eventId={event.id} participants={participants} />
      </div>
    </>
  );
}
