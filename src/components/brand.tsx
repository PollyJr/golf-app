import type { SVGProps } from "react";
import { cn } from "@/lib/cn";

/** The flag-on-a-green mark. Inherits the current text colour. */
export function BrandMark({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={cn("size-6", className)} {...rest}>
      <path d="M8 36c8-6 17-6.5 26-2.2 2.4 1.1 4.4 1.2 6 .5" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
      <path d="M20 36.5V10" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
      <path d="M22.5 11h16l-4.8 5.25 4.8 5.25h-16z" fill="currentColor" />
    </svg>
  );
}

interface WordmarkProps {
  /** The club name replaces the product name inside a club's own pages. */
  name?: string;
  tone?: "ink" | "light";
  className?: string;
}

export function Wordmark({ name = "Fairway", tone = "ink", className }: WordmarkProps) {
  return (
    <span className={cn("flex max-w-full min-w-0 items-center gap-2.5", className)}>
      <span className="grid size-9 shrink-0 place-items-center rounded-[0.7rem] bg-accent text-accent-ink">
        <BrandMark className="size-[1.45rem]" />
      </span>
      <span
        className={cn(
          "truncate text-[15px] font-extrabold tracking-[0.02em] uppercase [font-stretch:112%]",
          tone === "light" ? "text-brand-ink" : "text-ink",
        )}
      >
        {name}
      </span>
    </span>
  );
}
