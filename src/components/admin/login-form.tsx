"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useErrorMessage, useT } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { FormError, TextField } from "@/components/ui/form";
import { api } from "@/lib/api-client";

export function AdminLoginForm() {
  const t = useT();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.post<{ redirectTo: string }>("/api/auth/admin/login", { email: email.trim(), password });
      // A full navigation, so everything renders with the new session.
      window.location.assign(result.redirectTo);
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <h2 className="font-display text-3xl">{t("auth.admin.formTitle")}</h2>
      <TextField
        label={t("auth.admin.email")}
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
      />
      <TextField
        label={t("auth.admin.password")}
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        enterKeyHint="go"
        required
      />
      <FormError>{error}</FormError>
      <Button type="submit" size="lg" block loading={busy} disabled={!email || !password}>
        {t("auth.admin.submit")}
        <ArrowRight className="size-4" />
      </Button>
      <Link href="/" className="mt-2 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" />
        {t("auth.admin.playerLink")}
      </Link>
    </form>
  );
}
