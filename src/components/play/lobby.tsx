"use client";

import { Check, Clock, Share2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShareDialog } from "./share-dialog";
import { AddPlayerDialog } from "@/components/qr/qr-dialogs";
import { useErrorMessage, useT, useToast } from "@/components/providers";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { useFlip } from "@/hooks/use-motion";
import { api } from "@/lib/api-client";
import { MAX_FLIGHT_SIZE } from "@/lib/golf/scoring";
import type { RoundSnapshot } from "@/lib/types";

interface LobbyProps {
  round: RoundSnapshot;
  refresh: () => Promise<void>;
}

/** Before play: who has accepted, and the starter's controls. */
export function Lobby({ round, refresh }: LobbyProps) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [adding, setAdding] = useState(false);

  const viewer = round.viewer;
  const isStarter = viewer?.isStarter ?? false;
  // Players who join, by QR code or by accepting, pop into the list; a row lights up when it changes.
  const flip = useFlip({ enter: "pop" });
  const invited = viewer?.invitation === "pending";

  async function run(key: string, action: () => Promise<unknown>, after?: () => void) {
    setBusy(key);
    try {
      await action();
      after?.();
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      await refresh();
    }
    setBusy(null);
  }

  const respond = (decision: "accept" | "decline") =>
    run(decision, () => api.post(`/api/rounds/${round.id}/respond`, { decision }), () => {
      if (decision === "decline") {
        toast.success(t("play.lobby.declined"));
        router.replace("/app");
      }
    });

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-5 pt-[max(env(safe-area-inset-top),1.25rem)] pb-10">
      <div className="flex items-center justify-between">
        <Link href="/app" className="text-sm font-semibold text-ink-2 hover:text-ink">
          ← {t("common.back")}
        </Link>
        {viewer?.invitation === "accepted" ? (
          <div className="flex gap-2">
            <IconButton label={t("play.qr.addPlayer")} variant="secondary" onClick={() => setAdding(true)}>
              <UserPlus className="size-[1.1rem]" />
            </IconButton>
            <IconButton label={t("play.share.button")} variant="secondary" onClick={() => setSharing(true)}>
              <Share2 className="size-[1.1rem]" />
            </IconButton>
          </div>
        ) : null}
      </div>

      <header className="animate-rise">
        <Eyebrow>{t("play.lobby.eyebrow")}</Eyebrow>
        <h1 className="font-display mt-2 text-[clamp(1.9rem,7vw,2.6rem)] text-balance">
          {invited ? t("play.lobby.invitedBy", { name: round.starterName.split(/\s+/)[0] }) : t("play.lobby.title")}
        </h1>
        <p className="mt-2 text-ink-2">
          {t("play.setup.summary", { course: round.course.name, holes: round.holeCount, format: t(`common.format.${round.format}`) })}
        </p>
      </header>

      <Card padding="none" className="divide-y divide-line">
        {round.participants.map((participant) => {
          const pending = participant.invitation === "pending";
          const isRoundStarter = participant.playerId === round.starterId;
          return (
            <div key={participant.id} ref={flip(participant.id, participant.invitation)} className="flex items-center gap-3 px-4 py-3.5">
              <Avatar name={participant.name} initials={participant.initials} guest={participant.guest} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{participant.name}</p>
                <p className="text-[13px] text-ink-3">
                  {isRoundStarter ? t("play.lobby.starter") : participant.guest ? t("common.guest") : pending ? t("play.lobby.pending") : t("play.lobby.accepted")}
                </p>
              </div>
              {pending ? (
                <Badge key="pending" tone="gold" icon={<Clock className="size-3 animate-pulse" />}>
                  {t("play.lobby.pending")}
                </Badge>
              ) : (
                <Badge key="accepted" tone="under" icon={<Check className="size-3" />} className="animate-scale-in">
                  {t("play.lobby.accepted")}
                </Badge>
              )}
              {isStarter && !isRoundStarter ? (
                <IconButton
                  label={`${t("common.remove")}: ${participant.name}`}
                  size="sm"
                  disabled={busy !== null}
                  onClick={() =>
                    void run(
                      participant.id,
                      () => api.post(`/api/rounds/${round.id}/lobby`, { action: "remove", participantId: participant.id }),
                      () => toast.success(t("play.lobby.removed", { name: participant.name })),
                    )
                  }
                >
                  <X className="size-4" />
                </IconButton>
              ) : null}
            </div>
          );
        })}
      </Card>

      {invited ? (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" loading={busy === "decline"} disabled={busy !== null} onClick={() => void respond("decline")}>
            {t("play.lobby.decline")}
          </Button>
          <Button variant="accent" size="lg" loading={busy === "accept"} disabled={busy !== null} onClick={() => void respond("accept")}>
            {t("play.lobby.accept")}
          </Button>
        </div>
      ) : (
        <p className="text-center text-sm text-ink-3">{t("play.lobby.lead")}</p>
      )}

      {isStarter ? (
        <div className="flex flex-col gap-2">
          <Button
            variant="accent"
            size="lg"
            block
            loading={busy === "start"}
            disabled={busy !== null}
            onClick={() => void run("start", () => api.post(`/api/rounds/${round.id}/lobby`, { action: "start" }))}
          >
            {t("play.lobby.startNow")}
          </Button>
          <p className="text-center text-xs text-ink-3">{t("play.lobby.startNowHint")}</p>
          <Button variant="ghost" className="mt-2" onClick={() => setConfirmCancel(true)}>
            {t("play.lobby.cancel")}
          </Button>
        </div>
      ) : viewer?.invitation === "accepted" ? (
        <Button
          variant="ghost"
          loading={busy === "leave"}
          onClick={() =>
            void run("leave", () => api.post(`/api/rounds/${round.id}/lobby`, { action: "leave" }), () => {
              toast.success(t("play.card.left"));
              router.replace("/app");
            })
          }
        >
          {t("play.card.leave")}
        </Button>
      ) : null}

      <Dialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title={t("play.lobby.cancel")}
        description={t("play.lobby.cancelConfirm")}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
              {t("common.back")}
            </Button>
            <Button
              variant="danger"
              loading={busy === "cancel"}
              onClick={() =>
                void run("cancel", () => api.delete(`/api/rounds/${round.id}`), () => {
                  toast.success(t("play.lobby.cancelled"));
                  router.replace("/app");
                })
              }
            >
              {t("play.lobby.cancel")}
            </Button>
          </>
        }
      />

      <AddPlayerDialog
        open={adding}
        onClose={() => setAdding(false)}
        roundId={round.id}
        joinToken={round.joinToken ?? null}
        full={round.participants.length >= MAX_FLIGHT_SIZE || (round.format === "match" && round.participants.length >= 2)}
        onAdded={() => void refresh()}
      />

      <ShareDialog
        open={sharing}
        onClose={() => setSharing(false)}
        roundId={round.id}
        courseName={round.course.name}
        token={round.shareToken ?? null}
        onChange={() => void refresh()}
      />
    </div>
  );
}
