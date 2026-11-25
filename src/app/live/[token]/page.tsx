import type { Metadata } from "next";
import { headers } from "next/headers";
import { cache } from "react";
import { LiveExpired, LiveView } from "@/components/public/live-view";
import { devicePlatform } from "@/lib/native";
import { androidApkSize, publicOrigin } from "@/server/http/origin";
import { getT } from "@/server/i18n";
import { getSharedRound } from "@/server/services/rounds";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,200}$/;

// Metadata and the page ask for the same round; load it once per request.
const loadRound = cache(async (token: string) => {
  const { locale } = await getT();
  return TOKEN_PATTERN.test(token) ? getSharedRound(token, locale) : null;
});

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const [{ t }, round] = await Promise.all([getT(), loadRound(token)]);
  if (!round) return { title: t("pub.live.liveRound") };
  const title = `${round.course.name} · ${round.status === "active" ? t("pub.live.liveRound") : t("pub.live.finalScore")}`;
  const description = `${round.clubName} · ${round.participants.map((participant) => participant.name).join(", ")}`;
  // A shared link previews as the course and the players, in WhatsApp and the like.
  return { title, description, openGraph: { title, description, siteName: "Fairway", type: "website" } };
}

/** The public view of a round behind its share link. */
export default async function LivePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ install?: string }>;
}) {
  const [{ token }, { install }] = await Promise.all([params, searchParams]);
  const round = await loadRound(token);
  if (!round) return <LiveExpired />;

  const [requestHeaders, origin, apkBytes] = await Promise.all([headers(), publicOrigin(), androidApkSize()]);
  return (
    <LiveView
      token={token}
      initial={round}
      platform={devicePlatform(requestHeaders.get("user-agent"))}
      origin={origin}
      apkBytes={apkBytes}
      installHint={install === "1"}
    />
  );
}
