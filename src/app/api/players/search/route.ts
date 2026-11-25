import { z } from "zod";
import { route } from "@/server/http/route";
import { searchPlayers } from "@/server/services/players";

export const GET = route({ access: "player", query: z.object({ q: z.string().trim().max(40).default("") }) }, async ({ session, query }) => ({
  players: await searchPlayers(session.clubId, session.accountId, query.q),
}));
