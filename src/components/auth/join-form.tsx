"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useErrorMessage, useT } from "@/components/providers";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormError, TextField } from "@/components/ui/form";
import { api, ApiError } from "@/lib/api-client";
import { PIN_PATTERN, suggestUsername, USERNAME_PATTERN } from "@/lib/validation";

/** Step one without a code in the link: ask for the club code. */
export function JoinCodeForm() {
  const t = useT();
  const router = useRouter();
  const [code, setCode] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const cleaned = code.trim().toUpperCase();
    if (cleaned) router.push(`/join/${encodeURIComponent(cleaned)}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-3xl">{t("auth.join.title")}</h2>
        <p className="mt-1.5 text-ink-2">{t("auth.join.lead")}</p>
      </div>
      <TextField
        label={t("auth.join.codeLabel")}
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32))}
        placeholder={t("auth.join.codePlaceholder")}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputClassName="tracking-[0.2em] font-semibold"
        required
      />
      <Button type="submit" size="lg" block disabled={code.trim().length < 4}>
        {t("auth.join.codeSubmit")}
      </Button>
      <p className="text-sm text-ink-2">
        {t("auth.join.haveAccount")}{" "}
        <Link href="/" className="font-semibold text-brand-fg underline-offset-4 hover:underline">
          {t("auth.join.loginLink")}
        </Link>
      </p>
    </form>
  );
}

interface JoinFormProps {
  joinCode: string;
  clubName: string;
}

export function JoinForm({ joinCode, clubName }: JoinFormProps) {
  const t = useT();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [pin, setPin] = useState("");
  const [pinRepeat, setPinRepeat] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  const digits = (value: string) => value.replace(/\D/g, "").slice(0, 12);
  const pinMismatch = pinRepeat.length > 0 && pin !== pinRepeat;
  const valid =
    name.trim().length >= 2 && USERNAME_PATTERN.test(username) && PIN_PATTERN.test(pin) && pin === pinRepeat;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError("");
    setUsernameError("");
    try {
      const result = await api.post<{ status: "approved" | "pending"; code: string; redirectTo: string | null }>(
        "/api/auth/register",
        { joinCode, displayName: name.trim(), username, pin, email: email.trim() || null },
      );
      if (result.redirectTo) window.location.assign(result.redirectTo);
      else setPendingCode(result.code);
    } catch (failure) {
      if (failure instanceof ApiError && (failure.code === "USERNAME_TAKEN" || failure.code === "INVALID_USERNAME")) {
        setUsernameError(errorMessage(failure));
      } else {
        setError(errorMessage(failure));
      }
      setBusy(false);
    }
  }

  if (pendingCode) {
    return (
      <div className="flex flex-col gap-5">
        <span className="grid size-14 place-items-center rounded-full bg-under-soft text-under">
          <CheckCircle2 className="size-7" />
        </span>
        <div>
          <h2 className="font-display text-3xl">{t("auth.join.pendingTitle")}</h2>
          <p className="mt-2 text-ink-2">{t("auth.join.pendingBody", { club: clubName })}</p>
        </div>
        <Card tone="well" className="text-center">
          <p className="font-label text-[11px] text-ink-3">{t("auth.join.yourCode")}</p>
          <p className="font-score mt-2 text-4xl tracking-[0.08em]">{pendingCode}</p>
        </Card>
        <LinkButton href="/" variant="primary" size="lg" block>
          {t("auth.join.toLogin")}
        </LinkButton>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div>
        <p className="font-label text-[11px] text-ink-3">{t("auth.join.joining")}</p>
        <h2 className="font-display mt-1 text-3xl">{clubName}</h2>
      </div>
      <TextField
        label={t("auth.join.name")}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          if (!usernameTouched) setUsername(suggestUsername(event.target.value));
        }}
        placeholder={t("auth.join.namePlaceholder")}
        autoComplete="name"
        maxLength={80}
        required
      />
      <TextField
        label={t("auth.join.username")}
        value={username}
        onChange={(event) => {
          setUsernameTouched(true);
          setUsernameError("");
          setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30));
        }}
        hint={t("auth.join.usernameHint")}
        error={usernameError || (usernameTouched && username.length > 0 && !USERNAME_PATTERN.test(username) ? t("common.errors.INVALID_USERNAME") : undefined)}
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t("auth.join.pin")}
          type="password"
          value={pin}
          onChange={(event) => setPin(digits(event.target.value))}
          hint={t("auth.join.pinHint")}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="new-password"
          required
        />
        <TextField
          label={t("auth.join.pinRepeat")}
          type="password"
          value={pinRepeat}
          onChange={(event) => setPinRepeat(digits(event.target.value))}
          error={pinMismatch ? t("auth.join.pinMismatch") : undefined}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="new-password"
          required
        />
      </div>
      <TextField
        label={
          <>
            {t("auth.join.email")} <span className="font-normal text-ink-3">({t("common.optional")})</span>
          </>
        }
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        hint={t("auth.join.emailHint")}
        autoComplete="email"
      />
      <FormError>{error}</FormError>
      <Button type="submit" size="lg" block loading={busy} disabled={!valid}>
        {t("auth.join.submit")}
      </Button>
      <p className="text-sm text-ink-2">
        {t("auth.join.haveAccount")}{" "}
        <Link href="/" className="font-semibold text-brand-fg underline-offset-4 hover:underline">
          {t("auth.join.loginLink")}
        </Link>
      </p>
    </form>
  );
}
