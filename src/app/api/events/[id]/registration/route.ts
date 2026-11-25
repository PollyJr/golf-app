import { idParams, route } from "@/server/http/route";
import { cancelEventRegistration, registerForEvent } from "@/server/services/events";

export const POST = route({ access: "player", params: idParams }, async ({ session, params }) => ({
  status: await registerForEvent(session, params.id),
}));

export const DELETE = route({ access: "player", params: idParams }, async ({ session, params }) => {
  await cancelEventRegistration(session, params.id);
  return { ok: true };
});
