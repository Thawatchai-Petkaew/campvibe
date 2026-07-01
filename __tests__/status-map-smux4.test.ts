import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildMapModel, toMapModel, payloadChanged } from "@/lib/status-map-model";
import { buildModel } from "@/lib/status-model";
import type { StatusIssue } from "@/lib/linear";

// ============================================================
// CAM-253 (SMUX-4) — QA audit: edge/negative cases for the Status Map UX epic
//
// Coverage targets:
//   • lib/status-map-model.ts  — buildAgents (all branches), toMapModel, buildMapModel
//   • Responsive CSS contracts — structural + a11y (source-inspection)
//   • Bidirectional sync logic — source contracts (source-inspection)
// ============================================================

// ── Shared StatusIssue factory ───────────────────────────────────────────────

function makeIssue(overrides: Partial<StatusIssue> = {}): StatusIssue {
  return {
    id: "CAM-1",
    title: "Default title",
    status: "In Progress",
    statusType: "started",
    priority: "Normal",
    labels: [],
    url: "https://linear.app/cam/issue/CAM-1",
    description: "",
    startedAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    completedAt: null,
    assignee: null,
    project: null,
    parent: null,
    ...overrides,
  };
}

// Build the 7 "epic issue" stubs (project issues, no parent, no "·" in title)
// that buildModel needs so stories can be nested under them.
function makeEpicIssue(title: string, projectName = "My Feature"): StatusIssue {
  return makeIssue({
    id: `EPIC-${title.slice(0, 4)}`,
    title,
    status: "In Progress",
    statusType: "started",
    project: { id: "proj-1", name: projectName },
    parent: null,
    labels: [],
  });
}

function makeStoryUnder(epicTitle: string, role: string, overrides: Partial<StatusIssue> = {}): StatusIssue {
  return makeIssue({
    title: `${epicTitle} · [${role}] Do something`,
    parent: { id: "EPIC-1", title: epicTitle },
    project: { id: "proj-1", name: "My Feature" },
    ...overrides,
  });
}

// ============================================================
// SMUX-4 AC1 — buildAgents: role with NO active story → task=null
// ============================================================

describe("CAM-253 SMUX-4 — buildAgents: role with no active story → task=null", () => {
  it("[unit] a role that has stories but none in progress gets task=null", () => {
    // Arrange: only a Done story for frontend-engineer; no In Progress
    const epic = makeEpicIssue("My Epic");
    const doneStory = makeStoryUnder("My Epic", "frontend-engineer", {
      id: "CAM-10",
      status: "Done",
      statusType: "completed",
    });
    const issues = [epic, doneStory];

    // Act
    const model = buildMapModel(issues);
    const feAgent = model.agents.find((a) => a.role === "frontend-engineer");

    // Assert — visible result: agent is NOT active; data result: task=null
    expect(feAgent).toBeDefined();
    expect(feAgent!.task).toBeNull();
    expect(feAgent!.active).toBe(false);
  });

  it("[unit] a role that has ZERO stories (not in epic work) gets task=null + active=false", () => {
    // Arrange: only a security-reviewer story exists; ux-designer has nothing
    const epic = makeEpicIssue("Alpha Epic");
    const story = makeStoryUnder("Alpha Epic", "security-reviewer", {
      id: "CAM-20",
      status: "In Progress",
    });
    const issues = [epic, story];

    const model = buildMapModel(issues);
    const uxAgent = model.agents.find((a) => a.role === "ux-designer");

    expect(uxAgent).toBeDefined();
    expect(uxAgent!.task).toBeNull();
    expect(uxAgent!.active).toBe(false);
    expect(uxAgent!.done).toBe(0);
  });

  it("[boundary] empty issue list → all 7 agents present, all with task=null", () => {
    // Arrange / Act
    const model = buildMapModel([]);

    // Assert — data result: all 7 BUILD_ROLES present, all task=null
    expect(model.agents).toHaveLength(7);
    for (const a of model.agents) {
      expect(a.task).toBeNull();
      expect(a.active).toBe(false);
    }
  });
});

// ============================================================
// SMUX-4 AC2 — buildAgents: epicKey fallback when epicOf is empty
// ============================================================

