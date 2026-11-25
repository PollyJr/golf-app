"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useErrorMessage, useT } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { FormError, TextField } from "@/components/ui/form";
import { api, ApiError } from "@/lib/api-client";
import { PIN_PATTERN } from "@/lib/validation";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * First sign-in with a PIN from the club: the player picks their own PIN and
 * gives the e-mail address they will sign in with from now on.
 */
export function WelcomeForm({ initialEmail }: { initialEmail: string | null }) {
  const t = useT();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");

  const digits = (value: string) => value.replace(/\D/g, "").slice(0, 12);
  const mismatch = repeat.length > 0 && next !== repeat;
  const emailValid = email.trim() === "" || EMAIL_PATTERN.test(email.trim());
  const valid = PIN_PATTERN.test(current) && PIN_PATTERN.test(next) && next === repeat && emailValid;
  const pinProps = { type: "password", inputMode: "numeric" as const, pattern: "[0-9]*", required: true };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError("");
    setEmailError("");
    try {
      // The address first: if it is taken, nothing has changed yet.
      if (email.trim() && email.trim().toLowerCase() !== (initialEmail ?? "")) {
        try {
          await api.patch("/api/me", { action: "email", email: email.trim() });
        } catch (failure) {
          if (failure instanceof ApiError && failure.code === "EMAIL_TAKEN") {
            setEmailError(errorMessage(failure));
            setBusy(false);
            return;
          }
          throw failure;
        }
      }
      await api.patch("/api/me", { action: "pin", currentPin: current, newPin: next });
      router.replace("/app");
      router.refresh();
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <TextField
        label={t("auth.welcome.email")}
        type="email"
        value={email}
        onChange={(event) => {
          setEmailError("");
          setEmail(event.target.value);
        }}
        hint={t("auth.welcome.emailHint")}
        error={emailError || (!emailValid ? t("common.errors.INVALID_REQUEST") : undefined)}
        autoComplete="email"
        inputMode="email"
      />
      <TextField {...pinProps} label={t("auth.welcome.current")} value={current} onChange={(event) => setCurrent(digits(event.target.value))} autoComplete="current-password" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField {...pinProps} label={t("auth.welcome.next")} value={next} onChange={(event) => setNext(digits(event.target.value))} autoComplete="new-password" hint={t("auth.join.pinHint")} />
        <TextField
          {...pinProps}
          label={t("auth.welcome.repeat")}
          value={repeat}
          onChange={(event) => setRepeat(digits(event.target.value))}
          autoComplete="new-password"
          error={mismatch ? t("auth.join.pinMismatch") : undefined}
        />
      </div>
      <FormError>{error}</FormError>
      <Button type="submit" block size="lg" loading={busy} disabled={!valid}>
        {t("auth.welcome.submit")}
      </Button>
    </form>
  );
}
