import { ChevronRight, MapPin, Pin, Users } from "lucide-react";
import Link from "next/link";
import { ToPar } from "@/components/golf/score-mark";
import { Badge, type Tone } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { dateParts, formatShortDate, formatTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n/core";
import type { AppTranslate } from "@/lib/i18n/dictionaries";
import type { EventDto, NewsItem, RoundHistoryItem } from "@/lib/types";

const STATUS_TONE: Record<RoundHistoryItem["status"], Tone> = { pending: "gold", approved: "under", rejected: "danger" };

interface Formatting {
  t: AppTranslate;
  locale: Locale;
  timeZone: string;
}

/** One finished round in a list: date, course, score and review status. */
export function RoundRow({ round, t, locale, timeZone }: { round: RoundHistoryItem } & Formatting) {
  const others = round.participantCount - 1;
  return (
    <Link
      href={`/app/results/${round.id}`}
      className="flex items-center gap-4 rounded-card border border-line bg-surface px-4 py-3.5 shadow-card transition hover:border-line-strong active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{round.courseName}</p>
        <p className="mt-0.5 truncate text-[13px] text-ink-3">
          {formatShortDate(round.completedAt, locale, timeZone)} · {t("common.holes", { count: round.holeCount })} ·{" "}
          {others > 0 ? t("app.results.withOthers", { count: others }) : t("app.results.solo")}
        </p>
        {round.status !== "approved" ? (
          <Badge tone={STATUS_TONE[round.status]} className="mt-2">
            {t(`common.status.${round.status}`)}
          </Badge>
        ) : null}
      </div>
      <div className="text-right">
        <p className="font-score text-3xl">{round.strokes}</p>
        <ToPar value={round.strokes - round.par} className="text-sm" />
      </div>
      <ChevronRight className="size-4 shrink-0 text-ink-3" />
    </Link>
  );
}

/** A calendar-style date tile. */
export function DateTile({ date, locale, timeZone, className }: { date: string; locale: Locale; timeZone: string; className?: string }) {
  const parts = dateParts(date, locale, timeZone);
  return (
    <div className={cn("grid w-14 shrink-0 place-items-center rounded-xl bg-brand py-2 text-brand-ink", className)}>
      <span className="font-label text-[10px] opacity-80">{parts.month}</span>
      <span className="font-score text-2xl">{parts.day}</span>
    </div>
  );
}

export function EventRow({ event, t, locale, timeZone }: { event: EventDto } & Formatting) {
  const full = event.capacity !== null && event.registered >= event.capacity;
  return (
    <Link
      href={`/app/events/${event.id}`}
      className="flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card transition hover:border-line-strong active:scale-[0.99]"
    >
      <DateTile date={event.startsAt} locale={locale} timeZone={timeZone} />
      <div className="min-w-0 flex-1">
        <p className="font-label text-[10px] text-ink-3">{t(`common.eventKind.${event.kind}`)}</p>
        <p className="mt-0.5 line-clamp-2 font-semibold text-balance">{event.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">
          <span>{formatTime(event.startsAt, locale, timeZone)}</span>
          {event.location || event.courseName ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {event.location || event.courseName}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" />
            {event.capacity !== null ? `${event.registered}/${event.capacity}` : event.registered}
          </span>
        </p>
      </div>
      {event.myStatus === "registered" ? (
        <Badge tone="under">{t("app.home.registered")}</Badge>
      ) : event.myStatus === "waitlisted" ? (
        <Badge tone="gold">{t("app.events.joinWaitlist")}</Badge>
      ) : full ? (
        <Badge>{t("app.events.full")}</Badge>
      ) : (
        <ChevronRight className="size-4 shrink-0 text-ink-3" />
      )}
    </Link>
  );
}

export function NewsRow({ item, t, locale, timeZone }: { item: NewsItem } & Formatting) {
  return (
    <Link
      href={`/app/club/news/${item.id}`}
      className="block rounded-card border border-line bg-surface p-4 shadow-card transition hover:border-line-strong active:scale-[0.99]"
    >
      <div className="flex items-center gap-2">
        {item.pinned ? (
          <Badge tone="accent" icon={<Pin className="size-3" />}>
            {t("app.club.pinned")}
          </Badge>
        ) : null}
        {item.kind === "announcement" ? <Badge tone="info">{t("app.club.announcement")}</Badge> : null}
        {item.publishedAt ? <span className="text-xs text-ink-3">{formatShortDate(item.publishedAt, locale, timeZone)}</span> : null}
      </div>
      <p className="mt-2 font-semibold text-balance">{item.title}</p>
      <p className="mt-1 line-clamp-2 text-sm text-ink-2">{item.body}</p>
    </Link>
  );
}
