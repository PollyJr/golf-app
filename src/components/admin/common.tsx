"use client";

import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useT, useToast } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";

interface CopyButtonProps {
  value: string;
  /** What is being copied, for the accessible name. */
  label: string;
  className?: string;
}

export function CopyButton({ value, label, className }: CopyButtonProps) {
  const t = useT();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t("common.errors.UNKNOWN"));
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`${t("common.copy")}: ${label}`}
      title={copied ? t("common.copied") : t("common.copy")}
      className={cn(
        "inline-grid size-9 shrink-0 place-items-center rounded-full text-ink-3 transition hover:bg-well hover:text-ink",
        copied && "text-under",
        className,
      )}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
}

/** A question with consequences: always a dialog, never a browser prompt. */
export function ConfirmDialog({ open, onClose, title, description, confirmLabel, tone = "primary", busy, onConfirm, children }: ConfirmDialogProps) {
  const t = useT();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} loading={busy} onClick={() => void onConfirm()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description ? <p className="text-pretty text-ink-2">{description}</p> : null}
      {children}
    </Dialog>
  );
}

/** Label and value side by side; the building block of detail panels. */
export function DetailRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <dt className="shrink-0 text-[13px] text-ink-3">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-semibold break-words">{children}</dd>
    </div>
  );
}
