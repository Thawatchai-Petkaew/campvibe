import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  stageOf,
  buildTrail,
  rolesOf,
  buildWorkload,
  canonRole,
} from "@/lib/status-derive";
import type { StatusIssue } from "@/lib/linear";

// ---------- mock helper ----------
function mk(overrides: Partial<StatusIssue> = {}): StatusIssue {
  return {
    id: "CAM-1",
    title: "[frontend-engineer] Default story",
    status: "Todo",
    statusType: "unstarted",
    priority: "No priority",
    labels: [],
    url: "https://linear.app/cam/issue/CAM-1",
    description: "",
    startedAt: null,
    updatedAt: new Date().toISOString(),
    completedAt: null,
    assignee: null,
    project: null,
    parent: null,
    ...overrides,
  };
}

// ---------- stageOf ----------
describe("stageOf", () => {
  it("done story → Ship, even if tagged frontend-engineer", () => {
    const i = mk({ title: "[frontend-engineer] F1", statusType: "completed" });
    expect(stageOf(i)).toBe("Ship");
  });

  it("done story via status Done → Ship", () => {
    const i = mk({ title: "[frontend-engineer] F1", status: "Done", statusType: "started" });
    expect(stageOf(i)).toBe("Ship");
  });

  it("awaiting-you label → Gate", () => {
    const i = mk({ title: "[frontend-engineer] F1", labels: ["awaiting-you"] });
    expect(stageOf(i)).toBe("Gate");
  });

  it("awaiting-you takes priority over done check? No — isDone is first", () => {
    // isDone is checked before hasAwait → completed + awaiting → Ship
    const i = mk({ statusType: "completed", labels: ["awaiting-you"] });
    expect(stageOf(i)).toBe("Ship");
  });

  it("frontend-engineer tag → Build", () => {
    expect(stageOf(mk({ title: "[frontend-engineer] F1" }))).toBe("Build");
  });

  it("backend-engineer tag → Build", () => {
    expect(stageOf(mk({ title: "[backend-engineer] B1" }))).toBe("Build");
  });

  it("qa-engineer tag → Verify", () => {
    expect(stageOf(mk({ title: "[qa-engineer] Q1" }))).toBe("Verify");
  });

  it("security-reviewer tag → Verify", () => {
    expect(stageOf(mk({ title: "[security-reviewer] S1" }))).toBe("Verify");
  });

  it("devops-release tag → Ship (non-done story)", () => {
    // non-done → uses ROLE_STAGE not isDone path
    expect(stageOf(mk({ title: "[devops-release] D1" }))).toBe("Ship");
  });

  it("ux-designer tag → Design", () => {
    expect(stageOf(mk({ title: "[ux-designer] U1" }))).toBe("Design");
  });

  it("architect tag → Design", () => {
    expect(stageOf(mk({ title: "[architect] A1" }))).toBe("Design");
  });

  it("product-owner tag → Design (spec/scope authoring), not the unmapped default", () => {
    expect(stageOf(mk({ title: "[product-owner] P1" }))).toBe("Design");
  });

  it("analyst tag → Design", () => {
    expect(stageOf(mk({ title: "[analyst] A1" }))).toBe("Design");
  });

  it("orchestrator tag → Gate", () => {
    expect(stageOf(mk({ title: "[orchestrator] O1" }))).toBe("Gate");
  });

  it("human tag → Gate", () => {
    expect(stageOf(mk({ title: "[human] G1" }))).toBe("Gate");
  });

  it("unmapped role → Design", () => {
    expect(stageOf(mk({ title: "[unknown-role] U1" }))).toBe("Design");
  });

  it("no role tag → Design", () => {
    expect(stageOf(mk({ title: "No tag story" }))).toBe("Design");
  });
});

// ---------- buildTrail ----------
describe("buildTrail — 0 stories", () => {
  it("returns header 'no stories yet'", () => {
    const t = buildTrail([]);
    expect(t.header).toBe("no stories yet");
    expect(t.total).toBe(0);
    expect(t.shipped).toBe(0);
    expect(t.allDone).toBe(false);
    expect(t.curIdx).toBe(0);
  });

  it("all nodes are idle", () => {
    const t = buildTrail([]);
    expect(t.nodes.every((n) => n.cls === "idle")).toBe(true);
  });

  it("all counts are 0 and sub is '—'", () => {
    const t = buildTrail([]);
    expect(t.nodes.every((n) => n.count === 0 && n.sub === "—")).toBe(true);
  });
});

