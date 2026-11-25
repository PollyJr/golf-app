import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/login-form";
import { AuthFrame } from "@/components/auth/auth-frame";
import { getSession, homeForRole } from "@/server/auth/session";
import { getT } from "@/server/i18n";
import { getSoleClubBranding } from "@/server/services/clubs";

export const metadata: Metadata = { title: "Clubbeheer" };

export default async function AdminLoginPage() {
  const session = await getSession();
  if (session) redirect(homeForRole(session.role));
  const [{ t }, club] = await Promise.all([getT(), getSoleClubBranding().catch(() => null)]);

  return (
    <AuthFrame club={club} eyebrow={t("auth.admin.eyebrow")} title={t("auth.admin.title")} lead={t("auth.admin.lead")}>
      <AdminLoginForm />
    </AuthFrame>
  );
}
