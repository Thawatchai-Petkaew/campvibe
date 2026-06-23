"use client";
// S4 — Overview overlays: <Overlay> primitive + 4 edge chips + You/Gates panel.
//
// Single-open model: only one full panel is visible at a time.
// Esc / click-outside closes the active panel.
// Full panel is role="dialog" aria-modal with focus trap + return-focus.
// Chip is a real <button> with aria-expanded.
// Motion: chip lift via transform/opacity, 150ms ease-out; honours reduced-motion.
// Tap targets: min 44px via explicit minHeight/minWidth.

import {
  useCallback,
  useEffect,
  useId,
  useRef,
} from "react";
import type { MapAgent, MapBacklogItem, MapEnvItem, MapGate, MapModel } from "./campsite-scene";

// ── CSS ──────────────────────────────────────────────────────────────────────

const OVERLAY_CSS = `
.ovl-chip {
  display:inline-flex;align-items:center;gap:6px;white-space:nowrap;cursor:pointer;
  background:rgba(16,26,42,.52);backdrop-filter:saturate(150%) blur(18px);
  -webkit-backdrop-filter:saturate(150%) blur(18px);
  border:1px solid rgba(255,255,255,.16);border-radius:999px;
  padding:8px 14px;min-height:44px;
  font-size:12px;font-weight:600;color:rgba(223,234,245,.9);
  box-shadow:0 8px 24px rgba(0,0,0,.32);
  transition:transform 150ms ease-out,box-shadow 150ms ease-out,opacity 150ms ease-out;
  position:relative;z-index:21;
}
@media (prefers-reduced-motion: no-preference) {
  .ovl-chip:hover,.ovl-chip:focus-visible{
    transform:translateY(-2px);
    box-shadow:0 12px 32px rgba(0,0,0,.44);
  }
}
.ovl-chip:focus-visible{
  outline:2px solid rgba(91,233,176,.8);outline-offset:2px;
}
.ovl-chip[aria-expanded="true"]{
  border-color:rgba(91,233,176,.5);background:rgba(16,26,42,.72);
}
.ovl-panel {
  position:fixed;z-index:50;
  background:rgba(10,20,36,.88);backdrop-filter:saturate(165%) blur(22px);
  -webkit-backdrop-filter:saturate(165%) blur(22px);
  border:1px solid rgba(255,255,255,.18);border-radius:18px;
  box-shadow:0 24px 56px rgba(0,0,0,.56),inset 0 1px 0 rgba(255,255,255,.1);
  padding:18px 20px 20px;min-width:260px;max-width:340px;
  color:rgba(223,234,245,.9);font-size:13px;
}
.ovl-panel-head {
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:14px;
}
.ovl-panel-title {
  font-family:'Outfit','Anuphan',system-ui,sans-serif;
  font-size:14px;font-weight:700;color:#F1F6FB;
}
.ovl-close {
  display:inline-flex;align-items:center;justify-content:center;
  width:28px;height:28px;border-radius:50%;
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);
  color:rgba(223,234,245,.7);font-size:14px;cursor:pointer;
  transition:background 120ms;min-width:28px;
}
.ovl-close:hover{background:rgba(255,255,255,.14);}
.ovl-close:focus-visible{outline:2px solid rgba(91,233,176,.8);outline-offset:2px;}
.ovl-orb-row {
  display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;
}
.ovl-orb {
  flex:1;min-width:56px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  border-radius:12px;padding:10px 8px;text-align:center;
}
.ovl-orb-val {
  font-family:'JetBrains Mono','Fira Mono','Consolas',monospace;
  font-size:18px;font-weight:700;color:#5BE9B0;display:block;line-height:1;
}
.ovl-orb-lbl {font-size:9.5px;color:rgba(223,234,245,.6);margin-top:4px;display:block;line-height:1.3}
.ovl-progress-bar {
  height:6px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden;
  margin-top:4px;
}
.ovl-progress-fill {
  height:100%;border-radius:999px;background:linear-gradient(90deg,#5BE9B0,#5FD0DE);
  transition:width 300ms ease-out;
}
.ovl-crew-row {
  display:flex;align-items:center;gap:8px;margin-bottom:8px;
}
.ovl-crew-label {flex:0 0 72px;font-size:11.5px;color:rgba(223,234,245,.7);white-space:nowrap;}
.ovl-crew-bars {flex:1;display:flex;gap:2px;align-items:center;}
.ovl-crew-bar {height:6px;border-radius:3px;min-width:2px;}
.ovl-crew-sub {font-size:10px;color:rgba(223,234,245,.45);margin-top:1px;}
.ovl-you-row {
  background:rgba(255,180,84,.08);border:1px solid rgba(255,180,84,.22);border-radius:10px;
  padding:8px 10px;margin-bottom:10px;
}
.ovl-you-label {font-size:11.5px;font-weight:600;color:#FFB454;}
.ovl-you-sub {font-size:10.5px;color:rgba(223,234,245,.6);margin-top:2px;}
.ovl-env-cols {display:flex;gap:6px;}
.ovl-env-col {flex:1;min-width:0;}
.ovl-env-head {
  font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
  color:rgba(223,234,245,.5);margin-bottom:6px;display:flex;align-items:center;gap:5px;
}
.ovl-env-tag {
  font-size:8.5px;font-weight:700;letter-spacing:.07em;padding:1px 5px;border-radius:4px;
  background:rgba(255,180,84,.18);color:#FFB454;border:1px solid rgba(255,180,84,.28);
}
.ovl-env-card {
  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);
  border-radius:7px;padding:5px 7px;margin-bottom:4px;
}
.ovl-env-id {
  font-family:'JetBrains Mono','Fira Mono','Consolas',monospace;
  font-size:9.5px;color:rgba(223,234,245,.45);
}
.ovl-env-name {font-size:10.5px;color:rgba(223,234,245,.8);margin-top:1px;line-height:1.3;}
.ovl-env-empty {font-size:11px;color:rgba(223,234,245,.3);}
.ovl-bl-item {
  display:flex;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.07);
}
.ovl-bl-item:last-child{border-bottom:0}
.ovl-bl-id {
  font-family:'JetBrains Mono','Fira Mono','Consolas',monospace;
  font-size:9.5px;color:rgba(223,234,245,.45);flex:none;margin-top:2px;
}
.ovl-bl-text {font-size:11px;color:rgba(223,234,245,.8);line-height:1.4;flex:1;}
.ovl-bl-epic {font-size:9.5px;color:rgba(223,234,245,.45);}
.ovl-gate-item {
  padding:8px 0;border-bottom:1px solid rgba(255,255,255,.07);
}
.ovl-gate-item:last-child{border-bottom:0}
.ovl-gate-title {font-size:12px;color:rgba(223,234,245,.9);line-height:1.4;}
.ovl-gate-meta {font-size:10px;color:rgba(223,234,245,.45);margin-top:2px;}
.ovl-gate-link {
  display:inline-flex;align-items:center;gap:4px;margin-top:6px;
  font-size:11px;font-weight:600;color:#5BE9B0;text-decoration:none;
  padding:4px 10px;border:1px solid rgba(91,233,176,.28);border-radius:6px;
  background:rgba(91,233,176,.06);transition:background 120ms;min-height:32px;
}
.ovl-gate-link:hover{background:rgba(91,233,176,.14);}
.ovl-gate-link:focus-visible{outline:2px solid rgba(91,233,176,.8);outline-offset:2px;}
.ovl-empty {font-size:11.5px;color:rgba(223,234,245,.38);text-align:center;padding:12px 0;}
.ovl-section-label {
  font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
  color:rgba(223,234,245,.45);margin-bottom:6px;margin-top:10px;
}
.ovl-section-label:first-child{margin-top:0}
`;