describe("buildTrail — all done (7 stories)", () => {
  const stories = Array.from({ length: 7 }, (_, k) =>
    mk({ id: `CAM-${k + 1}`, title: `[frontend-engineer] F${k + 1}`, statusType: "completed" })
  );

  it("allDone true, shipped=7, total=7", () => {
    const t = buildTrail(stories);
    expect(t.allDone).toBe(true);
    expect(t.shipped).toBe(7);
    expect(t.total).toBe(7);
  });

  it("curIdx = 4 (Ship)", () => {
    expect(buildTrail(stories).curIdx).toBe(4);
  });

  it("curName = Ship", () => {
    expect(buildTrail(stories).curName).toBe("Ship");
  });

  it("header = 'complete · 7 shipped'", () => {
    expect(buildTrail(stories).header).toBe("complete · 7 shipped");
  });

  it("Ship node has count=7, cls=done, sub='7 shipped'", () => {
    const ship = buildTrail(stories).nodes[4];
    expect(ship.count).toBe(7);
    expect(ship.cls).toBe("done");
    expect(ship.sub).toBe("7 shipped");
  });

  it("Build node has count=0 (done stories go to Ship, NOT Build)", () => {
    const build = buildTrail(stories).nodes.find((n) => n.name === "Build");
    expect(build!.count).toBe(0);
  });
});

describe("buildTrail — mixed (5 in Design / 1 In Progress Build / 1 shipped)", () => {
  const stories = [
    // 5 design stories (ux-designer, todo)
    ...Array.from({ length: 5 }, (_, k) => mk({ id: `CAM-${k + 1}`, title: `[ux-designer] U${k + 1}` })),
    // 1 active build story
    mk({ id: "CAM-6", title: "[frontend-engineer] F1", status: "In Progress", statusType: "started" }),
    // 1 shipped
    mk({ id: "CAM-7", title: "[frontend-engineer] F2", statusType: "completed" }),
  ];

  it("counts: Design=5, Build=1 active, Ship=1", () => {
    const t = buildTrail(stories);
    const design = t.nodes.find((n) => n.name === "Design")!;
    const build = t.nodes.find((n) => n.name === "Build")!;
    const ship = t.nodes.find((n) => n.name === "Ship")!;
    expect(design.count).toBe(5);
    expect(build.count).toBe(1);
    expect(build.active).toBe(1);
    expect(ship.count).toBe(1);
  });

  it("Build cls=run because active>0", () => {
    const build = buildTrail(stories).nodes.find((n) => n.name === "Build")!;
    expect(build.cls).toBe("run");
  });

  it("Design cls=q (count>0 but no active)", () => {
    const design = buildTrail(stories).nodes.find((n) => n.name === "Design")!;
    expect(design.cls).toBe("q");
  });

  it("curIdx = 0 (Design is the earliest non-Ship stage with count)", () => {
    expect(buildTrail(stories).curIdx).toBe(0);
  });

  it("header contains '5 in design' and '1 shipped'", () => {
    const h = buildTrail(stories).header;
    expect(h).toContain("5 in design");
    expect(h).toContain("1 in build");
    expect(h).toContain("1 shipped");
  });

  it("allDone=false", () => {
    expect(buildTrail(stories).allDone).toBe(false);
  });
});

describe("buildTrail — gate via awaiting-you", () => {
  it("Gate node cls=gate when story has awaiting-you", () => {
    const s = mk({ title: "[frontend-engineer] G1", labels: ["awaiting-you"] });
    const gate = buildTrail([s]).nodes.find((n) => n.name === "Gate")!;
    expect(gate.cls).toBe("gate");
    expect(gate.count).toBe(1);
    expect(gate.sub).toBe("needs you");
  });
});

describe("buildTrail — single active story sub text", () => {
  it("active node sub = '{active} active · {n}'", () => {
    // frontend-engineer maps to Build; set In Progress so it is active
    const s = mk({ title: "[frontend-engineer] F1", status: "In Progress", statusType: "started" });
    const t = buildTrail([s]);
    const build = t.nodes.find((n) => n.name === "Build")!;
    expect(build.sub).toBe("1 active · 1");
  });
});

