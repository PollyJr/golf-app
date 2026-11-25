"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useErrorMessage, useT, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form";
import { api } from "@/lib/api-client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The address the player signs in with. */
export function EmailForm({ initial }: { initial: string | null }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valid = EMAIL_PATTERN.test(email.trim());

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.patch<{ email: string | null }>("/api/me", { action: "email", email: email.trim() });
      setEmail(result.email ?? "");
      setSaved(result.email ?? "");
      toast.success(t("app.profile.emailSaved"));
      router.refresh();
    } catch (failure) {
      setError(errorMessage(failure));
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <TextField
        label={t("app.profile.emailLabel")}
        type="email"
        value={email}
        onChange={(event) => {
          setError("");
          setEmail(event.target.value);
        }}
        error={error || undefined}
        autoComplete="email"
        inputMode="email"
      />
      <Button type="submit" variant="secondary" block loading={busy} disabled={!valid || email.trim().toLowerCase() === saved}>
        {t("app.profile.emailSave")}
      </Button>
    </form>
  );
}
