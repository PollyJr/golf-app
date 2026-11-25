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

/** An intent the server has accepted, with the round revision that contains it. */
interface Confirmed {
  intent: ScoreIntent;
  revision: number;
}

const RETRY_MS = 4_000;
const MAX_CONFIRMED = 40;
const storageKey = (roundId: string) => `fairway:score-queue:${roundId}`;
const keyOf = (intent: Pick<ScoreIntent, "participantId" | "hole">) => `${intent.participantId}:${intent.hole}`;

function loadQueue(roundId: string): ScoreIntent[] {
  try {
    const raw = window.localStorage.getItem(storageKey(roundId));
    const items: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? (items as ScoreIntent[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(roundId: string, queue: readonly ScoreIntent[]): void {
  try {
    if (queue.length === 0) window.localStorage.removeItem(storageKey(roundId));
    else window.localStorage.setItem(storageKey(roundId), JSON.stringify(queue));
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
  const [pending, setPending] = useState<ScoreIntent[]>([]);
  const [confirmed, setConfirmed] = useState<Confirmed[]>([]);
  const [sync, setSync] = useState<SyncState>("idle");

  // The sending loop is asynchronous and must always see the latest queue,
  // so the queue lives in a ref and is mirrored into state for rendering.
  const queue = useRef<ScoreIntent[]>([]);
  const sequence = useRef(0);
  const flushing = useRef(false);
  const retryTimer = useRef<number | undefined>(undefined);
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const onRejectedRef = useRef(onRejected);
  const refreshRef = useRef(refresh);

  const commit = useCallback(
    (next: ScoreIntent[]) => {
      queue.current = next;
      saveQueue(roundId, next);
      setPending(next);
    },
    [roundId],
  );

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    window.clearTimeout(retryTimer.current);
    let rejected = false;
    try {
      for (;;) {
        const next = queue.current[0];
        if (!next) break;
        setSync("saving");
        try {
          const result = await api.put<{ revision: number }>(`/api/rounds/${roundId}/scores`, {
            participantId: next.participantId,
            hole: next.hole,
            strokes: next.strokes,
            ...(next.putts !== undefined ? { putts: next.putts } : {}),
          });
          // Keep showing the value until a snapshot that contains it arrives.
          setConfirmed((current) =>
            [...current.filter((entry) => keyOf(entry.intent) !== keyOf(next)), { intent: next, revision: result.revision }].slice(-MAX_CONFIRMED),
          );
        } catch (error) {
          if (isTransient(error)) {
            setSync("waiting");
            retryTimer.current = window.setTimeout(() => void flushRef.current(), RETRY_MS);
            return;
          }
          rejected = true;
        }
        // If the player changed their mind meanwhile, the newer intent has a
        // different sequence number and stays queued.
        commit(queue.current.filter((intent) => intent.seq !== next.seq));
      }
      setSync("idle");
    } finally {
      flushing.current = false;
    }
    if (rejected) onRejectedRef.current();
    await refreshRef.current();
  }, [roundId, commit]);

  useEffect(() => {
    flushRef.current = flush;
    onRejectedRef.current = onRejected;
    refreshRef.current = refresh;
  }, [flush, onRejected, refresh]);

  // Pick up whatever a previous visit could not send, and retry when the
  // device comes back online.
  useEffect(() => {
    const stored = loadQueue(roundId);
    if (stored.length > 0) {
      sequence.current = Math.max(...stored.map((intent) => intent.seq));
      void Promise.resolve().then(() => {
        commit(stored);
        return flushRef.current();
      });
    }
    const online = () => void flushRef.current();
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("online", online);
      window.clearTimeout(retryTimer.current);
    };
  }, [roundId, commit]);

  const setScore = useCallback(
    (change: Omit<ScoreIntent, "seq">) => {
      sequence.current += 1;
      const key = keyOf(change);
      const previous = queue.current.find((intent) => keyOf(intent) === key);
      // Keep a queued putts value when this change only touches the strokes.
      const putts = change.putts !== undefined ? change.putts : previous?.putts;
      commit([...queue.current.filter((intent) => keyOf(intent) !== key), { ...change, putts, seq: sequence.current }]);
      void flushRef.current();
    },
    [commit],
  );

  const view = useMemo(() => {
    let next = round;
    for (const entry of confirmed) {
      if (entry.revision > round.revision) next = applyIntent(next, entry.intent);
    }
    for (const intent of pending) next = applyIntent(next, intent);
    return next;
  }, [round, confirmed, pending]);

  return { view, pendingCount: pending.length, sync, setScore };
}
