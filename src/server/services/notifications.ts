import "server-only";

import { db, many, one, type Db } from "../db";
import { publish, topics } from "../realtime/hub";
import type { NotificationDto, NotificationKind } from "@/lib/types";

const LIST_LIMIT = 50;

/**
 * Stores a notification for each player and nudges their open streams.
 * `data` holds only display values (names, titles, ids); the text itself is
 * rendered in the reader's language.
 */
export async function notify(
  on: Db,
  clubId: string,
  playerIds: readonly string[],
  kind: NotificationKind,
  data: Record<string, string>,
): Promise<void> {
  const recipients = [...new Set(playerIds)];
  if (recipients.length === 0) return;
  await on.query(
    `INSERT INTO notifications (club_id, player_id, kind, data)
     SELECT $1, player_id, $3, $4::jsonb FROM unnest($2::uuid[]) AS player_id`,
    [clubId, recipients, kind, JSON.stringify(data)],
  );
  await publish(on, recipients.map(topics.player), "notification");
}

/** Notifies every active member of a club, e.g. about a new event. */
export async function notifyClub(
  on: Db,
  clubId: string,
  kind: NotificationKind,
  data: Record<string, string>,
): Promise<void> {
  const members = await many<{ id: string }>(
    "SELECT id FROM players WHERE club_id = $1 AND active AND registration_status = 'approved'",
    [clubId],
    on,
  );
  await notify(on, clubId, members.map((member) => member.id), kind, data);
}

interface NotificationRow {
  id: string;
  kind: NotificationKind;
  data: Record<string, string>;
  read_at: Date | null;
  created_at: Date;
}

export async function listNotifications(clubId: string, playerId: string): Promise<NotificationDto[]> {
  const rows = await many<NotificationRow>(
    `SELECT id, kind, data, read_at, created_at
       FROM notifications
      WHERE club_id = $1 AND player_id = $2
      ORDER BY created_at DESC
      LIMIT ${LIST_LIMIT}`,
    [clubId, playerId],
  );
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    data: row.data ?? {},
    readAt: row.read_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function countUnread(clubId: string, playerId: string): Promise<number> {
  const row = await one<{ count: number }>(
    "SELECT count(*)::int AS count FROM notifications WHERE club_id = $1 AND player_id = $2 AND read_at IS NULL",
    [clubId, playerId],
  );
  return row.count;
}

/** Marks one notification, or all of them when no id is given, as read. */
export async function markRead(clubId: string, playerId: string, notificationId?: string): Promise<void> {
  await db.query(
    `UPDATE notifications SET read_at = now()
      WHERE club_id = $1 AND player_id = $2 AND read_at IS NULL AND ($3::uuid IS NULL OR id = $3)`,
    [clubId, playerId, notificationId ?? null],
  );
  await publish(db, [topics.player(playerId)], "notification");
}

/** Old, read notifications are not worth keeping around. */
export async function pruneNotifications(): Promise<void> {
  await db.query("DELETE FROM notifications WHERE created_at < now() - interval '90 days'");
}
