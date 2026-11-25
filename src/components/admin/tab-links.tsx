import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface TabLinksProps {
  label: string;
  tabs: ReadonlyArray<{ href: string; label: ReactNode; active: boolean; count?: number }>;
  className?: string;
}

/** Tabs that are plain links, so the selected view lives in the URL. */
export function TabLinks({ label, tabs, className }: TabLinksProps) {
  return (
    <nav
      aria-label={label}
      className={cn("scrollbar-none inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-well p-1", className)}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition",
            tab.active ? "bg-brand text-brand-ink shadow-sm" : "text-ink-2 hover:text-ink",
          )}
        >
          {tab.label}
          {tab.count ? (
            <span
              className={cn(
                "font-score grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px]",
                tab.active ? "bg-accent text-accent-ink" : "bg-line text-ink-2",
              )}
            >
              {tab.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
