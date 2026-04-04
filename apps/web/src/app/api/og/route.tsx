import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { toASCII } from "node:punycode";
import { getPublicOgRenderModel } from "@/lib/public-scan/og-render-model";
import { PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";

export const runtime = "nodejs";

function isValidDomainParam(domain: string): boolean {
  if (domain.length > 253) return false;
  if (domain.includes("/") || domain.includes("\\") || domain.includes(" ")) {
    return false;
  }
  try {
    const parsed = new URL(`https://${domain}`);
    return Boolean(parsed.hostname && parsed.hostname.includes("."));
  } catch {
    return false;
  }
}

/**
 * GET /api/og?domain=example.com
 * Open Graph image for public scan share cards. Renders only from current,
 * non-expired completed public scan data — query-string scores are ignored
 * so social previews cannot overstate evidence we do not hold.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const rawDomain = searchParams.get("domain")?.trim();

    if (!rawDomain) {
      return new Response("Missing domain parameter", { status: 400 });
    }

    let displayDomain = rawDomain;
    try {
      displayDomain = toASCII(rawDomain.toLowerCase().replace(/\.$/, ""));
    } catch {
      displayDomain = rawDomain;
    }

    if (!isValidDomainParam(displayDomain)) {
      return new Response("Invalid domain parameter", { status: 400 });
    }

    const model = await getPublicOgRenderModel(displayDomain);

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
            {PRODUCT_DISPLAY_NAME} · public scan evidence
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

        <div
          style={{
            display: "flex",
            fontSize: "42px",
            color: "#f8fafc",
            fontWeight: 700,
            marginBottom: "24px",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {model.displayDomain}
        </div>

        {!model.hasCurrentProof && (
          <div
            style={{
              display: "flex",
              fontSize: "22px",
              color: "#94a3b8",
              marginBottom: "32px",
              maxWidth: "900px",
              lineHeight: 1.4,
            }}
          >
            Run a fresh instant scan on the site to generate shareable
            accessibility evidence. Previews only reflect unexpired completed
            scans.
          </div>
        )}

        <div style={{ display: "flex", gap: "48px", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              width: "200px",
              height: "200px",
              borderRadius: "50%",
              border: `8px solid ${model.scoreColor}`,
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
                color: model.scoreColor,
              }}
            >
              {model.scoreDisplay}
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

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                display: "flex",
                fontSize: "28px",
                color: "#f8fafc",
                fontWeight: 600,
              }}
            >
              {model.headline}
            </div>
            {model.hasCurrentProof &&
              [
                { label: "Critical", count: model.critical, color: "#ef4444" },
                { label: "Serious", count: model.serious, color: "#f97316" },
                { label: "Moderate", count: model.moderate, color: "#eab308" },
                { label: "Minor", count: model.minor, color: "#22c55e" },
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
                    style={{
                      display: "flex",
                      fontSize: "22px",
                      color: "#e2e8f0",
                    }}
                  >
                    {label}: {count}
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "auto",
            fontSize: "18px",
            color: "#64748b",
          }}
        >
          Automated sampling — not a WCAG conformance guarantee
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
      },
    );
  } catch {
    return new Response("Failed to generate OG image", { status: 500 });
  }
}
