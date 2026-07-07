"use client";

// StatusMapShell (CAM-372 S1b/S1c) — renderer-agnostic HUD/state shell for /status/map.
// Default-exported as `CampsiteScene` was before (module keeps the same filename +
// default export so scene-loader.tsx's dynamic(() => import("./campsite-scene")) and
// its ssr:false test are untouched); the component itself is renamed StatusMapShell.
//
// Owns: the liveModel reconcile (useMapReconcile, S1a), all filter/scope/collapse/modal
// state, the CAM-176 activeKey→setActivity bridge (hoisted here so ANY renderer — the
// 2D CampsiteCanvas today, the Canvas3D stub since S1c — can subscribe via the
// RendererHandle imperative interface from map-types.ts), and the entire HUD overlay
// JSX (topbar, filter rows, edge tabs, mobile toolbar, roster/board Sheets, side
// panels, gate/ticket detail modals). Renders exactly ONE renderer child at a time,
// selected by `renderer` state ("2d" default | "3d"): CampsiteCanvas (2D sprite
// engine — see that file for the motion model, reduced-motion handling, and
// DOM-write details that used to live in this file, S3/S7 notes moved there) or
// Canvas3D (a stub since S1c; the real 3D scene ships in S2/CAM-373). The shell
// itself (incl. the SSE reconcile loop) stays mounted across a 2D↔3D swap — only
// the renderer child unmounts/remounts.
//
// S5 — Epic scope: rendererRef.current.setScope() dims/shows agents without remounting
//   the renderer's internal animation loop. URL params (scope/epic/group/efilter/r) are
//   persisted via history.replaceState and restored from initial props (read by the
//   server page.tsx from searchParams).
// S7 — Deep-link scope fix: the scope+syncUrl effect re-runs when rendererReady flips
//   true (gated the same way the old engineReady-gated effect was — see below).
// S6 — Client reconcile failures are caught gracefully (keep last-known data) — see
//   use-map-reconcile.ts (CAM-372 S1a).

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gauge, LayoutDashboard, LayoutGrid, Layers, Users, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { ApprovalCard, DeliveryCard, EnvPickerPanel, EnvPipelineCapsule, FilterSignposts, GateDetailModal, HUD_CSS, RendererToggle, StatusBoard, StatusBoardHint, SummaryCard, TeamRoster, TicketDetailModal, ViewToggle } from "./campsite-overlays";
import { boardColumnOf } from "@/lib/status-derive";
import { deriveCapsuleStats } from "@/lib/status-map-model";
import { LOGO } from "../dashboard-assets";
import { useMapReconcile } from "./use-map-reconcile";
import { CampsiteCanvas } from "./campsite-canvas";
import { MapProgress } from "./map-progress";
import { ROLE_DISPLAY } from "./role-config";
import type { MapAgent, MapModel, RendererHandle } from "./map-types";

// CAM-372 (S1c): Canvas3D is selection-gated — lazily imported so `three` (added in
// S2/CAM-373) never loads unless the user actually switches to 3D.
// CAM-372 (S1c fix): React.lazy, NOT next/dynamic. next/dynamic's runtime wrapper is
// ITSELF a forwardRef component whose own useImperativeHandle exposes {retry,
// preload} for its internal retry mechanism — passing `ref={rendererRef}` to a
// next/dynamic-wrapped component silently replaces the ref with that {retry} object
// instead of forwarding it to the inner component, so rendererRef.current would
// resolve to Next's internal handle, not Canvas3DInner's RendererHandle, and every
// setActivity/setScope call would throw "not a function" the moment a user switched
// to 3D (caught via the interactive regression test, not the adversarial review —
// a second, more severe bug than the ready-nonce race). React.lazy has no such
// wrapper: a ref on a <Suspense>-wrapped lazy component forwards straight through to
// the resolved component's own forwardRef, exactly like a static import would. No
// SSR concern here either way — this whole module only ever runs client-side (it is
// itself loaded via a ssr:false dynamic() in scene-loader.tsx).
const Canvas3D = lazy(() => import("./canvas-3d"));

const RENDERER_STORAGE_KEY = "statusmap.r";

// ── URL param helpers ─────────────────────────────────────────────────────────
// Mirror syncUrl idiom from dashboard-client.tsx — history.replaceState, no navigation.

