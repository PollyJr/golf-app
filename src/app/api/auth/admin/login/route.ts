import { NextResponse } from "next/server";
import { homeForRole, setSessionCookies } from "@/server/auth/session";
import { route } from "@/server/http/route";
import { signInAdmin } from "@/server/services/auth";
import { adminLoginSchema } from "@/lib/validation";

export const POST = route({ access: "public", body: adminLoginSchema }, async ({ body, request }) => {
  const result = await signInAdmin(body.email, body.password, request);
  const home = homeForRole(result.role);
  const response = NextResponse.json({ redirectTo: result.mustChangeSecret ? "/admin/account?welcome=1" : home });
  setSessionCookies(response, result.issued);
  return response;
});
