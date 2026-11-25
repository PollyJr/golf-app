import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { createTranslator, DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/core";
import { dictionaries, type AppTranslate } from "@/lib/i18n/dictionaries";

/** The visitor's language: their explicit choice, otherwise Dutch. */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

export const getT = cache(async (): Promise<{ locale: Locale; t: AppTranslate }> => {
  const locale = await getLocale();
  return { locale, t: createTranslator(dictionaries[locale], locale) };
});
