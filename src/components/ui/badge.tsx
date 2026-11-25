import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "brand" | "accent" | "under" | "over" | "gold" | "info" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-well text-ink-2 border-line",
  brand: "bg-brand-soft text-brand-fg border-transparent",
  accent: "bg-accent text-accent-ink border-transparent",
  under: "bg-under-soft text-under border-transparent",
  over: "bg-over-soft text-over border-transparent",
  gold: "bg-gold-soft text-gold border-transparent",
  info: "bg-info-soft text-info border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
};

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", children, icon, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "font-label inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-[10.5px] whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** A pulsing dot for anything happening right now. */
export function LiveDot({ className }: { className?: string }) {
  return <span className={cn("inline-block size-2 rounded-full bg-current animate-live", className)} aria-hidden="true" />;
}
