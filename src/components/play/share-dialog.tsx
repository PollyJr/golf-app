"use client";

import { Copy, Link2Off, Share2 } from "lucide-react";
import { useState } from "react";
import { useErrorMessage, useT, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { nativeBridge } from "@/lib/native";

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  roundId: string;
  courseName: string;
  /** The current share token, if sharing is on. */
  token: string | null;
  onChange: () => void;
}

/** Turns the public live link on and off, and helps to hand it out. */
export function ShareDialog({ open, onClose, roundId, courseName, token, onChange }: ShareDialogProps) {
  const t = useT();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const url = token && typeof window !== "undefined" ? `${window.location.origin}/live/${token}` : null;

  async function toggle(enabled: boolean) {
    setBusy(true);
    try {
      await api.put(`/api/rounds/${roundId}/share`, { enabled });
      toast.success(enabled ? t("play.share.enabled") : t("play.share.disabled"));
      onChange();
    } catch (error) {
      toast.error(errorMessage(error));
    }
    setBusy(false);
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("common.copied"));
    } catch {
      toast.error(t("common.errors.UNKNOWN"));
    }
  }

  async function nativeShare() {
    if (!url) return;
    // In the Android app the WebView has no Web Share; the app shares instead.
    const bridge = nativeBridge();
    if (bridge) {
      bridge.share(t("play.share.shareText", { course: courseName }), url);
      return;
    }
    try {
      await navigator.share({ title: courseName, text: t("play.share.shareText", { course: courseName }), url });
    } catch {
      // The share sheet was dismissed.
    }
  }

  const canShare = nativeBridge() !== null || (typeof navigator !== "undefined" && typeof navigator.share === "function");

  return (
    <Dialog open={open} onClose={onClose} title={t("play.share.title")} description={t("play.share.lead")} size="sm">
      {url && token ? (
        <div className="flex flex-col gap-4">
          <div className="mx-auto w-44 rounded-2xl border border-line bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- an SVG from our own API */}
            <img src={`/api/qr?path=/live/${token}`} alt="" className="aspect-square w-full" />
          </div>
          <p className="text-center text-xs text-ink-3">{t("play.share.scan")}</p>
          <p className="rounded-control border border-line bg-well px-3 py-2.5 text-center text-[13px] break-all text-ink-2 select-all">{url}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => void copy()} icon={<Copy className="size-4" />}>
              {t("play.share.copy")}
            </Button>
            {canShare ? (
              <Button onClick={() => void nativeShare()} icon={<Share2 className="size-4" />}>
                {t("play.share.native")}
              </Button>
            ) : (
              <Button variant="ghost" loading={busy} onClick={() => void toggle(false)} icon={<Link2Off className="size-4" />}>
                {t("play.share.disable")}
              </Button>
            )}
          </div>
          {canShare ? (
            <Button variant="ghost" size="sm" loading={busy} onClick={() => void toggle(false)} icon={<Link2Off className="size-4" />}>
              {t("play.share.disable")}
            </Button>
          ) : null}
        </div>
      ) : (
        <Button block size="lg" loading={busy} onClick={() => void toggle(true)} icon={<Share2 className="size-4" />}>
          {t("play.share.enable")}
        </Button>
      )}
    </Dialog>
  );
}
