import { notFound } from "@/server/errors";
import { route, tokenParams } from "@/server/http/route";
import { topics } from "@/server/realtime/hub";
import { eventStream } from "@/server/realtime/sse";
import { getSharedRoundRef } from "@/server/services/rounds";

export const dynamic = "force-dynamic";

export const GET = route({ access: "public", params: tokenParams }, async ({ params, request }) => {
  const round = await getSharedRoundRef(params.token);
  if (!round) throw notFound("LINK_NOT_FOUND");
  return eventStream(request, [topics.round(round.id)]);
});
