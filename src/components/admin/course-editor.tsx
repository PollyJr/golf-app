"use client";

import { Archive, ArchiveRestore, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "./common";
import { DeleteButton } from "./delete-button";
import { useAction } from "./use-action";
import { useT } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card, SectionHeading } from "@/components/ui/card";
import { FormError, Segmented, TextAreaField, TextField } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import type { CourseDto } from "@/lib/types";
import { HEX_COLOR_PATTERN } from "@/lib/validation";

interface HoleDraft {
  par: string;
  distance: string;
  name: string;
  tip: string;
}

const NEW_HOLE: HoleDraft = { par: "3", distance: "50", name: "", tip: "" };
const DEFAULT_ACCENT = "#c9f04b";
const CELL =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink placeholder:text-ink-3 focus:border-brand-fg focus:ring-3 focus:ring-brand-fg/15 focus:outline-none";

function toDrafts(course: CourseDto | null): HoleDraft[] {
  if (!course) return Array.from({ length: 9 }, () => ({ ...NEW_HOLE }));
  return course.holes.map((hole) => ({
    par: String(hole.par),
    distance: String(hole.distance),
    name: hole.name ?? "",
    tip: hole.tip ?? "",
  }));
}

function isWholeNumber(value: string, min: number, max: number): boolean {
  if (!/^\d+$/.test(value)) return false;
  const parsed = Number(value);
  return parsed >= min && parsed <= max;
}

