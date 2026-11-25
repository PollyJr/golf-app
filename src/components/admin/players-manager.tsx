"use client";

import { Download, KeyRound, Pencil, Search, UserCheck, UserPlus, UserX, Users } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { ConfirmDialog } from "./common";
import { CredentialsDialog, type CredentialEntry } from "./credentials-dialog";
import { useAction } from "./use-action";
import { useFormat, useT } from "@/components/providers";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton, LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { FormError, Segmented, TextAreaField, TextField } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { formatClubIndex } from "@/lib/golf/club-index";
import type { AdminPlayer, IssuedCredentials } from "@/lib/types";

type Filter = "all" | "active" | "inactive" | "pending";

type Modal =
  | { kind: "new" }
  | { kind: "bulk" }
  | { kind: "edit"; player: AdminPlayer }
  | { kind: "reset"; player: AdminPlayer }
  | { kind: "deactivate"; player: AdminPlayer }
  | { kind: "reject"; player: AdminPlayer };

interface PlayersManagerProps {
  players: AdminPlayer[];
  initialFilter: Filter;
  clubName: string;
}

const MAX_BULK = 100;
const GRID = "md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.1fr)_4.5rem_4.5rem_minmax(0,1.2fr)_8.5rem]";

function matchesFilter(player: AdminPlayer, filter: Filter): boolean {
  const pending = player.registrationStatus === "pending";
  if (filter === "pending") return pending;
  if (filter === "active") return player.active && !pending;
  if (filter === "inactive") return !player.active && !pending;
  return true;
}

