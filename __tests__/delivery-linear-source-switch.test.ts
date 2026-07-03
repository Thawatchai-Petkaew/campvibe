/**
 * CAM-278 (T-2) / CAM-281 (T-5b) — lib/linear.ts's TICKETS_SOURCE rollback switch (ADR-010
 * seam #1).
 *
 * CAM-281 (T-5b) flipped the default: the delivery database is now the live source for the
 * dashboard list read. Confirms: TICKETS_SOURCE=linear (or unset — this test file predates
 * that value existing, so exercise it explicitly) reads the original Linear API path — the
 * documented one-cycle rollback lever, removed next cycle; any other value (unset included)
 * delegates to lib/delivery/status-adapter and never touches the Linear API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/delivery/status-adapter", () => ({
  fetchTicketsFromDb: vi.fn(async () => [{ id: "CAM-1" }]),
}));

import { fetchStatusIssues } from "@/lib/linear";
import { fetchTicketsFromDb } from "@/lib/delivery/status-adapter";

const dbFetch = vi.mocked(fetchTicketsFromDb);

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.TICKETS_SOURCE;
  delete process.env.LINEAR_API_KEY;
});

describe("fetchStatusIssues — TICKETS_SOURCE rollback switch (CAM-281 T-5b default = db)", () => {
  it("TICKETS_SOURCE unset delegates to the delivery adapter (new default)", async () => {
    const issues = await fetchStatusIssues();
    expect(issues).toEqual([{ id: "CAM-1" }]);
    expect(dbFetch).toHaveBeenCalledTimes(1);
  });

  it("TICKETS_SOURCE=db delegates to the delivery adapter", async () => {
    process.env.TICKETS_SOURCE = "db";
    const issues = await fetchStatusIssues();
    expect(issues).toEqual([{ id: "CAM-1" }]);
    expect(dbFetch).toHaveBeenCalledTimes(1);
  });

  it("TICKETS_SOURCE=linear uses the original Linear path (the one-cycle rollback lever), never the adapter", async () => {
    process.env.TICKETS_SOURCE = "linear";
    await expect(fetchStatusIssues()).rejects.toThrow("LINEAR_API_KEY is not set");
    expect(dbFetch).not.toHaveBeenCalled();
  });

  it("any other TICKETS_SOURCE value also falls back to the delivery adapter (default-safe)", async () => {
    process.env.TICKETS_SOURCE = "bogus";
    const issues = await fetchStatusIssues();
    expect(issues).toEqual([{ id: "CAM-1" }]);
    expect(dbFetch).toHaveBeenCalledTimes(1);
  });
});
