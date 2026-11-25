import { NextResponse } from "next/server";
import { route } from "@/server/http/route";
import { createStaff } from "@/server/services/staff";
import { newStaffSchema } from "@/lib/validation";

export const POST = route({ access: "owner", body: newStaffSchema }, async ({ session, body }) =>
  NextResponse.json({ credentials: await createStaff(session, body) }, { status: 201 }),
);
