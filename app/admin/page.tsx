import { redirect } from "next/navigation";
import AdminDashboard from "@/components/admin-dashboard-live";
import { getSession } from "@/lib/auth";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (session.role === "platform_admin") redirect("/platform");
  if (session.role !== "club_owner" && session.role !== "club_staff") redirect("/app");
  return <AdminDashboard />;
}
