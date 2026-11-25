import { csvResponse } from "@/server/http/csv";
import { route } from "@/server/http/route";
import { listPlayersForStaff } from "@/server/services/players";

export const GET = route({ access: "staff" }, async ({ session }) => {
  const players = await listPlayersForStaff(session.clubId);
  return csvResponse(
    `spelers-${session.club.slug}.csv`,
    ["Naam", "Gebruikersnaam", "Spelerscode", "E-mail", "Status", "Clubindex", "Goedgekeurde rondes", "Laatst ingelogd", "Lid sinds"],
    players.map((player) => [
      player.name,
      player.username,
      player.code,
      player.email,
      player.registrationStatus === "pending" ? "aanvraag" : player.active ? "actief" : "inactief",
      player.clubIndex,
      player.rounds,
      player.lastLoginAt?.slice(0, 10) ?? "",
      player.createdAt.slice(0, 10),
    ]),
  );
});
