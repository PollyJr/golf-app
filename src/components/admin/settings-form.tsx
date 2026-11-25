"use client";

import { ExternalLink, RefreshCw, Save } from "lucide-react";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { ConfirmDialog, CopyButton } from "./common";
import { useAction } from "./use-action";
import { useT } from "@/components/providers";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, SectionHeading } from "@/components/ui/card";
import { FormError, SelectField, Switch, TextAreaField, TextField } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import type { Locale } from "@/lib/i18n/core";
import { clubThemeStyle } from "@/lib/theme";
import type { ClubAdminSettings, SelfRegistration } from "@/lib/types";
import { HEX_COLOR_PATTERN } from "@/lib/validation";

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorField({ label, value, onChange }: ColorFieldProps) {
  const valid = HEX_COLOR_PATTERN.test(value);
  return (
    <div className="flex items-end gap-3">
      <input
        type="color"
        aria-label={label}
        value={valid ? value : "#000000"}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-14 shrink-0 cursor-pointer rounded-control border border-line-strong bg-surface p-1"
      />
      <TextField
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value.trim())}
        maxLength={7}
        spellCheck={false}
        autoCapitalize="none"
        className="min-w-0 flex-1"
        inputClassName="tabular"
      />
    </div>
  );
}

/** The club's profile, colours and policies. */
export function SettingsForm({ settings }: { settings: ClubAdminSettings }) {
  const t = useT();
  const { run, busy } = useAction();
  const [name, setName] = useState(settings.name);
  const [tagline, setTagline] = useState(settings.tagline ?? "");
  const [contactEmail, setContactEmail] = useState(settings.contactEmail ?? "");
  const [phone, setPhone] = useState(settings.phone ?? "");
  const [address, setAddress] = useState(settings.address ?? "");
  const [website, setWebsite] = useState(settings.website ?? "");
  const [openingHours, setOpeningHours] = useState(settings.openingHours ?? "");
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [accentColor, setAccentColor] = useState(settings.accentColor);
  const [defaultLanguage, setDefaultLanguage] = useState<Locale>(settings.defaultLanguage);
  const [selfRegistration, setSelfRegistration] = useState<SelfRegistration>(settings.selfRegistration);
  const [autoApproveRounds, setAutoApproveRounds] = useState(settings.autoApproveRounds);
  const [error, setError] = useState("");

  const colorsValid = HEX_COLOR_PATTERN.test(primaryColor) && HEX_COLOR_PATTERN.test(accentColor);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (name.trim().length < 2) return setError(t("admin.settings.invalidName"));
    if (!colorsValid) return setError(t("admin.settings.branding.invalidColor"));
    await run(
      () =>
        api.post("/api/admin/settings", {
          action: "update",
          settings: {
            name: name.trim(),
            tagline: tagline.trim() || null,
            primaryColor,
            accentColor,
            contactEmail: contactEmail.trim() || null,
            phone: phone.trim() || null,
            address: address.trim() || null,
            website: website.trim() || null,
            openingHours: openingHours.trim() || null,
            defaultLanguage,
            selfRegistration,
            autoApproveRounds,
          },
        }),
      { success: t("admin.settings.saved") },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <Card padding="lg">
        <SectionHeading title={t("admin.settings.profile.heading")} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label={t("admin.settings.profile.name")} value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required />
          <TextField
            label={t("admin.settings.profile.tagline")}
            value={tagline}
            onChange={(event) => setTagline(event.target.value)}
            placeholder={t("admin.settings.profile.taglinePlaceholder")}
            maxLength={140}
          />
          <TextField
            label={t("admin.settings.profile.contactEmail")}
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            maxLength={254}
          />
          <TextField label={t("admin.settings.profile.phone")} type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={40} />
          <TextField label={t("admin.settings.profile.address")} value={address} onChange={(event) => setAddress(event.target.value)} maxLength={200} />
          <TextField label={t("admin.settings.profile.website")} value={website} onChange={(event) => setWebsite(event.target.value)} maxLength={200} />
          <TextAreaField
            label={t("admin.settings.profile.openingHours")}
            hint={t("admin.settings.profile.openingHoursHint")}
            value={openingHours}
            onChange={(event) => setOpeningHours(event.target.value)}
            maxLength={600}
            rows={3}
            className="sm:col-span-2"
          />
        </div>
      </Card>

      <Card padding="lg">
        <SectionHeading title={t("admin.settings.branding.heading")} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex flex-col gap-4">
            <ColorField label={t("admin.settings.branding.primary")} value={primaryColor} onChange={setPrimaryColor} />
            <ColorField label={t("admin.settings.branding.accent")} value={accentColor} onChange={setAccentColor} />
            <p className="text-[13px] text-ink-3">{t("admin.settings.branding.hint")}</p>
          </div>
          <div>
            <p className="font-label mb-2 text-[10.5px] text-ink-3">{t("admin.settings.branding.preview")}</p>
            {/* The same variables the whole app is themed with, scoped to this box. */}
            <div
              style={colorsValid ? clubThemeStyle({ primaryColor, accentColor }) : undefined}
              className="bg-ruled rounded-card bg-brand p-5 text-brand-ink"
            >
              <p className="font-label text-[10.5px] text-accent">{name || settings.name}</p>
              <p className="font-display mt-2 text-2xl">{t("admin.settings.branding.previewTitle")}</p>
              <span className="mt-4 inline-flex h-10 items-center rounded-control bg-accent px-4 text-sm font-semibold text-accent-ink">
                {t("admin.settings.branding.previewButton")}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card padding="lg">
        <SectionHeading title={t("admin.settings.policy.heading")} />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField
            label={t("admin.settings.policy.language")}
            hint={t("admin.settings.policy.languageHint")}
            value={defaultLanguage}
            onChange={(event) => setDefaultLanguage(event.target.value as Locale)}
          >
            <option value="nl">{t("common.language.nl")}</option>
            <option value="en">{t("common.language.en")}</option>
          </SelectField>
          <SelectField
            label={t("admin.settings.policy.registration")}
            value={selfRegistration}
            onChange={(event) => setSelfRegistration(event.target.value as SelfRegistration)}
          >
            <option value="closed">{t("admin.settings.policy.registrationClosed")}</option>
            <option value="approval">{t("admin.settings.policy.registrationApproval")}</option>
            <option value="open">{t("admin.settings.policy.registrationOpen")}</option>
          </SelectField>
          <Switch
            checked={autoApproveRounds}
            onChange={setAutoApproveRounds}
            label={t("admin.settings.policy.autoApprove")}
            description={t("admin.settings.policy.autoApproveHint")}
            className="sm:col-span-2"
          />
        </div>
      </Card>

      <FormError>{error}</FormError>
      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={busy} icon={<Save className="size-4" />}>
          {t("admin.settings.save")}
        </Button>
      </div>
    </form>
  );
}