// Filter persistence (cookie) — restored on the next visit so the view is remembered.
const FILTER_COOKIE = "campvibe.map.filter";
type FilterCookie = { persona?: string; feature?: string; epic?: string; efilter?: string; summaryCollapsed?: boolean; approvalCollapsed?: boolean; deliveryCollapsed?: boolean; boardCollapsed?: boolean; teamCollapsed?: boolean };
function readFilterCookie(): FilterCookie {
  if (typeof document === "undefined") return {};
  try {
    const m = document.cookie.match(/(?:^|;\s*)campvibe\.map\.filter=([^;]+)/);
    return m ? (JSON.parse(decodeURIComponent(m[1])) as FilterCookie) : {};
  } catch {
    return {};
  }
}
function writeFilterCookie(v: FilterCookie): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${FILTER_COOKIE}=${encodeURIComponent(JSON.stringify(v))};path=/;max-age=${60 * 60 * 24 * 30};samesite=lax`;
  } catch {
    /* ignore */
  }
}

function syncUrl(params: Record<string, string>): void {
  try {
    const u = new URL(location.href);
    Object.entries(params).forEach(([k, v]) => {
      if (v) u.searchParams.set(k, v);
      else u.searchParams.delete(k);
    });
    history.replaceState(null, "", u);
  } catch {
    /* no-op in environments where location is unavailable */
  }
}

// ── Ambient sound toggle ─────────────────────────────────────────────────────
// A small glass button (top-right) that loops the campfire/wildlife ambience.
// Browser autoplay policy: audio with sound only starts inside a user gesture, so
// the default is OFF and the toggle click IS the gesture. The preference persists
// in localStorage; on reload, if it was ON we try to resume and otherwise start on
// the next interaction (no surprise audio, never throws).
// Zero sprite/engine coupling — kept in the shell HUD (CAM-372 S1b).
const SOUND_KEY = "campvibe.map.sound";
const SOUND_SRC = "/status-map/campfire-wildlife-ambience.mp3";
const SOUND_VOL = 0.35;

function SoundToggle() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(SOUND_KEY) === "on";
    } catch {
      return false;
    }
  });

  // On mount, if sound was left ON, try to resume it. Autoplay may be blocked until a
  // user gesture, so fall back to starting on the next interaction.
  useEffect(() => {
    if (!on) return;
    const a = audioRef.current;
    if (!a) return;
    a.volume = SOUND_VOL;
    a.play().catch(() => {
      const resume = () => a.play().catch(() => undefined);
      window.addEventListener("pointerdown", resume, { once: true });
      window.addEventListener("keydown", resume, { once: true });
    });
    // run once on mount; `on`'s initial value is what we restored from storage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    setOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SOUND_KEY, next ? "on" : "off");
      } catch {
        /* localStorage unavailable */
      }
      if (next) {
        a.volume = SOUND_VOL;
        a.play().catch(() => undefined);
      } else {
        a.pause();
      }
      return next;
    });
  }, []);

  const label = on ? "ปิดเสียงบรรยากาศ" : "เปิดเสียงบรรยากาศ";
  return (
    <>
      <audio ref={audioRef} src={SOUND_SRC} loop preload="none" aria-hidden="true" />
      <button
        type="button"
        className={on ? "sound-toggle on" : "sound-toggle"}
        onClick={toggle}
        aria-pressed={on}
        aria-label={label}
        title={label}
        data-testid="btn--map-sound-toggle"
      >
        {on ? (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
            <path
              d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8 8 0 0 1 0 12"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
            <path
              d="m16 9 5 6M21 9l-5 6"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
    </>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props {
  model: MapModel;
  token: string;
  /** Initial URL param values restored from searchParams by the server page. */
  initialScope: "all" | "epic";
  initialEpic: string;
  initialGroup: "feature" | "persona";
  initialEfilter: "all" | "prog" | "done" | "todo";
  /** CAM-164 dev tool: render a % coordinate grid overlay when true (?grid=1). */
  debugGrid?: boolean;
  /** CAM-372 (S1c): server default from ?r= ("3d" | else "2d"); localStorage (user
   *  choice) wins over this on the client — see the renderer state initializer. */
  initialRenderer: "2d" | "3d";
}

export interface SceneHandle {
  /** S6 hook: walk the agent at `role` to `toNode` (defaults to home station). */
  triggerWalk: (role: string, toNode?: string) => void;
}

export default function StatusMapShell({
  model,
  token,
  initialScope,
  initialEpic,
  initialGroup,
  initialEfilter,
  debugGrid = false,
  initialRenderer,
}: Props) {
  // S6: liveModel is the authoritative data — starts from SSR initial value, updated
  // by the SSE reconcile (extracted to useMapReconcile, CAM-372 S1a). All overlay data
  // reads from liveModel, never from the stale `model` prop directly (which is frozen
  // after first render in the dynamic component).
  const liveModel = useMapReconcile(token, model);
  const { projectPct, gates, agents, epicsActive, totalEpics, backlogItems, envLanes, epics } = liveModel;

  // CAM-372 (S1c): which renderer is mounted — "2d" (CampsiteCanvas, default) or
  // "3d" (Canvas3D, stub today). The whole shell is client-only (dynamic ssr:false
  // via scene-loader.tsx), so it's safe to read localStorage in the lazy initializer;
  // a returning user's own choice wins over the server's ?r= default.
  const [renderer, setRenderer] = useState<"2d" | "3d">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(RENDERER_STORAGE_KEY);
      if (saved === "2d" || saved === "3d") return saved;
    }
    return initialRenderer;
  });

  const handleRendererChange = useCallback((next: "2d" | "3d") => {
    setRenderer(next);
    try {
      localStorage.setItem(RENDERER_STORAGE_KEY, next);
    } catch {
      /* localStorage unavailable — renderer choice just won't persist across visits */
    }
    // Empty string drops the param (2D is the default) — same convention as every
    // other filter param below (scope/epic/group/efilter).
    syncUrl({ r: next === "3d" ? "3d" : "" });
  }, []);

  // S5: scope state — restored from URL params on mount via initial props
  const [scope, setScope]         = useState<"all" | "epic">(() => (initialEpic || readFilterCookie().epic) ? "epic" : initialScope);
  const [activeEpic, setActiveEpic] = useState<string>(() => initialEpic || readFilterCookie().epic || "");
  const [group, setGroup]         = useState<"feature" | "persona">(initialGroup);
  const [efilter, setEfilter]     = useState<"all" | "prog" | "done" | "todo">(() => {
    if (initialEfilter !== "all") return initialEfilter;
    const c = readFilterCookie().efilter;
    return c === "prog" || c === "done" || c === "todo" ? c : "all";
  });
  const [persona, setPersona]     = useState<string>(() => readFilterCookie().persona ?? "");
  const [feature, setFeature]     = useState<string>(() => readFilterCookie().feature ?? "");

  // Cascading filter options (Persona → Feature → Epic), narrowed by the current selection.
  const filterOpts = useMemo(() => {
    const personas = [...new Set(epics.map((e) => e.persona).filter(Boolean))].sort();
    const featPool = persona ? epics.filter((e) => e.persona === persona) : epics;
    const features = [...new Set(featPool.map((e) => e.feature).filter(Boolean))].sort();
    const epicList = featPool
      .filter((e) => !feature || e.feature === feature)
      .map((e) => ({ key: e.key, label: e.label }));
    return { personas, features, epics: epicList };
  }, [epics, persona, feature]);

  const [summaryCollapsed, setSummaryCollapsed] = useState<boolean>(() => readFilterCookie().summaryCollapsed ?? false);
  const [deliveryCollapsed, setDeliveryCollapsed] = useState<boolean>(() => readFilterCookie().deliveryCollapsed ?? false);
  const [approvalCollapsed, setApprovalCollapsed] = useState<boolean>(() => readFilterCookie().approvalCollapsed ?? false);
  const [boardCollapsed, setBoardCollapsed] = useState<boolean>(() => readFilterCookie().boardCollapsed ?? false);
  const [teamCollapsed, setTeamCollapsed] = useState<boolean>(() => readFilterCookie().teamCollapsed ?? false);
  const [envPickerOpen, setEnvPickerOpen] = useState(false);
  const envPickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  // SMUX-3: Bidirectional Map↔Board/Filter sync.
  // Single source of truth: which task (by id) is focused on the board + map.
  // Cleared when the filter is reset to "all" or the board sheet closes.
  const [focusedTaskId, setFocusedTaskId] = useState<string>("");

  // SMUX-2: Responsive sheet state — one-at-a-time (opening one closes the other).
  const [openSheet, setOpenSheet] = useState<"roster" | "board" | null>(null);
  const rosterTabRef = useRef<HTMLButtonElement | null>(null);
  const boardTabRef  = useRef<HTMLButtonElement | null>(null);
  const rosterToolbarRef = useRef<HTMLButtonElement | null>(null);
  const boardToolbarRef  = useRef<HTMLButtonElement | null>(null);
  // CAM-184: GateDetailModal state
  const [gateDetailId, setGateDetailId] = useState<string>("");
  const [gateDetailOpen, setGateDetailOpen] = useState(false);
  const gateDetailTriggerRef = useRef<HTMLElement | null>(null);
  // CAM-286: read-only TicketDetailModal state — for the mobile "Board Sheet" cards below,
  // which used to link straight out to linear.app.
  const [ticketDetailId, setTicketDetailId] = useState<string>("");
  const [ticketDetailOpen, setTicketDetailOpen] = useState(false);
  const ticketDetailTriggerRef = useRef<HTMLElement | null>(null);

  // Summary stats — filtered by the current persona/feature/epic selection.
  const summaryStats = useMemo(() => {
    let filtered = epics;
    if (scope === "epic" && activeEpic) filtered = epics.filter((e) => e.key === activeEpic);
    else if (feature) filtered = epics.filter((e) => e.feature === feature);
    else if (persona) filtered = epics.filter((e) => e.persona === persona);

    const allStories = filtered.flatMap((e) => e.stories);
    const storyDone = allStories.filter((s) => s.statusType === "completed").length;
    const storyTotal = allStories.length;
    const backlog = allStories.filter((s) => s.status === "Backlog").length;
    const epicDone = filtered.filter((e) => e.bucket === "done").length;
    const epicTotal = filtered.length;
    const pct = storyTotal ? Math.round((storyDone / storyTotal) * 100) : projectPct;

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayStories = allStories.filter((s) => s.completedAt?.startsWith(todayStr)).length;
    const todayEpics = filtered.filter(
      (e) => e.bucket === "done" && e.stories.some((s) => s.completedAt?.startsWith(todayStr))
    ).length;

    const sparkline: number[] = Array(7).fill(0);
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    for (const s of allStories) {
      if (!s.completedAt) continue;
      const daysAgo = Math.floor((Date.now() - new Date(s.completedAt).getTime()) / 86400000);
      if (daysAgo >= 0 && daysAgo < 7) sparkline[6 - daysAgo]++;
    }
    const weekStories = sparkline.reduce((a, b) => a + b, 0);
    const weekEpics = filtered.filter(
      (e) => e.stories.some((s) => s.completedAt && new Date(s.completedAt).getTime() >= sevenDaysAgo)
    ).length;

    const statusCounts: Record<string, number> = {};
    for (const s of allStories) {
      const col = boardColumnOf(s);
      statusCounts[col] = (statusCounts[col] ?? 0) + 1;
    }

    return { pct, epicDone, epicTotal, storyDone, storyTotal, backlog, todayStories, todayEpics, weekStories, weekEpics, sparkline, statusCounts };
  }, [epics, persona, feature, scope, activeEpic, projectPct]);

  // CAM-257 (SMUX-6-fix): EnvPipelineCapsule counts scoped to the ACTIVE filter.
  // Selecting a persona/feature/epic makes the capsule reflect THAT set's
  // Dev/Staging/Ship split + % (not the whole-project envLanes); "all" (no filter)
  // falls back to the global numbers. Logic lives in the pure, unit-tested
  // deriveCapsuleStats() helper (lib/status-map-model) so it cannot drift.
  const capsuleStats = useMemo(
    () =>
      deriveCapsuleStats({
        epics,
        scope,
        activeEpic,
        feature,
        persona,
        envLanes,
        projectPct,
        gates,
        backlogItems,
        epicsActive,
        totalEpics,
      }),
    [epics, persona, feature, scope, activeEpic, envLanes, projectPct, gates, epicsActive, totalEpics, backlogItems],
  );

  // CAM-264: the board is always visible. Show ALL work when nothing is filtered; narrow
  // when a Feature/Epic is selected. showBoard now means "is there any work to show" —
  // the board renders whenever there are stories, and a true empty-state shows otherwise.
  const boardStories = useMemo(() => {
    let filtered = epics;
    if (scope === "epic" && activeEpic) filtered = epics.filter((e) => e.key === activeEpic);
    else if (feature) filtered = epics.filter((e) => e.feature === feature);
    return filtered.flatMap((e) => e.stories);
  }, [epics, feature, scope, activeEpic]);
  const showBoard = boardStories.length > 0;

  const boardLabel = useMemo(() => {
    if (scope === "epic" && activeEpic) return epics.find((e) => e.key === activeEpic)?.label ?? activeEpic;
    if (feature) return feature;
    return "ทั้งหมด";
  }, [scope, activeEpic, feature, epics]);

  // One handler for the 3-level filter; choosing a higher level resets the lower ones.
  // SMUX-3: clear focusedTaskId when the filter is reset (empty value = "all").
  const onFilterChange = useCallback((level: "persona" | "feature" | "epic", value: string) => {
    if (level === "persona") { setPersona(value); setFeature(""); setActiveEpic(""); setScope("all"); if (!value) setFocusedTaskId(""); }
    else if (level === "feature") { setFeature(value); setActiveEpic(""); setScope("all"); if (!value) setFocusedTaskId(""); }
    else { setActiveEpic(value); setScope(value ? "epic" : "all"); if (!value) setFocusedTaskId(""); }
  }, []);

  // SMUX-3: Board card → Map. Clicking a card focuses the matching agent(s).
  // Accepts the story id; derives which agents have that task id and focuses them.
  const handleBoardCardActivate = useCallback((storyId: string) => {
    setFocusedTaskId(storyId);
  }, []);

  // SMUX-3: Agent click → Board/Filter. An agent with a task → set filter to task's
  // epic (+feature), open/show the board, highlight the card, focus the agent.
  // An agent without a task → keep existing behavior (open roster).
  const handleAgentActivate = useCallback((agent: MapAgent) => {
    if (!agent.task) {
      // No active task: open the team roster (original behavior).
      setTeamCollapsed(false);
      return;
    }
    // Set filter to the task's epic (and feature when available).
    if (agent.task.feature) {
      setFeature(agent.task.feature);
      setActiveEpic("");
      setScope("all");
    }
    if (agent.task.epicKey) {
      setActiveEpic(agent.task.epicKey);
      setScope("epic");
    }
    // Highlight the specific card + focus this agent.
    setFocusedTaskId(agent.task.id);
    // On mobile: open the board sheet.
    setOpenSheet("board");
    // On desktop: expand the board panel.
    setBoardCollapsed(false);
  }, []);

  // Persist the filter + panel collapse states to a cookie so they are restored on the next visit.
  useEffect(() => {
    writeFilterCookie({ persona, feature, epic: scope === "epic" ? activeEpic : "", efilter, summaryCollapsed, deliveryCollapsed, approvalCollapsed, boardCollapsed, teamCollapsed });
  }, [persona, feature, scope, activeEpic, efilter, summaryCollapsed, deliveryCollapsed, approvalCollapsed, boardCollapsed, teamCollapsed]);

  // CAM-372 (S1b): the renderer's imperative handle + readiness flag. Any renderer
  // (2D CampsiteCanvas today, a pluggable one later) implements RendererHandle and
  // reports readiness via onReadyChange — this shell never reaches into the engine.
  const rendererRef = useRef<RendererHandle | null>(null);
  const [rendererReady, setRendererReady] = useState(false);
  // CAM-372 (S1c fix): a monotonic "ready nonce" — bumped ONLY on ready(true), never
  // on ready(false). A 3D→2D (or 2D→3D) swap is a same-commit round-trip: the old
  // renderer's unmount cleanup fires onReadyChange(false), then the newly-mounted
  // renderer's mount effect fires onReadyChange(true) — React batches both state
  // updates into one flush, so the PLAIN BOOLEAN nets true→false→true = unchanged,
  // and effects keyed only on that boolean never re-run for the new renderer (the
  // freshly-remounted 2D engine then never receives setActivity/setScope — the bug
  // an adversarial review caught). readySeq strictly increases on every real "ready"
  // transition, including a same-commit round-trip, so effects keyed on it always
  // re-fire for the newly-mounted renderer regardless of how the boolean netted out.
  const [readySeq, setReadySeq] = useState(0);
  const handleRendererReady = useCallback((ready: boolean) => {
    setRendererReady(ready);
    if (ready) setReadySeq((n) => n + 1);
  }, []);

  // CAM-176 — stable activity signature: encode only the fields that actually drive
  // wander/rest (role, active flag, activeCount). A reconcile that changes unrelated
  // fields (gate count, title, backlog) produces a new `agents` array ref but an
  // IDENTICAL activeKey → the effect below does NOT re-run → no mid-walk disruption.
  // A genuine activity change (agent starts/stops work) changes the key → effect fires
  // → setActivity is called exactly once → intended behaviour preserved.
  const activeKey = useMemo(
    () => agents.map((a) => `${a.role}:${a.active ? 1 : 0}:${a.activeCount}`).join("|"),
    [agents],
  );

  // Drive wander/rest from live data: active roles wander, idle roles rest.
  // Runs once the renderer is ready and again whenever an agent's activity changes.
  // Dep is `activeKey` (stable string) not `agents` (new ref on every reconcile) so a
  // data update that does not change activity does NOT interrupt a walking character.
  // Dev aid: ?wander=1 forces everyone to wander (the wander behaviour is otherwise
  // hard to see when the live data has no active work).
  // CAM-372 (S1b): hoisted from campsite-scene's engine-owning body — this is the
  // renderer-agnostic bridge; `rendererRef` replaces `engineRef`, `rendererReady`
  // replaces the old local `engineReady` state (now crossed via onReadyChange).
  // CAM-372 (S1c fix): dep is `readySeq` (not the plain `rendererReady` boolean) so
  // a same-commit renderer swap (old ready(false) + new ready(true) batched in one
  // flush) still re-fires this effect for the newly-mounted renderer — see the
  // readySeq comment above. The `if (!rendererReady) return` gate is unchanged.
  useEffect(() => {
    if (!rendererReady) return;
    const forceWander =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("wander") === "1";
    const activeByRole: Record<string, boolean> = {};
    for (const a of agents) activeByRole[a.role] = forceWander || a.active;
    rendererRef.current?.setActivity(activeByRole);
  }, [readySeq, activeKey]); // activeKey, not agents — guards mid-walk resets (CAM-176)

  // S5 + S7: sync renderer scope + URL params when scope/epic/group/efilter state changes,
  // OR when the renderer first becomes ready (deep-link fix: ?scope=epic&epic=X applied on
  // the first frame after the renderer has started, not lost during the startup gap).
  // CAM-372 (S1b): stays FUSED with syncUrl (same effect) and gated on `rendererReady` —
  // today syncUrl sits after `if (!engine) return`, so it is skipped under reduced motion;
  // gating on `rendererReady` preserves that exact behaviour (the renderer never reports
  // ready under reduced motion, since its internal rAF loop never starts).
  useEffect(() => {
    if (!rendererReady) return;

    if (scope === "epic" && activeEpic) {
      // Determine which roles appear in the active epic's stories.
      // CAM-159 Epic bug fix: if roles resolves to empty (no [role] tags on stories),
      // fall back to "all" scope so the scene is never entirely dimmed/blank.
      const epicData = epics.find((e) => e.key === activeEpic);
      const roles = epicData
        ? [...new Set(epicData.stories.map((s) => s.role).filter(Boolean))]
        : [];
      if (roles.length > 0) {
        rendererRef.current?.setScope("epic", roles);
      } else {
        // Empty roles = unresolved; keep all agents gently visible (fall back to all).
        rendererRef.current?.setScope("all", []);
      }
    } else {
      rendererRef.current?.setScope("all", []);
    }

    // Persist URL state — compatible with /status param semantics for S6 deep-link.
    syncUrl({
      scope,
      epic:    scope === "epic" ? activeEpic : "",
      group,
      efilter: efilter !== "all" ? efilter : "",
    });
  // S7 fix: include rendererReady so this effect re-runs when the renderer starts,
  // ensuring ?scope=epic deep-link is applied even when it starts after this effect.
  // CAM-372 (S1c fix): ALSO include readySeq — on a same-commit renderer swap the
  // plain `rendererReady` boolean can net unchanged (true→false→true in one React
  // batch), which would silently skip re-applying setScope to the newly-mounted
  // renderer. readySeq strictly increases on every real ready(true), so it always
  // re-fires this effect for the new renderer even when the boolean nets the same.
  }, [scope, activeEpic, group, efilter, epics, rendererReady, readySeq]);

  const handleSelectEpic = useCallback((epicKey: string) => {
    setActiveEpic(epicKey);
    setScope("epic");
  }, []);

  const handleBackToOverview = useCallback(() => {
    setScope("all");
    setActiveEpic("");
  }, []);

  // Derive the active epic data for Epic overlays.
  // CAM-159 Epic bug fix: deep-link ?epic= may pass a key that isn't yet in epics
  // (e.g. race on first load). Fall back gracefully to null so the scene renders
  // and shows an empty state rather than a broken view.
  const activeEpicData = (activeEpic ? (epics.find((e) => e.key === activeEpic) ?? null) : null);

  // S6: Dashboard|Map toggle — build the dashboard URL from current map state,
  // mapping scope=all|epic ↔ tab=overview|epic; epic/group/efilter/token carry identically.
  const dashboardHref = (() => {
    const u = new URLSearchParams();
    u.set("tab", scope === "epic" ? "epic" : "overview");
    if (activeEpic) u.set("epic", activeEpic);
    if (group !== "feature") u.set("group", group);
    if (efilter !== "all") u.set("efilter", efilter);
    if (token) u.set("token", token);
    return `/status?${u.toString()}`;
  })();

  // CAM-372 (S1c): identical props for BOTH renderers — computed once so the 2D/3D
  // branches below cannot drift from each other. `ref`/`onReadyChange` are added
  // per-branch (ref cannot be spread from a plain object; onReadyChange is the same
  // setter either way but keeping it explicit at the call site reads clearer).
  const sharedRendererProps = {
    agents,
    gates,
    epics,
    projectPct,
    activeEpic,
    focusedTaskId,
    onAgentActivate: handleAgentActivate,
    onOpenGates: () => setApprovalCollapsed(false),
    onOpenFirstGate: () => {
      if (gates.length > 0) {
        setGateDetailId(gates[0].id);
        gateDetailTriggerRef.current = document.querySelector('[data-testid="btn--map-you-alert"]');
        setGateDetailOpen(true);
      }
    },
    debugGrid,
  };

  return (
    <div className="map-wrap" data-testid="scene--status-map-campsite">
      <style dangerouslySetInnerHTML={{ __html: HUD_CSS }} />

      {/* CAM-372 (S1b/S1c): the single renderer child — CampsiteCanvas (2D, default)
          or Canvas3D (stub today, real scene in S2). The shell (this component,
          incl. useMapReconcile's SSE loop) stays mounted across the swap; only the
          renderer child unmounts/remounts, so the reconcile loop never re-subscribes.
          onReadyChange={handleRendererReady} (not the raw setRendererReady) — see the
          readySeq comment above the state declaration for why the plain boolean alone
          is not enough to re-gate the activity/scope effects on a same-commit swap.
          Canvas3D is React.lazy — wrapped in its own <Suspense>. CAM-374: the
          fallback is <MapProgress/> (not null) per .claude/rules/loading.md — a
          full-screen canvas module uses a progress indicator, never a blank gap,
          while the `three` chunk downloads. The shell's HUD chrome (topbar/panels,
          incl. the 2D/3D toggle) renders above MapProgress's zIndex:10 (HUD is
          22/23), so the user can still switch back to 2D mid-load; see the
          ref-forwarding note above the Canvas3D declaration for why NOT next/dynamic. */}
      {renderer === "3d" ? (
        <Suspense fallback={<MapProgress />}>
          <Canvas3D ref={rendererRef} {...sharedRendererProps} onReadyChange={handleRendererReady} />
        </Suspense>
      ) : (
        <CampsiteCanvas ref={rendererRef} {...sharedRendererProps} onReadyChange={handleRendererReady} />
      )}

      {/* Top bar — logo (left) · view switch + sound (right). Fixed, outside .map-viewport. */}
      <div className="hud-topbar">
        <div className="hud-topbar-logo" aria-hidden="true" dangerouslySetInnerHTML={{ __html: LOGO }} />
        {/* Desktop: 3-filter signposts. Hidden on tablet/mobile via .hud-signposts-desktop CSS. */}
        <span className="hud-signposts-desktop">
          <FilterSignposts
            personas={filterOpts.personas}
            features={filterOpts.features}
            epics={filterOpts.epics}
            persona={persona}
            feature={feature}
            epic={scope === "epic" ? activeEpic : ""}
            onChange={onFilterChange}
          />
        </span>
        <div className="hud-topbar-spacer" />
        <div className="hud-topbar-right">
          {/* Desktop: full-text env toggle + ViewToggle + the 2D/3D renderer toggle
              (CAM-372 S1c) — distinct from ViewToggle: that navigates to the
              dashboard, this switches the renderer in-place, no navigation. */}
          <RendererToggle renderer={renderer} onChange={handleRendererChange} />
          <ViewToggle dashboardHref={dashboardHref} />
          <button
            ref={envPickerTriggerRef}
            className="hud-env-toggle"
            aria-label="ผลผลิต Scout Team — เปิดใน Staging / Production"
            data-testid="btn--map-env-picker"
            onClick={() => setEnvPickerOpen(v => !v)}
          >
            ผลผลิต Scout Team
          </button>
          <EnvPickerPanel
            isOpen={envPickerOpen}
            onClose={() => setEnvPickerOpen(false)}
            triggerRef={envPickerTriggerRef}
          />
          <SoundToggle />

          {/* SMUX-6: Tablet/mobile icon-only buttons (hidden on desktop ≥1024 via CSS) */}
          <div className="hud-topbar-icons" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Dashboard link — icon only */}
            <a
              href={dashboardHref}
              className="hud-icon-btn"
              aria-label="ดูผลงานทั้งหมด"
              data-testid="link--map-icon-dashboard"
            >
              <LayoutDashboard size={20} aria-hidden="true" />
            </a>
            {/* Env/productivity toggle — icon only */}
            <button
              type="button"
              className={`hud-icon-btn${envPickerOpen ? " active" : ""}`}
              aria-label="ผลผลิต Scout Team"
              aria-pressed={envPickerOpen}
              data-testid="btn--map-icon-env"
              onClick={() => setEnvPickerOpen(v => !v)}
            >
              <Gauge size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* SMUX-6 · CAM-258: Bottom filter row — tablet + mobile (<1024px).
          The SAME FilterSignposts chip (layout="bottom"): equal columns that
          fill the frame width with drop-up menus, positioned above the mobile
          toolbar. One filter implementation — no parallel mobile component. */}
      <FilterSignposts
        layout="bottom"
        personas={filterOpts.personas}
        features={filterOpts.features}
        epics={filterOpts.epics}
        persona={persona}
        feature={feature}
        epic={scope === "epic" ? activeEpic : ""}
        onChange={onFilterChange}
      />

      {/* SMUX-2: Tablet edge drawer tabs — visible on 640–1023px only (CSS hides on mobile/desktop). */}
      <button
        ref={rosterTabRef}
        type="button"
        className="hud-edge-tab left"
        aria-label="เปิด Roster"
        aria-haspopup="dialog"
        aria-expanded={openSheet === "roster"}
        aria-controls="sheet-roster"
        data-testid="btn--map-edge-roster"
        onClick={() => setOpenSheet(openSheet === "roster" ? null : "roster")}
      >
        ≡ Roster
      </button>
      <button
        ref={boardTabRef}
        type="button"
        className="hud-edge-tab right"
        aria-label="เปิด Board"
        aria-haspopup="dialog"
        aria-expanded={openSheet === "board"}
        aria-controls="sheet-board"
        data-testid="btn--map-edge-board"
        onClick={() => setOpenSheet(openSheet === "board" ? null : "board")}
      >
        Board ▸
      </button>

      {/* SMUX-2/SMUX-6: Mobile bottom toolbar — visible on <640px only (CSS hides on tablet/desktop).
          SMUX-6: transparent bar; chips keep their own glass fill; center = EnvPipelineCapsule. */}
      <div className="hud-map-toolbar" role="toolbar" aria-label="เมนูหลัก" data-testid="toolbar--map-mobile">
        <button
          ref={rosterToolbarRef}
          type="button"
          className="hud-toolbar-btn"
          aria-label="เปิดรายชื่อทีม"
          aria-haspopup="dialog"
          aria-expanded={openSheet === "roster"}
          aria-controls="sheet-roster"
          data-testid="btn--map-toolbar-roster"
          onClick={() => setOpenSheet(openSheet === "roster" ? null : "roster")}
        >
          <Users size={16} aria-hidden="true" />
          <span className="hud-toolbar-btn-label">ทีม</span>
        </button>

        {/* SMUX-6 / CAM-257: Env Pipeline Capsule — counts scoped to the active filter
            (capsuleStats); "all" falls back to global project numbers. */}
        <EnvPipelineCapsule
          devCount={capsuleStats.devCount}
          stagingCount={capsuleStats.stagingCount}
          shipCount={capsuleStats.shipCount}
          pct={capsuleStats.pct}
          gatesCount={capsuleStats.gatesCount}
          epicsActiveCount={capsuleStats.epicsActiveCount}
          epicsTotalCount={capsuleStats.epicsTotalCount}
          backlogCount={capsuleStats.backlogCount}
        />

        <button
          ref={boardToolbarRef}
          type="button"
          className="hud-toolbar-btn"
          aria-label="เปิด Board"
          aria-haspopup="dialog"
          aria-expanded={openSheet === "board"}
          aria-controls="sheet-board"
          data-testid="btn--map-toolbar-board"
          onClick={() => setOpenSheet(openSheet === "board" ? null : "board")}
        >
          <LayoutGrid size={16} aria-hidden="true" />
          <span className="hud-toolbar-btn-label">Board</span>
        </button>
      </div>

      {/* SMUX-2: Roster Sheet — side="left" on tablet, side="bottom" on mobile.
          One Sheet, one-at-a-time open state. shadcn Sheet handles focus-trap + Esc + return-focus. */}
      <Sheet open={openSheet === "roster"} onOpenChange={(v) => setOpenSheet(v ? "roster" : null)}>
        <SheetContent
          id="sheet-roster"
          side="left"
          showCloseButton={false}
          className="w-[280px] sm:w-[320px] border-r-0 rounded-r-3xl p-0 overflow-y-auto"
          style={{
            background: "rgba(11,30,24,.88)",
            borderRight: "1px solid rgba(150,240,195,.18)",
          }}
          data-testid="sheet--map-roster"
        >
          <div role="status" aria-live="polite" className="sr-only">กำลังโหลด…</div>
          <SheetHeader className="px-5 pt-5 pb-3 flex flex-row items-center justify-between">
            <SheetTitle style={{ color: "#F1F6FB", fontFamily: "'Outfit','Anuphan',system-ui,sans-serif" }}>
              ทีมงาน
            </SheetTitle>
            <SheetClose
              className="h-11 w-11 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)", color: "rgba(223,234,245,.7)" }}
              aria-label="ปิด"
              data-testid="btn--sheet-roster-close"
            >
              <X size={16} aria-hidden="true" />
            </SheetClose>
          </SheetHeader>
          <div className="px-5 pb-5">
            {agents.length === 0 ? (
              <div style={{ textAlign: "center", color: "rgba(223,234,245,.35)", fontSize: 13, padding: "24px 0" }}>
                ยังไม่มีข้อมูลทีม
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {agents.map((agent) => {
                  const cfg = ROLE_DISPLAY[agent.role];
                  if (!cfg) return null;
                  return (
                    <div
                      key={agent.role}
                      className={`hud-role-row ${agent.active ? "active" : "sleep"}`}
                      style={{ minHeight: 44 }}
                    >
                      <span className={`hud-role-dot ${agent.active ? "active" : "sleep"}`} aria-hidden="true" />
                      <span className="hud-role-label">{cfg.displayName}</span>
                      <span className={`hud-role-badge ${agent.active ? "active" : "sleep"}`}>
                        {agent.active ? "กำลังทำ" : "ว่าง"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* SMUX-2: Board Sheet — side="right" on tablet, side="bottom" on mobile.
          Shows existing StatusBoard content.
          SMUX-3: closing the board sheet clears the focused card highlight. */}
      <Sheet open={openSheet === "board"} onOpenChange={(v) => { setOpenSheet(v ? "board" : null); if (!v) setFocusedTaskId(""); }}>
        <SheetContent
          id="sheet-board"
          side="right"
          showCloseButton={false}
          className="w-[300px] sm:w-[360px] border-l-0 rounded-l-3xl p-0 overflow-y-auto"
          style={{
            background: "rgba(11,30,24,.88)",
            borderLeft: "1px solid rgba(150,240,195,.18)",
          }}
          data-testid="sheet--map-board"
        >
          <div role="status" aria-live="polite" className="sr-only">กำลังโหลด…</div>
          <SheetHeader className="px-5 pt-5 pb-3 flex flex-row items-center justify-between">
            <SheetTitle style={{ color: "#F1F6FB", fontFamily: "'Outfit','Anuphan',system-ui,sans-serif" }}>
              Board
            </SheetTitle>
            <SheetClose
              className="h-11 w-11 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)", color: "rgba(223,234,245,.7)" }}
              aria-label="ปิด"
              data-testid="btn--sheet-board-close"
            >
              <X size={16} aria-hidden="true" />
            </SheetClose>
          </SheetHeader>
          <div className="px-5 pb-5">
            {!showBoard ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <Layers size={28} style={{ color: "rgba(91,233,176,.4)", margin: "0 auto 10px" }} aria-hidden="true" />
                <p style={{ color: "rgba(223,234,245,.35)", fontSize: 13 }}>
                  ยังไม่มีงานในบอร์ด
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ fontSize: 11, color: "rgba(223,234,245,.45)", marginBottom: 4 }}>{boardLabel}</p>
                {boardStories.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`hud-kc${focusedTaskId === s.id ? " smux3-focused" : ""}`}
                    style={{ display: "block" }}
                    aria-label={`ดูรายละเอียด ${s.id}`}
                    data-testid={`card--sheet-board-${s.id}`}
                    onClick={(e) => {
                      handleBoardCardActivate(s.id);
                      ticketDetailTriggerRef.current = e.currentTarget;
                      setTicketDetailId(s.id);
                      setTicketDetailOpen(true);
                    }}
                  >
                    <div className="hud-kt">
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: "rgba(223,234,245,.88)" }}>
                        {s.title}
                      </span>
                    </div>
                    <div className="hud-kb" style={{ marginTop: 5 }}>
                      <span className="hud-kr" style={{ fontSize: 10 }}>{s.role}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Left panel stack — summary · delivery · approval */}
      <div className="hud-left-panels">
        <SummaryCard
          pct={summaryStats.pct}
          epicDone={summaryStats.epicDone}
          epicTotal={summaryStats.epicTotal}
          storyDone={summaryStats.storyDone}
          storyTotal={summaryStats.storyTotal}
          backlog={summaryStats.backlog}
          statusCounts={summaryStats.statusCounts}
          collapsed={summaryCollapsed}
          onToggle={() => setSummaryCollapsed((v) => !v)}
        />
        <DeliveryCard
          todayEpics={summaryStats.todayEpics}
          todayStories={summaryStats.todayStories}
          weekEpics={summaryStats.weekEpics}
          weekStories={summaryStats.weekStories}
          sparkline={summaryStats.sparkline}
          epicDone={summaryStats.epicDone}
          epicTotal={summaryStats.epicTotal}
          storyDone={summaryStats.storyDone}
          storyTotal={summaryStats.storyTotal}
          collapsed={deliveryCollapsed}
          onToggle={() => setDeliveryCollapsed((v) => !v)}
        />
        {gates.length > 0 && (
          <ApprovalCard
            gates={gates}
            collapsed={approvalCollapsed}
            onToggle={() => setApprovalCollapsed((v) => !v)}
            onOpen={() => setApprovalCollapsed(false)}
            token={token}
            onOpenDetail={(id) => {
              setGateDetailId(id);
              setGateDetailOpen(true);
            }}
          />
        )}
        <TeamRoster
          agents={agents}
          collapsed={teamCollapsed}
          onToggle={() => setTeamCollapsed((v) => !v)}
        />
      </div>

      {/* Right panel — status board */}
      <div className="hud-right-panels">
        {showBoard ? (
          <StatusBoard
            stories={boardStories}
            label={boardLabel}
            focusedTaskId={focusedTaskId}
            onCardActivate={handleBoardCardActivate}
            pct={summaryStats.pct}
            collapsed={boardCollapsed}
            onToggle={() => setBoardCollapsed((v) => !v)}
            token={token}
          />
        ) : (
          <StatusBoardHint />
        )}
      </div>

      {/* CAM-184: Gate detail modal — portal, rendered at root of scene */}
      {gateDetailOpen && gateDetailId && (
        <GateDetailModal
          gateId={gateDetailId}
          gateUrl={gates.find((g) => g.id === gateDetailId)?.url ?? ""}
          token={token}
          triggerRef={gateDetailTriggerRef}
          isOpen={gateDetailOpen}
          onClose={() => setGateDetailOpen(false)}
          onApproved={() => {
            setGateDetailOpen(false);
          }}
        />
      )}

      {/* CAM-286: read-only ticket detail modal for the mobile "Board Sheet" cards */}
      {ticketDetailOpen && ticketDetailId && (
        <TicketDetailModal
          ticketId={ticketDetailId}
          token={token}
          triggerRef={ticketDetailTriggerRef}
          isOpen={ticketDetailOpen}
          onClose={() => setTicketDetailOpen(false)}
        />
      )}

    </div>
  );
}
