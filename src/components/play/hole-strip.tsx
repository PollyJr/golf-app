"use client";

import { useEffect, useRef, type Ref } from "react";
import { prefersReducedMotion, useChangeCount } from "@/hooks/use-motion";
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
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [active]);

  return (
    <div role="tablist" aria-label={label} className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 py-1">
      {holes.map((hole, index) => {
        const scored = scoresByPlayer.filter((scores) => (scores[index] ?? null) !== null).length;
        const done = scoresByPlayer.length > 0 && scored === scoresByPlayer.length;
        const current = index === active;
        return (
          <HoleButton
            key={hole.number}
            ref={current ? activeRef : undefined}
            number={hole.number}
            current={current}
            done={done}
            started={scored > 0}
            onSelect={() => onSelect(index)}
          />
        );
      })}
    </div>
  );
}

interface HoleButtonProps {
  ref?: Ref<HTMLButtonElement>;
  number: number;
  current: boolean;
  done: boolean;
  started: boolean;
  onSelect: () => void;
}

/** One hole; it pops when the last score of the flight on it comes in. */
function HoleButton({ ref, number, current, done, started, onSelect }: HoleButtonProps) {
  const changes = useChangeCount(done);
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={current}
      onClick={onSelect}
      className={cn(
        "font-score grid size-10 shrink-0 place-items-center rounded-full border text-base transition duration-300 active:scale-90",
        current
          ? "scale-105 border-transparent bg-brand text-brand-ink shadow-md"
          : done
            ? "border-transparent bg-under-soft text-under"
            : started
              ? "border-under/50 bg-surface text-ink"
              : "border-line bg-surface text-ink-3",
      )}
    >
      <span key={changes} className={cn(changes > 0 && done && "animate-pop")}>
        {number}
      </span>
    </button>
  );
}
