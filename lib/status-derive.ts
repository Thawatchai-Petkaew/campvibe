// Pure, framework-free helpers for /status dashboard derived data.
// import type only — StatusIssue is erased at compile time, no server-only chain.
import type { StatusIssue } from "@/lib/linear";

// ---------- stage constants ----------
export const STAGES = ["Design", "Gate", "Build", "Verify", "Ship"] as const;
export type StageName = (typeof STAGES)[number];

export const ROLE_STAGE: Record<string, string> = {
  architect: "Design",
  "ux-designer": "Design",
  human: "Gate",
  "frontend-engineer": "Build",
  "backend-engineer": "Build",
  "qa-engineer": "Verify",
  "security-reviewer": "Verify",
  "devops-release": "Ship",
};

// ---------- role canonicalization ----------

const KNOWN_ROLES = new Set([
  "architect",
  "ux-designer",
  "frontend-engineer",
  "backend-engineer",
  "qa-engineer",
  "security-reviewer",
  "devops-release",
  "product-owner",
  "analyst",
  "orchestrator",
  "human",
]);

const ROLE_ALIASES: Record<string, string> = {
  backend: "backend-engineer",
  frontend: "frontend-engineer",
  devops: "devops-release",
  designer: "ux-designer",
  design: "ux-designer",
  ux: "ux-designer",
  qa: "qa-engineer",
  security: "security-reviewer",
  pm: "product-owner",
  po: "product-owner",
};

/**
 * Normalise a raw role slug to its canonical long-form key.
 * Known canonical slugs pass through unchanged.
 * Short aliases (backend, devops, qa, …) are mapped to their full key.
 * Completely unknown slugs (e.g. "id") return "".
 */
export function canonRole(slug: string): string {
  if (!slug) return "";
  if (KNOWN_ROLES.has(slug)) return slug;
  return ROLE_ALIASES[slug] ?? "";
}

// ---------- issue helpers ----------
/** Extract [role] tag from title, e.g. "[backend]" → "backend" (raw, pass through canonRole before use) */
function roleOf(title: string): string {
  const m = title.match(/\[([a-z-]+)\]/);
  return m ? m[1] : "";
}

function isActive(i: StatusIssue): boolean {
  return i.status === "In Progress";
}

function isDone(i: StatusIssue): boolean {
  return i.statusType === "completed" || i.status === "Done";
}

function hasAwait(i: StatusIssue): boolean {
  return i.labels.includes("awaiting-you");
}

// ---------- stageOf ----------
/**
 * Classify a story into a pipeline stage:
 *   - isDone  → "Ship"  (critical fix: prevent done stories from bloating Build/Design)
 *   - hasAwait → "Gate"
 *   - else role → ROLE_STAGE lookup via canonRole; unmapped → "Design"
 */
export function stageOf(i: StatusIssue): string {
  if (isDone(i)) return "Ship";
  if (hasAwait(i)) return "Gate";
  return ROLE_STAGE[canonRole(roleOf(i.title))] ?? "Design";
}

// ---------- trail node shape ----------
export interface TrailNode {
  name: string;
  count: number;
  active: number;
  cls: "run" | "gate" | "done" | "q" | "idle";
  sub: string;
}

export interface Trail {
  nodes: TrailNode[];
  total: number;
  shipped: number;
  allDone: boolean;
  curIdx: number;
  curName: string;
  header: string;
}

// ---------- buildTrail ----------
export function buildTrail(stories: StatusIssue[]): Trail {
  // Bucket stories by stage
  const buckets: Record<string, StatusIssue[]> = {};
  for (const s of STAGES) buckets[s] = [];
  for (const i of stories) {
    const s = stageOf(i);
    (buckets[s] = buckets[s] || []).push(i);
  }

  const total = stories.length;
  const shipped = buckets["Ship"].length;
  const allDone = total > 0 && shipped === total;

  // For passed-state: compute each story's stage index.
  // A count-0 node at index i is "done" (passed) if every story has stageIndex > i.
  // A count-0 node at index i is "idle" if some story is still at index <= i (ahead or at it).
  const stageIndexOf = (story: StatusIssue): number => {
    const stageName = stageOf(story);
    const idx = STAGES.indexOf(stageName as StageName);
    return idx >= 0 ? idx : 0;
  };

  const nodes: TrailNode[] = STAGES.map((name, i) => {
    const items = buckets[name];
    const count = items.length;
    const active = items.filter(isActive).length;

    let cls: TrailNode["cls"];
    if (count === 0) {
      if (total === 0) {
        // No stories at all — all nodes idle
        cls = "idle";
      } else {
        // All stories have moved past stage i → passed/done
        const allPassed = stories.every((s) => stageIndexOf(s) > i);
        cls = allPassed ? "done" : "idle";
      }
    } else if (active > 0) {
      cls = "run";
    } else if (name === "Gate" && items.some(hasAwait)) {
      cls = "gate";
    } else if (name === "Ship") {
      cls = "done";
    } else {
      cls = "q";
    }

    let sub: string;
    if (count === 0) {
      sub = "—";
    } else if (active > 0) {
      sub = `${active} active · ${count}`;
    } else if (cls === "gate") {
      sub = "needs you";
    } else if (name === "Ship") {
      sub = `${count} shipped`;
    } else {
      sub = count === 1 ? "1 story" : `${count} stories`;
    }

    return { name, count, active, cls, sub };
  });

  // curIdx: earliest non-Ship stage with count > 0; allDone → 4 (Ship); total 0 → 0
  let curIdx = 0;
  if (allDone) {
    curIdx = 4;
  } else if (total > 0) {
    const idx = nodes.findIndex((n, i) => i < 4 && n.count > 0);
    curIdx = idx >= 0 ? idx : 0;
  }

  const curName = STAGES[curIdx];

  // header
  let header: string;
  if (total === 0) {
    header = "no stories yet";
  } else if (allDone) {
    header = `complete · ${shipped} shipped`;
  } else {
    const parts: string[] = [];
    for (const n of nodes) {
      if (n.name !== "Ship" && n.count > 0) {
        parts.push(`${n.count} in ${n.name.toLowerCase()}`);
      }
    }
    if (shipped > 0) parts.push(`${shipped} shipped`);
    header = parts.join(" · ");
  }

  return { nodes, total, shipped, allDone, curIdx, curName, header };
}

