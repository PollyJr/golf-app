"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { QrImage } from "@/components/qr/qr-image";
import { useErrorMessage, useT, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { playerQrPath } from "@/lib/qr-links";

/** The personal QR code on the profile, with a way to replace it. */
export function MyQrCard({ initialToken }: { initialToken: string }) {
  const t = useT();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);

  async function regenerate() {
    setBusy(true);
    try {
      const result = await api.put<{ qrToken: string }>("/api/me/qr");
      setToken(result.qrToken);
      toast.success(t("app.profile.qrRegenerated"));
    } catch (error) {
      toast.error(errorMessage(error));
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <QrImage path={playerQrPath(token)} label={t("app.profile.qrHeading")} />
      <Button variant="ghost" size="sm" loading={busy} onClick={() => void regenerate()} icon={<RefreshCw className="size-4" />}>
        {t("app.profile.qrRegenerate")}
      </Button>
    </div>
  );
}
