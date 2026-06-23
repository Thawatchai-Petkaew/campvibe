/**
 * Linear webhook → owner notifications + real-time orchestration trigger.
 *
 * Flow:  Linear (issue/label/state change)  ──POST──▶  this route
 *        → verify HMAC signature (LINEAR_WEBHOOK_SECRET)
 *        → send Telegram on notify-worthy transitions via buildEventMessage(),
 *          detected from the payload so it fires for ANY actor — the linear-sync.mjs CLI,
 *          the Linear MCP, or a manual edit in the Linear UI. (The CLI side-effect can't run
 *          in a web session where egress to Telegram/Linear is blocked, so the notification
 *          lives on the server where it always reaches the owner.)
 *        → if a delivery gate was approved (its `awaiting-you` was removed), fire GitHub
 *          repository_dispatch → .github/workflows/linear-continue.yml runs the orchestrator.
 *
 * This webhook is the SINGLE source of Telegram event notifications.
 * scripts/linear-sync.mjs no longer sends event messages — it only sets state/labels/title,
 * and those changes trigger this webhook.
 *
 * Required env (Vercel):
 *   LINEAR_WEBHOOK_SECRET            — signing secret from Linear → Settings → API → Webhooks
 *   TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID — owner notifications (see lib/notify)
 *   GITHUB_REPO / GH_DISPATCH_TOKEN  — repository_dispatch for gate continuation (optional)
 *
 * The route only TRIGGERS orchestration; the GitHub Action re-confirms the gate via
 * `npm run status:gates` before acting — so we never act on a stale/partial payload.
 */
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { sendTelegram } from "@/lib/notify";
import { bumpPulse } from "@/lib/status-pulse";
import { buildEventMessage, roleFromTitle } from "@/lib/notify-messages";
import { stageRank, regressionRound, ROLE_STAGE } from "@/lib/status-derive";

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

interface LinearLabel {
  id?: string;
  name?: string;
}
interface LinearWebhook {
  action?: string;
  type?: string;
  data?: {
    identifier?: string;
    title?: string;
    url?: string;
    labels?: LinearLabel[];
    state?: { id?: string; name?: string; type?: string };
  };
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

  // Real-time /status: any Issue change (create/update/remove) bumps the pulse, so open
  // dashboards refresh near-instantly via SSE and the next render re-fetches Linear (the page
  // keys its cache on the pulse). Broad on purpose — just a refresh signal; the Telegram
  // notifications below stay narrow (no spam).
  if (body.type === "Issue") {
    await bumpPulse();
  }

  const data = body.data ?? {};
  const id = data.identifier ?? "";
  const title = data.title ?? "";
  const url = data.url;
  const ctx = { id, title, url };

  // ── `create` event: notify "created" (gated — default off, no spam). ──
  if (body.type === "Issue" && body.action === "create") {
    const msg = buildEventMessage("created", ctx);
    if (msg) await sendTelegram(msg.text, { buttons: msg.buttons });
    return NextResponse.json({ ok: true, ignored: "Issue/create", pulsed: true });
  }

  // Only the Telegram + gate-dispatch logic below cares specifically about issue *updates*.
  if (body.type !== "Issue" || body.action !== "update") {
    return NextResponse.json({ ok: true, ignored: `${body.type}/${body.action}`, pulsed: body.type === "Issue" });
  }

  const updatedFrom = body.updatedFrom ?? {};
  const currentLabels = (data.labels ?? []).filter((l) => l.id || l.name);
  const labelNames = currentLabels.map((l) => l.name).filter(Boolean) as string[];

  // Labels *added* in this update (diff current vs the prior label-id set) — avoids
  // re-notifying for labels that were already present before the change.
  const prevLabelIds = Array.isArray(updatedFrom.labelIds) ? (updatedFrom.labelIds as string[]) : null;
  const labelChanged = prevLabelIds !== null;
  const addedNames: string[] = prevLabelIds
    ? (currentLabels.filter((l) => l.id && !prevLabelIds.includes(l.id)).map((l) => l.name).filter(Boolean) as string[])
    : [];

  const stateChanged = Object.prototype.hasOwnProperty.call(updatedFrom, "stateId");
  const stateType = data.state?.type ?? "";

  // ── Owner notifications — event-driven, fire for any actor. sendTelegram is no-throw. ──
  const notified: string[] = [];

  if (addedNames.includes("awaiting-you")) {
    const msg = buildEventMessage("gate", ctx);
    if (msg) await sendTelegram(msg.text, { buttons: msg.buttons });
    notified.push("awaiting-you");
  }

