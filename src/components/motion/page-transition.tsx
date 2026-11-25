import { ViewTransition, type ReactNode } from "react";

/**
 * The navigation types links can carry (Next.js `transitionTypes`), and the
 * animation each one plays; the keyframes are in globals.css.
 *
 * - `nav-forward`: deeper into the app, e.g. from a list to a detail page.
 * - `nav-back`:    back up, e.g. the "← back" link of a detail page.
 * - `nav-tab`:     sideways between the sections of the tab bar.
 *
 * Anything else, such as `router.refresh()` or a live update, does not animate.
 */
export const NAV_FORWARD = ["nav-forward"];
export const NAV_BACK = ["nav-back"];
export const NAV_TAB = ["nav-tab"];

const BY_TYPE = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  "nav-tab": "nav-tab",
  default: "none",
} as const;

/** Wraps the page area of a layout: the part that changes when you navigate. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={BY_TYPE} exit={BY_TYPE} update={BY_TYPE} default="none">
      {children}
    </ViewTransition>
  );
}