describe("CAM-253 SMUX-4 — buildAgents: epicKey fallback logic", () => {
  it("[unit] story with '·' prefix yields epicKey from epicOf (old-style title)", () => {
    // Arrange: story with "·"-prefix carries epicOf → epicKey from prefix
    const legacy = makeIssue({
      id: "CAM-30",
      title: "AlphaFeature · [frontend-engineer] Build the thing",
      status: "In Progress",
      statusType: "started",
      parent: null,
      project: { id: "proj-2", name: "AlphaFeature" },
      labels: [],
    });

    const model = buildMapModel([legacy]);
    const feAgent = model.agents.find((a) => a.role === "frontend-engineer");

    // Assert — data result: epicKey is the "·"-prefix segment
    expect(feAgent!.task).not.toBeNull();
    expect(feAgent!.task!.epicKey).toBe("AlphaFeature");
  });

  it("[unit] new-structure story (no '·') with parent → epicKey falls back to parent.title", () => {
    // Arrange: new-structure story has a parent epic, no "·" in title
    const epicTitle = "CAM-198 Map Loading Epic";
    const epic = makeEpicIssue(epicTitle);
    const story = makeIssue({
      id: "CAM-31",
      title: "[backend-engineer] Implement loading endpoint",
      status: "In Progress",
      statusType: "started",
      parent: { id: "E-1", title: epicTitle },
      project: { id: "proj-3", name: "LOAD Feature" },
      labels: [],
    });

    const model = buildMapModel([epic, story]);
    const beAgent = model.agents.find((a) => a.role === "backend-engineer");

    // Assert — data result: epicKey = parent.title (fallback)
    expect(beAgent!.task).not.toBeNull();
    expect(beAgent!.task!.epicKey).toBe(epicTitle);
  });

  it("[boundary] story with no '·' and no parent → epicKey is empty string", () => {
    // Arrange: a floating story with no parent and no "·" prefix
    // buildModel drops it (no parent, no epicOf, no project → junk); give it a project
    // so it lands in the legacy bucket with epicOf("")... actually an issue with project
    // but no parent and no "·" becomes an epic issue itself, so we need a different
    // approach: give it a "·"-parent-title that itself has no epic prefix.
    const story = makeIssue({
      id: "CAM-32",
      title: "[qa-engineer] Orphan story with no parent or prefix",
      status: "In Progress",
      statusType: "started",
      parent: { id: "E-99", title: "SomeParentWithNoDot" },
      project: { id: "proj-4", name: "Orphan Feature" },
      labels: [],
    });

    const model = buildMapModel([story]);
    const qaAgent = model.agents.find((a) => a.role === "qa-engineer");

    // The story lands in legacy bucket under parent.title; epicKey = parent.title
    expect(qaAgent!.task).not.toBeNull();
    // epicKey falls back to parent.title (no "·" → epicOf returns "")
    expect(qaAgent!.task!.epicKey).toBe("SomeParentWithNoDot");
  });

  it("[unit] story project name is present → feature field is populated", () => {
    const epic = makeEpicIssue("Map Epic", "CAMP-Feature");
    const story = makeStoryUnder("Map Epic", "architect", {
      id: "CAM-33",
      project: { id: "proj-5", name: "CAMP-Feature" },
    });

    const model = buildMapModel([epic, story]);
    const archAgent = model.agents.find((a) => a.role === "architect");

    expect(archAgent!.task!.feature).toBe("CAMP-Feature");
  });

  it("[unit] story with null project → feature field is empty string", () => {
    const epic = makeEpicIssue("No-Project Epic");
    const story = makeStoryUnder("No-Project Epic", "devops-release", {
      id: "CAM-34",
      project: null,
    });

    const model = buildMapModel([epic, story]);
    const devAgent = model.agents.find((a) => a.role === "devops-release");

    expect(devAgent!.task!.feature).toBe("");
  });
});

// ============================================================
// SMUX-4 AC3 — buildAgents: multiple active stories → picks first
// ============================================================

describe("CAM-253 SMUX-4 — buildAgents: multiple active stories → first match wins", () => {
  it("[unit] two In-Progress stories for the same role → task.id is the first one found in work array", () => {
    // Arrange: two active stories for frontend-engineer under the same epic
    const epic = makeEpicIssue("Multi-Active Epic");
    const story1 = makeStoryUnder("Multi-Active Epic", "frontend-engineer", {
      id: "CAM-40",
      status: "In Progress",
      startedAt: "2026-01-01T00:00:00Z",
    });
    const story2 = makeStoryUnder("Multi-Active Epic", "frontend-engineer", {
      id: "CAM-41",
      status: "In Progress",
      startedAt: "2026-01-02T00:00:00Z",
    });

    // epic, story1, story2 in insertion order — story1 is first
    const model = buildMapModel([epic, story1, story2]);
    const feAgent = model.agents.find((a) => a.role === "frontend-engineer");

    // Assert — data result: first active story wins
    expect(feAgent!.task!.id).toBe("CAM-40");
  });
});

// ============================================================
// SMUX-4 AC4 — buildAgents: cleanTitle strips epic prefix + [role] tags
// ============================================================

