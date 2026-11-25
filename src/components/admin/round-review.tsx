"use client";

import { Check, CheckCheck, ChevronRight, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "./common";
import { RoundCard } from "./round-card";
import { useAction } from "./use-action";
import { useFormat, useT, useToast } from "@/components/providers";
import { Button, LinkButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextAreaField } from "@/components/ui/form";
import { api } from "@/lib/api-client";
import type { AdminRoundRow } from "@/lib/types";

interface RejectDialogProps {
  roundId: string | null;
  onClose: () => void;
  onDone?: () => void;
}

/** Asks for the reason the players will see, then rejects the round. */
export function RejectDialog({ roundId, onClose, onDone }: RejectDialogProps) {
  const t = useT();
  const { run, busy } = useAction();
  const [reason, setReason] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!roundId) return;
    const result = await run(
      () => api.post(`/api/admin/rounds/${roundId}/review`, { decision: "rejected", reason: reason.trim() }),
      { success: t("admin.rounds.rejected") },
    );
    if (!result.ok) return;
    setReason("");
    onClose();
    onDone?.();
  }

  return (
    <Dialog
      open={roundId !== null}
      onClose={onClose}
      title={t("admin.rounds.rejectTitle")}
      description={t("admin.rounds.rejectLead")}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="reject-round-form" variant="danger" loading={busy} disabled={reason.trim().length === 0}>
            {t("admin.rounds.reject")}
          </Button>
        </>
      }
    >
      <form id="reject-round-form" onSubmit={submit}>
        <TextAreaField
          label={t("admin.rounds.reason")}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t("admin.rounds.reasonPlaceholder")}
          maxLength={500}
          rows={3}
          required
        />
      </form>
    </Dialog>
  );
}

/** The review queue: every submitted card with approve and reject in reach. */
export function RoundReviewQueue({ rounds }: { rounds: AdminRoundRow[] }) {
  const t = useT();
  const { locale, timeZone } = useFormat();
  const toast = useToast();
  const { run, busy } = useAction();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  async function approve(roundId: string) {
    await run(() => api.post(`/api/admin/rounds/${roundId}/review`, { decision: "approved" }), { success: t("admin.rounds.approved") });
  }

  async function approveAll() {
    const roundIds = rounds.map((round) => round.id).slice(0, 200);
    const result = await run(() => api.post<{ approved: number }>("/api/admin/rounds/approve", { roundIds }));
    setConfirmAll(false);
    if (result.ok) toast.success(t("admin.rounds.approvedMany", { count: result.data.approved }));
  }

  return (
    <>
      {rounds.length > 1 ? (
        <div className="mb-4 flex justify-end">
          <Button variant="secondary" icon={<CheckCheck className="size-4" />} onClick={() => setConfirmAll(true)} disabled={busy}>
            {t("admin.rounds.approveAll")}
          </Button>
        </div>
      ) : null}

      <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {rounds.map((round) => (
          <li key={round.id}>
            <RoundCard
              round={round}
              t={t}
              locale={locale}
              timeZone={timeZone}
              actions={
                <>
                  <LinkButton variant="ghost" size="sm" href={`/admin/rounds/${round.id}`} className="mr-auto">
                    {t("admin.rounds.view")}
                    <ChevronRight className="size-4" />
                  </LinkButton>
                  <Button variant="secondary" size="sm" icon={<X className="size-4" />} disabled={busy} onClick={() => setRejecting(round.id)}>
                    {t("admin.rounds.reject")}
                  </Button>
                  <Button size="sm" icon={<Check className="size-4" />} disabled={busy} onClick={() => void approve(round.id)}>
                    {t("admin.rounds.approve")}
                  </Button>
                </>
              }
            />
          </li>
        ))}
      </ul>

      <RejectDialog roundId={rejecting} onClose={() => setRejecting(null)} />
      <ConfirmDialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        title={t("admin.rounds.approveAllTitle", { count: rounds.length })}
        description={t("admin.rounds.approveAllLead")}
        confirmLabel={t("admin.rounds.approveAll")}
        busy={busy}
        onConfirm={approveAll}
      />
    </>
  );
}

interface RoundDecisionProps {
  roundId: string;
  status: "pending" | "approved" | "rejected";
}

/** Approve, reject or revisit the decision on a single round. */
export function RoundDecision({ roundId, status }: RoundDecisionProps) {
  const t = useT();
  const { run, busy } = useAction();
  const [rejecting, setRejecting] = useState(false);

  async function approve() {
    await run(() => api.post(`/api/admin/rounds/${roundId}/review`, { decision: "approved" }), { success: t("admin.rounds.approved") });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "approved" ? (
        <Button icon={<Check className="size-4" />} loading={busy} onClick={() => void approve()}>
          {status === "pending" ? t("admin.rounds.approve") : t("admin.rounds.detail.changeToApproved")}
        </Button>
      ) : null}
      {status !== "rejected" ? (
        <Button variant="secondary" icon={<X className="size-4" />} disabled={busy} onClick={() => setRejecting(true)}>
          {status === "pending" ? t("admin.rounds.reject") : t("admin.rounds.detail.changeToRejected")}
        </Button>
      ) : null}
      <RejectDialog roundId={rejecting ? roundId : null} onClose={() => setRejecting(false)} />
    </div>
  );
}
