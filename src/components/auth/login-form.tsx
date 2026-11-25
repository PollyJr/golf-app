"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useErrorMessage, useT } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { FormError, TextField } from "@/components/ui/form";
import { api } from "@/lib/api-client";

interface LoginFormProps {
  /** Where to go after signing in, e.g. the round of a scanned QR code. */
  next?: string | null;
  /** Offer the Android app (not inside the app itself). */
  androidDownload?: string | null;
}

export function LoginForm({ next, androidDownload }: LoginFormProps) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.post<{ redirectTo: string }>("/api/auth/player/login", { identifier: identifier.trim(), pin });
      // A full navigation, so the whole app renders with the new session.
      window.location.assign(result.redirectTo === "/app" && next ? next : result.redirectTo);
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div>
        <h2 className="font-display text-3xl">{t("auth.login.title")}</h2>
        <p className="mt-1.5 text-ink-2">{t("auth.login.subtitle")}</p>
      </div>
      <TextField
        label={t("auth.login.identifier")}
        value={identifier}
        onChange={(event) => setIdentifier(event.target.value)}
        placeholder={t("auth.login.identifierPlaceholder")}
        hint={t("auth.login.identifierHint")}
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
      />
      <TextField
        label={t("auth.login.pin")}
        type="password"
        value={pin}
        onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 12))}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="current-password"
        enterKeyHint="go"
        required
        inputClassName="tracking-[0.3em]"
      />
      <FormError>{error}</FormError>
      <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={identifier.trim().length < 3 || pin.length < 4}>
        {t("auth.login.submit")}
        <ArrowRight className="size-4" />
      </Button>
      <p className="text-center text-[13px] text-ink-3">{t("auth.login.forgot")}</p>

      <div className="mt-2 flex flex-col gap-2 border-t border-line pt-5 text-sm">
        <p className="text-ink-2">
          {t("auth.login.joinPrompt")}{" "}
          <Link href="/join" className="font-semibold text-brand-fg underline-offset-4 hover:underline">
            {t("auth.login.joinLink")}
          </Link>
        </p>
        <Link href="/admin/login" className="text-ink-3 underline-offset-4 hover:text-ink hover:underline">
          {t("auth.login.adminLink")}
        </Link>
        {androidDownload ? (
          <a href={androidDownload} download className="text-ink-3 underline-offset-4 hover:text-ink hover:underline">
            {t("app.profile.android")} · {t("app.profile.androidDownload")}
          </a>
        ) : null}
      </div>
    </form>
  );
}
