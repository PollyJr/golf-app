import { z } from "zod";
import { notFound } from "@/server/errors";
import { route } from "@/server/http/route";
import { findPlayerByQrToken } from "@/server/services/players";
import { qrTokenSchema } from "@/lib/validation";

/** The club mate behind a scanned personal QR code. */
export const GET = route({ access: "player", params: z.object({ token: qrTokenSchema }) }, async ({ session, params }) => {
  const player = await findPlayerByQrToken(session.clubId, params.token);
  if (!player) throw notFound("QR_CODE_UNKNOWN");
  return { player, self: player.id === session.accountId };
});