describe("buildTrail — singular/plural story sub", () => {
  it("1 story → '1 story'", () => {
    const s = mk({ title: "[ux-designer] U1" });
    const design = buildTrail([s]).nodes.find((n) => n.name === "Design")!;
    expect(design.sub).toBe("1 story");
  });

  it("2 stories → '2 stories'", () => {
    const stories = [
      mk({ id: "CAM-1", title: "[ux-designer] U1" }),
      mk({ id: "CAM-2", title: "[ux-designer] U2" }),
    ];
    const design = buildTrail(stories).nodes.find((n) => n.name === "Design")!;
    expect(design.sub).toBe("2 stories");
  });
});

// ---------- rolesOf ----------
describe("rolesOf", () => {
  it("returns roles from role:* labels", () => {
    const i = mk({ labels: ["role:frontend-engineer", "role:qa-engineer", "persona:host"] });
    expect(rolesOf(i)).toEqual(["frontend-engineer", "qa-engineer"]);
  });

  it("falls back to title tag when no role: labels", () => {
    const i = mk({ title: "[frontend-engineer] F1", labels: ["awaiting-you"] });
    expect(rolesOf(i)).toEqual(["frontend-engineer"]);
  });

  it("returns [] when no role: labels and no title tag", () => {
    const i = mk({ title: "No tag story", labels: [] });
    expect(rolesOf(i)).toEqual([]);
  });

  it("does not include non-role: labels in output, uses title fallback", () => {
    // no role: labels but title has [frontend-engineer] → fallback to title tag
    const i = mk({ title: "[frontend-engineer] F1", labels: ["awaiting-you", "persona:host"] });
    expect(rolesOf(i)).toEqual(["frontend-engineer"]);
  });

  it("returns [] when no role: labels and no title tag", () => {
    const i = mk({ title: "Story without tag", labels: ["awaiting-you", "persona:host"] });
    expect(rolesOf(i)).toEqual([]);
  });

  it("title fallback only when labels have no role:* entries", () => {
    const i = mk({ title: "[devops-release] D1", labels: ["persona:platform"] });
    expect(rolesOf(i)).toEqual(["devops-release"]);
  });

  it("prefers labels over title when both present", () => {
    // title says frontend, but labels say ux-designer + qa — use labels
    const i = mk({
      title: "[frontend-engineer] F1",
      labels: ["role:ux-designer", "role:qa-engineer"],
    });
    expect(rolesOf(i)).toEqual(["ux-designer", "qa-engineer"]);
  });
});

// ---------- buildWorkload ----------
describe("buildWorkload", () => {
  it("counts total for all roles in rolesOf", () => {
    const i = mk({ labels: ["role:frontend-engineer", "role:qa-engineer"] });
    const rmap = buildWorkload([i]);
    expect(rmap["frontend-engineer"]?.total).toBe(1);
    expect(rmap["qa-engineer"]?.total).toBe(1);
  });

  it("done increments for all roles when story is done", () => {
    const i = mk({ labels: ["role:frontend-engineer", "role:qa-engineer"], statusType: "completed" });
    const rmap = buildWorkload([i]);
    expect(rmap["frontend-engineer"]?.done).toBe(1);
    expect(rmap["qa-engineer"]?.done).toBe(1);
  });

  it("active only increments for the current role (title tag) when In Progress", () => {
    const i = mk({
      title: "[frontend-engineer] F1",
      labels: ["role:frontend-engineer", "role:qa-engineer"],
      status: "In Progress",
      statusType: "started",
    });
    const rmap = buildWorkload([i]);
    // active only for frontend-engineer (current role in title)
    expect(rmap["frontend-engineer"]?.active).toBe(1);
    expect(rmap["qa-engineer"]?.active).toBe(0);
  });

  it("multi-role 1 story: total 1 each, active 0 both when todo", () => {
    const i = mk({
      title: "[frontend-engineer] F1",
      labels: ["role:frontend-engineer", "role:ux-designer"],
    });
    const rmap = buildWorkload([i]);
    expect(rmap["frontend-engineer"]?.total).toBe(1);
    expect(rmap["frontend-engineer"]?.active).toBe(0);
    expect(rmap["ux-designer"]?.total).toBe(1);
    expect(rmap["ux-designer"]?.active).toBe(0);
  });

  it("stories with no role:* labels and no title tag are excluded", () => {
    const i = mk({ title: "No tag story", labels: [] });
    const rmap = buildWorkload([i]);
    expect(Object.keys(rmap)).toHaveLength(0);
  });

  it("accumulates across multiple stories for the same role", () => {
    const stories = [
      mk({ id: "CAM-1", labels: ["role:frontend-engineer"], statusType: "completed" }),
      mk({ id: "CAM-2", labels: ["role:frontend-engineer"] }),
      mk({
        id: "CAM-3",
        title: "[frontend-engineer] F3",
        labels: ["role:frontend-engineer"],
        status: "In Progress",
        statusType: "started",
      }),
    ];
    const rmap = buildWorkload(stories);
    expect(rmap["frontend-engineer"]?.total).toBe(3);
    expect(rmap["frontend-engineer"]?.done).toBe(1);
    expect(rmap["frontend-engineer"]?.active).toBe(1);
  });
});

