import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export async function hashSecret(value: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(value, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt}$${derived.toString("hex")}`;
}

export async function verifySecret(value: string, encoded: string) {
  const [algorithm, n, r, p, salt, expectedHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  try {
    const expected = Buffer.from(expectedHex, "hex");
    const derived = scryptSync(value, salt, expected.length, { N: Number(n), r: Number(r), p: Number(p) });
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch { return false; }
}

export function randomToken(bytes = 32) { return randomBytes(bytes).toString("base64url"); }
export function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function clientIp(request: Request) { return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"; }
export function hashClientIp(request: Request) { const secret = process.env.IP_HASH_SECRET || process.env.SESSION_SECRET; return secret ? sha256(`${secret}:${clientIp(request)}`) : null; }

export function externalOrigin(request: Request) {
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host"))?.split(",")[0]?.trim();
  const protocol = (request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "")).split(",")[0]?.trim();
  if (!host || !protocol || !["http", "https"].includes(protocol)) throw new SecurityError("INVALID_ORIGIN", 403);
  return `${protocol}://${host}`;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) throw new SecurityError("ORIGIN_REQUIRED", 403);
  if (origin !== externalOrigin(request)) throw new SecurityError("INVALID_ORIGIN", 403);
}

export class SecurityError extends Error { constructor(public code: string, public status = 401) { super(code); } }
