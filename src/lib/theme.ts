import type { CSSProperties } from "react";

/**
 * Club theming. A club picks two colours; everything else is derived so text
 * stays readable on them whatever they chose.
 */

const DARK_INK = "#10291d";
const LIGHT_INK = "#f7f9f2";

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a `#rrggbb` colour. */
export function relativeLuminance(hex: string): number {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!match) return 0;
  const [red, green, blue] = [match[1], match[2], match[3]].map((part) => channel(parseInt(part, 16)));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** Dark or light text, whichever contrasts better with the background. */
export function readableInk(background: string): string {
  const luminance = relativeLuminance(background);
  const contrastWithDark = (luminance + 0.05) / (relativeLuminance(DARK_INK) + 0.05);
  const contrastWithLight = (relativeLuminance(LIGHT_INK) + 0.05) / (luminance + 0.05);
  return contrastWithDark >= contrastWithLight ? DARK_INK : LIGHT_INK;
}

export const DEFAULT_BRAND = "#0f3b2a";
export const DEFAULT_ACCENT = "#c9f04b";

export function clubThemeStyle(colors: { primaryColor: string; accentColor: string } | null | undefined): CSSProperties {
  const brand = colors?.primaryColor || DEFAULT_BRAND;
  const accent = colors?.accentColor || DEFAULT_ACCENT;
  return {
    "--brand": brand,
    "--brand-ink": readableInk(brand),
    "--accent": accent,
    "--accent-ink": readableInk(accent),
  } as CSSProperties;
}

export const THEME_COOKIE = "fairway_theme";
export type ThemeChoice = "system" | "light" | "dark";

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "system" || value === "light" || value === "dark";
}

const AVATAR_HUES = [152, 28, 205, 262, 338, 96, 12, 180];

/** A stable, pleasant colour per person, derived from their name. */
export function avatarHue(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  return AVATAR_HUES[hash % AVATAR_HUES.length];
}
