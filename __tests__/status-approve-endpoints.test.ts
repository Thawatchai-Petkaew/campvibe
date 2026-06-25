/**
 * CAM-184 — Contract tests for the three /api/status/* endpoints:
 *   POST /api/status/approve
 *   POST /api/status/reject
 *   GET  /api/status/issue/[id]
 *
 * Plus the updated linear-webhook approve-vs-reject logic.
 *
 * Mocking strategy (mirrors the existing linear-webhook.test.ts + telegram-webhook.test.ts):
 *   - @/lib/linear-actions → mock all helpers so no real Linear API call is made.
 *   - @/lib/linear          → mock fetchStatusIssues to return a controlled list.
 *   - @/lib/rate-limit      → allow all by default; individual tests override to test 429.
 *   - server-only           → empty module stub (Next.js server-only guard).
 *   - notify + status-pulse → stubbed for the webhook tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

// ── Mocks must be declared BEFORE importing the modules under test ──────────────

vi.mock("server-only", () => ({}));

vi.mock("@/lib/linear-actions", () => ({
  removeAwaitingYou: vi.fn(async () => true),
  addComment: vi.fn(async () => true),
  addLabel: vi.fn(async () => true),
}));

vi.mock("@/lib/linear", () => ({
  fetchStatusIssues: vi.fn(async () => [
    {
      id: "CAM-9",
      title: "[backend-engineer] My test issue",
      status: "In Review",
      statusType: "started",
      priority: "High",
      labels: ["awaiting-you"],
      url: "https://linear.app/campvibe/issue/CAM-9",
      description: "A test issue description.",
      startedAt: null,
      updatedAt: new Date().toISOString(),
      completedAt: null,
      assignee: { name: "Tester", displayName: "Tester", avatarUrl: null },
      project: { id: "proj-1", name: "Test Project" },
      parent: null,
    },
  ]),
}));

// Allow by default; individual tests override.
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 19, retryAfterSec: 0 })),
  _store: new Map(),
}));

vi.mock("@/lib/notify", () => ({
  sendTelegram: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/status-pulse", () => ({ bumpPulse: vi.fn(async () => {}) }));

// ── Import under test ──────────────────────────────────────────────────────────
import { POST as approve } from "@/app/api/status/approve/route";
import { POST as reject } from "@/app/api/status/reject/route";
import { GET as issueDetail } from "@/app/api/status/issue/[id]/route";
import { POST as webhook } from "@/app/api/linear-webhook/route";
import * as linearActions from "@/lib/linear-actions";
import * as linearLib from "@/lib/linear";
import * as rateLimit from "@/lib/rate-limit";
import { sendTelegram } from "@/lib/notify";

const removeAwaitingYou = vi.mocked(linearActions.removeAwaitingYou);
const addComment = vi.mocked(linearActions.addComment);
const addLabelFn = vi.mocked(linearActions.addLabel);
const fetchStatusIssues = vi.mocked(linearLib.fetchStatusIssues);
const checkRateLimit = vi.mocked(rateLimit.checkRateLimit);
const tg = vi.mocked(sendTelegram);

// ── Helpers ────────────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = "test-linear-secret";

function webhookSign(raw: string): string {
  return crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
}

function approveReq(body: unknown, opts: { token?: string; header?: string } = {}) {
  const qs = opts.token ? `?token=${encodeURIComponent(opts.token)}` : "";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.header) headers["x-status-token"] = opts.header;
  return new Request(`http://localhost/api/status/approve${qs}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function rejectReq(body: unknown, opts: { token?: string; header?: string } = {}) {
  const qs = opts.token ? `?token=${encodeURIComponent(opts.token)}` : "";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.header) headers["x-status-token"] = opts.header;
  return new Request(`http://localhost/api/status/reject${qs}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function detailReq(id: string, opts: { token?: string; header?: string } = {}) {
  const qs = opts.token ? `?token=${encodeURIComponent(opts.token)}` : "";
  const headers: Record<string, string> = {};
  if (opts.header) headers["x-status-token"] = opts.header;
  return new Request(`http://localhost/api/status/issue/${id}${qs}`, {
    method: "GET",
    headers,
  });
}

function webhookReq(body: unknown, signed = true) {
  const raw = JSON.stringify(body);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signed) headers["linear-signature"] = webhookSign(raw);
  return new Request("http://localhost/api/linear-webhook", {
    method: "POST",
    headers,
    body: raw,
  });
}

function issueUpdate(data: Record<string, unknown>, updatedFrom: Record<string, unknown> = {}) {
  return { type: "Issue", action: "update", data, updatedFrom };
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.STATUS_TOKEN;
  process.env.LINEAR_WEBHOOK_SECRET = WEBHOOK_SECRET;
  delete process.env.GITHUB_REPO;
  delete process.env.GH_DISPATCH_TOKEN;

  // Default: rate-limit allows all.
  checkRateLimit.mockReturnValue({ allowed: true, remaining: 19, retryAfterSec: 0 });
});

// ── POST /api/status/approve ───────────────────────────────────────────────────

describe("POST /api/status/approve", () => {
  it("[AC6] 401 without STATUS_TOKEN when token is required", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await approve(approveReq({ id: "CAM-9" }));
    expect(res.status).toBe(401);
    expect(removeAwaitingYou).not.toHaveBeenCalled();
  });

  it("[AC6] 401 with wrong token", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await approve(approveReq({ id: "CAM-9" }, { token: "wrong" }));
    expect(res.status).toBe(401);
    expect(removeAwaitingYou).not.toHaveBeenCalled();
  });

  it("200 with correct token via query param, calls removeAwaitingYou", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await approve(approveReq({ id: "CAM-9" }, { token: "secret" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, approved: true });
    expect(removeAwaitingYou).toHaveBeenCalledWith("CAM-9");
  });

  it("200 with correct token via x-status-token header", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await approve(approveReq({ id: "CAM-9" }, { header: "secret" }));
    expect(res.status).toBe(200);
    expect(removeAwaitingYou).toHaveBeenCalledWith("CAM-9");
  });

  it("open (no token configured) — 200 in dev/test", async () => {
    const res = await approve(approveReq({ id: "CAM-10" }));
    expect(res.status).toBe(200);
    expect(removeAwaitingYou).toHaveBeenCalledWith("CAM-10");
  });

  it("[AC6] 400 on bad id — lowercase letters", async () => {
    const res = await approve(approveReq({ id: "cam-9" }));
    expect(res.status).toBe(400);
    expect(removeAwaitingYou).not.toHaveBeenCalled();
  });

  it("[AC6] 400 on bad id — no number suffix", async () => {
    const res = await approve(approveReq({ id: "CAM" }));
    expect(res.status).toBe(400);
  });

  it("[AC6] 400 on bad id — empty string", async () => {
    const res = await approve(approveReq({ id: "" }));
    expect(res.status).toBe(400);
  });

  it("[AC6] 400 on missing id field", async () => {
    const res = await approve(approveReq({}));
    expect(res.status).toBe(400);
  });

  it("429 when rate-limit is exceeded", async () => {
    checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, retryAfterSec: 30 });
    const res = await approve(approveReq({ id: "CAM-9" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(removeAwaitingYou).not.toHaveBeenCalled();
  });

  it("[AC2] approve returns {ok:true, approved:false} when issue not found in Linear", async () => {
    removeAwaitingYou.mockResolvedValueOnce(false);
    const res = await approve(approveReq({ id: "CAM-999" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, approved: false });
  });
});

// ── POST /api/status/reject ────────────────────────────────────────────────────

describe("POST /api/status/reject", () => {
  it("[AC6] 401 without STATUS_TOKEN when token is required", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await reject(rejectReq({ id: "CAM-9" }));
    expect(res.status).toBe(401);
    expect(addComment).not.toHaveBeenCalled();
  });

  it("[AC6] 401 with wrong token via header", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await reject(rejectReq({ id: "CAM-9" }, { header: "nope" }));
    expect(res.status).toBe(401);
    expect(addComment).not.toHaveBeenCalled();
  });

  it("[AC6] 400 on bad id", async () => {
    const res = await reject(rejectReq({ id: "not-valid" }));
    expect(res.status).toBe(400);
    expect(addComment).not.toHaveBeenCalled();
  });

  it("[AC3] calls addComment + addLabel + removeAwaitingYou in order", async () => {
    const order: string[] = [];
    addComment.mockImplementation(async () => { order.push("comment"); return true; });
    addLabelFn.mockImplementation(async () => { order.push("label"); return true; });
    removeAwaitingYou.mockImplementation(async () => { order.push("remove"); return true; });

    const res = await reject(rejectReq({ id: "CAM-9", reason: "Needs more polish" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(order).toEqual(["comment", "label", "remove"]);

    expect(addComment).toHaveBeenCalledWith("CAM-9", "Needs more polish");
    expect(addLabelFn).toHaveBeenCalledWith("CAM-9", "changes-requested");
    expect(removeAwaitingYou).toHaveBeenCalledWith("CAM-9");
  });

  it("[AC3] uses default Thai reason when reason is empty/omitted", async () => {
    await reject(rejectReq({ id: "CAM-9" }));
    expect(addComment).toHaveBeenCalledWith(
      "CAM-9",
      "ส่งกลับให้แก้ไขจาก /status/map"
    );
  });

  it("[AC3] trims and caps reason at 2000 chars", async () => {
    const longReason = "A".repeat(3000);
    await reject(rejectReq({ id: "CAM-9", reason: longReason }));
    const [, calledReason] = addComment.mock.calls[0];
    expect(calledReason.length).toBe(2000);
  });

  it("uses default reason when reason is whitespace-only", async () => {
    await reject(rejectReq({ id: "CAM-9", reason: "   " }));
    expect(addComment).toHaveBeenCalledWith("CAM-9", "ส่งกลับให้แก้ไขจาก /status/map");
  });

  it("429 when rate-limit is exceeded", async () => {
    checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, retryAfterSec: 15 });
    const res = await reject(rejectReq({ id: "CAM-9" }));
    expect(res.status).toBe(429);
    expect(addComment).not.toHaveBeenCalled();
  });
});

// ── GET /api/status/issue/[id] ─────────────────────────────────────────────────

describe("GET /api/status/issue/[id]", () => {
  function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  it("[AC6] 401 without STATUS_TOKEN when token is required", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await issueDetail(detailReq("CAM-9"), makeParams("CAM-9"));
    expect(res.status).toBe(401);
    expect(fetchStatusIssues).not.toHaveBeenCalled();
  });

  it("[AC6] 400 on bad id", async () => {
    const res = await issueDetail(detailReq("invalid"), makeParams("invalid"));
    expect(res.status).toBe(400);
  });

  it("[AC1] 200 with valid id returns the issue detail", async () => {
    const res = await issueDetail(detailReq("CAM-9"), makeParams("CAM-9"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      id: "CAM-9",
      title: "[backend-engineer] My test issue",
      status: "In Review",
      statusType: "started",
      description: "A test issue description.",
      url: "https://linear.app/campvibe/issue/CAM-9",
      role: "backend-engineer",
    });
    expect(json.assignee).toMatchObject({ name: "Tester" });
    expect(json.labels).toContain("awaiting-you");
  });

  it("[AC1] case-insensitive id match (cam-9 → CAM-9)", async () => {
    const res = await issueDetail(detailReq("cam-9"), makeParams("cam-9"));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("CAM-9");
  });

  it("[AC1] 404 when issue not in the list", async () => {
    const res = await issueDetail(detailReq("CAM-999"), makeParams("CAM-999"));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "not_found" });
  });

  it("[AC1] 200 with correct token via query param", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await issueDetail(
      detailReq("CAM-9", { token: "secret" }),
      makeParams("CAM-9")
    );
    expect(res.status).toBe(200);
  });

  it("issue without [role] tag returns undefined role (not present in response)", async () => {
    fetchStatusIssues.mockResolvedValueOnce([
      {
        id: "CAM-99",
        title: "No role tag here",
        status: "To Do",
        statusType: "unstarted",
        priority: "Medium",
        labels: [],
        url: "https://linear.app/x",
        description: "",
        startedAt: null,
        updatedAt: new Date().toISOString(),
        completedAt: null,
        assignee: null,
        project: null,
        parent: null,
      },
    ]);
    const res = await issueDetail(detailReq("CAM-99"), makeParams("CAM-99"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.role).toBeUndefined();
  });
});

// ── Linear webhook: approve-vs-reject logic (CAM-184) ─────────────────────────

describe("linear-webhook approve-vs-reject (CAM-184)", () => {
  it("[AC2] looksApproved = true when awaiting-you removed AND no changes-requested", async () => {
    const body = issueUpdate(
      {
        identifier: "CAM-9",
        title: "Gate G3 · ship",
        url: "https://linear.app/x",
        labels: [], // awaiting-you removed; changes-requested absent
      },
      { labelIds: ["aw"] } // awaiting-you was previously present
    );
    const res = await webhook(webhookReq(body));
    const json = await res.json();
    expect(json.approved).toBe(true);
    expect(json.rejected).toBe(false);
    expect(json.notified).toContain("approved");
    expect(tg).toHaveBeenCalledTimes(1);
    const [text] = tg.mock.calls[0] as [string];
    expect(text).toContain("Approved");
  });

  it("[AC3] looksApproved = false when changes-requested IS present (reject scenario)", async () => {
    const body = issueUpdate(
      {
        identifier: "CAM-9",
        title: "Gate G3 · ship",
        url: "https://linear.app/x",
        // awaiting-you removed; changes-requested now present
        labels: [{ id: "cr", name: "changes-requested" }],
      },
      { labelIds: ["aw"] }
    );
    const res = await webhook(webhookReq(body));
    const json = await res.json();
    expect(json.approved).toBe(false);
    expect(json.notified).not.toContain("approved");
  });

  it("[AC3] looksRejected = true when changes-requested is ADDED to a gate issue", async () => {
    const body = issueUpdate(
      {
        identifier: "CAM-9",
        title: "Gate G3 · ship",
        url: "https://linear.app/x",
        labels: [
          { id: "aw", name: "awaiting-you" },
          { id: "cr", name: "changes-requested" },
        ],
      },
      { labelIds: ["aw"] } // changes-requested was just added
    );
    const res = await webhook(webhookReq(body));
    const json = await res.json();
    expect(json.rejected).toBe(true);
    expect(json.notified).toContain("rejected");
    expect(tg).toHaveBeenCalledTimes(1);
    const [text] = tg.mock.calls[0] as [string];
    expect(text).toContain("Sent back for changes");
  });

  it("[AC3] looksRejected true does NOT fire proceed-dispatch", async () => {
    process.env.GITHUB_REPO = "test/repo";
    process.env.GH_DISPATCH_TOKEN = "gh-token";

    const body = issueUpdate(
      {
        identifier: "CAM-9",
        title: "Gate G3 · ship",
        labels: [
          { id: "aw", name: "awaiting-you" },
          { id: "cr", name: "changes-requested" },
        ],
      },
      { labelIds: ["aw"] }
    );
    const res = await webhook(webhookReq(body));
    const json = await res.json();
    // rejected = true; dispatch should NOT have been fired
    expect(json.rejected).toBe(true);
    // The fireDispatch path is only reached via looksApproved which is false here.
    expect(json.dispatched).toBeUndefined();
  });

  it("existing approved test still passes: awaiting-you removed + changes-requested absent = approved", async () => {
    const body = issueUpdate(
      { identifier: "CAM-9", title: "Gate G3 · ship", labels: [] },
      { labelIds: ["aw"] }
    );
    const res = await webhook(webhookReq(body));
    expect(await res.json()).toMatchObject({
      approved: true,
      notified: ["approved"],
      dispatched: false,
    });
  });
});
