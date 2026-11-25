"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import type { HoleInfo, Strokes } from "@/lib/golf/scoring";

interface HoleStripProps {
  holes: readonly HoleInfo[];
  scoresByPlayer: readonly (readonly Strokes[])[];
  active: number;
  onSelect: (index: number) => void;
  label: string;
}

/** The row of hole numbers above the card; filled when everyone has scored. */
export function HoleStrip({ holes, scoresByPlayer, active, onSelect, label }: HoleStripProps) {
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active]);

  return (
    <div role="tablist" aria-label={label} className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 py-1">
      {holes.map((hole, index) => {
        const scored = scoresByPlayer.filter((scores) => (scores[index] ?? null) !== null).length;
        const done = scoresByPlayer.length > 0 && scored === scoresByPlayer.length;
        const current = index === active;
        return (
          <button
            key={hole.number}
            ref={current ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={current}
            onClick={() => onSelect(index)}
            className={cn(
              "font-score grid size-10 shrink-0 place-items-center rounded-full border text-base transition",
              current
                ? "border-transparent bg-brand text-brand-ink shadow-md"
                : done
                  ? "border-transparent bg-under-soft text-under"
                  : scored > 0
                    ? "border-under/50 bg-surface text-ink"
                    : "border-line bg-surface text-ink-3",
            )}
          >
            {hole.number}
          </button>
        );
      })}
    </div>
  );
}
