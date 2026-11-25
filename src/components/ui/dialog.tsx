"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/components/providers";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Optional: a confirmation needs only a title, a description and a footer. */
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const WIDTHS = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-3xl" };

/**
 * A modal built on the native <dialog>: focus trapping, Escape and the
 * backdrop come from the browser. On phones it rises from the bottom as a
 * sheet; on larger screens it is a centred panel.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = "md" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useT();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // React state is the source of truth. Escape asks to close; the native
      // "close" event is deliberately ignored because it also fires when we
      // close the element ourselves, e.g. while switching to another dialog.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl border border-line bg-surface p-0 shadow-pop",
        "sm:m-auto sm:rounded-3xl",
        "open:flex open:flex-col open:animate-rise",
        WIDTHS[size],
      )}
    >
      {open ? (
        <>
          <header className={cn("flex items-start justify-between gap-4 px-5 pt-5 pb-4", children && "border-b border-line")}>
            <div className="min-w-0">
              <h2 className="font-display text-xl">{title}</h2>
              {description ? <p className="mt-1 text-sm text-ink-2">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="-mt-1 -mr-2 grid size-10 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-well hover:text-ink"
            >
              <X className="size-5" />
            </button>
          </header>
          {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div> : null}
          {footer ? (
            <footer className={cn("safe-bottom flex flex-wrap justify-end gap-2 bg-well px-5 pt-3", children && "border-t border-line")}>{footer}</footer>
          ) : null}
        </>
      ) : null}
    </dialog>
  );
}