export function PlayersManager({ players, initialFilter, clubName }: PlayersManagerProps) {
  const t = useT();
  const { locale, timeZone } = useFormat();
  const { run, busy } = useAction();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<Modal | null>(null);
  const [issued, setIssued] = useState<{ title: string; entries: CredentialEntry[] } | null>(null);

  const counts = useMemo(
    () => ({
      all: players.length,
      active: players.filter((player) => matchesFilter(player, "active")).length,
      inactive: players.filter((player) => matchesFilter(player, "inactive")).length,
      pending: players.filter((player) => matchesFilter(player, "pending")).length,
    }),
    [players],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase().replace(/^@/, "");
    return players.filter(
      (player) =>
        matchesFilter(player, filter) &&
        (term === "" ||
          player.name.toLowerCase().includes(term) ||
          player.username.toLowerCase().includes(term) ||
          player.code.toLowerCase().includes(term)),
    );
  }, [players, filter, search]);

  const toEntry = (credentials: IssuedCredentials): CredentialEntry => ({
    title: credentials.name,
    rows: [
      { label: t("admin.secret.code"), value: credentials.code },
      { label: t("admin.secret.username"), value: credentials.username },
      { label: t("admin.secret.pin"), value: credentials.pin, emphasize: true },
    ],
  });

  async function act(player: AdminPlayer, action: "activate" | "deactivate" | "approve" | "reject", success: string) {
    const result = await run(() => api.patch(`/api/admin/players/${player.id}`, { action }), { success });
    if (result.ok) setModal(null);
  }

  async function resetPin(player: AdminPlayer) {
    const result = await run(() =>
      api.patch<{ credentials: IssuedCredentials }>(`/api/admin/players/${player.id}`, { action: "reset-pin" }),
    );
    if (!result.ok) return;
    setModal(null);
    setIssued({ title: t("admin.players.resetDoneTitle", { name: player.name }), entries: [toEntry(result.data.credentials)] });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button icon={<UserPlus className="size-4" />} onClick={() => setModal({ kind: "new" })}>
          {t("admin.players.add")}
        </Button>
        <Button variant="secondary" icon={<Users className="size-4" />} onClick={() => setModal({ kind: "bulk" })}>
          {t("admin.players.bulk")}
        </Button>
        <LinkButton variant="ghost" href="/api/admin/players/export" download icon={<Download className="size-4" />}>
          {t("admin.players.export")}
        </LinkButton>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented<Filter>
          label={t("admin.players.filter.label")}
          value={filter}
          onChange={setFilter}
          options={(["all", "active", "inactive", "pending"] as const).map((value) => ({
            value,
            label: (
              <span className="inline-flex items-center gap-1.5">
                {t(`admin.players.filter.${value}`)}
                <span className="tabular text-xs opacity-70">{counts[value]}</span>
              </span>
            ),
          }))}
        />
        <label className="relative w-full sm:w-80">
          <span className="sr-only">{t("admin.players.search")}</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("admin.players.search")}
            className="h-11 w-full rounded-control border border-line-strong bg-surface pr-3 pl-10 text-sm placeholder:text-ink-3 focus:border-brand-fg focus:ring-3 focus:ring-brand-fg/15 focus:outline-none"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={<Users className="size-5" />} title={t("admin.players.empty")} description={t("admin.players.emptyLead")} />
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <div className={`font-label hidden gap-4 border-b border-line bg-well px-5 py-2.5 text-[10.5px] text-ink-3 md:grid ${GRID}`}>
            <span>{t("admin.players.columns.player")}</span>
            <span>{t("admin.players.columns.code")}</span>
            <span className="text-right">{t("admin.players.columns.index")}</span>
            <span className="text-right">{t("admin.players.columns.rounds")}</span>
            <span>{t("admin.players.columns.lastLogin")}</span>
            <span className="text-right">{t("admin.players.columns.actions")}</span>
          </div>
          <ul>
            {visible.map((player) => {
              const pending = player.registrationStatus === "pending";
              return (
                <li key={player.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-b-0 md:px-5 ${GRID}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={player.name} initials={player.initials} guest={!player.active || pending} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{player.name}</p>
                      <p className="truncate text-[13px] text-ink-3">
                        @{player.username}
                        {player.email ? ` · ${player.email}` : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1 empty:hidden">
                        {pending ? <Badge tone="gold">{t("admin.players.badges.pending")}</Badge> : null}
                        {!player.active && !pending ? <Badge>{t("admin.players.badges.inactive")}</Badge> : null}
                        {player.locked ? <Badge tone="over">{t("admin.players.badges.locked")}</Badge> : null}
                        {player.mustChangePin && player.active && !pending ? <Badge tone="info">{t("admin.players.badges.mustChangePin")}</Badge> : null}
                      </div>
                    </div>
                  </div>

                  <p className="tabular order-3 col-span-2 text-[13px] text-ink-2 md:order-none md:col-span-1 md:text-sm md:font-semibold md:text-ink">
                    <span className="md:hidden">{t("admin.players.columns.code")}: </span>
                    {player.code}
                    <span className="md:hidden">
                      {" · "}
                      {t("common.clubIndex")} {formatClubIndex(player.clubIndex, locale)}
                      {" · "}
                      {t("common.rounds", { count: player.rounds })}
                    </span>
                  </p>
                  <p className="font-score hidden text-right text-base md:block">{formatClubIndex(player.clubIndex, locale)}</p>
                  <p className="tabular hidden text-right text-sm md:block">{player.rounds}</p>
                  <p className="hidden text-[13px] text-ink-2 md:block">
                    {player.lastLoginAt ? formatDateTime(player.lastLoginAt, locale, timeZone) : t("admin.players.never")}
                  </p>

                  {/* Two labelled buttons need a row of their own on a phone. */}
                  <div className={`flex items-center justify-end gap-1 ${pending ? "order-4 col-span-2 md:order-none md:col-span-1" : ""}`}>
                    {pending ? (
                      <>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setModal({ kind: "reject", player })}>
                          {t("admin.players.actions.reject")}
                        </Button>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => void act(player, "approve", t("admin.players.approved", { name: player.name }))}
                        >
                          {t("admin.players.actions.approve")}
                        </Button>
                      </>
                    ) : (
                      <>
                        <IconButton size="sm" label={`${t("admin.players.actions.edit")}: ${player.name}`} onClick={() => setModal({ kind: "edit", player })}>
                          <Pencil className="size-4" />
                        </IconButton>
                        <IconButton size="sm" label={`${t("admin.players.actions.resetPin")}: ${player.name}`} onClick={() => setModal({ kind: "reset", player })}>
                          <KeyRound className="size-4" />
                        </IconButton>
                        {player.active ? (
                          <IconButton size="sm" label={`${t("admin.players.actions.deactivate")}: ${player.name}`} onClick={() => setModal({ kind: "deactivate", player })}>
                            <UserX className="size-4" />
                          </IconButton>
                        ) : (
                          <IconButton
                            size="sm"
                            label={`${t("admin.players.actions.activate")}: ${player.name}`}
                            disabled={busy}
                            onClick={() => void act(player, "activate", t("admin.players.activated", { name: player.name }))}
                          >
                            <UserCheck className="size-4" />
                          </IconButton>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <NewPlayerDialog
        open={modal?.kind === "new"}
        onClose={() => setModal(null)}
        onCreated={(credentials) => {
          setModal(null);
          setIssued({ title: t("admin.players.createdTitle"), entries: [toEntry(credentials)] });
        }}
      />
      <BulkPlayersDialog
        open={modal?.kind === "bulk"}
        onClose={() => setModal(null)}
        onCreated={(list) => {
          setModal(null);
          setIssued({ title: t("admin.players.bulkCreatedTitle", { count: list.length }), entries: list.map(toEntry) });
        }}
      />
      {modal?.kind === "edit" ? <EditPlayerDialog key={modal.player.id} player={modal.player} onClose={() => setModal(null)} /> : null}

      <ConfirmDialog
        open={modal?.kind === "reset"}
        onClose={() => setModal(null)}
        title={t("admin.players.resetTitle")}
        description={modal?.kind === "reset" ? t("admin.players.resetLead", { name: modal.player.name }) : null}
        confirmLabel={t("admin.players.resetConfirm")}
        busy={busy}
        onConfirm={() => (modal?.kind === "reset" ? resetPin(modal.player) : undefined)}
      />
      <ConfirmDialog
        open={modal?.kind === "deactivate"}
        onClose={() => setModal(null)}
        title={modal?.kind === "deactivate" ? t("admin.players.deactivateTitle", { name: modal.player.name }) : ""}
        description={t("admin.players.deactivateLead")}
        confirmLabel={t("admin.players.actions.deactivate")}
        tone="danger"
        busy={busy}
        onConfirm={() =>
          modal?.kind === "deactivate" ? act(modal.player, "deactivate", t("admin.players.deactivated", { name: modal.player.name })) : undefined
        }
      />
      <ConfirmDialog
        open={modal?.kind === "reject"}
        onClose={() => setModal(null)}
        title={modal?.kind === "reject" ? t("admin.players.rejectTitle", { name: modal.player.name }) : ""}
        description={t("admin.players.rejectLead")}
        confirmLabel={t("admin.players.actions.reject")}
        tone="danger"
        busy={busy}
        onConfirm={() => (modal?.kind === "reject" ? act(modal.player, "reject", t("admin.players.rejected")) : undefined)}
      />

      <CredentialsDialog
        open={issued !== null}
        onClose={() => setIssued(null)}
        title={issued?.title ?? ""}
        entries={issued?.entries ?? []}
        printNote={t("admin.secret.printPinNote")}
        clubName={clubName}
      />
    </>
  );
}

function NewPlayerDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (credentials: IssuedCredentials) => void }) {
  const t = useT();
  const { run, busy } = useAction();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await run(() =>
      api.post<{ credentials: IssuedCredentials }>("/api/admin/players", { displayName: name.trim(), email: email.trim() || null }),
    );
    if (!result.ok) return;
    setName("");
    setEmail("");
    onCreated(result.data.credentials);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("admin.players.newTitle")}
      description={t("admin.players.newLead")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="new-player-form" loading={busy} disabled={name.trim().length < 2}>
            {t("admin.players.create")}
          </Button>
        </>
      }
    >
      <form id="new-player-form" onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label={t("admin.players.name")}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("admin.players.namePlaceholder")}
          maxLength={80}
          autoComplete="off"
          required
        />
        <TextField
          label={
            <>
              {t("admin.players.email")} <span className="font-normal text-ink-3">({t("common.optional")})</span>
            </>
          }
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
          autoComplete="off"
        />
      </form>
    </Dialog>
  );
}

function BulkPlayersDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (credentials: IssuedCredentials[]) => void }) {
  const t = useT();
  const { run, busy } = useAction();
  const [text, setText] = useState("");
  const names = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const problem =
    names.length > MAX_BULK
      ? t("admin.players.bulkTooMany")
      : names.some((name) => name.length < 2 || name.length > 80)
        ? t("admin.players.bulkInvalid")
        : "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await run(() => api.post<{ credentials: IssuedCredentials[] }>("/api/admin/players/bulk", { names }));
    if (!result.ok) return;
    setText("");
    onCreated(result.data.credentials);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("admin.players.bulkTitle")}
      description={t("admin.players.bulkLead")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="bulk-players-form" loading={busy} disabled={names.length === 0 || problem !== ""}>
            {t("admin.players.bulkCreate")}
          </Button>
        </>
      }
    >
      <form id="bulk-players-form" onSubmit={submit} className="flex flex-col gap-3">
        <TextAreaField
          label={t("admin.players.bulkLabel")}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("admin.players.bulkPlaceholder")}
          rows={8}
          hint={t("admin.players.bulkCount", { count: names.length })}
          spellCheck={false}
        />
        <FormError>{problem}</FormError>
      </form>
    </Dialog>
  );
}

function EditPlayerDialog({ player, onClose }: { player: AdminPlayer; onClose: () => void }) {
  const t = useT();
  const { run, busy } = useAction();
  const [name, setName] = useState(player.name);
  const [email, setEmail] = useState(player.email ?? "");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await run(
      () => api.patch(`/api/admin/players/${player.id}`, { action: "update", displayName: name.trim(), email: email.trim() || null }),
      { success: t("admin.players.saved") },
    );
    if (result.ok) onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("admin.players.editTitle")}
      description={`${player.code} · @${player.username}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="edit-player-form" loading={busy} disabled={name.trim().length < 2}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <form id="edit-player-form" onSubmit={submit} className="flex flex-col gap-4">
        <TextField label={t("admin.players.name")} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
        <TextField
          label={
            <>
              {t("admin.players.email")} <span className="font-normal text-ink-3">({t("common.optional")})</span>
            </>
          }
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
        />
      </form>
    </Dialog>
  );
}
