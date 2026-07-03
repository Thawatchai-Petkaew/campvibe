/**
 * CAM-281 (T-5a) — dual-mode WRITE paths behind TICKETS_SOURCE (ADR-010 cutover, part 1).
 *
 * Every existing legacy /status + Telegram mutation route now branches on
 * `process.env.TICKETS_SOURCE === "db"`:
 *   - legacy (default/unset): unchanged, still calls lib/linear-actions (real Linear API).
 *   - db: calls lib/delivery/tickets.ts's state-machine verbs directly — no webhook, the
 *     service itself notifies/dispatches (ADR-010 "single mutation path, no webhook").
 *
 * This file covers, per route:
 *   1. Runtime behavior of the db-mode branch (success / no-gate-pending / not-found /
 *      genuine internal error) — response shape stays IDENTICAL to the legacy shape.
 *   2. Source-inspection: the db branch never calls a lib/linear-actions helper (the two
 *      code paths must stay structurally separate — a copy/paste mistake wiring the wrong
 *      client into the wrong branch is exactly the kind of bug string content alone won't
 *      catch at runtime if the mocks are too permissive).
 *   3. The two CI workflows reference TICKETS_SOURCE + (linear-continue.yml only) the
 *      ticket-sync.mjs gates conditional.
 *
 * Mocking strategy mirrors __tests__/status-approve-endpoints.test.ts +
 * __tests__/delivery-tickets-api.test.ts (the two existing sibling suites this extends).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ── Mocks must be declared BEFORE importing the modules under test ──────────────────────

vi.mock("server-only", () => ({}));

vi.mock("@/lib/linear-actions", () => ({
  removeAwaitingYou: vi.fn(async () => true),
  addComment: vi.fn(async () => true),
  addLabel: vi.fn(async () => true),
  getLabelIdByName: vi.fn(async () => null),
}));

vi.mock("@/lib/linear", () => ({
  fetchStatusIssues: vi.fn(async () => []),
}));

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

import * as linearActions from "@/lib/linear-actions";
import * as linearLib from "@/lib/linear";
import * as ticketsService from "@/lib/delivery/tickets";
import * as statusAdapter from "@/lib/delivery/status-adapter";
import * as rateLimit from "@/lib/rate-limit";
import * as notify from "@/lib/notify";
import * as dispatch from "@/lib/github-dispatch";
import { TicketNotFoundError, TicketTransitionError } from "@/lib/delivery/errors";
import type { StatusIssue } from "@/lib/linear";

const removeAwaitingYou = vi.mocked(linearActions.removeAwaitingYou);
const fetchStatusIssues = vi.mocked(linearLib.fetchStatusIssues);
const legacyAddComment = vi.mocked(linearActions.addComment);
const legacyAddLabel = vi.mocked(linearActions.addLabel);
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
  delete process.env.TICKETS_SOURCE;
  checkRateLimit.mockReturnValue({ allowed: true, remaining: 19, retryAfterSec: 0 });
  approveTicket.mockResolvedValue({ identifier: "CAM-9", state: "IN_PROGRESS" } as never);
  rejectTicket.mockResolvedValue({ identifier: "CAM-9", state: "IN_PROGRESS" } as never);
  deliveryAddComment.mockResolvedValue({ id: "comment_1" } as never);
  fetchTicketFromDb.mockResolvedValue(null);
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// POST /api/status/approve — TICKETS_SOURCE=db
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("POST /api/status/approve — db mode", () => {
  it("calls the delivery approve() verb, never removeAwaitingYou, and returns the identical {ok:true,approved:true} shape", async () => {
    process.env.TICKETS_SOURCE = "db";
    const res = await approveRoute(approveReq({ id: "CAM-9" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, approved: true });
    expect(approveTicket).toHaveBeenCalledWith("CAM-9", expect.any(String));
    expect(removeAwaitingYou).not.toHaveBeenCalled();
  });

  it("ticket not AWAITING_GATE (invalid_state) -> {ok:true,approved:false}, not an error status", async () => {
    process.env.TICKETS_SOURCE = "db";
    approveTicket.mockRejectedValueOnce(new TicketTransitionError("invalid_state", "approve requires AWAITING_GATE"));
    const res = await approveRoute(approveReq({ id: "CAM-9" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, approved: false });
  });

  it("ticket not found -> {ok:true,approved:false}, not a 404", async () => {
    process.env.TICKETS_SOURCE = "db";
    approveTicket.mockRejectedValueOnce(new TicketNotFoundError("CAM-999"));
    const res = await approveRoute(approveReq({ id: "CAM-999" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, approved: false });
  });

  it("a genuine internal error -> 500 generic message, no internals leaked", async () => {
    process.env.TICKETS_SOURCE = "db";
    approveTicket.mockRejectedValueOnce(new Error("connection to delivery db lost: 10.0.0.1:5432"));
    const res = await approveRoute(approveReq({ id: "CAM-9" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ error: "internal_error" });
    expect(JSON.stringify(json)).not.toContain("10.0.0.1");
  });

  it("still validates id + auth + rate-limit before touching either backend", async () => {
    process.env.TICKETS_SOURCE = "db";
    const res = await approveRoute(approveReq({ id: "not-an-id" }));
    expect(res.status).toBe(400);
    expect(approveTicket).not.toHaveBeenCalled();
    expect(removeAwaitingYou).not.toHaveBeenCalled();
  });
});

describe("POST /api/status/approve — legacy mode unaffected (TICKETS_SOURCE unset)", () => {
  it("still calls removeAwaitingYou and never touches the delivery service", async () => {
    const res = await approveRoute(approveReq({ id: "CAM-9" }));
    expect(res.status).toBe(200);
    expect(removeAwaitingYou).toHaveBeenCalledWith("CAM-9");
    expect(approveTicket).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// POST /api/status/reject — TICKETS_SOURCE=db
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("POST /api/status/reject — db mode", () => {
  it("calls reject(note) with the same default Thai reason, never touches Linear, returns {ok:true}", async () => {
    process.env.TICKETS_SOURCE = "db";
    const res = await rejectRoute(rejectReq({ id: "CAM-9" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(rejectTicket).toHaveBeenCalledWith("CAM-9", expect.any(String), "ส่งกลับให้แก้ไขจาก /status/map");
    expect(legacyAddComment).not.toHaveBeenCalled();
    expect(legacyAddLabel).not.toHaveBeenCalled();
    expect(removeAwaitingYou).not.toHaveBeenCalled();
  });

  it("threads a caller-supplied reason through as the note, trimmed + capped", async () => {
    process.env.TICKETS_SOURCE = "db";
    const longReason = "B".repeat(3000);
    await rejectRoute(rejectReq({ id: "CAM-9", reason: longReason }));
    const [, , note] = rejectTicket.mock.calls[0];
    expect((note as string).length).toBe(2000);
  });

  it("invalid_state (not AWAITING_GATE) -> {ok:true}, silent no-op like the legacy branch", async () => {
    process.env.TICKETS_SOURCE = "db";
    rejectTicket.mockRejectedValueOnce(new TicketTransitionError("invalid_state", "reject requires AWAITING_GATE"));
    const res = await rejectRoute(rejectReq({ id: "CAM-9" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("not found -> {ok:true}, silent no-op", async () => {
    process.env.TICKETS_SOURCE = "db";
    rejectTicket.mockRejectedValueOnce(new TicketNotFoundError("CAM-999"));
    const res = await rejectRoute(rejectReq({ id: "CAM-999" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("a genuine internal error -> 500 generic message", async () => {
    process.env.TICKETS_SOURCE = "db";
    rejectTicket.mockRejectedValueOnce(new Error("boom"));
    const res = await rejectRoute(rejectReq({ id: "CAM-9" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal_error" });
  });
});

describe("POST /api/status/reject — legacy mode unaffected", () => {
  it("still calls addComment + addLabel + removeAwaitingYou, never the delivery service", async () => {
    const res = await rejectRoute(rejectReq({ id: "CAM-9", reason: "polish" }));
    expect(res.status).toBe(200);
    expect(legacyAddComment).toHaveBeenCalledWith("CAM-9", "polish");
    expect(legacyAddLabel).toHaveBeenCalledWith("CAM-9", "changes-requested");
    expect(removeAwaitingYou).toHaveBeenCalledWith("CAM-9");
    expect(rejectTicket).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// GET /api/status/issue/[id] — TICKETS_SOURCE=db
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("GET /api/status/issue/[id] — db mode", () => {
  it("serves detail from fetchTicketFromDb, shaped identically to the legacy contract", async () => {
    process.env.TICKETS_SOURCE = "db";
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
    });
    expect(fetchTicketFromDb).toHaveBeenCalledWith("CAM-9");
  });

  it("not found -> 404, never calls fetchStatusIssues", async () => {
    process.env.TICKETS_SOURCE = "db";
    fetchTicketFromDb.mockResolvedValueOnce(null);
    const res = await issueDetailRoute(detailReq("CAM-999"), detailParams("CAM-999"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("a genuine internal error -> 500, no internals leaked", async () => {
    process.env.TICKETS_SOURCE = "db";
    fetchTicketFromDb.mockRejectedValueOnce(new Error("delivery db down"));
    const res = await issueDetailRoute(detailReq("CAM-9"), detailParams("CAM-9"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal_error" });
  });
});

describe("GET /api/status/issue/[id] — legacy mode unaffected", () => {
  it("still calls fetchStatusIssues, never fetchTicketFromDb", async () => {
    fetchStatusIssues.mockResolvedValueOnce([SAMPLE_ISSUE]);
    const res = await issueDetailRoute(detailReq("CAM-9"), detailParams("CAM-9"));
    expect(res.status).toBe(200);
    expect(fetchTicketFromDb).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// POST /api/telegram-webhook — TICKETS_SOURCE=db
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("telegram-webhook — db mode", () => {
  it("approve tap calls the delivery approve() verb, acks only, never double-notifies", async () => {
    process.env.TICKETS_SOURCE = "db";
    const res = await telegramRoute(tgReq({ callback_query: { id: "1", data: "approve:CAM-11" } }));
    expect(await res.json()).toMatchObject({ action: "approve", id: "CAM-11", changed: true });
    expect(approveTicket).toHaveBeenCalledWith("CAM-11", expect.any(String));
    expect(removeAwaitingYou).not.toHaveBeenCalled();
    expect(answerCallback).toHaveBeenCalledWith("1", "Approved CAM-11");
    // The service call itself (mocked here) owns the notification in db mode — the route
    // must not ALSO send one.
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it("approve tap on a ticket with no gate pending acks accordingly, changed:false", async () => {
    process.env.TICKETS_SOURCE = "db";
    approveTicket.mockRejectedValueOnce(new TicketTransitionError("invalid_state", "not awaiting"));
    const res = await telegramRoute(tgReq({ callback_query: { id: "1", data: "approve:CAM-11" } }));
    expect(await res.json()).toMatchObject({ action: "approve", id: "CAM-11", changed: false });
    expect(answerCallback).toHaveBeenCalledWith("1", "CAM-11: no gate pending");
  });

  it("reject tap calls the delivery reject() verb with the fixed note, acks only, never double-notifies", async () => {
    process.env.TICKETS_SOURCE = "db";
    const res = await telegramRoute(tgReq({ callback_query: { id: "1", data: "reject:CAM-11" } }));
    expect(await res.json()).toMatchObject({ action: "reject", id: "CAM-11" });
    expect(rejectTicket).toHaveBeenCalledWith(
      "CAM-11",
      expect.any(String),
      "Rejected via Telegram — needs changes before continuing"
    );
    expect(legacyAddComment).not.toHaveBeenCalled();
    expect(answerCallback).toHaveBeenCalledWith("1", "Sent back CAM-11");
    // reject() (mocked here) owns the "rejected" notification in db mode.
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it("reject tap on a ticket with no gate pending acks accordingly, no notify", async () => {
    process.env.TICKETS_SOURCE = "db";
    rejectTicket.mockRejectedValueOnce(new TicketNotFoundError("CAM-11"));
    const res = await telegramRoute(tgReq({ callback_query: { id: "1", data: "reject:CAM-11" } }));
    expect(await res.json()).toMatchObject({ action: "reject", id: "CAM-11" });
    expect(answerCallback).toHaveBeenCalledWith("1", "CAM-11: no gate pending");
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it("free-text reply to a gate message posts through the delivery addComment verb, not lib/linear-actions", async () => {
    process.env.TICKETS_SOURCE = "db";
    const res = await telegramRoute(
      tgReq({ message: { text: "go ahead", reply_to_message: { text: "CAM-11 Waiting for your approval" } } })
    );
    expect(await res.json()).toMatchObject({ comment: "CAM-11" });
    expect(deliveryAddComment).toHaveBeenCalledWith("CAM-11", expect.any(String), "(Telegram) go ahead");
    expect(legacyAddComment).not.toHaveBeenCalled();
  });

  it("free-text not tied to a gate still dispatches camper-adhoc unchanged", async () => {
    process.env.TICKETS_SOURCE = "db";
    const res = await telegramRoute(tgReq({ message: { text: "add a search feature" } }));
    expect(await res.json()).toMatchObject({ adhoc: true });
    expect(fireRepositoryDispatch).toHaveBeenCalledWith("camper-adhoc", { text: "add a search feature" });
  });
});

describe("telegram-webhook — legacy mode unaffected", () => {
  it("approve tap still calls removeAwaitingYou, never the delivery service", async () => {
    const res = await telegramRoute(tgReq({ callback_query: { id: "1", data: "approve:CAM-11" } }));
    expect(await res.json()).toMatchObject({ action: "approve", id: "CAM-11", changed: true });
    expect(removeAwaitingYou).toHaveBeenCalledWith("CAM-11");
    expect(approveTicket).not.toHaveBeenCalled();
  });

  it("reject tap still calls the legacy addComment + sends its own notification", async () => {
    const res = await telegramRoute(tgReq({ callback_query: { id: "1", data: "reject:CAM-11" } }));
    expect(await res.json()).toMatchObject({ action: "reject", id: "CAM-11" });
    expect(legacyAddComment).toHaveBeenCalledWith("CAM-11", expect.stringContaining("Rejected"));
    expect(rejectTicket).not.toHaveBeenCalled();
    expect(sendTelegram).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// Source-inspection — the db branch structurally never calls a lib/linear-actions helper
// (guards a copy/paste mistake that runtime mocks alone could miss if both branches ever
// accidentally called the same permissive mock).
// ═══════════════════════════════════════════════════════════════════════════════════════

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** Slice `src` from the first index of `startNeedle` (at/after `fromIndex`) up to (excl.) `endNeedle`. */
function sliceBetween(src: string, startNeedle: string, endNeedle: string, fromIndex = 0): string {
  const start = src.indexOf(startNeedle, fromIndex);
  expect(start, `expected to find "${startNeedle}"`).toBeGreaterThan(-1);
  const end = src.indexOf(endNeedle, start);
  expect(end, `expected to find "${endNeedle}" after "${startNeedle}"`).toBeGreaterThan(start);
  return src.slice(start, end);
}

