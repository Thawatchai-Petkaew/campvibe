/* CampVibe — Campsite delivery map. Server-rendered shell, client scene mounted lazily.
 * Protected by STATUS_TOKEN via the shared default-deny gate (lib/status-auth.ts — CAM-275;
 * same gate as /status). Data from lib/linear.ts + status-model.ts.
 * Note: this page renders self-contained CSS (dangerouslySetInnerHTML) and is intentionally
 * immune to the .dark class applied by ThemeProvider — its appearance is fixed by design. */
import { fetchStatusIssues } from "@/lib/linear";
import { readPulse } from "@/lib/status-pulse";
import { isStatusAuthorized } from "@/lib/status-auth";
import { buildModel } from "@/lib/status-model";
import { toMapModel } from "@/lib/status-map-model";
import { CSS, SCENE } from "./campsite-assets";
import SceneLoader from "./scene-loader";

export const dynamic = "force-dynamic";
export const metadata = { title: "CampVibe — Delivery Map" };

export default async function StatusMapPage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string;
    scope?: string;
    epic?: string;
    group?: string;
    efilter?: string;
    grid?: string;
  }>;
}) {
  const sp = await searchParams;

  // S5: Read and sanitize URL params — these are passed to the client as initial state.
  const initialScope    = sp.scope === "epic" ? "epic" : "all" as "all" | "epic";
  const initialEpic     = typeof sp.epic === "string" ? sp.epic : "";
  const initialGroup    = sp.group === "persona" ? "persona" : "feature" as "feature" | "persona";
  const initialEfilter  = (["all", "prog", "done", "todo"] as const).includes(
    sp.efilter as "all" | "prog" | "done" | "todo"
  ) ? (sp.efilter as "all" | "prog" | "done" | "todo") : "all";
  // CAM-164 dev tool: ?grid=1 renders a % coordinate overlay for layout tuning.
  // Absent in normal view — no grid param = false.
  const debugGrid = sp.grid === "1";

  // CAM-275: symmetric, default-deny gate (lib/status-auth.ts) — same rule the API routes
  // enforce, so an unset STATUS_TOKEN never renders a map whose approve/reject actions 401.
  if (!isStatusAuthorized(sp.token)) {
    const body =
      SCENE +
      `<div class="gatebox"><h2>ลิงก์ไม่ถูกต้อง</h2><p style="color:var(--muted)">เปิดหน้านี้ผ่านลิงก์จาก Telegram หรือใส่รหัสให้ถูกต้อง</p></div>`;
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div dangerouslySetInnerHTML={{ __html: body }} />
      </>
    );
  }

  let issues: Awaited<ReturnType<typeof fetchStatusIssues>> = [];
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

  // S6: shared projection via lib/status-map-model.ts — same function used by
  // /status/map/data route so page initial data and reconcile fetches never drift.
  const mapModel = toMapModel(buildModel(issues));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div dangerouslySetInnerHTML={{ __html: SCENE }} />
      {err ? (
        // S7: Error state — matches /status error copy pattern exactly.
        // Night-scene background (SCENE) is already rendered above so the
        // map never shows a blank/white screen even on fetch failure.
        <div
          style={{
            position: "relative",
            zIndex: 5,
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          data-testid="error--status-map"
        >
          <div className="map-placeholder">
            <p className="map-placeholder-text" data-testid="error-text--status-map">
              โหลดข้อมูลจาก Linear ไม่ได้: {err}
            </p>
          </div>
        </div>
      ) : (
        <SceneLoader
          model={mapModel}
          token={sp.token || ""}
          initialScope={initialScope}
          initialEpic={initialEpic}
          initialGroup={initialGroup}
          initialEfilter={initialEfilter}
          debugGrid={debugGrid}
        />
      )}
    </>
  );
}
