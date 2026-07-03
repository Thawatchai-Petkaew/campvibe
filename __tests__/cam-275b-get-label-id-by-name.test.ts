/**
 * CAM-275 part 2 — lib/linear-actions.ts: getLabelIdByName()
 *
 * Newly-extracted helper (shared by addLabel() and the linear-webhook route's
 * awaiting-you-removal detection). Minimal unit coverage: resolves the id for a
 * case-insensitive name match, returns null when the team has no such label, and
 * propagates the "no API key" error so the caller (linear-webhook route) can catch
 * it and degrade gracefully instead of crashing.
 *
 * Mocking strategy: stub `server-only` (Next.js server-only guard, same pattern as
 * the rest of the suite) and mock the global `fetch` used by the module's internal
 * gql() helper — no real Linear API call is made.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { getLabelIdByName } from "@/lib/linear-actions";

function teamLabelsResponse(labels: { id: string; name: string }[]) {
  return {
    json: async () => ({ data: { teams: { nodes: [{ labels: { nodes: labels } }] } } }),
  } as Response;
}

describe("lib/linear-actions.ts — getLabelIdByName (CAM-275b)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.LINEAR_API_KEY = "test-key";
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.LINEAR_API_KEY;
    vi.restoreAllMocks();
  });

  it("[unit] resolves the label id for a case-insensitive name match", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      teamLabelsResponse([{ id: "aw-1", name: "awaiting-you" }])
    );
    const id = await getLabelIdByName("Awaiting-You");
    expect(id).toBe("aw-1");
  });

  it("[unit/null] returns null when the team has no label with that name", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      teamLabelsResponse([{ id: "x", name: "blocked" }])
    );
    const id = await getLabelIdByName("awaiting-you");
    expect(id).toBeNull();
  });

  it("[unit/empty] returns null when the team has no labels at all", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(teamLabelsResponse([]));
    const id = await getLabelIdByName("awaiting-you");
    expect(id).toBeNull();
  });

  it("[unit/error] propagates a clear error when LINEAR_API_KEY is not set (caller must catch)", async () => {
    delete process.env.LINEAR_API_KEY;
    await expect(getLabelIdByName("awaiting-you")).rejects.toThrow("LINEAR_API_KEY not set");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
