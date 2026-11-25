"use client";

import { useEffect } from "react";
import { useT } from "@/components/providers";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-start justify-center gap-5 px-6">
      <h1 className="font-display text-4xl">{t("pub.error.title")}</h1>
      <p className="text-ink-2">{t("pub.error.lead")}</p>
      <Button onClick={reset}>{t("pub.error.retry")}</Button>
    </div>
  );
}
