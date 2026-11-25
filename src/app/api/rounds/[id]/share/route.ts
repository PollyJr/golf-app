import { z } from "zod";
import { idParams, route } from "@/server/http/route";
import { externalOrigin } from "@/server/security";
import { setSharing } from "@/server/services/rounds";

export const PUT = route(
  { access: "player", params: idParams, body: z.object({ enabled: z.boolean() }) },
  async ({ session, params, body, request }) => {
    const token = await setSharing(session, params.id, body.enabled);
    return { token, url: token ? `${externalOrigin(request)}/live/${token}` : null };
  },
);
