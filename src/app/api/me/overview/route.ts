import { route } from "@/server/http/route";
import { getLocale } from "@/server/i18n";
import { countUnread } from "@/server/services/notifications";
import { listActiveRounds } from "@/server/services/rounds";

/** Everything the app shell keeps live: open rounds, invitations, unread count. */
export const GET = route({ access: "player" }, async ({ session }) => {
  const locale = await getLocale();
  const [rounds, unread] = await Promise.all([
    listActiveRounds(session.clubId, session.accountId, locale),
    countUnread(session.clubId, session.accountId),
  ]);
  return { rounds, unread };
});
