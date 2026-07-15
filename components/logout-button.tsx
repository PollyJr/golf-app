"use client";

import { LogOut } from "lucide-react";
import { secureHeaders } from "@/lib/client-security";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  async function logout() { await fetch("/api/auth/logout", { method: "POST", headers: secureHeaders(false) }); window.location.href = "/"; }
  return <button type="button" onClick={logout} className={compact ? "icon-button" : "secondary-button"} aria-label="Uitloggen"><LogOut size={16}/>{!compact && " Uitloggen"}</button>;
}
