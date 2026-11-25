"use client";

import { Check, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useErrorMessage, useT, useToast } from "@/components/providers";
import { NAV_FORWARD } from "@/components/motion/page-transition";
import { useOverview } from "@/components/shell/overview";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge, LiveDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/card";
import { useFlip } from "@/hooks/use-motion";
import { api } from "@/lib/api-client";
import type { ActiveRoundSummary } from "@/lib/types";

/** Rounds in progress and open invitations, kept live for the home screen. */
export function ActiveRounds() {
  const t = useT();
  const { overview } = useOverview();
  // An invitation that arrives pops in; a round whose scores move lights up.
  const flip = useFlip({ enter: "pop" });
  if (overview.rounds.length === 0) return null;

  return (
    <section className="animate-rise mb-8">
      <SectionHeading title={t("app.home.liveHeading")} />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {overview.rounds.map((round) => (
          <li
            key={round.id}
            ref={flip(round.id, `${round.status}|${round.completedScores}|${round.myInvitation}|${round.participants.length}`)}
            className="rounded-card"
          >
            <RoundCard round={round} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RoundCard({ round }: { round: ActiveRoundSummary }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { refresh } = useOverview();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  const invited = round.myInvitation === "pending";
  const waiting = round.participants.filter((participant) => participant.invitation === "pending").length;
  const progress = round.totalScores > 0 ? Math.round((round.completedScores / round.totalScores) * 100) : 0;

  async function respond(decision: "accept" | "decline") {
    setBusy(decision);
    try {
      await api.post(`/api/rounds/${round.id}/respond`, { decision });
      await refresh();
      if (decision === "accept") router.push(`/app/play/${round.id}`, { transitionTypes: NAV_FORWARD });
      else toast.success(t("play.lobby.declined"));
    } catch (error) {
      toast.error(errorMessage(error));
      await refresh();
    }
    setBusy(null);
  }

  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        {round.status === "active" ? (
          <Badge tone="under" icon={<LiveDot />}>
            {t("common.status.active")}
          </Badge>
        ) : (
          <Badge tone="gold">{t("common.status.inviting")}</Badge>
        )}
        <span className="text-xs text-ink-3">
          {t("common.holes", { count: round.holeCount })} · {t(`common.format.${round.format}`)}
        </span>
      </div>
      <h3 className="font-display mt-3 text-xl">{round.courseName}</h3>
      <p className="mt-1 text-sm text-ink-2">
        {invited
          ? t("app.home.invitationFrom", { name: round.starterName })
          : round.isStarter
            ? t("app.home.yourRound")
            : t("app.home.startedBy", { name: round.starterName })}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <AvatarStack people={round.participants} />
        <span className="text-xs font-medium text-ink-3">
          {round.status === "active"
            ? t("app.home.progress", { done: round.completedScores, total: round.totalScores })
            : t("app.home.waitingFor", { count: waiting })}
        </span>
      </div>
      {round.status === "active" ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" role="presentation">
          <div className="h-full rounded-full bg-under transition-[width] duration-700 ease-(--ease-out)" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
    </>
  );

  if (invited) {
    return (
      <article className="rounded-card border border-gold/40 bg-surface p-5 shadow-card [--glow-color:var(--gold)] animate-glow">
        {body}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" loading={busy === "decline"} disabled={busy !== null} onClick={() => void respond("decline")} icon={<X className="size-4" />}>
            {t("app.home.decline")}
          </Button>
          <Button variant="accent" loading={busy === "accept"} disabled={busy !== null} onClick={() => void respond("accept")} icon={<Check className="size-4" />}>
            {t("app.home.accept")}
          </Button>
        </div>
      </article>
    );
  }

  return (
    <Link
      href={`/app/play/${round.id}`}
      transitionTypes={NAV_FORWARD}
      className="block rounded-card border border-line bg-surface p-5 shadow-card transition duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop active:scale-[0.99]"
    >
      {body}
      <span className="mt-4 flex items-center justify-end gap-1 text-sm font-semibold text-brand-fg">
        {round.status === "active" ? t("app.home.continue") : t("app.home.viewLobby")}
        <ChevronRight className="size-4" />
      </span>
    </Link>
  );
}
