import "server-only";

import pg, { type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { env } from "./env";

// bigint and numeric arrive as strings by default. The values stored here
// (revisions, counts, one-decimal indexes) are far inside the safe range.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number(value));

declare global {
  var fairwayPool: pg.Pool | undefined;
}

function createPool(): pg.Pool {
  const pool = new pg.Pool({
    connectionString: env.databaseUrl,
    ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });
  // An idle client losing its connection must not crash the process.
  pool.on("error", (error) => console.error("database pool error:", error.message));
  return pool;
}

export function getPool(): pg.Pool {
  globalThis.fairwayPool ??= createPool();
  return globalThis.fairwayPool;
}

/** Anything that can run a query: the pool, or a client inside a transaction. */
export interface Db {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
}

export const db: Db = {
  query: (text, values) => getPool().query(text, values),
};

export async function many<T extends QueryResultRow>(text: string, values?: unknown[], on: Db = db): Promise<T[]> {
  return (await on.query<T>(text, values)).rows;
}

export async function maybeOne<T extends QueryResultRow>(text: string, values?: unknown[], on: Db = db): Promise<T | null> {
  return (await on.query<T>(text, values)).rows[0] ?? null;
}

export async function one<T extends QueryResultRow>(text: string, values?: unknown[], on: Db = db): Promise<T> {
  const row = await maybeOne<T>(text, values, on);
  if (!row) throw new Error("Expected a row, but the query returned none");
  return row;
}

/** Runs `work` in a transaction: commit when it resolves, roll back when it throws. */
export async function transaction<T>(work: (tx: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
