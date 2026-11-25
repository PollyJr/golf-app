import { idParams, route } from "@/server/http/route";
import { applyStaffAction } from "@/server/services/staff";
import { staffActionSchema } from "@/lib/validation";

export const PATCH = route({ access: "owner", params: idParams, body: staffActionSchema }, async ({ session, params, body }) => ({
  credentials: await applyStaffAction(session, params.id, body),
}));
