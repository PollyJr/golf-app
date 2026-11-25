"use client";

import { useEffect } from "react";

/** Registers the service worker that makes the app installable and offline-tolerant. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installation is an enhancement; the app works without it.
    });
  }, []);
  return null;
}
