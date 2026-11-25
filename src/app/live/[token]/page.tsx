import type { Metadata } from "next";
import { LiveExpired, LiveView } from "@/components/public/live-view";
import { getLocale } from "@/server/i18n";
import { getSharedRound } from "@/server/services/rounds";

export const metadata: Metadata = { title: "Live ronde" };

export default async function LivePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const round = /^[A-Za-z0-9_-]{16,200}$/.test(token) ? await getSharedRound(token, await getLocale()) : null;
  if (!round) return <LiveExpired />;
  return <LiveView token={token} initial={round} />;
}
