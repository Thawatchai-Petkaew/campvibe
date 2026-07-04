/**
 * CAM-184 — Contract tests for the three /api/status/* endpoints:
 *   POST /api/status/approve
 *   POST /api/status/reject
 *   GET  /api/status/issue/[id]
 *
 * CAM-281 (T-5b) retired the legacy Linear branch these routes used to carry (dual-mode
 * cutover, T-5a) — the delivery service (lib/delivery/tickets.ts / status-adapter.ts) is
 * now their ONLY path, so this file's mocks/assertions point at that service. The
 * linear-webhook approve-vs-reject suite that used to live in this file moved with the
 * route's deletion — see __tests__/cam-281-dual-mode-writes.test.ts for the fuller
 * behavioral/error-mapping coverage of the single path.
 *
 * Mocking strategy: mock @/lib/delivery/tickets + @/lib/delivery/status-adapter so no real
 * DB call is made; @/lib/rate-limit allows all by default (individual tests override to
 * test 429); server-only is stubbed (Next.js server-only guard).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks must be declared BEFORE importing the modules under test ──────────────

vi.mock("server-only", () => ({}));

vi.mock("@/lib/delivery/tickets", () => ({
  approve: vi.fn(async () => ({ identifier: "CAM-9", state: "IN_PROGRESS" })),
  reject: vi.fn(async () => ({ identifier: "CAM-9", state: "IN_PROGRESS" })),
}));

vi.mock("@/lib/delivery/status-adapter", () => ({
  fetchTicketFromDb: vi.fn(async (id: string) =>
    id.toUpperCase() === "CAM-9"
      ? {
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
        }
      : null
  ),
}));

// Allow by default; individual tests override.
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 19, retryAfterSec: 0 })),
  _store: new Map(),
}));

// ── Import under test ──────────────────────────────────────────────────────────
import { POST as approve } from "@/app/api/status/approve/route";
import { POST as reject } from "@/app/api/status/reject/route";
import { GET as issueDetail } from "@/app/api/status/issue/[id]/route";
import * as ticketsService from "@/lib/delivery/tickets";
import * as statusAdapter from "@/lib/delivery/status-adapter";
import * as rateLimit from "@/lib/rate-limit";
import { TicketNotFoundError, TicketTransitionError } from "@/lib/delivery/errors";

const approveTicket = vi.mocked(ticketsService.approve);
const rejectTicket = vi.mocked(ticketsService.reject);
const fetchTicketFromDb = vi.mocked(statusAdapter.fetchTicketFromDb);
const checkRateLimit = vi.mocked(rateLimit.checkRateLimit);

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.STATUS_TOKEN;

  // Default: rate-limit allows all.
  checkRateLimit.mockReturnValue({ allowed: true, remaining: 19, retryAfterSec: 0 });
  approveTicket.mockResolvedValue({ identifier: "CAM-9", state: "IN_PROGRESS" } as never);
  rejectTicket.mockResolvedValue({ identifier: "CAM-9", state: "IN_PROGRESS" } as never);
});

// ── POST /api/status/approve ───────────────────────────────────────────────────

describe("POST /api/status/approve", () => {
  it("[AC6] 401 without STATUS_TOKEN when token is required", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await approve(approveReq({ id: "CAM-9" }));
    expect(res.status).toBe(401);
    expect(approveTicket).not.toHaveBeenCalled();
  });

  it("[AC6] 401 with wrong token", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await approve(approveReq({ id: "CAM-9" }, { token: "wrong" }));
    expect(res.status).toBe(401);
    expect(approveTicket).not.toHaveBeenCalled();
  });

  it("200 with correct token via query param, calls the delivery approve() verb", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await approve(approveReq({ id: "CAM-9" }, { token: "secret" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, approved: true });
    expect(approveTicket).toHaveBeenCalledWith("CAM-9", expect.any(String));
  });

  it("200 with correct token via x-status-token header", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await approve(approveReq({ id: "CAM-9" }, { header: "secret" }));
    expect(res.status).toBe(200);
    expect(approveTicket).toHaveBeenCalledWith("CAM-9", expect.any(String));
  });

  // SEC-A: no open fallback — missing STATUS_TOKEN must return 401
  it("[SEC-A] 401 when STATUS_TOKEN is not configured", async () => {
    // STATUS_TOKEN is already deleted in beforeEach
    const res = await approve(approveReq({ id: "CAM-10" }));
    expect(res.status).toBe(401);
    expect(approveTicket).not.toHaveBeenCalled();
  });

  it("[AC6] 400 on bad id — lowercase letters", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await approve(approveReq({ id: "cam-9" }, { token: "secret" }));
    expect(res.status).toBe(400);
    expect(approveTicket).not.toHaveBeenCalled();
  });

  it("[AC6] 400 on bad id — no number suffix", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await approve(approveReq({ id: "CAM" }, { token: "secret" }));
    expect(res.status).toBe(400);
  });

  it("[AC6] 400 on bad id — empty string", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await approve(approveReq({ id: "" }, { token: "secret" }));
    expect(res.status).toBe(400);
  });

  it("[AC6] 400 on missing id field", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await approve(approveReq({}, { token: "secret" }));
    expect(res.status).toBe(400);
  });

  it("429 when rate-limit is exceeded", async () => {
    process.env.STATUS_TOKEN = "secret";
    checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, retryAfterSec: 30 });
    const res = await approve(approveReq({ id: "CAM-9" }, { token: "secret" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(approveTicket).not.toHaveBeenCalled();
  });

  it("[AC2] approve returns {ok:true, approved:false} when the ticket isn't awaiting a gate", async () => {
    process.env.STATUS_TOKEN = "secret";
    approveTicket.mockRejectedValueOnce(new TicketNotFoundError("CAM-999"));
    const res = await approve(approveReq({ id: "CAM-999" }, { token: "secret" }));
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
    expect(rejectTicket).not.toHaveBeenCalled();
  });

  it("[AC6] 401 with wrong token via header", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await reject(rejectReq({ id: "CAM-9" }, { header: "nope" }));
    expect(res.status).toBe(401);
    expect(rejectTicket).not.toHaveBeenCalled();
  });

  it("[AC6] 400 on bad id", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await reject(rejectReq({ id: "not-valid" }, { token: "secret" }));
    expect(res.status).toBe(400);
    expect(rejectTicket).not.toHaveBeenCalled();
  });

  it("[AC3] calls the delivery reject() verb with the note", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await reject(rejectReq({ id: "CAM-9", reason: "Needs more polish" }, { token: "secret" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(rejectTicket).toHaveBeenCalledWith("CAM-9", expect.any(String), "Needs more polish");
  });

  it("[AC3] uses default Thai reason when reason is empty/omitted", async () => {
    process.env.STATUS_TOKEN = "secret";
    await reject(rejectReq({ id: "CAM-9" }, { token: "secret" }));
    expect(rejectTicket).toHaveBeenCalledWith("CAM-9", expect.any(String), "ส่งกลับให้แก้ไขจาก /status/map");
  });

  it("[AC3] trims and caps reason at 2000 chars", async () => {
    process.env.STATUS_TOKEN = "secret";
    const longReason = "A".repeat(3000);
    await reject(rejectReq({ id: "CAM-9", reason: longReason }, { token: "secret" }));
    const [, , calledReason] = rejectTicket.mock.calls[0];
    expect((calledReason as string).length).toBe(2000);
  });

  it("uses default reason when reason is whitespace-only", async () => {
    process.env.STATUS_TOKEN = "secret";
    await reject(rejectReq({ id: "CAM-9", reason: "   " }, { token: "secret" }));
    expect(rejectTicket).toHaveBeenCalledWith("CAM-9", expect.any(String), "ส่งกลับให้แก้ไขจาก /status/map");
  });

  it("429 when rate-limit is exceeded", async () => {
    process.env.STATUS_TOKEN = "secret";
    checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, retryAfterSec: 15 });
    const res = await reject(rejectReq({ id: "CAM-9" }, { token: "secret" }));
    expect(res.status).toBe(429);
    expect(rejectTicket).not.toHaveBeenCalled();
  });

  it("not awaiting a gate -> {ok:true}, silent no-op", async () => {
    process.env.STATUS_TOKEN = "secret";
    rejectTicket.mockRejectedValueOnce(new TicketTransitionError("invalid_state", "reject requires AWAITING_GATE"));
    const res = await reject(rejectReq({ id: "CAM-9" }, { token: "secret" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
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
    expect(fetchTicketFromDb).not.toHaveBeenCalled();
  });

  // SEC-A: 401 when STATUS_TOKEN is not configured
  it("[SEC-A] 401 when STATUS_TOKEN is not configured", async () => {
    // STATUS_TOKEN is already deleted in beforeEach
    const res = await issueDetail(detailReq("CAM-9"), makeParams("CAM-9"));
    expect(res.status).toBe(401);
    expect(fetchTicketFromDb).not.toHaveBeenCalled();
  });

  it("[AC6] 400 on bad id", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await issueDetail(detailReq("invalid", { token: "secret" }), makeParams("invalid"));
    expect(res.status).toBe(400);
  });

  it("[AC1] 200 with valid id returns the issue detail", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await issueDetail(detailReq("CAM-9", { token: "secret" }), makeParams("CAM-9"));
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
    process.env.STATUS_TOKEN = "secret";
    const res = await issueDetail(detailReq("cam-9", { token: "secret" }), makeParams("cam-9"));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("CAM-9");
  });

  it("[AC1] 404 when the ticket doesn't exist", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await issueDetail(detailReq("CAM-999", { token: "secret" }), makeParams("CAM-999"));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "not_found" });
  });

  it("[AC1] 200 with correct token via query param", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await issueDetail(detailReq("CAM-9", { token: "secret" }), makeParams("CAM-9"));
    expect(res.status).toBe(200);
  });

  it("issue without [role] tag returns undefined role (not present in response)", async () => {
    process.env.STATUS_TOKEN = "secret";
    fetchTicketFromDb.mockResolvedValueOnce({
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
    });
    const res = await issueDetail(detailReq("CAM-99", { token: "secret" }), makeParams("CAM-99"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.role).toBeUndefined();
  });

  // SEC-A: rate-limit 429
  it("[SEC-A] 429 + Retry-After when rate limit is exceeded for issue/[id]", async () => {
    checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, retryAfterSec: 30 });
    process.env.STATUS_TOKEN = "secret";
    const res = await issueDetail(detailReq("CAM-9", { token: "secret" }), makeParams("CAM-9"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(fetchTicketFromDb).not.toHaveBeenCalled();
  });
});
