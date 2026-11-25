import { NextResponse } from "next/server";
import { route } from "@/server/http/route";
import { createClub } from "@/server/services/clubs";
import { newClubSchema } from "@/lib/validation";

export const POST = route({ access: "platform", body: newClubSchema }, async ({ session, body }) =>
  NextResponse.json({ club: await createClub(session, body) }, { status: 201 }),
);
