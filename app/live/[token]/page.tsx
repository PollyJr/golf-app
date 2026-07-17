import { notFound } from "next/navigation";
import { PublicRoundLive } from "@/components/public-round-live";
import { getPublicRound } from "@/lib/rounds";
import { sha256 } from "@/lib/security";

export default async function PublicLiveRoundPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(token)) notFound();
  const round = await getPublicRound(sha256(token));
  if (!round) notFound();
  return <PublicRoundLive token={token} initialRound={round}/>;
}
