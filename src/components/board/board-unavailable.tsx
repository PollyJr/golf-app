import { TvMinimal } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { getT } from "@/server/i18n";

/** Shown for an unknown or withdrawn board link. */
export async function BoardUnavailable() {
  const { t } = await getT();
  return (
    <main className="grid min-h-dvh place-items-center bg-brand px-6 text-brand-ink">
      <div className="flex max-w-md flex-col items-center text-center">
        <Wordmark tone="light" />
        <span className="mt-10 grid size-16 place-items-center rounded-full bg-white/10">
          <TvMinimal className="size-7" aria-hidden="true" />
        </span>
        <h1 className="font-display mt-6 text-3xl text-balance">{t("board.unavailableTitle")}</h1>
        <p className="mt-3 text-pretty opacity-75">{t("board.unavailableLead")}</p>
      </div>
    </main>
  );
}
