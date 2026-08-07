/**
 * cam-702-booking-api-create.test.ts — CAM-702 (epic CAM-695, ADR-018 D1)
 * "The chat actually books"
 *
 * Pure-logic coverage for `bookingAPI.create` (lib/api-client.ts) — the ONE
 * facade this story gives its first real caller. Mocks `fetch` only (the
 * outer network boundary), asserting the discriminated-union outcome per
 * ADR-018 D1's own contract table, and pins the `source: 'CHAT'` hardcode.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { bookingAPI, type BookingCreateInput } from "@/lib/api-client";

const VALID_INPUT: BookingCreateInput = {
  campSiteId: "cs-1",
  checkInDate: "2026-08-01",
  checkOutDate: "2026-08-03",
  guests: 2,
};

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: (name: string) => headers[name] ?? null } as unknown as Headers,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("bookingAPI.create — success (201, the raw created row)", () => {
  it("[normal] a 201 with id/status/snapshotTotalAmount resolves kind:'created'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ id: "bk_1", status: "PENDING", snapshotTotalAmount: 1000 }, 201))
    );
    const result = await bookingAPI.create(VALID_INPUT);
    expect(result).toEqual({ kind: "created", booking: { id: "bk_1", status: "PENDING", snapshotTotalAmount: 1000 } });
  });

  it("[boundary] snapshotTotalAmount: null is accepted (defensive — the write path always sets it in practice)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ id: "bk_2", status: "PENDING", snapshotTotalAmount: null }, 201)));
    const result = await bookingAPI.create(VALID_INPUT);
    expect(result).toEqual({ kind: "created", booking: { id: "bk_2", status: "PENDING", snapshotTotalAmount: null } });
  });

  it("[error/validation] a 201 with an off-contract body (network I/O is an input boundary, code.md CAM-305) resolves kind:'error', never a crash", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: true }, 201)));
    const result = await bookingAPI.create(VALID_INPUT);
    expect(result).toEqual({ kind: "error" });
  });
});

describe("bookingAPI.create — the ADR-018 D1 contract table's explicit outcomes", () => {
  it("[error/validation] 401 -> kind:'unauthorized'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "Unauthorized" }, 401)));
    expect(await bookingAPI.create(VALID_INPUT)).toEqual({ kind: "unauthorized" });
  });

  it("[error/validation] 409 -> kind:'conflict'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "Dates not available" }, 409)));
    expect(await bookingAPI.create(VALID_INPUT)).toEqual({ kind: "conflict" });
  });

  it("[error/validation] 429 parses the RAW body + the Retry-After header (not the apiError shape)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "rate_limited" }, 429, { "Retry-After": "42" })));
    expect(await bookingAPI.create(VALID_INPUT)).toEqual({ kind: "rateLimited", retryAfterSec: 42 });
  });

  it("[boundary] 429 with a missing/non-numeric Retry-After header falls back to 60s, never NaN/0/negative", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "rate_limited" }, 429)));
    expect(await bookingAPI.create(VALID_INPUT)).toEqual({ kind: "rateLimited", retryAfterSec: 60 });
  });

  it("[error/validation] a generic 4xx/5xx (e.g. 400/404/500) -> kind:'error'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "Camp site not found" }, 404)));
    expect(await bookingAPI.create(VALID_INPUT)).toEqual({ kind: "error" });
  });

  it("[error/validation] a thrown network exception -> kind:'network'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );
    expect(await bookingAPI.create(VALID_INPUT)).toEqual({ kind: "network" });
  });
});

describe("bookingAPI.create — spotId only sent when present", () => {
  it("[normal] a per-pitch selection includes spotId in the POST body", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ id: "bk_3", status: "PENDING", snapshotTotalAmount: 500 }, 201));
    vi.stubGlobal("fetch", fetchMock);
    await bookingAPI.create({ ...VALID_INPUT, spotId: "spot-1" });
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.spotId).toBe("spot-1");
  });

  it("[null/empty] a whole-camp booking never sends a spotId key at all", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ id: "bk_4", status: "PENDING", snapshotTotalAmount: 500 }, 201));
    vi.stubGlobal("fetch", fetchMock);
    await bookingAPI.create(VALID_INPUT);
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).not.toHaveProperty("spotId");
  });
});

describe("ADR-018 D1/R2 — source:'CHAT' is a code constant, never read from `input`", () => {
  it("[normal] every request body carries source:'CHAT', regardless of input", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ id: "bk_5", status: "PENDING", snapshotTotalAmount: 500 }, 201));
    vi.stubGlobal("fetch", fetchMock);
    await bookingAPI.create(VALID_INPUT);
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.source).toBe("CHAT");
  });

  it("[unit] source-inspection: the literal 'CHAT' is hardcoded inside create()'s own body, never `input.source`", () => {
    const src = readFileSync(resolve(__dirname, "..", "lib/api-client.ts"), "utf-8");
    const start = src.indexOf("create: async (input: BookingCreateInput)");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("\n    },", start);
    const body = src.slice(start, end);
    expect(body).toMatch(/source:\s*'CHAT'/);
    expect(body).not.toContain("input.source");
    expect(body).not.toMatch(/source:\s*input\./);
  });

  it("[unit] BookingCreateInput carries no `source` field at all — a caller cannot even attempt to pass one", () => {
    const src = readFileSync(resolve(__dirname, "..", "lib/api-client.ts"), "utf-8");
    const start = src.indexOf("export interface BookingCreateInput");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("\n}", start);
    expect(src.slice(start, end)).not.toContain("source");
  });
});
