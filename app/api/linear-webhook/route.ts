/**
 * Linear webhook → real-time orchestration trigger.
 *
 * Flow:  Linear (issue/label/state change)  ──POST──▶  this route
 *        → verify HMAC signature (LINEAR_WEBHOOK_SECRET)
 *        → if a delivery gate changed, fire GitHub repository_dispatch
 *        → GitHub Action (.github/workflows/linear-continue.yml) runs the orchestrator
 *
 * Required env (Vercel):
 *   LINEAR_WEBHOOK_SECRET  — signing secret from Linear → Settings → API → Webhooks
 *   GITHUB_REPO            — "owner/name" e.g. Thawatchai-Petkaew/campvibe
 *   GH_DISPATCH_TOKEN      — fine-grained GitHub PAT with "Contents: read & write" / dispatch on the repo
 *
 * The route only TRIGGERS; the GitHub Action confirms the gate via `npm run status:gates`
 * (exit 10 = a cleared gate) before doing any work — so we never act on a stale/partial payload.
 */
import { NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verify(raw: string, sig: string | null): boolean {
  const secret = process.env.LINEAR_WEBHOOK_SECRET;
  if (!secret || !sig) return false;
  const digest = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sig));
  } catch {
    return false;
  }
}

async function fireDispatch(payload: Record<string, unknown>) {
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!repo || !token) return { dispatched: false, reason: "GITHUB_REPO / GH_DISPATCH_TOKEN not set" };
  const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event_type: "linear-gate-approved", client_payload: payload }),
  });
  return { dispatched: res.ok, status: res.status };
}

interface LinearLabel { name?: string }
interface LinearWebhook {
  action?: string;
  type?: string;
  data?: { identifier?: string; title?: string; labels?: LinearLabel[]; state?: { name?: string; type?: string } };
  updatedFrom?: Record<string, unknown>;
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verify(raw, req.headers.get("linear-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: LinearWebhook;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // Only react to Issue updates.
  if (body.type !== "Issue" || body.action !== "update") {
    return NextResponse.json({ ok: true, ignored: `${body.type}/${body.action}` });
  }

  const data = body.data ?? {};
  const title = data.title ?? "";
  const labels = (data.labels ?? []).map((l) => l.name).filter(Boolean) as string[];
  const isGate = /Gate\s*G\d/i.test(title) || labels.includes("awaiting-you");
  const labelChanged = !!body.updatedFrom && Object.prototype.hasOwnProperty.call(body.updatedFrom, "labelIds");
  const stillAwaiting = labels.includes("awaiting-you");

  // Approval signal: a gate issue whose labels changed and no longer carries "awaiting-you".
  // (Coarse on purpose — the GitHub Action re-confirms with `status:gates` before acting.)
  const looksApproved = isGate && labelChanged && !stillAwaiting;

  if (!looksApproved) {
    return NextResponse.json({ ok: true, gate: isGate, approved: false });
  }

  const result = await fireDispatch({
    identifier: data.identifier ?? "",
    title,
    epic: title.split("·")[0]?.trim() ?? "",
  });
  return NextResponse.json({ ok: true, approved: true, issue: data.identifier, ...result });
}
