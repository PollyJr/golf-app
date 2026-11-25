/**
 * Locale- and time-zone-aware formatting. Every date helper takes the club's
 * time zone explicitly, so the server and the browser render the same string.
 */
import { intlLocale, type Locale } from "./i18n/core";

export const DEFAULT_TIME_ZONE = "Europe/Amsterdam";

type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: Locale, timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${timeZone}|${JSON.stringify(options)}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(intlLocale(locale), { ...options, timeZone });
    formatters.set(key, cached);
  }
  return cached;
}

/** `24 november 2026` */
export function formatDate(value: DateInput, locale: Locale, timeZone = DEFAULT_TIME_ZONE): string {
  return formatter(locale, timeZone, { day: "numeric", month: "long", year: "numeric" }).format(toDate(value));
}

/** `24 nov` */
export function formatShortDate(value: DateInput, locale: Locale, timeZone = DEFAULT_TIME_ZONE): string {
  return formatter(locale, timeZone, { day: "numeric", month: "short" }).format(toDate(value));
}

/** `di 24 nov` */
export function formatWeekdayDate(value: DateInput, locale: Locale, timeZone = DEFAULT_TIME_ZONE): string {
  return formatter(locale, timeZone, { weekday: "short", day: "numeric", month: "short" }).format(toDate(value));
}

/** `dinsdag 24 november` */
export function formatLongDate(value: DateInput, locale: Locale, timeZone = DEFAULT_TIME_ZONE): string {
  return formatter(locale, timeZone, { weekday: "long", day: "numeric", month: "long" }).format(toDate(value));
}

/** `14:30` */
export function formatTime(value: DateInput, locale: Locale, timeZone = DEFAULT_TIME_ZONE): string {
  return formatter(locale, timeZone, { hour: "2-digit", minute: "2-digit", hour12: false }).format(toDate(value));
}

/** `24 nov 14:30` */
export function formatDateTime(value: DateInput, locale: Locale, timeZone = DEFAULT_TIME_ZONE): string {
  return `${formatShortDate(value, locale, timeZone)} ${formatTime(value, locale, timeZone)}`;
}

/** Day of the month and short month as separate parts, for calendar tiles. */
export function dateParts(value: DateInput, locale: Locale, timeZone = DEFAULT_TIME_ZONE): { day: string; month: string; weekday: string } {
  const parts = formatter(locale, timeZone, { day: "numeric", month: "short", weekday: "short" }).formatToParts(toDate(value));
  const find = (type: string) => parts.find((part) => part.type === type)?.value.replace(".", "") ?? "";
  return { day: find("day"), month: find("month"), weekday: find("weekday") };
}

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();

/** `2026-11-24` in the given time zone, for comparing calendar days. */
export function dayKey(value: DateInput, timeZone = DEFAULT_TIME_ZONE): string {
  let cached = dayKeyFormatters.get(timeZone);
  if (!cached) {
    // The Canadian English locale formats dates as ISO `YYYY-MM-DD`.
    cached = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayKeyFormatters.set(timeZone, cached);
  }
  return cached.format(toDate(value));
}

const RELATIVE_STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

/** `3 minuten geleden`, `over 2 dagen`; `nu` within a minute either way. */
export function formatRelative(value: DateInput, locale: Locale, now: Date = new Date()): string {
  const seconds = Math.round((toDate(value).getTime() - now.getTime()) / 1000);
  const relative = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return relative.format(0, "second");
}

/** How long ago something happened; a moment "in the future" (clock skew) is now. */
export function formatSince(value: DateInput, locale: Locale, now: Date): string {
  const time = toDate(value);
  return formatRelative(time > now ? now : time, locale, now);
}

export function formatNumber(value: number, locale: Locale, fractionDigits = 0): string {
  return value.toLocaleString(intlLocale(locale), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** `+1,4` / `−0,6` / `0,0` — signed, one decimal, for averages relative to par. */
export function formatSigned(value: number, locale: Locale, fractionDigits = 1): string {
  const rounded = Number(value.toFixed(fractionDigits));
  const absolute = formatNumber(Math.abs(rounded), locale, fractionDigits);
  if (rounded === 0) return absolute;
  return rounded > 0 ? `+${absolute}` : `−${absolute}`;
}

export function formatPercent(value: number, locale: Locale): string {
  return `${formatNumber(value * 100, locale)}%`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Converts a `<input type="datetime-local">` value in a time zone to a UTC instant. */
export function zonedInputToDate(value: string, timeZone = DEFAULT_TIME_ZONE): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // The offset of the zone at that instant; applied twice to settle DST edges.
  const offsetAt = (instant: number) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(instant));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - instant;
  };
  let instant = guess - offsetAt(guess);
  instant = guess - offsetAt(instant);
  return new Date(instant);
}

/** The inverse of `zonedInputToDate`: an instant as `YYYY-MM-DDTHH:mm` in a time zone. */
export function dateToZonedInput(value: DateInput, timeZone = DEFAULT_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(toDate(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
