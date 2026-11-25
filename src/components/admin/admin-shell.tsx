"use client";

import {
  CalendarDays,
  ClipboardCheck,
  Flag,
  History,
  LayoutDashboard,
  Megaphone,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand";
import { LanguageSwitch, SignOutButton } from "@/components/preferences";
import { useT } from "@/components/providers";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import type { MessageKey } from "@/lib/i18n/dictionaries";

interface AdminShellProps {
  clubName: string;
  user: { displayName: string; initials: string };
  isOwner: boolean;
  badges: { players: number; rounds: number };
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: MessageKey;
  icon: LucideIcon;
  badge?: "players" | "rounds";
  ownerOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "admin.nav.dashboard", icon: LayoutDashboard },
  { href: "/admin/players", label: "admin.nav.players", icon: Users, badge: "players" },
  { href: "/admin/rounds", label: "admin.nav.rounds", icon: ClipboardCheck, badge: "rounds" },
  { href: "/admin/courses", label: "admin.nav.courses", icon: Flag },
  { href: "/admin/events", label: "admin.nav.events", icon: CalendarDays },
  { href: "/admin/news", label: "admin.nav.news", icon: Megaphone },
  { href: "/admin/settings", label: "admin.nav.settings", icon: Settings, ownerOnly: true },
  { href: "/admin/staff", label: "admin.nav.staff", icon: UserCog, ownerOnly: true },
  { href: "/admin/audit", label: "admin.nav.audit", icon: History },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="font-score ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] text-accent-ink">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * The frame around every management page: a sidebar on wide screens, and a
 * top bar with a sideways-scrolling menu on phones.
 */
export function AdminShell({ clubName, user, isOwner, badges, children }: AdminShellProps) {
  const t = useT();
  const pathname = usePathname();
  const items = NAV.filter((item) => !item.ownerOnly || isOwner);
  const accountActive = isActive(pathname, "/admin/account");

  return (
    // While a print sheet (issued credentials) is mounted, only that sheet prints.
    <div className="min-h-dvh print:[[data-print-sheet]_&]:hidden">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-ink"
      >
        {t("common.skipToContent")}
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex print:hidden">
        <div className="px-5 pt-6 pb-5">
          <Link href="/admin" aria-label={clubName} className="block">
            <Wordmark name={clubName} className="flex" />
          </Link>
          <p className="font-label mt-3 text-[10.5px] text-ink-3">{t("admin.shell.label")}</p>
        </div>
        <nav aria-label={t("admin.shell.navigation")} className="flex-1 overflow-y-auto px-3 pb-4">
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center gap-3 rounded-control px-3 text-sm font-semibold transition",
                      active ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-well hover:text-ink",
                    )}
                  >
                    <item.icon className="size-[1.1rem] shrink-0" />
                    <span className="truncate">{t(item.label)}</span>
                    {item.badge ? <CountBadge count={badges[item.badge]} /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-line p-3">
          <Link
            href="/admin/account"
            aria-current={accountActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-control px-2 py-2 transition hover:bg-well",
              accountActive && "bg-well",
            )}
          >
            <Avatar name={user.displayName} initials={user.initials} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{user.displayName}</span>
              <span className="block truncate text-xs text-ink-3">
                {t(isOwner ? "admin.roles.club_owner" : "admin.roles.club_staff")}
              </span>
            </span>
          </Link>
          <div className="mt-2 flex items-center justify-between gap-2 px-1 text-ink-2">
            <LanguageSwitch variant="compact" />
            <SignOutButton redirectTo="/admin/login" />
          </div>
        </div>
      </aside>

      <header className="safe-top sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur lg:hidden print:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link href="/admin" aria-label={clubName} className="block min-w-0 flex-1">
            <Wordmark name={clubName} className="flex" />
          </Link>
          <div className="flex shrink-0 items-center gap-1 text-ink-2">
            <LanguageSwitch variant="compact" />
            <Link
              href="/admin/account"
              aria-label={t("admin.shell.account")}
              title={t("admin.shell.account")}
              className="grid size-10 place-items-center rounded-full hover:bg-well"
            >
              <Avatar name={user.displayName} initials={user.initials} size="sm" />
            </Link>
            <SignOutButton redirectTo="/admin/login" iconOnly />
          </div>
        </div>
        <nav aria-label={t("admin.shell.navigation")} className="scrollbar-none overflow-x-auto px-3 pb-2">
          <ul className="flex w-max gap-1">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap transition",
                      active ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-well hover:text-ink",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {t(item.label)}
                    {item.badge ? <CountBadge count={badges[item.badge]} /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main id="admin-content" className="lg:pl-64 print:pl-0">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:px-10 lg:pt-10">{children}</div>
      </main>
    </div>
  );
}