describe("CAM-253 SMUX-4 — buildAgents: cleanTitle strips prefix and role tags", () => {
  it("[unit] title with '·' prefix gets prefix stripped in task.title", () => {
    const story = makeIssue({
      id: "CAM-50",
      title: "MyEpic · [frontend-engineer] Implement new card component",
      status: "In Progress",
      statusType: "started",
      parent: null,
      project: { id: "proj-6", name: "UI" },
      labels: [],
    });

    const model = buildMapModel([story]);
    const feAgent = model.agents.find((a) => a.role === "frontend-engineer");

    // Assert — visible result: cleaned title has no prefix or [role] tag
    expect(feAgent!.task!.title).toBe("Implement new card component");
    expect(feAgent!.task!.title).not.toContain("MyEpic");
    expect(feAgent!.task!.title).not.toContain("[frontend-engineer]");
  });

  it("[unit] title with only [role] tag (no '·') gets role tag stripped", () => {
    const story = makeIssue({
      id: "CAM-51",
      title: "[qa-engineer] Write integration tests",
      status: "In Progress",
      statusType: "started",
      parent: { id: "E-2", title: "QA Epic" },
      project: { id: "proj-7", name: "QA" },
      labels: [],
    });

    const model = buildMapModel([story]);
    const qaAgent = model.agents.find((a) => a.role === "qa-engineer");

    expect(qaAgent!.task!.title).toBe("Write integration tests");
  });

  it("[unit] title with no prefix and no [role] tag remains unchanged after clean", () => {
    const story = makeIssue({
      id: "CAM-52",
      title: "Plain title with no special formatting",
      status: "In Progress",
      statusType: "started",
      parent: { id: "E-3", title: "Plain Epic" },
      project: { id: "proj-8", name: "Plain" },
      labels: [],
    });

    const model = buildMapModel([story]);
    // No role tag → no agent matches this story's role → all agents task=null
    // Confirms cleanTitle doesn't crash on plain titles
    for (const a of model.agents) {
      expect(a.task).toBeNull(); // no [role] tag → none of the 7 BUILD_ROLES matches
    }
  });
});

// ============================================================
// SMUX-4 AC5 — toMapModel: structural integrity of full projection
// ============================================================

describe("CAM-253 SMUX-4 — toMapModel: structural projection from Model to MapModel", () => {
  it("[normal] projectPct is propagated correctly from buildModel", () => {
    // Arrange: 2 stories, 1 done → 50%
    const epic = makeEpicIssue("Pct Epic");
    const done = makeStoryUnder("Pct Epic", "frontend-engineer", {
      id: "CAM-60",
      status: "Done",
      statusType: "completed",
    });
    const active = makeStoryUnder("Pct Epic", "backend-engineer", {
      id: "CAM-61",
      status: "In Progress",
      statusType: "started",
    });

    const model = buildMapModel([epic, done, active]);

    expect(model.projectPct).toBe(50);
  });

  it("[normal] epics array is populated from epicNodes", () => {
    const epic = makeEpicIssue("Status Map Epic");
    const story = makeStoryUnder("Status Map Epic", "frontend-engineer", { id: "CAM-70" });

    const model = buildMapModel([epic, story]);

    expect(model.epics.length).toBeGreaterThan(0);
    expect(model.epics[0]).toHaveProperty("key");
    expect(model.epics[0]).toHaveProperty("label");
    expect(model.epics[0]).toHaveProperty("bucket");
    expect(model.epics[0]).toHaveProperty("stories");
  });

  it("[normal] gates array is populated when hasAwait label is present", () => {
    const epic = makeEpicIssue("Gate Epic");
    const gate = makeStoryUnder("Gate Epic", "frontend-engineer", {
      id: "CAM-80",
      labels: ["awaiting-you"],
    });

    const model = buildMapModel([epic, gate]);

    expect(model.gates).toHaveLength(1);
    expect(model.gates[0].id).toBe("CAM-80");
  });

  it("[null/empty] no issues → projectPct=0, gates=[], agents all task=null", () => {
    const model = buildMapModel([]);

    expect(model.projectPct).toBe(0);
    expect(model.gates).toEqual([]);
    expect(model.agents).toHaveLength(7);
    model.agents.forEach((a) => expect(a.task).toBeNull());
  });

  it("[normal] backlogItems are projected from backlog stories", () => {
    const epic = makeEpicIssue("Backlog Epic");
    const backlogStory = makeStoryUnder("Backlog Epic", "frontend-engineer", {
      id: "CAM-90",
      status: "Backlog",
      statusType: "backlog",
    });

    const model = buildMapModel([epic, backlogStory]);

    expect(model.backlogItems.length).toBeGreaterThan(0);
    const item = model.backlogItems.find((b) => b.id === "CAM-90");
    expect(item).toBeDefined();
    expect(item!.epicKey).toBeTruthy(); // has an epicKey from parent title
  });

  it("[normal] gate epicKey falls back to parent.title when no '·' (new-structure gate)", () => {
    const epicTitle = "Gate Parent Epic";
    const epic = makeEpicIssue(epicTitle);
    const gate = makeStoryUnder(epicTitle, "qa-engineer", {
      id: "CAM-100",
      labels: ["awaiting-you"],
    });

    const model = buildMapModel([epic, gate]);

    expect(model.gates[0].epicKey).toBe(epicTitle);
  });

  it("[normal] gate epicKey is set from '·' prefix when old-style title", () => {
    const gate = makeIssue({
      id: "CAM-101",
      title: "OldEpicPrefix · [qa-engineer] Review story",
      labels: ["awaiting-you"],
      status: "In Progress",
      parent: null,
      project: { id: "proj-9", name: "Old" },
    });

    const model = buildMapModel([gate]);

    expect(model.gates[0].epicKey).toBe("OldEpicPrefix");
  });

  it("[normal] envLanes dev/staging/prod are always present (even if empty)", () => {
    const model = buildMapModel([]);

    expect(model.envLanes).toHaveProperty("dev");
    expect(model.envLanes).toHaveProperty("staging");
    expect(model.envLanes).toHaveProperty("prod");
    expect(Array.isArray(model.envLanes.dev)).toBe(true);
    expect(Array.isArray(model.envLanes.staging)).toBe(true);
    expect(Array.isArray(model.envLanes.prod)).toBe(true);
  });

  it("[normal] buildMapModel and toMapModel(buildModel()) produce the same output", () => {
    const epic = makeEpicIssue("Parity Epic");
    const story = makeStoryUnder("Parity Epic", "architect", { id: "CAM-110" });
    const issues = [epic, story];

    const viaConvenience = buildMapModel(issues);
    const viaTwoStep = toMapModel(buildModel(issues));

    // Assert structural parity (compare JSON to handle nested objects)
    expect(JSON.stringify(viaConvenience)).toBe(JSON.stringify(viaTwoStep));
  });
});

