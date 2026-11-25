import { Flag } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RoundResult } from "@/components/app/round-result";
import { ShareButton } from "@/components/play/share-button";
import { LinkButton } from "@/components/ui/button";
import { requirePlayer } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { getRoundForPlayer } from "@/server/services/rounds";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlayer();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { t, locale } = await getT();
  const round = await getRoundForPlayer(session.clubId, session.accountId, id, locale);
  if (!round) notFound();
  if (round.status === "inviting" || round.status === "active") redirect(`/app/play/${round.id}`);
  const participant = Boolean(round.viewer?.participantId);

  return (
    <RoundResult
      round={round}
      t={t}
      locale={locale}
      top={
        <Link href={participant ? "/app/results" : "/app/leaderboards"} className="font-semibold text-ink-2 hover:text-ink">
          ← {participant ? t("app.results.allResults") : t("common.nav.leaderboards")}
        </Link>
      }
      actions={
        <>
          {participant ? <ShareButton roundId={round.id} courseName={round.course.name} token={round.shareToken ?? null} /> : null}
          <LinkButton href={`/app/play?course=${round.course.id}`} variant="accent" icon={<Flag className="size-4" />}>
            {t("app.results.newRound")}
          </LinkButton>
        </>
      }
    />
  );
}
