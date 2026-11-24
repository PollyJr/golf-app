// Applies every SQL file in db/migrations that has not run yet, in name order.
// Safe to run on every deploy: finished migrations are skipped and concurrent
// runs are serialised with an advisory lock.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createScriptPool } from "./lib/connection.mjs";

const MIGRATION_LOCK_ID = 4_210_601;
const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

const pool = createScriptPool();
const client = await pool.connect();

try {
  await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  const applied = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((row) => row.name));
  let count = 0;

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      count += 1;
      console.log(`migrate: applied ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  console.log(count === 0 ? "migrate: database is up to date." : `migrate: applied ${count} migration(s).`);
} finally {
  await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => {});
  client.release();
  await pool.end();
}
