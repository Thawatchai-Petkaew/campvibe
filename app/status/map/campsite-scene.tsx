"use client";

// S3 — Hybrid motion model:
//   entering → agents walk from arm-tip entry point to home station on first mount
//   idle     → in-place breathe/sway via CSS (transform/opacity only, no rAF state)
//   walking  → path traversal on triggerWalk() — hook ready for S6, not called from data yet
//
// Reduced-motion: if prefers-reduced-motion:reduce → rAF loop never starts; all agents
// render static at their home station (S2 behaviour). The media-query listener
// starts/stops the loop if the OS setting changes without a page reload.
//
// DOM writes: only style.transform / style.backgroundImage / style.left / style.top /
// style.zIndex on refs. No per-frame React setState. Effect cleanup cancels rAF.

import { useEffect, useRef } from "react";
import {
  NODES,
  buildScoutState,
  startEngine,
  type EngineHandle,
  type ScoutRef,
} from "./campsite-engine";

export interface MapAgent {
  role: string;         // canonical role key, e.g. "frontend-engineer"
  name: string;         // display name (Thai-friendly short name)
  active: boolean;      // rmap[role].active > 0
  done: number;
  activeCount: number;
  queued: number;       // total - done - active (stories not yet started)
  task: { id: string; title: string; startedAt: string | null } | null;
}

export interface MapModel {
  projectPct: number;
  gates: { id: string; title: string; url: string }[];
  agents: MapAgent[];  // the 7 build-roles, always present
  epicNames: string[];
}

// Canonical role display config — mirrors the mockup AGENTS array.
const ROLE_CONFIG: Record<
  string,
  { node: string; color: string; poseIdx: number; displayName: string; roleLabel: string }
> = {
  "architect":          { node: "N",  color: "#8FB8F0", poseIdx: 0, displayName: "Architect",  roleLabel: "วางแผนระบบ" },
  "ux-designer":        { node: "NE", color: "#B7A6FF", poseIdx: 1, displayName: "Designer",   roleLabel: "UX และวิชวล" },
  "backend-engineer":   { node: "E",  color: "#5BE9B0", poseIdx: 2, displayName: "Backend",    roleLabel: "API และบริการ" },
  "frontend-engineer":  { node: "SE", color: "#5FD0DE", poseIdx: 3, displayName: "Frontend",   roleLabel: "หน้าแอป" },
  "devops-release":     { node: "SW", color: "#BFE85B", poseIdx: 4, displayName: "DevOps",     roleLabel: "CI/CD" },
  "qa-engineer":        { node: "W",  color: "#F39FD2", poseIdx: 5, displayName: "QA",         roleLabel: "ทดสอบและตรวจสอบ" },
  "security-reviewer":  { node: "NW", color: "#FF8A7A", poseIdx: 0, displayName: "Security",   roleLabel: "ความปลอดภัย" },
};

// Speed variation per role index — slight spread so agents don't arrive in a clump.
const SPEED_VAR = [0.95, 1.05, 1.00, 1.10, 0.90, 1.08, 0.92];

// YOU is stationary — near bridge, per mockup.
const YOU_POS = { x: 33, y: 28 };

