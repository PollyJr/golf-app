"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api-client";

/**
 * Keeps a server resource fresh.
 *
 * A Server-Sent Events stream tells us *that* something changed; we then
 * refetch the resource with a conditional GET. If the stream cannot be kept
 * open (corporate proxy, flaky mobile network) we quietly fall back to polling.
 * Either way the data also refreshes when the tab regains focus or the device
 * comes back online.
 */

const SAFETY_POLL_MS = 30_000;
const FALLBACK_POLL_MS = 4_000;
const STREAM_FAILURES_BEFORE_FALLBACK = 3;

export type Connection = "live" | "polling" | "offline";

interface Options<T> {
  /** Where to fetch the resource; `null` pauses everything. */
  url: string | null;
  /** SSE endpoint that announces changes. Optional: without it we only poll. */
  streamUrl?: string | null;
  initial: T;
  /** Called when the server says the resource is gone (404). */
  onGone?: () => void;
}

interface LiveResource<T> {
  data: T;
  connection: Connection;
  /** Replace the data locally, e.g. for an optimistic update. */
  mutate: (next: T | ((current: T) => T)) => void;
  refresh: () => Promise<void>;
}

export function useLiveResource<T>({ url, streamUrl, initial, onGone }: Options<T>): LiveResource<T> {
  const [data, setData] = useState<T>(initial);
  const [connection, setConnection] = useState<Connection>("live");
  const etag = useRef<string | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const queued = useRef(false);
  const onGoneRef = useRef(onGone);
  useEffect(() => {
    onGoneRef.current = onGone;
  }, [onGone]);

  const refresh = useCallback(async (): Promise<void> => {
    if (!url) return;
    // Coalesce bursts of change events: while a request is running, remember
    // that another one is wanted and let the running loop pick it up.
    if (inFlight.current) {
      queued.current = true;
      return inFlight.current;
    }
    const run = (async () => {
      do {
        queued.current = false;
        try {
          const result = await api.getConditional<T>(url, { etag: etag.current });
          if (!result.notModified && result.data !== null) {
            etag.current = result.etag;
            setData(result.data);
          }
          setConnection((current) => (current === "offline" ? "live" : current));
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) onGoneRef.current?.();
          else if (error instanceof ApiError && error.status === 0) setConnection("offline");
        }
      } while (queued.current);
    })();
    inFlight.current = run;
    try {
      await run;
    } finally {
      inFlight.current = null;
    }
  }, [url]);

  useEffect(() => {
    if (!url) return;
    let closed = false;
    let source: EventSource | null = null;
    let failures = 0;
    let pollTimer: number | undefined;

    const startPolling = (interval: number) => {
      window.clearInterval(pollTimer);
      pollTimer = window.setInterval(() => {
        if (document.visibilityState === "visible") void refresh();
      }, interval);
    };

    const openStream = () => {
      if (!streamUrl || closed || typeof EventSource === "undefined") {
        setConnection((current) => (current === "offline" ? current : "polling"));
        startPolling(FALLBACK_POLL_MS);
        return;
      }
      source = new EventSource(streamUrl);
      source.addEventListener("ready", () => {
        failures = 0;
        setConnection("live");
        startPolling(SAFETY_POLL_MS);
        void refresh();
      });
      source.addEventListener("change", () => void refresh());
      source.onerror = () => {
        failures += 1;
        if (failures >= STREAM_FAILURES_BEFORE_FALLBACK) {
          source?.close();
          source = null;
          setConnection(navigator.onLine ? "polling" : "offline");
          startPolling(FALLBACK_POLL_MS);
        }
      };
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onOnline = () => {
      failures = 0;
      if (!source) openStream();
      void refresh();
    };
    const onOffline = () => setConnection("offline");

    openStream();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      closed = true;
      source?.close();
      window.clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [url, streamUrl, refresh]);

  return { data, connection, mutate: setData, refresh };
}
