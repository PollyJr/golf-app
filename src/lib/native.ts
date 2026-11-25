/**
 * The bridge the Android app puts in its WebView. In a normal browser it does
 * not exist, so every caller must have a web fallback.
 */
export interface FairwayNativeBridge {
  /** Opens the Android share sheet. */
  share(text: string, url: string): void;
  /** Version name of the installed app, e.g. `2.1.0-debug`. */
  version(): string;
}

declare global {
  interface Window {
    FairwayNative?: FairwayNativeBridge;
  }
}

export function nativeBridge(): FairwayNativeBridge | null {
  return typeof window !== "undefined" && window.FairwayNative ? window.FairwayNative : null;
}

/** The Android app identifies itself in its user agent. */
export function isAndroidApp(userAgent: string | null | undefined): boolean {
  return /\bFairwayAndroid\//.test(userAgent ?? "");
}

export const ANDROID_APK_PATH = "/downloads/fairway-debug.apk";

export const ANDROID_PACKAGE = "club.fairway.app";

/** Where a page is being viewed, for offering the right way to get the app. */
export type DevicePlatform = "app" | "android" | "ios" | "desktop";

export function devicePlatform(userAgent: string | null | undefined): DevicePlatform {
  const agent = userAgent ?? "";
  if (isAndroidApp(agent)) return "app";
  if (/\bAndroid\b/i.test(agent)) return "android";
  // iPadOS presents itself as a Mac, but a touch-capable one ("Mobile").
  if (/\b(iPhone|iPad|iPod)\b/.test(agent) || (/\bMacintosh\b/.test(agent) && /\bMobile\b/.test(agent))) return "ios";
  return "desktop";
}

/**
 * A link that opens `url` in the Android app when it is installed. Without
 * the app, Chrome goes to `fallback` instead. Only for https URLs of the host
 * the app handles (see the intent filter in the Android manifest).
 */
export function androidIntentUrl(url: string, fallback: string): string {
  const target = new URL(url);
  return (
    `intent://${target.host}${target.pathname}${target.search}` +
    `#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(fallback)};end`
  );
}