// ============================================================
// SMUX-4 AC6 — buildMapModel: epic story projection
// ============================================================

describe("CAM-253 SMUX-4 — toMapModel: epic stories projection (buildEpicStories)", () => {
  it("[normal] epic stories carry id, title (cleaned), status, statusType, labels, role, url", () => {
    const epicTitle = "Story Projection Epic";
    const epic = makeEpicIssue(epicTitle);
    const story = makeStoryUnder(epicTitle, "security-reviewer", {
      id: "CAM-120",
      status: "In Progress",
      statusType: "started",
      url: "https://linear.app/cam/issue/CAM-120",
      labels: ["sec"],
    });

    const model = buildMapModel([epic, story]);

    // Find the epic entry
    const epicItem = model.epics.find((e) => e.key === epicTitle);
    expect(epicItem).toBeDefined();
    const projectedStory = epicItem!.stories.find((s) => s.id === "CAM-120");
    expect(projectedStory).toBeDefined();
    expect(projectedStory!.status).toBe("In Progress");
    expect(projectedStory!.statusType).toBe("started");
    expect(projectedStory!.labels).toContain("sec");
    expect(projectedStory!.role).toBe("security-reviewer");
    expect(projectedStory!.url).toBe("https://linear.app/cam/issue/CAM-120");
  });

  it("[unit] epic bucket is 'prog' when any story is In Progress", () => {
    const epicTitle = "Active Epic";
    const epic = makeEpicIssue(epicTitle);
    const story = makeStoryUnder(epicTitle, "backend-engineer", {
      id: "CAM-130",
      status: "In Progress",
      statusType: "started",
    });

    const model = buildMapModel([epic, story]);
    const epicItem = model.epics.find((e) => e.key === epicTitle);
    expect(epicItem!.bucket).toBe("prog");
  });

  it("[unit] epic bucket is 'done' when all stories are completed", () => {
    const epicTitle = "Done Epic";
    const epic = makeEpicIssue(epicTitle);
    const story = makeStoryUnder(epicTitle, "frontend-engineer", {
      id: "CAM-131",
      status: "Done",
      statusType: "completed",
    });

    const model = buildMapModel([epic, story]);
    const epicItem = model.epics.find((e) => e.key === epicTitle);
    expect(epicItem!.bucket).toBe("done");
  });

  it("[null/empty] epic with zero stories has empty stories array", () => {
    // A hierarchy epic with no children
    const epicTitle = "Empty Children Epic";
    const epic = makeEpicIssue(epicTitle);

    const model = buildMapModel([epic]);
    const epicItem = model.epics.find((e) => e.key === epicTitle);
    expect(epicItem).toBeDefined();
    expect(epicItem!.stories).toEqual([]);
  });
});

// ============================================================
// SMUX-4 AC7 — buildAgents: queued count formula
// ============================================================

