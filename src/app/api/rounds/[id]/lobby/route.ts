import { idParams, route } from "@/server/http/route";
import { addParticipantByQr, leaveRound, removeParticipant, startRoundNow } from "@/server/services/rounds";
import { lobbyActionSchema } from "@/lib/validation";

export const POST = route({ access: "player", params: idParams, body: lobbyActionSchema }, async ({ session, params, body }) => {
  switch (body.action) {
    case "add-by-qr":
      return addParticipantByQr(session, params.id, body.qrToken);
    case "remove":
      await removeParticipant(session, params.id, body.participantId);
      break;
    case "start":
      await startRoundNow(session, params.id);
      break;
    case "leave":
      await leaveRound(session, params.id);
      break;
  }
  return { ok: true };
});
