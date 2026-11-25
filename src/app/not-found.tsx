import { Wordmark } from "@/components/brand";
import { LinkButton } from "@/components/ui/button";
import { getT } from "@/server/i18n";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-6 px-6">
      <Wordmark />
      <p className="font-score text-[7rem] leading-none text-ink-3/40">404</p>
      <div>
        <h1 className="font-display text-4xl">{t("pub.notFound.title")}</h1>
        <p className="mt-2 text-ink-2">{t("pub.notFound.lead")}</p>
      </div>
      <LinkButton href="/" variant="primary">
        {t("pub.notFound.home")}
      </LinkButton>
    </div>
  );
}
