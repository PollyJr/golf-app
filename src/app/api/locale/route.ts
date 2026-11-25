import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/server/http/route";
import { setPreferredLanguage } from "@/server/services/players";
import { LOCALE_COOKIE } from "@/lib/i18n/core";
import { localeSchema } from "@/lib/validation";
import type { ClubSession } from "@/server/auth/session";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Switches the interface language; remembered for signed-in players. */
export const POST = route({ access: "public", body: z.object({ locale: localeSchema }) }, async ({ body, session }) => {
  if (session?.role === "player" && session.clubId && session.club) {
    await setPreferredLanguage(session as ClubSession, body.locale);
  }
  const response = NextResponse.json({ locale: body.locale });
  response.cookies.set(LOCALE_COOKIE, body.locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  return response;
});
