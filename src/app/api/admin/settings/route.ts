import { route } from "@/server/http/route";
import { regenerateBoardToken, regenerateJoinCode, updateClubSettings } from "@/server/services/clubs";
import { settingsActionSchema } from "@/lib/validation";

/** Club settings are the owner's responsibility. */
export const POST = route({ access: "owner", body: settingsActionSchema }, async ({ session, body }) => {
  switch (body.action) {
    case "update":
      await updateClubSettings(session, body.settings);
      return { ok: true };
    case "regenerate-join-code":
      return { joinCode: await regenerateJoinCode(session) };
    case "regenerate-board-token":
      return { boardToken: await regenerateBoardToken(session) };
  }
});
