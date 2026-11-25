import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { formatToPar, scoreKind, type ScoreKind } from "@/lib/golf/scoring";

/**
 * A hole score in classic scorecard notation: circles for holes under par,
 * squares for holes over par, doubled when it is two or more. Shape carries
 * the meaning, colour only reinforces it.
 */

type MarkSize = "sm" | "md" | "lg";

// The double ring is drawn with two shadows: a gap in the surface colour and
// the ring itself. Small marks get a tighter ring so neighbours never touch.
const SIZES: Record<MarkSize, string> = {
  sm: "size-[1.4rem] text-[12.5px] [--ring-gap:1.5px] [--ring:2.75px]",
  md: "size-9 text-base [--ring-gap:2px] [--ring:3.5px]",
  lg: "size-14 text-3xl [--ring-gap:3px] [--ring:5px]",
};

const SHAPES: Record<ScoreKind, string> = {
  ace: "rounded-full bg-gold text-surface shadow-[0_0_0_var(--ring-gap)_var(--surface),0_0_0_var(--ring)_var(--gold)]",
  albatross: "rounded-full border-[1.5px] border-under text-under shadow-[0_0_0_var(--ring-gap)_var(--surface),0_0_0_var(--ring)_var(--under)]",
  eagle: "rounded-full border-[1.5px] border-under text-under shadow-[0_0_0_var(--ring-gap)_var(--surface),0_0_0_var(--ring)_var(--under)]",
  birdie: "rounded-full border-[1.5px] border-under text-under",
  par: "text-ink",
  bogey: "rounded-[5px] border-[1.5px] border-over text-over",
  double: "rounded-[5px] border-[1.5px] border-over text-over shadow-[0_0_0_var(--ring-gap)_var(--surface),0_0_0_var(--ring)_var(--over)]",
  worse: "rounded-[5px] bg-over text-surface shadow-[0_0_0_var(--ring-gap)_var(--surface),0_0_0_var(--ring)_var(--over)]",
};

interface ScoreMarkProps {
  strokes: number | null;
  par: number;
  size?: MarkSize;
  /** Text for assistive technology, e.g. "Birdie". */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export function ScoreMark({ strokes, par, size = "md", label, className, style }: ScoreMarkProps) {
  if (strokes === null) {
    return (
      <span className={cn("font-score inline-grid place-items-center text-ink-3/60", SIZES[size], className)} style={style} aria-label={label}>
        ·
      </span>
    );
  }
  return (
    <span
      className={cn("font-score inline-grid place-items-center", SIZES[size], SHAPES[scoreKind(strokes, par)], className)}
      style={style}
      title={label}
    >
      {strokes}
      {label ? <span className="sr-only"> ({label})</span> : null}
    </span>
  );
}

interface ToParProps {
  value: number;
  /** Shows a dash instead of `E` when nothing has been played yet. */
  empty?: boolean;
  className?: string;
}

/** Score relative to par, coloured: under par green, over par clay. */
export function ToPar({ value, empty, className }: ToParProps) {
  if (empty) return <span className={cn("font-score text-ink-3", className)}>–</span>;
  return (
    <span className={cn("font-score", value < 0 && "text-under", value > 0 && "text-over", className)}>
      {formatToPar(value)}
    </span>
  );
}