// ---------- source-inspection tests ----------
describe("source inspection — page.tsx", () => {
  const pageSrc = readFileSync(
    resolve(__dirname, "../app/status/page.tsx"),
    "utf8"
  );

  it("imports buildTrail from status-derive (buildWorkload now via status-model)", () => {
    // CAM-151: buildWorkload moved into status-model.ts (called inside buildModel).
    // page.tsx imports buildTrail from status-derive and buildModel from status-model.
    expect(pageSrc).toContain("buildTrail");
    expect(pageSrc).toContain("status-derive");
    expect(pageSrc).toContain("status-model");
  });

  it("does NOT contain 'const stageInfo ='", () => {
    expect(pageSrc).not.toContain("const stageInfo =");
  });

  it("buildWorkload is called inside status-model.ts (not page.tsx)", () => {
    // CAM-151: buildWorkload moved out of page.tsx into lib/status-model.ts.
    // Verify it lives in the shared model module instead.
    const modelSrc = readFileSync(
      resolve(__dirname, "../lib/status-model.ts"),
      "utf8"
    );
    expect(modelSrc).toContain("buildWorkload(work)");
    expect(pageSrc).not.toContain("buildWorkload(work)");
  });

  it("uses buildTrail(it)", () => {
    expect(pageSrc).toContain("buildTrail(it)");
  });
});

describe("source inspection — dashboard-assets.ts", () => {
  const cssSrc = readFileSync(
    resolve(__dirname, "../app/status/dashboard-assets.ts"),
    "utf8"
  );

  it("has .cols>* min-width:0", () => {
    expect(cssSrc).toContain(".cols>*{min-width:0}");
  });

  it("has .board .col min-width:0", () => {
    expect(cssSrc).toContain(".board .col{min-width:0}");
  });

  it("has .qrow .qm .tk with ellipsis", () => {
    expect(cssSrc).toContain(".qrow .qm .tk{");
    expect(cssSrc).toContain("text-overflow:ellipsis");
  });

  it("has .kc .kt span with ellipsis", () => {
    expect(cssSrc).toContain(".kc .kt span{");
    expect(cssSrc).toContain("text-overflow:ellipsis");
  });

  it("has .node .ncount badge rule", () => {
    expect(cssSrc).toContain(".node .ncount{");
  });

  it("has run/gate/done ncount color variants", () => {
    expect(cssSrc).toContain(".stage.run .node .ncount{");
    expect(cssSrc).toContain(".stage.gate .node .ncount{");
    expect(cssSrc).toContain(".stage.done .node .ncount{");
  });

  it("idle ncount is hidden", () => {
    expect(cssSrc).toContain(".stage.idle .node .ncount{display:none}");
  });
});

// ---------- CAM-117: canonRole ----------
describe("canonRole", () => {
  it("known long-form passthrough: backend-engineer → backend-engineer", () => {
    expect(canonRole("backend-engineer")).toBe("backend-engineer");
  });

  it("known long-form passthrough: devops-release → devops-release", () => {
    expect(canonRole("devops-release")).toBe("devops-release");
  });

  it("known long-form passthrough: qa-engineer → qa-engineer", () => {
    expect(canonRole("qa-engineer")).toBe("qa-engineer");
  });

  it("known long-form passthrough: frontend-engineer → frontend-engineer", () => {
    expect(canonRole("frontend-engineer")).toBe("frontend-engineer");
  });

  it("short alias: backend → backend-engineer", () => {
    expect(canonRole("backend")).toBe("backend-engineer");
  });

  it("short alias: devops → devops-release", () => {
    expect(canonRole("devops")).toBe("devops-release");
  });

  it("short alias: qa → qa-engineer", () => {
    expect(canonRole("qa")).toBe("qa-engineer");
  });

  it("short alias: designer → ux-designer", () => {
    expect(canonRole("designer")).toBe("ux-designer");
  });

  it("short alias: design → ux-designer", () => {
    expect(canonRole("design")).toBe("ux-designer");
  });

  it("short alias: ux → ux-designer", () => {
    expect(canonRole("ux")).toBe("ux-designer");
  });

  it("short alias: frontend → frontend-engineer", () => {
    expect(canonRole("frontend")).toBe("frontend-engineer");
  });

  it("short alias: security → security-reviewer", () => {
    expect(canonRole("security")).toBe("security-reviewer");
  });

  it("unknown slug 'id' → empty string (dropped)", () => {
    expect(canonRole("id")).toBe("");
  });

  it("empty string → empty string", () => {
    expect(canonRole("")).toBe("");
  });

  it("completely unknown slug → empty string", () => {
    expect(canonRole("unknownrole")).toBe("");
  });
});

