import "server-only";

import { db, many, transaction } from "./db";
import { pruneNotifications } from "./services/notifications";
import { refreshPlayerProgress } from "./services/progress";

/**
 * Housekeeping that runs once when the server starts.
 *
 * Club index and achievements are derived from approved rounds and normally
 * kept up to date when a round is reviewed. Rounds that were approved before
 * those existed (data migrated from version 1) have neither. Every player with
 * an approved round must hold the "first round" achievement, so its absence
 * pinpoints exactly the players whose derived data still has to be built.
 */
export async function runStartupMaintenance(): Promise<void> {
  const stale = await many<{ club_id: string; player_id: string }>(
    `SELECT DISTINCT rp.club_id, rp.player_id
       FROM round_participants rp
       JOIN rounds r ON r.id = rp.round_id AND r.status = 'approved' AND r.completed_at IS NOT NULL
      WHERE rp.player_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM player_achievements a
           WHERE a.player_id = rp.player_id AND a.key = 'first_round'
        )
      LIMIT 2000`,
  );
  for (const { club_id: clubId, player_id: playerId } of stale) {
    // No notifications: nobody should be told about feats from months ago.
    await transaction((tx) => refreshPlayerProgress(tx, clubId, [playerId], false));
  }
  if (stale.length > 0) console.log(`maintenance: rebuilt index and achievements for ${stale.length} player(s).`);

  await pruneNotifications();
  await db.query("DELETE FROM sessions WHERE expires_at <= now()");
}
