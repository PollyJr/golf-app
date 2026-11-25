"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "./common";
import { useAction } from "./use-action";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

interface DeleteButtonProps {
  /** API endpoint that accepts DELETE. */
  endpoint: string;
  /** Where to go once it is gone. */
  redirectTo: string;
  label: string;
  title: string;
  description: string;
  success: string;
}

/** A destructive action behind a confirmation, followed by a redirect. */
export function DeleteButton({ endpoint, redirectTo, label, title, description, success }: DeleteButtonProps) {
  const router = useRouter();
  const { run, busy } = useAction();
  const [open, setOpen] = useState(false);

  async function remove() {
    const result = await run(() => api.delete(endpoint), { success, refresh: false });
    if (!result.ok) return setOpen(false);
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <>
      <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        confirmLabel={label}
        tone="danger"
        busy={busy}
        onConfirm={remove}
      />
    </>
  );
}
