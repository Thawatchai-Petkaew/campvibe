/**
 * notify-messages — single source of copy for delivery-team Telegram notifications.
 *
 * All event messages are built here. The Linear webhook (app/api/linear-webhook/route.ts)
 * is the SINGLE source of Telegram event notifications — it fires for any actor
 * (the linear-sync.mjs CLI, the Linear MCP, or a manual edit in the Linear UI).
 *
 * scripts/linear-sync.mjs no longer sends event messages; it only sets state/labels/title
 * whose changes trigger the webhook, which notifies here.
 *
 * Copy rules: English, no emoji, no Thai in event messages.
 */
import "server-only";

// ── Role map ─────────────────────────────────────────────────────────────────────────────────
// canonical slug → human label used in Telegram messages.
export const ROLE_LABEL: Record<string, string> = {
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

// ── Event toggle map ──────────────────────────────────────────────────────────────────────────
// Set to false to suppress a notification kind without removing the logic.
export type EventKind =
  | "created"
  | "started"
  | "handoff"
  | "gate"
  | "approved"
  | "rejected"
  | "blocked"
  | "done"
  | "released"
  | "defect";

export const NOTIFY_EVENTS: Record<EventKind, boolean> = {
  created: false,
  started: true,
  handoff: true,
  gate: true,
  approved: true,
  rejected: true,
  blocked: true,
  done: true,
  released: true,
  defect: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────────────────────

/** Escape HTML special characters for Telegram HTML parse_mode. */
export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Strip a leading [role] tag from a title, e.g. "[backend-engineer] My story" → "My story". */
export function cleanTitle(title: string): string {
  return title.replace(/^\s*\[[^\]]+\]\s*/, "").trim();
}

/** Extract the role slug from a leading [role] tag, e.g. "[backend-engineer] My story" → "backend-engineer". */
export function roleFromTitle(title: string): string | null {
  return title.match(/^\s*\[([^\]]+)\]/)?.[1]?.trim() ?? null;
}

/** Link to the live /status dashboard (token-gated). */
export function statusUrl(): string {
  const base = process.env.APP_BASE_URL || "https://campvibe-staging.vercel.app";
  const token = process.env.STATUS_TOKEN;
  return `${base}/status${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

/** Inline-keyboard button that opens the Linear issue (or any URL). */
export function moreDetailBtn(url: string): { text: string; url: string } {
  return { text: "More Detail", url };
}

/** Inline-keyboard button that opens the live /status dashboard. */
export function liveStatusBtn(): { text: string; url: string } {
  return { text: "Live Status", url: statusUrl() };
}

// ── Message context ───────────────────────────────────────────────────────────────────────────
export interface EventCtx {
  /** Linear identifier, e.g. "CAM-9". */
  id: string;
  /** Issue title (may start with a [role] tag). */
  title?: string;
  /** Direct URL to the Linear issue. */
  url?: string;
  /** Role slug for handoff events, e.g. "backend-engineer". */
  role?: string;
}

interface NotifyMessage {
  text: string;
  buttons: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
}

/**
 * Build a Telegram message for the given event kind + context.
 * Returns null when the event is toggled off in NOTIFY_EVENTS.
 */
export function buildEventMessage(kind: EventKind, ctx: EventCtx): NotifyMessage | null {
  if (!NOTIFY_EVENTS[kind]) return null;

  const { id, title, url, role } = ctx;
  const idCode = `<code>${esc(id)}</code>`;
  const description = title ? esc(cleanTitle(title)) : null;

  let header: string;
  let includeDescription = true;
  let extraLine: string | null = null;
  let buttons: NotifyMessage["buttons"];

  switch (kind) {
    case "created":
      header = "New task";
      buttons = [
        ...(url ? [[moreDetailBtn(url)]] : []),
        [liveStatusBtn()],
      ];
      break;

    case "started":
      header = "Work started";
      buttons = [
        ...(url ? [[moreDetailBtn(url)]] : []),
        [liveStatusBtn()],
      ];
      break;

    case "handoff": {
      const roleLabel = role ? (ROLE_LABEL[role] ?? role) : "Unknown";
      header = `Handed over to ${roleLabel}`;
      buttons = [
        ...(url ? [[moreDetailBtn(url)]] : []),
        [liveStatusBtn()],
      ];
      break;
    }

    case "gate":
      header = "Waiting for your approval";
      extraLine = "Approve to let the team continue, or send it back for changes.";
      buttons = [
        ...(id
          ? [[
              { text: "Approve", callback_data: `approve:${id}` },
              { text: "Send Back", callback_data: `reject:${id}` },
            ]]
          : []),
        ...(url ? [[moreDetailBtn(url)]] : []),
        [liveStatusBtn()],
      ];
      break;

    case "approved":
      header = "Approved — the team continues";
      includeDescription = false;
      buttons = [[liveStatusBtn()]];
      break;

    case "rejected":
      header = "Sent back for changes";
      includeDescription = false;
      buttons = [[liveStatusBtn()]];
      break;

    case "blocked":
      header = "Blocked — waiting to be unblocked";
      buttons = [
        ...(url ? [[moreDetailBtn(url)]] : []),
        [liveStatusBtn()],
      ];
      break;

    case "done":
      header = "Completed";
      buttons = [
        ...(url ? [[moreDetailBtn(url)]] : []),
        [liveStatusBtn()],
      ];
      break;

    case "released":
      header = "Now live";
      buttons = [
        ...(url ? [[moreDetailBtn(url)]] : []),
        [liveStatusBtn()],
      ];
      break;

    case "defect":
      header = "Defect found — needs fixing";
      buttons = [
        ...(url ? [[moreDetailBtn(url)]] : []),
        [liveStatusBtn()],
      ];
      break;

    default: {
      // TypeScript exhaustiveness guard
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }

  // Compose message text: bold header + code ID + optional description + optional extra line.
  const parts: string[] = [`<b>${esc(header)}</b>\n${idCode}`];
  if (includeDescription && description) parts.push(description);
  if (extraLine) parts.push(extraLine);

  return { text: parts.join("\n"), buttons };
}
