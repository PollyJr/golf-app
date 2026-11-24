// Password and PIN hashing, shared by the app (imported from TypeScript) and
// by the plain-Node database scripts. Keep this file dependency-free.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const MAX_COST = 2 ** 17;

/**
 * @param {string} value
 * @param {string} salt
 * @param {number} keyLength
 * @param {{ N: number, r: number, p: number }} options
 * @returns {Promise<Buffer>}
 */
function derive(value, salt, keyLength, options) {
  return new Promise((resolve, reject) => {
    scrypt(value, salt, keyLength, { ...options, maxmem: 128 * options.N * options.r * 2 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/**
 * Hash a secret with scrypt. Output: `scrypt$N$r$p$salt$hash`.
 * @param {string} value
 * @returns {Promise<string>}
 */
export async function hashSecret(value) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(value, salt, KEY_LENGTH, { N: COST, r: BLOCK_SIZE, p: PARALLELIZATION });
  return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLELIZATION}$${salt}$${key.toString("hex")}`;
}

/**
 * Constant-time verification of a secret against a stored hash.
 * @param {string} value
 * @param {string | null | undefined} encoded
 * @returns {Promise<boolean>}
 */
export async function verifySecret(value, encoded) {
  if (!encoded) return false;
  const [algorithm, n, r, p, salt, expectedHex] = encoded.split("$");
  const options = { N: Number(n), r: Number(r), p: Number(p) };
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  if (!Number.isInteger(options.N) || options.N < 2 || options.N > MAX_COST) return false;
  if (!Number.isInteger(options.r) || !Number.isInteger(options.p)) return false;
  try {
    const expected = Buffer.from(expectedHex, "hex");
    const actual = await derive(value, salt, expected.length, options);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/**
 * A hash nobody knows the secret for. Verifying against it costs the same as
 * a real verification, which hides whether an account exists.
 */
export const DUMMY_HASH =
  "scrypt$16384$8$1$00000000000000000000000000000000$" + "0".repeat(128);
