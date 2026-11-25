"use client";

import { Crown, Eye, Flag, LinkIcon, RefreshCw, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppPromo, SmartBanner } from "./app-banner";
import { Wordmark } from "@/components/brand";
import { ScoreMark } from "@/components/golf/score-mark";
import { ScorecardTable } from "@/components/golf/scorecard-table";
import { TickNumber } from "@/components/motion/animated-number";
import { CelebrationOverlay, useCelebrations, type Celebration } from "@/components/motion/celebration";
import { Reveal } from "@/components/motion/reveal";
import { MatchLine, Standings } from "@/components/play/standings";
import { LanguageSwitch } from "@/components/preferences";
import { useFormat, useT } from "@/components/providers";
import { Avatar } from "@/components/ui/avatar";
import { Badge, LiveDot } from "@/components/ui/badge";
import { Card, EmptyState, SectionHeading } from "@/components/ui/card";
import { useLiveResource, type Connection } from "@/hooks/use-live-resource";
import { useFlip } from "@/hooks/use-motion";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/cn";
import { formatDate, formatSince } from "@/lib/format";
import { rankFlight } from "@/lib/golf/formats";
import { formatToPar, holesPlayed, scoreKind } from "@/lib/golf/scoring";
import { celebrationsOf, currentHole, diffRounds, soleLeader, type LiveEvent } from "@/lib/live-events";
import type { DevicePlatform } from "@/lib/native";
import { clubThemeStyle } from "@/lib/theme";
import type { RoundSnapshot } from "@/lib/types";

interface LiveViewProps {
  token: string;
  initial: RoundSnapshot;
  platform: DevicePlatform;
  /** This deployment's public address, for links into the Android app. */
  origin: string;
  apkBytes: number | null;
  installHint: boolean;
}

/** More scores than this in one update is a catch-up (a phone back online), not a moment. */
const CATCH_UP = 4;

/** What in an update deserves a moment of its own. */
function celebrationsFor(events: readonly LiveEvent[], round: RoundSnapshot): Celebration[] {
  const scores = events.filter((event) => event.kind === "score").length;
  const items: Celebration[] = celebrationsOf(events)
    .filter((event) => scores <= CATCH_UP || event.result === "ace" || event.result === "albatross")
    .slice(0, 3)
    .map((event) => ({
      id: `${round.id}:${event.participantId}:${event.hole}:${event.strokes}`,
      kind: "score",
      result: event.result as Extract<Celebration, { kind: "score" }>["result"],
      name: event.name,
      hole: event.hole,
      strokes: event.strokes,
      par: event.par,
    }));
  for (const event of events) {
    if (event.kind === "lead")
      items.push({
        id: `${round.id}:lead:${event.participantId}:${round.revision}`,
        kind: "lead",
        name: event.name,
      });
    if (event.kind === "status" && event.from === "active" && (event.to === "pending" || event.to === "approved")) {
      items.push({
        id: `${round.id}:finished`,
        kind: "finished",
        winner: soleLeader(round)?.name ?? null,
      });
    }
  }
  return items;
}

