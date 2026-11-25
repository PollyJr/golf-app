import { idParams, route } from "@/server/http/route";
import { decideRegistration, resetPlayerPin, setPlayerActive, updatePlayer } from "@/server/services/players";
import { playerActionSchema } from "@/lib/validation";

export const PATCH = route({ access: "staff", params: idParams, body: playerActionSchema }, async ({ session, params, body }) => {
  switch (body.action) {
    case "update":
      await updatePlayer(session, params.id, { displayName: body.displayName, email: body.email });
      return { ok: true };
    case "activate":
      await setPlayerActive(session, params.id, true);
      return { ok: true };
    case "deactivate":
      await setPlayerActive(session, params.id, false);
      return { ok: true };
    case "reset-pin":
      return { credentials: await resetPlayerPin(session, params.id) };
    case "approve":
      await decideRegistration(session, params.id, true);
      return { ok: true };
    case "reject":
      await decideRegistration(session, params.id, false);
      return { ok: true };
  }
});