// ── FOCUSABLE selector (focus trap) ─────────────────────────────────────────

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// ── <Overlay> primitive ──────────────────────────────────────────────────────

type OverlayPosition =
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom-left"
  | "you-gates";

const CHIP_POSITIONS: Record<OverlayPosition, React.CSSProperties> = {
  "top-right":    { position: "fixed", top: 16,  right: 16 },
  "right":        { position: "fixed", top: "50%", right: 16, transform: "translateY(-50%)" },
  "bottom-right": { position: "fixed", bottom: 16, right: 16 },
  "bottom-left":  { position: "fixed", bottom: 16, left:  16 },
  "you-gates":    {
    position: "fixed",
    top: "42%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  },
};

const PANEL_POSITIONS: Record<OverlayPosition, React.CSSProperties> = {
  "top-right":    { top: 16,    right: 16 },
  "right":        { top: "50%", right: 16, transform: "translateY(-50%)" },
  "bottom-right": { bottom: 16, right: 16 },
  "bottom-left":  { bottom: 16, left:  16 },
  "you-gates":    {
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    minWidth: 300,
  },
};

interface OverlayProps {
  id: string;
  position: OverlayPosition;
  chipNode: React.ReactNode;
  chipLabel: string;
  panelTitle: string;
  children: React.ReactNode;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

function Overlay({
  id,
  position,
  chipNode,
  chipLabel,
  panelTitle,
  children,
  isOpen,
  onOpen,
  onClose,
}: OverlayProps) {
  const uid = useId();
  const chipId = `chip-${uid}`;
  const panelId = `panel-${uid}`;
  const chipRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus trap within the panel + Esc to close + click-outside to close.
  useEffect(() => {
    if (!isOpen) return;

    const panel = panelRef.current;
    if (!panel) return;

    // Move focus into the panel (close button first, or first focusable).
    const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    (focusables[0] ?? panel).focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        // Return focus to the chip that opened the panel.
        chipRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      if (!panel) return;
      const focusableEls = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusableEls.length === 0) return;
      const first = focusableEls[0];
      const last  = focusableEls[focusableEls.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || chipRef.current?.contains(target)) return;
      onClose();
    }

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("mousedown", onClickOutside, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("mousedown", onClickOutside, true);
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* The chip — rendered only when closed AND chipNode is provided (you-gates has no chip) */}
      {!isOpen && chipNode !== null && (
        <button
          id={chipId}
          ref={chipRef}
          className="ovl-chip"
          style={CHIP_POSITIONS[position]}
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-label={chipLabel}
          onClick={onOpen}
          data-testid={`chip--map-overlay-${id}`}
          type="button"
        >
          {chipNode}
        </button>
      )}

      {/* The full panel — conditionally rendered */}
      {isOpen && (
        <div
          id={panelId}
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={panelTitle}
          aria-labelledby={`${panelId}-title`}
          className="ovl-panel"
          style={PANEL_POSITIONS[position]}
          data-testid={`panel--map-overlay-${id}`}
          tabIndex={-1}
        >
          <div className="ovl-panel-head">
            <span id={`${panelId}-title`} className="ovl-panel-title">{panelTitle}</span>
            <button
              className="ovl-close"
              aria-label="ปิดแผง"
              onClick={() => {
                onClose();
                chipRef.current?.focus();
              }}
              type="button"
            >
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </>
  );
}

// ── Delivery panel (top-right) ───────────────────────────────────────────────

interface DeliveryPanelProps {
  projectPct: number;
  gateCount: number;
  epicsActive: number;
  totalEpics: number;
  backlogCount: number;
}

function DeliveryPanel({
  projectPct, gateCount, epicsActive, totalEpics, backlogCount,
}: DeliveryPanelProps) {
  const isEmpty = totalEpics === 0;
  if (isEmpty) {
    return <div className="ovl-empty">ยังไม่มีสตอรีในโปรเจกต์</div>;
  }
  return (
    <>
      <div className="ovl-orb-row">
        <div className="ovl-orb" data-testid="orb--delivery-pct">
          <span className="ovl-orb-val">{projectPct}%</span>
          <span className="ovl-orb-lbl">สตอรีเสร็จแล้ว</span>
        </div>
        <div className="ovl-orb" data-testid="orb--delivery-gates">
          <span className="ovl-orb-val" style={{ color: gateCount > 0 ? "#FFB454" : "#5BE9B0" }}>
            {gateCount}
          </span>
          <span className="ovl-orb-lbl">รออนุมัติจากคุณ</span>
        </div>
        <div className="ovl-orb" data-testid="orb--delivery-epics">
          <span className="ovl-orb-val">{epicsActive}/{totalEpics}</span>
          <span className="ovl-orb-lbl">Epic ที่กำลังทำ</span>
        </div>
        <div className="ovl-orb" data-testid="orb--delivery-backlog">
          <span className="ovl-orb-val" style={{ color: "rgba(223,234,245,.8)" }}>
            {backlogCount}
          </span>
          <span className="ovl-orb-lbl">สตอรีใน Backlog</span>
        </div>
      </div>
      <div className="ovl-progress-bar" role="progressbar" aria-valuenow={projectPct} aria-valuemin={0} aria-valuemax={100} aria-label={`ความคืบหน้า ${projectPct}%`}>
        <div className="ovl-progress-fill" style={{ width: `${projectPct}%` }} />
      </div>
    </>
  );
}

// ── Crew panel (right) ───────────────────────────────────────────────────────

const ROLE_DISPLAY: Record<string, string> = {
  "architect":          "Architect",
  "ux-designer":        "Designer",
  "backend-engineer":   "Backend",
  "frontend-engineer":  "Frontend",
  "devops-release":     "DevOps",
  "qa-engineer":        "QA",
  "security-reviewer":  "Security",
};

interface CrewPanelProps {
  agents: MapAgent[];
  gateCount: number;
}

function CrewPanel({ agents, gateCount }: CrewPanelProps) {
  return (
    <>
      {/* You row first */}
      <div className="ovl-you-row" data-testid="row--crew-you">
        <div className="ovl-you-label">คุณ (เจ้าของ)</div>
        <div className="ovl-you-sub">
          {gateCount > 0 ? `${gateCount} gate รอตรวจ` : "ไม่มี gate รออนุมัติ"}
        </div>
      </div>
      {/* Per-role bars */}
      {agents.map((a) => {
        const total = a.done + a.activeCount + a.queued;
        const doneW  = total > 0 ? (a.done       / total) * 100 : 0;
        const actW   = total > 0 ? (a.activeCount / total) * 100 : 0;
        const quW    = total > 0 ? (a.queued      / total) * 100 : 0;
        const label  = ROLE_DISPLAY[a.role] ?? a.role;
        return (
          <div key={a.role} className="ovl-crew-row" data-testid={`row--crew-${a.role}`}>
            <span className="ovl-crew-label">{label}</span>
            <div style={{ flex: 1 }}>
              <div className="ovl-crew-bars">
                {doneW > 0 && (
                  <div
                    className="ovl-crew-bar"
                    style={{ width: `${doneW}%`, background: "#5BE9B0" }}
                    aria-label={`${a.done} เสร็จ`}
                  />
                )}
                {actW > 0 && (
                  <div
                    className="ovl-crew-bar"
                    style={{ width: `${actW}%`, background: "#5FD0DE" }}
                    aria-label={`${a.activeCount} กำลังทำ`}
                  />
                )}
                {quW > 0 && (
                  <div
                    className="ovl-crew-bar"
                    style={{ width: `${quW}%`, background: "#8FB8F0" }}
                    aria-label={`${a.queued} ในคิว`}
                  />
                )}
                {total === 0 && (
                  <div
                    className="ovl-crew-bar"
                    style={{ width: "100%", background: "rgba(255,255,255,.1)" }}
                    aria-label="ยังไม่มีงาน"
                  />
                )}
              </div>
              <div className="ovl-crew-sub">
                {a.done} เสร็จ · {a.queued} ในคิว
                {!a.active && total === 0 && " · ตอนนี้ยังไม่มีงานที่กำลังทำ"}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── Environments panel (bottom-right) ────────────────────────────────────────

interface EnvPanelProps {
  envLanes: { dev: MapEnvItem[]; staging: MapEnvItem[]; prod: MapEnvItem[] };
}

function EnvPanel({ envLanes }: EnvPanelProps) {
  const cols: { key: "dev" | "staging" | "prod"; label: string; sub: string }[] = [
    { key: "dev",     label: "Dev",     sub: "กำลังทำ · ยังไม่ขึ้น staging" },
    { key: "staging", label: "Staging", sub: "Done · พร้อมขึ้น prod" },
    { key: "prod",    label: "Prod",    sub: "released" },
  ];
  return (
    <div className="ovl-env-cols">
      {cols.map(({ key, label, sub }) => {
        const items = envLanes[key];
        const isStaging = key === "staging";
        return (
          <div key={key} className="ovl-env-col" data-testid={`col--env-${key}`}>
            <div className="ovl-env-head">
              {label}
              {isStaging && items.length > 0 && (
                <span className="ovl-env-tag">RELEASE</span>
              )}
            </div>
            <div style={{ fontSize: "9.5px", color: "rgba(223,234,245,.38)", marginBottom: 6 }}>
              {sub}
            </div>
            {items.length === 0 ? (
              <div className="ovl-env-empty">—</div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="ovl-env-card" data-testid={`card--env-${item.id}`}>
                  <div className="ovl-env-id">{item.id}</div>
                  <div className="ovl-env-name">{item.title}</div>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Backlog panel (bottom-left) ──────────────────────────────────────────────

interface BacklogPanelProps {
  items: MapBacklogItem[];
}

function BacklogPanel({ items }: BacklogPanelProps) {
  if (items.length === 0) {
    return <div className="ovl-empty">— ไม่มี story ใน backlog</div>;
  }
  // Group by role for display
  const groups: Record<string, MapBacklogItem[]> = {};
  for (const item of items) {
    const k = item.role || "other";
    (groups[k] = groups[k] || []).push(item);
  }
  return (
    <>
      {Object.entries(groups).map(([role, roleItems]) => (
        <div key={role} data-testid={`grp--backlog-${role}`}>
          <div className="ovl-section-label">{ROLE_DISPLAY[role] ?? role}</div>
          {roleItems.map((item) => (
            <div key={item.id} className="ovl-bl-item" data-testid={`item--backlog-${item.id}`}>
              <span className="ovl-bl-id">{item.id}</span>
              <span>
                <div className="ovl-bl-text">{item.title}</div>
                {item.epicKey && <div className="ovl-bl-epic">{item.epicKey}</div>}
              </span>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

// ── You / Gates panel (centered, triggered by clicking the ⚑ alert) ──────────

interface GatesPanelProps {
  gates: MapGate[];
}

function GatesPanel({ gates }: GatesPanelProps) {
  if (gates.length === 0) {
    return (
      <div className="ovl-empty" data-testid="empty--gates">
        ✓ ไม่มีงานรออนุมัติจากคุณตอนนี้
      </div>
    );
  }
  return (
    <>
      {gates.map((g) => (
        <div key={g.id} className="ovl-gate-item" data-testid={`item--gate-${g.id}`}>
          <div className="ovl-gate-title">{g.title}</div>
          <div className="ovl-gate-meta">
            {g.epicKey && `${g.epicKey} · `}{g.priority}
          </div>
          <a
            href={g.url}
            className="ovl-gate-link"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`ตรวจและอนุมัติ ${g.id}`}
          >
            ตรวจและอนุมัติ →
          </a>
        </div>
      ))}
    </>
  );
}

// ── MapOverlays — root component rendered by CampsiteScene ──────────────────

interface OverlaySubModel {
  projectPct: number;
  gates: MapGate[];
  agents: MapAgent[];
  epicsActive: number;
  totalEpics: number;
  backlogItems: MapBacklogItem[];
  envLanes: MapModel["envLanes"];
}

interface MapOverlaysProps {
  model: OverlaySubModel;
  openOverlay: string | null;
  onOpen: (id: string) => void;
  onClose: () => void;
}

export function MapOverlays({ model, openOverlay, onOpen, onClose }: MapOverlaysProps) {
  const { projectPct, gates, agents, epicsActive, totalEpics, backlogItems, envLanes } = model;

  const activeAgents = agents.filter((a) => a.active).length;
  const stagingCount = envLanes.staging.length;

  // Active agent count display for Crew chip
  const crewSummary = `กำลังทำงาน ${activeAgents}/7`;
  // Env chip summary — ↑ only when staging has items
  const envSummary = `Dev ${envLanes.dev.length} · Staging ${envLanes.staging.length}${stagingCount > 0 ? "↑" : ""} · Prod ${envLanes.prod.length}`;
  // Delivery chip summary
  const deliverySummary = `${projectPct}% · ⚑${gates.length} · ${epicsActive}/${totalEpics} · BL${backlogItems.length}`;
  // Backlog chip
  const backlogSummary = `Backlog ${backlogItems.length}`;
  // Gates chip — shown only on the You character via onOpenGates, but also registered here
  const gatesTitle = `รออนุมัติจากคุณ (${gates.length})`;

  const open = useCallback((id: string) => onOpen(id), [onOpen]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: OVERLAY_CSS }} />

      {/* 1. Delivery chip — top-right */}
      <Overlay
        id="delivery"
        position="top-right"
        chipLabel={`ภาพรวมการส่งมอบ: ${deliverySummary}`}
        chipNode={<><span>{deliverySummary}</span> <span aria-hidden="true">▾</span></>}
        panelTitle="ภาพรวมการส่งมอบ"
        isOpen={openOverlay === "delivery"}
        onOpen={() => open("delivery")}
        onClose={onClose}
      >
        <DeliveryPanel
          projectPct={projectPct}
          gateCount={gates.length}
          epicsActive={epicsActive}
          totalEpics={totalEpics}
          backlogCount={backlogItems.length}
        />
      </Overlay>

      {/* 2. Crew chip — right */}
      <Overlay
        id="crew"
        position="right"
        chipLabel={`ทีม: ${crewSummary}`}
        chipNode={<><span>{crewSummary}</span> <span aria-hidden="true">▾</span></>}
        panelTitle="ทีม delivery"
        isOpen={openOverlay === "crew"}
        onOpen={() => open("crew")}
        onClose={onClose}
      >
        <CrewPanel agents={agents} gateCount={gates.length} />
      </Overlay>

      {/* 3. Environments chip — bottom-right */}
      <Overlay
        id="env"
        position="bottom-right"
        chipLabel={`สภาพแวดล้อม: ${envSummary}`}
        chipNode={<><span>{envSummary}</span> <span aria-hidden="true">▾</span></>}
        panelTitle="สภาพแวดล้อม"
        isOpen={openOverlay === "env"}
        onOpen={() => open("env")}
        onClose={onClose}
      >
        <EnvPanel envLanes={envLanes} />
      </Overlay>

      {/* 4. Backlog chip — bottom-left */}
      <Overlay
        id="backlog"
        position="bottom-left"
        chipLabel={`${backlogSummary}`}
        chipNode={<><span>{backlogSummary}</span> <span aria-hidden="true">▾</span></>}
        panelTitle="Backlog"
        isOpen={openOverlay === "backlog"}
        onOpen={() => open("backlog")}
        onClose={onClose}
      >
        <BacklogPanel items={backlogItems} />
      </Overlay>

      {/* 5. You/Gates panel — triggered by clicking ⚑ on the You character */}
      <Overlay
        id="gates"
        position="you-gates"
        chipLabel={gatesTitle}
        chipNode={null}
        panelTitle={gatesTitle}
        isOpen={openOverlay === "gates"}
        onOpen={() => open("gates")}
        onClose={onClose}
      >
        <GatesPanel gates={gates} />
      </Overlay>
    </>
  );
}
