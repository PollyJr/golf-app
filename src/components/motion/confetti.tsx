import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/** A pseudo-random number in [0, 1) that is the same on the server and in the browser. */
function noise(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

const PALETTES = {
  club: ["var(--accent)", "var(--under)", "var(--gold)", "#ffffff", "var(--brand-ink)"],
  gold: ["var(--gold)", "#f6d77a", "#ffffff", "var(--accent)", "#e7b23c"],
} as const;

interface ConfettiProps {
  /** Number of pieces. */
  pieces?: number;
  /** How far they fly, as a multiple of a phone-sized burst. */
  spread?: number;
  palette?: keyof typeof PALETTES;
  /** Changing it starts a new burst. */
  seed?: number;
  className?: string;
}

/**
 * A burst of confetti from the centre of its (positioned) parent. CSS only:
 * every piece gets its own direction, spin, size and delay, and is gone when
 * the animation ends. With reduced motion the pieces never show.
 */
export function Confetti({ pieces = 30, spread = 1, palette = "club", seed = 1, className }: ConfettiProps) {
  const colors = PALETTES[palette];
  return (
    <span aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-visible", className)}>
      {Array.from({ length: pieces }, (_, index) => {
        const base = seed * 101 + index;
        const angle = (index / pieces) * Math.PI * 2 + noise(base) * 0.6;
        const distance = (80 + noise(base + 7) * 150) * spread;
        const shape = index % 3;
        const size = 6 + Math.round(noise(base + 3) * 5);
        const style = {
          "--dx": `${Math.cos(angle) * distance}px`,
          // A little upward bias, so the burst reads as thrown rather than dropped.
          "--dy": `${Math.sin(angle) * distance * 0.8 - 30 * spread}px`,
          "--spin": `${(noise(base + 11) > 0.5 ? 1 : -1) * (360 + Math.round(noise(base + 5) * 540))}deg`,
          width: shape === 2 ? size * 0.55 : size,
          height: shape === 2 ? size * 1.7 : size,
          backgroundColor: colors[index % colors.length],
          animationDelay: `${Math.round(noise(base + 13) * 140)}ms`,
          animationDuration: `${1200 + Math.round(noise(base + 17) * 700)}ms`,
        } as CSSProperties;
        return (
          <span
            key={`${seed}-${index}`}
            className={cn("animate-confetti absolute top-1/2 left-1/2 -mt-1 -ml-1 opacity-0", shape === 0 ? "rounded-full" : "rounded-[2px]")}
            style={style}
          />
        );
      })}
    </span>
  );
}
