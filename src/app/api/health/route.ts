import { db } from "@/server/db";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

/** Liveness and database check for Railway. Never exposes connection details. */
export async function GET(): Promise<Response> {
  let database: "ok" | "unavailable" = "unavailable";
  try {
    await db.query("SELECT 1");
    database = "ok";
  } catch {
    // Reported through the status code below.
  }
  return Response.json(
    { status: database === "ok" ? "ok" : "degraded", service: "fairway-club", version: env.version, database, time: new Date().toISOString() },
    { status: database === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