  if (addedNames.includes("released")) {
    const msg = buildEventMessage("released", ctx);
    if (msg) await sendTelegram(msg.text, { buttons: msg.buttons });
    notified.push("released");
  }

  // Handoff = the current actor changed. The [role] tag in the title is the live actor and
  // changes on every handoff (forward AND back); the role:* labels accumulate (never removed)
  // so they only catch the FIRST time each role appears. Prefer the title change; fall back to
  // a newly-added role:* label when the title itself didn't change.
  const titleChanged = Object.prototype.hasOwnProperty.call(updatedFrom, "title");
  const prevTitle = typeof updatedFrom.title === "string" ? updatedFrom.title : "";
  let handoffRole: string | null = null;
  if (titleChanged) {
    const newRole = roleFromTitle(title);
    if (newRole && newRole !== roleFromTitle(prevTitle)) handoffRole = newRole;
  }
  if (!handoffRole) {
    const addedRole = addedNames.find((n) => n.startsWith("role:"));
    if (addedRole) handoffRole = addedRole.slice("role:".length);
  }
  if (handoffRole) {
    const round = regressionRound(labelNames);
    // Classify the handoff direction using stage rank (backward = regression, forward into Verify with
    // prior regression labels = reverify, else = normal forward handoff).
    if (titleChanged) {
      const oldRole = roleFromTitle(prevTitle) ?? "";
      const newRole = handoffRole;
      if (stageRank(newRole) < stageRank(oldRole)) {
        // Backward move (send-back / regression)
        const msg = buildEventMessage("regression", { ...ctx, role: newRole, fromRole: oldRole, round });
        if (msg) await sendTelegram(msg.text, { buttons: msg.buttons });
        notified.push(`regression:${newRole}`);
      } else if (
        stageRank(newRole) > stageRank(oldRole) &&
        ROLE_STAGE[newRole] === "Verify" &&
        labelNames.some((n) => n.startsWith("regression:"))
      ) {
        // Forward into a Verify role after a prior regression — re-review
        const msg = buildEventMessage("reverify", { ...ctx, role: newRole, round });
        if (msg) await sendTelegram(msg.text, { buttons: msg.buttons });
        notified.push(`reverify:${newRole}`);
      } else {
        // Normal forward handoff
        const msg = buildEventMessage("handoff", { ...ctx, role: handoffRole });
        if (msg) await sendTelegram(msg.text, { buttons: msg.buttons });
        notified.push(`handoff:${handoffRole}`);
      }
    } else {
      // Label-added fallback (title unchanged) — always treat as normal handoff
      const msg = buildEventMessage("handoff", { ...ctx, role: handoffRole });
      if (msg) await sendTelegram(msg.text, { buttons: msg.buttons });
      notified.push(`handoff:${handoffRole}`);
    }
  }

  if (addedNames.includes("blocked")) {
    const msg = buildEventMessage("blocked", ctx);
    if (msg) await sendTelegram(msg.text, { buttons: msg.buttons });
    notified.push("blocked");
  }

  if (stateChanged && stateType === "started") {
    const msg = buildEventMessage("started", ctx);
    if (msg) await sendTelegram(msg.text, { buttons: msg.buttons });
    notified.push("started");
  }

  if (stateChanged && stateType === "completed") {
    const msg = buildEventMessage("done", ctx);
    if (msg) await sendTelegram(msg.text, { buttons: msg.buttons });
    notified.push("done");
  }

  // ── Existing behaviour: a gate whose `awaiting-you` was just removed → orchestrator continues.
  //    (Coarse on purpose — the GitHub Action re-confirms with `status:gates` before acting.) ──
  const isGate = /Gate\s*G\d/i.test(title) || labelNames.includes("awaiting-you");
  const stillAwaiting = labelNames.includes("awaiting-you");
  const looksApproved = isGate && labelChanged && !stillAwaiting;

  let dispatch: Awaited<ReturnType<typeof fireDispatch>> | null = null;
  if (looksApproved) {
    // The "Approved" notification is sent from the Telegram Approve tap (telegram-webhook),
    // where the awaiting-you removal is known reliably; here we only continue the orchestrator.
    dispatch = await fireDispatch({
      identifier: id,
      title,
      epic: title.split("·")[0]?.trim() ?? "",
    });
  }

  return NextResponse.json({ ok: true, notified, approved: looksApproved, ...(dispatch ?? {}) });
}
