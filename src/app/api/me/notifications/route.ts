import { z } from "zod";
import { route } from "@/server/http/route";
import { listNotifications, markRead } from "@/server/services/notifications";

export const GET = route({ access: "player" }, async ({ session }) => ({
  notifications: await listNotifications(session.clubId, session.accountId),
}));

/** Marks one notification as read, or all of them without an id. */
export const POST = route({ access: "player", body: z.object({ id: z.uuid().optional() }) }, async ({ session, body }) => {
  await markRead(session.clubId, session.accountId, body.id);
  return { ok: true };
});
