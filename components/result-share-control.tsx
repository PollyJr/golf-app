"use client";

import { useState } from "react";
import { Link2Off } from "lucide-react";
import { secureHeaders } from "@/lib/client-security";

export function ResultShareControl({ roundId }: { roundId: string }) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function revoke() {
    setState("saving");
    try {
      const response = await fetch(`/api/rounds/${roundId}/share`, { method: "DELETE", headers: secureHeaders(false) });
      if (!response.ok) throw new Error("REVOKE_FAILED");
      setState("done");
    } catch { setState("error"); }
  }

  return <button className="result-revoke" onClick={revoke} disabled={state === "saving" || state === "done"}>
    <Link2Off size={16}/>{state === "saving" ? "Intrekken…" : state === "done" ? "Live links ingetrokken" : state === "error" ? "Opnieuw proberen" : "Live links intrekken"}
  </button>;
}
