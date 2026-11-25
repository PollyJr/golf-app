import { formatPercent } from "@/lib/format";
import type { ScoreDistribution } from "@/lib/golf/scoring";
import type { Locale } from "@/lib/i18n/core";
import type { AppTranslate } from "@/lib/i18n/dictionaries";

interface DistributionProps {
  distribution: ScoreDistribution;
  t: AppTranslate;
  locale: Locale;
}

/**
 * How a player's holes split relative to par: a thin segmented bar above the
 * list that names every part with its count and share. The list is the table
 * view; the bar only shows the proportions at a glance.
 */
export function Distribution({ distribution, t, locale }: DistributionProps) {
  const better = distribution.ace + distribution.albatross + distribution.eagle + distribution.birdie;
  const parts = [
    { key: "under", label: t("app.results.factBirdies"), count: better, color: "var(--chart-under)" },
    { key: "par", label: t("common.scoreKind.par"), count: distribution.par, color: "var(--chart-neutral)" },
    { key: "bogey", label: t("common.scoreKind.bogey"), count: distribution.bogey, color: "var(--chart-over-1)" },
    { key: "worse", label: `${t("common.scoreKind.double")}+`, count: distribution.double + distribution.worse, color: "var(--chart-over-2)" },
  ];
  const total = parts.reduce((sum, part) => sum + part.count, 0);
  if (total === 0) return null;
  const share = (count: number) => count / total;
  const summary = parts.map((part) => `${part.label}: ${part.count} (${formatPercent(share(part.count), locale)})`).join(", ");

  return (
    <div>
      <div role="img" aria-label={summary} className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        {parts
          .filter((part) => part.count > 0)
          .map((part) => (
            <span key={part.key} title={`${part.label}: ${part.count}`} style={{ flexGrow: part.count, backgroundColor: part.color }} className="h-full min-w-1 basis-0" />
          ))}
      </div>
      <dl className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
        {parts.map((part) => (
          <div key={part.key} className="flex items-center gap-3 text-sm">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: part.color }} aria-hidden="true" />
            <dt className="flex-1 text-ink-2">{part.label}</dt>
            <dd className="tabular font-semibold">{part.count}</dd>
            <dd className="tabular w-11 text-right text-ink-3">{formatPercent(share(part.count), locale)}</dd>
          </div>
        ))}
      </dl>
      {distribution.ace > 0 ? (
        <p className="mt-4 rounded-control bg-gold-soft px-3.5 py-2.5 text-sm font-semibold text-gold">
          {t("common.scoreKind.ace")} × {distribution.ace}
        </p>
      ) : null}
    </div>
  );
}
