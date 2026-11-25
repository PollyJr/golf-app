import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/auth-frame";
import { JoinCodeForm, JoinForm } from "@/components/auth/join-form";
import { FormError } from "@/components/ui/form";
import { getT } from "@/server/i18n";
import { getClubByJoinCode } from "@/server/services/clubs";

export const metadata: Metadata = { title: "Aanmelden" };

export default async function JoinClubPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { t } = await getT();
  const club = /^[A-Za-z0-9-]{4,32}$/.test(code) ? await getClubByJoinCode(code) : null;

  if (!club) {
    return (
      <AuthFrame eyebrow={t("auth.join.eyebrow")} title={t("auth.landing.title")} lead={t("auth.landing.lead")}>
        <div className="flex flex-col gap-5">
          <FormError>{t("common.errors.JOIN_CODE_INVALID")}</FormError>
          <JoinCodeForm />
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame club={club} eyebrow={t("auth.join.eyebrow")} title={club.name} lead={club.tagline || t("auth.landing.lead")}>
      {club.selfRegistration === "closed" ? (
        <FormError>{t("auth.join.closed")}</FormError>
      ) : (
        <JoinForm joinCode={code} clubName={club.name} />
      )}
    </AuthFrame>
  );
}
