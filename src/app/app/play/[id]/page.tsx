import { notFound, redirect } from "next/navigation";
import { RoundScreen } from "@/components/play/round-screen";
import { requirePlayer } from "@/server/auth/guards";
import { getLocale } from "@/server/i18n";
import { getClubDetails } from "@/server/services/clubs";
import { getRoundForPlayer } from "@/server/services/rounds";

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlayer();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [round, club] = await Promise.all([
    getRoundForPlayer(session.clubId, session.accountId, id, await getLocale()),
    getClubDetails(session.clubId),
  ]);
  // Only participants play; everyone else (and finished rounds) see the result.
  if (!round || !round.viewer?.participantId) notFound();
  if (round.status !== "inviting" && round.status !== "active") redirect(`/app/results/${round.id}`);

  return <RoundScreen initial={round} autoApprove={club?.autoApproveRounds ?? false} />;
}
