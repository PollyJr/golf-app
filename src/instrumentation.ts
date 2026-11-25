/**
 * Runs once when the server process starts (not during the build).
 * Failures here must never keep the app from serving requests.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  const { runStartupMaintenance } = await import("@/server/maintenance");
  void runStartupMaintenance().catch((error: unknown) => {
    console.error("maintenance failed:", error instanceof Error ? error.message : error);
  });
}
