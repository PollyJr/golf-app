import { idParams, route } from "@/server/http/route";
import { setClubStatus } from "@/server/services/clubs";
import { clubStatusSchema } from "@/lib/validation";

export const PATCH = route({ access: "platform", params: idParams, body: clubStatusSchema }, async ({ session, params, body }) => {
  await setClubStatus(session, params.id, body.status);
  return { ok: true };
});
