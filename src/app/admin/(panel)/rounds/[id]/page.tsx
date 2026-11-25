import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailRow } from "@/components/admin/common";
import { DeleteButton } from "@/components/admin/delete-button";
import { RoundStatusBadge } from "@/components/admin/labels";
import { RoundDecision } from "@/components/admin/round-review";
import { ToPar } from "@/components/golf/score-mark";
import { ScorecardTable } from "@/components/golf/scorecard-table";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, Eyebrow, SectionHeading } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { matchState, rankFlight } from "@/lib/golf/formats";
import { requireStaff } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { getRoundForStaff } from "@/server/services/rounds";

export const metadata: Metadata = { title: "Ronde" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminRoundPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaff();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { locale, t } = await getT();
  const round = await getRoundForStaff(session.clubId, id, locale);
  if (!round) notFound();

  const timeZone = session.club.timeZone;
  const pars = round.course.holes.map((hole) => hole.par);
  const playing = round.participants.filter((participant) => participant.invitation === "accepted");
  const ranked = rankFlight(playing, pars, round.format);
  const match = round.format === "match" && playing.length === 2 ? matchState(playing[0].scores, playing[1].scores, round.holeCount) : null;
  const reviewable = round.status === "pending" || round.status === "approved" || round.status === "rejected";

  return (
    <>
      <Link href="/admin/rounds" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" />
        {t("admin.rounds.detail.back")}
      </Link>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow className="mb-2">{t("admin.rounds.detail.eyebrow")}</Eyebrow>
          <h1 className="font-display text-[clamp(1.75rem,5vw,2.5rem)]">{round.course.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <RoundStatusBadge status={round.status} t={t} />
            <Badge>{t("common.holes", { count: round.holeCount })}</Badge>
            <Badge>{t(`common.format.${round.format}`)}</Badge>
            {match ? <Badge tone="brand">{match.label}</Badge> : null}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card padding="lg">
            <SectionHeading title={t("admin.rounds.detail.ranking")} />
            <ol className="stagger-children flex flex-col">
              {ranked.map((row) => (
                <li key={row.participant.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                  <span className="font-score w-6 text-center text-lg text-ink-3">{row.thru === 0 ? "–" : row.rank}</span>
                  <Avatar name={row.participant.name} initials={row.participant.initials} guest={row.participant.guest} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {row.participant.name}
                    {row.participant.guest ? <span className="ml-1.5 font-normal text-ink-3">({t("common.guest")})</span> : null}
                  </span>
                  {round.format === "stableford" ? (
                    <span className="text-[13px] text-ink-2">{t("common.points", { count: row.points })}</span>
                  ) : null}
                  <span className="font-score text-xl">{row.thru === 0 ? "–" : row.strokes}</span>
                  <ToPar value={row.toPar} empty={row.thru === 0} className="w-9 text-right text-base" />
                </li>
              ))}
              {round.participants
                .filter((participant) => participant.invitation === "pending")
                .map((participant) => (
                  <li key={participant.id} className="flex items-center gap-3 border-b border-line py-2.5 text-ink-3 last:border-b-0">
                    <span className="w-6" />
                    <Avatar name={participant.name} initials={participant.initials} guest size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm">{participant.name}</span>
                    <Badge>{t("admin.rounds.detail.invited")}</Badge>
                  </li>
                ))}
            </ol>
          </Card>

          {/* Tighter padding on phones: the nine columns need every pixel. */}
          <Card padding="none" className="p-4 sm:p-7">
            <SectionHeading title={t("admin.rounds.detail.scorecard")} />
            <ScorecardTable
              holes={round.course.holes}
              rows={playing.map((participant) => ({
                id: participant.id,
                name: participant.name,
                scores: participant.scores,
                suffix: participant.guest ? `(${t("common.guest")})` : undefined,
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
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <SectionHeading title={t("admin.rounds.detail.decision")} />
            <p className="text-sm text-pretty text-ink-2">
              {round.status === "pending"
                ? t("admin.rounds.detail.decisionPending")
                : round.status === "approved"
                  ? t("admin.rounds.detail.decisionApproved")
                  : round.status === "rejected"
                    ? t("admin.rounds.detail.decisionRejected")
                    : round.status === "active"
                      ? t("admin.rounds.detail.live")
                      : t("admin.rounds.detail.waiting")}
            </p>
            {round.rejectionReason ? (
              <p className="mt-3 rounded-control bg-over-soft px-3.5 py-2.5 text-sm font-medium text-over">
                {t("admin.rounds.detail.reasonLabel", { reason: round.rejectionReason })}
              </p>
            ) : null}
            {reviewable ? (
              <div className="mt-4">
                <RoundDecision roundId={round.id} status={round.status as "pending" | "approved" | "rejected"} />
              </div>
            ) : null}
          </Card>

          <Card>
            <SectionHeading title={t("admin.rounds.detail.info")} />
            <dl>
              <DetailRow label={t("admin.rounds.detail.course")}>
                {round.course.name} · {t("common.par")} {round.course.par}
              </DetailRow>
              <DetailRow label={t("admin.rounds.detail.played")}>
                {formatDateTime(round.completedAt ?? round.startedAt ?? round.createdAt, locale, timeZone)}
              </DetailRow>
              <DetailRow label={t("admin.rounds.detail.starter")}>{round.starterName}</DetailRow>
              <DetailRow label={t("admin.rounds.detail.format")}>{t(`common.format.${round.format}`)}</DetailRow>
              {round.event ? <DetailRow label={t("admin.rounds.detail.event")}>{round.event.title}</DetailRow> : null}
            </dl>
          </Card>

          <div>
            <DeleteButton
              endpoint={`/api/admin/rounds/${round.id}`}
              redirectTo="/admin/rounds"
              label={t("admin.rounds.detail.delete")}
              title={t("admin.rounds.detail.deleteTitle")}
              description={t("admin.rounds.detail.deleteLead")}
              success={t("admin.rounds.detail.deleted")}
            />
          </div>
        </aside>
      </div>
    </>
  );
}
