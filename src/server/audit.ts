import "server-only";

import type { Session } from "./auth/session";
import { db, type Db } from "./db";
import { hashClientIp } from "./security";

interface AuditEntry {
  clubId: string | null;
  actor: Pick<Session, "role" | "accountId"> | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  request?: Request;
}

/** Appends to the audit trail. Never stores secrets or raw IP addresses. */
export async function audit(entry: AuditEntry, on: Db = db): Promise<void> {
  await on.query(
    `INSERT INTO audit_log (club_id, actor_role, actor_id, action, entity_type, entity_id, ip_hash, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.clubId,
      entry.actor?.role ?? null,
      entry.actor?.accountId ?? null,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.request ? hashClientIp(entry.request) : null,
      JSON.stringify(entry.metadata ?? {}),
    ],
  );
}
