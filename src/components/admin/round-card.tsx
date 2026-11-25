import type { ReactNode } from "react";
import { RoundStatusBadge } from "./labels";
import { ToPar } from "@/components/golf/score-mark";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n/core";
import type { AppTranslate } from "@/lib/i18n/dictionaries";
import type { AdminRoundRow } from "@/lib/types";

interface RoundCardProps {
  round: AdminRoundRow;
  t: AppTranslate;
  locale: Locale;
  timeZone: string;
  showStatus?: boolean;
  actions?: ReactNode;
}

/** One round as staff see it in a list: who played, where, and the totals. */
export function RoundCard({ round, t, locale, timeZone, showStatus, actions }: RoundCardProps) {
  const scored = round.status !== "inviting";
  return (
    <article className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg">{round.courseName}</h3>
          <p className="mt-1 text-[13px] text-ink-2">
            <time dateTime={round.completedAt ?? round.createdAt}>{formatDateTime(round.completedAt ?? round.createdAt, locale, timeZone)}</time>
            {" · "}
            {t("admin.rounds.startedBy", { name: round.starterName })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {showStatus ? <RoundStatusBadge status={round.status} t={t} /> : null}
          <Badge>{t("common.holes", { count: round.holeCount })}</Badge>
          <Badge>{t(`common.format.${round.format}`)}</Badge>
          {round.eventTitle ? <Badge tone="info">{t("admin.rounds.forEvent", { event: round.eventTitle })}</Badge> : null}
        </div>
      </header>

      <ul className="mt-3 border-t border-line">
        {round.participants.map((participant, index) => (
          <li key={index} className="flex items-center gap-3 border-b border-line py-2 last:border-b-0">
            <Avatar name={participant.name} initials={participant.initials} size="sm" guest={participant.guest} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {participant.name}
              {participant.guest ? <span className="ml-1.5 font-normal text-ink-3">({t("common.guest")})</span> : null}
            </span>
            {scored ? (
              <>
                <span className="font-score text-lg">{participant.strokes || "–"}</span>
                <ToPar
                  value={participant.strokes - participant.par}
                  empty={participant.strokes === 0 || round.status === "active"}
                  className="w-9 text-right text-base"
                />
              </>
            ) : null}
          </li>
        ))}
      </ul>

      {actions ? <footer className="mt-4 flex flex-wrap items-center justify-end gap-2">{actions}</footer> : null}
    </article>
  );
}
