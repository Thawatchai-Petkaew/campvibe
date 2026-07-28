/**
 * CAM-595 — "The gate board silently stops at ticket 561 and hides everything newer".
 *
 * Proves the fix at the service layer (lib/delivery/tickets.ts's listTickets):
 *   1. the general (no-`mode`) bounded read is now newest-first, so a hit cap drops the
 *      OLDEST rows, never the newest in-flight work — asserted by real ticket NUMBER, not by
 *      "no error"/"non-empty".
 *   2. the returned array carries a real `.total`/`.truncated` signal (own properties), so a
 *      truncated read can never be mistaken for a complete one.
 *   3. `mode: "gate"` and `mode: "audit"` are targeted server-side reads that surface a
 *      ticket the general bounded scan would have dropped — this is the exact shape of the
 *      original defect (a gate raised above the cap read as "no gates open").
 *
 * Self-contained fake Prisma delivery client (deliberately NOT the shared
 * __tests__/helpers/delivery-fake-client.ts double — that helper does not implement
 * `count()` or the `OR`/`NOT`/`type` where-clauses this story's new read modes need, and it
 * is out of this story's file surface to extend). Only the subset of the Prisma API
 * lib/delivery/tickets.ts's listTickets() actually calls is implemented.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/delivery/client", () => ({ getDeliveryClient: vi.fn() }));
vi.mock("@/lib/notify", () => ({ sendTelegram: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/github-dispatch", () => ({
  fireRepositoryDispatch: vi.fn(async () => ({ dispatched: true, status: 200 })),
}));

import * as tickets from "@/lib/delivery/tickets";
import { getDeliveryClient } from "@/lib/delivery/client";
import { listTicketsQuerySchema, TICKET_LIST_TAKE_CAP } from "@/lib/delivery/validations";

const getClient = vi.mocked(getDeliveryClient);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** Mirrors just the where-shapes buildTicketWhere() (lib/delivery/tickets.ts) can produce:
 *  archivedAt (null | {not:null}), state, type, epicId, changesRequested, OR, NOT. AND across
 *  all top-level keys, matching real Prisma semantics for a flat where object. */
function matchesWhere(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  const checks: boolean[] = [];
  if ("archivedAt" in where) {
    const cond = where.archivedAt;
    if (cond === null) checks.push(row.archivedAt === null);
    else if (cond && typeof cond === "object" && cond.not === null) checks.push(row.archivedAt !== null);
    // undefined -> no constraint
  }
  if (where.state !== undefined) checks.push(row.state === where.state);
  if (where.type !== undefined) checks.push(row.type === where.type);
  if (where.epicId !== undefined) checks.push(row.epicId === where.epicId);
  if (where.changesRequested !== undefined) checks.push(row.changesRequested === where.changesRequested);
  if (where.OR) checks.push((where.OR as Row[]).some((c) => matchesWhere(row, c)));
  if (where.NOT) checks.push(!matchesWhere(row, where.NOT as Row));
  return checks.every(Boolean);
}

function makeFakeClient(rows: Row[]) {
  return {
    ticket: {
      findMany: vi.fn(async ({ where, orderBy, take }: Row = {}) => {
        let out = rows.filter((r) => matchesWhere(r, where));
        if (orderBy?.number === "asc") out = [...out].sort((a, b) => a.number - b.number);
        if (orderBy?.number === "desc") out = [...out].sort((a, b) => b.number - a.number);
        if (typeof take === "number") out = out.slice(0, take);
        return out;
      }),
      count: vi.fn(async ({ where }: Row = {}) => rows.filter((r) => matchesWhere(r, where)).length),
    },
  };
}

