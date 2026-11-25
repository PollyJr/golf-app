import { idParams, route } from "@/server/http/route";
import { submitRound } from "@/server/services/rounds";

export const POST = route({ access: "player", params: idParams }, async ({ session, params }) => submitRound(session, params.id));
