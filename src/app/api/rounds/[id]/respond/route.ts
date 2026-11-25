import { idParams, route } from "@/server/http/route";
import { respondToInvitation } from "@/server/services/rounds";
import { invitationResponseSchema } from "@/lib/validation";

export const POST = route({ access: "player", params: idParams, body: invitationResponseSchema }, async ({ session, params, body }) => {
  await respondToInvitation(session, params.id, body.decision);
  return { ok: true };
});
