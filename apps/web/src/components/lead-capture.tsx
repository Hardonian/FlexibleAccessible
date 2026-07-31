"use client";

import { useState } from "react";
import { trackEvent } from "@/components/analytics-scripts";

interface LeadCaptureProps {
  productSlug?: string;
  source?: string;
  heading?: string;
  subheading?: string;
}

export function LeadCapture({
  productSlug,
  source = "landing",
  heading = "Get a prioritized accessibility remediation plan",
  subheading = "No vanity scores. Tell us where to send your evidence-backed action list.",
}: LeadCaptureProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          product_slug: productSlug ?? "",
          source,
          // honeypot field — must stay empty; hidden from real users via aria-hidden + CSS
          company: "",
          utm_source:
            new URLSearchParams(window.location.search).get("utm_source") ?? "",
          utm_medium:
            new URLSearchParams(window.location.search).get("utm_medium") ?? "",
          utm_campaign:
            new URLSearchParams(window.location.search).get("utm_campaign") ?? "",
          referrer: document.referrer,
        }),
      });
      if (res.ok) {
        setStatus("done");
        trackEvent("lead_submitted", { product: productSlug ?? "general", source });
      } else {
        setStatus("error");
        setErrorMsg("Something went wrong. Please try again or email us directly.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  }

  if (status === "done") {
    return (
      <section
        aria-live="polite"
        className="lead-capture lead-capture--done"
        style={{
          border: "1px solid #2e7d32",
          borderRadius: 12,
          padding: 24,
          maxWidth: 520,
        }}
      >
        <h2 style={{ margin: 0 }}>You&apos;re on the list.</h2>
        <p style={{ marginTop: 8 }}>
          We&apos;ll send your remediation plan to <strong>{email}</strong> shortly.
        </p>
      </section>
    );
  }

  return (
    <section
      className="lead-capture"
      aria-labelledby="lead-capture-heading"
      style={{
        border: "1px solid #d0d5dd",
        borderRadius: 12,
        padding: 24,
        maxWidth: 520,
      }}
    >
      <h2 id="lead-capture-heading" style={{ margin: 0 }}>
        {heading}
      </h2>
      <p style={{ marginTop: 8, color: "#475467" }}>{subheading}</p>
      <form onSubmit={handleSubmit} noValidate style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <label htmlFor="lead-name" style={{ fontWeight: 600 }}>
          Name <span style={{ fontWeight: 400, color: "#667085" }}>(optional)</span>
        </label>
        <input
          id="lead-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />

        <label htmlFor="lead-email" style={{ fontWeight: 600 }}>
          Work email
        </label>
        <input
          id="lead-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-required="true"
          style={inputStyle}
        />

        {/* Honeypot: visually hidden, ignored by screen readers, empty for humans */}
        <div aria-hidden="true" style={{ position: "absolute", left: -9999 }}>
          <label htmlFor="lead-company">Company (leave blank)</label>
          <input id="lead-company" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {status === "error" ? (
          <p role="alert" style={{ color: "#b42318", margin: 0 }}>
            {errorMsg}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={status === "sending"}
          style={{
            ...inputStyle,
            background: "#7f56d9",
            color: "#fff",
            fontWeight: 600,
            cursor: status === "sending" ? "progress" : "pointer",
          }}
        >
          {status === "sending" ? "Sending…" : "Send my plan"}
        </button>
      </form>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d0d5dd",
  fontSize: 16,
  width: "100%",
  boxSizing: "border-box",
};
