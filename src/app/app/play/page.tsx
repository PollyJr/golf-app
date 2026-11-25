import type { Metadata } from "next";
import { RoundSetup } from "@/components/play/round-setup";
import { requirePlayer } from "@/server/auth/guards";
import { getT } from "@/server/i18n";
import { listCourses } from "@/server/services/courses";
import { listPlayableEvents } from "@/server/services/events";
import { findPlayerByQrToken, getOwnAccount, getPlayerSummary, recentPartners } from "@/server/services/players";

export const metadata: Metadata = { title: "Spelen" };

const UUID = /^[0-9a-f-]{36}$/i;
const QR_TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

interface PlayPageProps {
  /** `with`: a club mate to invite; `qr`: a club mate whose QR code was scanned. */
  searchParams: Promise<{ course?: string; with?: string; qr?: string; event?: string }>;
}

export default async function PlayPage({ searchParams }: PlayPageProps) {
  const session = await requirePlayer();
  const { locale } = await getT();
  const query = await searchParams;
  const partnerId = query.with && UUID.test(query.with) && query.with !== session.accountId ? query.with : null;
  const qrToken = query.qr && QR_TOKEN.test(query.qr) ? query.qr : null;

  const [me, courses, partners, events, invited, scanned, account] = await Promise.all([
    getPlayerSummary(session.clubId, session.accountId),
    listCourses(session.clubId, locale),
    recentPartners(session.clubId, session.accountId),
    listPlayableEvents(session.clubId, locale),
    partnerId ? getPlayerSummary(session.clubId, partnerId) : Promise.resolve(null),
    qrToken ? findPlayerByQrToken(session.clubId, qrToken) : Promise.resolve(null),
    getOwnAccount(session),
  ]);
  const partner = scanned && scanned.id !== session.accountId ? { ...scanned, qrToken: qrToken ?? undefined } : invited;

  return (
    <RoundSetup
      me={me ?? { id: session.accountId, name: session.user.displayName, initials: session.user.initials, username: session.user.username ?? "", clubIndex: null }}
      courses={courses}
      recentPartners={partners}
      events={events}
      preselect={{ courseId: query.course, partner, eventId: query.event }}
      myQrToken={account.qrToken}
    />
  );
}
