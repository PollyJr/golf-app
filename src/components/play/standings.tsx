"use client";

import { ChevronDown, ChevronUp, Crown } from "lucide-react";
import { useState } from "react";
import { ToPar } from "@/components/golf/score-mark";
import { TickNumber } from "@/components/motion/animated-number";
import { useT } from "@/components/providers";
import { Avatar } from "@/components/ui/avatar";
import { useFlip } from "@/hooks/use-motion";
import { cn } from "@/lib/cn";
import { matchState, rankFlight, type Ranked } from "@/lib/golf/formats";
import type { RoundParticipantDto, RoundSnapshot } from "@/lib/types";

interface StandingsProps {
  round: RoundSnapshot;
  /** The viewer's own participant row, highlighted. */
  highlightId?: string | null;
  size?: "sm" | "lg";
  /**
   * The round is being followed live: rows glide to their new place when the
   * order changes, numbers roll, and a moved row shows how many places it went.
   */
  animate?: boolean;
  className?: string;
}

type Row = Ranked<RoundParticipantDto>;

/** Places gained (+) or lost (−) at the last change of the ranking, per participant. */
function useMovement(ranked: readonly Row[], enabled: boolean): { moves: Record<string, number>; change: number } {
  const key = ranked.map((row) => `${row.participant.id}:${row.rank}`).join(",");
  const [memory, setMemory] = useState(() => ({
    key,
    ranks: Object.fromEntries(ranked.map((row) => [row.participant.id, row.rank])) as Record<string, number>,
    moves: {} as Record<string, number>,
    change: 0,
  }));
  if (enabled && memory.key !== key) {
    const moves: Record<string, number> = {};
    for (const row of ranked) {
      const before = memory.ranks[row.participant.id];
      // Only real movement counts: a player's first score is not "climbing".
      if (before !== undefined && row.thru > 0 && before !== row.rank) moves[row.participant.id] = before - row.rank;
    }
    const next = {
      key,
      ranks: Object.fromEntries(ranked.map((row) => [row.participant.id, row.rank])),
      moves,
      change: memory.change + 1,
    };
    setMemory(next);
    return next;
  }
  return memory;
}

/** The flight ranked for the round's format; shared by play, results and the public view. */
export function Standings({ round, highlightId, size = "sm", animate = false, className }: StandingsProps) {
  const t = useT();
  const pars = round.course.holes.map((hole) => hole.par);
  const ranked = rankFlight(round.participants, pars, round.format);
  const large = size === "lg";
  const flip = useFlip({ enter: "pop" });
  const { moves, change } = useMovement(ranked, animate);
  const leader = ranked[0] && ranked[0].thru > 0 && !ranked[0].tied ? ranked[0].participant.id : null;

  return (
    <ol className={cn("flex flex-col", large ? "gap-2" : "gap-1", className)}>
      {ranked.map((row) => {
        const person = row.participant;
        const mine = person.id === highlightId;
        const moved = moves[person.id] ?? 0;
        const empty = row.thru === 0;
        return (
          <li
            key={person.id}
            ref={animate ? flip(person.id, `${row.strokes}|${row.thru}|${row.points}`) : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-xl",
              large ? "border border-line bg-surface px-4 py-3 shadow-card" : "px-2 py-1.5",
              mine && (large ? "border-brand-fg/40 bg-brand-soft" : "bg-brand-soft"),
            )}
          >
            <span className={cn("font-score relative w-6 shrink-0 text-center", large ? "text-2xl" : "text-base", row.rank === 1 && !empty ? "text-gold" : "text-ink-3")}>
              {person.id === leader ? (
                <Crown
                  key={leader}
                  aria-label={t("play.card.leading")}
                  className={cn("absolute left-1/2 -translate-x-1/2 text-gold", large ? "-top-3.5 size-3.5" : "-top-3 size-3", animate && "animate-pop")}
                />
              ) : null}
              {empty ? "–" : <TickNumber value={row.rank} />}
            </span>
            <Avatar name={person.name} initials={person.initials} guest={person.guest} size={large ? "md" : "sm"} />
            <span className="min-w-0 flex-1">
              <span className={cn("flex items-center gap-1.5 truncate font-semibold", large ? "text-base" : "text-sm")}>
                <span className="truncate">{person.name}</span>
                {person.guest ? <span className="text-xs font-normal text-ink-3">{t("common.guest")}</span> : null}
                {animate && moved !== 0 ? <Movement key={change} places={moved} /> : null}
              </span>
              <span className="block text-xs text-ink-3">
                {empty ? t("play.card.noScore") : row.thru === pars.length ? t("common.strokes", { count: row.strokes }) : t("common.thru", { count: row.thru })}
              </span>
            </span>
            {round.format === "stableford" ? (
              <span className="text-right">
                <span className={cn("font-score block", large ? "text-3xl" : "text-xl")}>
                  {animate ? <TickNumber value={row.points} /> : row.points}
                </span>
                <span className="font-label block text-[9.5px] text-ink-3">{t("play.card.pointsShort")}</span>
              </span>
            ) : (
              <span className="text-right">
                <span className={cn("font-score block", large ? "text-3xl" : "text-xl")}>
                  {empty ? "–" : animate ? <TickNumber value={row.strokes} /> : row.strokes}
                </span>
                {animate && !empty ? (
                  <TickNumber
                    value={row.toPar}
                    style="toPar"
                    className={cn("font-score", large ? "text-sm" : "text-xs", row.toPar < 0 && "text-under", row.toPar > 0 && "text-over")}
                  />
                ) : (
                  <ToPar value={row.toPar} empty={empty} className={large ? "text-sm" : "text-xs"} />
                )}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** "▲2": shown after a re-sort, then fades away on its own. */
function Movement({ places }: { places: number }) {
  const t = useT();
  const up = places > 0;
  const count = Math.abs(places);
  return (
    <span
      className={cn("font-score inline-flex shrink-0 items-center text-xs", up ? "text-under" : "text-over")}
      style={{ animation: "scale-in var(--dur-slow) var(--ease-spring) both, vt-fade-out 0.6s var(--ease-in) 4.5s forwards" }}
    >
      {up ? <ChevronUp className="size-3.5" aria-hidden="true" /> : <ChevronDown className="size-3.5" aria-hidden="true" />}
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">{up ? t("play.card.movedUp", { count }) : t("play.card.movedDown", { count })}</span>
    </span>
  );
}

/** One sentence for the state of a match, e.g. "Sanne staat 2 UP". */
export function MatchLine({ round, className }: { round: RoundSnapshot; className?: string }) {
  const t = useT();
  if (round.format !== "match" || round.participants.length !== 2) return null;
  const [a, b] = round.participants;
  const state = matchState(a.scores, b.scores, round.holeCount);
  const leader = state.lead > 0 ? a : b;
  const firstName = leader.name.split(/\s+/)[0];
  let text: string;
  if (state.decided) {
    text = state.winner === "halved" ? t("play.card.matchHalved") : t("play.card.matchWins", { name: firstName, margin: state.label });
  } else {
    text = state.lead === 0 ? t("play.card.allSquare") : t("play.card.matchLeads", { name: firstName, margin: state.label });
  }
  return (
    <p key={text} className={cn("font-label animate-fade-in rounded-full bg-brand px-4 py-2 text-center text-[11.5px] text-brand-ink", className)}>
      {text}
    </p>
  );
}
