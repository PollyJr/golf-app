import { route } from "@/server/http/route";
import { topics } from "@/server/realtime/hub";
import { eventStream } from "@/server/realtime/sse";

export const dynamic = "force-dynamic";

export const GET = route({ access: "player" }, async ({ session, request }) =>
  eventStream(request, [topics.player(session.accountId)]),
);
