import { notFound } from "@/server/errors";
import { route, tokenParams } from "@/server/http/route";
import { topics } from "@/server/realtime/hub";
import { eventStream } from "@/server/realtime/sse";
import { getClubByBoardToken } from "@/server/services/clubs";

export const dynamic = "force-dynamic";

export const GET = route({ access: "public", params: tokenParams }, async ({ params, request }) => {
  const club = await getClubByBoardToken(params.token);
  if (!club) throw notFound("BOARD_NOT_FOUND");
  return eventStream(request, [topics.club(club.id)]);
});
