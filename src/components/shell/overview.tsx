"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useLiveResource, type Connection } from "@/hooks/use-live-resource";
import type { ActiveRoundSummary } from "@/lib/types";

export interface Overview {
  rounds: ActiveRoundSummary[];
  unread: number;
}

interface OverviewValue {
  overview: Overview;
  connection: Connection;
  refresh: () => Promise<void>;
}

const OverviewContext = createContext<OverviewValue | null>(null);

/**
 * The few things the whole player app keeps live: rounds in progress,
 * invitations and the unread notification count. One stream feeds the tab
 * bar badges, the home screen and the notification bell.
 */
export function OverviewProvider({ initial, children }: { initial: Overview; children: ReactNode }) {
  const { data, connection, refresh } = useLiveResource<Overview>({
    url: "/api/me/overview",
    streamUrl: "/api/me/stream",
    initial,
  });
  return <OverviewContext.Provider value={{ overview: data, connection, refresh }}>{children}</OverviewContext.Provider>;
}

export function useOverview(): OverviewValue {
  const value = useContext(OverviewContext);
  if (!value) throw new Error("OverviewProvider is missing from the tree");
  return value;
}
