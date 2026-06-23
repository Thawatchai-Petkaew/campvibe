// Lightweight pulse-version endpoint: a cheap poll fallback for /status and the
// observable signal used by tests + manual verification. Returns only an integer.
import { NextResponse } from "next/server";
import { readPulse } from "@/lib/status-pulse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const required = process.env.STATUS_TOKEN;
  if (!required) return true; // parity with the /status page: open when no token is configured
  return new URL(req.url).searchParams.get("token") === required;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ version: await readPulse() });
}
