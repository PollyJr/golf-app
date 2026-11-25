import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { JoinRoundButton } from "@/components/qr/join-actions";
import { QrLanding } from "@/components/qr/qr-landing";
import { AvatarStack } from "@/components/ui/avatar";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { getSession, type ClubSession } from "@/server/auth/session";
import { getT } from "@/server/i18n";
import { getJoinPreview } from "@/server/services/rounds";

export const metadata: Metadata = { title: "Meedoen" };

/** Where a scanned round QR code leads: the round, and a button to join it. */
export default async function JoinRoundPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const session = await getSession();
  if (!session) redirect(`/?next=${encodeURIComponent(`/r/${token}`)}`);
  const { t, locale } = await getT();

  if (session.role !== "player" || !session.club) {
    return (
      <QrLanding eyebrow={t("play.qr.joinEyebrow")} title={t("play.qr.joinTitle")}>
        <EmptyState title={t("play.qr.staffOnly")} />
      </QrLanding>
    );
  }
  if (session.user.mustChangeSecret) redirect("/app/welcome");

  const preview = await getJoinPreview(session as ClubSession, token, locale);
  if (preview?.alreadyIn && preview.open) redirect(`/app/play/${preview.roundId}`);

  const problem = !preview ? t("play.qr.joinUnknown") : !preview.open ? t("play.qr.joinClosed") : preview.full ? t("play.qr.joinFull") : null;

  return (
    <QrLanding clubName={session.club.name} eyebrow={t("play.qr.joinEyebrow")} title={t("play.qr.joinTitle")}>
      {preview ? (
        <Card className="flex flex-col gap-4">
          <div>
            <p className="font-display text-2xl">{preview.courseName}</p>
            <p className="mt-1 text-sm text-ink-2">
              {t("common.holes", { count: preview.holeCount })} · {t(`common.format.${preview.format}`)}
            </p>
            <p className="mt-0.5 text-sm text-ink-3">{t("play.qr.joinStarter", { name: preview.starterName })}</p>
          </div>
          <div className="flex items-center gap-3 border-t border-line pt-4">
            <AvatarStack people={preview.participants} size="md" />
            <span className="text-sm text-ink-2">{preview.participants.map((participant) => participant.name.split(/\s+/)[0]).join(", ")}</span>
          </div>
        </Card>
      ) : null}
      {problem ? <EmptyState title={problem} /> : <JoinRoundButton token={token} />}
      <LinkButton href="/app" variant="ghost">
        {t("play.qr.backHome")}
      </LinkButton>
    </QrLanding>
  );
}
