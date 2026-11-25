import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { RetryButton } from "./retry-button";
import { Wordmark } from "@/components/brand";
import { getT } from "@/server/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("pub.offline.title") };
}

/**
 * Shown by the service worker when a page cannot be loaded without a network.
 * It is cached at install time, so it must not depend on being signed in.
 */
export default async function OfflinePage() {
  const { t } = await getT();
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6 py-10">
      <div className="flex max-w-sm flex-col items-center text-center">
        <Wordmark />
        <span className="mt-10 grid size-16 place-items-center rounded-full bg-well text-ink-2">
          <WifiOff className="size-7" aria-hidden="true" />
        </span>
        <h1 className="font-display mt-6 text-3xl text-balance">{t("pub.offline.title")}</h1>
        <p className="mt-3 text-pretty text-ink-2">{t("pub.offline.lead")}</p>
        <RetryButton label={t("common.retry")} />
      </div>
    </main>
  );
}
