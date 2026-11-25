"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Lobby } from "./lobby";
import { LiveScorecard } from "./live-scorecard";
import { useT, useToast } from "@/components/providers";
import { useLiveResource } from "@/hooks/use-live-resource";
import type { RoundSnapshot } from "@/lib/types";

interface RoundScreenProps {
  initial: RoundSnapshot;
  autoApprove: boolean;
}

/** A round from invitation to the last putt; hands over to the result page when it is finished. */
export function RoundScreen({ initial, autoApprove }: RoundScreenProps) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();

  const { data, connection, refresh } = useLiveResource<{ round: RoundSnapshot }>({
    url: `/api/rounds/${initial.id}`,
    streamUrl: `/api/rounds/${initial.id}/stream`,
    initial: { round: initial },
    onGone: () => {
      toast.error(t("play.card.gone"));
      router.replace("/app");
    },
  });
  const round = data.round;
  const finished = round.status !== "inviting" && round.status !== "active";
  const removed = round.viewer?.participantId === null;

  useEffect(() => {
    if (finished) router.replace(`/app/results/${round.id}`);
    else if (removed) router.replace("/app");
  }, [finished, removed, round.id, router]);

  if (finished || removed) return null;
  if (round.status === "inviting") return <Lobby round={round} refresh={refresh} />;
  return <LiveScorecard round={round} connection={connection} refresh={refresh} autoApprove={autoApprove} />;
}
