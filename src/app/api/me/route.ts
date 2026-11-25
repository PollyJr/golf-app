import { forbidden } from "@/server/errors";
import { route } from "@/server/http/route";
import { changeEmail, changePin, changeUsername, setPreferredLanguage } from "@/server/services/players";
import { profileSchema } from "@/lib/validation";

/** With a one-time PIN, only the PIN itself and the sign-in e-mail can be set. */
const ALLOWED_BEFORE_SECRET_CHANGE = new Set(["pin", "email"]);

export const PATCH = route({ access: "player", body: profileSchema, allowBeforeSecretChange: true }, async ({ body, session, request }) => {
  if (session.user.mustChangeSecret && !ALLOWED_BEFORE_SECRET_CHANGE.has(body.action)) throw forbidden("SECRET_CHANGE_REQUIRED");
  switch (body.action) {
    case "username":
      return { username: await changeUsername(session, body.username, request) };
    case "pin":
      await changePin(session, body.currentPin, body.newPin, request);
      return { ok: true };
    case "email":
      return { email: await changeEmail(session, body.email, request) };
    case "language":
      await setPreferredLanguage(session, body.language);
      return { ok: true };
  }
});
