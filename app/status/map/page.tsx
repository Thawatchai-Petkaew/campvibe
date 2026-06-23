/* CampVibe — Campsite delivery map. Server-rendered shell, client scene mounted lazily.
 * Protected by STATUS_TOKEN (same gate as /status). Data from lib/linear.ts + status-model.ts.
 * Note: this page renders self-contained CSS (dangerouslySetInnerHTML) and is intentionally
 * immune to the .dark class applied by ThemeProvider — its appearance is fixed by design. */
import { fetchStatusIssues, type StatusIssue } from "@/lib/linear";
import { readPulse } from "@/lib/status-pulse";
import { buildModel, epicOf, isActive } from "@/lib/status-model";
import { canonRole } from "@/lib/status-derive";
import { CSS, SCENE } from "./campsite-assets";
import SceneLoader from "./scene-loader";
import type { MapAgent, MapBacklogItem, MapEnvItem, MapGate } from "./campsite-scene";

export const dynamic = "force-dynamic";
export const metadata = { title: "CampVibe — Delivery Map" };

// The 7 build-roles that always appear on the map.
const BUILD_ROLES: string[] = [
  "architect",
  "ux-designer",
  "backend-engineer",
  "frontend-engineer",
  "devops-release",
  "qa-engineer",
  "security-reviewer",
];

/** Extract [role] tag from title — same regex as status-derive.ts */
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

/**
 * Build the MapAgent array from the Model.
 * For each build-role:
 *   - active: rmap[role].active > 0
 *   - task: the In Progress story currently tagged to this role (by [role] title tag)
 *   - counts: from rmap (total, done, active → derive queued)
 */
function buildAgents(
  work: StatusIssue[],
  rmap: Record<string, { total: number; active: number; done: number }>
): MapAgent[] {
  return BUILD_ROLES.map((role) => {
    const counts = rmap[role] ?? { total: 0, active: 0, done: 0 };
    const queued = Math.max(0, counts.total - counts.done - counts.active);

    // Find the active story currently assigned to this role
    const activeStory = work.find(
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
      name: role, // page.tsx doesn't need the display name — it's in ROLE_CONFIG client-side
      active: counts.active > 0,
      done: counts.done,
      activeCount: counts.active,
      queued,
      task,
    };
  });
}

export default async function StatusMapPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const required = process.env.STATUS_TOKEN;

  if (required && sp.token !== required) {
    const body =
      SCENE +
      `<div class="gatebox"><h2>Protected dashboard</h2><p style="color:var(--muted)">เพิ่ม access token ใน URL:<br><code>/status/map?token=YOUR_TOKEN</code></p></div>`;
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div dangerouslySetInnerHTML={{ __html: body }} />
      </>
    );
  }

  let issues: StatusIssue[] = [];
  let err = "";
  try {
    let pulse = 0;
    try {
      pulse = await readPulse();
    } catch {
      /* pulse unavailable → fall back to the 60s time cache */
    }
    issues = await fetchStatusIssues(pulse);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  const m = buildModel(issues);

  // S4: build overlay data from Model fields — all derived, no hardcoded values.

  const gates: MapGate[] = m.gates.map((i) => ({
    id: i.id,
    title: cleanTitle(i.title),
    url: i.url,
    epicKey: epicOf(i.title),
    priority: i.priority,
  }));

  const backlogItems: MapBacklogItem[] = m.backlog.map((i) => ({
    id: i.id,
    title: cleanTitle(i.title),
    role: canonRole(titleRoleOf(i.title)),
    epicKey: epicOf(i.title) || i.parent?.title || "",
  }));

  const buildEnvItems = (items: StatusIssue[]): MapEnvItem[] =>
    items.map((i) => ({
      id: i.id,
      title: cleanTitle(i.title),
      role: canonRole(titleRoleOf(i.title)),
    }));

  const mapModel = {
    projectPct: m.projectPct,
    gates,
    agents: buildAgents(m.work, m.rmap),
    epicNames: m.epicNames,
    // S4 overlay additions
    epicsActive: m.epicsActive,
    totalEpics: m.epicNodes.length,
    backlogItems,
    envLanes: {
      dev:     buildEnvItems(m.byEnv.dev),
      staging: buildEnvItems(m.byEnv.staging),
      prod:    buildEnvItems(m.byEnv.prod),
    },
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div dangerouslySetInnerHTML={{ __html: SCENE }} />
      {err ? (
        <div
          style={{
            position: "relative",
            zIndex: 5,
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div className="map-placeholder">
            <p className="map-placeholder-text">โหลดข้อมูลไม่ได้: {err}</p>
          </div>
        </div>
      ) : (
        <SceneLoader model={mapModel} token={sp.token || ""} />
      )}
    </>
  );
}
