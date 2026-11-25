import { getSession, verifyMutation } from "@/server/auth/session";
import { forbidden, unauthenticated } from "@/server/errors";
import { errorResponse } from "@/server/http/route";
import { changeOwnPassword } from "@/server/services/staff";
import { passwordChangeSchema } from "@/lib/validation";

/** Any administrator (club or platform) changes their own password. */
export async function PATCH(request: Request): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) throw unauthenticated();
    if (session.role === "player") throw forbidden();
    await verifyMutation(request, session);
    const body = passwordChangeSchema.parse(await request.json());
    await changeOwnPassword(session, body.currentPassword, body.newPassword, request);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
