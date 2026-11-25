"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useFormat, useT } from "@/components/providers";
import { formatShortDate, formatWeekdayDate } from "@/lib/format";

interface RoundsChartProps {
  /** One entry per day, oldest first; `day` is `YYYY-MM-DD` in the club's zone. */
  data: ReadonlyArray<{ day: string; rounds: number }>;
}

const HEIGHT = 220;
const MARGIN = { top: 22, right: 6, bottom: 26, left: 30 };
const MAX_BAR = 24;
const BAR_GAP = 2;
const RADIUS = 4;
const FALLBACK_WIDTH = 720;

/** A clean axis maximum and step, so the ticks are round numbers. */
function axisFor(max: number): { top: number; step: number } {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
  const step = steps.find((candidate) => max / candidate <= 4) ?? Math.ceil(max / 4);
  return { top: Math.max(step, Math.ceil(max / step) * step), step };
}

/** A column with a rounded cap and a square foot on the baseline. */
function columnPath(x: number, y: number, width: number, height: number): string {
  const radius = Math.min(RADIUS, width / 2, height);
  return [
    `M${x},${y + height}`,
    `V${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `H${x + width - radius}`,
    `Q${x + width},${y} ${x + width},${y + radius}`,
    `V${y + height}`,
    "Z",
  ].join(" ");
}

/** Noon UTC of a calendar day: formats to that same day in any club time zone. */
function dayToDate(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

/**
 * Finished rounds per day as a column chart: one series, one colour. Every
 * column answers to hover and to the arrow keys, and the same numbers are
 * available as a table.
 */
export function RoundsChart({ data }: RoundsChartProps) {
  const t = useT();
  const { locale } = useFormat();
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => {
    const max = data.reduce((highest, point) => Math.max(highest, point.rounds), 0);
    const { top, step } = axisFor(Math.max(max, 1));
    const plotWidth = width - MARGIN.left - MARGIN.right;
    const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
    const slot = plotWidth / Math.max(data.length, 1);
    const bar = Math.max(2, Math.min(MAX_BAR, slot - BAR_GAP));
    const peak = max > 0 ? data.findIndex((point) => point.rounds === max) : -1;
    const ticks: number[] = [];
    for (let value = 0; value <= top; value += step) ticks.push(value);
    return {
      max,
      plotWidth,
      plotHeight,
      slot,
      bar,
      peak,
      ticks,
      y: (value: number) => MARGIN.top + plotHeight - (value / top) * plotHeight,
      x: (index: number) => MARGIN.left + index * slot + (slot - bar) / 2,
    };
  }, [data, width]);

  // A date label roughly every week (fewer when narrow), plus the last day
  // when it would not crowd its neighbour.
  const labelled = useMemo(() => {
    const every = width < 480 ? 10 : 7;
    const indexes = new Set<number>();
    for (let index = 0; index < data.length; index += every) indexes.add(index);
    const last = data.length - 1;
    if (last - Math.floor(last / every) * every >= every / 2) indexes.add(last);
    return indexes;
  }, [data.length, width]);
  const total = data.reduce((sum, point) => sum + point.rounds, 0);

  if (geometry.max === 0) {
    return <p className="rounded-control bg-well px-4 py-8 text-center text-sm text-ink-3">{t("admin.dashboard.chart.empty")}</p>;
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End" && event.key !== "Escape") return;
    event.preventDefault();
    if (event.key === "Escape") return setActive(null);
    if (event.key === "Home") return setActive(0);
    if (event.key === "End") return setActive(data.length - 1);
    const delta = event.key === "ArrowRight" ? 1 : -1;
    setActive((current) => Math.min(data.length - 1, Math.max(0, (current ?? (delta > 0 ? -1 : data.length)) + delta)));
  }

  const activePoint = active === null ? null : data[active];
  const tooltipLeft = active === null ? 0 : Math.min(width - 84, Math.max(84, geometry.x(active) + geometry.bar / 2));

  return (
    <div>
      <div
        ref={frame}
        role="group"
        tabIndex={0}
        aria-label={`${t("admin.dashboard.chart.summary")} ${t("admin.dashboard.chart.total", { count: total })}`}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((current) => current ?? Math.max(geometry.peak, 0))}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
        className="relative rounded-control"
      >
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} className="block max-w-full" aria-hidden="true">
          {geometry.ticks.map((value) => (
            <g key={value}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={geometry.y(value)}
                y2={geometry.y(value)}
                stroke={value === 0 ? "var(--line-strong)" : "var(--line)"}
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text x={MARGIN.left - 8} y={geometry.y(value)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--ink-3)" style={{ fontVariantNumeric: "tabular-nums" }}>
                {value}
              </text>
            </g>
          ))}

          {data.map((point, index) => {
            const height = geometry.plotHeight - (geometry.y(point.rounds) - MARGIN.top);
            const dimmed = active !== null && active !== index;
            return (
              <g key={point.day}>
                {point.rounds > 0 ? (
                  <path
                    d={columnPath(geometry.x(index), geometry.y(point.rounds), geometry.bar, height)}
                    fill="var(--brand-fg)"
                    opacity={dimmed ? 0.45 : 1}
                    className="animate-grow-y"
                    // The columns grow out of the baseline, left to right.
                    style={{ transition: "opacity 120ms", transformBox: "fill-box", transformOrigin: "bottom", animationDelay: `${index * 18}ms` }}
                  />
                ) : null}
                {/* The whole slot is the hit target, not just the painted column. */}
                <rect
                  x={MARGIN.left + index * geometry.slot}
                  y={MARGIN.top}
                  width={geometry.slot}
                  height={geometry.plotHeight}
                  fill="transparent"
                  onPointerEnter={() => setActive(index)}
                  onPointerDown={() => setActive(index)}
                />
                {labelled.has(index) ? (
                  <text
                    x={geometry.x(index) + geometry.bar / 2}
                    y={HEIGHT - 8}
                    textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}
                    fontSize={11}
                    fill="var(--ink-3)"
                  >
                    {formatShortDate(dayToDate(point.day), locale, "UTC")}
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* One direct label: the busiest day. The rest is on the axis and in the tooltip. */}
          {geometry.peak >= 0 && active === null ? (
            <text
              x={geometry.x(geometry.peak) + geometry.bar / 2}
              y={geometry.y(data[geometry.peak].rounds) - 6}
              textAnchor="middle"
              fontSize={12}
              fontWeight={700}
              fill="var(--ink)"
            >
              {data[geometry.peak].rounds}
            </text>
          ) : null}
        </svg>

        {activePoint ? (
          <div
            role="status"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-3 py-2 text-center shadow-pop"
            style={{ left: tooltipLeft, top: Math.max(geometry.y(activePoint.rounds) - 8, 44) }}
          >
            <p className="text-sm font-bold whitespace-nowrap">{t("common.rounds", { count: activePoint.rounds })}</p>
            <p className="text-xs whitespace-nowrap text-ink-3">{formatWeekdayDate(dayToDate(activePoint.day), locale, "UTC")}</p>
          </div>
        ) : null}
      </div>

      <details className="mt-3 text-sm">
        <summary className="inline-flex cursor-pointer rounded-control px-1 font-semibold text-ink-2 hover:text-ink">
          {t("admin.dashboard.chart.table")}
        </summary>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-control border border-line">
          <table className="w-full tabular text-left text-[13px]">
            <thead className="sticky top-0 bg-well">
              <tr className="font-label text-[10.5px] text-ink-3">
                <th scope="col" className="px-3 py-2 font-[inherit]">
                  {t("admin.dashboard.chart.day")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-[inherit]">
                  {t("admin.dashboard.chart.rounds")}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((point) => (
                <tr key={point.day} className="border-t border-line">
                  <td className="px-3 py-1.5">{formatWeekdayDate(dayToDate(point.day), locale, "UTC")}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{point.rounds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
