"use client";

import { Languages, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useErrorMessage, useLocale, useT, useToast } from "@/components/providers";
import { Segmented } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/i18n/core";
import { THEME_COOKIE, type ThemeChoice } from "@/lib/theme";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Switches between Dutch and English and re-renders the page in that language. */
export function LanguageSwitch({ variant = "segmented", className }: { variant?: "segmented" | "compact"; className?: string }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [pending, startTransition] = useTransition();

  async function change(next: Locale) {
    if (next === locale) return;
    try {
      await api.post("/api/locale", { locale: next });
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  if (variant === "compact") {
    const next: Locale = locale === "nl" ? "en" : "nl";
    return (
      <button
        type="button"
        onClick={() => void change(next)}
        disabled={pending}
        aria-label={`${t("common.language.label")}: ${t(`common.language.${next}`)}`}
        className={cn(
          "font-label inline-flex h-9 items-center gap-1.5 rounded-full border border-current/25 px-3 text-[11px] opacity-90 transition hover:opacity-100",
          className,
        )}
      >
        <Languages className="size-3.5" />
        {locale.toUpperCase()}
      </button>
    );
  }

  return (
    <Segmented
      label={t("common.language.label")}
      value={locale}
      onChange={(value) => void change(value)}
      options={[
        { value: "nl", label: t("common.language.nl") },
        { value: "en", label: t("common.language.en") },
      ]}
      className={className}
    />
  );
}

/** Light, dark, or whatever the device prefers. Applied without a reload. */
export function ThemeSwitch({ initial, className }: { initial: ThemeChoice; className?: string }) {
  const t = useT();
  const [choice, setChoice] = useState<ThemeChoice>(initial);

  function change(next: ThemeChoice) {
    setChoice(next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    if (next === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <Segmented
      label={t("common.theme.label")}
      value={choice}
      onChange={change}
      options={[
        { value: "system", label: <span className="inline-flex items-center gap-1.5"><Monitor className="size-3.5" />{t("common.theme.system")}</span> },
        { value: "light", label: <span className="inline-flex items-center gap-1.5"><Sun className="size-3.5" />{t("common.theme.light")}</span> },
        { value: "dark", label: <span className="inline-flex items-center gap-1.5"><Moon className="size-3.5" />{t("common.theme.dark")}</span> },
      ]}
      className={className}
    />
  );
}

interface SignOutButtonProps {
  /** Where to land afterwards. */
  redirectTo?: string;
  className?: string;
  iconOnly?: boolean;
}

export function SignOutButton({ redirectTo = "/", className, iconOnly }: SignOutButtonProps) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await api.post("/api/auth/logout");
    } finally {
      // A full navigation drops every cached page of the signed-in session.
      window.location.assign(redirectTo);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={busy}
      aria-label={iconOnly ? t("common.signOut") : undefined}
      title={iconOnly ? t("common.signOut") : undefined}
      className={cn(
        "inline-flex items-center gap-2 rounded-control text-sm font-semibold text-ink-2 transition hover:text-ink disabled:opacity-50",
        iconOnly ? "size-10 justify-center hover:bg-well" : "h-10 px-3 hover:bg-well",
        className,
      )}
    >
      <LogOut className="size-4" />
      {iconOnly ? null : t("common.signOut")}
    </button>
  );
}
