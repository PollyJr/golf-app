"use client";

import { Printer, ShieldAlert } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CopyButton } from "./common";
import { useT } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export interface CredentialEntry {
  /** Who the credentials belong to. */
  title: string;
  rows: Array<{ label: string; value: string; emphasize?: boolean }>;
}

interface CredentialsDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  entries: CredentialEntry[];
  /** Printed under each entry, e.g. "choose your own PIN at first sign-in". */
  printNote: string;
  clubName: string;
}

/**
 * The printable version of the issued credentials. It lives outside the app
 * shell (which hides itself while a sheet is mounted) so only this prints.
 */
function PrintSheet({ entries, printNote, clubName }: Pick<CredentialsDialogProps, "entries" | "printNote" | "clubName">) {
  const t = useT();

  useEffect(() => {
    document.documentElement.setAttribute("data-print-sheet", "");
    return () => document.documentElement.removeAttribute("data-print-sheet");
  }, []);

  // Only ever mounted after a click, so there is no server render to match.
  if (typeof document === "undefined") return null;
  const origin = window.location.host;
  return createPortal(
    <div className="hidden bg-white p-6 text-black print:block">
      <div className="grid grid-cols-2 gap-4">
        {entries.map((entry, index) => (
          <section key={index} className="break-inside-avoid rounded-xl border border-dashed border-black/40 p-4">
            <p className="text-[10px] font-bold tracking-widest uppercase">
              {clubName} · {t("admin.secret.printTitle")}
            </p>
            <p className="mt-2 text-lg font-extrabold">{entry.title}</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              {entry.rows.map((row) => (
                <div key={row.label} className="flex justify-between gap-4">
                  <dt>{row.label}</dt>
                  <dd className="font-bold tracking-wider">{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[11px] leading-snug">
              {origin ? `${t("admin.secret.loginAt", { url: origin })}. ` : ""}
              {printNote}
            </p>
          </section>
        ))}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Shows freshly issued PINs or passwords exactly once, with copy and print.
 * The server only keeps a hash, so there is no way to show them again.
 */
export function CredentialsDialog({ open, onClose, title, entries, printNote, clubName }: CredentialsDialogProps) {
  const t = useT();
  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={title}
        size={entries.length > 1 ? "lg" : "md"}
        footer={
          <>
            <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>
              {t("admin.secret.print")}
            </Button>
            <Button onClick={onClose}>{t("common.done")}</Button>
          </>
        }
      >
        <p className="flex items-start gap-2.5 rounded-control bg-gold-soft px-3.5 py-3 text-sm font-medium text-gold">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          {t("admin.secret.onceNote")}
        </p>
        <ul className={entries.length > 1 ? "mt-4 grid gap-3 sm:grid-cols-2" : "mt-4"}>
          {entries.map((entry, index) => (
            <li key={index} className="rounded-card border border-line bg-well p-4">
              <p className="truncate font-semibold">{entry.title}</p>
              <dl className="mt-2">
                {entry.rows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-2 border-t border-line py-1.5 first:border-t-0">
                    <dt className="text-[13px] text-ink-3">{row.label}</dt>
                    <dd className="flex min-w-0 items-center gap-1">
                      <span className={row.emphasize ? "font-score text-xl tracking-[0.12em]" : "truncate text-sm font-semibold"}>
                        {row.value}
                      </span>
                      <CopyButton value={row.value} label={row.label} />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </Dialog>
      {open ? <PrintSheet entries={entries} printNote={printNote} clubName={clubName} /> : null}
    </>
  );
}
