import { route } from "@/server/http/route";
import { changePin, changeUsername, setPreferredLanguage } from "@/server/services/players";
import { profileSchema } from "@/lib/validation";

export const PATCH = route({ access: "player", body: profileSchema }, async ({ body, session, request }) => {
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
