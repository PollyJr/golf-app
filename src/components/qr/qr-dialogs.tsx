"use client";

import { QrCode, ScanLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { QrImage } from "./qr-image";
import { QrScanner } from "./qr-scanner";
import { useErrorMessage, useT, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { parseFairwayLink, playerQrPath, roundQrPath } from "@/lib/qr-links";

/** Shows the player's personal QR code, big enough to scan from a phone. */
export function MyQrDialog({ open, onClose, qrToken, name }: { open: boolean; onClose: () => void; qrToken: string; name: string }) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={t("play.qr.myQr")} description={t("play.qr.myQrLead")} size="sm">
      <div className="flex flex-col items-center gap-3">
        <QrImage path={playerQrPath(qrToken)} label={t("play.qr.myQr")} className="max-w-[17rem]" />
        <p className="font-display text-xl">{name}</p>
      </div>
    </Dialog>
  );
}

/**
 * The general scanner (home screen): a player code opens that player, a round
 * code the round's join page, a club code the sign-up page.
 */
export function ScanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  return (
    <Dialog open={open} onClose={onClose} title={t("play.qr.scanTitle")} description={t("play.qr.scanLead")} size="sm">
      <QrScanner
        onScan={(text) => {
          const link = parseFairwayLink(text);
          if (!link) return t("play.qr.unknown");
          onClose();
          router.push(link.path);
          return null;
        }}
      />
    </Dialog>
  );
}

/** Opens the general scanner and the personal QR code; used on the home screen. */
export function QrQuickActions({ qrToken, name }: { qrToken: string; name: string }) {
  const t = useT();
  const [open, setOpen] = useState<"scan" | "mine" | null>(null);
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="secondary" size="lg" onClick={() => setOpen("scan")} icon={<ScanLine className="size-[1.15rem]" />}>
          {t("app.home.scanQr")}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => setOpen("mine")} icon={<QrCode className="size-[1.15rem]" />}>
          {t("app.home.myQr")}
        </Button>
      </div>
      <ScanDialog open={open === "scan"} onClose={() => setOpen(null)} />
      <MyQrDialog open={open === "mine"} onClose={() => setOpen(null)} qrToken={qrToken} name={name} />
    </>
  );
}

interface AddPlayerDialogProps {
  open: boolean;
  onClose: () => void;
  roundId: string;
  /** The round's join token; `null` when the viewer may not hand it out. */
  joinToken: string | null;
  full: boolean;
  onAdded: () => void;
}

/**
 * Adding someone to a round in progress: let them scan the round's code, or
 * scan theirs. Either way they play straight away.
 */
export function AddPlayerDialog({ open, onClose, roundId, joinToken, full, onAdded }: AddPlayerDialogProps) {
  const t = useT();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [scanning, setScanning] = useState(false);

  function close() {
    setScanning(false);
    onClose();
  }

  async function addScanned(text: string): Promise<string | null> {
    const link = parseFairwayLink(text);
    if (!link || link.kind !== "player") return t("play.qr.unknown");
    try {
      const result = await api.post<{ name: string; outcome: "added" | "accepted" | "already" }>(`/api/rounds/${roundId}/lobby`, {
        action: "add-by-qr",
        qrToken: link.token,
      });
      toast.success(result.outcome === "already" ? t("play.qr.playerAlreadyIn", { name: result.name }) : t("play.qr.playerAdded", { name: result.name }));
      onAdded();
      close();
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  }

  return (
    <Dialog open={open} onClose={close} title={t("play.qr.addPlayer")} description={full ? t("play.qr.roundFull") : t("play.qr.addPlayerLead")} size="sm">
      {full ? null : scanning ? (
        <QrScanner onScan={addScanned} />
      ) : (
        <div className="flex flex-col gap-4">
          {joinToken ? (
            <>
              <QrImage path={roundQrPath(joinToken)} label={t("play.qr.roundQrLead")} />
              <p className="text-center text-[13px] text-ink-3">{t("play.qr.roundQrLead")}</p>
            </>
          ) : null}
          <Button size="lg" block onClick={() => setScanning(true)} icon={<ScanLine className="size-[1.15rem]" />}>
            {t("play.qr.scanPlayer")}
          </Button>
        </div>
      )}
    </Dialog>
  );
}