// ---------- CAM-117: stageOf with short alias tags ----------
describe("stageOf — short alias tags (canonicalized)", () => {
  it("[backend] → Build (via canon backend-engineer)", () => {
    expect(stageOf(mk({ title: "[backend] B1" }))).toBe("Build");
  });

  it("[devops] → Ship (via canon devops-release)", () => {
    expect(stageOf(mk({ title: "[devops] D1" }))).toBe("Ship");
  });

  it("[qa] → Verify (via canon qa-engineer)", () => {
    expect(stageOf(mk({ title: "[qa] Q1" }))).toBe("Verify");
  });

  it("[frontend] → Build (via canon frontend-engineer)", () => {
    expect(stageOf(mk({ title: "[frontend] F1" }))).toBe("Build");
  });

  it("[designer] → Design (via canon ux-designer)", () => {
    expect(stageOf(mk({ title: "[designer] U1" }))).toBe("Design");
  });
});

// ---------- CAM-117: rolesOf with canonicalization ----------
describe("rolesOf — canonicalization + dedupe + unknown drop", () => {
  it("role:backend label → ['backend-engineer'] (canonical)", () => {
    const i = mk({ labels: ["role:backend"] });
    expect(rolesOf(i)).toEqual(["backend-engineer"]);
  });

  it("role:backend + role:frontend-engineer → ['backend-engineer','frontend-engineer']", () => {
    const i = mk({ labels: ["role:backend", "role:frontend-engineer"] });
    expect(rolesOf(i)).toEqual(["backend-engineer", "frontend-engineer"]);
  });

  it("role:id unknown label → [] (dropped, not included)", () => {
    const i = mk({ labels: ["role:id"] });
    expect(rolesOf(i)).toEqual([]);
  });

  it("role:backend + role:backend-engineer deduped → ['backend-engineer'] (1 entry)", () => {
    const i = mk({ labels: ["role:backend", "role:backend-engineer"] });
    expect(rolesOf(i)).toEqual(["backend-engineer"]);
  });

  it("role:id + role:backend → ['backend-engineer'] (unknown dropped, known kept)", () => {
    const i = mk({ labels: ["role:id", "role:backend"] });
    expect(rolesOf(i)).toEqual(["backend-engineer"]);
  });

  it("no role: labels + [backend] title → ['backend-engineer'] (canon fallback)", () => {
    const i = mk({ title: "[backend] B1", labels: [] });
    expect(rolesOf(i)).toEqual(["backend-engineer"]);
  });

  it("no role: labels + [devops] title → ['devops-release'] (canon fallback)", () => {
    const i = mk({ title: "[devops] D1", labels: [] });
    expect(rolesOf(i)).toEqual(["devops-release"]);
  });
});

// ---------- CAM-117: buildWorkload — short-tag + canonical merge ----------
describe("buildWorkload — role canonicalization", () => {
  it("[backend] + [backend-engineer] stories merge into ONE 'backend-engineer' entry (total 2)", () => {
    const stories = [
      mk({ id: "CAM-1", title: "[backend] B1" }),
      mk({ id: "CAM-2", title: "[backend-engineer] B2" }),
    ];
    const rmap = buildWorkload(stories);
    expect(rmap["backend-engineer"]?.total).toBe(2);
    expect(rmap["backend"]).toBeUndefined(); // no raw "backend" key
  });

  it("'id' slug never appears as a key in rmap", () => {
    const stories = [
      mk({ id: "CAM-1", title: "[id] junk-story", labels: ["role:id"] }),
    ];
    const rmap = buildWorkload(stories);
    expect(rmap["id"]).toBeUndefined();
    expect(Object.keys(rmap)).toHaveLength(0);
  });

  it("[devops] story counts as 'devops-release' active when In Progress", () => {
    const i = mk({
      id: "CAM-1",
      title: "[devops] D1",
      status: "In Progress",
      statusType: "started",
    });
    const rmap = buildWorkload([i]);
    expect(rmap["devops-release"]?.total).toBe(1);
    expect(rmap["devops-release"]?.active).toBe(1);
    expect(rmap["devops"]).toBeUndefined();
  });

  it("[backend] done + [backend-engineer] active → backend-engineer: total 2, done 1, active 1", () => {
    const stories = [
      mk({ id: "CAM-1", title: "[backend] B1", statusType: "completed" }),
      mk({
        id: "CAM-2",
        title: "[backend-engineer] B2",
        status: "In Progress",
        statusType: "started",
      }),
    ];
    const rmap = buildWorkload(stories);
    expect(rmap["backend-engineer"]?.total).toBe(2);
    expect(rmap["backend-engineer"]?.done).toBe(1);
    expect(rmap["backend-engineer"]?.active).toBe(1);
  });
});

