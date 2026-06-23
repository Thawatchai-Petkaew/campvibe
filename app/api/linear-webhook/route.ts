/**
 * Linear webhook → owner notifications + real-time orchestration trigger.
 *
 * Flow:  Linear (issue/label/state change)  ──POST──▶  this route
 *        → verify HMAC signature (LINEAR_WEBHOOK_SECRET)
 *        → send Telegram on notify-worthy transitions (gate / done / released / handoff),
 *          detected from the payload so it fires for ANY actor — the linear-sync.mjs CLI,
 *          the Linear MCP, or a manual edit in the Linear UI. (The CLI side-effect can't run
 *          in a web session where egress to Telegram/Linear is blocked, so the notification
 *          lives on the server where it always reaches the owner.)
 *        → if a delivery gate was approved (its `awaiting-you` was removed), fire GitHub
 *          repository_dispatch → .github/workflows/linear-continue.yml runs the orchestrator.
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
import { sendTelegram, type TgButton } from "@/lib/notify";

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

// role slug → human label for Telegram (mirrors scripts/linear-sync.mjs).
const ROLE_LABEL: Record<string, string> = {
  architect: "Architect",
  "ux-designer": "Designer",
  "frontend-engineer": "Frontend",
  "backend-engineer": "Backend",
  "qa-engineer": "QA",
  "security-reviewer": "Security",
  "devops-release": "DevOps",
  "product-owner": "Product Owner",
  analyst: "Analyst",
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Link to the live /status dashboard (token-gated), mirroring scripts/linear-sync.mjs.
function statusUrl(): string {
  const base = process.env.APP_BASE_URL || "https://campvibe-staging.vercel.app";
  const token = process.env.STATUS_TOKEN;
  return `${base}/status${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}
const statusBtn: TgButton[][] = [[{ text: "📊 /status", url: statusUrl() }]];

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
  const updatedFrom = body.updatedFrom ?? {};
  const id = data.identifier ?? "";
  const title = data.title ?? "";
  const url = data.url;
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
  const head = id ? `<b>${esc(id)}</b>` : "<b>(issue)</b>";
  const titleLine = title ? `\n${esc(title)}` : "";

  if (addedNames.includes("awaiting-you")) {
    const gate = (title.match(/Gate\s*G\d/i) || ["Gate"])[0];
    await sendTelegram(
      `⏳ ${head} รออนุมัติ — ${esc(gate)}${titleLine}\n\nReview ใน Linear แล้วลบ label awaiting-you เพื่ออนุมัติ หรือกดปุ่มด้านล่าง`,
      {
        buttons: [
          ...(id ? [[{ text: "✅ Approve", callback_data: `approve:${id}` }, { text: "🚫 Reject", callback_data: `reject:${id}` }]] : []),
          ...(url ? [[{ text: "🔗 เปิดใน Linear", url }]] : []),
          [{ text: "📊 /status", url: statusUrl() }],
        ],
      }
    );
    notified.push("awaiting-you");
  }

  if (addedNames.includes("released")) {
    await sendTelegram(`🚀 ${head} released (prod)${titleLine}`, { buttons: statusBtn });
    notified.push("released");
  }

  const addedRole = addedNames.find((n) => n.startsWith("role:"));
  if (addedRole) {
    const slug = addedRole.slice("role:".length);
    await sendTelegram(`→ ${head} ส่งต่อให้ ${esc(ROLE_LABEL[slug] || slug)}${titleLine}`, { buttons: statusBtn });
    notified.push(addedRole);
  }

  if (stateChanged && stateType === "completed") {
    await sendTelegram(`✓ ${head} done${titleLine}`, { buttons: statusBtn });
    notified.push("done");
  }

  // ── Existing behaviour: a gate whose `awaiting-you` was just removed → orchestrator continues.
  //    (Coarse on purpose — the GitHub Action re-confirms with `status:gates` before acting.) ──
  const isGate = /Gate\s*G\d/i.test(title) || labelNames.includes("awaiting-you");
  const stillAwaiting = labelNames.includes("awaiting-you");
  const looksApproved = isGate && labelChanged && !stillAwaiting;

  let dispatch: Awaited<ReturnType<typeof fireDispatch>> | null = null;
  if (looksApproved) {
    dispatch = await fireDispatch({
      identifier: id,
      title,
      epic: title.split("·")[0]?.trim() ?? "",
    });
  }

  return NextResponse.json({ ok: true, notified, approved: looksApproved, ...(dispatch ?? {}) });
}