// Hex color → rgba helper
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ── Scene CSS ────────────────────────────────────────────────────────────────
// Idle-sway is always-on ambient; walking-mode overrides it during traversal.
// All animations are wrapped in @media (prefers-reduced-motion: no-preference)
// so the OS setting kills everything at once. The rAF loop is separately gated.
const SCENE_CSS = `
:root {
  --scout-size: clamp(88px, 7.2vw, 116px);
  --amber: #FFB454;
  --amber-glow: rgba(255,150,52,.6);
  --text: #F1F6FB;
  --muted: rgba(223,234,245,.66);
  --faint: rgba(223,234,245,.42);
  --line: rgba(255,255,255,.13);
  --line-2: rgba(255,255,255,.18);
  --hi: rgba(255,255,255,.16);
  --glass: rgba(16,26,42,.42);
  --blur: saturate(150%) blur(20px);
  --mono: 'JetBrains Mono','Fira Mono','Consolas',monospace;
}
.map-wrap{position:relative;z-index:5;min-height:100vh;width:100%;overflow:hidden}
.map-stage{position:relative;width:100%;height:100vh;min-height:600px}
.scout-layer{position:absolute;inset:0;z-index:30}
.scout{position:absolute;--bh:calc(var(--scout-size)*0.9);transform:translate(-50%,-100%)}
.scout .glow{
  position:absolute;left:50%;bottom:5%;transform:translateX(-50%);
  width:calc(var(--scout-size)*0.95);height:calc(var(--scout-size)*1.02);
  border-radius:50%;background:radial-gradient(ellipse at center 60%,var(--aura),transparent 66%);
  opacity:0;filter:blur(8px);z-index:0;pointer-events:none;transition:opacity .4s
}
.scout.working .glow{opacity:.2}
.scout .aura-ring{
  position:absolute;left:50%;bottom:0;transform:translate(-50%,30%);
  width:calc(var(--scout-size)*0.74);height:calc(var(--scout-size)*0.3);
  border-radius:50%;background:radial-gradient(ellipse at center,var(--aura),transparent 70%);
  opacity:0;filter:blur(4px);z-index:1;pointer-events:none;transition:opacity .4s
}
.scout.working .aura-ring{opacity:.58}
.scout.you .aura-ring{opacity:.5}
.scout .shadow{
  position:absolute;left:50%;bottom:0;transform:translate(-50%,34%);
  width:calc(var(--scout-size)*0.5);height:calc(var(--scout-size)*0.12);
  border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,.5),transparent 72%);
  filter:blur(2px);z-index:2;pointer-events:none
}
.scout .body{
  position:absolute;left:50%;bottom:0;
  width:calc(var(--scout-size)*0.6204);height:var(--scout-size);
  background-size:contain;background-repeat:no-repeat;background-position:bottom center;
  z-index:3;transform:translateX(-50%);filter:drop-shadow(0 5px 4px rgba(0,0,0,.32))
}
@media (prefers-reduced-motion: no-preference) {
  .scout.working .aura-ring{animation:auraPulse 2.4s ease-in-out infinite}
  .scout.idle .body{animation:breathe 3.5s ease-in-out infinite}
  .scout.walking-mode .body{animation:none}
  .scout.entering .body{animation:none}
  @keyframes auraPulse{0%,100%{opacity:.38;transform:translate(-50%,30%) scale(1)}50%{opacity:.6;transform:translate(-50%,30%) scale(1.09)}}
  @keyframes breathe{0%,100%{transform:translateX(-50%) translateY(0) scale(1)}50%{transform:translateX(-50%) translateY(-1px) scale(1.014)}}
  @keyframes pdot2{0%,100%{box-shadow:0 0 4px 0 var(--aura);opacity:1}50%{box-shadow:0 0 9px 2px var(--aura);opacity:.7}}
  @keyframes badgeGlow{0%,100%{box-shadow:0 6px 16px rgba(0,0,0,.32),0 0 5px 0 var(--auraGlow)}50%{box-shadow:0 6px 16px rgba(0,0,0,.32),0 0 13px 2px var(--auraGlow)}}
  @keyframes alertPulse{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-3px)}}
  @keyframes pdot3{0%{box-shadow:0 0 0 0 rgba(122,59,0,.6)}70%{box-shadow:0 0 0 5px transparent}100%{box-shadow:0 0 0 0 transparent}}
  .scout.working .badge{animation:badgeGlow 1.3s ease-in-out infinite}
  .scout.working .badge .bdot{animation:pdot2 1.6s ease-in-out infinite}
  .you-alert{animation:alertPulse 1.9s ease-in-out infinite}
  .you-alert .adot{animation:pdot3 1.3s infinite}
}
.badge{
  position:absolute;left:50%;bottom:calc(var(--bh) + 4px);transform:translateX(-50%);
  display:inline-flex;align-items:center;gap:6px;white-space:nowrap;z-index:7;
  background:rgba(18,30,48,.46);backdrop-filter:saturate(165%) blur(18px);-webkit-backdrop-filter:saturate(165%) blur(18px);
  border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:4px 9px;
  box-shadow:0 6px 16px rgba(0,0,0,.32)
}
.badge .bdot{width:7px;height:7px;border-radius:50%;flex:none;background:rgba(190,202,218,.4)}
.scout.working .badge .bdot{background:var(--aura);box-shadow:0 0 7px var(--aura)}
.scout.you .badge .bdot{background:var(--amber);box-shadow:0 0 7px var(--amber)}
.badge .bname{font-size:10.5px;font-weight:600;color:var(--text)}
.scout.idle .badge .bname{color:var(--muted)}
.scout.you .badge .bname{color:var(--text)}
.badge .bstat{font-family:var(--mono);font-size:9px;font-weight:600;color:var(--muted);padding-left:6px;border-left:1px solid var(--line)}
.scout.idle .badge .bstat{color:var(--faint)}
.scout.working .badge{border-color:var(--aura)}
.you-alert{
  position:absolute;left:50%;bottom:calc(var(--bh) + 38px);transform:translateX(-50%);
  display:inline-flex;align-items:center;gap:6px;white-space:nowrap;z-index:9;cursor:pointer;
  font-size:11px;font-weight:700;color:#241402;
  background:linear-gradient(180deg,#ffcf86,#ff9d3c);border:1px solid rgba(255,207,134,.7);
  border-radius:11px;padding:5px 11px;box-shadow:0 8px 22px -3px var(--amber-glow)
}
.you-alert .adot{width:7px;height:7px;border-radius:50%;background:#7a3b00;flex:none}
.you-alert::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:#ff9d3c}
.popover{
  position:absolute;left:50%;bottom:calc(var(--bh) + 38px);transform:translateX(-50%) translateY(6px);
  width:194px;opacity:0;pointer-events:none;transition:opacity .16s,transform .16s;z-index:12;
  background:rgba(14,24,40,.9);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  border:1px solid var(--line-2);border-radius:13px;padding:11px 12px;
  box-shadow:0 16px 40px rgba(0,0,0,.46)
}
.scout:hover .popover,.scout:focus-visible .popover{opacity:1;transform:translateX(-50%) translateY(0)}
.pop-name{font-weight:600;font-size:13px}
.pop-role{
  display:inline-block;font-family:var(--mono);font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;
  padding:2px 8px;border-radius:999px;margin-top:6px;border:1px solid var(--line)
}
.pop-task{font-size:11.5px;color:var(--muted);margin-top:8px;line-height:1.4}
.pop-task .pid{font-family:var(--mono);color:var(--text)}
.pop-gate{display:flex;gap:7px;font-size:11.5px;color:var(--muted);margin-top:7px;line-height:1.35}
.pop-gate .gid{font-family:var(--mono);color:var(--amber);flex:none}
.pop-hint{font-size:10px;color:var(--faint);margin-top:9px;border-top:1px solid var(--line);padding-top:8px}
.popover::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);border:7px solid transparent;border-top-color:rgba(14,24,40,.9)}
.map-stat-bar{
  position:absolute;top:16px;left:50%;transform:translateX(-50%);z-index:40;
  display:flex;align-items:center;gap:12px;white-space:nowrap;
  background:rgba(18,30,48,.56);backdrop-filter:saturate(150%) blur(18px);-webkit-backdrop-filter:saturate(150%) blur(18px);
  border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:7px 18px;
  box-shadow:0 8px 24px rgba(0,0,0,.36)
}
.stat-pct{font-family:var(--mono);font-size:13px;font-weight:700;color:#5BE9B0}
.stat-sep{width:1px;height:14px;background:rgba(255,255,255,.16)}
.stat-label{font-size:11px;color:var(--muted)}
`;

