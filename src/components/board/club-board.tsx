"use client";

import { CalendarDays, Megaphone, Star, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { boardThemeStyle } from "./board-theme";
import { BrandMark } from "@/components/brand";
import { ToPar } from "@/components/golf/score-mark";
import { useLocale, useT } from "@/components/providers";
import { Avatar } from "@/components/ui/avatar";
import { LiveDot } from "@/components/ui/badge";
import { useLiveResource } from "@/hooks/use-live-resource";
import { cn } from "@/lib/cn";
import { dateParts, dayKey, formatLongDate, formatShortDate, formatTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n/core";
import type { EventDto, LeaderboardEntry } from "@/lib/types";
import type { BoardData, LiveFlight } from "@/server/services/board";

/**
 * The clubhouse board: who is on the course, the rankings, what is coming up.
 *
 * It is designed on a 1920×1080 canvas. On wide screens the root font size
 * follows the viewport (see BOARD_CSS), so the same layout fills a 720p
 * television and a 4K one alike; on phones it becomes a scrolling column.
 */

const ROTATE_MS = 12_000;
const RANKING_ROWS = 8;
const EVENTS_SHOWN = 3;
const ACES_SHOWN = 3;

// The live panel must never overflow on a television. Heights are in pixels
// on the 1080p canvas: what is left below the panel heading, and what one
// flight card costs (padding and label, plus a row per player).
const LIVE_FLIGHTS_MAX = 3;
const LIVE_BUDGET = 650;
const FLIGHT_BASE = 56;
const FLIGHT_ROW = 48;
const FLIGHT_GAP = 20;
const MORE_LINE = 40;

/** The flights that fit the live panel, in the order the server sent them. */
function fitFlights(flights: readonly LiveFlight[]): LiveFlight[] {
  const shown: LiveFlight[] = [];
  let used = 0;
  for (const flight of flights) {
    const cost = FLIGHT_BASE + flight.players.length * FLIGHT_ROW + (shown.length > 0 ? FLIGHT_GAP : 0);
    const reserve = flights.length > shown.length + 1 ? MORE_LINE : 0;
    if (shown.length >= LIVE_FLIGHTS_MAX || used + cost + reserve > LIVE_BUDGET) break;
    shown.push(flight);
    used += cost;
  }
  return shown.length > 0 ? shown : flights.slice(0, 1);
}

// Scoped to this page: it scales the whole canvas with the screen and adds the
// one animation the design tokens do not have.
const BOARD_CSS = `
@media (min-width: 1024px) {
  html { font-size: min(1.4815vh, 0.8333vw); }
}
@keyframes fw-board-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
`;

type PeriodKey = "today" | "week" | "month";

interface ClubBoardProps {
  token: string;
  initial: BoardData;
  /** The public host name, shown as "join in at …". */
  host: string;
}

export function ClubBoard({ token, initial, host }: ClubBoardProps) {
  const t = useT();
  const locale = useLocale();
  const [gone, setGone] = useState(false);
  const { data, connection } = useLiveResource<{ board: BoardData }>({
    url: gone ? null : `/api/board/${token}`,
    streamUrl: gone ? null : `/api/board/${token}/stream`,
    initial: { board: initial },
    onGone: () => setGone(true),
  });
  const board = data.board;
  const timeZone = board.club.timeZone;
  const now = useNow(initial.generatedAt);

  const periods = useMemo(
    () =>
      [
        { key: "today" as PeriodKey, label: t("board.today"), rows: board.today },
        { key: "week" as PeriodKey, label: t("board.week"), rows: board.week },
        { key: "month" as PeriodKey, label: t("board.month"), rows: board.month },
      ] as const,
    [board.today, board.week, board.month, t],
  );
  const [chosen, setChosen] = useState(0);
  // Never rest on an empty ranking while another one has rows.
  const filled = periods.map((period, index) => (period.rows.length > 0 ? index : -1)).filter((index) => index >= 0);
  const active = filled.length === 0 || filled.includes(chosen) ? chosen : filled[0];
  const rotating = filled.length > 1;
  const filledKey = filled.join(",");

  useEffect(() => {
    if (!rotating) return;
    const order = filledKey.split(",").map(Number);
    const timer = window.setTimeout(() => {
      setChosen(order[(order.indexOf(active) + 1) % order.length]);
    }, ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [active, rotating, filledKey]);

  // The spotlight panel takes turns: each club post, then the hole-in-one club.
  const slides = useMemo<Slide[]>(
    () => [
      ...board.announcements.map((item): Slide => ({ kind: "news", key: item.id, title: item.title, body: item.body })),
      ...(board.aces.length > 0 ? [{ kind: "aces", key: "aces" } as Slide] : []),
    ],
    [board.announcements, board.aces.length],
  );
  const [slide, setSlide] = useRotation(slides.length, ROTATE_MS);

  if (gone) {
    return (
      <div style={boardThemeStyle(board.club)} className="grid min-h-dvh place-items-center bg-paper px-6 text-center text-ink">
        <div className="max-w-md">
          <h1 className="font-display text-3xl text-balance">{t("board.unavailableTitle")}</h1>
          <p className="mt-3 text-pretty text-ink-2">{t("board.unavailableLead")}</p>
        </div>
      </div>
    );
  }

  const visibleFlights = fitFlights(board.live);
  const hiddenFlights = board.live.length - visibleFlights.length;

  return (
    <div
      style={boardThemeStyle(board.club)}
      className="relative flex min-h-dvh flex-col gap-5 bg-paper px-4 pt-5 pb-8 text-ink lg:h-dvh lg:gap-7 lg:overflow-hidden lg:px-12 lg:pt-9 lg:pb-7"
    >
      <style>{BOARD_CSS}</style>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(110% 70% at 88% -12%, color-mix(in oklab, var(--board-accent) 16%, transparent), transparent 62%), radial-gradient(70% 55% at -5% 105%, rgb(255 255 255 / 0.05), transparent 60%)",
        }}
      />

      {/* ------------------------------------------------------------ header */}
      <header className="relative flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3 lg:gap-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-(--board-accent) text-accent-ink lg:size-[4.75rem] lg:rounded-3xl">
            <BrandMark className="size-7 lg:size-12" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display line-clamp-2 text-lg lg:line-clamp-1 lg:text-[3.25rem]">{board.club.name}</h1>
            {board.club.tagline ? (
              <p className="hidden truncate text-ink-2 lg:mt-2 lg:block lg:text-2xl">{board.club.tagline}</p>
            ) : null}
          </div>
        </div>
        {board.joinCode ? (
          <div className="ml-auto hidden items-center gap-4 xl:flex">
            <div className="text-right">
              <p className="font-label text-lg text-(color:--board-accent)">{t("board.join")}</p>
              <p className="mt-1 max-w-[11rem] text-base text-ink-2">{t("board.joinLead")}</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- an SVG from our own API */}
            <img src={`/api/qr?path=/join/${encodeURIComponent(board.joinCode)}`} alt="" className="size-[6.5rem] rounded-2xl bg-white p-2" />
          </div>
        ) : null}
        <div className="shrink-0 text-right xl:ml-6">
          <p className="font-score text-[2rem] text-(color:--board-accent) lg:text-[5.5rem]" suppressHydrationWarning>
            {formatTime(now, locale, timeZone)}
          </p>
          <p className="font-label mt-1 text-[9.5px] text-ink-2 lg:mt-2 lg:text-xl" suppressHydrationWarning>
            {formatLongDate(now, locale, timeZone)}
          </p>
        </div>
      </header>

      {/* -------------------------------------------------------------- body */}
      <main className="relative grid min-h-0 flex-1 gap-5 lg:grid-cols-12 lg:gap-7">
        {/* On the course */}
        <Panel className="lg:col-span-4">
          <PanelHeading
            eyebrow={
              <span className="inline-flex items-center gap-2 text-(color:--board-accent) lg:gap-3">
                <LiveDot className="lg:size-3" />
                Live
              </span>
            }
            title={t("board.onCourse")}
          />
          {visibleFlights.length === 0 ? (
            <Empty hero title={t("board.nobodyOnCourse")} lead={t("board.nobodyOnCourseLead")} />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3 lg:gap-5">
              {visibleFlights.map((flight) => (
                <Flight key={flight.id} flight={flight} />
              ))}
              {hiddenFlights > 0 ? (
                <p className="font-label text-[11px] text-ink-3 lg:text-lg">{t("board.moreFlights", { count: hiddenFlights })}</p>
              ) : null}
            </div>
          )}
        </Panel>

        {/* Rankings */}
        <Panel className="lg:col-span-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <PanelHeading eyebrow={t("board.ranking")} title={periods[active].label} className="mb-0 lg:mb-0" />
            <div className="flex gap-1.5 lg:gap-2.5" role="tablist" aria-label={t("board.ranking")}>
              {periods.map((period, index) => (
                <button
                  key={period.key}
                  type="button"
                  role="tab"
                  aria-selected={index === active}
                  onClick={() => setChosen(index)}
                  className={cn(
                    "font-label relative h-8 overflow-hidden rounded-full px-3 text-[10.5px] transition lg:h-11 lg:px-5 lg:text-base",
                    index === active ? "bg-white/15 text-ink" : "text-ink-3 hover:text-ink",
                    period.rows.length === 0 && index !== active && "opacity-50",
                  )}
                >
                  {period.label}
                  {index === active && rotating ? (
                    <span
                      key={`${period.key}-${chosen}`}
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-(--board-accent) lg:h-1"
                      style={{ animation: `fw-board-progress ${ROTATE_MS}ms linear both` }}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1 mb-3 text-xs text-ink-3 lg:mt-2 lg:mb-5 lg:text-lg">
            {t("board.holesNote", { count: board.holeCount })}
          </p>
          <Ranking key={periods[active].key} rows={periods[active].rows.slice(0, RANKING_ROWS)} />
        </Panel>

        {/* Calendar and the rotating spotlight */}
        <div className="flex min-h-0 flex-col gap-5 lg:col-span-3 lg:gap-7">
          <Panel className={slides.length === 0 ? "lg:flex-1" : "lg:shrink-0"}>
            <PanelHeading eyebrow={<CalendarDays className="size-3.5 lg:size-6" />} title={t("board.upcoming")} />
            {board.events.length === 0 ? (
              <Empty title={t("board.noEvents")} />
            ) : (
              <ul className="flex flex-col gap-3 lg:gap-4">
                {board.events.slice(0, EVENTS_SHOWN).map((event) => (
                  <EventRow key={event.id} event={event} now={now} timeZone={timeZone} locale={locale} />
                ))}
              </ul>
            )}
          </Panel>

          {/* Phones show every slide below each other; a television one at a time. */}
          {slides.map((item, index) => (
            <Panel key={item.key} className={cn("lg:flex-1", index !== slide && "lg:hidden")}>
              {/* Stacked on a phone, one heading for the run of club posts is enough. */}
              <div className={cn("items-start justify-between gap-4 lg:flex", item.kind === "news" && index > 0 ? "hidden" : "flex")}>
                <PanelHeading
                  eyebrow={item.kind === "news" ? <Megaphone className="size-3.5 lg:size-6" /> : <Star className="size-3.5 lg:size-6" />}
                  title={item.kind === "news" ? t("board.announcements") : t("board.aces")}
                />
                {slides.length > 1 ? (
                  <div className="mt-1 hidden gap-2 lg:flex" role="tablist" aria-label={t("board.announcements")}>
                    {slides.map((other, position) => (
                      <button
                        key={other.key}
                        type="button"
                        role="tab"
                        aria-selected={position === slide}
                        aria-label={`${position + 1} / ${slides.length}`}
                        onClick={() => setSlide(position)}
                        className={cn("h-2 rounded-full transition-all", position === slide ? "w-8 bg-(--board-accent)" : "w-2 bg-white/25")}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              {item.kind === "news" ? (
                <div className="animate-rise">
                  <p className="line-clamp-2 text-[15px] leading-snug font-bold text-balance lg:text-[1.7rem]">{item.title}</p>
                  <p className="mt-1.5 line-clamp-4 text-[13px] leading-relaxed whitespace-pre-line text-ink-2 lg:mt-3 lg:line-clamp-3 lg:text-xl">
                    {item.body}
                  </p>
                </div>
              ) : (
                <ul className="flex animate-rise flex-col gap-2.5 lg:gap-4">
                  {board.aces.slice(0, ACES_SHOWN).map((ace) => (
                    <li key={`${ace.roundId}-${ace.hole}`} className="flex items-center gap-3 lg:gap-4">
                      <span className="font-score grid size-9 shrink-0 place-items-center rounded-full bg-gold text-lg text-(color:--board-ground) shadow-[0_0_0_2px_var(--board-ground),0_0_0_3.5px_var(--gold)] lg:size-13 lg:text-3xl">
                        1
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold lg:text-2xl">{ace.playerName}</span>
                        <span className="block truncate text-xs text-ink-3 lg:text-lg">
                          {t("board.aceLine", { hole: ace.hole, distance: ace.distance })} · {formatShortDate(ace.completedAt, locale, timeZone)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ))}
        </div>
      </main>

      {/* ------------------------------------------------------------ footer */}
      <footer className="font-label relative flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-[10px] text-ink-3 lg:text-base">
        <span className="inline-flex items-center gap-2 lg:gap-3">
          {connection === "offline" ? (
            <>
              <WifiOff className="size-3.5 text-over lg:size-5" />
              <span className="text-over">{t("board.reconnecting")}</span>
            </>
          ) : (
            <>
              <span className="size-1.5 rounded-full bg-(--board-accent) lg:size-2.5" aria-hidden="true" />
              <span suppressHydrationWarning>{t("board.updated", { time: formatTime(board.generatedAt, locale, timeZone) })}</span>
            </>
          )}
        </span>
        {host ? <span className="text-ink-2">{t("board.openApp", { host })}</span> : null}
        <span className="inline-flex items-center gap-1.5 lg:gap-2.5">
          <BrandMark className="size-3.5 lg:size-6" />
          Fairway
        </span>
      </footer>
    </div>
  );
}

// ------------------------------------------------------------------ parts --

/** The current time, ticking. Starts from the server's clock to hydrate cleanly. */
function useNow(initial: string): Date {
  const [now, setNow] = useState(() => new Date(initial));
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

type Slide = { kind: "news"; key: string; title: string; body: string } | { kind: "aces"; key: string };

/** Steps through `count` items, one every `intervalMs`; a manual choice restarts the wait. */
function useRotation(count: number, intervalMs: number): [number, (index: number) => void] {
  const [chosen, setChosen] = useState(0);
  const index = count === 0 ? 0 : chosen % count;
  useEffect(() => {
    if (count <= 1) return;
    const timer = window.setTimeout(() => setChosen((index + 1) % count), intervalMs);
    return () => window.clearTimeout(timer);
  }, [index, count, intervalMs]);
  return [index, setChosen];
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-3xl border border-line bg-white/[0.045] p-4 lg:rounded-[2rem] lg:p-8",
        className,
      )}
    >
      {children}
    </section>
  );
}

function PanelHeading({ eyebrow, title, className }: { eyebrow: ReactNode; title: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 lg:mb-6", className)}>
      <p className="font-label flex items-center gap-2 text-[10.5px] text-ink-3 lg:text-lg">{eyebrow}</p>
      <h2 className="font-display mt-1 text-xl lg:mt-2 lg:text-[2.6rem]">{title}</h2>
    </div>
  );
}

/** A quiet placeholder; with `hero` it fills a large panel and centres itself. */
function Empty({ title, lead, hero }: { title: string; lead?: string; hero?: boolean }) {
  if (!hero) {
    return <p className="py-2 text-sm font-semibold text-ink-2 lg:py-0 lg:text-2xl">{title}</p>;
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-6 text-center lg:py-0">
      <span className="grid size-14 place-items-center rounded-full bg-white/[0.07] text-ink-3 lg:size-28">
        <BrandMark className="size-7 lg:size-14" />
      </span>
      <p className="mt-4 text-sm font-semibold text-ink-2 lg:mt-8 lg:text-[1.7rem]">{title}</p>
      {lead ? <p className="mt-1 max-w-[28rem] text-xs text-pretty text-ink-3 lg:mt-3 lg:text-xl">{lead}</p> : null}
    </div>
  );
}

function Flight({ flight }: { flight: LiveFlight }) {
  const t = useT();
  return (
    <article className="rounded-2xl bg-white/[0.05] p-3 lg:rounded-3xl lg:p-4">
      <p className="font-label flex items-center justify-between gap-3 text-[10px] text-ink-3 lg:text-[0.95rem]">
        <span className="truncate">{flight.courseName}</span>
        <span className="shrink-0">
          {t("common.holes", { count: flight.holeCount })} · {t(`common.format.${flight.format}`)}
        </span>
      </p>
      <ul className="mt-2 flex flex-col gap-1.5 lg:mt-3 lg:gap-2">
        {flight.players.map((player, index) => {
          const status =
            player.thru === 0
              ? t("board.notStarted")
              : player.thru >= flight.holeCount
                ? t("board.finished")
                : t("board.thru", { count: player.thru });
          return (
            <li key={`${player.name}-${index}`} className="flex items-center gap-3 lg:gap-4">
              <Avatar name={player.name} initials={player.initials} size="sm" className="lg:size-10 lg:text-base" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold lg:text-[1.55rem]">{player.name}</span>
              <span className="font-label shrink-0 text-[10px] text-ink-3 lg:text-base">{status}</span>
              <ToPar value={player.toPar} empty={player.thru === 0} className="w-9 shrink-0 text-right text-xl lg:w-20 lg:text-[2.4rem]" />
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function Ranking({ rows }: { rows: LeaderboardEntry[] }) {
  const t = useT();
  if (rows.length === 0) return <Empty hero title={t("board.emptyRanking")} lead={t("board.emptyRankingLead")} />;
  return (
    <ol className="flex min-h-0 flex-1 flex-col lg:justify-between">
      {rows.map((row, index) => (
        <li
          key={row.playerId}
          className="flex animate-rise items-center gap-3 border-t border-line py-2 first:border-t-0 lg:gap-5 lg:py-0"
          style={{ animationDelay: `${index * 45}ms` }}
        >
          <span
            className={cn(
              "font-score w-6 shrink-0 text-center text-xl lg:w-14 lg:text-[2.75rem]",
              row.rank <= 3 ? "text-(color:--board-accent)" : "text-ink-3",
            )}
          >
            {row.rank}
          </span>
          <Avatar name={row.name} initials={row.initials} size="sm" className="lg:size-14 lg:text-xl" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold lg:text-[1.75rem]">{row.name}</span>
          <span className="font-score shrink-0 text-base text-ink-2 lg:text-[2rem]">{row.value}</span>
          <ToPar value={row.toPar ?? 0} className="w-10 shrink-0 text-right text-xl lg:w-24 lg:text-[2.75rem]" />
        </li>
      ))}
    </ol>
  );
}

function EventRow({ event, now, timeZone, locale }: { event: EventDto; now: Date; timeZone: string; locale: Locale }) {
  const t = useT();
  const parts = dateParts(event.startsAt, locale, timeZone);
  const today = dayKey(event.startsAt, timeZone) === dayKey(now, timeZone);
  const full = event.capacity !== null && event.registered >= event.capacity;
  return (
    <li className="flex items-center gap-3 lg:gap-4">
      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-xl text-center lg:size-[4.75rem] lg:rounded-2xl",
          today ? "bg-(--board-accent) text-accent-ink" : "bg-white/10",
        )}
      >
        <span>
          <span className="font-score block text-xl lg:text-[2.1rem]">{parts.day}</span>
          <span className="font-label block text-[9px] opacity-80 lg:mt-1 lg:text-[0.8rem]">{parts.month}</span>
        </span>
      </span>
      <span className="min-w-0">
        <span className="line-clamp-2 text-sm leading-tight font-bold lg:text-[1.4rem]">{event.title}</span>
        <span className="mt-0.5 block truncate text-xs text-ink-3 lg:mt-1.5 lg:text-lg">
          {today ? `${t("board.today")} · ` : ""}
          {formatTime(event.startsAt, locale, timeZone)} · {t(`common.eventKind.${event.kind}`)}
          {full ? <span className="font-semibold text-(color:--board-accent)"> · {t("board.full")}</span> : null}
        </span>
      </span>
    </li>
  );
}
