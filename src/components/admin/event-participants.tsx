"use client";

import { Download, UserMinus } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "./common";
import { useAction } from "./use-action";
import { useFormat, useT } from "@/components/providers";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { IconButton, LinkButton } from "@/components/ui/button";
import { Card, SectionHeading } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { EventParticipant } from "@/lib/types";

interface EventParticipantsProps {
  eventId: string;
  participants: EventParticipant[];
}

/** Who signed up, in order, with the option to take someone off the list. */
export function EventParticipants({ eventId, participants }: EventParticipantsProps) {
  const t = useT();
  const { locale, timeZone } = useFormat();
  const { run, busy } = useAction();
  const [removing, setRemoving] = useState<EventParticipant | null>(null);

  async function remove(participant: EventParticipant) {
    const result = await run(
      () => api.delete(`/api/admin/events/${eventId}/registrations`, { playerId: participant.playerId }),
      { success: t("admin.events.participants.removed", { name: participant.name }) },
    );
    if (result.ok) setRemoving(null);
  }

  return (
    <Card padding="lg">
      <SectionHeading
        title={
          <>
            {t("admin.events.participants.title")} <span className="font-score text-lg text-ink-3">{participants.length}</span>
          </>
        }
        action={
          participants.length > 0 ? (
            <LinkButton
              variant="ghost"
              size="sm"
              href={`/api/admin/events/${eventId}/registrations`}
              download
              icon={<Download className="size-4" />}
            >
              {t("admin.events.participants.export")}
            </LinkButton>
          ) : null
        }
      />
      {participants.length === 0 ? (
        <p className="text-sm text-ink-3">{t("admin.events.participants.empty")}</p>
      ) : (
        <ol className="flex flex-col">
          {participants.map((participant, index) => (
            <li key={participant.playerId} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
              <span className="font-score w-6 text-center text-base text-ink-3">{index + 1}</span>
              <Avatar name={participant.name} initials={participant.initials} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{participant.name}</span>
                <span className="block text-xs text-ink-3">{formatDateTime(participant.registeredAt, locale, timeZone)}</span>
              </span>
              <Badge tone={participant.status === "registered" ? "under" : "gold"}>
                {t(participant.status === "registered" ? "admin.events.participants.registered" : "admin.events.participants.waitlisted")}
              </Badge>
              <IconButton size="sm" label={`${t("admin.events.participants.remove")}: ${participant.name}`} onClick={() => setRemoving(participant)}>
                <UserMinus className="size-4" />
              </IconButton>
            </li>
          ))}
        </ol>
      )}

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={removing ? t("admin.events.participants.removeTitle", { name: removing.name }) : ""}
        description={t("admin.events.participants.removeLead")}
        confirmLabel={t("admin.events.participants.remove")}
        tone="danger"
        busy={busy}
        onConfirm={() => (removing ? remove(removing) : undefined)}
      />
    </Card>
  );
}
