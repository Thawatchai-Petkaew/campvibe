// Shared delivery model for /status and /status/map.
// Pure helpers only — no server-only imports; StatusIssue is import-type only.
import type { StatusIssue } from "@/lib/linear";
import { buildWorkload, envOf, type EnvLane } from "@/lib/status-derive";

// ---------- title-convention parsing ----------
export const epicOf = (t: string) => { const x = t.split("·"); return x.length > 1 ? x[0].trim() : ""; };

// ---------- issue state helpers ----------
export const hasAwait = (i: StatusIssue) => i.labels.includes("awaiting-you");
export const isActive = (i: StatusIssue) => i.status === "In Progress";
export const isDone   = (i: StatusIssue) => i.statusType === "completed" || i.status === "Done";

// ---------- persona + feature ----------
const PERSONAS = ["host", "camper", "admin", "platform"];
export const personaOf = (i: StatusIssue) => i.labels.find((l) => PERSONAS.includes(l)) || "";
export const featureOf = (i: StatusIssue) => i.project?.name || "—";

// ---------- derived model interfaces ----------
export interface EpicNode {
  key: string;       // ?epic= value + m.epics lookup key (= epic title / legacy prefix)
  label: string;     // display name
  feature: string;   // Linear project / feature name
  persona: string;   // persona label ("" = none)
  stories: StatusIssue[];
  legacy: boolean;   // old "·"-title epic (Wishlist / P0 Hardening), grouped by title prefix
}

export interface Model {
  work: StatusIssue[];                       // leaf stories only (epic containers excluded)
  epics: Record<string, StatusIssue[]>;      // epic key → its stories (renderEpic reads this)
  epicNodes: EpicNode[];
  epicNames: string[];                       // epic keys, sorted
  projectPct: number;
  gates: StatusIssue[];
  epicsActive: number;
  backlog: StatusIssue[];
  rmap: Record<string, { total: number; active: number; done: number }>;
  activeEpic: string;
  byFeature: Record<string, EpicNode[]>;
  byPersona: Record<string, EpicNode[]>;
  backlogByFeature: Record<string, StatusIssue[]>;
  backlogByPersona: Record<string, StatusIssue[]>;
  byEnv: Record<EnvLane, StatusIssue[]>;
}

export function groupBy<T>(arr: T[], keyOf: (x: T) => string): Record<string, T[]> {
  const o: Record<string, T[]> = {};
  arr.forEach((x) => { const k = keyOf(x) || "none"; (o[k] = o[k] || []).push(x); });
  return o;
}

export function buildModel(issues: StatusIssue[]): Model {
  // Classify three kinds of issue:
  //  • hierarchy epic   → a project issue with no parent and no "·" (shows even with 0 stories yet)
  //  • hierarchy story  → has a Linear parent (grouped under parent.title)
  //  • legacy story     → old "·"-title active-loop issue, no parent → grouped by title prefix
  //  (Linear-onboarding junk CAM-1..4: no "·", no parent, no project → dropped)
  const epicIssues = issues.filter((i) => !i.parent && !epicOf(i.title) && !!i.project);
  const epicTitles = new Set(epicIssues.map((i) => i.title));

  const storiesByEpic: Record<string, StatusIssue[]> = {};
  const legacyByPrefix: Record<string, StatusIssue[]> = {};
  issues.forEach((i) => {
    if (i.parent?.title) {
      const pt = i.parent.title;
      if (epicTitles.has(pt)) { (storiesByEpic[pt] = storiesByEpic[pt] || []).push(i); }    // child of a clean epic
      else { const pre = epicOf(pt) || pt; (legacyByPrefix[pre] = legacyByPrefix[pre] || []).push(i); }  // child of a legacy "·" issue (e.g. Wishlist subtasks)
      return;
    }
    if (epicTitles.has(i.title)) return;               // epic container — added below
    const pre = epicOf(i.title);
    if (pre) (legacyByPrefix[pre] = legacyByPrefix[pre] || []).push(i);
  });

  const epicNodes: EpicNode[] = [];
  epicIssues.forEach((ep) => {
    epicNodes.push({ key: ep.title, label: ep.title, feature: featureOf(ep), persona: personaOf(ep), stories: storiesByEpic[ep.title] || [], legacy: false });
  });
  Object.entries(legacyByPrefix).forEach(([pre, stories]) => {
    const seed = stories.find((s) => personaOf(s)) || stories[0];
    epicNodes.push({ key: pre, label: pre, feature: featureOf(stories[0]), persona: personaOf(seed), stories, legacy: true });
  });
  epicNodes.sort((a, b) => a.label.localeCompare(b.label));

  const epics: Record<string, StatusIssue[]> = {};
  epicNodes.forEach((n) => { epics[n.key] = n.stories; });
  const epicNames = epicNodes.map((n) => n.key);

  const work = epicNodes.flatMap((n) => n.stories);
  const done = work.filter(isDone).length;

  // Agent workload: counts all roles from role:* labels (accumulated history), falling back to
  // [role] title tag for backward-compat. buildWorkload handles the multi-role attribution.
  const rmap = buildWorkload(work);

  const backlog = work.filter((i) => i.status === "Backlog");
  // Env lanes — derived from state + released label (single source of truth, no env field).
  const byEnv: Record<EnvLane, StatusIssue[]> = { dev: [], staging: [], prod: [] };
  work.forEach((i) => { byEnv[envOf(i)].push(i); });
  return {
    work, epics, epicNodes, epicNames,
    projectPct: work.length ? Math.round((done / work.length) * 100) : 0,
    gates: work.filter(hasAwait),
    epicsActive: epicNodes.filter((n) => n.stories.some(isActive)).length,
    backlog,
    rmap,
    activeEpic: epicNodes.find((n) => n.stories.some(isActive))?.key || epicNames[0] || "",
    byFeature: groupBy(epicNodes, (n) => n.feature),
    byPersona: groupBy(epicNodes, (n) => n.persona),
    backlogByFeature: groupBy(backlog, (i) => featureOf(i)),
    backlogByPersona: groupBy(backlog, (i) => personaOf(i)),
    byEnv,
  };
}
