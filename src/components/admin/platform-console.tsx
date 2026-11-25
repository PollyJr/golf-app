"use client";

import { Ban, Building2, CirclePlay, KeyRound, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "./common";
import { CredentialsDialog, type CredentialEntry } from "./credentials-dialog";
import { PasswordForm } from "./password-form";
import { useAction } from "./use-action";
import { useFormat, useT, useToast } from "@/components/providers";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import type { ClubStatus } from "@/lib/types";
import type { PlatformClub } from "@/server/services/clubs";

const STATUS_TONES: Record<ClubStatus, Tone> = { trial: "gold", active: "under", suspended: "over" };
const GRID = "lg:grid-cols-[minmax(0,2.2fr)_5rem_5.5rem_5rem_5rem_minmax(0,1fr)_6.5rem_8rem]";

interface CreatedClub {
  id: string;
  ownerEmail: string;
  ownerPassword: string;
}

/** Every club on the platform: create, suspend and reactivate. */
export function PlatformConsole({ clubs }: { clubs: PlatformClub[] }) {
  const t = useT();
  const toast = useToast();
  const { locale, timeZone } = useFormat();
  const { run, busy } = useAction();
  const [creating, setCreating] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [suspending, setSuspending] = useState<PlatformClub | null>(null);
  const [issued, setIssued] = useState<{ clubName: string; entries: CredentialEntry[] } | null>(null);

  async function setStatus(club: PlatformClub, status: ClubStatus, success: string) {
    const result = await run(() => api.patch(`/api/platform/clubs/${club.id}`, { status }), { success });
    if (result.ok) setSuspending(null);
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2">
        <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
          {t("admin.platform.add")}
        </Button>
        <Button variant="ghost" icon={<KeyRound className="size-4" />} onClick={() => setChangingPassword(true)}>
          {t("admin.platform.password")}
        </Button>
      </div>

      {clubs.length === 0 ? (
        <EmptyState icon={<Building2 className="size-5" />} title={t("admin.platform.empty")} description={t("admin.platform.emptyLead")} />
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <div className={`font-label hidden gap-4 border-b border-line bg-well px-5 py-2.5 text-[10.5px] text-ink-3 lg:grid ${GRID}`}>
            <span>{t("admin.platform.columns.club")}</span>
            <span className="text-right">{t("admin.platform.columns.players")}</span>
            <span className="text-right">{t("admin.platform.columns.staff")}</span>
            <span className="text-right">{t("admin.platform.columns.rounds")}</span>
            <span className="text-right">{t("admin.platform.columns.recent")}</span>
            <span>{t("admin.platform.columns.since")}</span>
            <span>{t("admin.platform.columns.status")}</span>
            <span className="text-right">{t("admin.platform.columns.actions")}</span>
          </div>
          <ul>
            {clubs.map((club) => (
              <li key={club.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3.5 last:border-b-0 lg:px-5 ${GRID}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="font-label grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-[12px] text-brand-fg">
                    {club.name.slice(0, 2)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{club.name}</p>
                    <p className="truncate text-[13px] text-ink-3">{club.slug}</p>
                  </div>
                </div>
                <p className="tabular hidden text-right text-sm lg:block">{club.players}</p>
                <p className="tabular hidden text-right text-sm lg:block">{club.staff}</p>
                <p className="tabular hidden text-right text-sm lg:block">{club.rounds}</p>
                <p className="tabular hidden text-right text-sm lg:block">{club.roundsLast30Days}</p>
                <p className="hidden text-[13px] text-ink-2 lg:block">{formatDate(club.createdAt, locale, timeZone)}</p>
                <div className="order-3 col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 lg:order-none lg:col-span-1">
                  <Badge tone={STATUS_TONES[club.status]}>{t(`admin.platform.status.${club.status}`)}</Badge>
                  <span className="text-[13px] text-ink-3 lg:hidden">
                    {t("common.players", { count: club.players })} · {t("common.rounds", { count: club.rounds })}
                  </span>
                </div>
                <div className="flex justify-end">
                  {club.status === "suspended" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<CirclePlay className="size-4" />}
                      disabled={busy}
                      onClick={() => void setStatus(club, "active", t("admin.platform.activated", { name: club.name }))}
                    >
                      {t("admin.platform.activate")}
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" icon={<Ban className="size-4" />} disabled={busy} onClick={() => setSuspending(club)}>
                      {t("admin.platform.suspend")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <NewClubDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(clubName, ownerName, club) => {
          setCreating(false);
          setIssued({
            clubName,
            entries: [
              {
                title: ownerName,
                rows: [
                  { label: t("admin.secret.email"), value: club.ownerEmail },
                  { label: t("admin.secret.password"), value: club.ownerPassword, emphasize: true },
                ],
              },
            ],
          });
        }}
      />

      <Dialog open={changingPassword} onClose={() => setChangingPassword(false)} title={t("admin.platform.password")} size="sm">
        <PasswordForm
          onDone={() => {
            setChangingPassword(false);
            toast.success(t("admin.account.saved"));
          }}
        />
      </Dialog>

      <ConfirmDialog
        open={suspending !== null}
        onClose={() => setSuspending(null)}
        title={suspending ? t("admin.platform.suspendTitle", { name: suspending.name }) : ""}
        description={t("admin.platform.suspendLead")}
        confirmLabel={t("admin.platform.suspend")}
        tone="danger"
        busy={busy}
        onConfirm={() => (suspending ? setStatus(suspending, "suspended", t("admin.platform.suspended", { name: suspending.name })) : undefined)}
      />

      <CredentialsDialog
        open={issued !== null}
        onClose={() => setIssued(null)}
        title={t("admin.platform.createdTitle")}
        entries={issued?.entries ?? []}
        printNote={t("admin.secret.printPasswordNote")}
        clubName={issued?.clubName ?? ""}
      />
    </>
  );
}

interface NewClubDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (clubName: string, ownerName: string, club: CreatedClub) => void;
}

function NewClubDialog({ open, onClose, onCreated }: NewClubDialogProps) {
  const t = useT();
  const { run, busy } = useAction();
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = { name: name.trim(), ownerName: ownerName.trim(), ownerEmail: ownerEmail.trim() };
    const result = await run(() => api.post<{ club: CreatedClub }>("/api/platform/clubs", body));
    if (!result.ok) return;
    setName("");
    setOwnerName("");
    setOwnerEmail("");
    onCreated(body.name, body.ownerName, result.data.club);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("admin.platform.newTitle")}
      description={t("admin.platform.newLead")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="new-club-form"
            loading={busy}
            disabled={name.trim().length < 2 || ownerName.trim().length < 2 || !ownerEmail.includes("@")}
          >
            {t("admin.platform.create")}
          </Button>
        </>
      }
    >
      <form id="new-club-form" onSubmit={submit} className="flex flex-col gap-4">
        <TextField label={t("admin.platform.clubName")} value={name} onChange={(event) => setName(event.target.value)} maxLength={100} autoComplete="off" required />
        <TextField
          label={t("admin.platform.ownerName")}
          value={ownerName}
          onChange={(event) => setOwnerName(event.target.value)}
          maxLength={80}
          autoComplete="off"
          required
        />
        <TextField
          label={t("admin.platform.ownerEmail")}
          type="email"
          value={ownerEmail}
          onChange={(event) => setOwnerEmail(event.target.value)}
          maxLength={254}
          autoComplete="off"
          required
        />
      </form>
    </Dialog>
  );
}
