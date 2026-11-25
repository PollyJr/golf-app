import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/auth-frame";
import { JoinCodeForm } from "@/components/auth/join-form";
import { getT } from "@/server/i18n";

export const metadata: Metadata = { title: "Aanmelden" };

export default async function JoinPage() {
  const { t } = await getT();
  return (
    <AuthFrame eyebrow={t("auth.join.eyebrow")} title={t("auth.landing.title")} lead={t("auth.landing.lead")}>
      <JoinCodeForm />
    </AuthFrame>
  );
}
