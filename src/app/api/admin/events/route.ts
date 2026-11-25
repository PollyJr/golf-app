import { NextResponse } from "next/server";
import { route } from "@/server/http/route";
import { saveEvent } from "@/server/services/events";
import { eventSchema } from "@/lib/validation";

export const POST = route({ access: "staff", body: eventSchema }, async ({ session, body }) =>
  NextResponse.json({ id: await saveEvent(session, null, body) }, { status: 201 }),
);
