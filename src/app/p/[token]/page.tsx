import { Flag } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AddToRoundButton } from "@/components/qr/join-actions";
import { QrLanding } from "@/components/qr/qr-landing";
import { Avatar } from "@/components/ui/avatar";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { formatClubIndex } from "@/lib/golf/club-index";
import { MAX_FLIGHT_SIZE } from "@/lib/golf/scoring";
import { getSession } from "@/server/auth/session";
import { getT } from "@/server/i18n";
import { findPlayerByQrToken } from "@/server/services/players";
import { listActiveRounds } from "@/server/services/rounds";

export const metadata: Metadata = { title: "Speler" };

/**
 * Where a personal QR code leads when it is scanned with the phone's own
 * camera: the club mate, with ways to play together.
 */
export default async function PlayerQrPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const session = await getSession();
  if (!session) redirect(`/?next=${encodeURIComponent(`/p/${token}`)}`);
  const { t, locale } = await getT();

  if (session.role !== "player" || !session.clubId || !session.club) {
    return (
      <QrLanding eyebrow={t("play.qr.playerEyebrow")} title={t("play.qr.scanTitle")}>
        <EmptyState title={t("play.qr.staffOnly")} />
      </QrLanding>
    );
  }
  if (session.user.mustChangeSecret) redirect("/app/welcome");

  const player = await findPlayerByQrToken(session.clubId, token);
  if (!player) {
    return (
      <QrLanding clubName={session.club.name} eyebrow={t("play.qr.playerEyebrow")} title={t("play.qr.scanTitle")}>
        <EmptyState title={t("play.qr.playerUnknown")} />
        <LinkButton href="/app" variant="ghost">
          {t("play.qr.backHome")}
        </LinkButton>
      </QrLanding>
    );
  }

  const self = player.id === session.accountId;
  // Open rounds of the viewer that still have room for one more.
  const rounds = self
    ? []
    : (await listActiveRounds(session.clubId, session.accountId, locale)).filter(
        (round) =>
          round.myInvitation === "accepted" &&
          round.participants.length < MAX_FLIGHT_SIZE &&
          !(round.format === "match" && round.participants.length >= 2),
      );

  return (
    <QrLanding clubName={session.club.name} eyebrow={t("play.qr.playerEyebrow")} title={player.name}>
      <Card className="flex items-center gap-4">
        <Avatar name={player.name} initials={player.initials} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-semibold">@{player.username}</p>
          <p className="text-sm text-ink-3">
            {t("common.clubIndex")} {formatClubIndex(player.clubIndex, locale)}
          </p>
        </div>
      </Card>
      {self ? (
        <EmptyState title={t("play.qr.thisIsYou")} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {rounds.map((round) => (
            <AddToRoundButton key={round.id} roundId={round.id} qrToken={token} label={t("play.qr.addToRound", { course: round.courseName })} />
          ))}
          <LinkButton href={`/app/play?qr=${encodeURIComponent(token)}`} variant="accent" size="lg" block icon={<Flag className="size-[1.1rem]" />}>
            {t("play.qr.playTogether")}
          </LinkButton>
        </div>
      )}
      <LinkButton href="/app" variant="ghost">
        {t("play.qr.backHome")}
      </LinkButton>
    </QrLanding>
  );
}