function makeRow(overrides: Partial<Row> & { number: number }): Row {
  return {
    id: `t_${overrides.number}`,
    identifier: `CAM-${overrides.number}`,
    title: `Ticket ${overrides.number}`,
    type: "STORY",
    state: "DONE",
    archivedAt: null,
    changesRequested: false,
    epicId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── general (no-mode) read: direction + truncation signal ──────────────────────────────

describe("listTickets — general read is newest-first and self-reports truncation (CAM-595)", () => {
  it("[unit] surfaces the NEWEST tickets by number when the count exceeds the cap, not the oldest", async () => {
    const total = TICKET_LIST_TAKE_CAP + 200; // comfortably over the cap
    const rows = Array.from({ length: total }, (_, i) => makeRow({ number: i + 1 }));
    getClient.mockReturnValue(makeFakeClient(rows) as unknown as ReturnType<typeof getDeliveryClient>);

    const result = await tickets.listTickets({ archived: false });

    expect(result.length).toBe(TICKET_LIST_TAKE_CAP);
    const numbers = result.map((t) => t.number as number);
    // the highest-numbered (newest) ticket must be present...
    expect(Math.max(...numbers)).toBe(total);
    // ...and the oldest ones (the ones an ascending cap would have kept, this one drops) are gone.
    expect(numbers.includes(1)).toBe(false);
    expect(numbers.includes(50)).toBe(false);
    // the boundary is exactly total-cap+1 (newest-first slice)
    expect(Math.min(...numbers)).toBe(total - TICKET_LIST_TAKE_CAP + 1);
  });

  it("[unit] .total/.truncated are real (own properties), not a guess, when the cap is hit", async () => {
    const total = TICKET_LIST_TAKE_CAP + 200;
    const rows = Array.from({ length: total }, (_, i) => makeRow({ number: i + 1 }));
    getClient.mockReturnValue(makeFakeClient(rows) as unknown as ReturnType<typeof getDeliveryClient>);

    const result = await tickets.listTickets({ archived: false });

    expect(result.truncated).toBe(true);
    expect(result.total).toBe(total);
  });

  it("[unit] .truncated is false and .total matches length when the count is under the cap", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => makeRow({ number: i + 1 }));
    getClient.mockReturnValue(makeFakeClient(rows) as unknown as ReturnType<typeof getDeliveryClient>);

    const result = await tickets.listTickets({ archived: false });

    expect(result.length).toBe(5);
    expect(result.truncated).toBe(false);
    expect(result.total).toBe(5);
  });

  it("[resilience] falls back to a conservative heuristic (not a crash) when count() is unavailable", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => makeRow({ number: i + 1 }));
    const fake = makeFakeClient(rows);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (fake.ticket as any).count; // simulate a Prisma client/test-double without count()
    getClient.mockReturnValue(fake as unknown as ReturnType<typeof getDeliveryClient>);

    const result = await tickets.listTickets({ archived: false });

    expect(result.length).toBe(3);
    expect(result.truncated).toBe(false); // 3 rows, nowhere near the cap -> conservative "not truncated"
    expect(result.total).toBe(3); // falls back to length when the real total is unknown
  });

  it("[resilience] a thrown count() does not break the primary read — logs, never crashes", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => makeRow({ number: i + 1 }));
    const fake = makeFakeClient(rows);
    fake.ticket.count.mockRejectedValueOnce(new Error("db blip"));
    getClient.mockReturnValue(fake as unknown as ReturnType<typeof getDeliveryClient>);
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await tickets.listTickets({ archived: false });

    expect(result.length).toBe(3);
    expect(result.truncated).toBe(false);
    consoleErr.mockRestore();
  });
});

// ── mode=gate: the surface that must never truncate ─────────────────────────────────────

