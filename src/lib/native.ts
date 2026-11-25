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
