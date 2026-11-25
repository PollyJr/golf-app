"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DeleteButton } from "./delete-button";
import { useAction } from "./use-action";
import { useT } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card, SectionHeading } from "@/components/ui/card";
import { FormError, SelectField, Switch, TextAreaField, TextField } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import { dateToZonedInput, zonedInputToDate } from "@/lib/format";
import type { EventDto, EventKind } from "@/lib/types";

interface EventEditorProps {
  event: EventDto | null;
  courses: ReadonlyArray<{ id: string; name: string }>;
  timeZone: string;
}

const KINDS: EventKind[] = ["tournament", "clinic", "social"];

/** Create or edit an event. Times are entered in the club's own time zone. */
export function EventEditor({ event, courses, timeZone }: EventEditorProps) {
  const t = useT();
  const router = useRouter();
  const { run, busy } = useAction();
  const local = (value: string | null | undefined) => (value ? dateToZonedInput(value, timeZone) : "");

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [kind, setKind] = useState<EventKind>(event?.kind ?? "tournament");
  const [startsAt, setStartsAt] = useState(local(event?.startsAt));
  const [endsAt, setEndsAt] = useState(local(event?.endsAt));
  const [closesAt, setClosesAt] = useState(local(event?.registrationClosesAt));
  const [location, setLocation] = useState(event?.location ?? "");
  const [courseId, setCourseId] = useState(event?.courseId ?? "");
  const [capacity, setCapacity] = useState(event?.capacity ? String(event.capacity) : "");
  const [leaderboard, setLeaderboard] = useState(event?.leaderboardEnabled ?? false);
  const [published, setPublished] = useState(event?.published ?? true);
  const [error, setError] = useState("");

  async function submit(submitEvent: FormEvent) {
    submitEvent.preventDefault();
    setError("");
    if (title.trim().length < 2) return setError(t("admin.events.editor.invalidTitle"));
    const start = zonedInputToDate(startsAt, timeZone);
    if (!start) return setError(t("admin.events.editor.invalidStart"));
    const end = endsAt ? zonedInputToDate(endsAt, timeZone) : null;
    if (end && end.getTime() < start.getTime()) return setError(t("admin.events.editor.invalidEnd"));
    const closes = closesAt ? zonedInputToDate(closesAt, timeZone) : null;

    const body = {
      title: title.trim(),
      description: description.trim(),
      kind,
      startsAt: start.toISOString(),
      endsAt: end?.toISOString() ?? null,
      registrationClosesAt: closes?.toISOString() ?? null,
      location: location.trim() || null,
      courseId: courseId || null,
      capacity: capacity ? Number(capacity) : null,
      leaderboardEnabled: leaderboard,
      published,
    };
    const result = await run(
      () => (event ? api.put(`/api/admin/events/${event.id}`, body) : api.post("/api/admin/events", body)),
      { success: event ? t("admin.events.editor.saved") : t("admin.events.editor.created"), refresh: false },
    );
    if (!result.ok) return;
    router.push("/admin/events");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <Card padding="lg">
        <SectionHeading title={t("admin.events.editor.details")} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label={t("admin.events.editor.titleLabel")}
            value={title}
            onChange={(changeEvent) => setTitle(changeEvent.target.value)}
            maxLength={120}
            required
            className="sm:col-span-2"
          />
          <TextAreaField
            label={t("admin.events.editor.description")}
            value={description}
            onChange={(changeEvent) => setDescription(changeEvent.target.value)}
            maxLength={4000}
            rows={4}
            className="sm:col-span-2"
          />
          <SelectField label={t("admin.events.editor.kind")} value={kind} onChange={(changeEvent) => setKind(changeEvent.target.value as EventKind)}>
            {KINDS.map((value) => (
              <option key={value} value={value}>
                {t(`common.eventKind.${value}`)}
              </option>
            ))}
          </SelectField>
        </div>
      </Card>

      <Card padding="lg">
        <SectionHeading title={t("admin.events.editor.when")} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label={t("admin.events.editor.startsAt")}
            type="datetime-local"
            value={startsAt}
            onChange={(changeEvent) => setStartsAt(changeEvent.target.value)}
            required
          />
          <TextField
            label={
              <>
                {t("admin.events.editor.endsAt")} <span className="font-normal text-ink-3">({t("common.optional")})</span>
              </>
            }
            type="datetime-local"
            value={endsAt}
            min={startsAt || undefined}
            onChange={(changeEvent) => setEndsAt(changeEvent.target.value)}
          />
          <TextField
            label={
              <>
                {t("admin.events.editor.registrationClosesAt")} <span className="font-normal text-ink-3">({t("common.optional")})</span>
              </>
            }
            type="datetime-local"
            value={closesAt}
            onChange={(changeEvent) => setClosesAt(changeEvent.target.value)}
            hint={t("admin.events.editor.registrationHint")}
          />
        </div>
        <p className="mt-3 text-[13px] text-ink-3">{t("admin.events.editor.timeZoneNote", { zone: timeZone })}</p>
      </Card>

      <Card padding="lg">
        <SectionHeading title={t("admin.events.editor.where")} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label={t("admin.events.editor.location")}
            value={location}
            onChange={(changeEvent) => setLocation(changeEvent.target.value)}
            placeholder={t("admin.events.editor.locationPlaceholder")}
            maxLength={120}
          />
          <SelectField label={t("admin.events.editor.course")} value={courseId} onChange={(changeEvent) => setCourseId(changeEvent.target.value)}>
            <option value="">{t("admin.events.editor.noCourse")}</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </SelectField>
          <TextField
            label={t("admin.events.editor.capacity")}
            inputMode="numeric"
            value={capacity}
            onChange={(changeEvent) => setCapacity(changeEvent.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 4))}
            hint={t("admin.events.editor.capacityHint")}
          />
        </div>
      </Card>

      <Card padding="lg">
        <SectionHeading title={t("admin.events.editor.options")} />
        <div className="flex flex-col gap-5">
          <Switch
            checked={leaderboard}
            onChange={setLeaderboard}
            label={t("admin.events.editor.leaderboard")}
            description={t("admin.events.editor.leaderboardHint")}
          />
          <Switch
            checked={published}
            onChange={setPublished}
            label={t("admin.events.editor.published")}
            description={t("admin.events.editor.publishedHint")}
          />
        </div>
      </Card>

      <FormError>{error}</FormError>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {event ? (
            <DeleteButton
              endpoint={`/api/admin/events/${event.id}`}
              redirectTo="/admin/events"
              label={t("admin.events.editor.delete")}
              title={t("admin.events.editor.deleteTitle")}
              description={t("admin.events.editor.deleteLead")}
              success={t("admin.events.editor.deleted")}
            />
          ) : null}
        </div>
        <Button type="submit" size="lg" loading={busy} icon={<Save className="size-4" />}>
          {t("admin.events.editor.save")}
        </Button>
      </div>
    </form>
  );
}
