/**
 * CAM-602 — lib/delivery/tickets.ts's listTickets(): the returned TicketListResult carries a
 * real `appliedMode` (extra own property, same Object.assign-onto-array pattern CAM-595
 * established for .total/.truncated), and mode=gate/mode=audit still return exactly the sets
 * CAM-595 already proved correct (this story adds a proof signal, it does not change what is
 * fetched).
 *
 * Self-contained fake Prisma delivery client — deliberately NOT the shared
 * __tests__/helpers/delivery-fake-client.ts double (no count()/OR support), and deliberately
 * NOT __tests__/cam-595-tickets-truncation.test.ts's own local fake (out of this story's file
 * surface to extend) — a small local fixture, scoped to only what this file's assertions need.
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

const getClient = vi.mocked(getDeliveryClient);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

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

/** Mirrors just the where-shapes buildTicketWhere() (lib/delivery/tickets.ts) can produce for
 *  the cases this file exercises: archivedAt, OR, NOT, state, type. AND across top-level keys. */
function matchesWhere(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  const checks: boolean[] = [];
  if ("archivedAt" in where) {
    const cond = where.archivedAt;
    if (cond === null) checks.push(row.archivedAt === null);
    else if (cond && typeof cond === "object" && cond.not === null) checks.push(row.archivedAt !== null);
  }
  if (where.state !== undefined) checks.push(row.state === where.state);
  if (where.type !== undefined) checks.push(row.type === where.type);
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
        if (orderBy?.number === "desc") out = [...out].sort((a, b) => b.number - a.number);
        if (typeof take === "number") out = out.slice(0, take);
        return out;
      }),
      count: vi.fn(async ({ where }: Row = {}) => rows.filter((r) => matchesWhere(r, where)).length),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listTickets — CAM-602 appliedMode (service layer, real implementation)", () => {
  it("[normal] appliedMode='gate' and the set is exactly AWAITING_GATE-or-changesRequested (AC-1, AC-4)", async () => {
    const rows = [
      makeRow({ number: 1, state: "AWAITING_GATE" }),
      makeRow({ number: 2, state: "DONE" }),
      makeRow({ number: 3, state: "IN_PROGRESS", changesRequested: true }),
    ];
    getClient.mockReturnValue(makeFakeClient(rows) as unknown as ReturnType<typeof getDeliveryClient>);

    const result = await tickets.listTickets({ mode: "gate" });

    expect(result.appliedMode).toBe("gate");
    expect(result.map((t) => t.number as number).sort()).toEqual([1, 3]);
  });

  it("[normal] appliedMode='audit' and the set is exactly non-DONE-or-EPIC (AC-1, AC-4)", async () => {
    const rows = [
      makeRow({ number: 1, type: "STORY", state: "IN_PROGRESS" }),
      makeRow({ number: 2, type: "STORY", state: "DONE" }),
      makeRow({ number: 3, type: "EPIC", state: "DONE" }),
    ];
    getClient.mockReturnValue(makeFakeClient(rows) as unknown as ReturnType<typeof getDeliveryClient>);

    const result = await tickets.listTickets({ mode: "audit" });

    expect(result.appliedMode).toBe("audit");
    expect(result.map((t) => t.number as number).sort()).toEqual([1, 3]);
  });

  it("[boundary] appliedMode=null for a genuine general (no-mode) read", async () => {
    const rows = [makeRow({ number: 1, state: "DONE" }), makeRow({ number: 2, state: "BACKLOG" })];
    getClient.mockReturnValue(makeFakeClient(rows) as unknown as ReturnType<typeof getDeliveryClient>);

    const result = await tickets.listTickets({ archived: false });

    expect(result.appliedMode).toBe(null);
  });

  it("[null/empty] appliedMode=null for the default no-filter call too", async () => {
    getClient.mockReturnValue(makeFakeClient([]) as unknown as ReturnType<typeof getDeliveryClient>);

    const result = await tickets.listTickets();

    expect(result.appliedMode).toBe(null);
    expect(result.length).toBe(0);
  });
});
