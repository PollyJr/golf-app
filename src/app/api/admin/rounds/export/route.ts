import { csvResponse } from "@/server/http/csv";
import { route } from "@/server/http/route";
import { getLocale } from "@/server/i18n";
import { listRoundsForStaff } from "@/server/services/rounds";

export const GET = route({ access: "staff" }, async ({ session }) => {
  const rounds = await listRoundsForStaff(session.clubId, await getLocale(), { limit: 5000 });
  return csvResponse(
    `rondes-${session.club.slug}.csv`,
    ["Datum", "Status", "Baan", "Holes", "Spelvorm", "Speler", "Gast", "Slagen", "Par", "Tov par", "Event"],
    rounds.flatMap((round) =>
      round.participants.map((participant) => [
        (round.completedAt ?? round.createdAt).slice(0, 10),
        round.status,
        round.courseName,
        round.holeCount,
        round.format,
        participant.name,
        participant.guest ? "ja" : "nee",
        participant.strokes,
        participant.par,
        participant.strokes - participant.par,
        round.eventTitle,
      ]),
    ),
  );
});