/** The public, read-only view of a round behind a share link. */
export function LiveView({ token, initial, platform, origin, apkBytes, installHint }: LiveViewProps) {
  const t = useT();
  const [expired, setExpired] = useState(false);
  const { data, connection } = useLiveResource<{ round: RoundSnapshot }>({
    url: expired ? null : `/api/live/${token}`,
    streamUrl: expired ? null : `/api/live/${token}/stream`,
    initial: { round: initial },
    onGone: () => setExpired(true),
  });
  const round = data.round;
  const celebrations = useCelebrations();

  // Each snapshot that streams in is compared with the one before; what
  // happened in between becomes the moments that pop up over the page.
  const [seen, setSeen] = useState(round);
  if (seen !== round) {
    setSeen(round);
    celebrations.push(celebrationsFor(diffRounds(seen, round), round));
  }

  const live = round.status === "active";
  const waiting = round.status === "inviting";
  const leader = soleLeader(round);
  const leaderRow = leader ? round.participants.find((participant) => participant.id === leader.id) : null;
  const pars = round.course.holes.map((hole) => hole.par);
  const leaderToPar = leaderRow
    ? leaderRow.scores.reduce<number>((sum, strokes, index) => sum + (strokes === null ? 0 : strokes - pars[index]), 0)
    : null;

  // The tab title tells who leads, so a tab in the background still says something.
  const leaderName = leader?.name ?? null;
  useEffect(() => {
    const state = live ? t("common.connection.live") : waiting ? t("pub.live.waiting") : t("pub.live.finalScore");
    const lead = live && leaderName && leaderToPar !== null ? `${leaderName.split(/\s+/)[0]} ${formatToPar(leaderToPar)}` : null;
    document.title = [lead, round.course.name, state].filter(Boolean).join(" · ");
  }, [live, waiting, leaderName, leaderToPar, round.course.name, t]);

  if (expired) return <LiveExpired />;

  const pagePath = `/live/${token}`;
  const pageUrl = `${origin || ""}${pagePath}`;
  const offer = { platform, pageUrl, pagePath, apkBytes, installHint };

  return (
    <div style={clubThemeStyle(round.theme)} className="min-h-dvh">
      {/* The app offer scrolls away with the page; the header with the live status stays. */}
      <SmartBanner platform={platform} apkBytes={apkBytes} installHint={installHint} />
      <header className="safe-top sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Wordmark name={round.clubName} />
          <div className="flex items-center gap-2">
            <ConnectionPill connection={connection} status={round.status} />
            <LanguageSwitch variant="compact" className="text-ink-2" />
          </div>
        </div>
      </header>

      {/* The last row takes what the sidebar needs beyond the first two, so the left column stays tight. */}
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pt-5 pb-10 lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:grid-rows-[auto_auto_1fr] lg:items-start lg:gap-8 lg:pt-8">
        <LiveHero round={round} className="order-1 lg:col-start-1" />

        <section className="order-2 lg:col-start-1">
          <SectionHeading
            title={waiting ? t("pub.live.players") : live ? t("pub.live.standingsLive") : t("app.results.ranking")}
            action={
              <Badge icon={<Eye className="size-3" />} className="animate-fade-in">
                {t("pub.live.readOnly")}
              </Badge>
            }
          />
          <MatchLine round={round} className="mb-3" />
          <Standings round={round} size="lg" animate />
        </section>

        {/* On a phone the feed sits between the standings and the card; on a wide screen it is the sidebar. */}
        <div className="contents lg:sticky lg:top-24 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:flex lg:flex-col lg:gap-6">
          <LiveFeed round={round} className="order-3" />
          <AppPromo {...offer} className="order-5" />
        </div>

        <section className="order-4 lg:col-start-1">
          <SectionHeading title={t("app.results.scorecard")} />
          <Reveal>
            <Card>
              <ScorecardTable
                holes={round.course.holes}
                activeHole={live ? currentHole(round) - 1 : undefined}
                live
                rows={round.participants.map((participant) => ({
                  id: participant.id,
                  name: participant.name,
                  scores: participant.scores,
                }))}
                labels={{
                  hole: t("common.hole"),
                  par: t("common.par"),
                  out: t("app.results.out"),
                  in: t("app.results.in"),
                  total: t("common.total"),
                }}
              />
            </Card>
          </Reveal>
        </section>
      </main>

      <footer className="mx-auto flex max-w-5xl items-center justify-between gap-3 border-t border-line px-4 pt-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] text-[13px] text-ink-3">
        <span>{t("pub.live.poweredBy")}</span>
        <Link href="/" className="font-semibold text-brand-fg underline-offset-4 hover:underline">
          {t("pub.live.openApp")}
        </Link>
      </footer>

      <CelebrationOverlay celebration={celebrations.current} onDone={celebrations.done} />
    </div>
  );
}

// --------------------------------------------------------------- parts --

