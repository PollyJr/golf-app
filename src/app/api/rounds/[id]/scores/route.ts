import { idParams, route } from "@/server/http/route";
import { setScore } from "@/server/services/rounds";
import { scoreSchema } from "@/lib/validation";

export const PUT = route({ access: "player", params: idParams, body: scoreSchema }, async ({ session, params, body }) =>
  setScore(session, params.id, body),
);