// ── Sub-components ───────────────────────────────────────────────────────────

interface AgentScoutProps {
  agent: MapAgent;
  bodyRef: (el: HTMLElement | null) => void;
  rootRef: (el: HTMLElement | null) => void;
  /** Inline position used as static fallback (reduced-motion / pre-engine) */
  staticLeft: string;
  staticTop:  string;
  staticZ:    number;
}

function AgentScout({
  agent, bodyRef, rootRef, staticLeft, staticTop, staticZ,
}: AgentScoutProps) {
  const cfg = ROLE_CONFIG[agent.role];
  if (!cfg) return null;

  const stateClass = agent.active ? "working" : "idle";
  const relaxSrc   = `/status-map/sprites/relax-${cfg.poseIdx}.webp`;

  const bstatText = agent.active && agent.task
    ? agent.task.id
    : "พัก";

  const cleanTitle = agent.task
    ? agent.task.title
        .replace(/^[^·]*·\s*/, "")
        .replace(/\[[a-z-]+\]\s*/g, "")
        .trim()
    : "";

  return (
    <div
      ref={rootRef}
      className={`scout ${stateClass}`}
      style={{
        left: staticLeft,
        top:  staticTop,
        zIndex: staticZ,
        ["--aura" as string]:     cfg.color,
        ["--auraGlow" as string]: hexA(cfg.color, 0.7),
      }}
      role="listitem"
      aria-label={`${cfg.displayName}: ${agent.active ? `กำลังทำ ${bstatText}` : "พัก"}`}
      tabIndex={0}
    >
      <div className="glow" aria-hidden="true" />
      <div className="aura-ring" aria-hidden="true" />
      <div className="shadow" aria-hidden="true" />
      <div
        ref={bodyRef}
        className="body"
        style={{ backgroundImage: `url("${relaxSrc}")` }}
        aria-hidden="true"
      />
      <div className="badge">
        <span className="bdot" aria-hidden="true" />
        <span className="bname">{cfg.displayName}</span>
        <span className="bstat">{bstatText}</span>
      </div>

      <div className="popover" role="tooltip">
        <div className="pop-name">{cfg.displayName}</div>
        <div
          className="pop-role"
          style={{
            color:       cfg.color,
            borderColor: hexA(cfg.color, 0.4),
            background:  hexA(cfg.color, 0.12),
          }}
        >
          {cfg.roleLabel}
        </div>
        {agent.active && agent.task ? (
          <div className="pop-task">
            <span className="pid">{agent.task.id}</span>{" "}
            {cleanTitle && `· ${cleanTitle}`}
          </div>
        ) : (
          <div className="pop-task" style={{ color: "var(--faint)" }}>
            ว่างอยู่ รอ task ใหม่
          </div>
        )}
        <div className="pop-hint">
          {agent.done} เสร็จแล้ว · {agent.activeCount} กำลังทำ · {agent.queued} รอคิว
        </div>
      </div>
    </div>
  );
}

