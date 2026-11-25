import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand";
import { Eyebrow } from "@/components/ui/card";

/** The page a scanned QR code opens: one card, the club's mark above it. */
export function QrLanding({ clubName, eyebrow, title, children }: { clubName?: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">
      <Wordmark name={clubName} />
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="font-display mt-2 text-[clamp(1.9rem,7vw,2.6rem)] text-balance">{title}</h1>
      </div>
      {children}
    </main>
  );
}
