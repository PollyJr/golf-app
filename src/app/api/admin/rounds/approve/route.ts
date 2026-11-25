import { route } from "@/server/http/route";
import { approveRounds } from "@/server/services/rounds";
import { bulkApproveSchema } from "@/lib/validation";

export const POST = route({ access: "staff", body: bulkApproveSchema }, async ({ session, body }) => ({
  approved: await approveRounds(session, body.roundIds),
}));
