/**
 * Shared MapModel projection for /status/map.
 *
 * Extracted from app/status/map/page.tsx (S6) so that BOTH the server page and
 * the GET /status/map/data endpoint produce the exact same MapModel from the
 * same Model — no drift between the SSR initial render and a reconcile fetch.
 *
 * Import: server-side only (reads from lib/status-model + lib/status-derive).
 * Neither readPulse nor fetchStatusIssues are called here — the caller supplies
 * the already-fetched Model so the caller owns the cache lifecycle.
 */

import type { StatusIssue } from "@/lib/linear";
import { epicOf, isActive, buildModel, type Model } from "@/lib/status-model";
import { canonRole, epicBucket } from "@/lib/status-derive";
import type {
  MapModel,
  MapAgent,
  MapGate,
  MapBacklogItem,
  MapEnvItem,
  MapEpicItem,
  MapEpicStory,
} from "@/app/status/map/campsite-scene";

// The 7 build-roles that always appear on the map (same list as page.tsx).
const BUILD_ROLES: string[] = [
  "architect",
  "ux-designer",
  "backend-engineer",
  "frontend-engineer",
  "devops-release",
  "qa-engineer",
  "security-reviewer",
];

/** Extract [role] tag from a story title. */
function titleRoleOf(title: string): string {
  const m = title.match(/\[([a-z-]+)\]/);
  return m ? m[1] : "";
}

/**
 * Clean a story title for display:
 * - Strip leading "Epic prefix · " (splits on the first · character).
 * - Strip [role] tags.
 */
function cleanTitle(title: string): string {
  return title
    .replace(/^[^·]*·\s*/, "")
    .replace(/\[[a-z-]+\]\s*/g, "")
    .trim();
}

/** Build the MapAgent array from the Model. */
function buildAgents(
  work: StatusIssue[],
  rmap: Record<string, { total: number; active: number; done: number }>
): MapAgent[] {
  return BUILD_ROLES.map((role) => {
    const counts = rmap[role] ?? { total: 0, active: 0, done: 0 };
    const queued = Math.max(0, counts.total - counts.done - counts.active);

    const activeStory =
      work.find(
        (i) => isActive(i) && canonRole(titleRoleOf(i.title)) === role
      ) ?? null;

    const task = activeStory
      ? {
          id: activeStory.id,
          title: cleanTitle(activeStory.title),
          startedAt: activeStory.startedAt,
        }
      : null;

    return {
      role,
      name: role,
      active: counts.active > 0,
      done: counts.done,
      activeCount: counts.active,
      queued,
      task,
    };
  });
}

function buildEnvItems(items: StatusIssue[]): MapEnvItem[] {
  return items.map((i) => ({
    id: i.id,
    title: cleanTitle(i.title),
    role: canonRole(titleRoleOf(i.title)),
  }));
}

function buildEpicStories(issues: StatusIssue[]): MapEpicStory[] {
  return issues.map((i) => ({
    id: i.id,
    title: cleanTitle(i.title),
    status: i.status,
    statusType: i.statusType,
    labels: i.labels,
    role: canonRole(titleRoleOf(i.title)),
    url: i.url,
    startedAt: i.startedAt,
    completedAt: i.completedAt,
  }));
}

/**
 * Project a Model (from buildModel(issues)) into the MapModel that the client
 * scene + data endpoint both consume.
 *
 * This is the single source-of-truth projection — both page.tsx (SSR) and the
 * /status/map/data route call this function so they are always in sync.
 */
export function toMapModel(m: Model): MapModel {
  const gates: MapGate[] = m.gates.map((i) => ({
    id: i.id,
    title: cleanTitle(i.title),
    url: i.url,
    // New-structure stories carry no "·", so epicOf() is empty — fall back to the parent (epic)
    // title so the gate chip scopes/deep-links to its epic, same as backlog items below.
    epicKey: epicOf(i.title) || i.parent?.title || "",
    priority: i.priority,
  }));

  const backlogItems: MapBacklogItem[] = m.backlog.map((i) => ({
    id: i.id,
    title: cleanTitle(i.title),
    role: canonRole(titleRoleOf(i.title)),
    epicKey: epicOf(i.title) || i.parent?.title || "",
  }));

  const epics: MapEpicItem[] = m.epicNodes.map((node) => ({
    key: node.key,
    label: node.label,
    feature: node.feature,
    persona: node.persona,
    bucket: epicBucket(node.stories),
    stories: buildEpicStories(node.stories),
  }));

  return {
    projectPct: m.projectPct,
    gates,
    agents: buildAgents(m.work, m.rmap),
    epicNames: m.epicNames,
    epicsActive: m.epicsActive,
    totalEpics: m.epicNodes.length,
    backlogItems,
    envLanes: {
      dev: buildEnvItems(m.byEnv.dev),
      staging: buildEnvItems(m.byEnv.staging),
      prod: buildEnvItems(m.byEnv.prod),
    },
    epics,
  };
}

/**
 * Convenience helper: build issues → Model → MapModel in one call.
 * Used by the data endpoint where the caller supplies raw issues.
 */
export function buildMapModel(issues: StatusIssue[]): MapModel {
  return toMapModel(buildModel(issues));
}
