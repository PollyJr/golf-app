import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EventRow } from "@/components/app/rows";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { requirePlayer } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { listEvents } from "@/server/services/events";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const session = await requirePlayer();
  const { t, locale } = await getT();
  const scope = (await searchParams).scope === "past" ? "past" : "upcoming";
  const events = await listEvents(session.clubId, locale, { playerId: session.accountId, scope });
  const tabs = [
    { scope: "upcoming", label: t("app.events.upcoming"), href: "/app/events" },
    { scope: "past", label: t("app.events.past"), href: "/app/events?scope=past" },
  ];

  return (
    <>
      <PageHeader eyebrow={t("app.events.eyebrow")} title={t("app.events.title")} description={t("app.events.lead")} />
      <nav className="mb-5 inline-flex gap-1 rounded-full border border-line bg-well p-1" aria-label={t("app.events.title")}>
        {tabs.map((tab) => (
          <Link
            key={tab.scope}
            href={tab.href}
            aria-current={tab.scope === scope ? "page" : undefined}
            className={cn(
              "grid h-9 place-items-center rounded-full px-4 text-sm font-semibold transition",
              tab.scope === scope ? "bg-brand text-brand-ink shadow-sm" : "text-ink-2 hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {events.length > 0 ? (
        <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {events.map((event) => (
            <li key={event.id}>
              <EventRow event={event} t={t} locale={locale} timeZone={session.club.timeZone} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<CalendarDays className="size-5" />}
          title={scope === "past" ? t("app.events.emptyPast") : t("app.events.empty")}
          description={scope === "past" ? undefined : t("app.events.emptyLead")}
        />
      )}
    </>
  );
}
