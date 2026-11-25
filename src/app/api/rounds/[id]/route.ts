import { notFound } from "@/server/errors";
import { conditionalJson, idParams, route } from "@/server/http/route";
import { getLocale } from "@/server/i18n";
import { cancelRound, getRoundForPlayer } from "@/server/services/rounds";

export const GET = route({ access: "player", params: idParams }, async ({ session, params, request }) => {
  const round = await getRoundForPlayer(session.clubId, session.accountId, params.id, await getLocale());
  if (!round) throw notFound("ROUND_NOT_FOUND");
  return conditionalJson(request, round.revision, { round });
});

/** The starter calls the round off. */
export const DELETE = route({ access: "player", params: idParams }, async ({ session, params }) => {
  await cancelRound(session, params.id);
  return { ok: true };
});
