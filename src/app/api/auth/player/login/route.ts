import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setSessionCookies } from "@/server/auth/session";
import { route } from "@/server/http/route";
import { signInPlayer } from "@/server/services/auth";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/core";
import { playerLoginSchema } from "@/lib/validation";

const ONE_YEAR = 60 * 60 * 24 * 365;

export const POST = route({ access: "public", body: playerLoginSchema }, async ({ body, request }) => {
  const result = await signInPlayer(body.identifier, body.pin, request);
  const response = NextResponse.json({ redirectTo: result.mustChangeSecret ? "/app/welcome" : "/app" });
  setSessionCookies(response, result.issued);
  // A device without a language choice follows what the player picked before.
  if (!(await cookies()).has(LOCALE_COOKIE) && isLocale(result.preferredLanguage)) {
    response.cookies.set(LOCALE_COOKIE, result.preferredLanguage, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  }
  return response;
});
