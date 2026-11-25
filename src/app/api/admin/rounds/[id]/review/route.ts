import { idParams, route } from "@/server/http/route";
import { reviewRound } from "@/server/services/rounds";
import { reviewSchema } from "@/lib/validation";

export const POST = route({ access: "staff", params: idParams, body: reviewSchema }, async ({ session, params, body }) => ({
  changed: await reviewRound(session, params.id, body.decision, body.reason),
}));
