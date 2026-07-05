/**
 * CAM-278 (T-2) — lib/delivery/status-adapter.ts contract tests.
 *
 * Two layers:
 *  1. toStatusIssue() unit tests — every label/title/status/statusType synthesis case,
 *     asserted directly against a constructed Ticket-shaped fixture (no DB needed).
 *  2. fetchTicketsFromDb() integration — excludes archived, bounded read, keyed on the
 *     delivery pulse (readDeliveryPulse mocked; next/cache's unstable_cache is a global
 *     pass-through per __tests__/setup-next-cache.ts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/delivery/client", () => ({ getDeliveryClient: vi.fn() }));
vi.mock("@/lib/delivery/pulse", () => ({ readDeliveryPulse: vi.fn(async () => 0) }));

import { toStatusIssue, fetchTicketsFromDb } from "@/lib/delivery/status-adapter";
import { getDeliveryClient } from "@/lib/delivery/client";
import { readDeliveryPulse } from "@/lib/delivery/pulse";
import { regressionRound as parseRegressionRound, rolesOf, canonRole } from "@/lib/status-derive";
import { createFakeDeliveryClient, makeTicketRow } from "./helpers/delivery-fake-client";

const getClient = vi.mocked(getDeliveryClient);
const pulse = vi.mocked(readDeliveryPulse);

function ticketFixture(overrides: Record<string, unknown> = {}) {
  return {
    ...makeTicketRow({
      number: 1,
      identifier: "CAM-1",
      title: "Ship the thing",
      type: "STORY",
      ...overrides,
    }),
    epic: null,
    ...overrides,
  } as Parameters<typeof toStatusIssue>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── toStatusIssue — title / status / statusType ─────────────────────────────────────────

describe("toStatusIssue — status/statusType per TicketState (ADR-010 coverage table)", () => {
  it.each([
    ["BACKLOG", "Backlog", "backlog"],
    ["TODO", "Todo", "unstarted"],
    ["IN_PROGRESS", "In Progress", "started"],
    ["AWAITING_GATE", "In Progress", "started"],
    ["DONE", "Done", "completed"],
    ["CANCELED", "Canceled", "canceled"],
  ] as const)("%s -> status=%s statusType=%s", (state, status, statusType) => {
    const issue = toStatusIssue(ticketFixture({ state }));
    expect(issue.status).toBe(status);
    expect(issue.statusType).toBe(statusType);
  });
});

describe("toStatusIssue — title synthesis ([role] tag for roleOf() parity)", () => {
  it("no currentRole -> title is unchanged", () => {
    const issue = toStatusIssue(ticketFixture({ title: "Plain title", currentRole: null }));
    expect(issue.title).toBe("Plain title");
  });

  it("currentRole set -> title gets a [slug] prefix matching lib/status-derive's roleOf/canonRole", () => {
    const issue = toStatusIssue(ticketFixture({ title: "Ship it", currentRole: "BACKEND_ENGINEER" }));
    expect(issue.title).toBe("[backend-engineer] Ship it");
    // Prove parity with the actual consumer (lib/status-derive.ts) rather than re-describing the regex.
    expect(canonRole("backend-engineer")).toBe("backend-engineer");
  });

  it.each([
    ["PRODUCT_OWNER", "product-owner"],
    ["ANALYST", "analyst"],
    ["ARCHITECT", "architect"],
    ["UX_DESIGNER", "ux-designer"],
    ["FRONTEND_ENGINEER", "frontend-engineer"],
    ["BACKEND_ENGINEER", "backend-engineer"],
    ["QA_ENGINEER", "qa-engineer"],
    ["SECURITY_REVIEWER", "security-reviewer"],
    ["DEVOPS_RELEASE", "devops-release"],
  ] as const)("DeliveryRole %s slugifies to the canonical %s known by status-derive", (role, slug) => {
    const issue = toStatusIssue(ticketFixture({ title: "X", currentRole: role }));
    expect(issue.title).toBe(`[${slug}] X`);
    expect(canonRole(slug)).toBe(slug); // status-derive.ts recognizes it — not dropped as unknown
  });
});

// ── labels ───────────────────────────────────────────────────────────────────────────────

describe("toStatusIssue — labels synthesis", () => {
  it("AWAITING_GATE adds 'awaiting-you'", () => {
    const issue = toStatusIssue(ticketFixture({ state: "AWAITING_GATE" }));
    expect(issue.labels).toContain("awaiting-you");
  });

  it("non-AWAITING_GATE states do not add 'awaiting-you'", () => {
    const issue = toStatusIssue(ticketFixture({ state: "IN_PROGRESS" }));
    expect(issue.labels).not.toContain("awaiting-you");
  });

  it("changesRequested adds 'changes-requested'", () => {
    const issue = toStatusIssue(ticketFixture({ changesRequested: true }));
    expect(issue.labels).toContain("changes-requested");
  });

  it("releasedAt set adds 'released'", () => {
    const issue = toStatusIssue(ticketFixture({ releasedAt: new Date() }));
    expect(issue.labels).toContain("released");
  });

  it("releasedAt null does not add 'released'", () => {
    const issue = toStatusIssue(ticketFixture({ releasedAt: null }));
    expect(issue.labels).not.toContain("released");
  });

  it("stagedAt set adds 'on-staging' (CAM-370)", () => {
    const issue = toStatusIssue(ticketFixture({ stagedAt: new Date() }));
    expect(issue.labels).toContain("on-staging");
  });

  it("stagedAt null does not add 'on-staging'", () => {
    const issue = toStatusIssue(ticketFixture({ stagedAt: null }));
    expect(issue.labels).not.toContain("on-staging");
  });

  it("blocked=true adds 'blocked'", () => {
    const issue = toStatusIssue(ticketFixture({ blocked: true }));
    expect(issue.labels).toContain("blocked");
  });

  it("persona adds the lower-cased persona label", () => {
    const issue = toStatusIssue(ticketFixture({ persona: "CAMPER" }));
    expect(issue.labels).toContain("camper");
  });

  it("roleHistory entries become 'role:<slug>' labels, one per entry", () => {
    const issue = toStatusIssue(
      ticketFixture({ roleHistory: ["FRONTEND_ENGINEER", "BACKEND_ENGINEER"], currentRole: "BACKEND_ENGINEER" })
    );
    expect(issue.labels).toContain("role:frontend-engineer");
    expect(issue.labels).toContain("role:backend-engineer");
  });

  it("regressionRound > 0 adds 'regression:<currentRole-slug>:<n>' parseable by status-derive.regressionRound", () => {
    const issue = toStatusIssue(ticketFixture({ currentRole: "QA_ENGINEER", regressionRound: 3 }));
    expect(issue.labels).toContain("regression:qa-engineer:3");
    expect(parseRegressionRound(issue.labels)).toBe(3);
  });

  it("regressionRound = 0 adds no regression label", () => {
    const issue = toStatusIssue(ticketFixture({ currentRole: "QA_ENGINEER", regressionRound: 0 }));
    expect(issue.labels.some((l) => l.startsWith("regression:"))).toBe(false);
  });

  it("regressionRound > 0 but no currentRole adds no regression label (no role to slug)", () => {
    const issue = toStatusIssue(ticketFixture({ currentRole: null, regressionRound: 2 }));
    expect(issue.labels.some((l) => l.startsWith("regression:"))).toBe(false);
  });

  it("legacyLabels are appended verbatim", () => {
    const issue = toStatusIssue(ticketFixture({ legacyLabels: ["imported", "p0"] }));
    expect(issue.labels).toEqual(expect.arrayContaining(["imported", "p0"]));
  });

  it("rolesOf() (status-derive) recovers the full role history via the role: labels", () => {
    const issue = toStatusIssue(
      ticketFixture({ roleHistory: ["ARCHITECT", "BACKEND_ENGINEER"], currentRole: "BACKEND_ENGINEER" })
    );
    expect(rolesOf(issue).sort()).toEqual(["architect", "backend-engineer"]);
  });
});

// ── remaining fields ─────────────────────────────────────────────────────────────────────

describe("toStatusIssue — remaining StatusIssue fields", () => {
  it("url falls back to '' when legacyUrl is absent", () => {
    const issue = toStatusIssue(ticketFixture({ legacyUrl: null }));
    expect(issue.url).toBe("");
  });

  it("url uses legacyUrl when present", () => {
    const issue = toStatusIssue(ticketFixture({ legacyUrl: "https://linear.app/campvibe/issue/CAM-1" }));
    expect(issue.url).toBe("https://linear.app/campvibe/issue/CAM-1");
  });

  it("assignee is null when assigneeName is unset, else {name,displayName,avatarUrl:null}", () => {
    expect(toStatusIssue(ticketFixture({ assigneeName: null })).assignee).toBeNull();
    const issue = toStatusIssue(ticketFixture({ assigneeName: "Owner" }));
    expect(issue.assignee).toEqual({ name: "Owner", displayName: "Owner", avatarUrl: null });
  });

  it("project is null when featureName is unset, else {id,name}=featureName", () => {
    expect(toStatusIssue(ticketFixture({ featureName: null })).project).toBeNull();
    const issue = toStatusIssue(ticketFixture({ featureName: "Delivery Tickets" }));
    expect(issue.project).toEqual({ id: "Delivery Tickets", name: "Delivery Tickets" });
  });

  it("parent is null with no epic, else {id,title} from the joined epic", () => {
    expect(toStatusIssue(ticketFixture({ epic: null })).parent).toBeNull();
    const issue = toStatusIssue(ticketFixture({ epic: { id: "epic-1", title: "Delivery Tickets Epic" } }));
    expect(issue.parent).toEqual({ id: "epic-1", title: "Delivery Tickets Epic" });
  });

  it("priority maps the 0..4 ordinal to the legacy name array", () => {
    expect(toStatusIssue(ticketFixture({ priority: 0 })).priority).toBe("No priority");
    expect(toStatusIssue(ticketFixture({ priority: 1 })).priority).toBe("Urgent");
    expect(toStatusIssue(ticketFixture({ priority: 4 })).priority).toBe("Low");
  });

  it("startedAt/completedAt are ISO strings or null", () => {
    const started = new Date("2026-01-01T00:00:00.000Z");
    const issue = toStatusIssue(ticketFixture({ startedAt: started, completedAt: null }));
    expect(issue.startedAt).toBe(started.toISOString());
    expect(issue.completedAt).toBeNull();
  });

  it("description falls back to '' when null", () => {
    expect(toStatusIssue(ticketFixture({ description: null })).description).toBe("");
  });

  // CAM-342: model-tier trial instrumentation — plain pass-through, no display shaping here.
  it("agentModel passes through the stamped tier verbatim", () => {
    const issue = toStatusIssue(ticketFixture({ agentModel: "sonnet" }));
    expect(issue.agentModel).toBe("sonnet");
  });

  it("agentModel passes through null when never stamped (legacy/default ticket)", () => {
    const issue = toStatusIssue(ticketFixture({ agentModel: null }));
    expect(issue.agentModel).toBeNull();
  });
});

// ── fetchTicketsFromDb — integration with the fake client ──────────────────────────────

describe("fetchTicketsFromDb", () => {
  it("excludes archived tickets and returns synthesized StatusIssue rows", async () => {
    const fake = createFakeDeliveryClient();
    getClient.mockReturnValue(fake.client);
    pulse.mockResolvedValue(0);

    const active = makeTicketRow({ number: 1, identifier: "CAM-1", title: "Active", type: "STORY" });
    const archived = makeTicketRow({
      number: 2,
      identifier: "CAM-2",
      title: "Archived",
      type: "STORY",
      archivedAt: new Date(),
    });
    fake.store.tickets.set(active.id, active);
    fake.store.tickets.set(archived.id, archived);

    const issues = await fetchTicketsFromDb();
    expect(issues.map((i) => i.id)).toEqual(["CAM-1"]);
  });

  it("reads the delivery pulse to key the 60s cache", async () => {
    const fake = createFakeDeliveryClient();
    getClient.mockReturnValue(fake.client);
    pulse.mockResolvedValue(7);

    await fetchTicketsFromDb();
    expect(pulse).toHaveBeenCalledTimes(1);
  });
});