interface YouScoutProps {
  gates: { id: string; title: string; url: string }[];
}

function YouScout({ gates }: YouScoutProps) {
  const zIndex = Math.round(YOU_POS.y * 12) + 5;
  const hasGates = gates.length > 0;

  return (
    <div
      className="scout you idle"
      style={{
        left:   `${YOU_POS.x}%`,
        top:    `${YOU_POS.y}%`,
        zIndex,
        ["--aura" as string]:     "#FFB454",
        ["--auraGlow" as string]: "rgba(255,150,52,.7)",
      }}
      role="listitem"
      aria-label={hasGates ? `คุณ: มี ${gates.length} gate รอตรวจสอบ` : "คุณ: ไม่มี gate รอ"}
      tabIndex={0}
    >
      <div className="glow" aria-hidden="true" />
      <div className="aura-ring" aria-hidden="true" />
      <div className="shadow" aria-hidden="true" />
      <div
        className="body"
        style={{ backgroundImage: `url("/status-map/sprites/you.webp")` }}
        aria-hidden="true"
      />
      <div className="badge">
        <span className="bdot" aria-hidden="true" />
        <span className="bname">คุณ</span>
        <span className="bstat">{hasGates ? `${gates.length} gate` : "ปกติ"}</span>
      </div>

      {hasGates && (
        <div
          className="you-alert"
          role="alert"
          aria-label={`${gates.length} gate รอการอนุมัติ`}
        >
          <span className="adot" aria-hidden="true" />
          <span>&#9873;{gates.length} รอตรวจสอบ</span>
        </div>
      )}

      <div className="popover" role="tooltip">
        <div className="pop-name">คุณ · gate ที่รออนุมัติ</div>
        {gates.map((g) => (
          <div key={g.id} className="pop-gate">
            <span className="gid">{g.id}</span>
            <span>{g.title.replace(/^[^·]*·\s*/, "").replace(/\[[a-z-]+\]\s*/g, "").trim() || g.title}</span>
          </div>
        ))}
        {!hasGates && (
          <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "7px" }}>
            ไม่มี gate รอ
          </div>
        )}
        <div className="pop-hint">
          campfire amber = ต้องการคุณตัดสินใจ
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props {
  model: MapModel;
  token: string;
}

export interface SceneHandle {
  /** S6 hook: walk the agent at `role` to `toNode` (defaults to home station). */
  triggerWalk: (role: string, toNode?: string) => void;
}