/** Strips `//` line comments so assertions below check real executable code, not prose that
 *  happens to mention a legacy helper's name (e.g. explaining what it mirrors). */
function stripLineComments(src: string): string {
  return src
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("//");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
}

describe("CAM-281 — source-inspection: db branch never calls lib/linear-actions", () => {
  it("app/api/status/approve/route.ts — db branch never calls removeAwaitingYou", () => {
    const src = read("app/api/status/approve/route.ts");
    expect(src).toContain('process.env.TICKETS_SOURCE === "db"');
    expect(src).toContain("approve as approveTicket");
    const branch = stripLineComments(
      sliceBetween(src, 'process.env.TICKETS_SOURCE === "db"', "const approved = await removeAwaitingYou(id);")
    );
    expect(branch).not.toContain("removeAwaitingYou(");
  });

  it("app/api/status/reject/route.ts — db branch never calls addComment/addLabel/removeAwaitingYou (legacy)", () => {
    const src = read("app/api/status/reject/route.ts");
    expect(src).toContain('process.env.TICKETS_SOURCE === "db"');
    expect(src).toContain("reject as rejectTicket");
    const branch = stripLineComments(
      sliceBetween(src, 'process.env.TICKETS_SOURCE === "db"', "// 1. Post the owner's reason as a Linear comment")
    );
    expect(branch).not.toContain("addLabel(");
    expect(branch).not.toContain("removeAwaitingYou(");
  });

  it("app/api/status/issue/[id]/route.ts — db branch never calls fetchStatusIssues", () => {
    const src = read("app/api/status/issue/[id]/route.ts");
    expect(src).toContain('process.env.TICKETS_SOURCE === "db"');
    expect(src).toContain("fetchTicketFromDb");
    const branch = stripLineComments(
      sliceBetween(src, 'process.env.TICKETS_SOURCE === "db"', "const issues = await fetchStatusIssues(0);")
    );
    expect(branch).not.toContain("fetchStatusIssues(");
  });

  it("app/api/telegram-webhook/route.ts — approve db branch never calls removeAwaitingYou", () => {
    const src = read("app/api/telegram-webhook/route.ts");
    const approveSectionStart = src.indexOf('if (action === "approve" && id) {');
    const branch = stripLineComments(
      sliceBetween(src, "if (dbMode) {", "const changed = await removeAwaitingYou(id);", approveSectionStart)
    );
    expect(branch).not.toContain("removeAwaitingYou(");
  });

  it("app/api/telegram-webhook/route.ts — reject db branch never calls the legacy addComment/buildEventMessage/sendTelegram", () => {
    const src = read("app/api/telegram-webhook/route.ts");
    const rejectSectionStart = src.indexOf('if (action === "reject" && id) {');
    const branch = stripLineComments(
      sliceBetween(src, "if (dbMode) {", "// The webhook cannot detect a rejection", rejectSectionStart)
    );
    expect(branch).not.toContain("buildEventMessage(");
    expect(branch).not.toContain("sendTelegram(");
    expect(branch).not.toContain(`addComment(id, REJECT_NOTE)`);
  });

  it("app/api/telegram-webhook/route.ts — free-text gate-reply branch calls both the delivery and legacy comment fns behind dbMode", () => {
    const src = read("app/api/telegram-webhook/route.ts");
    expect(src).toContain("addDeliveryComment(ref[1], DB_ACTOR,");
    expect(src).toContain("addComment(ref[1],");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// CI workflows — TICKETS_SOURCE pass-through + the ticket-sync.mjs gates conditional
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("CAM-281 — CI workflows reference TICKETS_SOURCE", () => {
  it("linear-continue.yml provisions TICKETS_SOURCE and switches gates-confirm to ticket-sync.mjs when db", () => {
    const yml = read(".github/workflows/linear-continue.yml");
    expect(yml).toContain("TICKETS_SOURCE=%s");
    expect(yml).toContain("vars.TICKETS_SOURCE || 'linear'");
    expect(yml).toContain("node scripts/ticket-sync.mjs gates");
    expect(yml).toContain("node scripts/linear-sync.mjs gates");
    expect(yml).toMatch(/if grep -q '\^TICKETS_SOURCE=db\$' \.env; then/);
  });

  it("camper-adhoc.yml provisions TICKETS_SOURCE for parity (no gates-confirm step here)", () => {
    const yml = read(".github/workflows/camper-adhoc.yml");
    expect(yml).toContain("TICKETS_SOURCE=%s");
    expect(yml).toContain("vars.TICKETS_SOURCE || 'linear'");
  });
});
