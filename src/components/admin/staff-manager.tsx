"use client";

import { KeyRound, ShieldCheck, ShieldMinus, UserCheck, UserPlus, UserX } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "./common";
import { CredentialsDialog, type CredentialEntry } from "./credentials-dialog";
import { useAction } from "./use-action";
import { useFormat, useT } from "@/components/providers";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextField } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { StaffMember as StaffRow } from "@/server/services/staff";

interface IssuedPassword {
  email: string;
  password: string;
}

type Modal = { kind: "new" } | { kind: "deactivate"; member: StaffRow } | { kind: "reset"; member: StaffRow };

/** The people who may manage the club, and what each of them may do. */
export function StaffManager({ staff, clubName }: { staff: StaffRow[]; clubName: string }) {
  const t = useT();
  const { locale, timeZone } = useFormat();
  const { run, busy } = useAction();
  const [modal, setModal] = useState<Modal | null>(null);
  const [issued, setIssued] = useState<{ title: string; entries: CredentialEntry[] } | null>(null);

  const toEntry = (name: string, credentials: IssuedPassword): CredentialEntry => ({
    title: name,
    rows: [
      { label: t("admin.secret.email"), value: credentials.email },
      { label: t("admin.secret.password"), value: credentials.password, emphasize: true },
    ],
  });

  async function apply(member: StaffRow, body: Record<string, string>, success: string) {
    const result = await run(() => api.patch(`/api/admin/staff/${member.id}`, body), { success });
    if (result.ok) setModal(null);
  }

  async function resetPassword(member: StaffRow) {
    const result = await run(() =>
      api.patch<{ credentials: IssuedPassword | null }>(`/api/admin/staff/${member.id}`, { action: "reset-password" }),
    );
    if (!result.ok) return;
    setModal(null);
    if (result.data.credentials) {
      setIssued({ title: t("admin.staff.resetDoneTitle", { name: member.name }), entries: [toEntry(member.name, result.data.credentials)] });
    }
  }

  return (
    <>
      <div className="mb-5">
        <Button icon={<UserPlus className="size-4" />} onClick={() => setModal({ kind: "new" })}>
          {t("admin.staff.add")}
        </Button>
      </div>

      <ul className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        {staff.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3.5 last:border-b-0 sm:px-5">
            <Avatar name={member.name} initials={member.initials} guest={!member.active} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-semibold">{member.name}</span>
                <Badge tone={member.role === "club_owner" ? "brand" : "neutral"}>{t(`admin.roles.${member.role}`)}</Badge>
                {member.isSelf ? <Badge tone="accent">{t("admin.staff.you")}</Badge> : null}
                {member.active ? null : <Badge tone="over">{t("admin.staff.inactive")}</Badge>}
              </p>
              <p className="mt-0.5 truncate text-[13px] text-ink-3">
                {member.email}
                {" · "}
                {member.lastLoginAt
                  ? t("admin.staff.lastLogin", { date: formatDateTime(member.lastLoginAt, locale, timeZone) })
                  : t("admin.staff.never")}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              {member.isSelf ? null : member.role === "club_staff" ? (
                <IconButton
                  size="sm"
                  label={`${t("admin.staff.actions.makeOwner")}: ${member.name}`}
                  disabled={busy || !member.active}
                  onClick={() => void apply(member, { action: "role", role: "club_owner" }, t("admin.staff.roleChanged", { name: member.name }))}
                >
                  <ShieldCheck className="size-4" />
                </IconButton>
              ) : (
                <IconButton
                  size="sm"
                  label={`${t("admin.staff.actions.makeStaff")}: ${member.name}`}
                  disabled={busy}
                  onClick={() => void apply(member, { action: "role", role: "club_staff" }, t("admin.staff.roleChanged", { name: member.name }))}
                >
                  <ShieldMinus className="size-4" />
                </IconButton>
              )}
              <IconButton size="sm" label={`${t("admin.staff.actions.resetPassword")}: ${member.name}`} onClick={() => setModal({ kind: "reset", member })}>
                <KeyRound className="size-4" />
              </IconButton>
              {member.isSelf ? null : member.active ? (
                <IconButton size="sm" label={`${t("admin.staff.actions.deactivate")}: ${member.name}`} onClick={() => setModal({ kind: "deactivate", member })}>
                  <UserX className="size-4" />
                </IconButton>
              ) : (
                <IconButton
                  size="sm"
                  label={`${t("admin.staff.actions.activate")}: ${member.name}`}
                  disabled={busy}
                  onClick={() => void apply(member, { action: "activate" }, t("admin.staff.activated", { name: member.name }))}
                >
                  <UserCheck className="size-4" />
                </IconButton>
              )}
            </div>
          </li>
        ))}
      </ul>

      <NewStaffDialog
        open={modal?.kind === "new"}
        onClose={() => setModal(null)}
        onCreated={(name, credentials) => {
          setModal(null);
          setIssued({ title: t("admin.staff.createdTitle"), entries: [toEntry(name, credentials)] });
        }}
      />
      <ConfirmDialog
        open={modal?.kind === "deactivate"}
        onClose={() => setModal(null)}
        title={modal?.kind === "deactivate" ? t("admin.staff.deactivateTitle", { name: modal.member.name }) : ""}
        description={t("admin.staff.deactivateLead")}
        confirmLabel={t("admin.staff.actions.deactivate")}
        tone="danger"
        busy={busy}
        onConfirm={() =>
          modal?.kind === "deactivate"
            ? apply(modal.member, { action: "deactivate" }, t("admin.staff.deactivated", { name: modal.member.name }))
            : undefined
        }
      />
      <ConfirmDialog
        open={modal?.kind === "reset"}
        onClose={() => setModal(null)}
        title={modal?.kind === "reset" ? t("admin.staff.resetTitle", { name: modal.member.name }) : ""}
        description={t("admin.staff.resetLead")}
        confirmLabel={t("admin.staff.resetConfirm")}
        busy={busy}
        onConfirm={() => (modal?.kind === "reset" ? resetPassword(modal.member) : undefined)}
      />
      <CredentialsDialog
        open={issued !== null}
        onClose={() => setIssued(null)}
        title={issued?.title ?? ""}
        entries={issued?.entries ?? []}
        printNote={t("admin.secret.printPasswordNote")}
        clubName={clubName}
      />
    </>
  );
}

function NewStaffDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (name: string, credentials: IssuedPassword) => void }) {
  const t = useT();
  const { run, busy } = useAction();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"club_owner" | "club_staff">("club_staff");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const displayName = name.trim();
    const result = await run(() =>
      api.post<{ credentials: IssuedPassword }>("/api/admin/staff", { displayName, email: email.trim(), role }),
    );
    if (!result.ok) return;
    setName("");
    setEmail("");
    setRole("club_staff");
    onCreated(displayName, result.data.credentials);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("admin.staff.newTitle")}
      description={t("admin.staff.newLead")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="new-staff-form" loading={busy} disabled={name.trim().length < 2 || !email.includes("@")}>
            {t("admin.staff.create")}
          </Button>
        </>
      }
    >
      <form id="new-staff-form" onSubmit={submit} className="flex flex-col gap-4">
        <TextField label={t("admin.staff.name")} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoComplete="off" required />
        <TextField
          label={t("admin.staff.email")}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
          autoComplete="off"
          required
        />
        <SelectField
          label={t("admin.staff.role")}
          hint={t("admin.staff.roleHint")}
          value={role}
          onChange={(event) => setRole(event.target.value as "club_owner" | "club_staff")}
        >
          <option value="club_staff">{t("admin.roles.club_staff")}</option>
          <option value="club_owner">{t("admin.roles.club_owner")}</option>
        </SelectField>
      </form>
    </Dialog>
  );
}
