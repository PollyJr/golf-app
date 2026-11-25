import { z } from "zod";
import { idParams, route } from "@/server/http/route";
import { deleteCourse, saveCourse, setCourseActive } from "@/server/services/courses";
import { courseSchema } from "@/lib/validation";

export const PUT = route({ access: "staff", params: idParams, body: courseSchema }, async ({ session, params, body }) => ({
  id: await saveCourse(session, params.id, body),
}));

/** Archive or restore. */
export const PATCH = route({ access: "staff", params: idParams, body: z.object({ active: z.boolean() }) }, async ({ session, params, body }) => {
  await setCourseActive(session, params.id, body.active);
  return { ok: true };
});

export const DELETE = route({ access: "staff", params: idParams }, async ({ session, params }) => {
  await deleteCourse(session, params.id);
  return { ok: true };
});
