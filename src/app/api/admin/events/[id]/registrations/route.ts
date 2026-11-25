import { z } from "zod";
import { csvResponse } from "@/server/http/csv";
import { idParams, route } from "@/server/http/route";
import { listEventParticipants, removeEventRegistration } from "@/server/services/events";

/** Participant list as a spreadsheet. */
export const GET = route({ access: "staff", params: idParams }, async ({ session, params }) => {
  const participants = await listEventParticipants(session.clubId, params.id);
  return csvResponse(
    `deelnemers-${params.id.slice(0, 8)}.csv`,
    ["Naam", "Status", "Ingeschreven op"],
    participants.map((participant) => [
      participant.name,
      participant.status === "registered" ? "ingeschreven" : "wachtlijst",
      participant.registeredAt.slice(0, 16).replace("T", " "),
    ]),
  );
});

export const DELETE = route(
  { access: "staff", params: idParams, body: z.object({ playerId: z.uuid() }) },
  async ({ session, params, body }) => {
    await removeEventRegistration(session, params.id, body.playerId);
    return { ok: true };
  },
);
