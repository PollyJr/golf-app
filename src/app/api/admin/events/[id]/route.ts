import { idParams, route } from "@/server/http/route";
import { deleteEvent, saveEvent } from "@/server/services/events";
import { eventSchema } from "@/lib/validation";

export const PUT = route({ access: "staff", params: idParams, body: eventSchema }, async ({ session, params, body }) => ({
  id: await saveEvent(session, params.id, body),
}));

export const DELETE = route({ access: "staff", params: idParams }, async ({ session, params }) => {
  await deleteEvent(session, params.id);
  return { ok: true };
});
