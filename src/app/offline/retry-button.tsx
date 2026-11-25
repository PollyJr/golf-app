"use client";

import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Reloads the address the visitor was trying to reach. */
export function RetryButton({ label }: { label: string }) {
  return (
    <Button className="mt-8" icon={<RotateCw className="size-4" />} onClick={() => window.location.reload()}>
      {label}
    </Button>
  );
}
