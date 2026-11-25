"use client";

import { ToPar } from "@/components/golf/score-mark";
import { useT } from "@/components/providers";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { matchState, rankFlight } from "@/lib/golf/formats";
import type { RoundSnapshot } from "@/lib/types";

interface StandingsProps {
  round: RoundSnapshot;
  /** The viewer's own participant row, highlighted. */
  highlightId?: string | null;
  size?: "sm" | "lg";
  className?: string;
}

/** The flight ranked for the round's format; shared by play, results and the public view. */
export function Standings({ round, highlightId, size = "sm", className }: StandingsProps) {
  const t = useT();
  const pars = round.course.holes.map((hole) => hole.par);
  const ranked = rankFlight(round.participants, pars, round.format);
  const large = size === "lg";

  return (
    <ol className={cn("flex flex-col", large ? "gap-2" : "gap-1", className)}>
      {ranked.map((row) => {
        const person = row.participant;
        const mine = person.id === highlightId;
        return (
          <li
            key={person.id}
            className={cn(
              "flex items-center gap-3 rounded-xl",
              large ? "border border-line bg-surface px-4 py-3 shadow-card" : "px-2 py-1.5",
              mine && (large ? "border-brand-fg/40 bg-brand-soft" : "bg-brand-soft"),
            )}
          >
            <span className={cn("font-score w-6 shrink-0 text-center", large ? "text-2xl" : "text-base", row.rank === 1 && row.thru > 0 ? "text-gold" : "text-ink-3")}>
              {row.thru === 0 ? "–" : row.rank}
            </span>
            <Avatar name={person.name} initials={person.initials} guest={person.guest} size={large ? "md" : "sm"} />
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate font-semibold", large ? "text-base" : "text-sm")}>
                {person.name}
                {person.guest ? <span className="ml-1.5 text-xs font-normal text-ink-3">{t("common.guest")}</span> : null}
              </span>
              <span className="block text-xs text-ink-3">
                {row.thru === 0 ? t("play.card.noScore") : row.thru === pars.length ? t("common.strokes", { count: row.strokes }) : t("common.thru", { count: row.thru })}
              </span>
            </span>
            {round.format === "stableford" ? (
              <span className="text-right">
                <span className={cn("font-score block", large ? "text-3xl" : "text-xl")}>{row.points}</span>
                <span className="font-label block text-[9.5px] text-ink-3">{t("play.card.pointsShort")}</span>
              </span>
            ) : (
              <span className="text-right">
                <span className={cn("font-score block", large ? "text-3xl" : "text-xl")}>{row.thru === 0 ? "–" : row.strokes}</span>
                <ToPar value={row.toPar} empty={row.thru === 0} className={large ? "text-sm" : "text-xs"} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
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
    <p className={cn("font-label rounded-full bg-brand px-4 py-2 text-center text-[11.5px] text-brand-ink", className)}>{text}</p>
  );
}
