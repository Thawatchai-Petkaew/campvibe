/**
 * CAM-602 — app/api/tickets/route.ts GET: the response PROVES which mode/filter the server
 * applied (`appliedMode`), and the query schema is `.strict()` (an unrecognized key is
 * rejected with 400 instead of silently dropped).
 *
 * Mocks the WHOLE `@/lib/delivery/tickets` module locally to this file (Vitest module mocks
 * are per-file — this does not conflict with __tests__/delivery-tickets-api.test.ts's or
 * __tests__/cam-595-tickets-route.test.ts's own, separate mocks of the same module path).
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

/** Builds an array carrying the real .total/.truncated/.appliedMode own properties, the
 *  exact shape lib/delivery/tickets.ts's listTickets() returns in production. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withProof(rows: any[], total: number, truncated: boolean, appliedMode: "gate" | "audit" | null) {
  return Object.assign([...rows], { total, truncated, appliedMode });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STATUS_TOKEN = "secret";
});

describe("GET /api/tickets — CAM-602 appliedMode proof", () => {
  it("[normal] projects appliedMode:\"gate\" when the service layer confirms mode=gate was applied, and the ticket set is exactly the gate set requested", async () => {
    svc.listTickets.mockResolvedValueOnce(
      withProof([{ identifier: "CAM-594", state: "AWAITING_GATE" }], 1, false, "gate")
    );
    const res = await listRoute(req("/api/tickets?mode=gate"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.appliedMode).toBe("gate");
    // teeth (AC-4): mode=gate still returns exactly the AWAITING_GATE set it was asked for —
    // this story adds proof, it does not change what is fetched.
    expect(body.tickets).toEqual([{ identifier: "CAM-594", state: "AWAITING_GATE" }]);
  });

  it("[normal] projects appliedMode:\"audit\" for mode=audit", async () => {
    svc.listTickets.mockResolvedValueOnce(withProof([{ identifier: "CAM-1" }], 1, false, "audit"));
    const res = await listRoute(req("/api/tickets?mode=audit"));
    const body = await res.json();
    expect(body.appliedMode).toBe("audit");
    expect(svc.listTickets).toHaveBeenCalledWith({ mode: "audit" });
  });

  it("[boundary] projects appliedMode:null for a genuine general (no-mode) read", async () => {
    svc.listTickets.mockResolvedValueOnce(withProof([{ identifier: "CAM-1" }], 1, false, null));
    const res = await listRoute(req("/api/tickets?archived=false"));
    const body = await res.json();
    expect(body.appliedMode).toBe(null);
  });

  it("[compat] appliedMode is ABSENT (never a false null/value) when the service layer returns a plain array with no proof at all", async () => {
    svc.listTickets.mockResolvedValueOnce([{ identifier: "CAM-1" }]);
    const res = await listRoute(req("/api/tickets?archived=false"));
    const body = await res.json();
    expect("appliedMode" in body).toBe(false);
    expect(body).toEqual({ tickets: [{ identifier: "CAM-1" }] });
  });

  it("[error/validation] 400 on an unrecognized query key (.strict()) instead of silently dropping it (BR-4)", async () => {
    const res = await listRoute(req("/api/tickets?bogusParam=1"));
    expect(res.status).toBe(400);
    expect(svc.listTickets).not.toHaveBeenCalled();
  });

  it("[unit] `token` is never treated as an unrecognized query key — it is the auth transport, excluded before the strict parse", async () => {
    svc.listTickets.mockResolvedValueOnce(withProof([], 0, false, null));
    const res = await listRoute(req("/api/tickets?archived=false"));
    expect(res.status).toBe(200);
  });

  it("[error/validation] mode+state is still rejected 400 (pre-existing CAM-595 mutual exclusivity, unchanged by .strict())", async () => {
    const res = await listRoute(req("/api/tickets?mode=gate&state=DONE"));
    expect(res.status).toBe(400);
    expect(svc.listTickets).not.toHaveBeenCalled();
  });

  it("[error/validation] an unrecognized mode VALUE is still rejected 400 (pre-existing z.enum check, unchanged)", async () => {
    const res = await listRoute(req("/api/tickets?mode=bogus"));
    expect(res.status).toBe(400);
    expect(svc.listTickets).not.toHaveBeenCalled();
  });
});
