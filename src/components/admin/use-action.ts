"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useErrorMessage, useToast } from "@/components/providers";

export type ActionResult<T> = { ok: true; data: T } | { ok: false };

interface ActionOptions {
  /** Toast shown when the call succeeds. */
  success?: string;
  /** Re-render the server components afterwards (default: yes). */
  refresh?: boolean;
}

/**
 * Runs a management action the way every button here needs it: a busy flag,
 * a toast for the outcome, and fresh server data afterwards.
 */
export function useAction() {
  const router = useRouter();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async <T,>(work: () => Promise<T>, options: ActionOptions = {}): Promise<ActionResult<T>> => {
      setBusy(true);
      try {
        const data = await work();
        if (options.success) toast.success(options.success);
        if (options.refresh !== false) router.refresh();
        return { ok: true, data };
      } catch (error) {
        toast.error(errorMessage(error));
        return { ok: false };
      } finally {
        setBusy(false);
      }
    },
    [router, toast, errorMessage],
  );

  return { run, busy };
}
