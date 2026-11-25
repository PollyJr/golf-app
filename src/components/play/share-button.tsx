"use client";

import { Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShareDialog } from "./share-dialog";
import { useT } from "@/components/providers";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  roundId: string;
  courseName: string;
  token: string | null;
}

/** Opens the share dialog from a server-rendered page. */
export function ShareButton({ roundId, courseName, token }: ShareButtonProps) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} icon={<Share2 className="size-4" />}>
        {t("play.share.button")}
      </Button>
      <ShareDialog open={open} onClose={() => setOpen(false)} roundId={roundId} courseName={courseName} token={token} onChange={() => router.refresh()} />
    </>
  );
}
