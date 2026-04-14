"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: "400px" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: "#fee2e2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
              }}
            >
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#f87171" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374L10.051 3.378c.866-1.5 3.032-1.5 3.898 0L21.303 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>

            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>
              Critical error
            </h1>
            <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, margin: "0 0 8px" }}>
              The application encountered a fatal error and could not recover. Please refresh the page.
            </p>
            {error.digest && (
              <p style={{ fontSize: 11, fontFamily: "monospace", color: "#94a3b8", margin: "0 0 24px" }}>
                Ref: {error.digest}
              </p>
            )}

            <button
              onClick={reset}
              style={{
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
