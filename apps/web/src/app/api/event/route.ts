import { NextResponse } from "next/server";
import { z } from "zod";
import { execFileSync } from "node:child_process";
import path from "node:path";

export const runtime = "nodejs";

const eventSchema = z.object({
  event: z.enum(["page_view", "lead_submit", "cta_click", "lead_verify"]),
  path: z.string().max(256).optional(),
  product_slug: z.string().max(128).optional(),
  referrer: z.string().max(512).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  const payload = JSON.stringify({
    event: parsed.data.event,
    path: parsed.data.path ?? "",
    product_slug: parsed.data.product_slug ?? "",
    referrer: parsed.data.referrer ?? "",
    ts: new Date().toISOString(),
  });
  try {
    const script = path.join(
      process.env.HERMES_SCRIPTS_DIR ?? "/home/scott/.hermes/scripts",
      "event-publish.py",
    );
    execFileSync("python3", [script], {
      input: payload,
      timeout: 5000,
      encoding: "utf8",
    });
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    // Non-fatal: analytics must never break the page.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
