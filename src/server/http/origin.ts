import "server-only";

import { stat } from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";
import { ANDROID_APK_PATH } from "@/lib/native";

/**
 * The address visitors reach this deployment at, e.g. `https://golf.example`,
 * as the proxy in front of the app reports it. Empty when it cannot be told.
 */
export async function publicOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "").split(",")[0].trim();
  if (!host) return "";
  const forwarded = (requestHeaders.get("x-forwarded-proto") || "").split(",")[0].trim();
  const local = /^(localhost|127\.|\[::1\])/.test(host);
  const protocol = forwarded === "http" || forwarded === "https" ? forwarded : local ? "http" : "https";
  return `${protocol}://${host}`;
}

let apkSize: Promise<number | null> | null = null;

/** Size in bytes of the Android app served from `public/`; read once per process. */
export function androidApkSize(): Promise<number | null> {
  apkSize ??= stat(path.join(process.cwd(), "public", ANDROID_APK_PATH))
    .then((file) => file.size)
    .catch(() => null);
  return apkSize;
}
