/**
 * CAM-278 (T-2) / CAM-281 (T-5b) / chore/retire-linear-sync — lib/linear.ts's dashboard
 * list-read seam.
 *
 * History: this file used to exercise the `TICKETS_SOURCE` rollback switch (`"linear"` read
 * the original Linear GraphQL API path; anything else delegated to the delivery ticket DB).
 * One cycle after the CAM-281 T-5b cutover, `chore/retire-linear-sync` retired that switch
 * entirely — `fetchStatusIssues()` now calls `lib/delivery/status-adapter.ts`'s
 * `fetchTicketsFromDb()` unconditionally, and the Linear GraphQL fetch code it used to guard
 * was deleted (dead code with the switch gone). This file now guards: (1) the unconditional
 * delegation actually happens, regardless of any leftover `TICKETS_SOURCE`/`LINEAR_API_KEY`
 * env value a stale `.env` might still carry, and (2) the retired branch/fetch code never
 * silently creeps back into the source.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

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

describe("fetchStatusIssues — unconditional delegation to the delivery ticket DB (TICKETS_SOURCE retired)", () => {
  it("no env set delegates to the delivery adapter", async () => {
    const issues = await fetchStatusIssues();
    expect(issues).toEqual([{ id: "CAM-1" }]);
    expect(dbFetch).toHaveBeenCalledTimes(1);
  });

  it("a leftover TICKETS_SOURCE=db value still delegates to the delivery adapter (no-op env)", async () => {
    process.env.TICKETS_SOURCE = "db";
    const issues = await fetchStatusIssues();
    expect(issues).toEqual([{ id: "CAM-1" }]);
    expect(dbFetch).toHaveBeenCalledTimes(1);
  });

  it("a leftover TICKETS_SOURCE=linear value NO LONGER reads Linear — still delegates to the delivery adapter", async () => {
    process.env.TICKETS_SOURCE = "linear";
    const issues = await fetchStatusIssues();
    expect(issues).toEqual([{ id: "CAM-1" }]);
    expect(dbFetch).toHaveBeenCalledTimes(1);
  });

  it("passing a pulse argument (legacy call-site compatibility) still delegates unconditionally", async () => {
    const issues = await fetchStatusIssues(42);
    expect(issues).toEqual([{ id: "CAM-1" }]);
    expect(dbFetch).toHaveBeenCalledTimes(1);
  });
});

describe("lib/linear.ts source — the retired TICKETS_SOURCE switch never creeps back", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "..", "lib", "linear.ts"), "utf8");

  it("contains no runtime TICKETS_SOURCE conditional (a header comment documenting the retired lever's history is fine)", () => {
    expect(src).not.toContain("process.env.TICKETS_SOURCE");
  });

  it("contains no raw Linear GraphQL fetch (the dead code the switch used to guard)", () => {
    expect(src).not.toContain("api.linear.app/graphql");
    expect(src).not.toContain("LINEAR_API_KEY");
  });
});
