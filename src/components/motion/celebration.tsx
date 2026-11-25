"use client";

import { Crown, Trophy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Confetti } from "./confetti";
import { ScoreMark } from "@/components/golf/score-mark";
import { useT } from "@/components/providers";
import { cn } from "@/lib/cn";
import type { ScoreKind } from "@/lib/golf/scoring";

/**
 * The moments worth stopping for while you follow a round: a birdie or
 * better, a new leader, and the end of the round. They queue up and show one
 * at a time; a tap dismisses one early.
 */
export type Celebration =
  | { id: string; kind: "score"; result: Extract<ScoreKind, "ace" | "albatross" | "eagle" | "birdie">; name: string; hole: number; strokes: number; par: number }
  | { id: string; kind: "lead"; name: string }
  | { id: string; kind: "finished"; winner: string | null };

const DURATION: Record<string, number> = { ace: 5200, albatross: 4200, eagle: 3800, birdie: 3000, lead: 2600, finished: 4800 };
const MAX_QUEUED = 6;

export function useCelebrations() {
  const [queue, setQueue] = useState<Celebration[]>([]);
  const push = useCallback((items: readonly Celebration[]) => {
    if (items.length === 0) return;
    setQueue((current) => {
      const known = new Set(current.map((item) => item.id));
      return [...current, ...items.filter((item) => !known.has(item.id))].slice(0, MAX_QUEUED);
    });
  }, []);
  const done = useCallback((id: string) => setQueue((current) => current.filter((item) => item.id !== id)), []);
  return { current: queue[0] ?? null, push, done };
}

interface OverlayProps {
  celebration: Celebration | null;
  onDone: (id: string) => void;
  /** `tv`: larger, centred, for the clubhouse screen across the room. */
  variant?: "phone" | "tv";
}

export function CelebrationOverlay({ celebration, onDone, variant = "phone" }: OverlayProps) {
  if (!celebration) return null;
  return <CelebrationView key={celebration.id} celebration={celebration} onDone={onDone} tv={variant === "tv"} />;
}

function CelebrationView({ celebration, onDone, tv }: { celebration: Celebration; onDone: (id: string) => void; tv: boolean }) {
  const t = useT();
  const [leaving, setLeaving] = useState(false);
  const durationKey = celebration.kind === "score" ? celebration.result : celebration.kind;

  useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(true), DURATION[durationKey] ?? 3000);
    return () => window.clearTimeout(timer);
  }, [durationKey]);

  // Normally the exit animation's end removes it; this covers a browser that
  // runs no animations at all.
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => onDone(celebration.id), 700);
    return () => window.clearTimeout(timer);
  }, [leaving, onDone, celebration.id]);

  const finish = () => onDone(celebration.id);
  const dismiss = () => setLeaving(true);

  if (celebration.kind === "score" && celebration.result === "ace") {
    return (
      <div
        role="status"
        onClick={dismiss}
        onAnimationEnd={(event) => {
          if (leaving && event.target === event.currentTarget) finish();
        }}
        className={cn(
          "fixed inset-0 z-[95] grid cursor-pointer place-items-center bg-[rgb(9_18_13/0.78)] px-6 backdrop-blur-sm",
          leaving ? "animate-toast-out" : "animate-fade-in",
        )}
      >
        <div className="relative flex flex-col items-center text-center text-white">
          <Confetti pieces={64} spread={2.4} palette="gold" seed={7} />
          <span aria-hidden="true" className="animate-burst absolute top-16 size-44 -translate-y-1/2 rounded-full border-4 border-gold" />
          <span aria-hidden="true" className="animate-burst absolute top-16 size-44 -translate-y-1/2 rounded-full border-2 border-gold [animation-delay:250ms]" />
          <span className="font-score animate-stamp grid size-32 place-items-center rounded-full bg-gold text-7xl text-[#2a1d05] shadow-[0_0_0_6px_rgb(0_0_0/0.3),0_0_0_11px_var(--gold)]">
            1
          </span>
          <p className="font-display animate-stamp mt-9 text-[clamp(2.6rem,11vw,4.5rem)] [animation-delay:160ms]">{t("common.celebrate.ace")}</p>
          <p className="animate-rise mt-3 text-lg opacity-90 [animation-delay:320ms]">
            {t("common.celebrate.detail", { name: celebration.name, hole: celebration.hole })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[90] flex justify-center px-4",
        tv ? "top-[12%]" : "top-0 pt-[max(env(safe-area-inset-top),0.75rem)]",
      )}
    >
      <button
        type="button"
        role="status"
        onClick={dismiss}
        onAnimationEnd={(event) => {
          if (leaving && event.target === event.currentTarget) finish();
        }}
        className={cn(
          "pointer-events-auto relative flex w-full items-center gap-4 rounded-3xl bg-brand px-4 py-3.5 text-left text-brand-ink shadow-pop",
          tv ? "max-w-sm lg:max-w-[46rem] lg:gap-10 lg:rounded-[2.5rem] lg:px-12 lg:py-10 lg:ring-4 lg:ring-accent/40" : "max-w-sm",
          leaving ? "animate-toast-out" : "animate-toast-in",
        )}
      >
        {celebration.kind === "score" ? (
          <>
            <span className={cn("relative grid shrink-0 place-items-center", tv ? "size-16 lg:size-40" : "size-16")}>
              <Confetti pieces={tv ? 48 : 28} spread={tv ? 2 : 0.9} seed={celebration.hole + celebration.strokes} />
              <span aria-hidden="true" className="animate-burst absolute inset-0 rounded-full bg-accent/50" />
              <span className={cn("animate-stamp relative grid place-items-center rounded-full bg-surface", tv ? "size-15 lg:size-36" : "size-15")}>
                <ScoreMark strokes={celebration.strokes} par={celebration.par} size={tv ? "lg" : "md"} className={tv ? "lg:size-24 lg:text-6xl" : undefined} />
              </span>
            </span>
            <span className="min-w-0">
              <span className={cn("font-display animate-stamp block text-[1.7rem] text-accent [animation-delay:120ms]", tv && "lg:text-[5rem]")}>
                {t(`common.celebrate.${celebration.result}`)}
              </span>
              <span className={cn("mt-0.5 block truncate text-sm opacity-85", tv && "lg:mt-3 lg:text-3xl")}>
                {t("common.celebrate.detail", { name: celebration.name, hole: celebration.hole })}
              </span>
            </span>
          </>
        ) : celebration.kind === "lead" ? (
          <>
            <span className="animate-stamp grid size-12 shrink-0 place-items-center rounded-full bg-gold text-[#2a1d05]">
              <Crown className="size-6" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="font-label block text-[10.5px] text-accent">{t("common.celebrate.leadEyebrow")}</span>
              <span className="mt-0.5 block truncate text-lg font-bold">{t("common.celebrate.lead", { name: celebration.name })}</span>
            </span>
          </>
        ) : (
          <>
            <span className="relative grid size-16 shrink-0 place-items-center">
              <Confetti pieces={36} spread={1.2} palette="gold" seed={3} />
              <span className="animate-stamp grid size-14 place-items-center rounded-full bg-accent text-accent-ink">
                <Trophy className="size-7" aria-hidden="true" />
              </span>
            </span>
            <span className="min-w-0">
              <span className="font-label block text-[10.5px] text-accent">{t("common.celebrate.finishedEyebrow")}</span>
              <span className="mt-0.5 block text-lg leading-snug font-bold text-balance">
                {celebration.winner ? t("common.celebrate.winner", { name: celebration.winner }) : t("common.celebrate.finished")}
              </span>
            </span>
          </>
        )}
      </button>
    </div>
  );
}
