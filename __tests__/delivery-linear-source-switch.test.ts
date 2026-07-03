/**
 * CAM-278 (T-2) — lib/linear.ts's TICKETS_SOURCE rollback switch (ADR-010 seam #1).
 *
 * Confirms: TICKETS_SOURCE=db delegates to lib/delivery/status-adapter and never touches
 * the Linear API; any other value (unset or otherwise) is fully independent of the
 * delivery adapter and keeps hitting the original Linear path unmodified — a broken
 * delivery adapter can never break the default dashboard, and the rollback is a one-line
 * env flip with no redeploy.
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

describe("fetchStatusIssues — TICKETS_SOURCE rollback switch", () => {
  it("TICKETS_SOURCE=db delegates to the delivery adapter", async () => {
    process.env.TICKETS_SOURCE = "db";
    const issues = await fetchStatusIssues();
    expect(issues).toEqual([{ id: "CAM-1" }]);
    expect(dbFetch).toHaveBeenCalledTimes(1);
  });

  it("TICKETS_SOURCE unset uses the original Linear path, never the adapter", async () => {
    await expect(fetchStatusIssues()).rejects.toThrow("LINEAR_API_KEY is not set");
    expect(dbFetch).not.toHaveBeenCalled();
  });

  it("any TICKETS_SOURCE value other than 'db' also uses the Linear path", async () => {
    process.env.TICKETS_SOURCE = "linear";
    await expect(fetchStatusIssues()).rejects.toThrow("LINEAR_API_KEY is not set");
    expect(dbFetch).not.toHaveBeenCalled();
  });
});
