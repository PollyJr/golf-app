"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { useFormat, useT } from "@/components/providers";
import { useElementWidth } from "@/hooks/use-element-width";
import { formatShortDate, formatSigned } from "@/lib/format";
import { formatToPar } from "@/lib/golf/scoring";
import type { TrendPoint } from "@/lib/golf/stats";

const HEIGHT = 220;
const MARGIN = { top: 14, right: 46, bottom: 28, left: 34 };
const MAX_MARKERS = 12;

/** Round axis steps: 1, 2, 5, 10 … */
function niceStep(range: number, target: number): number {
  const rough = range / target;
  const power = 10 ** Math.floor(Math.log10(rough));
  const unit = rough / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

interface TrendChartProps {
  points: TrendPoint[];
  /** Accessible summary of what the chart shows. */
  label: string;
}

/**
 * A player's score per nine holes over their recent rounds: one line, the par
 * baseline, a crosshair with a tooltip, and the latest value labelled. The
 * same numbers are in the table the page renders below it.
 */
export function TrendChart({ points, label }: TrendChartProps) {
  const t = useT();
  const { locale, timeZone } = useFormat();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const values = points.map((point) => point.per9);
  const low = Math.min(0, ...values);
  const high = Math.max(1, ...values);
  const step = Math.max(1, niceStep(high - low, 4));
  const yMin = Math.floor(low / step) * step;
  const yMax = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let value = yMin; value <= yMax + 1e-9; value += step) ticks.push(Math.round(value * 100) / 100);

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (index: number) => MARGIN.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => MARGIN.top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;

  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.per9).toFixed(1)}`).join(" ");
  const area = points.length > 1 ? `${line} L${x(points.length - 1).toFixed(1)},${y(yMin)} L${x(0).toFixed(1)},${y(yMin)} Z` : "";
  const last = points[points.length - 1];
  const showAllMarkers = points.length <= MAX_MARKERS;
  const focus = active !== null ? points[active] : null;

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (points.length === 0 || plotWidth === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left - MARGIN.left) / plotWidth;
    setActive(Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1)))));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setActive((current) => {
      const start = current ?? points.length - 1;
      return Math.min(points.length - 1, Math.max(0, start + (event.key === "ArrowRight" ? 1 : -1)));
    });
  }

  // Keep the tooltip inside the card: flip it to the left of the crosshair near the right edge.
  const tooltipLeft = focus && active !== null ? x(active) : 0;
  const flip = tooltipLeft > width * 0.6;

  return (
    <div
      ref={ref}
      className="relative outline-none focus-visible:ring-2 focus-visible:ring-brand-fg/40"
      style={{ height: HEIGHT }}
      tabIndex={0}
      role="img"
      aria-label={label}
      onKeyDown={onKeyDown}
      onFocus={() => setActive((current) => current ?? points.length - 1)}
      onBlur={() => setActive(null)}
    >
      {width > 0 ? (
        <svg width={width} height={HEIGHT} onPointerMove={onPointerMove} onPointerLeave={() => setActive(null)} className="block touch-pan-y">
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "var(--line-strong)" : "var(--line)"} strokeWidth={1} />
              <text x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--ink-3)" style={{ fontVariantNumeric: "tabular-nums" }}>
                {tick === 0 ? t("common.par") : formatToPar(tick)}
              </text>
            </g>
          ))}

          {area ? <path d={area} fill="var(--chart-line)" opacity={0.1} /> : null}
          <path d={line} fill="none" stroke="var(--chart-line)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {points.map((point, index) =>
            showAllMarkers || index === points.length - 1 ? (
              <circle key={point.roundId} cx={x(index)} cy={y(point.per9)} r={4} fill="var(--chart-line)" stroke="var(--surface)" strokeWidth={2} />
            ) : null,
          )}

          {focus && active !== null ? (
            <g pointerEvents="none">
              <line x1={x(active)} x2={x(active)} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} stroke="var(--ink-3)" strokeWidth={1} />
              <circle cx={x(active)} cy={y(focus.per9)} r={5.5} fill="var(--chart-line)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          ) : null}

          {/* The latest value, labelled at the end of the line. */}
          <text x={x(points.length - 1) + 10} y={y(last.per9)} dy="0.32em" fontSize={13} fontWeight={700} fill="var(--ink)">
            {formatSigned(last.per9, locale)}
          </text>

          <text x={x(0)} y={HEIGHT - 8} textAnchor="start" fontSize={11} fill="var(--ink-3)">
            {formatShortDate(points[0].completedAt, locale, timeZone)}
          </text>
          {points.length > 1 ? (
            <text x={x(points.length - 1)} y={HEIGHT - 8} textAnchor="end" fontSize={11} fill="var(--ink-3)">
              {formatShortDate(last.completedAt, locale, timeZone)}
            </text>
          ) : null}
        </svg>
      ) : null}

      {focus && active !== null ? (
        <div
          className="pointer-events-none absolute top-1 z-10 w-max max-w-[14rem] rounded-xl border border-line bg-surface px-3 py-2 shadow-pop"
          style={flip ? { right: width - tooltipLeft + 12 } : { left: tooltipLeft + 12 }}
        >
          <p className="flex items-center gap-2 text-base font-bold">
            <span className="h-0.5 w-3 rounded-full bg-[var(--chart-line)]" aria-hidden="true" />
            {formatSigned(focus.per9, locale)}
          </p>
          <p className="mt-0.5 text-xs text-ink-2">
            {t("common.strokes", { count: focus.strokes })} ({formatToPar(focus.toPar)}) · {t("common.holes", { count: focus.holeCount })}
          </p>
          <p className="text-xs text-ink-3">
            {formatShortDate(focus.completedAt, locale, timeZone)} · {focus.courseName}
          </p>
        </div>
      ) : null}
    </div>
  );
}
