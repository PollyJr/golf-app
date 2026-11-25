"use client";

import { CalendarPlus, Check, Hourglass } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useErrorMessage, useT, useToast } from "@/components/providers";
import { Button, LinkButton } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import type { EventDto, EventRegistrationStatus } from "@/lib/types";

/** Register, join the waiting list or withdraw: one button that follows the event's state. */
export function EventRegistration({ event }: { event: EventDto }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const full = event.capacity !== null && event.registered >= event.capacity;

  async function register() {
    setBusy(true);
    try {
      const result = await api.post<{ status: EventRegistrationStatus }>(`/api/events/${event.id}/registration`);
      toast.success(result.status === "waitlisted" ? t("app.events.waitlistedToast") : t("app.events.registeredToast"));
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
    setBusy(false);
  }

  async function cancel() {
    setBusy(true);
    try {
      await api.delete(`/api/events/${event.id}/registration`);
      toast.success(t("app.events.cancelledToast"));
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {event.myStatus === "registered" ? (
        <p className="flex items-center gap-2 rounded-control bg-under-soft px-3.5 py-2.5 text-sm font-semibold text-under">
          <Check className="size-4" /> {t("app.events.registered")}
        </p>
      ) : event.myStatus === "waitlisted" ? (
        <p className="flex items-center gap-2 rounded-control bg-gold-soft px-3.5 py-2.5 text-sm font-semibold text-gold">
          <Hourglass className="size-4" /> {t("app.events.waitlisted")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {event.myStatus ? (
          <Button variant="secondary" loading={busy} onClick={() => void cancel()}>
            {t("app.events.cancel")}
          </Button>
        ) : event.registrationOpen ? (
          <Button variant="accent" size="lg" loading={busy} onClick={() => void register()}>
            {full ? t("app.events.joinWaitlist") : t("app.events.register")}
          </Button>
        ) : (
          <Button variant="secondary" disabled>
            {t("app.events.closed")}
          </Button>
        )}
        <LinkButton href={`/api/events/${event.id}/calendar`} variant="secondary" size={event.myStatus || !event.registrationOpen ? "md" : "lg"} download icon={<CalendarPlus className="size-4" />}>
          {t("app.events.calendar")}
        </LinkButton>
      </div>
    </div>
  );
}
