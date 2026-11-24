import { execFileSync } from "node:child_process";
import pg from "pg";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://fairway:fairway@127.0.0.1:5432/fairway_test";

/** Starts every test run from an empty, fully migrated database. */
export default async function setup(): Promise<void> {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `The integration tests need PostgreSQL at ${TEST_DATABASE_URL} (set TEST_DATABASE_URL to change it): ${String(error)}`,
    );
  }
  await client.query("DROP SCHEMA IF EXISTS public CASCADE");
  await client.query("CREATE SCHEMA public");
  await client.end();
  execFileSync(process.execPath, ["db/migrate.mjs"], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DATABASE_SSL: "false" },
    stdio: "pipe",
  });
}
