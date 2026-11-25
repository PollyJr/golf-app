import { forbidden } from "@/server/errors";
import { route } from "@/server/http/route";
import { changePin, changeUsername, setPreferredLanguage } from "@/server/services/players";
import { profileSchema } from "@/lib/validation";

// Reachable with a one-time PIN, but only to replace it.
export const PATCH = route({ access: "player", body: profileSchema, allowBeforeSecretChange: true }, async ({ body, session, request }) => {
  if (session.user.mustChangeSecret && body.action !== "pin") throw forbidden("SECRET_CHANGE_REQUIRED");
  switch (body.action) {
    case "username":
      return { username: await changeUsername(session, body.username, request) };
    case "pin":
      await changePin(session, body.currentPin, body.newPin, request);
      return { ok: true };
    case "language":
      await setPreferredLanguage(session, body.language);
      return { ok: true };
  }
});
