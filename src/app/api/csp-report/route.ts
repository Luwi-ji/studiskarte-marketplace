import { NextResponse } from "next/server";

const MAX_REPORT_BYTES = 16_384;
const TOKEN = /^[a-z-]{1,64}$/;

function originOnly(value: unknown): string {
  if (typeof value !== "string" || value.length > 2_048) return "unknown";
  if (["inline", "eval", "data", "blob", "self"].includes(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : url.protocol.slice(0, 24);
  } catch {
    return "other";
  }
}

function safeDirective(value: unknown): string {
  return typeof value === "string" && TOKEN.test(value) ? value : "unknown";
}

/** Accepts legacy CSP and Reporting API payloads, but logs no paths, queries, source files, or snippets. */
export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_REPORT_BYTES) return new NextResponse(null, { status: 413 });

  const text = await request.text();
  if (text.length > MAX_REPORT_BYTES) return new NextResponse(null, { status: 413 });
  try {
    const parsed: unknown = JSON.parse(text);
    const entries = Array.isArray(parsed) ? parsed.slice(0, 10) : [parsed];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      const outer = entry as Record<string, unknown>;
      const report = (outer["csp-report"] ?? outer.body ?? outer) as Record<string, unknown>;
      if (!report || typeof report !== "object") continue;
      console.warn("csp violation", {
        directive: safeDirective(report["effective-directive"] ?? report.effectiveDirective ?? report["violated-directive"]),
        blockedOrigin: originOnly(report["blocked-uri"] ?? report.blockedURL),
        documentOrigin: originOnly(report["document-uri"] ?? report.documentURL),
        disposition: report.disposition === "enforce" ? "enforce" : "report",
      });
    }
  } catch {
    // Browser reports are diagnostics only; malformed input carries no useful signal.
  }
  return new NextResponse(null, { status: 204 });
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });
}
