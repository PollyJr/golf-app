"use client";

import { ChevronLeft, ChevronRight, CloudOff, Ellipsis, Flag, Lightbulb, LogOut, Share2, TableProperties, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Confetti } from "@/components/motion/confetti";
import { NAV_FORWARD } from "@/components/motion/page-transition";
import { HoleStrip } from "./hole-strip";
import { ShareDialog } from "./share-dialog";
import { MatchLine, Standings } from "./standings";
import { useScoreQueue } from "./use-score-queue";
import { ScoreMark } from "@/components/golf/score-mark";
import { TickNumber } from "@/components/motion/animated-number";
import { AddPlayerDialog } from "@/components/qr/qr-dialogs";
import { ScorecardTable } from "@/components/golf/scorecard-table";
import { useErrorMessage, useT, useToast } from "@/components/providers";
import { Avatar } from "@/components/ui/avatar";
import { Badge, LiveDot } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Connection } from "@/hooks/use-live-resource";
import { useDirection } from "@/hooks/use-motion";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { stablefordPoints } from "@/lib/golf/formats";
import { holesPlayed, MAX_FLIGHT_SIZE, MAX_STROKES, nextOpenHole, scoreKind, toPar, totalStrokes, type HoleInfo } from "@/lib/golf/scoring";
import type { RoundParticipantDto, RoundSnapshot } from "@/lib/types";

interface LiveScorecardProps {
  round: RoundSnapshot;
  connection: Connection;
  refresh: () => Promise<void>;
  /** Clubs that trust their members approve rounds without review. */
  autoApprove: boolean;
}

/** Chips offered for a hole: 1 up to three over par covers almost every score. */
const chipCount = (par: number) => par + 3;

