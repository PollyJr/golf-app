import { OverviewProvider } from "@/components/shell/overview";
import { PlayerShell } from "@/components/shell/player-shell";
import { requirePlayer } from "@/server/auth/guards";
import { getLocale } from "@/server/i18n";
import { countUnread } from "@/server/services/notifications";
import { listActiveRounds } from "@/server/services/rounds";

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  // The welcome page lives inside this layout and must stay reachable.
  const session = await requirePlayer({ allowPinChange: true });
  const locale = await getLocale();
  const [rounds, unread] = await Promise.all([
    listActiveRounds(session.clubId, session.accountId, locale),
    countUnread(session.clubId, session.accountId),
  ]);

  return (
    <OverviewProvider initial={{ rounds, unread }}>
      <PlayerShell
        user={{ name: session.user.displayName, initials: session.user.initials, code: session.user.code ?? "" }}
        clubName={session.club.name}
      >
        {children}
      </PlayerShell>
    </OverviewProvider>
  );
}
