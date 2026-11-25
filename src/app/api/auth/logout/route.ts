import { NextResponse } from "next/server";
import { clearSessionCookies, destroyCurrentSession } from "@/server/auth/session";
import { route } from "@/server/http/route";

// Public on purpose: signing out must also work with an expired session. The
// same-origin check of the wrapper still applies.
export const POST = route({ access: "public" }, async () => {
  await destroyCurrentSession();
  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
});