function ConnectionPill({ connection, status }: { connection: Connection; status: RoundSnapshot["status"] }) {
  const t = useT();
  if (status !== "active" && status !== "inviting") {
    return (
      <Badge tone="gold" icon={<Flag className="size-3" />}>
        {t("pub.live.finalScore")}
      </Badge>
    );
  }
  if (connection === "offline") {
    return (
      <Badge key="offline" tone="over" icon={<RefreshCw className="size-3 animate-spin" />} className="animate-scale-in">
        {t("common.connection.reconnecting")}
      </Badge>
    );
  }
  return (
    <Badge key="live" tone="under" icon={<LiveDot />} className="animate-scale-in">
      {t("common.connection.live")}
    </Badge>
  );
}

function LiveHero({ round, className }: { round: RoundSnapshot; className?: string }) {
  const t = useT();
  const { locale } = useFormat();
  const live = round.status === "active";
  const waiting = round.status === "inviting";
  const total = round.participants.length * round.holeCount;
  const entered = round.participants.reduce((count, participant) => count + holesPlayed(participant.scores), 0);
  const progress = total > 0 ? Math.round((entered / total) * 100) : 0;
  const hole = currentHole(round);
  const pars = round.course.holes.map((item) => item.par);
  const ranked = rankFlight(round.participants, pars, round.format);
  const first = ranked[0];
  const scored = first && first.thru > 0;
  const tied = scored && first.tied;
  const finished = !live && !waiting;

  return (
    <section
      className={cn("bg-ruled animate-rise relative overflow-hidden rounded-[1.6rem] bg-brand p-6 text-brand-ink sm:p-7", className)}
    >
      {/* A slow light sweeping over the panel while the round is on. */}
      {live ? (
        <span
          aria-hidden="true"
          className="animate-spin-slow pointer-events-none absolute -top-1/2 -right-1/3 size-[26rem] rounded-full opacity-60"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0 70%, color-mix(in oklab, var(--accent) 22%, transparent) 85%, transparent)",
          }}
        />
      ) : null}

      <div className="relative">
        <p className="font-label flex items-center gap-2 text-[11px] text-accent">
          {live ? <LiveDot /> : finished ? <Trophy className="size-3.5" /> : null}
          {live ? t("pub.live.liveRound") : waiting ? t("pub.live.waiting") : t("pub.live.finalScore")}
        </p>
        <h1 className="font-display mt-3 text-[clamp(1.9rem,7vw,2.9rem)] text-balance">{round.course.name}</h1>
        <p className="mt-2 text-[15px] opacity-80">
          {t("common.holes", { count: round.holeCount })} · {t("common.par")} {round.course.par} · {t(`common.format.${round.format}`)} ·{" "}
          {formatDate(round.completedAt ?? round.startedAt ?? round.createdAt, locale, round.timeZone)}
        </p>

        {waiting ? (
          <p className="mt-5 flex items-center gap-3 text-sm opacity-85">
            <WaitingDots />
            {t("pub.live.waitingLead")}
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] items-end gap-x-6 gap-y-5">
            <div>
              <p className="font-label text-[10px] opacity-70">
                {live ? t("pub.live.onHole") : t("common.holes", { count: round.holeCount })}
              </p>
              <p className="font-score mt-1 text-[4.2rem] leading-[0.85]">
                {live ? <TickNumber value={hole} /> : <Flag className="size-12" aria-hidden="true" />}
              </p>
            </div>
            <div className="min-w-0 border-l border-current/15 pl-6">
              <p className="font-label text-[10px] opacity-70">
                {finished ? (tied ? t("pub.live.tie") : t("pub.live.winner")) : tied ? t("pub.live.sharedLead") : t("pub.live.leader")}
              </p>
              {scored && !tied ? (
                <p key={first.participant.id} className="animate-slide-down mt-1.5 flex items-center gap-2.5">
                  <span className="relative">
                    <Avatar name={first.participant.name} initials={first.participant.initials} guest={first.participant.guest} size="md" />
                    <Crown className="absolute -top-2.5 -right-1.5 size-4 rotate-12 text-gold" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-lg leading-tight font-bold">{first.participant.name}</span>
                    {round.format === "stableford" ? (
                      <span className="font-score block text-xl text-accent">
                        <TickNumber value={first.points} /> {t("play.card.pointsShort")}
                      </span>
                    ) : (
                      <TickNumber value={first.toPar} style="toPar" className="font-score text-xl text-accent" />
                    )}
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-sm opacity-80">
                  {scored
                    ? ranked
                        .filter((row) => row.rank === 1)
                        .map((row) => row.participant.name.split(/\s+/)[0])
                        .join(" · ")
                    : t("pub.live.noScoresYet")}
                </p>
              )}
            </div>
          </div>
        )}

        {live ? (
          <div className="mt-6">
            <div className="relative h-2 rounded-full bg-current/15">
              <div
                className="relative h-full rounded-full bg-accent transition-[width] duration-700 ease-(--ease-out)"
                style={{ width: `${Math.max(progress, 2)}%` }}
              >
                {/* The ball rolls along with the progress. */}
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 -right-2 size-4 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_45%,transparent),0_2px_6px_rgb(0_0_0/0.3)]"
                />
              </div>
              <Flag aria-hidden="true" className="absolute -top-5 -right-1 size-4 text-accent" />
            </div>
            <p className="mt-2.5 text-xs opacity-75">{t("pub.live.progress", { done: entered, total })}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function WaitingDots() {
  return (
    <span aria-hidden="true" className="flex shrink-0 gap-1">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="animate-float size-2 rounded-full bg-accent"
          style={{
            animationDuration: "1.2s",
            animationDelay: `${index * 160}ms`,
          }}
        />
      ))}
    </span>
  );
}

