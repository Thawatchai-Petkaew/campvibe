/**
 * Delivery-team config API — read/toggle the Camper Agent autonomous flag.
 * Auth: Authorization: Bearer <STATUS_TOKEN> (same secret that guards /status).
 * GET  → { autonomousMode } · POST { autonomousMode: boolean } → { autonomousMode }
 */
import { NextResponse } from "next/server";
import { getAutonomousMode, setAutonomousMode } from "@/lib/delivery-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const token = process.env.STATUS_TOKEN;
  if (!token) return false; // no token configured → toggling is locked
  return req.headers.get("authorization") === `Bearer ${token}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ autonomousMode: await getAutonomousMode() });
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { autonomousMode?: unknown };
  try {
    body = (await req.json()) as { autonomousMode?: unknown };
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (typeof body.autonomousMode !== "boolean") {
    return NextResponse.json({ error: "autonomousMode must be a boolean" }, { status: 400 });
  }
  const next = await setAutonomousMode(body.autonomousMode, "status-dashboard");
  return NextResponse.json({ autonomousMode: next });
}
