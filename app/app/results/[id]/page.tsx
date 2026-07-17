import { notFound, redirect } from "next/navigation";
import { RoundResultView } from "@/components/round-result-view";
import { requireSession } from "@/lib/auth";
import { getRoundForPlayer } from "@/lib/rounds";

export default async function ResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(["player"]);
  const { id } = await params;
  const round = await getRoundForPlayer(id, session.clubId!, session.accountId);
  if (!round) notFound();
  if (round.status === "active" || round.status === "inviting") redirect(`/app/play?round=${round.id}`);
  return <RoundResultView round={round}/>;
}
