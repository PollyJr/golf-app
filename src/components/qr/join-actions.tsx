"use client";

import { Flag, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useErrorMessage, useT, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

/** Joins the round behind a scanned round QR code. */
export function JoinRoundButton({ token }: { token: string }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);

  async function join() {
    setBusy(true);
    try {
      const { id } = await api.post<{ id: string }>("/api/rounds/join", { token });
      router.replace(`/app/play/${id}`);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <Button variant="accent" size="lg" block loading={busy} onClick={() => void join()} icon={<Flag className="size-[1.1rem]" />}>
      {t("play.qr.joinButton")}
    </Button>
  );
}

/** Adds the club mate behind a scanned personal QR code to one of the viewer's open rounds. */
export function AddToRoundButton({ roundId, qrToken, label }: { roundId: string; qrToken: string; label: string }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      const result = await api.post<{ name: string; outcome: string }>(`/api/rounds/${roundId}/lobby`, { action: "add-by-qr", qrToken });
      toast.success(result.outcome === "already" ? t("play.qr.playerAlreadyIn", { name: result.name }) : t("play.qr.playerAdded", { name: result.name }));
      router.replace(`/app/play/${roundId}`);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" size="lg" block loading={busy} onClick={() => void add()} icon={<UserPlus className="size-[1.1rem]" />}>
      {label}
    </Button>
  );
}
