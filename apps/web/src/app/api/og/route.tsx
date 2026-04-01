import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

/**
 * GET /api/og?domain=example.com&score=85&critical=2&serious=5
 * Generates an Open Graph image for social sharing of scan results.
 * Used as the og:image meta tag on public scan results pages.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const domain = searchParams.get("domain") ?? "unknown";
  const score = parseInt(searchParams.get("score") ?? "0", 10);
  const critical = parseInt(searchParams.get("critical") ?? "0", 10);
  const serious = parseInt(searchParams.get("serious") ?? "0", 10);
  const moderate = parseInt(searchParams.get("moderate") ?? "0", 10);
  const minor = parseInt(searchParams.get("minor") ?? "0", 10);
  const total = critical + serious + moderate + minor;

  const scoreColor =
    score >= 90
      ? "#22c55e"
      : score >= 70
        ? "#eab308"
        : score >= 50
          ? "#f97316"
          : "#ef4444";

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: "#0f172a",
        padding: "60px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "40px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: "24px",
            color: "#94a3b8",
            fontWeight: 600,
          }}
        >
          AROS Accessibility Scan
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "18px",
            color: "#64748b",
          }}
        >
          {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* Domain */}
      <div
        style={{
          display: "flex",
          fontSize: "42px",
          color: "#f8fafc",
          fontWeight: 700,
          marginBottom: "32px",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {domain}
      </div>

      {/* Score + Breakdown */}
      <div style={{ display: "flex", gap: "48px", alignItems: "center" }}>
        {/* Score Circle */}
        <div
          style={{
            display: "flex",
            width: "200px",
            height: "200px",
            borderRadius: "50%",
            border: `8px solid ${scoreColor}`,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "72px",
              fontWeight: 800,
              color: scoreColor,
            }}
          >
            {score}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "18px",
              color: "#94a3b8",
            }}
          >
            Score
          </div>
        </div>

        {/* Severity Breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              fontSize: "28px",
              color: "#f8fafc",
              fontWeight: 600,
            }}
          >
            {total} issues found
          </div>
          {[
            { label: "Critical", count: critical, color: "#ef4444" },
            { label: "Serious", count: serious, color: "#f97316" },
            { label: "Moderate", count: moderate, color: "#eab308" },
            { label: "Minor", count: minor, color: "#22c55e" },
          ].map(({ label, count, color }) => (
            <div
              key={label}
              style={{ display: "flex", gap: "12px", alignItems: "center" }}
            >
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "4px",
                  backgroundColor: color,
                }}
              />
              <div
                style={{ display: "flex", fontSize: "22px", color: "#e2e8f0" }}
              >
                {label}: {count}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          marginTop: "auto",
          fontSize: "18px",
          color: "#64748b",
        }}
      >
        Scan your site free at aros.dev
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