export function LiveScorecard({ round, connection, refresh, autoApprove }: LiveScorecardProps) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const errorMessage = useErrorMessage();

  const { view, pendingCount, sync, setScore } = useScoreQueue({
    round,
    refresh,
    onRejected: () => toast.error(t("play.card.rejectedChange")),
  });

  const holes = view.course.holes;
  const pars = useMemo(() => holes.map((hole) => hole.par), [holes]);
  const [activeHole, setActiveHole] = useState(() =>
    nextOpenHole(round.participants.map((participant) => participant.scores), round.holeCount),
  );
  const [dialog, setDialog] = useState<"menu" | "overview" | "finish" | "share" | "add" | "leave" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);

  const hole = holes[Math.min(activeHole, holes.length - 1)];
  const holeIndex = hole.number - 1;
  const direction = useDirection(holeIndex);
  const viewer = view.viewer;
  const total = view.participants.length * view.holeCount;
  const entered = view.participants.reduce((count, participant) => count + holesPlayed(participant.scores), 0);
  const complete = total > 0 && entered === total;
  const holeDone = view.participants.every((participant) => (participant.scores[holeIndex] ?? null) !== null);
  const lastHole = holeIndex === holes.length - 1;
  const offline = connection === "offline" || sync === "waiting";

  function chooseStrokes(participant: RoundParticipantDto, strokes: number) {
    const current = participant.scores[holeIndex] ?? null;
    // Tapping the chosen score again clears it.
    setScore({ participantId: participant.id, hole: hole.number, strokes: current === strokes ? null : strokes });
    if (navigator.vibrate) navigator.vibrate(8);
  }

  function choosePutts(participant: RoundParticipantDto, putts: number) {
    const strokes = participant.scores[holeIndex] ?? null;
    if (strokes === null) return;
    const current = participant.putts[holeIndex] ?? null;
    setScore({ participantId: participant.id, hole: hole.number, strokes, putts: current === putts ? null : putts });
  }

  async function act(action: () => Promise<unknown>, message: string, destination: string) {
    setBusy(true);
    try {
      await action();
      toast.success(message);
      router.replace(destination);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
      await refresh();
    }
  }

  async function submit() {
    setBusy(true);
    try {
      await api.post(`/api/rounds/${round.id}/submit`);
      // Straight from the last putt to the result, with a little fanfare.
      router.replace(`/app/results/${round.id}?done=1`, { transitionTypes: NAV_FORWARD });
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
      await refresh();
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-paper">
      {/* ----------------------------------------------------------- header */}
      <header className="safe-top sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur-md">
        <div className="flex h-14 items-center gap-2 px-2">
          <Link href="/app" aria-label={t("common.back")} className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-well">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{view.course.name}</p>
            <p className="text-xs text-ink-3">
              {t(`common.format.${view.format}`)} · {t("common.holes", { count: view.holeCount })}
            </p>
          </div>
          {offline ? (
            <Badge tone="over" icon={<CloudOff className="size-3" />}>
              {t("common.connection.offline")}
            </Badge>
          ) : (
            <Badge tone="under" icon={<LiveDot />}>
              {t("common.connection.live")}
            </Badge>
          )}
          <IconButton label={t("play.card.menu")} onClick={() => setDialog("menu")}>
            <Ellipsis className="size-5" />
          </IconButton>
        </div>
        <div className="px-4 pb-2">
          <HoleStrip
            holes={holes}
            scoresByPlayer={view.participants.map((participant) => participant.scores)}
            active={holeIndex}
            onSelect={setActiveHole}
            label={t("common.hole")}
          />
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 pt-4 pb-36">
        {offline ? (
          <p role="status" className="animate-slide-down rounded-control bg-over-soft px-3.5 py-2.5 text-[13px] font-medium text-over">
            {t("play.card.offlineNote")}
            {pendingCount > 0 ? ` ${t("play.card.queued", { count: pendingCount })}.` : null}
          </p>
        ) : null}

        {/* -------------------------------------------------------- the hole */}
        <section className="bg-ruled relative overflow-hidden rounded-[1.4rem] bg-brand px-5 py-4 text-brand-ink" aria-label={t("play.card.holeOf", { current: hole.number, total: holes.length })}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-label text-[10.5px] text-accent">{t("common.hole")}</p>
              <p key={hole.number} className="font-score animate-pop text-[5rem] leading-[0.85]">
                {hole.number}
              </p>
            </div>
            <dl className="flex gap-6 pb-1 text-right">
              <div>
                <dt className="font-label text-[10px] opacity-70">{t("play.card.par")}</dt>
                <dd className="font-score text-3xl">{hole.par}</dd>
              </div>
              <div>
                <dt className="font-label text-[10px] opacity-70">{t("play.card.distance")}</dt>
                <dd className="font-score text-3xl">
                  {hole.distance}
                  <span className="ml-0.5 text-base opacity-70">m</span>
                </dd>
              </div>
            </dl>
          </div>
          {hole.name || hole.tip ? (
            <div className="mt-3 border-t border-current/15 pt-3 text-sm">
              {hole.name ? <p className="font-bold">{hole.name}</p> : null}
              {hole.tip ? (
                <p className="mt-1 flex gap-2 opacity-80">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" aria-label={t("play.card.tip")} />
                  {hole.tip}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* ----------------------------------------------------- score entry */}
        {/* The players slide in from the side you are moving to. */}
        <ul key={hole.number} className={cn("flex flex-col gap-3", direction > 0 && "animate-slide-in-right", direction < 0 && "animate-slide-in-left")}>
          {view.participants.map((participant) => (
            <ParticipantEntry
              key={participant.id}
              participant={participant}
              hole={hole}
              holeIndex={holeIndex}
              mine={participant.id === viewer?.participantId}
              stableford={view.format === "stableford"}
              trackPutts={view.trackPutts}
              pars={pars}
              onStrokes={(strokes) => chooseStrokes(participant, strokes)}
              onPutts={(putts) => choosePutts(participant, putts)}
              onMore={(strokes) => setScore({ participantId: participant.id, hole: hole.number, strokes })}
            />
          ))}
        </ul>

        {/* -------------------------------------------------------- standings */}
        {view.participants.length > 1 ? (
          <section className="rounded-card border border-line bg-well p-3">
            <div className="mb-1 flex items-center justify-between px-2">
              <h2 className="font-label text-[10.5px] text-ink-3">{t("play.card.standings")}</h2>
              <button type="button" onClick={() => setDialog("overview")} className="text-xs font-semibold text-brand-fg">
                {t("play.card.overview")}
              </button>
            </div>
            <MatchLine round={view} className="mx-2 mb-2" />
            <Standings round={view} highlightId={viewer?.participantId} animate />
          </section>
        ) : null}
      </main>

      {/* ----------------------------------------------------------- footer */}
      <footer className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pt-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Button variant="secondary" size="lg" disabled={holeIndex === 0} onClick={() => setActiveHole(holeIndex - 1)} aria-label={t("common.previous")} className="px-4">
            <ChevronLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1 text-center">
            <p className="font-score text-lg">{t("play.card.holeOf", { current: hole.number, total: holes.length })}</p>
            <p className="truncate text-xs text-ink-3">{complete ? t("play.card.complete") : t("play.card.incomplete", { count: total - entered })}</p>
          </div>
          {complete || lastHole ? (
            <Button variant="accent" size="lg" disabled={!complete} onClick={() => setDialog("finish")} icon={<Flag className="size-4" />}>
              {t("play.card.finish")}
            </Button>
          ) : (
            <Button
              variant={holeDone ? "accent" : "primary"}
              size="lg"
              onClick={() => setActiveHole(holeIndex + 1)}
              aria-label={t("common.next")}
              className={cn("px-5", holeDone && "animate-glow")}
            >
              {t("common.next")}
              <ChevronRight className="size-5" />
            </Button>
          )}
        </div>
      </footer>

      {/* ---------------------------------------------------------- dialogs */}
      <Dialog open={dialog === "menu"} onClose={() => setDialog(null)} title={view.course.name} size="sm">
        <div className="flex flex-col gap-2">
          <Button variant="secondary" block onClick={() => setDialog("overview")} icon={<TableProperties className="size-4" />}>
            {t("play.card.overview")}
          </Button>
          <Button variant="secondary" block onClick={() => setDialog("add")} icon={<UserPlus className="size-4" />}>
            {t("play.qr.addPlayer")}
          </Button>
          <Button variant="secondary" block onClick={() => setDialog("share")} icon={<Share2 className="size-4" />}>
            {t("play.share.title")}
          </Button>
          {viewer?.isStarter ? (
            <Button variant="danger" block onClick={() => setDialog("cancel")} icon={<Trash2 className="size-4" />}>
              {t("play.card.cancel")}
            </Button>
          ) : (
            <Button variant="danger" block onClick={() => setDialog("leave")} icon={<LogOut className="size-4" />}>
              {t("play.card.leave")}
            </Button>
          )}
        </div>
      </Dialog>

      <Dialog open={dialog === "overview"} onClose={() => setDialog(null)} title={t("play.card.overview")} description={view.course.name} size="lg">
        <ScorecardTable
          holes={holes}
          activeHole={holeIndex}
          rows={view.participants.map((participant) => ({
            id: participant.id,
            name: participant.name,
            scores: participant.scores,
            highlight: participant.id === viewer?.participantId,
          }))}
          labels={{ hole: t("common.hole"), par: t("common.par"), out: t("app.results.out"), in: t("app.results.in"), total: t("common.total") }}
        />
      </Dialog>

      <Dialog
        open={dialog === "finish"}
        onClose={() => setDialog(null)}
        title={t("play.card.finishTitle")}
        description={t("play.card.finishLead")}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              {t("common.back")}
            </Button>
            <Button variant="accent" loading={busy} disabled={pendingCount > 0} onClick={() => void submit()}>
              {t("play.card.submit")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <MatchLine round={view} />
          <Standings round={view} highlightId={viewer?.participantId} />
          <ScorecardTable
            holes={holes}
            rows={view.participants.map((participant) => ({ id: participant.id, name: participant.name, scores: participant.scores }))}
            labels={{ hole: t("common.hole"), par: t("common.par"), out: t("app.results.out"), in: t("app.results.in"), total: t("common.total") }}
          />
          <p className="rounded-control bg-well px-3.5 py-2.5 text-[13px] text-ink-2">
            {pendingCount > 0 ? t("play.card.queued", { count: pendingCount }) : autoApprove ? t("play.card.finishAuto") : t("play.card.finishReview")}
          </p>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "leave" || dialog === "cancel"}
        onClose={() => setDialog(null)}
        title={dialog === "cancel" ? t("play.card.cancel") : t("play.card.leave")}
        description={dialog === "cancel" ? t("play.card.cancelConfirm") : t("play.card.leaveConfirm")}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              {t("common.back")}
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                dialog === "cancel"
                  ? void act(() => api.delete(`/api/rounds/${round.id}`), t("play.lobby.cancelled"), "/app")
                  : void act(() => api.post(`/api/rounds/${round.id}/lobby`, { action: "leave" }), t("play.card.left"), "/app")
              }
            >
              {dialog === "cancel" ? t("play.card.cancel") : t("play.card.leave")}
            </Button>
          </>
        }
      />

      <AddPlayerDialog
        open={dialog === "add"}
        onClose={() => setDialog(null)}
        roundId={round.id}
        joinToken={view.joinToken ?? null}
        full={view.participants.length >= MAX_FLIGHT_SIZE || (view.format === "match" && view.participants.length >= 2)}
        onAdded={() => void refresh()}
      />

      <ShareDialog
        open={dialog === "share"}
        onClose={() => setDialog(null)}
        roundId={round.id}
        courseName={view.course.name}
        token={view.shareToken ?? null}
        onChange={() => void refresh()}
      />
    </div>
  );
}

interface ParticipantEntryProps {
  participant: RoundParticipantDto;
  hole: HoleInfo;
  holeIndex: number;
  mine: boolean;
  stableford: boolean;
  trackPutts: boolean;
  pars: readonly number[];
  onStrokes: (strokes: number) => void;
  onPutts: (putts: number) => void;
  onMore: (strokes: number) => void;
}

const CELEBRATED = new Set(["ace", "albatross", "eagle", "birdie"]);

/** One player's card for the hole being played: chips for strokes, and putts if tracked. */
function ParticipantEntry({ participant, hole, holeIndex, mine, stableford, trackPutts, pars, onStrokes, onPutts, onMore }: ParticipantEntryProps) {
  const t = useT();
  const strokes = participant.scores[holeIndex] ?? null;
  const putts = participant.putts[holeIndex] ?? null;
  const played = holesPlayed(participant.scores);
  const chips = chipCount(hole.par);
  const beyond = strokes !== null && strokes > chips;
  const kind = strokes === null ? null : scoreKind(strokes, hole.par);

  // A birdie or better entered on this hole, by anyone in the flight, gets a burst.
  const [seen, setSeen] = useState({ strokes, bursts: 0, fresh: false });
  if (seen.strokes !== strokes) {
    const celebrate = kind !== null && CELEBRATED.has(kind);
    setSeen({ strokes, bursts: celebrate ? seen.bursts + 1 : seen.bursts, fresh: true });
  }

  return (
    <li className={cn("relative rounded-card border bg-surface p-4 shadow-card transition-colors duration-300", mine ? "border-brand-fg/35" : "border-line")}>
      <div className="flex items-center gap-3">
        <Avatar name={participant.name} initials={participant.initials} guest={participant.guest} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {participant.name}
            {mine ? <span className="font-label ml-2 text-[10px] text-brand-fg">{t("common.you")}</span> : null}
            {participant.guest ? <span className="font-label ml-2 text-[10px] text-ink-3">{t("common.guest")}</span> : null}
          </p>
          <p className="text-[13px] text-ink-3">
            {played === 0
              ? t("play.card.noScore")
              : stableford
                ? `${t("common.points", { count: participant.scores.reduce<number>((sum, value, index) => sum + (value === null ? 0 : stablefordPoints(value, pars[index])), 0) })} · ${t("common.thru", { count: played })}`
                : `${t("common.strokes", { count: totalStrokes(participant.scores) })} · ${t("common.thru", { count: played })}`}
          </p>
        </div>
        <div className="relative text-right">
          {seen.bursts > 0 && kind !== null && CELEBRATED.has(kind) ? <Confetti key={seen.bursts} seed={seen.bursts + hole.number} pieces={22} spread={0.7} /> : null}
          {kind !== null ? (
            <p
              key={`${kind}-${strokes}`}
              className={cn(
                "font-label text-[10.5px]",
                CELEBRATED.has(kind) ? "text-under" : "text-ink-2",
                seen.fresh && (CELEBRATED.has(kind) ? "animate-stamp" : "animate-fade-in"),
              )}
            >
              {t(`common.scoreKind.${kind}`)}
            </p>
          ) : null}
          {played > 0 && !stableford ? <TickNumber value={toPar(participant.scores, pars)} style="toPar" className={cn("font-score text-xl", toPar(participant.scores, pars) < 0 && "text-under", toPar(participant.scores, pars) > 0 && "text-over")} /> : null}
        </div>
      </div>

      <div className="mt-3.5 flex items-center gap-1.5" role="group" aria-label={t("play.card.strokesFor", { name: participant.name })}>
        {Array.from({ length: chips }, (_, index) => index + 1).map((value) => {
          const selected = strokes === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => onStrokes(value)}
              className={cn(
                "grid h-12 min-w-0 flex-1 place-items-center rounded-xl border transition duration-200 active:scale-90",
                selected ? "border-transparent bg-well" : "border-line bg-surface hover:bg-well",
                !selected && value === hole.par && "border-line-strong",
              )}
            >
              {selected ? (
                <ScoreMark strokes={value} par={hole.par} size="md" className="animate-pop" />
              ) : (
                <span className={cn("font-score text-lg", value === hole.par ? "text-ink" : "text-ink-3")}>{value}</span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          aria-label={t("play.card.more")}
          disabled={strokes !== null && strokes >= MAX_STROKES}
          onClick={() => onMore(Math.min(MAX_STROKES, Math.max(chips, strokes ?? chips) + 1))}
          className={cn(
            "grid h-12 min-w-0 flex-1 place-items-center rounded-xl border transition duration-200 active:scale-90 disabled:opacity-40",
            beyond ? "border-transparent bg-well" : "border-line bg-surface text-ink-3 hover:bg-well",
          )}
        >
          {beyond ? <ScoreMark key={strokes} strokes={strokes} par={hole.par} size="md" className="animate-pop" /> : <span className="font-score text-lg">{chips + 1}+</span>}
        </button>
      </div>

      {trackPutts && strokes !== null ? (
        <div className="animate-fade-in mt-2.5 flex items-center gap-2" role="group" aria-label={t("play.card.puttsFor", { name: participant.name })}>
          <span className="font-label w-12 text-[10px] text-ink-3">{t("play.card.putts")}</span>
          {Array.from({ length: Math.min(strokes, 4) + 1 }, (_, value) => (
            <button
              key={value}
              type="button"
              aria-pressed={putts === value}
              onClick={() => onPutts(value)}
              className={cn(
                "font-score grid h-9 flex-1 place-items-center rounded-lg border text-base transition duration-200 active:scale-90",
                putts === value ? "border-transparent bg-brand text-brand-ink" : "border-line text-ink-3 hover:bg-well",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}
