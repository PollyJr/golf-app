/**
 * A deliberately small i18n layer: typed, nested message dictionaries with
 * `{placeholder}` interpolation and plural forms. The Dutch dictionary is the
 * source of truth for the key set; every other locale must match its shape.
 */

export const LOCALES = ["nl", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "nl";
export const LOCALE_COOKIE = "fairway_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** BCP 47 tag used for `Intl` formatting. */
export function intlLocale(locale: Locale): string {
  return locale === "nl" ? "nl-NL" : "en-GB";
}

export interface PluralForms {
  one: string;
  other: string;
}

export type MessageTree = { [key: string]: string | PluralForms | MessageTree };

type IsPlural<T> = T extends { one: string; other: string } ? true : false;

/** Dot-separated paths to every message in a dictionary. */
export type MessageKeys<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : IsPlural<T[K]> extends true
      ? K
      : T[K] extends object
        ? `${K}.${MessageKeys<T[K]>}`
        : never;
}[keyof T & string];

/** The same shape as `T`, with any string allowed at the leaves. */
export type MessageShape<T> = {
  [K in keyof T]: T[K] extends string ? string : IsPlural<T[K]> extends true ? PluralForms : MessageShape<T[K]>;
};

export type MessageParams = Record<string, string | number>;

function isPluralForms(value: unknown): value is PluralForms {
  return typeof value === "object" && value !== null && "one" in value && "other" in value;
}

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export type Translate<K extends string = string> = (key: K, params?: MessageParams) => string;

export function createTranslator<T extends MessageTree>(messages: T, locale: Locale): Translate<MessageKeys<T>> {
  const pluralRules = new Intl.PluralRules(intlLocale(locale));
  return (key, params) => {
    let node: unknown = messages;
    for (const part of key.split(".")) {
      if (typeof node !== "object" || node === null) return key;
      node = (node as Record<string, unknown>)[part];
    }
    if (typeof node === "string") return interpolate(node, params);
    if (isPluralForms(node)) {
      const count = typeof params?.count === "number" ? params.count : 0;
      return interpolate(pluralRules.select(count) === "one" ? node.one : node.other, params);
    }
    return key;
  };
}

/** Text stored per language in the database, e.g. `{ "nl": "Baan", "en": "Course" }`. */
export type LocalizedText = Partial<Record<Locale, string>> | null | undefined;

/** Picks the best available translation: requested locale, then Dutch, then anything. */
export function pickText(text: LocalizedText, locale: Locale, fallback = ""): string {
  if (!text) return fallback;
  const direct = text[locale];
  if (direct) return direct;
  for (const candidate of LOCALES) {
    const value = text[candidate];
    if (value) return value;
  }
  return fallback;
}
