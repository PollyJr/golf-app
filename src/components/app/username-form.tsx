"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useErrorMessage, useT, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { USERNAME_PATTERN } from "@/lib/validation";

export function UsernameForm({ initial }: { initial: string }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [username, setUsername] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valid = USERNAME_PATTERN.test(username);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.patch<{ username: string }>("/api/me", { action: "username", username });
      setUsername(result.username);
      setSaved(result.username);
      toast.success(t("app.profile.usernameSaved"));
      router.refresh();
    } catch (failure) {
      setError(errorMessage(failure));
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <TextField
        label={t("app.profile.usernameLabel")}
        value={username}
        onChange={(event) => {
          setError("");
          setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30));
        }}
        error={error || (username.length > 0 && !valid ? t("common.errors.INVALID_USERNAME") : undefined)}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <Button type="submit" variant="secondary" block loading={busy} disabled={!valid || username === saved}>
        {t("app.profile.usernameSave")}
      </Button>
    </form>
  );
}
