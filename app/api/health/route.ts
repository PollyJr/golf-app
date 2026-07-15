export const dynamic = "force-dynamic";

export async function GET() {
  let database = "unavailable";
  try {
    const { query } = await import("@/lib/db");
    await query("SELECT 1");
    database = "ok";
  } catch { /* Never expose connection details in health responses. */ }
  return Response.json(
    {
      status: "ok",
      service: "fairway-club-pwa",
      version: process.env.npm_package_version ?? "1.0.0",
      timestamp: new Date().toISOString(),
      database,
    },
    {
      status: database === "ok" ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
