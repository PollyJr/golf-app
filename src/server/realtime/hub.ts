import "server-only";

import pg from "pg";
import type { Db } from "../db";
import { env } from "../env";

/**
 * Realtime fan-out on top of PostgreSQL LISTEN/NOTIFY.
 *
 * Services call `publish()` inside their transaction; PostgreSQL delivers the
 * notification when it commits. Every app instance keeps one dedicated
 * connection that listens and hands events to its in-memory subscribers (the
 * open Server-Sent Events streams). That keeps realtime correct with more than
 * one replica without any extra infrastructure.
 */

const CHANNEL = "fairway_events";
const RECONNECT_DELAY_MS = 2_000;

export interface RealtimeEvent {
  topic: string;
  /** Free-form hint for the client, e.g. `score`, `status`, `notification`. */
  type: string;
}

type Listener = (event: RealtimeEvent) => void;

export const topics = {
  round: (roundId: string) => `round:${roundId}`,
  player: (playerId: string) => `player:${playerId}`,
  club: (clubId: string) => `club:${clubId}`,
};

class RealtimeHub {
  private readonly listeners = new Map<string, Set<Listener>>();
  private client: pg.Client | null = null;
  private connecting: Promise<void> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  subscribe(topicList: readonly string[], listener: Listener): () => void {
    for (const topic of topicList) {
      const set = this.listeners.get(topic) ?? new Set<Listener>();
      set.add(listener);
      this.listeners.set(topic, set);
    }
    void this.ensureConnected();
    return () => {
      for (const topic of topicList) {
        const set = this.listeners.get(topic);
        if (!set) continue;
        set.delete(listener);
        if (set.size === 0) this.listeners.delete(topic);
      }
    };
  }

  get subscriberCount(): number {
    let count = 0;
    for (const set of this.listeners.values()) count += set.size;
    return count;
  }

  private dispatch(event: RealtimeEvent): void {
    const set = this.listeners.get(event.topic);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        listener(event);
      } catch (error) {
        console.error("realtime listener failed:", error);
      }
    }
  }

  /** After a reconnect we may have missed events: tell everyone to refresh. */
  private resyncAll(): void {
    for (const topic of this.listeners.keys()) this.dispatch({ topic, type: "resync" });
  }

  private ensureConnected(): Promise<void> {
    if (this.client) return Promise.resolve();
    this.connecting ??= this.connect().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async connect(): Promise<void> {
    const client = new pg.Client({
      connectionString: env.databaseUrl,
      ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
      keepAlive: true,
    });
    const drop = (reason: string) => {
      if (this.client !== client) return;
      this.client = null;
      console.warn(`realtime listener disconnected (${reason}); reconnecting`);
      this.scheduleReconnect();
    };
    client.on("notification", (message) => {
      if (message.channel !== CHANNEL || !message.payload) return;
      try {
        const event = JSON.parse(message.payload) as RealtimeEvent;
        if (typeof event.topic === "string") this.dispatch(event);
      } catch {
        // Ignore payloads that are not ours.
      }
    });
    client.on("error", (error) => drop(error.message));
    client.on("end", () => drop("connection ended"));

    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
      this.client = client;
      this.resyncAll();
    } catch (error) {
      console.error("realtime listener could not connect:", error instanceof Error ? error.message : error);
      await client.end().catch(() => {});
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.listeners.size === 0) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.ensureConnected();
    }, RECONNECT_DELAY_MS);
    this.reconnectTimer.unref?.();
  }
}

declare global {
  var fairwayRealtimeHub: RealtimeHub | undefined;
}

export function getHub(): RealtimeHub {
  globalThis.fairwayRealtimeHub ??= new RealtimeHub();
  return globalThis.fairwayRealtimeHub;
}

/**
 * Announces a change. Pass the transaction client so subscribers only hear
 * about it once the change is committed.
 */
export async function publish(on: Db, topicList: readonly string[], type: string): Promise<void> {
  const unique = [...new Set(topicList)];
  if (unique.length === 0) return;
  await on.query(
    `SELECT pg_notify($1, json_build_object('topic', topic, 'type', $3::text)::text)
       FROM unnest($2::text[]) AS topic`,
    [CHANNEL, unique, type],
  );
}
