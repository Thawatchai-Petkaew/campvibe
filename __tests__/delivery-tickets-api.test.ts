/**
 * CAM-278 (T-2) — app/api/tickets/* contract tests.
 *
 * Covers: STATUS_TOKEN authz (401), rate-limit (429), zod boundary rejects (400), the
 * PATCH verb dispatch table (every action -> the matching lib/delivery/tickets call),
 * and error-code mapping (TicketTransitionError -> 400, TicketNotFoundError -> 404,
 * unknown Error -> 500 with no internals leaked).
 *
 * Mocking strategy (mirrors __tests__/status-approve-endpoints.test.ts):
 *   - server-only          -> empty stub.
 *   - @/lib/delivery/tickets -> every exported verb stubbed (asserted on for call args).
 *   - @/lib/rate-limit     -> allow by default; individual tests override to test 429.
 *   - @/lib/delivery/validations enum lists are asserted to stay in lockstep with the
 *     Prisma-generated delivery client's enums (a drift guard).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/delivery/tickets", () => ({
  createTicket: vi.fn(),
  listTickets: vi.fn(async () => []),
  getTicketByIdentifier: vi.fn(),
  listComments: vi.fn(async () => []),
  listEvents: vi.fn(async () => []),
  start: vi.fn(),
  raiseGate: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  complete: vi.fn(),
  release: vi.fn(),
  cancel: vi.fn(),
  reopen: vi.fn(),
  handoff: vi.fn(),
  archiveTicket: vi.fn(),
  unarchiveTicket: vi.fn(),
  setBlocked: vi.fn(),
  updateFields: vi.fn(),
  addComment: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 19, retryAfterSec: 0 })),
  _store: new Map(),
}));

import { GET as listRoute, POST as createRoute } from "@/app/api/tickets/route";
import { GET as detailRoute, PATCH as patchRoute } from "@/app/api/tickets/[id]/route";
import { POST as commentRoute } from "@/app/api/tickets/[id]/comments/route";
import * as ticketsService from "@/lib/delivery/tickets";
import * as rateLimit from "@/lib/rate-limit";
import { TicketNotFoundError, TicketTransitionError } from "@/lib/delivery/errors";
import { TICKET_TYPES, DELIVERY_ROLES, PERSONAS, AGENT_MODEL_TIERS } from "@/lib/delivery/validations";
import { TicketType, DeliveryRole, Persona } from "@/prisma/delivery/generated/delivery-client";

const svc = ticketsService as unknown as Record<string, ReturnType<typeof vi.fn>>;
const checkRateLimit = vi.mocked(rateLimit.checkRateLimit);

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function req(url: string, opts: { method?: string; body?: unknown; token?: string } = {}) {
  const u = new URL(url, "http://localhost");
  if (opts.token) u.searchParams.set("token", opts.token);
  return new Request(u, {
    method: opts.method ?? "GET",
    headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

const SAMPLE_TICKET = { id: "t_1", identifier: "CAM-1", title: "Sample", state: "BACKLOG" };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.STATUS_TOKEN;
  checkRateLimit.mockReturnValue({ allowed: true, remaining: 19, retryAfterSec: 0 });
});

// ── enum drift guard ─────────────────────────────────────────────────────────────────────

describe("lib/delivery/validations enum lists stay in lockstep with the Prisma schema", () => {
  it("TICKET_TYPES matches the generated TicketType enum", () => {
    expect([...TICKET_TYPES].sort()).toEqual(Object.values(TicketType).sort());
  });
  it("DELIVERY_ROLES matches the generated DeliveryRole enum", () => {
    expect([...DELIVERY_ROLES].sort()).toEqual(Object.values(DeliveryRole).sort());
  });
  it("PERSONAS matches the generated Persona enum", () => {
    expect([...PERSONAS].sort()).toEqual(Object.values(Persona).sort());
  });
  // CAM-342: agentModel is deliberately NOT a Prisma enum (schema.prisma keeps it a plain
  // String? column -- see prisma/delivery/schema.prisma comment); this guard instead pins
  // the literal tuple to BR-1's exact allowed set so a future edit can't silently drift.
  it("AGENT_MODEL_TIERS is exactly BR-1's allowed set, lowercase", () => {
    expect([...AGENT_MODEL_TIERS]).toEqual(["fable", "opus", "sonnet", "haiku"]);
  });
});

// ── GET /api/tickets ─────────────────────────────────────────────────────────────────────

describe("GET /api/tickets", () => {
  it("401 without STATUS_TOKEN when required", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await listRoute(req("/api/tickets"));
    expect(res.status).toBe(401);
    expect(svc.listTickets).not.toHaveBeenCalled();
  });

  it("429 when rate-limited", async () => {
    process.env.STATUS_TOKEN = "secret";
    checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, retryAfterSec: 12 });
    const res = await listRoute(req("/api/tickets", { token: "secret" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("12");
  });

  it("400 on an invalid state filter", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await listRoute(req("/api/tickets?state=NOT_A_STATE", { token: "secret" }));
    expect(res.status).toBe(400);
  });

  it("200 parses filters and returns { tickets }", async () => {
    process.env.STATUS_TOKEN = "secret";
    svc.listTickets.mockResolvedValueOnce([SAMPLE_TICKET]);
    const res = await listRoute(req("/api/tickets?state=BACKLOG&epicId=e1&archived=false", { token: "secret" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tickets: [SAMPLE_TICKET] });
    expect(svc.listTickets).toHaveBeenCalledWith({ state: "BACKLOG", epicId: "e1", archived: false });
  });
});

// ── POST /api/tickets ────────────────────────────────────────────────────────────────────

describe("POST /api/tickets", () => {
  it("401 without STATUS_TOKEN", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await createRoute(req("/api/tickets", { method: "POST", body: { actor: "a", title: "t", type: "STORY" } }));
    expect(res.status).toBe(401);
    expect(svc.createTicket).not.toHaveBeenCalled();
  });

  it("429 when rate-limited", async () => {
    process.env.STATUS_TOKEN = "secret";
    checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, retryAfterSec: 5 });
    const res = await createRoute(
      req("/api/tickets", { method: "POST", body: { actor: "a", title: "t", type: "STORY" }, token: "secret" })
    );
    expect(res.status).toBe(429);
  });

  it("400 on missing title/type", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await createRoute(req("/api/tickets", { method: "POST", body: { actor: "human" }, token: "secret" }));
    expect(res.status).toBe(400);
    expect(svc.createTicket).not.toHaveBeenCalled();
  });

  it("400 on an empty actor", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await createRoute(
      req("/api/tickets", { method: "POST", body: { actor: "", title: "t", type: "STORY" }, token: "secret" })
    );
    expect(res.status).toBe(400);
  });

  it("400 on an invalid JSON body", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await createRoute(
      new Request("http://localhost/api/tickets?token=secret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      })
    );
    expect(res.status).toBe(400);
  });

  it("201 splits actor from the rest of the body and returns { ticket }", async () => {
    process.env.STATUS_TOKEN = "secret";
    svc.createTicket.mockResolvedValueOnce(SAMPLE_TICKET);
    const res = await createRoute(
      req("/api/tickets", {
        method: "POST",
        body: { actor: "architect", title: "New epic", type: "EPIC", priority: 2 },
        token: "secret",
      })
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ticket: SAMPLE_TICKET });
    expect(svc.createTicket).toHaveBeenCalledWith("architect", { title: "New epic", type: "EPIC", priority: 2 });
  });

  it("500 maps an unexpected Error to internal_error with no stack leaked", async () => {
    process.env.STATUS_TOKEN = "secret";
    svc.createTicket.mockRejectedValueOnce(new Error("db connection string leaked details"));
    const res = await createRoute(
      req("/api/tickets", { method: "POST", body: { actor: "a", title: "t", type: "STORY" }, token: "secret" })
    );
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ error: "internal_error" });
  });
});

// ── GET /api/tickets/[id] ────────────────────────────────────────────────────────────────

describe("GET /api/tickets/[id]", () => {
  it("401 without STATUS_TOKEN", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await detailRoute(req("/api/tickets/CAM-1"), params("CAM-1"));
    expect(res.status).toBe(401);
  });

  it("400 on a malformed id", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await detailRoute(req("/api/tickets/nope", { token: "secret" }), params("nope"));
    expect(res.status).toBe(400);
  });

  it("404 when the ticket does not exist", async () => {
    process.env.STATUS_TOKEN = "secret";
    svc.getTicketByIdentifier.mockResolvedValueOnce(null);
    const res = await detailRoute(req("/api/tickets/CAM-999", { token: "secret" }), params("CAM-999"));
    expect(res.status).toBe(404);
  });

  it("200 returns { ticket, comments, events }", async () => {
    process.env.STATUS_TOKEN = "secret";
    svc.getTicketByIdentifier.mockResolvedValueOnce(SAMPLE_TICKET);
    svc.listComments.mockResolvedValueOnce([{ id: "c1", body: "hi" }]);
    svc.listEvents.mockResolvedValueOnce([{ id: "e1", kind: "created" }]);
    const res = await detailRoute(req("/api/tickets/CAM-1", { token: "secret" }), params("CAM-1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ticket: SAMPLE_TICKET,
      comments: [{ id: "c1", body: "hi" }],
      events: [{ id: "e1", kind: "created" }],
    });
  });
});

// ── PATCH /api/tickets/[id] — verb dispatch table ───────────────────────────────────────

describe("PATCH /api/tickets/[id]", () => {
  it("401 without STATUS_TOKEN", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await patchRoute(
      req("/api/tickets/CAM-1", { method: "PATCH", body: { action: "start", actor: "human" } }),
      params("CAM-1")
    );
    expect(res.status).toBe(401);
  });

  it("400 on a malformed id", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await patchRoute(
      req("/api/tickets/nope", { method: "PATCH", body: { action: "start", actor: "human" }, token: "secret" }),
      params("nope")
    );
    expect(res.status).toBe(400);
  });

  it("400 on an unknown action", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await patchRoute(
      req("/api/tickets/CAM-1", { method: "PATCH", body: { action: "nope", actor: "human" }, token: "secret" }),
      params("CAM-1")
    );
    expect(res.status).toBe(400);
  });

  it("400 when reopen is called without a note (G2-locked requirement enforced at the boundary)", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await patchRoute(
      req("/api/tickets/CAM-1", { method: "PATCH", body: { action: "reopen", actor: "human" }, token: "secret" }),
      params("CAM-1")
    );
    expect(res.status).toBe(400);
    expect(svc.reopen).not.toHaveBeenCalled();
  });

  it("400 when handoff is called without a role", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await patchRoute(
      req("/api/tickets/CAM-1", { method: "PATCH", body: { action: "handoff", actor: "human" }, token: "secret" }),
      params("CAM-1")
    );
    expect(res.status).toBe(400);
    expect(svc.handoff).not.toHaveBeenCalled();
  });

  const dispatchCases: Array<{ body: Record<string, unknown>; fn: string; args: unknown[] }> = [
    { body: { action: "start", actor: "human", role: "ARCHITECT" }, fn: "start", args: ["CAM-1", "human", "ARCHITECT"] },
    { body: { action: "start", actor: "human" }, fn: "start", args: ["CAM-1", "human", undefined] },
    { body: { action: "raiseGate", actor: "human", note: "G2" }, fn: "raiseGate", args: ["CAM-1", "human", "G2"] },
    { body: { action: "approve", actor: "human", nextRole: "UX_DESIGNER" }, fn: "approve", args: ["CAM-1", "human", "UX_DESIGNER"] },
    { body: { action: "reject", actor: "human" }, fn: "reject", args: ["CAM-1", "human", undefined] },
    { body: { action: "complete", actor: "human" }, fn: "complete", args: ["CAM-1", "human"] },
    { body: { action: "release", actor: "human" }, fn: "release", args: ["CAM-1", "human"] },
    { body: { action: "cancel", actor: "human", note: "dup" }, fn: "cancel", args: ["CAM-1", "human", "dup"] },
    { body: { action: "reopen", actor: "human", note: "regression" }, fn: "reopen", args: ["CAM-1", "human", "regression"] },
    {
      body: { action: "handoff", actor: "human", role: "BACKEND_ENGINEER", note: "go" },
      fn: "handoff",
      args: ["CAM-1", "human", "BACKEND_ENGINEER", "go", undefined],
    },
    // CAM-342 — model-tier stamp threaded through the handoff verb (AC-5)
    {
      body: { action: "handoff", actor: "human", role: "BACKEND_ENGINEER", note: "go", agentModel: "sonnet" },
      fn: "handoff",
      args: ["CAM-1", "human", "BACKEND_ENGINEER", "go", "sonnet"],
    },
    { body: { action: "archive", actor: "human" }, fn: "archiveTicket", args: ["CAM-1", "human"] },
    { body: { action: "unarchive", actor: "human" }, fn: "unarchiveTicket", args: ["CAM-1", "human"] },
    {
      body: { action: "setBlocked", actor: "human", blocked: true, note: "waiting" },
      fn: "setBlocked",
      args: ["CAM-1", "human", true, "waiting"],
    },
    {
      body: { action: "updateFields", actor: "human", title: "New title" },
      fn: "updateFields",
      args: ["CAM-1", "human", { title: "New title" }],
    },
    // CAM-342 — model-tier stamp threaded through the updateFields verb (AC-5)
    {
      body: { action: "updateFields", actor: "human", agentModel: "opus" },
      fn: "updateFields",
      args: ["CAM-1", "human", { agentModel: "opus" }],
    },
  ];

  it.each(dispatchCases)("action=$body.action dispatches to $fn with the right args", async ({ body, fn, args }) => {
    process.env.STATUS_TOKEN = "secret";
    svc[fn].mockResolvedValueOnce(SAMPLE_TICKET);
    const res = await patchRoute(
      req("/api/tickets/CAM-1", { method: "PATCH", body, token: "secret" }),
      params("CAM-1")
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ticket: SAMPLE_TICKET });
    expect(svc[fn]).toHaveBeenCalledWith(...args);
  });

  // CAM-342 — EC-3: a stamp value outside fable|opus|sonnet|haiku is rejected at the
  // boundary (400) and never reaches the service layer (never stored).
  describe("agentModel outside the allowed set (EC-3)", () => {
    it("400 on handoff with an out-of-set agentModel; handoff is never called", async () => {
      process.env.STATUS_TOKEN = "secret";
      const res = await patchRoute(
        req("/api/tickets/CAM-1", {
          method: "PATCH",
          body: { action: "handoff", actor: "human", role: "BACKEND_ENGINEER", agentModel: "gpt5" },
          token: "secret",
        }),
        params("CAM-1")
      );
      expect(res.status).toBe(400);
      expect(svc.handoff).not.toHaveBeenCalled();
    });

    it("400 on updateFields with an out-of-set agentModel; updateFields is never called", async () => {
      process.env.STATUS_TOKEN = "secret";
      const res = await patchRoute(
        req("/api/tickets/CAM-1", {
          method: "PATCH",
          body: { action: "updateFields", actor: "human", agentModel: "GPT5" }, // wrong case too
          token: "secret",
        }),
        params("CAM-1")
      );
      expect(res.status).toBe(400);
      expect(svc.updateFields).not.toHaveBeenCalled();
    });
  });

  it("maps a TicketTransitionError to 400 with { error: code, message }", async () => {
    process.env.STATUS_TOKEN = "secret";
    svc.start.mockRejectedValueOnce(new TicketTransitionError("invalid_state", "start requires state in [BACKLOG]"));
    const res = await patchRoute(
      req("/api/tickets/CAM-1", { method: "PATCH", body: { action: "start", actor: "human" }, token: "secret" }),
      params("CAM-1")
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_state", message: "start requires state in [BACKLOG]" });
  });

  it("maps a TicketNotFoundError to 404", async () => {
    process.env.STATUS_TOKEN = "secret";
    svc.start.mockRejectedValueOnce(new TicketNotFoundError("CAM-9999"));
    const res = await patchRoute(
      req("/api/tickets/CAM-9999", { method: "PATCH", body: { action: "start", actor: "human" }, token: "secret" }),
      params("CAM-9999")
    );
    expect(res.status).toBe(404);
  });

  it("429 when rate-limited", async () => {
    process.env.STATUS_TOKEN = "secret";
    checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, retryAfterSec: 9 });
    const res = await patchRoute(
      req("/api/tickets/CAM-1", { method: "PATCH", body: { action: "start", actor: "human" }, token: "secret" }),
      params("CAM-1")
    );
    expect(res.status).toBe(429);
    expect(svc.start).not.toHaveBeenCalled();
  });
});

// ── POST /api/tickets/[id]/comments ─────────────────────────────────────────────────────

describe("POST /api/tickets/[id]/comments", () => {
  it("401 without STATUS_TOKEN", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await commentRoute(
      req("/api/tickets/CAM-1/comments", { method: "POST", body: { actor: "human", body: "hi" } }),
      params("CAM-1")
    );
    expect(res.status).toBe(401);
  });

  it("400 on a malformed id", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await commentRoute(
      req("/api/tickets/nope/comments", { method: "POST", body: { actor: "human", body: "hi" }, token: "secret" }),
      params("nope")
    );
    expect(res.status).toBe(400);
  });

  it("400 on an empty comment body", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await commentRoute(
      req("/api/tickets/CAM-1/comments", { method: "POST", body: { actor: "human", body: "   " }, token: "secret" }),
      params("CAM-1")
    );
    expect(res.status).toBe(400);
    expect(svc.addComment).not.toHaveBeenCalled();
  });

  it("404 when the ticket does not exist", async () => {
    process.env.STATUS_TOKEN = "secret";
    svc.addComment.mockRejectedValueOnce(new TicketNotFoundError("CAM-999"));
    const res = await commentRoute(
      req("/api/tickets/CAM-999/comments", { method: "POST", body: { actor: "human", body: "hi" }, token: "secret" }),
      params("CAM-999")
    );
    expect(res.status).toBe(404);
  });

  it("201 creates the comment", async () => {
    process.env.STATUS_TOKEN = "secret";
    svc.addComment.mockResolvedValueOnce({ id: "c1", body: "hi", authorName: "human" });
    const res = await commentRoute(
      req("/api/tickets/CAM-1/comments", { method: "POST", body: { actor: "human", body: "hi" }, token: "secret" }),
      params("CAM-1")
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ comment: { id: "c1", body: "hi", authorName: "human" } });
    expect(svc.addComment).toHaveBeenCalledWith("CAM-1", "human", "hi");
  });

  it("429 when rate-limited", async () => {
    process.env.STATUS_TOKEN = "secret";
    checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, retryAfterSec: 3 });
    const res = await commentRoute(
      req("/api/tickets/CAM-1/comments", { method: "POST", body: { actor: "human", body: "hi" }, token: "secret" }),
      params("CAM-1")
    );
    expect(res.status).toBe(429);
  });
});
