"use client";

/**
 * Last-resort error screen for failures in the root layout itself. It cannot
 * rely on providers or the stylesheet, so it is deliberately plain.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="nl">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f3f0e6", color: "#14211a", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 32, margin: 0 }}>Dat ging niet goed</h1>
          <p style={{ color: "#47554c" }}>Er ging iets mis bij het laden. Something went wrong while loading.</p>
          <button
            onClick={reset}
            style={{ background: "#0f3b2a", color: "#f4f7ee", border: 0, borderRadius: 12, padding: "12px 20px", fontWeight: 600, fontSize: 15, cursor: "pointer" }}
          >
            Opnieuw proberen
          </button>
        </div>
      </body>
    </html>
  );
}
