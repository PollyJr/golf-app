import "server-only";

import { createHash, randomBytes, randomInt } from "node:crypto";
import { AppError } from "./errors";
import { env } from "./env";

export { DUMMY_HASH, hashSecret, verifySecret } from "@db/lib/secret-hash.mjs";

/** URL-safe random token with 256 bits of entropy by default. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// No 0/O, 1/I/L: these codes are read from a screen and typed on a phone.
const FRIENDLY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Random code that is easy to read aloud and type, e.g. `K7M2QX`. */
export function friendlyCode(length: number): string {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += FRIENDLY_ALPHABET[randomInt(FRIENDLY_ALPHABET.length)];
  }
  return code;
}

export function randomPin(length = 6): string {
  let pin = "";
  for (let index = 0; index < length; index += 1) pin += String(randomInt(10));
  return pin;
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Keyed hash of the client address: enough to rate-limit, useless to identify. */
export function hashClientIp(request: Request): string {
  return sha256(`${env.ipHashSecret}:${clientIp(request)}`);
}

export function hashIdentifier(identifier: string): string {
  return sha256(`${env.sessionSecret}:${identifier.toLowerCase()}`);
}

/** The origin the browser used, as seen through Railway's proxy. */
export function externalOrigin(request: Request): string {
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host"))?.split(",")[0]?.trim();
  const protocol = (request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", ""))
    .split(",")[0]
    ?.trim();
  if (!host || !protocol || !["http", "https"].includes(protocol)) {
    throw new AppError("INVALID_ORIGIN", 403);
  }
  return `${protocol}://${host}`;
}

/** Rejects state-changing requests that do not come from our own pages. */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) throw new AppError("ORIGIN_REQUIRED", 403);
  if (origin !== externalOrigin(request)) throw new AppError("INVALID_ORIGIN", 403);
}
