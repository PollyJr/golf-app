"use client";

import { Megaphone, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "./common";
import { useAction } from "./use-action";
import { useFormat, useT } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { FormError, SelectField, Switch, TextAreaField, TextField } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { dateToZonedInput, formatDate, zonedInputToDate } from "@/lib/format";
import type { ContentKind, NewsItem } from "@/lib/types";

const KINDS: ContentKind[] = ["news", "announcement", "rules"];

function isExpired(item: NewsItem): boolean {
  return item.expiresAt !== null && new Date(item.expiresAt).getTime() <= Date.now();
}

/** Club news, announcements and course rules: list, write, edit, remove. */
export function NewsManager({ items }: { items: NewsItem[] }) {
  const t = useT();
  const { locale, timeZone } = useFormat();
  const { run, busy } = useAction();
  const [editing, setEditing] = useState<NewsItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<NewsItem | null>(null);

  async function remove(item: NewsItem) {
    const result = await run(() => api.delete(`/api/admin/news/${item.id}`), { success: t("admin.news.editor.deleted") });
    if (result.ok) setDeleting(null);
  }

  return (
    <>
      <div className="mb-5">
        <Button icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
          {t("admin.news.add")}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<Megaphone className="size-5" />} title={t("admin.news.empty")} description={t("admin.news.emptyLead")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={item.kind === "announcement" ? "info" : item.kind === "rules" ? "brand" : "neutral"}>
                    {t(`admin.news.kind.${item.kind}`)}
                  </Badge>
                  {item.pinned ? (
                    <Badge tone="accent" icon={<Pin className="size-3" />}>
                      {t("admin.news.pinned")}
                    </Badge>
                  ) : null}
                  {item.publishedAt === null ? <Badge tone="gold">{t("admin.news.draft")}</Badge> : null}
                  {isExpired(item) ? <Badge tone="over">{t("admin.news.expired")}</Badge> : null}
                </div>
                <h2 className="mt-2 font-semibold">{item.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-ink-2">{item.body}</p>
                <p className="mt-2 text-xs text-ink-3">
                  {item.publishedAt
                    ? t("admin.news.publishedOn", { date: formatDate(item.publishedAt, locale, timeZone) })
                    : t("admin.news.createdOn", { date: formatDate(item.createdAt, locale, timeZone) })}
                  {item.authorName ? ` · ${item.authorName}` : ""}
                  {item.expiresAt && !isExpired(item) ? ` · ${t("admin.news.expiresOn", { date: formatDate(item.expiresAt, locale, timeZone) })}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <IconButton size="sm" label={`${t("common.edit")}: ${item.title}`} onClick={() => setEditing(item)}>
                  <Pencil className="size-4" />
                </IconButton>
                <IconButton size="sm" label={`${t("common.delete")}: ${item.title}`} onClick={() => setDeleting(item)}>
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing !== null ? (
        <NewsEditor
          key={editing === "new" ? "new" : editing.id}
          item={editing === "new" ? null : editing}
          timeZone={timeZone}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t("admin.news.editor.deleteTitle")}
        description={t("admin.news.editor.deleteLead")}
        confirmLabel={t("common.delete")}
        tone="danger"
        busy={busy}
        onConfirm={() => (deleting ? remove(deleting) : undefined)}
      />
    </>
  );
}

function NewsEditor({ item, timeZone, onClose }: { item: NewsItem | null; timeZone: string; onClose: () => void }) {
  const t = useT();
  const { run, busy } = useAction();
  const [kind, setKind] = useState<ContentKind>(item?.kind ?? "news");
  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [pinned, setPinned] = useState(item?.pinned ?? false);
  const [published, setPublished] = useState(item ? item.publishedAt !== null : true);
  const [expiresAt, setExpiresAt] = useState(item?.expiresAt ? dateToZonedInput(item.expiresAt, timeZone) : "");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (title.trim().length < 2 || body.trim().length < 1) return setError(t("admin.news.editor.invalid"));
    const expires = expiresAt ? zonedInputToDate(expiresAt, timeZone) : null;
    const payload = {
      kind,
      title: title.trim(),
      body: body.trim(),
      pinned,
      published,
      expiresAt: expires?.toISOString() ?? null,
    };
    const result = await run(
      () => (item ? api.put(`/api/admin/news/${item.id}`, payload) : api.post("/api/admin/news", payload)),
      { success: t("admin.news.editor.saved") },
    );
    if (result.ok) onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={item ? t("admin.news.editor.editTitle") : t("admin.news.editor.newTitle")}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="news-editor-form" loading={busy}>
            {t("admin.news.editor.save")}
          </Button>
        </>
      }
    >
      <form id="news-editor-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <SelectField label={t("admin.news.editor.kindLabel")} value={kind} onChange={(event) => setKind(event.target.value as ContentKind)}>
            {KINDS.map((value) => (
              <option key={value} value={value}>
                {t(`admin.news.kind.${value}`)}
              </option>
            ))}
          </SelectField>
          <TextField label={t("admin.news.editor.titleLabel")} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={140} required />
        </div>
        <TextAreaField
          label={t("admin.news.editor.body")}
          hint={t("admin.news.editor.bodyHint")}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={8000}
          rows={9}
          required
        />
        <TextField
          label={
            <>
              {t("admin.news.editor.expiresAt")} <span className="font-normal text-ink-3">({t("common.optional")})</span>
            </>
          }
          type="datetime-local"
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
          hint={t("admin.news.editor.expiresHint")}
          className="sm:max-w-xs"
        />
        <Switch checked={pinned} onChange={setPinned} label={t("admin.news.editor.pinnedLabel")} />
        <Switch
          checked={published}
          onChange={setPublished}
          label={t("admin.news.editor.publishedLabel")}
          description={t("admin.news.editor.publishedHint")}
        />
        <FormError>{error}</FormError>
      </form>
    </Dialog>
  );
}
