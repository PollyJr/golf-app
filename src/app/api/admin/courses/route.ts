import { NextResponse } from "next/server";
import { route } from "@/server/http/route";
import { saveCourse } from "@/server/services/courses";
import { courseSchema } from "@/lib/validation";

export const POST = route({ access: "staff", body: courseSchema }, async ({ session, body }) =>
  NextResponse.json({ id: await saveCourse(session, null, body) }, { status: 201 }),
);
