/**
 * CAM-281 — the delivery-ticket service as the single mutation path (ADR-010 cutover).
 *
 * History: T-5a (dual-mode) made every /status + Telegram mutation route branch on
 * `process.env.TICKETS_SOURCE === "db"` — legacy calling lib/linear-actions (real Linear
 * API) vs. calling lib/delivery/tickets.ts's state-machine verbs directly. T-5b (this
 * story) retired the legacy branch entirely: lib/linear-actions.ts and the Linear event
 * webhook (app/api/linear-webhook/route.ts) are deleted, and the four routes below now
 * call the delivery service unconditionally — no TICKETS_SOURCE check remains in any of
 * them.
 *
 * This file covers, per route:
 *   1. Runtime behavior (success / no-gate-pending / not-found / genuine internal error) —
 *      the response shape stays IDENTICAL to what it was under the legacy path (no
 *      contract break for /status/map or the Telegram bot).
 *   2. Source-inspection: none of the four routes reference `TICKETS_SOURCE` or import
 *      `@/lib/linear-actions` any longer (guards against a stray dual-mode leftover).
 *   3. The `linear-continue.yml` CI workflow always runs the ticket-sync.mjs gates check
 *      (no TICKETS_SOURCE conditional, no LINEAR_* env); `camper-adhoc.yml` was repointed in
 *      CAM-282 (T-6, the conventions-rewrite story) — its LINEAR_API_KEY/LINEAR_TEAM_KEY/
 *      TICKETS_SOURCE env lines are gone and its prompt/notify text now uses
 *      `scripts/ticket-sync.mjs` too, mirroring linear-continue.yml.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ── Mocks must be declared BEFORE importing the modules under test ──────────────────────

vi.mock("server-only", () => ({}));

vi.mock("@/lib/delivery/tickets", () => ({
  approve: vi.fn(async () => ({ identifier: "CAM-9", state: "IN_PROGRESS" })),
  reject: vi.fn(async () => ({ identifier: "CAM-9", state: "IN_PROGRESS" })),
  addComment: vi.fn(async () => ({ id: "comment_1" })),
}));

vi.mock("@/lib/delivery/status-adapter", () => ({
  fetchTicketFromDb: vi.fn(async () => null),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 19, retryAfterSec: 0 })),
  _store: new Map(),
}));

vi.mock("@/lib/notify", () => ({
  sendTelegram: vi.fn(async () => ({ ok: true })),
  answerCallback: vi.fn(async () => {}),
}));

vi.mock("@/lib/github-dispatch", () => ({
  fireRepositoryDispatch: vi.fn(async () => ({ dispatched: true })),
}));

// ── Import under test ────────────────────────────────────────────────────────────────────

import { POST as approveRoute } from "@/app/api/status/approve/route";
import { POST as rejectRoute } from "@/app/api/status/reject/route";
import { GET as issueDetailRoute } from "@/app/api/status/issue/[id]/route";
import { POST as telegramRoute } from "@/app/api/telegram-webhook/route";

import * as ticketsService from "@/lib/delivery/tickets";
import * as statusAdapter from "@/lib/delivery/status-adapter";
import * as rateLimit from "@/lib/rate-limit";
import * as notify from "@/lib/notify";
import * as dispatch from "@/lib/github-dispatch";
import { TicketNotFoundError, TicketTransitionError } from "@/lib/delivery/errors";
import type { StatusIssue } from "@/lib/linear";

const approveTicket = vi.mocked(ticketsService.approve);
const rejectTicket = vi.mocked(ticketsService.reject);
const deliveryAddComment = vi.mocked(ticketsService.addComment);
const fetchTicketFromDb = vi.mocked(statusAdapter.fetchTicketFromDb);
const checkRateLimit = vi.mocked(rateLimit.checkRateLimit);
const sendTelegram = vi.mocked(notify.sendTelegram);
const answerCallback = vi.mocked(notify.answerCallback);
const fireRepositoryDispatch = vi.mocked(dispatch.fireRepositoryDispatch);

const TOKEN = "secret";

function approveReq(body: unknown) {
  return new Request(`http://localhost/api/status/approve?token=${TOKEN}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rejectReq(body: unknown) {
  return new Request(`http://localhost/api/status/reject?token=${TOKEN}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function detailReq(id: string) {
  return new Request(`http://localhost/api/status/issue/${id}?token=${TOKEN}`, { method: "GET" });
}

function detailParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const TG_SECRET = "tg-secret";
function tgReq(body: unknown) {
  return new Request("http://localhost/api/telegram-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": TG_SECRET,
    },
    body: JSON.stringify(body),
  });
}

const SAMPLE_ISSUE: StatusIssue = {
  id: "CAM-9",
  title: "[backend-engineer] Ship the thing",
  status: "In Progress",
  statusType: "started",
  priority: "High",
  labels: ["awaiting-you"],
  url: "",
  description: "A delivery-ticket-sourced description.",
  startedAt: null,
  updatedAt: new Date().toISOString(),
  completedAt: null,
  assignee: { name: "Owner", displayName: "Owner", avatarUrl: null },
  project: null,
  parent: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STATUS_TOKEN = TOKEN;
  process.env.TELEGRAM_WEBHOOK_SECRET = TG_SECRET;
  checkRateLimit.mockReturnValue({ allowed: true, remaining: 19, retryAfterSec: 0 });
  approveTicket.mockResolvedValue({ identifier: "CAM-9", state: "IN_PROGRESS" } as never);
  rejectTicket.mockResolvedValue({ identifier: "CAM-9", state: "IN_PROGRESS" } as never);
  deliveryAddComment.mockResolvedValue({ id: "comment_1" } as never);
  fetchTicketFromDb.mockResolvedValue(null);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// POST /api/status/approve
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("POST /api/status/approve", () => {
  it("calls the delivery approve() verb and returns {ok:true,approved:true}", async () => {
    const res = await approveRoute(approveReq({ id: "CAM-9" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, approved: true });
    expect(approveTicket).toHaveBeenCalledWith("CAM-9", expect.any(String));
  });

  it("ticket not AWAITING_GATE (invalid_state) -> {ok:true,approved:false}, not an error status", async () => {
    approveTicket.mockRejectedValueOnce(new TicketTransitionError("invalid_state", "approve requires AWAITING_GATE"));
    const res = await approveRoute(approveReq({ id: "CAM-9" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, approved: false });
  });

  it("ticket not found -> {ok:true,approved:false}, not a 404", async () => {
    approveTicket.mockRejectedValueOnce(new TicketNotFoundError("CAM-999"));
    const res = await approveRoute(approveReq({ id: "CAM-999" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, approved: false });
  });

  it("a genuine internal error -> 500 generic message, no internals leaked", async () => {
    approveTicket.mockRejectedValueOnce(new Error("connection to delivery db lost: 10.0.0.1:5432"));
    const res = await approveRoute(approveReq({ id: "CAM-9" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ error: "internal_error" });
    expect(JSON.stringify(json)).not.toContain("10.0.0.1");
  });

  it("still validates id + auth + rate-limit before touching the delivery service", async () => {
    const res = await approveRoute(approveReq({ id: "not-an-id" }));
    expect(res.status).toBe(400);
    expect(approveTicket).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// POST /api/status/reject
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("POST /api/status/reject", () => {
  it("calls reject(note) with the default Thai reason and returns {ok:true}", async () => {
    const res = await rejectRoute(rejectReq({ id: "CAM-9" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(rejectTicket).toHaveBeenCalledWith("CAM-9", expect.any(String), "ส่งกลับให้แก้ไขจาก /status/map");
  });

  it("threads a caller-supplied reason through as the note, trimmed + capped", async () => {
    const longReason = "B".repeat(3000);
    await rejectRoute(rejectReq({ id: "CAM-9", reason: longReason }));
    const [, , note] = rejectTicket.mock.calls[0];
    expect((note as string).length).toBe(2000);
  });

  it("invalid_state (not AWAITING_GATE) -> {ok:true}, silent no-op", async () => {
    rejectTicket.mockRejectedValueOnce(new TicketTransitionError("invalid_state", "reject requires AWAITING_GATE"));
    const res = await rejectRoute(rejectReq({ id: "CAM-9" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("not found -> {ok:true}, silent no-op", async () => {
    rejectTicket.mockRejectedValueOnce(new TicketNotFoundError("CAM-999"));
    const res = await rejectRoute(rejectReq({ id: "CAM-999" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("a genuine internal error -> 500 generic message", async () => {
    rejectTicket.mockRejectedValueOnce(new Error("boom"));
    const res = await rejectRoute(rejectReq({ id: "CAM-9" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal_error" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// GET /api/status/issue/[id]
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("GET /api/status/issue/[id]", () => {
  it("serves detail from fetchTicketFromDb, shaped identically to the legacy contract", async () => {
    fetchTicketFromDb.mockResolvedValueOnce(SAMPLE_ISSUE);
    const res = await issueDetailRoute(detailReq("CAM-9"), detailParams("CAM-9"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      id: "CAM-9",
      title: "[backend-engineer] Ship the thing",
      status: "In Progress",
      statusType: "started",
      role: "backend-engineer",
      description: "A delivery-ticket-sourced description.",
      url: "",
      assignee: { name: "Owner", displayName: "Owner", avatarUrl: null },
      project: null,
      labels: ["awaiting-you"],
      // CAM-342 (additive): model-tier trial instrumentation; SAMPLE_ISSUE carries no
      // agentModel, so it shapes to null (parity with the legacy-path absence).
      model: null,
    });
    expect(fetchTicketFromDb).toHaveBeenCalledWith("CAM-9");
  });

  it("not found -> 404", async () => {
    fetchTicketFromDb.mockResolvedValueOnce(null);
    const res = await issueDetailRoute(detailReq("CAM-999"), detailParams("CAM-999"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("a genuine internal error -> 500, no internals leaked", async () => {
    fetchTicketFromDb.mockRejectedValueOnce(new Error("delivery db down"));
    const res = await issueDetailRoute(detailReq("CAM-9"), detailParams("CAM-9"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal_error" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// POST /api/telegram-webhook
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("telegram-webhook", () => {
  it("approve tap calls the delivery approve() verb, acks only, never double-notifies", async () => {
    const res = await telegramRoute(tgReq({ callback_query: { id: "1", data: "approve:CAM-11" } }));
    expect(await res.json()).toMatchObject({ action: "approve", id: "CAM-11", changed: true });
    expect(approveTicket).toHaveBeenCalledWith("CAM-11", expect.any(String));
    expect(answerCallback).toHaveBeenCalledWith("1", "Approved CAM-11");
    // The service call itself (mocked here) owns the notification — the route must not
    // ALSO send one.
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it("approve tap on a ticket with no gate pending acks accordingly, changed:false", async () => {
    approveTicket.mockRejectedValueOnce(new TicketTransitionError("invalid_state", "not awaiting"));
    const res = await telegramRoute(tgReq({ callback_query: { id: "1", data: "approve:CAM-11" } }));
    expect(await res.json()).toMatchObject({ action: "approve", id: "CAM-11", changed: false });
    expect(answerCallback).toHaveBeenCalledWith("1", "CAM-11: no gate pending");
  });

  it("reject tap calls the delivery reject() verb with the fixed note, acks only, never double-notifies", async () => {
    const res = await telegramRoute(tgReq({ callback_query: { id: "1", data: "reject:CAM-11" } }));
    expect(await res.json()).toMatchObject({ action: "reject", id: "CAM-11" });
    expect(rejectTicket).toHaveBeenCalledWith(
      "CAM-11",
      expect.any(String),
      "Rejected via Telegram — needs changes before continuing"
    );
    expect(answerCallback).toHaveBeenCalledWith("1", "Sent back CAM-11");
    // reject() (mocked here) owns the "rejected" notification.
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it("reject tap on a ticket with no gate pending acks accordingly, no notify", async () => {
    rejectTicket.mockRejectedValueOnce(new TicketNotFoundError("CAM-11"));
    const res = await telegramRoute(tgReq({ callback_query: { id: "1", data: "reject:CAM-11" } }));
    expect(await res.json()).toMatchObject({ action: "reject", id: "CAM-11" });
    expect(answerCallback).toHaveBeenCalledWith("1", "CAM-11: no gate pending");
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it("free-text reply to a gate message posts through the delivery addComment verb", async () => {
    const res = await telegramRoute(
      tgReq({ message: { text: "go ahead", reply_to_message: { text: "CAM-11 Waiting for your approval" } } })
    );
    expect(await res.json()).toMatchObject({ comment: "CAM-11" });
    expect(deliveryAddComment).toHaveBeenCalledWith("CAM-11", expect.any(String), "(Telegram) go ahead");
  });

  it("free-text not tied to a gate still dispatches camper-adhoc unchanged", async () => {
    const res = await telegramRoute(tgReq({ message: { text: "add a search feature" } }));
    expect(await res.json()).toMatchObject({ adhoc: true });
    expect(fireRepositoryDispatch).toHaveBeenCalledWith("camper-adhoc", { text: "add a search feature" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Source-inspection — none of the four routes reference TICKETS_SOURCE or lib/linear-actions
// any longer (guards against a stray dual-mode leftover from the T-5a cutover).
// ═══════════════════════════════════════════════════════════════════════════════════════

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const SINGLE_PATH_ROUTES = [
  "app/api/status/approve/route.ts",
  "app/api/status/reject/route.ts",
  "app/api/status/issue/[id]/route.ts",
  "app/api/telegram-webhook/route.ts",
];

describe("CAM-281 (T-5b) — the four routes are single-path (no dual-mode leftover)", () => {
  for (const rel of SINGLE_PATH_ROUTES) {
    it(`${rel} — no TICKETS_SOURCE check remains`, () => {
      const src = read(rel);
      expect(src).not.toContain("TICKETS_SOURCE");
    });

    it(`${rel} — no lib/linear-actions import remains`, () => {
      const src = read(rel);
      expect(src).not.toContain("lib/linear-actions");
    });
  }

  it("app/api/status/approve/route.ts calls the delivery approve() verb directly", () => {
    const src = read("app/api/status/approve/route.ts");
    expect(src).toContain("approve as approveTicket");
    expect(src).toContain("await approveTicket(id, DB_ACTOR)");
  });

  it("app/api/status/reject/route.ts calls the delivery reject() verb directly", () => {
    const src = read("app/api/status/reject/route.ts");
    expect(src).toContain("reject as rejectTicket");
    expect(src).toContain("await rejectTicket(id, DB_ACTOR, safeReason)");
  });

  it("app/api/status/issue/[id]/route.ts calls fetchTicketFromDb directly, never fetchStatusIssues", () => {
    const src = read("app/api/status/issue/[id]/route.ts");
    expect(src).toContain("fetchTicketFromDb");
    expect(src).not.toContain("fetchStatusIssues(");
  });

  it("app/api/telegram-webhook/route.ts calls approve/reject/addComment from the delivery service directly", () => {
    const src = read("app/api/telegram-webhook/route.ts");
    expect(src).toContain("approve as approveTicket");
    expect(src).toContain("reject as rejectTicket");
    expect(src).toContain("addComment as addDeliveryComment");
  });

  it("lib/linear-actions.ts no longer exists anywhere in the repo", () => {
    expect(fs.existsSync(path.join(ROOT, "lib", "linear-actions.ts"))).toBe(false);
  });

  it("app/api/linear-webhook/route.ts no longer exists anywhere in the repo", () => {
    expect(fs.existsSync(path.join(ROOT, "app", "api", "linear-webhook", "route.ts"))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// CI workflows — linear-continue.yml always runs ticket-sync.mjs gates (no TICKETS_SOURCE
// conditional, no LINEAR_* env); camper-adhoc.yml is untouched by this story.
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("CAM-281 (T-5b) — CI workflows", () => {
  it("linear-continue.yml always runs ticket-sync.mjs gates, no TICKETS_SOURCE conditional, no LINEAR_* env", () => {
    const yml = read(".github/workflows/linear-continue.yml");
    expect(yml).toContain("node scripts/ticket-sync.mjs gates");
    expect(yml).not.toContain("linear-sync.mjs gates");
    expect(yml).not.toContain("TICKETS_SOURCE");
    expect(yml).not.toContain("LINEAR_API_KEY");
    expect(yml).not.toContain("LINEAR_TEAM_KEY");
  });

  it("linear-continue.yml reports to Telegram via ticket-sync.mjs notify (no LINEAR_API_KEY dependency)", () => {
    const yml = read(".github/workflows/linear-continue.yml");
    expect(yml).toContain("node scripts/ticket-sync.mjs notify");
    expect(yml).not.toContain("linear-sync.mjs notify");
  });

  it("camper-adhoc.yml (CAM-282 T-6) no longer provisions LINEAR_*/TICKETS_SOURCE env and reports via ticket-sync.mjs notify", () => {
    const yml = read(".github/workflows/camper-adhoc.yml");
    expect(yml).not.toContain("TICKETS_SOURCE");
    expect(yml).not.toContain("LINEAR_API_KEY");
    expect(yml).not.toContain("LINEAR_TEAM_KEY");
    expect(yml).toContain("STATUS_TOKEN=%s");
    expect(yml).toContain("APP_BASE_URL=%s");
    expect(yml).toContain("node scripts/ticket-sync.mjs notify");
    expect(yml).not.toContain("linear-sync.mjs notify");
    expect(yml).not.toContain("linear-sync.mjs set");
  });
});
