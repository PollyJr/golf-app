import { CircleAlert, Hourglass, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { ScoreMark } from "@/components/golf/score-mark";
import { ScorecardTable } from "@/components/golf/scorecard-table";
import { CountUp } from "@/components/motion/animated-number";
import { Confetti } from "@/components/motion/confetti";
import { MatchLine, Standings } from "@/components/play/standings";
import { Badge } from "@/components/ui/badge";
import { Card, SectionHeading } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { rankFlight } from "@/lib/golf/formats";
import { distributionOf, formatToPar, toPar, totalStrokes } from "@/lib/golf/scoring";
import type { Locale } from "@/lib/i18n/core";
import type { AppTranslate } from "@/lib/i18n/dictionaries";
import type { RoundSnapshot } from "@/lib/types";

interface RoundResultProps {
  round: RoundSnapshot;
  t: AppTranslate;
  locale: Locale;
  /** Buttons under the card: share, new round, … */
  actions?: ReactNode;
  /** Rendered above the hero, e.g. a back link. */
  top?: ReactNode;
  /** The viewer just handed the round in: confetti over the hero. */
  celebrate?: boolean;
}

/**
 * A finished round: who won, the full card in scorecard notation and a few
 * facts. Used for a player's own results, approved rounds of club mates and
 * the staff review screen.
 */
export function RoundResult({ round, t, locale, actions, top, celebrate = false }: RoundResultProps) {
  const holes = round.course.holes;
  const pars = holes.map((hole) => hole.par);
  const ranked = rankFlight(round.participants, pars, round.format);
  const leaders = ranked.filter((row) => row.rank === 1);
  const solo = round.participants.length === 1;
  const mine = round.participants.find((participant) => participant.id === round.viewer?.participantId) ?? null;
  const focus = mine ?? leaders[0]?.participant ?? round.participants[0];
  const focusStrokes = totalStrokes(focus.scores);
  const focusToPar = toPar(focus.scores, pars);
  const when = round.completedAt ?? round.startedAt ?? round.createdAt;

  const title = solo
    ? t("app.results.roundDone")
    : leaders.length > 1
      ? t("app.results.tied")
      : t("app.results.wins", { name: leaders[0].participant.name.split(/\s+/)[0] });

  const distribution = distributionOf(focus.scores, pars);
  const underPar = distribution.ace + distribution.albatross + distribution.eagle + distribution.birdie;
  const overPar = distribution.bogey + distribution.double + distribution.worse;
  const putts = focus.putts.filter((value): value is number => value !== null);
  const bestHole = focus.scores.reduce<{ hole: number; diff: number } | null>((best, strokes, index) => {
    if (strokes === null) return best;
    const diff = strokes - pars[index];
    return best === null || diff < best.diff ? { hole: index + 1, diff } : best;
  }, null);

  const statusBadge =
    round.status === "approved" ? (
      <Badge tone="under" icon={<ShieldCheck className="size-3" />}>
        {t("common.status.approved")}
      </Badge>
    ) : round.status === "rejected" ? (
      <Badge tone="danger" icon={<CircleAlert className="size-3" />}>
        {t("common.status.rejected")}
      </Badge>
    ) : (
      <Badge tone="gold" icon={<Hourglass className="size-3" />}>
        {t("common.status.pending")}
      </Badge>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm">{top}</div>
        {statusBadge}
      </div>

      <section className="bg-ruled animate-rise relative overflow-hidden rounded-[1.5rem] bg-brand p-6 text-brand-ink sm:p-8">
        {celebrate ? <Confetti pieces={48} spread={2.2} palette={mine && leaders.some((row) => row.participant.id === mine.id) && !solo ? "gold" : "club"} className="top-1/4" /> : null}
        <p className="font-label text-[11px] text-accent">{t("app.results.detailEyebrow")}</p>
        <h1 className={cn("font-display mt-3 text-[clamp(2rem,7vw,3.2rem)] text-balance", celebrate && "animate-stamp")}>{title}</h1>
        <p className="mt-2 text-[15px] opacity-80">
          {round.course.name} · {t("common.holes", { count: round.holeCount })} · {t(`common.format.${round.format}`)} · {formatDate(when, locale, round.timeZone)}
        </p>
        {round.event ? <p className="mt-1 text-sm opacity-80">{t("app.results.forEvent", { event: round.event.title })}</p> : null}
        <div className="mt-6 flex items-end gap-4">
          <p className="font-score text-[5.5rem] leading-[0.8]">
            <CountUp value={focusStrokes} />
          </p>
          <div className="pb-1">
            <p className="font-score text-3xl text-accent">
              <CountUp value={focusToPar} style="toPar" from={0} />
            </p>
            <p className="font-label mt-1 text-[10.5px] opacity-70">
              {focus.name} · {t("common.par")} {round.course.par}
            </p>
          </div>
        </div>
      </section>

      {round.status === "pending" ? (
        <p className="rounded-card border border-gold/40 bg-gold-soft px-4 py-3 text-sm text-gold">{t("app.results.pendingNote")}</p>
      ) : null}
      {round.status === "rejected" ? (
        <p className="rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          {t("app.results.rejectedNote")}
          {round.rejectionReason ? ` ${t("app.results.rejectedReason", { reason: round.rejectionReason })}` : null}
        </p>
      ) : null}

      {!solo ? (
        <section>
          <SectionHeading title={t("app.results.ranking")} />
          <MatchLine round={round} className="mb-3" />
          <Standings round={round} highlightId={mine?.id} size="lg" />
        </section>
      ) : null}

      <section>
        <SectionHeading title={t("app.results.scorecard")} />
        <Card>
          <ScorecardTable
            holes={holes}
            rows={ranked.map((row) => ({
              id: row.participant.id,
              name: row.participant.name,
              scores: row.participant.scores,
              highlight: row.participant.id === mine?.id && !solo,
            }))}
            labels={{ hole: t("common.hole"), par: t("common.par"), out: t("app.results.out"), in: t("app.results.in"), total: t("common.total") }}
          />
          <dl className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-xs text-ink-3">
            <dt className="font-label text-[10px]">{t("app.results.legendTitle")}</dt>
            <dd className="flex items-center gap-2">
              <ScoreMark strokes={1} par={3} size="sm" /> {t("app.results.legendAce")}
            </dd>
            <dd className="flex items-center gap-2">
              <ScoreMark strokes={2} par={3} size="sm" /> {t("app.results.legendUnder")}
            </dd>
            <dd className="flex items-center gap-2">
              <ScoreMark strokes={4} par={3} size="sm" /> {t("app.results.legendOver")}
            </dd>
          </dl>
        </Card>
      </section>

      <section>
        <SectionHeading title={t("app.results.facts")} eyebrow={solo ? undefined : focus.name} />
        <dl className="stagger-children grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label={t("app.results.factBirdies")} value={underPar} tone={underPar > 0 ? "under" : undefined} />
          <Fact label={t("app.results.factPars")} value={distribution.par} />
          <Fact label={t("app.results.factBogeys")} value={overPar} tone={overPar > 0 ? "over" : undefined} />
          {putts.length > 0 ? (
            <Fact label={t("app.results.factPutts")} value={putts.reduce((sum, value) => sum + value, 0)} />
          ) : (
            <Fact label={t("app.results.factBestHole")} value={bestHole ? `${bestHole.hole}` : "–"} hint={bestHole ? formatToPar(bestHole.diff) : undefined} />
          )}
        </dl>
      </section>

      {actions ? <div className="flex flex-wrap gap-2 no-print">{actions}</div> : null}
    </div>
  );
}

function Fact({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "under" | "over" }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <dt className="font-label text-[10.5px] text-ink-3">{label}</dt>
      <dd className={`font-score mt-2 text-[2rem] ${tone === "under" ? "text-under" : tone === "over" ? "text-over" : ""}`}>
        {value}
        {hint ? <span className="ml-2 text-base text-ink-3">{hint}</span> : null}
      </dd>
    </div>
  );
}
