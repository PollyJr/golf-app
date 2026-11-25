import { CalendarDays, ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TabLinks } from "@/components/admin/tab-links";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { dateParts, formatTime } from "@/lib/format";
import { requireStaff } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { listEvents } from "@/server/services/events";

export const metadata: Metadata = { title: "Events" };

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const session = await requireStaff();
  const { scope: requested } = await searchParams;
  const scope = requested === "past" ? "past" : "upcoming";
  const { locale, t } = await getT();
  const events = await listEvents(session.clubId, locale, { scope, includeDrafts: true });
  const timeZone = session.club.timeZone;

  return (
    <>
      <PageHeader
        eyebrow={session.club.name}
        title={t("admin.events.title")}
        description={t("admin.events.lead")}
        actions={
          <LinkButton href="/admin/events/new" icon={<Plus className="size-4" />}>
            {t("admin.events.add")}
          </LinkButton>
        }
      />

      <TabLinks
        label={t("admin.events.tabs.label")}
        className="mb-5"
        tabs={[
          { href: "/admin/events", label: t("admin.events.tabs.upcoming"), active: scope === "upcoming" },
          { href: "/admin/events?scope=past", label: t("admin.events.tabs.past"), active: scope === "past" },
        ]}
      />

      {events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-5" />}
          title={t("admin.events.empty")}
          description={scope === "past" ? t("admin.events.emptyPast") : t("admin.events.emptyLead")}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => {
            const date = dateParts(event.startsAt, locale, timeZone);
            return (
              <li key={event.id}>
                <Link
                  href={`/admin/events/${event.id}`}
                  className="group flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card transition hover:border-line-strong"
                >
                  <span className="grid w-14 shrink-0 place-items-center rounded-2xl bg-well py-2 text-center">
                    <span className="font-label text-[10px] text-ink-3">{date.month}</span>
                    <span className="font-score text-2xl">{date.day}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate font-semibold">{event.title}</span>
                      {event.published ? null : <Badge tone="gold">{t("admin.events.draft")}</Badge>}
                    </span>
                    <span className="mt-1 block text-[13px] text-ink-2">
                      {date.weekday} {formatTime(event.startsAt, locale, timeZone)}
                      {" · "}
                      {t(`common.eventKind.${event.kind}`)}
                      {event.location || event.courseName ? ` · ${event.location || event.courseName}` : ""}
                    </span>
                    <span className="mt-1 block text-[13px] text-ink-3">
                      {event.capacity !== null
                        ? t("admin.events.capacity", { registered: event.registered, capacity: event.capacity })
                        : t("admin.events.registered", { count: event.registered })}
                      {event.waitlisted > 0 ? ` · ${t("admin.events.waitlist", { count: event.waitlisted })}` : ""}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-ink-3 transition group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
