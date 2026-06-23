import { describe, it, expect } from "vitest";
import { envOf, epicBucket, stageRank, regressionRound } from "@/lib/status-derive";
import type { StatusIssue } from "@/lib/linear";

function issue(p: Partial<StatusIssue>): StatusIssue {
  return {
    id: "CAM-1",
    title: "story",
    status: "In Progress",
    statusType: "started",
    priority: "No priority",
    labels: [],
    url: "",
    description: "",
    startedAt: null,
    updatedAt: "",
    completedAt: null,
    assignee: null,
    project: null,
    parent: null,
    ...p,
  };
}

describe("envOf — derive env from state + released label", () => {
  it("[AC2] in-progress / backlog (not done) → dev", () => {
    expect(envOf(issue({ status: "In Progress", statusType: "started" }))).toBe("dev");
    expect(envOf(issue({ status: "Backlog", statusType: "backlog" }))).toBe("dev");
  });

  it("[AC3] Done without released → staging (release train)", () => {
    expect(envOf(issue({ status: "Done", statusType: "completed" }))).toBe("staging");
  });

  it("[AC4] Done + released → prod", () => {
    expect(envOf(issue({ status: "Done", statusType: "completed", labels: ["released"] }))).toBe("prod");
  });

  it("released label takes precedence over state", () => {
    expect(envOf(issue({ status: "In Progress", statusType: "started", labels: ["released"] }))).toBe("prod");
  });

  it("ignores unrelated labels for non-released, non-done work", () => {
    expect(envOf(issue({ status: "In Progress", statusType: "started", labels: ["platform", "awaiting-you"] }))).toBe("dev");
  });
});

describe("epicBucket — epic lifecycle by progress (not snapshot status)", () => {
  const done = () => issue({ status: "Done", statusType: "completed" });
  const backlog = () => issue({ status: "Backlog", statusType: "backlog" });

  it("no stories → todo", () => {
    expect(epicBucket([])).toBe("todo");
  });

  it("every story done → done", () => {
    expect(epicBucket([done(), done()])).toBe("done");
  });

  it("partially done (some completed, some backlog) → prog, NOT todo", () => {
    // the reported bug: a half-finished epic with no story currently In Progress
    expect(epicBucket([done(), backlog()])).toBe("prog");
  });

  it("a started story with nothing done → prog", () => {
    expect(epicBucket([issue({ status: "In Progress", statusType: "started" }), backlog()])).toBe("prog");
  });

  it("all backlog / unstarted → todo", () => {
    expect(epicBucket([backlog(), issue({ status: "Todo", statusType: "unstarted" })])).toBe("todo");
  });
});

// ── CAM-145: stageRank ──────────────────────────────────────────────────────────────────────────

describe("stageRank — numeric pipeline rank per role", () => {
  it("Design roles rank lower than Build roles", () => {
    expect(stageRank("architect")).toBeLessThan(stageRank("frontend-engineer"));
    expect(stageRank("ux-designer")).toBeLessThan(stageRank("backend-engineer"));
  });

  it("Build roles rank lower than Verify roles", () => {
    expect(stageRank("frontend-engineer")).toBeLessThan(stageRank("qa-engineer"));
    expect(stageRank("backend-engineer")).toBeLessThan(stageRank("security-reviewer"));
  });

  it("Verify roles rank lower than Ship roles", () => {
    expect(stageRank("qa-engineer")).toBeLessThan(stageRank("devops-release"));
    expect(stageRank("security-reviewer")).toBeLessThan(stageRank("devops-release"));
  });

  it("Gate role (human) sits between Design and Build", () => {
    expect(stageRank("human")).toBeGreaterThan(stageRank("architect"));
    expect(stageRank("human")).toBeLessThan(stageRank("frontend-engineer"));
  });

  it("unknown role returns 0 (Design rank)", () => {
    expect(stageRank("mystery-role")).toBe(0);
    expect(stageRank("")).toBe(0);
  });

  it("product-owner is NOT in ROLE_STAGE → returns 0", () => {
    expect(stageRank("product-owner")).toBe(0);
  });
});

// ── CAM-145: regressionRound ────────────────────────────────────────────────────────────────────

describe("regressionRound — sum of regression round numbers from labels", () => {
  it("returns 0 for an empty label array", () => {
    expect(regressionRound([])).toBe(0);
  });

  it("returns 0 when no regression labels are present", () => {
    expect(regressionRound(["role:qa-engineer", "platform", "released"])).toBe(0);
  });

  it("reads the round from a single regression label", () => {
    expect(regressionRound(["regression:frontend-engineer:1"])).toBe(1);
  });

  it("reads a higher round number", () => {
    expect(regressionRound(["regression:frontend-engineer:3"])).toBe(3);
  });

  it("sums rounds across multiple regression labels for different roles", () => {
    expect(regressionRound(["regression:frontend-engineer:2", "regression:qa-engineer:1"])).toBe(3);
  });

  it("ignores malformed labels that partially match the pattern", () => {
    expect(regressionRound(["regression:", "regression:frontend-engineer:", "regression::1"])).toBe(0);
  });

  it("ignores unrelated labels mixed in", () => {
    expect(regressionRound(["role:qa-engineer", "regression:backend-engineer:2", "awaiting-you"])).toBe(2);
  });
});
