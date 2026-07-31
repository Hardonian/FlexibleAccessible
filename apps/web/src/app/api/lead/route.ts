import { NextResponse } from "next/server";
import { z } from "zod";
import { execFileSync } from "node:child_process";
import path from "node:path";

export const runtime = "nodejs";

const leadSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().max(200).optional(),
  product_slug: z.string().max(128).optional(),
  source: z.string().max(64).optional().default("landing"),
  notes: z.string().max(2000).optional(),
  referrer: z.string().max(512).optional(),
  utm_source: z.string().max(128).optional(),
  utm_medium: z.string().max(128).optional(),
  utm_campaign: z.string().max(128).optional(),
  // Honeypot: real users never fill this; bots do.
  company: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  const data = parsed.data;

  // Honeypot trip → pretend success, do nothing.
  if (data.company && data.company.length > 0) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const payload = {
    email: data.email,
    product_slug: data.product_slug ?? "",
    source: data.source,
    notes: data.notes ? `name=${data.name ?? ""}\n${data.notes}` : (data.name ?? ""),
    referrer: data.referrer ?? "",
    utm_source: data.utm_source ?? "",
    utm_medium: data.utm_medium ?? "",
    utm_campaign: data.utm_campaign ?? "",
  };

  try {
    const script = path.join(
      process.env.HERMES_SCRIPTS_DIR ?? "/home/scott/.hermes/scripts",
      "lead-ingest.py",
    );
    const stdout = execFileSync("python3", [script], {
      input: JSON.stringify(payload),
      timeout: 8000,
      encoding: "utf8",
    });
    const result = JSON.parse(stdout);
    if (!result.ok) {
      return NextResponse.json({ error: "Could not record lead" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, lead_id: result.lead_id }, { status: 201 });
  } catch {
    // Fail closed: never leak internals.
    return NextResponse.json({ error: "Could not record lead" }, { status: 500 });
  }
}
