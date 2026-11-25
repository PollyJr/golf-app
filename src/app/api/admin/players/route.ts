import { NextResponse } from "next/server";
import { route } from "@/server/http/route";
import { createPlayers } from "@/server/services/players";
import { newPlayerSchema } from "@/lib/validation";

export const POST = route({ access: "staff", body: newPlayerSchema }, async ({ session, body, request }) => {
  const [credentials] = await createPlayers(session, [body], request);
  return NextResponse.json({ credentials }, { status: 201 });
});