function LiveFeed({ round, className }: { round: RoundSnapshot; className?: string }) {
  const t = useT();
  const { locale } = useFormat();
  const now = useNow();
  const flip = useFlip({ enter: "slide", flash: false });
  const people = new Map(round.participants.map((participant) => [participant.id, participant]));
  const items = round.activity.filter((item) => people.has(item.participantId)).slice(0, 8);
  const latest = items[0];

  return (
    <section className={className}>
      <SectionHeading title={t("pub.live.feedTitle")} className={latest ? "mb-1" : undefined} />
      {latest ? (
        <p className="mb-3 flex items-center gap-2 text-xs text-ink-3" suppressHydrationWarning>
          {round.status === "active" ? <LiveDot className="size-1.5 text-under" /> : null}
          {now
            ? t("pub.live.lastScore", {
                time: formatSince(latest.at, locale, now),
              })
            : "\u00a0"}
        </p>
      ) : null}
      {items.length === 0 ? (
        <EmptyState
          icon={<span className="animate-float block size-3 rounded-full bg-ink-3/60" />}
          title={t("pub.live.noScoresYet")}
          description={t("pub.live.feedEmpty")}
          className="py-8"
        />
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((item, index) => {
            const person = people.get(item.participantId)!;
            const kind = scoreKind(item.strokes, item.par);
            const special = kind === "ace" || kind === "albatross" || kind === "eagle" || kind === "birdie";
            return (
              <li
                key={`${item.participantId}:${item.hole}:${item.at}`}
                ref={flip(`${item.participantId}:${item.hole}:${item.at}`)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border bg-surface px-3 py-2.5",
                  special ? "border-under/35" : "border-line",
                  index === 0 && "shadow-card",
                )}
              >
                <Avatar name={person.name} initials={person.initials} guest={person.guest} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {t("pub.live.feedLine", {
                      name: person.name.split(/\s+/)[0],
                      hole: item.hole,
                    })}
                  </span>
                  <span className={cn("font-label block text-[10px]", special ? "text-under" : "text-ink-3")}>
                    {t(`common.scoreKind.${kind}`)}
                    {now ? (
                      <span className="font-sans font-normal tracking-normal normal-case text-ink-3" suppressHydrationWarning>
                        {" · "}
                        {formatSince(item.at, locale, now)}
                      </span>
                    ) : null}
                  </span>
                </span>
                <ScoreMark strokes={item.strokes} par={item.par} size="md" />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function LiveExpired() {
  const t = useT();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5">
      <Wordmark />
      <EmptyState
        className="animate-rise"
        icon={<LinkIcon className="size-5" />}
        title={t("pub.live.expiredTitle")}
        description={t("pub.live.expiredLead")}
      />
    </div>
  );
}
