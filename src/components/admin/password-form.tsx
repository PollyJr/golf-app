"use client";

import { useState, type FormEvent } from "react";
import { useErrorMessage, useT } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { FormError, TextField } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation";

interface PasswordFormProps {
  /** The current password is a one-time one that must be replaced. */
  oneTime?: boolean;
  /** Called after the password was changed. */
  onDone: () => void;
  submitLabel?: string;
}

/** Change your own administrator password. */
export function PasswordForm({ oneTime, onDone, submitLabel }: PasswordFormProps) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (next.length < MIN_PASSWORD_LENGTH) return setError(t("admin.account.tooShort", { count: MIN_PASSWORD_LENGTH }));
    if (next !== repeat) return setError(t("admin.account.mismatch"));
    setBusy(true);
    try {
      await api.patch("/api/admin/account", { currentPassword: current, newPassword: next });
      onDone();
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <TextField
        label={t(oneTime ? "admin.account.currentOneTime" : "admin.account.current")}
        type="password"
        value={current}
        onChange={(event) => setCurrent(event.target.value)}
        autoComplete="current-password"
        required
      />
      <TextField
        label={t("admin.account.next")}
        hint={t("admin.account.nextHint", { count: MIN_PASSWORD_LENGTH })}
        type="password"
        value={next}
        onChange={(event) => setNext(event.target.value)}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        required
      />
      <TextField
        label={t("admin.account.repeat")}
        type="password"
        value={repeat}
        onChange={(event) => setRepeat(event.target.value)}
        autoComplete="new-password"
        required
      />
      <FormError>{error}</FormError>
      <Button type="submit" loading={busy} disabled={!current || !next || !repeat} className="self-start">
        {submitLabel ?? t("admin.account.save")}
      </Button>
    </form>
  );
}

/** The account page's form: after success, a full reload into the dashboard. */
export function AccountPasswordForm({ oneTime }: { oneTime: boolean }) {
  return (
    <PasswordForm
      oneTime={oneTime}
      onDone={() => {
        // A full navigation on purpose: the whole panel was rendered for an
        // account that still had to replace its password.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/admin");
      }}
    />
  );
}
