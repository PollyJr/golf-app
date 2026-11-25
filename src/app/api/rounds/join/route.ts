import { z } from "zod";
import { route } from "@/server/http/route";
import { joinRoundByToken } from "@/server/services/rounds";
import { qrTokenSchema } from "@/lib/validation";

/** Joins the round behind a scanned round QR code. */
export const POST = route({ access: "player", body: z.object({ token: qrTokenSchema }) }, async ({ session, body }) => ({
  id: await joinRoundByToken(session, body.token),
}));
