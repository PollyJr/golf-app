import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { LoginForm } from "@/components/auth/login-form";
import { ANDROID_APK_PATH, isAndroidApp } from "@/lib/native";
import { safeNextPath } from "@/lib/qr-links";
import { getSession, homeForRole } from "@/server/auth/session";
import { getT } from "@/server/i18n";
import { getSoleClubBranding } from "@/server/services/clubs";

interface LandingPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LandingPage({ searchParams }: LandingPageProps) {
  const next = safeNextPath((await searchParams).next);
  const session = await getSession();
  if (session) redirect(session.role === "player" && next ? next : homeForRole(session.role));
  const [{ t }, club, requestHeaders] = await Promise.all([getT(), getSoleClubBranding().catch(() => null), headers()]);

  return (
    <AuthFrame
      club={club}
      eyebrow={club?.tagline || t("auth.landing.eyebrow")}
      title={t("auth.landing.title")}
      lead={t("auth.landing.lead")}
      features={[t("auth.landing.features.live"), t("auth.landing.features.stats"), t("auth.landing.features.club")]}
    >
      <LoginForm next={next} androidDownload={isAndroidApp(requestHeaders.get("user-agent")) ? null : ANDROID_APK_PATH} />
    </AuthFrame>
  );
}
