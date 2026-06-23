import { describe, it, expect } from "vitest";
import { envOf, epicBucket } from "@/lib/status-derive";
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
