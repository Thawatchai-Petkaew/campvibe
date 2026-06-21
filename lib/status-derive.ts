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

// ---------- issue helpers ----------
/** Extract [role] tag from title, e.g. "[frontend-engineer]" → "frontend-engineer" */
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
 *   - else role → ROLE_STAGE lookup, unmapped → "Design"
 */
export function stageOf(i: StatusIssue): string {
  if (isDone(i)) return "Ship";
  if (hasAwait(i)) return "Gate";
  return ROLE_STAGE[roleOf(i.title)] ?? "Design";
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

  const nodes: TrailNode[] = STAGES.map((name) => {
    const items = buckets[name];
    const count = items.length;
    const active = items.filter(isActive).length;

    let cls: TrailNode["cls"];
    if (active > 0) {
      cls = "run";
    } else if (name === "Gate" && items.some(hasAwait)) {
      cls = "gate";
    } else if (name === "Ship" && count > 0) {
      cls = "done";
    } else if (count > 0) {
      cls = "q";
    } else {
      cls = "idle";
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

// ---------- rolesOf ----------
/**
 * All roles that have ever touched this story.
 * Source: labels starting with "role:" (accumulated history).
 * Fallback: the [role] tag in the title (backward-compat for stories without labels yet).
 */
export function rolesOf(i: StatusIssue): string[] {
  const fromLabels = i.labels.filter((l) => l.startsWith("role:")).map((l) => l.slice(5));
  if (fromLabels.length > 0) return fromLabels;
  const tag = roleOf(i.title);
  return tag ? [tag] : [];
}

// ---------- buildWorkload ----------
export interface WorkloadEntry {
  total: number;
  active: number;
  done: number;
}

/**
 * Build role → workload map from all stories.
 * Each story is counted once for every role in rolesOf(story).
 * active is only incremented for the role currently doing the work (roleOf(title)),
 * and only if the story is In Progress.
 */
export function buildWorkload(
  stories: StatusIssue[]
): Record<string, WorkloadEntry> {
  const rmap: Record<string, WorkloadEntry> = {};

  for (const i of stories) {
    const cur = roleOf(i.title);
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