// ---------- regression helpers ----------

/**
 * Return the numeric rank of a role's pipeline stage.
 * Design=0, Gate=1, Build=2, Verify=3, Ship=4. Unknown roles → 0.
 * Used by both the webhook (classification) and scripts/linear-sync.mjs (keep in sync).
 */
export function stageRank(role: string): number {
  const stage = ROLE_STAGE[role] ?? "Design";
  const idx = STAGES.indexOf(stage as StageName);
  return idx >= 0 ? idx : 0;
}

/**
 * Sum the regression round numbers from all matching `regression:<role>:<n>` labels.
 * e.g. ["regression:frontend-engineer:2", "regression:qa-engineer:1"] → 3.
 * Returns 0 when no regression labels are present or the labels array is empty.
 */
export function regressionRound(labels: string[]): number {
  let total = 0;
  for (const l of labels) {
    const m = l.match(/^regression:[^:]+:(\d+)$/);
    if (m) total += parseInt(m[1], 10);
  }
  return total;
}

// ---------- rolesOf ----------
/**
 * All roles that have ever touched this story, canonicalized.
 * Source: labels starting with "role:" (accumulated history) → canonRole → drop empties → dedupe.
 * Fallback: the [role] tag in the title (backward-compat) → canonRole → drop empty.
 */
export function rolesOf(i: StatusIssue): string[] {
  const out = new Set<string>();
  const roleLabels = i.labels.filter((l) => l.startsWith("role:"));

  if (roleLabels.length > 0) {
    for (const l of roleLabels) {
      const canonical = canonRole(l.slice(5));
      if (canonical) out.add(canonical);
    }
    return [...out];
  }

  // Fallback to title tag
  const tag = roleOf(i.title);
  const canonical = canonRole(tag);
  if (canonical) out.add(canonical);
  return [...out];
}

// ---------- buildWorkload ----------
export interface WorkloadEntry {
  total: number;
  active: number;
  done: number;
}

/**
 * Build role → workload map from all stories.
 * Each story is counted once for every canonical role in rolesOf(story).
 * active is only incremented for the canonical role currently doing the work
 * (canonRole(roleOf(title))), and only if the story is In Progress.
 * Unknown slugs (like "id") are dropped by canonRole returning "".
 */
export function buildWorkload(
  stories: StatusIssue[]
): Record<string, WorkloadEntry> {
  const rmap: Record<string, WorkloadEntry> = {};

  for (const i of stories) {
    const cur = canonRole(roleOf(i.title));
    const roles = rolesOf(i);
    for (const r of roles) {
      if (!rmap[r]) rmap[r] = { total: 0, active: 0, done: 0 };
      rmap[r].total++;
      if (isDone(i)) rmap[r].done++;
      if (isActive(i) && r === cur) rmap[r].active++;
    }
  }

  return rmap;
}

// ---------- envOf (3-env derivation: state + released label) ----------
export type EnvLane = "dev" | "staging" | "prod";

/**
 * Which environment a story currently sits in, derived ONLY from its workflow
 * state + the `released` label — no separate env field, so there is one source
 * of truth (per the 3-env model: Local → Staging → Prod).
 *   - `released` label present → "prod"    (promoted to production)
 *   - else Done                → "staging" (merged + verified; in the release train)
 *   - else                     → "dev"     (in progress / not yet on staging)
 */
export function envOf(i: StatusIssue): EnvLane {
  if (i.labels.includes("released")) return "prod";
  if (isDone(i)) return "staging";
  return "dev";
}

// ---------- epicBucket (Epics lifecycle filter on /status) ----------
export type EpicBucket = "done" | "prog" | "todo";

/**
 * Lifecycle bucket for an epic, judged by its stories' PROGRESS (not the current snapshot
 * status — a started-then-paused story still counts as in progress):
 *   - done: has stories and every one is done
 *   - prog: started but not finished — at least one story is `started` or `completed`
 *   - todo: not started — no stories, or every story is still backlog / unstarted
 */
export function epicBucket(stories: StatusIssue[]): EpicBucket {
  const total = stories.length;
  if (total === 0) return "todo";
  const done = stories.filter(isDone).length;
  if (done === total) return "done";
  const started = stories.some((i) => i.statusType === "started" || i.statusType === "completed");
  return started ? "prog" : "todo";
}