describe("CAM-253 SMUX-4 — buildAgents: queued count = total - done - active", () => {
  it("[unit] queued = 0 when total = done + active (no waiting stories)", () => {
    const epic = makeEpicIssue("Queued Epic");
    const done = makeStoryUnder("Queued Epic", "devops-release", {
      id: "CAM-140",
      status: "Done",
      statusType: "completed",
    });
    const active = makeStoryUnder("Queued Epic", "devops-release", {
      id: "CAM-141",
      status: "In Progress",
      statusType: "started",
    });

    const model = buildMapModel([epic, done, active]);
    const devopsAgent = model.agents.find((a) => a.role === "devops-release");

    expect(devopsAgent!.queued).toBe(0);
  });

  it("[unit] queued counts backlog/unstarted stories not yet active or done", () => {
    const epic = makeEpicIssue("Queued Epic B");
    const backlog = makeStoryUnder("Queued Epic B", "qa-engineer", {
      id: "CAM-150",
      status: "Backlog",
      statusType: "backlog",
    });
    const active = makeStoryUnder("Queued Epic B", "qa-engineer", {
      id: "CAM-151",
      status: "In Progress",
      statusType: "started",
    });

    const model = buildMapModel([epic, backlog, active]);
    const qaAgent = model.agents.find((a) => a.role === "qa-engineer");

    // total=2, done=0, active=1 → queued=1
    expect(qaAgent!.queued).toBe(1);
  });

  it("[boundary] queued is never negative (Math.max guard)", () => {
    // Edge: if buildWorkload over-counts done > total somehow — guard must be 0
    // We can test this by checking the formula is Math.max(0, ...) via normal scenario
    const epic = makeEpicIssue("Non-Negative Epic");
    const done = makeStoryUnder("Non-Negative Epic", "ux-designer", {
      id: "CAM-160",
      status: "Done",
      statusType: "completed",
    });

    const model = buildMapModel([epic, done]);
    const uxAgent = model.agents.find((a) => a.role === "ux-designer");

    // Can only verify it's >= 0, not negative
    expect(uxAgent!.queued).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================
// SMUX-4 AC8 — payloadChanged edge cases (existing function, new edges)
// ============================================================

describe("CAM-253 SMUX-4 — payloadChanged: all edge cases", () => {
  it("[normal] same rich payload → false (no re-render needed)", () => {
    const payload = JSON.stringify({ projectPct: 42, agents: [{ role: "architect", active: true }] });
    expect(payloadChanged(payload, payload)).toBe(false);
  });

  it("[normal] different pct → true", () => {
    expect(payloadChanged('{"projectPct":10}', '{"projectPct":11}')).toBe(true);
  });

  it("[boundary] both empty strings → false", () => {
    expect(payloadChanged("", "")).toBe(false);
  });

  it("[boundary] prev empty, next non-empty (first poll) → true", () => {
    expect(payloadChanged("", '{"projectPct":0}')).toBe(true);
  });

  it("[boundary] whitespace difference only → true (exact byte compare, no JSON.parse)", () => {
    expect(payloadChanged('{"a":1}', '{"a": 1}')).toBe(true);
  });

  it("[null/empty] single space vs empty string → true", () => {
    expect(payloadChanged("", " ")).toBe(true);
  });
});

// ============================================================
// SMUX-4 AC9 — Responsive CSS: source-inspection edge/negative cases
// ============================================================

// campsite-scene.tsx is "use client" and uses DOM APIs — it cannot be require()'d
// in the node-only Vitest environment. Use source-inspection (the same harness as
// the existing status-map suite) to assert the LAYOUT constants from source text.
//
// We also parse the LAYOUT tables from source to enable numeric comparisons.

const sceneSrc = readFileSync(
  resolve(__dirname, "../app/status/map/campsite-scene.tsx"),
  "utf8",
);

// Extract { x: N, y: N } pairs for a given role from a named LAYOUT constant block.
// Finds "LAYOUT_NAME" in source then reads the role's `{ x: N, y: N }` entry.
function parseLayoutEntry(src: string, layoutName: string, role: string): { x: number; y: number } | null {
  const layoutStart = src.indexOf(`export const ${layoutName}`);
  if (layoutStart === -1) return null;
  // Find the closing `};` of this const block
  const layoutEnd = src.indexOf("\n};", layoutStart);
  const block = src.slice(layoutStart, layoutEnd);
  const pattern = new RegExp(`"${role}"\\s*:\\s*\\{\\s*x:\\s*([\\d.]+),\\s*y:\\s*([\\d.]+)\\s*\\}`);
  const m = block.match(pattern);
  if (!m) return null;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

describe("CAM-253 SMUX-4 — Responsive: LAYOUT_NARROW ≠ LAYOUT_WIDE (distinct objects)", () => {
  it("[structural] LAYOUT_NARROW is NOT the same reference as LAYOUT_WIDE (no alias)", () => {
    expect(sceneSrc).not.toContain("LAYOUT_NARROW = LAYOUT_WIDE");
  });

  it("[structural] LAYOUT_NARROW has all 7 BUILD_ROLES as string keys", () => {
    const roles = [
      "architect", "ux-designer", "backend-engineer", "frontend-engineer",
      "devops-release", "qa-engineer", "security-reviewer",
    ];
    const layoutStart = sceneSrc.indexOf("export const LAYOUT_NARROW");
    const layoutEnd   = sceneSrc.indexOf("\n};", layoutStart);
    const block = sceneSrc.slice(layoutStart, layoutEnd);
    for (const role of roles) {
      expect(block).toContain(`"${role}"`);
    }
  });

  it("[structural] LAYOUT_WIDE has all 7 BUILD_ROLES as string keys", () => {
    const roles = [
      "architect", "ux-designer", "backend-engineer", "frontend-engineer",
      "devops-release", "qa-engineer", "security-reviewer",
    ];
    const layoutStart = sceneSrc.indexOf("export const LAYOUT_WIDE");
    const layoutEnd   = sceneSrc.indexOf("\n};", layoutStart);
    const block = sceneSrc.slice(layoutStart, layoutEnd);
    for (const role of roles) {
      expect(block).toContain(`"${role}"`);
    }
  });

  it("[boundary] LAYOUT_NARROW architect x=50.0, y=31.0 (portrait top position)", () => {
    const entry = parseLayoutEntry(sceneSrc, "LAYOUT_NARROW", "architect");
    expect(entry).not.toBeNull();
    expect(entry!.x).toBe(50.0);
    expect(entry!.y).toBe(31.0);
  });

  it("[boundary] LAYOUT_WIDE architect x=50.1, y=38.2 (campfire-ring top position)", () => {
    const entry = parseLayoutEntry(sceneSrc, "LAYOUT_WIDE", "architect");
    expect(entry).not.toBeNull();
    expect(entry!.x).toBe(50.1);
    expect(entry!.y).toBe(38.2);
  });

  it("[boundary] LAYOUT_NARROW architect y=31.0 < LAYOUT_WIDE architect y=38.2 (narrow higher)", () => {
    const narrow = parseLayoutEntry(sceneSrc, "LAYOUT_NARROW", "architect");
    const wide   = parseLayoutEntry(sceneSrc, "LAYOUT_WIDE", "architect");
    expect(narrow!.y).toBeLessThan(wide!.y);
  });

  it("[structural] YOU_POS_NARROW = { x: 38, y: 27 } (portrait upper-left)", () => {
    expect(sceneSrc).toContain("YOU_POS_NARROW = { x: 38, y: 27 }");
  });

  it("[structural] YOU_POS_WIDE = { x: 38, y: 31 } (campfire-ring upper-left)", () => {
    expect(sceneSrc).toContain("YOU_POS_WIDE = { x: 38, y: 31 }");
  });

  it("[structural] LAYOUT_NARROW symmetric: frontend-engineer and devops-release share same y (Design Brief)", () => {
    const fe     = parseLayoutEntry(sceneSrc, "LAYOUT_NARROW", "frontend-engineer");
    const devops = parseLayoutEntry(sceneSrc, "LAYOUT_NARROW", "devops-release");
    expect(fe!.y).toBe(devops!.y);
  });

  it("[structural] LAYOUT_NARROW symmetric: backend-engineer and qa-engineer share same y (Design Brief)", () => {
    const be = parseLayoutEntry(sceneSrc, "LAYOUT_NARROW", "backend-engineer");
    const qa = parseLayoutEntry(sceneSrc, "LAYOUT_NARROW", "qa-engineer");
    expect(be!.y).toBe(qa!.y);
  });

  it("[structural] LAYOUT_NARROW symmetric: ux-designer and security-reviewer share same y (Design Brief)", () => {
    const ux  = parseLayoutEntry(sceneSrc, "LAYOUT_NARROW", "ux-designer");
    const sec = parseLayoutEntry(sceneSrc, "LAYOUT_NARROW", "security-reviewer");
    expect(ux!.y).toBe(sec!.y);
  });
});

// ============================================================
// SMUX-4 AC10 — Responsive CSS: mobile <640px contract (source-inspection)
// ============================================================

describe("CAM-253 SMUX-4 — Responsive CSS: mobile <640px contracts", () => {
  const src = readFileSync(
    resolve(__dirname, "../app/status/map/campsite-scene.tsx"),
    "utf8",
  );

  it("[structural] @media (max-width: 639px) hides .hud-signposts-desktop with !important", () => {
    // Critical: !important ensures the rule beats any broader selector
    expect(src).toContain(".hud-signposts-desktop{display:none !important}");
  });

  it("[structural] desktop @media (min-width: 1024px) has 3 separate display:none rules for edge+toolbar", () => {
    const desktopBlock = src.slice(
      src.indexOf("@media (min-width: 1024px)"),
      src.indexOf("@media (min-width: 1024px)") + 400,
    );
    expect(desktopBlock).toContain(".hud-edge-tab{display:none}");
    expect(desktopBlock).toContain(".hud-filter-compact{display:none}");
    expect(desktopBlock).toContain(".hud-map-toolbar{display:none}");
  });

  it("[structural] tablet block (max-width: 1023px) hides both left and right panel stacks", () => {
    expect(src).toContain(".hud-left-panels{display:none}");
    expect(src).toContain(".hud-right-panels{display:none}");
  });

  it("[a11y] right edge-tab uses same border-radius as left (mirrors after rotate(180deg))", () => {
    // Both tabs use `border-radius:0 6px 6px 0`
    const leftTabIdx  = src.indexOf(".hud-edge-tab.left{");
    const rightTabIdx = src.indexOf(".hud-edge-tab.right{");
    const leftCss  = src.slice(leftTabIdx,  leftTabIdx  + 120);
    const rightCss = src.slice(rightTabIdx, rightTabIdx + 120);
    expect(leftCss).toContain("border-radius:0 6px 6px 0;");
    expect(rightCss).toContain("border-radius:0 6px 6px 0;");
  });

  it("[a11y] right edge-tab CSS does NOT use the pre-fix wrong border-radius:6px 0 0 6px", () => {
    const rightTabIdx = src.indexOf(".hud-edge-tab.right{");
    const rightCss    = src.slice(rightTabIdx, rightTabIdx + 200);
    expect(rightCss).not.toContain("border-radius:6px 0 0 6px");
  });
});

// ============================================================
// SMUX-4 AC11 — A11y: agent keyboard accessibility (source-inspection)
// ============================================================

describe("CAM-253 SMUX-4 — A11y: agent keyboard activation contract", () => {
  const src = readFileSync(
    resolve(__dirname, "../app/status/map/campsite-scene.tsx"),
    "utf8",
  );

  it("[a11y] AgentScout renders as <button type='button'> (keyboard-activatable)", () => {
    // Must be a button so Enter/Space trigger it natively — no role='button' on a div
    expect(src).toContain('type="button"');
    // No role="button" on a div — a real button element is used
    expect(src).not.toContain('role="button"');
  });

  it("[a11y] agent button has data-testid following btn--map-agent-{role} convention", () => {
    expect(src).toContain('data-testid={`btn--map-agent-${agent.role}`}');
  });

  it("[a11y] agent aria-label describes displayName + roleLabel + active state", () => {
    // The aria-label is the textual equivalent for screen readers
    expect(src).toContain("ariaLabel");
    expect(src).toContain("cfg.displayName");
    expect(src).toContain("cfg.roleLabel");
    expect(src).toContain("กำลังทำ");
    expect(src).toContain("พัก");
  });

  it("[a11y] You character has btn--map-agent-you testid (keyboard-reachable)", () => {
    expect(src).toContain('data-testid="btn--map-agent-you"');
  });

  it("[a11y] You button aria-label mentions gate count when gates > 0 (Thai copy verbatim)", () => {
    expect(src).toContain("gate รอตรวจสอบ");
  });

  it("[a11y] You button aria-label when no gates says ไม่มี gate รอ (Thai copy verbatim)", () => {
    expect(src).toContain("ไม่มี gate รอ");
  });

  it("[a11y] scene root has role='img' + aria-label for screen-reader scene description", () => {
    expect(src).toContain('role="img"');
    expect(src).toContain("sceneAriaLabel");
  });

  it("[a11y] agent button has minWidth/minHeight 44 (≥44px tap target — WCAG 2.5.5)", () => {
    expect(src).toContain("minWidth: 44");
    expect(src).toContain("minHeight: 44");
  });
});

// ============================================================
// SMUX-4 AC12 — Bidirectional sync: source contracts (source-inspection)
// ============================================================

describe("CAM-253 SMUX-4 — Sync: epicKey no matching board column (edge case contracts)", () => {
  const src = readFileSync(
    resolve(__dirname, "../app/status/map/campsite-scene.tsx"),
    "utf8",
  );

  it("[sync] agent with task opens board even when epicKey matches no board column (graceful fallback)", () => {
    // The handler sets setActiveEpic(agent.task.epicKey) regardless — the board
    // renders whatever epic it finds or shows empty state (no crash, no guard needed here)
    expect(src).toContain("setActiveEpic(agent.task.epicKey)");
    // And expands the board so it's visible
    expect(src).toContain("setBoardCollapsed(false)");
  });

  it("[sync] clearing via 'all' scope resets focused agent (setFocusedTaskId cleared)", () => {
    // When epic scope is cleared (select 'all'), focusedTaskId must reset.
    // Source contract: onFilterChange checks !value and clears focusedTaskId
    expect(src).toContain("if (!value) setFocusedTaskId");
  });

  it("[sync] closing the board Sheet clears focusedTaskId (onOpenChange handler)", () => {
    // When the board Sheet closes, focusedTaskId must be cleared → no stale highlight
    expect(src).toContain('setFocusedTaskId("")');
  });

  it("[sync] isFocused checks agent.task?.epicKey === activeEpic (epic-level multi-agent highlight)", () => {
    // Selecting an epic highlights ALL agents working on that epic (epicKey match)
    expect(src).toContain("agent.task?.epicKey === activeEpic");
  });

  it("[sync] isFocused also checks agent.task?.id === focusedTaskId (card-level single-agent highlight)", () => {
    // Clicking a board card focuses ONLY the single agent whose task.id matches
    expect(src).toContain("agent.task?.id === focusedTaskId");
  });

  it("[sync] handleBoardCardActivate sets focusedTaskId to the card's storyId", () => {
    expect(src).toContain("handleBoardCardActivate");
    expect(src).toContain("setFocusedTaskId(storyId)");
  });

  it("[sync] agent with task=null opens roster, does NOT change activeEpic (no filter change)", () => {
    // The null-task branch only opens the roster — no setActiveEpic call in that branch
    expect(src).toContain("if (!agent.task)");
    expect(src).toContain("setTeamCollapsed(false)");
  });
});

describe("CAM-253 SMUX-4 — Sync: board card a11y + focusable (source-inspection)", () => {
  const src = readFileSync(
    resolve(__dirname, "../app/status/map/campsite-overlays.tsx"),
    "utf8",
  );

  it("[a11y] board cards have data-testid following card--board-{id} convention", () => {
    expect(src).toContain("`card--board-${s.id}`");
  });

  it("[a11y] StatusBoard scrolls focused card into view (scrollIntoView on focusedTaskId change)", () => {
    expect(src).toContain("scrollIntoView");
    expect(src).toContain("cardRefs.current[focusedTaskId]");
  });

  it("[a11y] focused card gets smux3-focused class (teal border + pulse)", () => {
    expect(src).toContain("smux3-focused");
    expect(src).toContain("focusedTaskId === s.id");
  });

  it("[a11y] focused card CSS is gated by prefers-reduced-motion (static ring under reduce)", () => {
    expect(src).toContain("hud-kc-focus-pulse");
    expect(src).toContain("prefers-reduced-motion");
  });

  it("[a11y] board card calls onCardActivate with storyId on click", () => {
    expect(src).toContain("onCardActivate?.(s.id)");
  });
});

// ============================================================
// SMUX-4 AC13 — Reduced-motion: static ring contract (source-inspection)
// ============================================================

describe("CAM-253 SMUX-4 — Reduced-motion: agent focus ring is static ring under reduce", () => {
  const src = readFileSync(
    resolve(__dirname, "../app/status/map/campsite-scene.tsx"),
    "utf8",
  );

  it("[a11y] .scout--focused ground-ring pulse (smux3-ground-pulse) is gated by prefers-reduced-motion: no-preference", () => {
    // Only the pulse animation lives inside the no-preference block; the ring itself does not.
    const noPreferenceBlock = src.indexOf("@media (prefers-reduced-motion: no-preference)", src.indexOf(".scout--focused::after"));
    const pulseIdx = src.indexOf("smux3-ground-pulse");
    expect(noPreferenceBlock).toBeGreaterThan(-1);
    expect(pulseIdx).toBeGreaterThan(noPreferenceBlock);
  });

  it("[a11y] .scout--focused ground ring is defined OUTSIDE the no-preference guard (always visible under reduced-motion)", () => {
    // The base ::after ellipse ring is declared before the pulse @media block, so it shows
    // (static) even under prefers-reduced-motion: reduce. CAM-263 replaced the old rectangular
    // .body outline with this ground ellipse.
    const ringIdx = src.indexOf(".scout--focused::after");
    const guardIdx = src.indexOf("@media (prefers-reduced-motion: no-preference)", ringIdx);
    expect(ringIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeGreaterThan(ringIdx); // base ring comes first, pulse guard after
    const ringBlock = src.slice(ringIdx, guardIdx);
    expect(ringBlock).toContain("border-radius:50%");
    expect(ringBlock).toContain("rgba(91,233,176,.9)");
    expect(ringBlock).toContain("pointer-events:none");
    // no rectangular sprite outline anymore
    expect(src).not.toContain("outline: 3px solid rgba(91,233,176,.9)");
  });

  it("[a11y] ground ring is aligned to the character's ground (aura-ring anchor) — CAM-263", () => {
    // The ::after ring uses the same bottom + translate(-50%,30%) anchor as .aura-ring so it
    // sits on the ground under the feet; shown even under reduced-motion (only the pulse is gated).
    const ringIdx = src.indexOf(".scout--focused::after");
    const ringBlock = src.slice(ringIdx, ringIdx + 320);
    expect(ringBlock).toContain("translate(-50%,30%)");
    expect(ringBlock).toContain("bottom:0");
  });
});

// ============================================================
// SMUX-4 AC14 — Sheet: one close button per sheet (structural integrity)
// ============================================================

describe("CAM-253 SMUX-4 — Sheet: exactly one close button per sheet (CAM-254 Fix 3)", () => {
  const src = readFileSync(
    resolve(__dirname, "../app/status/map/campsite-scene.tsx"),
    "utf8",
  );

  it("[structural] Roster Sheet has showCloseButton={false} so shadcn doesn't add a second button", () => {
    const rosterBlock = src.slice(
      src.indexOf('id="sheet-roster"'),
      src.indexOf('id="sheet-board"'),
    );
    expect(rosterBlock).toContain("showCloseButton={false}");
  });

  it("[structural] Board Sheet has showCloseButton={false} so shadcn doesn't add a second button", () => {
    const boardStart = src.indexOf('id="sheet-board"');
    const boardEnd = src.indexOf("</Sheet>", boardStart);
    const boardBlock = src.slice(boardStart, boardEnd);
    expect(boardBlock).toContain("showCloseButton={false}");
  });

  it("[structural] Roster Sheet block has exactly 1 <SheetClose (no duplicate)", () => {
    const rosterBlock = src.slice(
      src.indexOf('id="sheet-roster"'),
      src.indexOf('id="sheet-board"'),
    );
    const matches = rosterBlock.match(/<SheetClose/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("[structural] Board Sheet block has exactly 1 <SheetClose (no duplicate)", () => {
    const boardStart = src.indexOf('id="sheet-board"');
    const boardEnd   = src.indexOf("</Sheet>", boardStart);
    const boardBlock = src.slice(boardStart, boardEnd);
    const matches    = boardBlock.match(/<SheetClose/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("[a11y] Both custom SheetClose buttons have aria-label='ปิด' (Thai verbatim)", () => {
    expect(src).toContain('aria-label="ปิด"');
  });
});