/** Create or edit a course: its details and the par and distance of every hole. */
export function CourseEditor({ course }: { course: CourseDto | null }) {
  const t = useT();
  const router = useRouter();
  const { run, busy } = useAction();
  const [name, setName] = useState(course?.name ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [teeName, setTeeName] = useState(course?.tee ?? "Club");
  const [accent, setAccent] = useState(course?.accent ?? DEFAULT_ACCENT);
  const [holes, setHoles] = useState<HoleDraft[]>(() => toDrafts(course));
  const [error, setError] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);

  const holeCount = holes.length === 18 ? "18" : "9";
  const totalPar = holes.reduce((sum, hole) => sum + (Number(hole.par) || 0), 0);
  const totalLength = holes.reduce((sum, hole) => sum + (Number(hole.distance) || 0), 0);

  function changeHoleCount(next: "9" | "18") {
    setHoles((current) => {
      if (next === "9") return current.slice(0, 9);
      // Going to eighteen: start the back nine as a copy of the front nine.
      return [...current.slice(0, 9), ...current.slice(0, 9).map((hole) => ({ ...hole, name: "", tip: "" }))];
    });
  }

  function updateHole(index: number, field: keyof HoleDraft, value: string) {
    setHoles((current) => current.map((hole, position) => (position === index ? { ...hole, [field]: value } : hole)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (name.trim().length < 2) return setError(t("admin.courses.editor.invalidName"));
    if (holes.some((hole) => !isWholeNumber(hole.par, 2, 6) || !isWholeNumber(hole.distance, 1, 999))) {
      return setError(t("admin.courses.editor.invalidHoles"));
    }
    const body = {
      name: name.trim(),
      description: description.trim(),
      holeCount: holes.length,
      teeName: teeName.trim() || "Club",
      accent: HEX_COLOR_PATTERN.test(accent) ? accent : DEFAULT_ACCENT,
      holes: holes.map((hole) => ({
        par: Number(hole.par),
        distance: Number(hole.distance),
        name: hole.name.trim() || null,
        tip: hole.tip.trim() || null,
      })),
    };
    const result = await run(
      () => (course ? api.put(`/api/admin/courses/${course.id}`, body) : api.post("/api/admin/courses", body)),
      { success: course ? t("admin.courses.editor.saved") : t("admin.courses.editor.created"), refresh: false },
    );
    if (!result.ok) return;
    router.push("/admin/courses");
    router.refresh();
  }

  async function setActive(active: boolean) {
    if (!course) return;
    const result = await run(() => api.patch(`/api/admin/courses/${course.id}`, { active }), {
      success: active ? t("admin.courses.editor.restoredToast") : t("admin.courses.editor.archivedToast"),
    });
    if (result.ok) setConfirmArchive(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <Card padding="lg">
        <SectionHeading title={t("admin.courses.editor.details")} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label={t("admin.courses.editor.name")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            required
            className="sm:col-span-2"
          />
          <TextAreaField
            label={t("admin.courses.editor.description")}
            hint={t("admin.courses.editor.descriptionHint")}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            rows={3}
            className="sm:col-span-2"
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">{t("admin.courses.editor.holeCount")}</span>
            <Segmented<"9" | "18">
              label={t("admin.courses.editor.holeCount")}
              value={holeCount}
              onChange={changeHoleCount}
              options={[
                { value: "9", label: t("common.holes", { count: 9 }) },
                { value: "18", label: t("common.holes", { count: 18 }) },
              ]}
              className="self-start"
            />
          </div>
          <TextField label={t("admin.courses.editor.teeName")} value={teeName} onChange={(event) => setTeeName(event.target.value)} maxLength={40} />
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">{t("admin.courses.editor.accent")}</span>
            <span className="flex items-center gap-3">
              <input
                type="color"
                value={HEX_COLOR_PATTERN.test(accent) ? accent : DEFAULT_ACCENT}
                onChange={(event) => setAccent(event.target.value)}
                className="h-12 w-16 cursor-pointer rounded-control border border-line-strong bg-surface p-1"
              />
              <span className="tabular text-sm text-ink-2">{accent}</span>
            </span>
          </label>
        </div>
      </Card>

      <Card padding="lg">
        <SectionHeading
          title={t("admin.courses.editor.holes")}
          action={<span className="font-semibold text-ink-2">{t("admin.courses.editor.totals", { par: totalPar, length: totalLength })}</span>}
        />
        <p className="-mt-1 mb-4 text-sm text-ink-2">{t("admin.courses.editor.holesLead")}</p>

        <div className="font-label mb-1.5 hidden grid-cols-[2.25rem_4.5rem_6.5rem_minmax(0,1fr)_minmax(0,1.6fr)] gap-2 px-1 text-[10.5px] text-ink-3 md:grid">
          <span>{t("common.hole")}</span>
          <span>{t("admin.courses.editor.par")}</span>
          <span>{t("admin.courses.editor.distance")}</span>
          <span>{t("admin.courses.editor.holeName")}</span>
          <span>{t("admin.courses.editor.holeTip")}</span>
        </div>
        <ol className="flex flex-col gap-2">
          {holes.map((hole, index) => {
            const number = index + 1;
            return (
              <li
                key={index}
                className="grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-2 rounded-control bg-well p-2 md:grid-cols-[2.25rem_4.5rem_6.5rem_minmax(0,1fr)_minmax(0,1.6fr)] md:bg-transparent md:p-0 md:px-1"
              >
                <span className="font-score text-center text-lg">{number}</span>
                {/* On phones the column headers are hidden, so each cell names itself. */}
                <label className="relative block">
                  <span className="font-label pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[10px] text-ink-3 md:hidden">
                    {t("admin.courses.editor.par")}
                  </span>
                  <input
                    inputMode="numeric"
                    value={hole.par}
                    onChange={(event) => updateHole(index, "par", event.target.value.replace(/\D/g, "").slice(0, 1))}
                    aria-label={t("admin.courses.editor.parOf", { hole: number })}
                    aria-invalid={!isWholeNumber(hole.par, 2, 6) || undefined}
                    className={`${CELL} tabular pl-11 aria-[invalid]:border-danger md:pl-2.5`}
                  />
                </label>
                <label className="relative block">
                  <input
                    inputMode="numeric"
                    value={hole.distance}
                    onChange={(event) => updateHole(index, "distance", event.target.value.replace(/\D/g, "").slice(0, 3))}
                    aria-label={t("admin.courses.editor.distanceOf", { hole: number })}
                    aria-invalid={!isWholeNumber(hole.distance, 1, 999) || undefined}
                    className={`${CELL} tabular pr-8 aria-[invalid]:border-danger md:pr-2.5`}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-ink-3 md:hidden">m</span>
                </label>
                <input
                  value={hole.name}
                  onChange={(event) => updateHole(index, "name", event.target.value)}
                  aria-label={t("admin.courses.editor.nameOf", { hole: number })}
                  placeholder={`${t("admin.courses.editor.holeName")} (${t("common.optional")})`}
                  maxLength={60}
                  className={`${CELL} col-span-3 md:col-span-1`}
                />
                <input
                  value={hole.tip}
                  onChange={(event) => updateHole(index, "tip", event.target.value)}
                  aria-label={t("admin.courses.editor.tipOf", { hole: number })}
                  placeholder={`${t("admin.courses.editor.holeTip")} (${t("common.optional")})`}
                  maxLength={400}
                  className={`${CELL} col-span-3 md:col-span-1`}
                />
              </li>
            );
          })}
        </ol>
      </Card>

      <FormError>{error}</FormError>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {course ? (
            course.active ? (
              <Button variant="secondary" icon={<Archive className="size-4" />} onClick={() => setConfirmArchive(true)} disabled={busy}>
                {t("admin.courses.editor.archive")}
              </Button>
            ) : (
              <Button variant="secondary" icon={<ArchiveRestore className="size-4" />} onClick={() => void setActive(true)} disabled={busy}>
                {t("admin.courses.editor.restore")}
              </Button>
            )
          ) : null}
          {course ? (
            <DeleteButton
              endpoint={`/api/admin/courses/${course.id}`}
              redirectTo="/admin/courses"
              label={t("admin.courses.editor.delete")}
              title={t("admin.courses.editor.deleteTitle")}
              description={t("admin.courses.editor.deleteLead")}
              success={t("admin.courses.editor.deleted")}
            />
          ) : null}
        </div>
        <Button type="submit" size="lg" loading={busy} icon={<Save className="size-4" />}>
          {t("admin.courses.editor.save")}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title={t("admin.courses.editor.archiveTitle")}
        description={t("admin.courses.editor.archiveLead")}
        confirmLabel={t("admin.courses.editor.archive")}
        busy={busy}
        onConfirm={() => setActive(false)}
      />
    </form>
  );
}
