import type { CSSProperties } from "react";
import { clubThemeStyle, relativeLuminance } from "@/lib/theme";

/**
 * The clubhouse board always uses a dark, high-contrast look, whatever theme
 * the visitor prefers: it hangs on a wall and is read from across the room.
 *
 * The ground is the club's own colour, darkened until light text is readable
 * on it; the accent is lightened when a club picked a dark one. All semantic
 * tokens are then re-pointed at dark values for everything inside the board.
 */
export function boardThemeStyle(club: { primaryColor: string; accentColor: string }): CSSProperties {
  const brandLuminance = relativeLuminance(club.primaryColor);
  // How much of the brand colour survives in the ground: plenty for dark
  // brands, little for bright ones.
  const share = brandLuminance < 0.05 ? 84 : brandLuminance < 0.15 ? 60 : brandLuminance < 0.4 ? 36 : 20;
  const accent =
    relativeLuminance(club.accentColor) < 0.3 ? `color-mix(in oklab, ${club.accentColor} 45%, white)` : club.accentColor;

  return {
    ...clubThemeStyle(club),
    colorScheme: "dark",
    "--board-ground": `color-mix(in oklab, ${club.primaryColor} ${share}%, #020403)`,
    "--board-accent": accent,
    "--paper": "var(--board-ground)",
    "--surface": "color-mix(in oklab, var(--board-ground) 88%, white)",
    "--well": "color-mix(in oklab, var(--board-ground) 93%, white)",
    "--ink": "#f3f6ee",
    "--ink-2": "#c2cdc4",
    "--ink-3": "#93a198",
    "--line": "rgb(255 255 255 / 0.1)",
    "--line-strong": "rgb(255 255 255 / 0.2)",
    "--brand-fg": "var(--board-accent)",
    "--under": "#7fe3ac",
    "--under-soft": "rgb(127 227 172 / 0.14)",
    "--over": "#f7ad93",
    "--over-soft": "rgb(247 173 147 / 0.14)",
    "--gold": "#f2cd70",
    "--gold-soft": "rgb(242 205 112 / 0.16)",
  } as CSSProperties;
}
