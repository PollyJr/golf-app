"use client";

import { useSyncExternalStore } from "react";

const MINUTE = 60_000;

function subscribe(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, MINUTE);
  return () => window.clearInterval(timer);
}

/**
 * The current time, refreshed every minute, for "3 minutes ago" labels.
 * `null` during server rendering and hydration, so the markup always matches.
 */
export function useNow(): Date | null {
  const minute = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / MINUTE),
    () => null,
  );
  return minute === null ? null : new Date(minute * MINUTE);
}
