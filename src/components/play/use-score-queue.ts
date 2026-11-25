"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, isTransient } from "@/lib/api-client";
import type { RoundSnapshot } from "@/lib/types";

/**
 * Score entry that never blocks on the network.
 *
 * Every tap becomes an *intent* that is shown immediately and sent in the
 * background. Intents survive a reload (localStorage) and a dead connection:
 * they wait in the queue and are sent, in order, as soon as the server can be
 * reached again. The newest intent per player and hole wins.
 */

export interface ScoreIntent {
  participantId: string;
  /** 1-based hole number. */
  hole: number;
  strokes: number | null;
  /** `undefined` leaves the stored putts alone. */
  putts?: number | null;
  seq: number;
}

interface Confirmed {
  intent: ScoreIntent;
  revision: number;
}

const RETRY_MS = 4_000;
const storageKey = (roundId: string) => `fairway:score-queue:${roundId}`;
const keyOf = (intent: Pick<ScoreIntent, "participantId" | "hole">) => `${intent.participantId}:${intent.hole}`;

function loadQueue(roundId: string): Map<string, ScoreIntent> {
  try {
    const raw = window.localStorage.getItem(storageKey(roundId));
    const items = raw ? (JSON.parse(raw) as ScoreIntent[]) : [];
    return new Map(items.map((intent) => [keyOf(intent), intent]));
  } catch {
    return new Map();
  }
}

function saveQueue(roundId: string, queue: Map<string, ScoreIntent>): void {
  try {
    if (queue.size === 0) window.localStorage.removeItem(storageKey(roundId));
    else window.localStorage.setItem(storageKey(roundId), JSON.stringify([...queue.values()]));
  } catch {
    // Private mode or a full disk: the queue still works for this page view.
  }
}

function applyIntent(round: RoundSnapshot, intent: ScoreIntent): RoundSnapshot {
  return {
    ...round,
    participants: round.participants.map((participant) => {
      if (participant.id !== intent.participantId) return participant;
      const scores = [...participant.scores];
      const putts = [...participant.putts];
      scores[intent.hole - 1] = intent.strokes;
      if (intent.strokes === null) putts[intent.hole - 1] = null;
      else if (intent.putts !== undefined) putts[intent.hole - 1] = intent.putts;
      return { ...participant, scores, putts };
    }),
  };
}

export type SyncState = "idle" | "saving" | "waiting";

interface ScoreQueue {
  /** The server snapshot with every local, not yet confirmed change on top. */
  view: RoundSnapshot;
  pendingCount: number;
  sync: SyncState;
  setScore: (change: Omit<ScoreIntent, "seq">) => void;
}

interface Options {
  round: RoundSnapshot;
  refresh: () => Promise<void>;
  /** A change the server refused for good (e.g. the round was finished meanwhile). */
  onRejected: () => void;
}

export function useScoreQueue({ round, refresh, onRejected }: Options): ScoreQueue {
  const roundId = round.id;
  const queue = useRef<Map<string, ScoreIntent>>(new Map());
  const confirmed = useRef<Map<string, Confirmed>>(new Map());
  const sequence = useRef(0);
  const flushing = useRef(false);
  const retryTimer = useRef<number | undefined>(undefined);
  const [version, setVersion] = useState(0);
  const [sync, setSync] = useState<SyncState>("idle");
  const bump = useCallback(() => setVersion((value) => value + 1), []);

  const onRejectedRef = useRef(onRejected);
  const refreshRef = useRef(refresh);
  useEffect(() => {
    onRejectedRef.current = onRejected;
    refreshRef.current = refresh;
  }, [onRejected, refresh]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    window.clearTimeout(retryTimer.current);
    let rejected = false;
    try {
      for (;;) {
        const next = queue.current.values().next().value as ScoreIntent | undefined;
        if (!next) break;
        setSync("saving");
        try {
          const result = await api.put<{ revision: number }>(`/api/rounds/${roundId}/scores`, {
            participantId: next.participantId,
            hole: next.hole,
            strokes: next.strokes,
            ...(next.putts !== undefined ? { putts: next.putts } : {}),
          });
          const key = keyOf(next);
          // Only clear it when the player has not changed their mind meanwhile.
          if (queue.current.get(key)?.seq === next.seq) queue.current.delete(key);
          confirmed.current.set(key, { intent: next, revision: result.revision });
        } catch (error) {
          if (isTransient(error)) {
            setSync("waiting");
            retryTimer.current = window.setTimeout(() => void flush(), RETRY_MS);
            return;
          }
          queue.current.delete(keyOf(next));
          rejected = true;
        }
        saveQueue(roundId, queue.current);
        bump();
      }
      setSync("idle");
    } finally {
      flushing.current = false;
    }
    if (rejected) onRejectedRef.current();
    await refreshRef.current();
  }, [roundId, bump]);

  // Pick up whatever a previous visit could not send.
  useEffect(() => {
    queue.current = loadQueue(roundId);
    sequence.current = Math.max(0, ...[...queue.current.values()].map((intent) => intent.seq));
    if (queue.current.size > 0) {
      bump();
      void flush();
    }
    const online = () => void flush();
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("online", online);
      window.clearTimeout(retryTimer.current);
    };
  }, [roundId, bump, flush]);

  const setScore = useCallback(
    (change: Omit<ScoreIntent, "seq">) => {
      sequence.current += 1;
      const key = keyOf(change);
      const previous = queue.current.get(key);
      // Keep a queued putts value when this change only touches the strokes.
      const putts = change.putts !== undefined ? change.putts : previous?.putts;
      queue.current.delete(key);
      queue.current.set(key, { ...change, putts, seq: sequence.current });
      saveQueue(roundId, queue.current);
      bump();
      void flush();
    },
    [roundId, bump, flush],
  );

  const view = useMemo(() => {
    let next = round;
    // Changes the server has accepted but that are not in this snapshot yet.
    for (const [key, entry] of confirmed.current) {
      if (entry.revision <= round.revision) confirmed.current.delete(key);
      else next = applyIntent(next, entry.intent);
    }
    for (const intent of queue.current.values()) next = applyIntent(next, intent);
    return next;
    // `version` changes whenever the refs above change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, version]);

  return { view, pendingCount: queue.current.size, sync, setScore };
}
