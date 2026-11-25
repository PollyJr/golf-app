import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand";
import { ScoreMark } from "@/components/golf/score-mark";
import { LanguageSwitch } from "@/components/preferences";
import { cn } from "@/lib/cn";
import { clubThemeStyle } from "@/lib/theme";
import type { ClubBranding } from "@/lib/types";

interface AuthFrameProps {
  club?: ClubBranding | null;
  eyebrow: string;
  title: string;
  lead: string;
  features?: string[];
  children: ReactNode;
}

const SAMPLE_CARD = [3, 2, 3, 4, 1, 3, 2, 5, 3];

/**
 * The split screen every signed-out page shares: a brand panel that sets the
 * tone, and a paper-coloured column that holds the form.
 */
export function AuthFrame({ club, eyebrow, title, lead, features, children }: AuthFrameProps) {
  return (
    <div style={clubThemeStyle(club)} className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <section className="bg-ruled relative flex flex-col justify-between gap-10 overflow-hidden bg-brand px-6 pt-6 pb-10 text-brand-ink sm:px-10 lg:px-14 lg:py-12">
        <div className="flex items-center justify-between gap-4">
          <Wordmark name={club?.name} tone="light" />
          <LanguageSwitch variant="compact" />
        </div>

        <div className="stagger-children max-w-xl">
          <p className="font-label text-[11px] text-accent">{eyebrow}</p>
          <h1 className="font-display mt-4 text-[clamp(2.4rem,7.5vw,4.6rem)] text-balance">{title}</h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-pretty opacity-80 sm:text-base">{lead}</p>
          {features ? (
            <ul className="stagger-children mt-8 hidden flex-col gap-3 [--stagger-step:60ms] sm:flex">
              {features.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm font-medium">
                  <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* A strip of scorecard notation: the product in one glance. */}
        <div aria-hidden="true" className="hidden items-center gap-2 lg:flex" style={{ ["--surface" as string]: "var(--brand)", ["--under" as string]: "var(--accent)", ["--over" as string]: "#f3b9a4", ["--ink" as string]: "var(--brand-ink)", ["--gold" as string]: "var(--accent)" }}>
          {/* The marks drop onto the card one hole at a time. */}
          {SAMPLE_CARD.map((strokes, index) => (
            <ScoreMark
              key={index}
              strokes={strokes}
              par={3}
              size="md"
              className={cn("animate-score-in", strokes === 1 && "!text-accent-ink")}
              style={{ animationDelay: `${500 + index * 90}ms` }}
            />
          ))}
        </div>
      </section>

      <section className="flex items-start justify-center px-5 py-8 sm:px-10 lg:items-center lg:py-12">
        <div className="animate-rise w-full max-w-md [animation-delay:150ms]">{children}</div>
      </section>
    </div>
  );
}
