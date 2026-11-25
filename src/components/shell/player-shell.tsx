"use client";

import {
  Bell,
  CalendarDays,
  ChartNoAxesColumn,
  CircleUserRound,
  ClipboardList,
  Flag,
  House,
  LandPlot,
  Newspaper,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand";
import { NAV_TAB, PageTransition } from "@/components/motion/page-transition";
import { SignOutButton } from "@/components/preferences";
import { useT } from "@/components/providers";
import { useOverview } from "@/components/shell/overview";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import type { MessageKey } from "@/lib/i18n/dictionaries";

interface NavItem {
  href: string;
  label: MessageKey;
  icon: LucideIcon;
  /** Other path prefixes that should light up this item. */
  also?: string[];
}

const SIDEBAR: NavItem[] = [
  { href: "/app", label: "common.nav.home", icon: House },
  { href: "/app/play", label: "common.nav.play", icon: Flag },
  { href: "/app/results", label: "common.nav.results", icon: ClipboardList },
  { href: "/app/stats", label: "common.nav.stats", icon: ChartNoAxesColumn },
  { href: "/app/leaderboards", label: "common.nav.leaderboards", icon: Trophy },
  { href: "/app/events", label: "common.nav.events", icon: CalendarDays },
  { href: "/app/club", label: "common.nav.club", icon: Newspaper },
  { href: "/app/courses", label: "common.nav.courses", icon: LandPlot },
];

const TABS: NavItem[] = [
  { href: "/app", label: "common.nav.home", icon: House },
  { href: "/app/leaderboards", label: "common.nav.leaderboards", icon: Trophy },
  { href: "/app/play", label: "common.nav.play", icon: Flag },
  { href: "/app/club", label: "common.nav.club", icon: Newspaper, also: ["/app/events", "/app/courses"] },
  { href: "/app/profile", label: "common.nav.me", icon: CircleUserRound, also: ["/app/stats", "/app/results", "/app/notifications", "/app/players"] },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/app") return pathname === "/app";
  return [item.href, ...(item.also ?? [])].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

interface PlayerShellProps {
  user: { name: string; initials: string; code: string };
  clubName: string;
  children: ReactNode;
}

export function PlayerShell({ user, clubName, children }: PlayerShellProps) {
  const t = useT();
  const pathname = usePathname();
  const { overview } = useOverview();
  const openRounds = overview.rounds.length;
  // The live scorecard is a focused, full-screen task: no chrome around it.
  const focused = /^\/app\/play\/[^/]+/.test(pathname) || pathname === "/app/welcome";

  if (focused) {
    return (
      <main id="content">
        <PageTransition>{children}</PageTransition>
      </main>
    );
  }

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-ink">
        {t("common.skipToContent")}
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
        <Link href="/app" className="block min-w-0 px-2">
          <Wordmark name={clubName} />
        </Link>
        <nav className="mt-8 flex flex-col gap-1" aria-label={t("common.appName")}>
          {SIDEBAR.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                transitionTypes={NAV_TAB}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-control px-3 text-sm font-semibold transition",
                  active ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-well hover:text-ink",
                )}
              >
                <item.icon className="size-[1.15rem]" />
                <span className="flex-1">{t(item.label)}</span>
                {item.href === "/app/play" && openRounds > 0 ? (
                  <span className="font-score grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] text-accent-ink">{openRounds}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-line pt-4">
          <Link
            href="/app/notifications"
            transitionTypes={NAV_TAB}
            className={cn(
              "flex h-11 items-center gap-3 rounded-control px-3 text-sm font-semibold transition",
              pathname.startsWith("/app/notifications") ? "bg-well text-ink" : "text-ink-2 hover:bg-well hover:text-ink",
            )}
          >
            <Bell className="size-[1.15rem]" />
            <span className="flex-1">{t("common.nav.notifications")}</span>
            {overview.unread > 0 ? (
              <span className="font-score grid h-5 min-w-5 place-items-center rounded-full bg-over px-1.5 text-[11px] text-surface">{overview.unread}</span>
            ) : null}
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/app/profile" transitionTypes={NAV_TAB} className="flex min-w-0 flex-1 items-center gap-3 rounded-control px-2 py-2 hover:bg-well">
              <Avatar name={user.name} initials={user.initials} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{user.name}</span>
                <span className="block truncate text-xs text-ink-3">{user.code}</span>
              </span>
            </Link>
            <SignOutButton iconOnly />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header
          className="safe-top sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md lg:hidden"
          style={{ viewTransitionName: "shell-header" }}
        >
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Link href="/app" className="min-w-0">
              <Wordmark name={clubName} />
            </Link>
            <Link
              href="/app/notifications"
              transitionTypes={NAV_TAB}
              aria-label={t("common.nav.notifications")}
              className="relative grid size-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-well"
            >
              <Bell className="size-5" />
              {overview.unread > 0 ? (
                <span
                  key={overview.unread}
                  className="font-score animate-pop absolute top-0.5 right-0.5 grid h-[1.1rem] min-w-[1.1rem] place-items-center rounded-full bg-over px-1 text-[10px] text-surface"
                >
                  {overview.unread > 9 ? "9+" : overview.unread}
                </span>
              ) : null}
            </Link>
          </div>
        </header>

        <main id="content" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-32 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      <nav
        aria-label={t("common.appName")}
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-2 pt-1.5 backdrop-blur-md lg:hidden"
        style={{ viewTransitionName: "shell-tabbar" }}
      >
        <ul className="mx-auto grid max-w-md grid-cols-5 items-end">
          {TABS.map((item) => {
            const active = isActive(pathname, item);
            const primary = item.href === "/app/play";
            return (
              <li key={item.href} className="flex justify-center">
                <Link
                  href={item.href}
                  transitionTypes={NAV_TAB}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex w-full flex-col items-center gap-1 rounded-xl py-1.5 text-[10.5px] font-semibold transition active:scale-95",
                    primary ? "text-ink" : active ? "text-brand-fg" : "text-ink-3",
                  )}
                >
                  {primary ? (
                    <span className="-mt-6 grid size-14 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_6px_18px_-6px_rgb(0_0_0/0.45)] ring-4 ring-surface transition-transform duration-300 ease-(--ease-spring) active:scale-90">
                      <item.icon className="size-6" />
                      {openRounds > 0 ? (
                        <span className="animate-live absolute top-[-1.35rem] right-[calc(50%-1.9rem)] size-3.5 rounded-full border-2 border-surface bg-over text-over" />
                      ) : null}
                    </span>
                  ) : (
                    <span className="relative grid place-items-center">
                      {active ? (
                        <span aria-hidden="true" className="animate-scale-in absolute -inset-x-3 -inset-y-1 rounded-full bg-brand-soft" />
                      ) : null}
                      <item.icon key={String(active)} className={cn("relative size-[1.35rem]", active && "animate-pop stroke-[2.4]")} />
                    </span>
                  )}
                  <span>{t(item.label)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
