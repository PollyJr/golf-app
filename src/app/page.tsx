import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { LoginForm } from "@/components/auth/login-form";
import { getSession, homeForRole } from "@/server/auth/session";
import { getT } from "@/server/i18n";
import { getSoleClubBranding } from "@/server/services/clubs";

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect(homeForRole(session.role));
  const [{ t }, club] = await Promise.all([getT(), getSoleClubBranding().catch(() => null)]);

  return (
    <AuthFrame
      club={club}
      eyebrow={club?.tagline || t("auth.landing.eyebrow")}
      title={t("auth.landing.title")}
      lead={t("auth.landing.lead")}
      features={[t("auth.landing.features.live"), t("auth.landing.features.stats"), t("auth.landing.features.club")]}
    >
      <LoginForm />
    </AuthFrame>
  );
}
