"use client";

import { Award, Bell, CalendarDays, CircleAlert, Flag, Newspaper, ShieldCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useFormat, useT } from "@/components/providers";
import { useOverview } from "@/components/shell/overview";
import { EmptyState } from "@/components/ui/card";
import { useNow } from "@/hooks/use-now";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatSince } from "@/lib/format";
import { isAchievementKey } from "@/lib/golf/achievements";
import type { NotificationDto, NotificationKind } from "@/lib/types";
import { NAV_FORWARD } from "@/components/motion/page-transition";

const ICONS: Record<NotificationKind, LucideIcon> = {
  round_invite: Flag,
  round_joined: Flag,
  round_started: Flag,
  round_approved: ShieldCheck,
  round_rejected: CircleAlert,
  achievement: Award,
  event_published: CalendarDays,
  event_promoted: CalendarDays,
  news_published: Newspaper,
};

function hrefFor(notification: NotificationDto): string {
  const { data } = notification;
  switch (notification.kind) {
    case "round_invite":
    case "round_joined":
    case "round_started":
      return data.roundId ? `/app/play/${data.roundId}` : "/app";
    case "round_approved":
    case "round_rejected":
      return data.roundId ? `/app/results/${data.roundId}` : "/app/results";
    case "achievement":
      return "/app/stats";
    case "event_published":
    case "event_promoted":
      return data.eventId ? `/app/events/${data.eventId}` : "/app/events";
    case "news_published":
      return data.newsId ? `/app/club/news/${data.newsId}` : "/app/club";
  }
}

/** The notification centre. Opening it marks everything as read. */
export function NotificationList({ initial }: { initial: NotificationDto[] }) {
  const t = useT();
  const { locale } = useFormat();
  const { refresh } = useOverview();
  const now = useNow();

  useEffect(() => {
    if (initial.some((notification) => notification.readAt === null)) {
      void api.post("/api/me/notifications", {}).then(refresh).catch(() => {});
    }
  }, [initial, refresh]);

  if (initial.length === 0) {
    return <EmptyState icon={<Bell className="size-5" />} title={t("app.notifications.empty")} description={t("app.notifications.emptyLead")} />;
  }

  function text(notification: NotificationDto): string {
    const data = { ...notification.data };
    if (notification.kind === "achievement" && isAchievementKey(data.key ?? "")) {
      data.title = t(`app.achievements.${data.key as "ace"}.title`);
    }
    return t(`app.notifications.${notification.kind}`, data);
  }

  return (
    <ul className="stagger-children flex flex-col gap-2">
      {initial.map((notification) => {
        const Icon = ICONS[notification.kind] ?? Bell;
        const unread = notification.readAt === null;
        return (
          <li key={notification.id}>
            <Link
              href={hrefFor(notification)}
              transitionTypes={NAV_FORWARD}
              className={cn(
                "flex items-start gap-3 rounded-card border px-4 py-3.5 transition duration-300 hover:-translate-y-0.5 hover:border-line-strong active:scale-[0.99]",
                unread ? "border-brand-fg/30 bg-brand-soft" : "border-line bg-surface",
              )}
            >
              <span className={cn("relative mt-0.5 grid size-9 shrink-0 place-items-center rounded-full", unread ? "bg-brand text-brand-ink" : "bg-well text-ink-3")}>
                <Icon className={cn("size-4", unread && "animate-pop")} />
                {unread ? <span aria-hidden="true" className="animate-live absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-brand-soft bg-accent text-accent" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", unread ? "font-semibold" : "text-ink-2")}>{text(notification)}</span>
                {notification.kind === "round_rejected" && notification.data.reason ? (
                  <span className="mt-0.5 block text-[13px] text-ink-3">“{notification.data.reason}”</span>
                ) : null}
                <span className="mt-1 block text-xs text-ink-3" suppressHydrationWarning>
                  {now ? formatSince(notification.createdAt, locale, now) : ""}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
