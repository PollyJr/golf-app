import { NextResponse } from "next/server";
import { setSessionCookies } from "@/server/auth/session";
import { route } from "@/server/http/route";
import { registerPlayer } from "@/server/services/players";
import { registrationSchema } from "@/lib/validation";

export const POST = route({ access: "public", body: registrationSchema }, async ({ body, request }) => {
  const result = await registerPlayer(body, request);
  const response = NextResponse.json({ status: result.status, code: result.code, redirectTo: result.issued ? "/app" : null });
  if (result.issued) setSessionCookies(response, result.issued);
  return response;
});