export default function CampsiteScene({ model }: Props) {
  const { projectPct, gates, agents } = model;

  // DOM refs — body and root element per agent, indexed by role.
  const bodyRefs = useRef<Record<string, HTMLElement | null>>({});
  const rootRefs = useRef<Record<string, HTMLElement | null>>({});

  // Exposed handle for S6 (parent can access via a forwarded ref if needed).
  const engineRef = useRef<EngineHandle | null>(null);

  useEffect(() => {
    // Guard: only run in the browser (this is a "use client" component, but be safe).
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Build scout state for each agent.
    const roleKeys = Object.keys(ROLE_CONFIG);
    const scoutRefs: ScoutRef[] = roleKeys.map((role, idx) => {
      const cfg   = ROLE_CONFIG[role];
      const state = buildScoutState(role, cfg.node, cfg.poseIdx, SPEED_VAR[idx] ?? 1.0);
      state.bodyEl = bodyRefs.current[role] ?? null;
      state.rootEl = rootRefs.current[role] ?? null;
      return { state, path: [] };
    });

    // Ensure initial path is set: entering agents walk entry→home.
    // buildScoutState already sets cur=entryNode, tgt=homeNode with t=0.
    // We pass the remaining path (empty, since only one hop: cur→tgt is all we need).
    // The engine's step loop will detect arrival at homeNode and call enterIdle.

    let engine: EngineHandle | null = null;

    function startLoop() {
      if (engine) return; // already running
      engine = startEngine(scoutRefs);
      engineRef.current = engine;
    }

    function stopLoop() {
      if (!engine) return;
      engine.stop();
      engine = null;
      engineRef.current = null;
      // Restore all agents to their home station (static fallback).
      for (const ref of scoutRefs) {
        const s   = ref.state;
        const home = NODES[s.homeNode];
        if (!home || !s.rootEl) continue;
        s.rootEl.style.left   = `${home.x}%`;
        s.rootEl.style.top    = `${home.y}%`;
        s.rootEl.style.zIndex = String(Math.round(home.y * 12) + 5);
        // Restore class to idle (idle CSS sway is also off under reduced-motion)
        s.rootEl.classList.remove("entering", "walking-mode");
        s.rootEl.classList.add("idle");
      }
    }

    if (!mq.matches) {
      // Reduced-motion is NOT set → start the entrance walk loop.
      startLoop();
    }
    // If reduced-motion IS set, skip the loop entirely; agents sit at their
    // home-station positions (set via inline style on render) — S2 behavior.

    // Listen for OS setting changes (no page reload needed).
    function onMqChange(e: MediaQueryListEvent) {
      if (e.matches) {
        stopLoop();
      } else {
        // Reduced-motion was turned off → restart entrance walk.
        for (const ref of scoutRefs) {
          const s   = ref.state;
          const cfg = ROLE_CONFIG[s.role];
          if (!cfg) continue;
          // Reset scout state to entering from arm-tip.
          const fresh = buildScoutState(s.role, cfg.node, cfg.poseIdx, s.speedVar);
          fresh.bodyEl = s.bodyEl;
          fresh.rootEl = s.rootEl;
          // Overwrite mutable fields in place so the array ref stays stable.
          Object.assign(s, fresh);
          ref.path = [];
        }
        startLoop();
      }
    }
    mq.addEventListener("change", onMqChange);

    return () => {
      mq.removeEventListener("change", onMqChange);
      stopLoop();
    };
  }, []); // mount-once — engine is data-independent at this stage

  // Static home position for each agent (used as initial style + reduced-motion fallback).
  function homeStyle(role: string): { left: string; top: string; zIndex: number } {
    const cfg  = ROLE_CONFIG[role];
    if (!cfg) return { left: "50%", top: "50%", zIndex: 10 };
    const node = NODES[cfg.node];
    if (!node) return { left: "50%", top: "50%", zIndex: 10 };
    return {
      left:   `${node.x}%`,
      top:    `${node.y}%`,
      zIndex: Math.round(node.y * 12) + 5,
    };
  }

  return (
    <div className="map-wrap" data-testid="scene--status-map-campsite">
      <style dangerouslySetInnerHTML={{ __html: SCENE_CSS }} />

      <div className="map-stat-bar" aria-label={`ความคืบหน้าโปรเจกต์ ${projectPct}%`}>
        <span className="stat-pct">{projectPct}%</span>
        <div className="stat-sep" aria-hidden="true" />
        <span className="stat-label">ความคืบหน้าโปรเจกต์</span>
        {gates.length > 0 && (
          <>
            <div className="stat-sep" aria-hidden="true" />
            <span
              className="stat-label"
              style={{ color: "#FFB454" }}
              aria-label={`${gates.length} gate รอการอนุมัติ`}
            >
              {gates.length} gate รอ
            </span>
          </>
        )}
      </div>

      <div className="map-stage">
        <div
          className="scout-layer"
          role="list"
          aria-label="ทีม AI delivery agents บนแผนที่"
        >
          {agents.map((agent) => {
            const pos = homeStyle(agent.role);
            return (
              <AgentScout
                key={agent.role}
                agent={agent}
                staticLeft={pos.left}
                staticTop={pos.top}
                staticZ={pos.zIndex}
                rootRef={(el) => { rootRefs.current[agent.role] = el; }}
                bodyRef={(el) => { bodyRefs.current[agent.role] = el; }}
              />
            );
          })}
          <YouScout gates={gates} />
        </div>
      </div>
    </div>
  );
}
