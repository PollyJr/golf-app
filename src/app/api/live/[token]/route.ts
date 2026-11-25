import { notFound } from "@/server/errors";
import { conditionalJson, route, tokenParams } from "@/server/http/route";
import { getLocale } from "@/server/i18n";
import { getSharedRound } from "@/server/services/rounds";

/** Public, read-only snapshot behind a share link. */
export const GET = route({ access: "public", params: tokenParams }, async ({ params, request }) => {
  const round = await getSharedRound(params.token, await getLocale());
  if (!round) throw notFound("LINK_NOT_FOUND");
  return conditionalJson(request, round.revision, { round });
});
