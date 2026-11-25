"use client";

import { useCallback } from "react";
import { useFormat } from "@/components/providers";
import { useChangeCount, useCountUp, useDirection } from "@/hooks/use-motion";
import { cn } from "@/lib/cn";
import { formatClubIndex } from "@/lib/golf/club-index";
import { formatToPar } from "@/lib/golf/scoring";
import { formatNumber, formatSigned } from "@/lib/format";
import type { Locale } from "@/lib/i18n/core";

/** How a number is written; a name rather than a function, so server pages can pass it. */
export type NumberStyle = "int" | "toPar" | "signed1" | "decimal1" | "index" | "percent";

export function formatStyled(value: number, style: NumberStyle, locale: Locale): string {
  switch (style) {
    case "toPar":
      return formatToPar(Math.round(value));
    case "signed1":
      return formatSigned(value, locale, 1);
    case "decimal1":
      return formatNumber(value, locale, 1);
    case "index":
      return formatClubIndex(value, locale);
    case "percent":
      // A share between 0 and 1, written as a whole percentage.
      return `${formatNumber(Math.round(value * 100), locale)}%`;
    default:
      return formatNumber(Math.round(value), locale);
  }
}

interface CountUpProps {
  value: number;
  style?: NumberStyle;
  /** Where the count starts when the number first appears. */
  from?: number;
  duration?: number;
  className?: string;
}

/**
 * A number that counts to its value: from `from` when it appears on a page
 * opened in the app, and from the old value whenever it changes. On the very
 * first page load it simply shows the value the server rendered.
 */
export function CountUp({ value, style = "int", from = 0, duration, className }: CountUpProps) {
  const { locale } = useFormat();
  const format = useCallback((current: number) => formatStyled(current, style, locale), [style, locale]);
  const ref = useCountUp<HTMLSpanElement>(value, format, { from, duration });
  return (
    <span ref={ref} className={cn("tabular", className)}>
      {format(value)}
    </span>
  );
}

interface TickProps {
  value: number;
  style?: NumberStyle;
  /** Shown instead of the number, e.g. "–" before anything was played. */
  placeholder?: string | null;
  className?: string;
}

/**
 * A number that rolls to its new value, like a scoreboard: the new value
 * slides in from below when it went up and from above when it went down.
 */
export function TickNumber({ value, style = "int", placeholder, className }: TickProps) {
  const { locale } = useFormat();
  const text = placeholder ?? formatStyled(value, style, locale);
  const changes = useChangeCount(text);
  const direction = useDirection(value);
  return (
    <span className={cn("inline-block", className)}>
      <span key={changes} className={cn("inline-block", changes > 0 && (direction < 0 ? "animate-tick-down" : "animate-tick-up"))}>
        {text}
      </span>
    </span>
  );
}
