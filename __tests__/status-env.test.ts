import { describe, it, expect } from "vitest";
import { envOf } from "@/lib/status-derive";
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
