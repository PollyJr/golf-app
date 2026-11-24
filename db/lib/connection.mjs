// Connection helper for the database scripts (migrate, bootstrap, seed).
import pg from "pg";

/** @returns {pg.Pool} */
export function createScriptPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }
  return new pg.Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 2,
    connectionTimeoutMillis: 20_000,
  });
}

/** @param {string} value */
export function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** @param {string} displayName */
export function initialsOf(displayName) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * @param {string} displayName
 * @param {string} suffix
 */
export function usernameFor(displayName, suffix) {
  const base =
    displayName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 22) || "speler";
  const tail = suffix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-4).padStart(4, "0");
  return `${base}-${tail}`;
}
