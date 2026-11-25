import { idParams, route } from "@/server/http/route";
import { deleteRoundAsStaff } from "@/server/services/rounds";

export const DELETE = route({ access: "staff", params: idParams }, async ({ session, params }) => {
  await deleteRoundAsStaff(session, params.id);
  return { ok: true };
});
