"use client";

import { Eye, LinkIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Wordmark } from "@/components/brand";
import { ScorecardTable } from "@/components/golf/scorecard-table";
import { MatchLine, Standings } from "@/components/play/standings";
import { LanguageSwitch } from "@/components/preferences";
import { useFormat, useT } from "@/components/providers";
import { Badge, LiveDot } from "@/components/ui/badge";
import { Card, EmptyState, SectionHeading } from "@/components/ui/card";
import { useLiveResource } from "@/hooks/use-live-resource";
import { formatDate } from "@/lib/format";
import { holesPlayed } from "@/lib/golf/scoring";
import { clubThemeStyle } from "@/lib/theme";
import type { RoundSnapshot } from "@/lib/types";

interface LiveViewProps {
  token: string;
  initial: RoundSnapshot;
}

/** The public, read-only view of a round behind a share link. */
export function LiveView({ token, initial }: LiveViewProps) {
  const t = useT();
  const { locale } = useFormat();
  const [expired, setExpired] = useState(false);
  const { data } = useLiveResource<{ round: RoundSnapshot }>({
    url: expired ? null : `/api/live/${token}`,
    streamUrl: expired ? null : `/api/live/${token}/stream`,
    initial: { round: initial },
    onGone: () => setExpired(true),
  });
  const round = data.round;

  if (expired) return <LiveExpired />;

  const total = round.participants.length * round.holeCount;
  const entered = round.participants.reduce((count, participant) => count + holesPlayed(participant.scores), 0);
  const live = round.status === "active";
  const waiting = round.status === "inviting";
  const progress = total > 0 ? Math.round((entered / total) * 100) : 0;

  return (
    <div style={clubThemeStyle(round.theme)} className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-10">
      <header className="flex items-center justify-between gap-3">
        <Wordmark name={round.clubName} />
        <div className="flex items-center gap-2">
          <Badge icon={<Eye className="size-3" />}>{t("pub.live.readOnly")}</Badge>
          <LanguageSwitch variant="compact" className="text-ink-2" />
        </div>
      </header>

      <section className="bg-ruled relative overflow-hidden rounded-[1.5rem] bg-brand p-6 text-brand-ink">
        <p className="font-label flex items-center gap-2 text-[11px] text-accent">
          {live ? <LiveDot /> : null}
          {live ? t("pub.live.liveRound") : waiting ? t("pub.live.waiting") : t("pub.live.finalScore")}
        </p>
        <h1 className="font-display mt-3 text-[clamp(1.9rem,7vw,2.8rem)] text-balance">{round.course.name}</h1>
        <p className="mt-2 text-[15px] opacity-80">
          {t("common.holes", { count: round.holeCount })} · {t("common.par")} {round.course.par} · {t(`common.format.${round.format}`)} ·{" "}
          {formatDate(round.completedAt ?? round.startedAt ?? round.createdAt, locale, round.timeZone)}
        </p>
        {live ? (
          <div className="mt-5">
            <div className="h-1.5 overflow-hidden rounded-full bg-current/20">
              <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs opacity-75">{t("pub.live.progress", { done: entered, total })}</p>
          </div>
        ) : null}
      </section>

      <section>
        <SectionHeading title={live ? t("play.card.standings") : t("app.results.ranking")} />
        <MatchLine round={round} className="mb-3" />
        <Standings round={round} size="lg" />
      </section>

      <section>
        <SectionHeading title={t("app.results.scorecard")} />
        <Card>
          <ScorecardTable
            holes={round.course.holes}
            rows={round.participants.map((participant) => ({ id: participant.id, name: participant.name, scores: participant.scores }))}
            labels={{ hole: t("common.hole"), par: t("common.par"), out: t("app.results.out"), in: t("app.results.in"), total: t("common.total") }}
          />
        </Card>
      </section>

      <footer className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-5 text-[13px] text-ink-3">
        <span>{t("pub.live.poweredBy")}</span>
        <Link href="/" className="font-semibold text-brand-fg underline-offset-4 hover:underline">
          {t("pub.live.openApp")}
        </Link>
      </footer>
    </div>
  );
}

export function LiveExpired() {
  const t = useT();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5">
      <Wordmark />
      <EmptyState icon={<LinkIcon className="size-5" />} title={t("pub.live.expiredTitle")} description={t("pub.live.expiredLead")} />
    </div>
  );
}