describe("listTickets({ mode: 'gate' }) — targeted read, independent of the general cap (CAM-595)", () => {
  it("[unit] surfaces an AWAITING_GATE ticket the general bounded scan would have dropped", async () => {
    const total = TICKET_LIST_TAKE_CAP + 200;
    const rows = Array.from({ length: total }, (_, i) => makeRow({ number: i + 1 }));
    // Mirrors the real CAM-594 shape: a low/old-numbered ticket sitting in the region the
    // general newest-first cap now drops (numbers 1..200 are outside the kept window).
    const AT_RISK_NUMBER = 50;
    rows[AT_RISK_NUMBER - 1] = makeRow({ number: AT_RISK_NUMBER, state: "AWAITING_GATE" });
    getClient.mockReturnValue(makeFakeClient(rows) as unknown as ReturnType<typeof getDeliveryClient>);

    // Prove the general read really does drop it (the residual risk this story is honest about).
    const general = await tickets.listTickets({ archived: false });
    expect(general.some((t) => t.number === AT_RISK_NUMBER)).toBe(false);

    // The targeted gate read must surface it regardless.
    const gate = await tickets.listTickets({ mode: "gate" });
    expect(gate.some((t) => (t as { number: number }).number === AT_RISK_NUMBER)).toBe(true);
    expect(gate.every((t) => (t as { state: string }).state === "AWAITING_GATE")).toBe(true);
  });

  it("[unit] also surfaces a changesRequested=true ticket regardless of its own state", async () => {
    const rows = [
      makeRow({ number: 1, state: "IN_PROGRESS", changesRequested: true }),
      makeRow({ number: 2, state: "DONE", changesRequested: false }),
    ];
    getClient.mockReturnValue(makeFakeClient(rows) as unknown as ReturnType<typeof getDeliveryClient>);

    const gate = await tickets.listTickets({ mode: "gate" });
    expect(gate.map((t) => t.number)).toEqual([1]);
  });

  it("[null/empty] returns an empty (not-truncated) result when nothing is awaiting a gate", async () => {
    const rows = [makeRow({ number: 1, state: "DONE" })];
    getClient.mockReturnValue(makeFakeClient(rows) as unknown as ReturnType<typeof getDeliveryClient>);

    const gate = await tickets.listTickets({ mode: "gate" });
    expect(gate.length).toBe(0);
    expect(gate.truncated).toBe(false);
  });
});

// ── mode=audit: never skips non-Done work, and epics resolve regardless of their state ──

describe("listTickets({ mode: 'audit' }) — targeted read (CAM-595)", () => {
  it("[unit] includes every non-DONE ticket and excludes DONE non-epic tickets", async () => {
    const rows = [
      makeRow({ number: 1, type: "STORY", state: "IN_PROGRESS" }),
      makeRow({ number: 2, type: "STORY", state: "DONE" }),
      makeRow({ number: 3, type: "TASK", state: "BACKLOG" }),
    ];
    getClient.mockReturnValue(makeFakeClient(rows) as unknown as ReturnType<typeof getDeliveryClient>);

    const audit = await tickets.listTickets({ mode: "audit" });
    expect(audit.map((t) => t.number).sort()).toEqual([1, 3]);
  });

  it("[boundary] includes an EPIC even when it is long DONE (buildEpicIndex needs it resolvable)", async () => {
    const rows = [
      makeRow({ number: 1, type: "EPIC", state: "DONE" }),
      makeRow({ number: 2, type: "STORY", state: "DONE", epicId: "t_1" }),
    ];
    getClient.mockReturnValue(makeFakeClient(rows) as unknown as ReturnType<typeof getDeliveryClient>);

    const audit = await tickets.listTickets({ mode: "audit" });
    // the DONE epic (#1) is present; the DONE story (#2) is correctly excluded
    expect(audit.map((t) => t.number)).toEqual([1]);
  });
});

// ── validations.ts — mode/state mutual exclusivity at the zod boundary ──────────────────

describe("listTicketsQuerySchema — mode is mutually exclusive with state/epicId (CAM-595)", () => {
  it("[unit] accepts mode alone", () => {
    expect(listTicketsQuerySchema.safeParse({ mode: "gate", archived: "false" }).success).toBe(true);
    expect(listTicketsQuerySchema.safeParse({ mode: "audit" }).success).toBe(true);
  });

  it("[error/validation] rejects mode combined with state", () => {
    expect(listTicketsQuerySchema.safeParse({ mode: "gate", state: "DONE" }).success).toBe(false);
  });

  it("[error/validation] rejects mode combined with epicId", () => {
    expect(listTicketsQuerySchema.safeParse({ mode: "audit", epicId: "e1" }).success).toBe(false);
  });

  it("[error/validation] rejects an unknown mode value", () => {
    expect(listTicketsQuerySchema.safeParse({ mode: "not_a_mode" }).success).toBe(false);
  });

  it("[unit] state/epicId alone (no mode) still works as before", () => {
    expect(listTicketsQuerySchema.safeParse({ state: "DONE", epicId: "e1" }).success).toBe(true);
  });
});
