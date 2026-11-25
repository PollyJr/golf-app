"use client";

import { useState } from "react";
import { useFormat, useT } from "@/components/providers";
import { useElementWidth } from "@/hooks/use-element-width";
import { formatNumber, formatSigned } from "@/lib/format";
import type { HoleAverage } from "@/lib/golf/stats";

const HEIGHT = 190;
const MARGIN = { top: 22, right: 8, bottom: 26, left: 34 };
const MAX_BAR = 24;
const RADIUS = 4;

/** A column with a rounded data end and a square end on the baseline. */
function columnPath(left: number, width: number, baseline: number, tip: number): string {
  const up = tip < baseline;
  const radius = Math.min(RADIUS, Math.abs(baseline - tip), width / 2);
  const inner = up ? tip + radius : tip - radius;
  const sweep = up ? 1 : 0;
  return [
    `M${left},${baseline}`,
    `L${left},${inner}`,
    `A${radius},${radius} 0 0 ${sweep} ${left + radius},${tip}`,
    `L${left + width - radius},${tip}`,
    `A${radius},${radius} 0 0 ${sweep} ${left + width},${inner}`,
    `L${left + width},${baseline}`,
    "Z",
  ].join(" ");
}

interface HoleBarsProps {
  holes: HoleAverage[];
  label: string;
}

/**
 * Average score per hole relative to par: columns grow up from the par line
 * when a hole costs strokes and down when it gains them. Direction carries the
 * meaning; colour repeats it.
 */
export function HoleBars({ holes, label }: HoleBarsProps) {
  const t = useT();
  const { locale } = useFormat();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const extent = Math.max(0.5, ...holes.map((hole) => Math.abs(hole.toPar)));
  const yMax = Math.ceil(extent * 2) / 2;
  const hasUnder = holes.some((hole) => hole.toPar < 0);
  const yMin = hasUnder ? -yMax : 0;

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const band = holes.length > 0 ? plotWidth / holes.length : 0;
  const barWidth = Math.min(MAX_BAR, Math.max(4, band - 6));
  const y = (value: number) => MARGIN.top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;
  const baseline = y(0);

  // Label only the extremes; the table below carries every value.
  const hardest = holes.reduce<HoleAverage | null>((worst, hole) => (worst === null || hole.toPar > worst.toPar ? hole : worst), null);
  const easiest = holes.reduce<HoleAverage | null>((best, hole) => (best === null || hole.toPar < best.toPar ? hole : best), null);
  const focus = active !== null ? holes[active] : null;
  const focusCenter = active !== null ? MARGIN.left + band * active + band / 2 : 0;
  const flip = focusCenter > width * 0.6;

  return (
    <div ref={ref} className="relative" style={{ height: HEIGHT }} role="img" aria-label={label}>
      {width > 0 ? (
        <svg width={width} height={HEIGHT} className="block" onPointerLeave={() => setActive(null)}>
          {[yMax, 0, ...(hasUnder ? [yMin] : [])].map((tick) => (
            <g key={tick}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "var(--line-strong)" : "var(--line)"} strokeWidth={1} />
              <text x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--ink-3)" style={{ fontVariantNumeric: "tabular-nums" }}>
                {tick === 0 ? t("common.par") : formatSigned(tick, locale)}
              </text>
            </g>
          ))}

          {holes.map((hole, index) => {
            const center = MARGIN.left + band * index + band / 2;
            const tip = y(hole.toPar);
            const flat = Math.abs(tip - baseline) < 1;
            const labelled = hole === hardest || (hole === easiest && hole.toPar < 0);
            return (
              <g key={hole.hole}>
                {flat ? (
                  <rect x={center - barWidth / 2} y={baseline - 1} width={barWidth} height={2} fill="var(--chart-neutral)" />
                ) : (
                  <path
                    d={columnPath(center - barWidth / 2, barWidth, baseline, tip)}
                    fill={hole.toPar > 0 ? "var(--chart-over-1)" : "var(--chart-under)"}
                    opacity={active === null || active === index ? 1 : 0.55}
                  />
                )}
                {labelled ? (
                  <text x={center} y={hole.toPar >= 0 ? tip - 6 : tip + 14} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--ink)">
                    {formatSigned(hole.toPar, locale)}
                  </text>
                ) : null}
                <text x={center} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={active === index ? "var(--ink)" : "var(--ink-3)"} fontWeight={active === index ? 700 : 400}>
                  {hole.hole}
                </text>
                {/* The whole band is the hit target, not just the painted bar. */}
                <rect
                  x={MARGIN.left + band * index}
                  y={MARGIN.top}
                  width={band}
                  height={HEIGHT - MARGIN.top}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${t("common.hole")} ${hole.hole}: ${formatNumber(hole.average, locale, 1)} (${formatSigned(hole.toPar, locale)})`}
                  onPointerEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  className="outline-none"
                />
              </g>
            );
          })}
        </svg>
      ) : null}

      {focus ? (
        <div
          className="pointer-events-none absolute top-0 z-10 w-max rounded-xl border border-line bg-surface px-3 py-2 shadow-pop"
          style={flip ? { right: width - focusCenter + 16 } : { left: focusCenter + 16 }}
        >
          <p className="text-base font-bold">
            {formatNumber(focus.average, locale, 1)} <span className="text-sm font-semibold text-ink-2">({formatSigned(focus.toPar, locale)})</span>
          </p>
          <p className="text-xs text-ink-2">
            {t("common.hole")} {focus.hole} · {t("common.par")} {focus.par}
          </p>
          <p className="text-xs text-ink-3">
            {t("app.stats.holeBest")} {focus.best} · {focus.rounds}×
          </p>
        </div>
      ) : null}
    </div>
  );
}
