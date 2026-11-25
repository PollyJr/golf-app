import { notFound } from "@/server/errors";
import { idParams, route } from "@/server/http/route";
import { topics } from "@/server/realtime/hub";
import { eventStream } from "@/server/realtime/sse";
import { canFollowRound } from "@/server/services/rounds";

export const dynamic = "force-dynamic";

export const GET = route({ access: "player", params: idParams }, async ({ session, params, request }) => {
  if (!(await canFollowRound(session.clubId, session.accountId, params.id))) throw notFound("ROUND_NOT_FOUND");
  return eventStream(request, [topics.round(params.id)]);
});
