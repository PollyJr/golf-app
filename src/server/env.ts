import "server-only";

/**
 * Environment access, validated lazily: `next build` must be able to import
 * server modules without a database or secrets being configured.
 */

const MIN_SECRET_LENGTH = 32;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export const env = {
  get databaseUrl(): string {
    return required("DATABASE_URL");
  },
  get databaseSsl(): boolean {
    return process.env.DATABASE_SSL === "true";
  },
  get sessionSecret(): string {
    const value = required("SESSION_SECRET");
    if (value.length < MIN_SECRET_LENGTH) {
      throw new Error(`SESSION_SECRET must contain at least ${MIN_SECRET_LENGTH} characters`);
    }
    return value;
  },
  get ipHashSecret(): string {
    return process.env.IP_HASH_SECRET || this.sessionSecret;
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
  get version(): string {
    return process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) || process.env.npm_package_version || "dev";
  },
};
