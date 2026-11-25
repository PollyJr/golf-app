import type { HTMLAttributes, ReactNode } from "react";
import { CountUp } from "@/components/motion/animated-number";
import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  tone?: "surface" | "well" | "brand";
}

const PADDING = { none: "", sm: "p-4", md: "p-5", lg: "p-6 sm:p-7" };

export function Card({ padding = "md", tone = "surface", className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border",
        tone === "surface" && "border-line bg-surface shadow-card",
        tone === "well" && "border-line bg-well",
        tone === "brand" && "border-transparent bg-brand text-brand-ink",
        PADDING[padding],
        className,
      )}
      {...rest}
    />
  );
}

/** Small condensed capitals above a title. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("font-label text-[11px] text-ink-3", className)}>{children}</p>;
}

interface SectionHeadingProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function SectionHeading({ title, eyebrow, action, className }: SectionHeadingProps) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? <Eyebrow className="mb-1">{eyebrow}</Eyebrow> : null}
        <h2 className="font-display text-xl">{title}</h2>
      </div>
      {action ? <div className="shrink-0 text-sm">{action}</div> : null}
    </div>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, eyebrow, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("animate-rise mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? <Eyebrow className="mb-2">{eyebrow}</Eyebrow> : null}
        <h1 className="font-display text-[clamp(1.85rem,6vw,2.75rem)] text-balance">{title}</h1>
        {description ? <p className="mt-2 text-pretty text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("animate-fade-in flex flex-col items-center rounded-card border border-dashed border-line-strong px-6 py-10 text-center", className)}>
      {icon ? <div className="animate-scale-in mb-3 grid size-12 place-items-center rounded-full bg-well text-ink-2 [animation-delay:120ms]">{icon}</div> : null}
      <p className="font-display text-lg">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-ink-2">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

interface StatProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "under" | "over" | "gold";
  className?: string;
}

/** One headline number with its label; the unit of every dashboard. */
export function Stat({ label, value, hint, tone = "default", className }: StatProps) {
  return (
    <div className={cn("rounded-card border border-line bg-surface p-4 shadow-card", className)}>
      <p className="font-label text-[10.5px] text-ink-3">{label}</p>
      <p
        className={cn(
          "font-score mt-2 text-[2.1rem]",
          tone === "under" && "text-under",
          tone === "over" && "text-over",
          tone === "gold" && "text-gold",
        )}
      >
        {/* Plain numbers count up when the page is opened from within the app. */}
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-line", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-control", className)} aria-hidden="true" />;
}
