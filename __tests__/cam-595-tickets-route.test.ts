/**
 * CAM-595 — app/api/tickets/route.ts GET: the truncation signal is actually projected into
 * the HTTP response, and `mode=gate|audit` reach the service layer as the API contract
 * intends.
 *
 * Mocks the WHOLE `@/lib/delivery/tickets` module locally to this file (Vitest module mocks
 * are per-file — this does not touch or conflict with __tests__/delivery-tickets-api.test.ts's
 * own, separate mock of the same module path).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/delivery/tickets", () => ({
  createTicket: vi.fn(),
  listTickets: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 19, retryAfterSec: 0 })),
}));

import { GET as listRoute } from "@/app/api/tickets/route";
import * as ticketsService from "@/lib/delivery/tickets";

const svc = ticketsService as unknown as { listTickets: ReturnType<typeof vi.fn> };

function req(url: string, token = "secret") {
  const u = new URL(url, "http://localhost");
  u.searchParams.set("token", token);
  return new Request(u, { method: "GET" });
}

/** Builds an array carrying the real .total/.truncated own properties, the exact shape
 *  lib/delivery/tickets.ts's listTickets() returns in production (TicketListResult). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withTruncationMeta(rows: any[], total: number, truncated: boolean) {
  return Object.assign([...rows], { total, truncated });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STATUS_TOKEN = "secret";
});

describe("GET /api/tickets — CAM-595 truncation projection", () => {
  it("[unit] projects total/truncated into the JSON body when the service layer reports truncation", async () => {
    svc.listTickets.mockResolvedValueOnce(withTruncationMeta([{ identifier: "CAM-1200" }], 1200, true));
    const res = await listRoute(req("/api/tickets?archived=false"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1200);
    expect(body.truncated).toBe(true);
    expect(body.tickets).toEqual([{ identifier: "CAM-1200" }]);
  });

  it("[unit] projects truncated:false + the real total when the read is complete", async () => {
    svc.listTickets.mockResolvedValueOnce(withTruncationMeta([{ identifier: "CAM-1" }], 1, false));
    const res = await listRoute(req("/api/tickets?archived=false"));
    const body = await res.json();
    expect(body.truncated).toBe(false);
    expect(body.total).toBe(1);
  });

  it("[compat] degrades to the original { tickets } shape when the service layer returns a plain array (no meta)", async () => {
    svc.listTickets.mockResolvedValueOnce([{ identifier: "CAM-1" }]);
    const res = await listRoute(req("/api/tickets?archived=false"));
    const body = await res.json();
    expect(body).toEqual({ tickets: [{ identifier: "CAM-1" }] });
    expect("total" in body).toBe(false);
    expect("truncated" in body).toBe(false);
  });

  it("[unit] mode=gate reaches listTickets and is mutually exclusive with state (400)", async () => {
    svc.listTickets.mockResolvedValueOnce(withTruncationMeta([], 0, false));
    const res = await listRoute(req("/api/tickets?mode=gate"));
    expect(res.status).toBe(200);
    expect(svc.listTickets).toHaveBeenCalledWith({ mode: "gate" });

    const conflict = await listRoute(req("/api/tickets?mode=gate&state=DONE"));
    expect(conflict.status).toBe(400);
  });

  it("[unit] mode=audit reaches listTickets", async () => {
    svc.listTickets.mockResolvedValueOnce(withTruncationMeta([], 0, false));
    const res = await listRoute(req("/api/tickets?mode=audit&archived=false"));
    expect(res.status).toBe(200);
    expect(svc.listTickets).toHaveBeenCalledWith({ mode: "audit", archived: false });
  });

  it("[error/validation] 400 on an unknown mode value", async () => {
    const res = await listRoute(req("/api/tickets?mode=bogus"));
    expect(res.status).toBe(400);
    expect(svc.listTickets).not.toHaveBeenCalled();
  });
});