// ---------- CAM-117: buildTrail — passed/done state for count-0 nodes ----------
describe("buildTrail — all-done epic: count-0 non-Ship nodes show 'done'", () => {
  const allDoneStories = [
    mk({ id: "CAM-1", title: "[ux-designer] U1", statusType: "completed" }),
    mk({ id: "CAM-2", title: "[backend-engineer] B1", statusType: "completed" }),
    mk({ id: "CAM-3", title: "[frontend-engineer] F1", statusType: "completed" }),
    mk({ id: "CAM-4", title: "[qa-engineer] Q1", statusType: "completed" }),
  ];

  it("Design node cls='done' when all stories are done (all passed Design)", () => {
    const design = buildTrail(allDoneStories).nodes.find((n) => n.name === "Design")!;
    expect(design.cls).toBe("done");
  });

  it("Gate node cls='done' when all stories are done (all passed Gate)", () => {
    const gate = buildTrail(allDoneStories).nodes.find((n) => n.name === "Gate")!;
    expect(gate.cls).toBe("done");
  });

  it("Build node cls='done' when all stories are done (all passed Build)", () => {
    const build = buildTrail(allDoneStories).nodes.find((n) => n.name === "Build")!;
    expect(build.cls).toBe("done");
  });

  it("Verify node cls='done' when all stories are done (all passed Verify)", () => {
    const verify = buildTrail(allDoneStories).nodes.find((n) => n.name === "Verify")!;
    expect(verify.cls).toBe("done");
  });

  it("Ship node cls='done' with count > 0 and sub '4 shipped'", () => {
    const ship = buildTrail(allDoneStories).nodes.find((n) => n.name === "Ship")!;
    expect(ship.cls).toBe("done");
    expect(ship.sub).toBe("4 shipped");
    expect(ship.count).toBe(4);
  });

  it("allDone=true, curIdx=4", () => {
    const t = buildTrail(allDoneStories);
    expect(t.allDone).toBe(true);
    expect(t.curIdx).toBe(4);
  });
});

describe("buildTrail — mid-flight: only passed stages are 'done', future stages 'idle'", () => {
  // 5 stories in Design (ux-designer, todo), 1 active Build, 1 shipped
  const midFlightStories = [
    ...Array.from({ length: 5 }, (_, k) =>
      mk({ id: `CAM-${k + 1}`, title: `[ux-designer] U${k + 1}` })
    ),
    mk({ id: "CAM-6", title: "[frontend-engineer] F1", status: "In Progress", statusType: "started" }),
    mk({ id: "CAM-7", title: "[frontend-engineer] F2", statusType: "completed" }),
  ];

  it("Verify node cls='idle' (no story has reached Verify yet)", () => {
    const verify = buildTrail(midFlightStories).nodes.find((n) => n.name === "Verify")!;
    expect(verify.cls).toBe("idle");
  });

  it("Gate node cls='idle' (no story has passed Gate)", () => {
    const gate = buildTrail(midFlightStories).nodes.find((n) => n.name === "Gate")!;
    expect(gate.cls).toBe("idle");
  });

  it("Design node cls='q' (has 5 stories, no active)", () => {
    const design = buildTrail(midFlightStories).nodes.find((n) => n.name === "Design")!;
    expect(design.cls).toBe("q");
  });

  it("Build node cls='run' (1 active story)", () => {
    const build = buildTrail(midFlightStories).nodes.find((n) => n.name === "Build")!;
    expect(build.cls).toBe("run");
  });

  it("allDone=false", () => {
    expect(buildTrail(midFlightStories).allDone).toBe(false);
  });
});
