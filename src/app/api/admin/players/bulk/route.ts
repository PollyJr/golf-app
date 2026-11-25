import { NextResponse } from "next/server";
import { route } from "@/server/http/route";
import { createPlayers } from "@/server/services/players";
import { bulkPlayersSchema } from "@/lib/validation";

/** Onboards a whole list of members at once; returns their one-time PINs. */
export const POST = route({ access: "staff", body: bulkPlayersSchema }, async ({ session, body, request }) => {
  const credentials = await createPlayers(session, body.names.map((displayName) => ({ displayName })), request);
  return NextResponse.json({ credentials }, { status: 201 });
});