interface AccessLinkCardProps {
  kind: "join" | "board";
  /** Path of the public page, e.g. `/join/K7M2QX`. */
  path: string;
  /** Shown large for the join code; the board has only a link. */
  code?: string;
  note?: string;
}

const subscribeToNothing = () => () => {};

/** A shareable public link with its QR code, and a way to invalidate it. */
export function AccessLinkCard({ kind, path, code, note }: AccessLinkCardProps) {
  const t = useT();
  const { run, busy } = useAction();
  const [confirming, setConfirming] = useState(false);
  // The absolute link can only be known in the browser; the server renders the path.
  const origin = useSyncExternalStore(subscribeToNothing, () => window.location.origin, () => "");
  const url = `${origin}${path}`;

  async function regenerate() {
    const result = await run(
      () => api.post("/api/admin/settings", { action: kind === "join" ? "regenerate-join-code" : "regenerate-board-token" }),
      { success: t(`admin.settings.${kind}.regenerated`) },
    );
    if (result.ok) setConfirming(false);
  }

  return (
    <Card padding="lg" className="min-w-0">
      <SectionHeading title={t(`admin.settings.${kind}.heading`)} />
      <p className="-mt-1 text-sm text-pretty text-ink-2">{t(`admin.settings.${kind}.lead`)}</p>

      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element -- an SVG generated per request; nothing for the image optimiser to do */}
        <img
          src={`/api/qr?path=${encodeURIComponent(path)}`}
          alt={t(`admin.settings.${kind}.qrAlt`)}
          width={148}
          height={148}
          className="size-36 shrink-0 rounded-2xl border border-line bg-white p-2"
        />
        <div className="min-w-0 flex-1">
          {code ? (
            <>
              <p className="font-label text-[10.5px] text-ink-3">{t("admin.settings.join.code")}</p>
              <p className="flex items-center gap-1">
                <span className="font-score text-3xl tracking-[0.14em]">{code}</span>
                <CopyButton value={code} label={t("admin.settings.join.code")} />
              </p>
            </>
          ) : null}
          <p className={`font-label text-[10.5px] text-ink-3 ${code ? "mt-3" : ""}`}>{t(`admin.settings.${kind}.link`)}</p>
          <p className="flex items-center gap-1">
            <span className="min-w-0 truncate text-sm font-semibold">
              {url}
            </span>
            <CopyButton value={url} label={t(`admin.settings.${kind}.link`)} />
          </p>
          {note ? <p className="mt-2 text-[13px] text-over">{note}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {kind === "board" ? (
              <LinkButton variant="secondary" size="sm" href={path} target="_blank" icon={<ExternalLink className="size-4" />}>
                {t("admin.settings.board.open")}
              </LinkButton>
            ) : null}
            <Button variant="ghost" size="sm" icon={<RefreshCw className="size-4" />} onClick={() => setConfirming(true)}>
              {t(`admin.settings.${kind}.regenerate`)}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t(`admin.settings.${kind}.regenerateTitle`)}
        description={t(`admin.settings.${kind}.regenerateLead`)}
        confirmLabel={t(`admin.settings.${kind}.regenerate`)}
        tone="danger"
        busy={busy}
        onConfirm={regenerate}
      />
    </Card>
  );
}
