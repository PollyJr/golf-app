"use client";

import { useState, type FormEvent } from "react";
import { useErrorMessage, useT, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { FormError, TextField } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { PIN_PATTERN } from "@/lib/validation";

interface PinFormProps {
  labels: { current: string; next: string; repeat: string; submit: string; mismatch: string; done: string };
  /** Where to go after a successful change; stays on the page when omitted. */
  redirectTo?: string;
}

/** Changes the player's PIN. Used for the first sign-in and in the profile. */
export function PinForm({ labels, redirectTo }: PinFormProps) {
  const t = useT();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const digits = (value: string) => value.replace(/\D/g, "").slice(0, 12);
  const mismatch = repeat.length > 0 && next !== repeat;
  const valid = PIN_PATTERN.test(current) && PIN_PATTERN.test(next) && next === repeat;
  const pinProps = { type: "password", inputMode: "numeric" as const, pattern: "[0-9]*", required: true };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError("");
    try {
      await api.patch("/api/me", { action: "pin", currentPin: current, newPin: next });
      if (redirectTo) {
        window.location.assign(redirectTo);
        return;
      }
      toast.success(labels.done);
      setCurrent("");
      setNext("");
      setRepeat("");
    } catch (failure) {
      setError(errorMessage(failure));
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <TextField {...pinProps} label={labels.current} value={current} onChange={(event) => setCurrent(digits(event.target.value))} autoComplete="current-password" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField {...pinProps} label={labels.next} value={next} onChange={(event) => setNext(digits(event.target.value))} autoComplete="new-password" hint={t("auth.join.pinHint")} />
        <TextField {...pinProps} label={labels.repeat} value={repeat} onChange={(event) => setRepeat(digits(event.target.value))} autoComplete="new-password" error={mismatch ? labels.mismatch : undefined} />
      </div>
      <FormError>{error}</FormError>
      <Button type="submit" block loading={busy} disabled={!valid}>
        {labels.submit}
      </Button>
    </form>
  );
}
