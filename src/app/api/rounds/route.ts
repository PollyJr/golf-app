import { NextResponse } from "next/server";
import { route } from "@/server/http/route";
import { createRound } from "@/server/services/rounds";
import { createRoundSchema } from "@/lib/validation";

export const POST = route({ access: "player", body: createRoundSchema }, async ({ session, body }) => {
  const id = await createRound(session, body);
  return NextResponse.json({ id }, { status: 201 });
});
