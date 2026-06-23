"use client";
// S4/S5 — Overlays: <Overlay> primitive + Overview chips + Epic scope overlays.
//
// Single-open model: only one full panel is visible at a time.
// Esc / click-outside closes the active panel.
// Full panel is role="dialog" aria-modal with focus trap + return-focus.
// Chip is a real <button> with aria-expanded.
// Motion: chip lift via transform/opacity, 150ms ease-out; honours reduced-motion.
// Tap targets: min 44px via explicit minHeight/minWidth.
//
// S5 additions:
//   - Scope Switcher (top-left): Overview chip ⇄ Epic chip; switcher list with
//     Feature|Persona segmented + filter; keyboard-navigable epic list.
//   - Epic Progress (top-right): Trail 5 stages + 4 orbs.
//   - Epic Up Next (right): queued stories list.
//   - Epic Board (bottom): 5-column Kanban; active card emphasised; YOU badge.
//   - Epic Crew (right of canvas): same Crew overlay but scoped to epic's roles.
//
// Trail/Board numbers are derived client-side using buildTrail/stageOf/hasAwait
// from lib/status-derive.ts — guaranteed to match /status for the same epic.

import {
  useCallback,
  useEffect,
  useId,
  useRef,
} from "react";
import type {
  MapAgent,
  MapBacklogItem,
  MapEnvItem,
  MapEpicItem,
  MapEpicStory,
  MapGate,
  MapModel,
} from "./campsite-scene";
import { buildTrail, stageOf, STAGES } from "@/lib/status-derive";

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
/* S5: scope switcher */
.ovl-seg-group {
  display:flex;gap:0;border:1px solid rgba(255,255,255,.16);border-radius:8px;overflow:hidden;margin-bottom:8px;
}
.ovl-seg-btn {
  flex:1;padding:6px 10px;font-size:11px;font-weight:600;cursor:pointer;
  color:rgba(223,234,245,.6);background:transparent;border:none;
  transition:background 120ms,color 120ms;min-height:36px;
}
.ovl-seg-btn[aria-selected="true"]{
  background:rgba(91,233,176,.18);color:#5BE9B0;
}
.ovl-seg-btn:focus-visible{outline:2px solid rgba(91,233,176,.8);outline-offset:-2px;}
.ovl-filter-row{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px;}
.ovl-filter-btn{
  font-size:10.5px;font-weight:600;padding:4px 10px;border-radius:999px;cursor:pointer;min-height:30px;
  background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13);
  color:rgba(223,234,245,.6);transition:background 120ms,color 120ms;
}
.ovl-filter-btn[aria-selected="true"]{
  background:rgba(91,233,176,.18);border-color:rgba(91,233,176,.4);color:#5BE9B0;
}
.ovl-filter-btn:focus-visible{outline:2px solid rgba(91,233,176,.8);outline-offset:2px;}
.ovl-epic-list{max-height:240px;overflow-y:auto;}
.ovl-epic-item{
  display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:9px;cursor:pointer;
  background:transparent;border:none;width:100%;text-align:left;min-height:44px;
  color:rgba(223,234,245,.85);font-size:12px;transition:background 120ms;
}
.ovl-epic-item:hover,.ovl-epic-item:focus-visible{background:rgba(255,255,255,.07);}
.ovl-epic-item:focus-visible{outline:2px solid rgba(91,233,176,.8);outline-offset:2px;}
.ovl-epic-name{flex:1;font-weight:600;line-height:1.3;}
.ovl-epic-pct{
  font-family:'JetBrains Mono','Fira Mono','Consolas',monospace;
  font-size:10px;color:rgba(223,234,245,.5);flex:none;
}
.ovl-epic-chip{
  font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;flex:none;
  border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);
  color:rgba(223,234,245,.5);
}
.ovl-epic-chip.prog{color:#5FD0DE;border-color:rgba(95,208,222,.3);background:rgba(95,208,222,.08);}
.ovl-epic-chip.done{color:#5BE9B0;border-color:rgba(91,233,176,.3);background:rgba(91,233,176,.08);}
.ovl-epic-chip.todo{color:rgba(223,234,245,.4);}
.ovl-back-btn{
  display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;
  color:rgba(223,234,245,.6);cursor:pointer;border:none;background:none;
  padding:6px 8px;border-radius:7px;transition:color 120ms,background 120ms;min-height:36px;
}
.ovl-back-btn:hover{color:rgba(223,234,245,.9);background:rgba(255,255,255,.06);}
.ovl-back-btn:focus-visible{outline:2px solid rgba(91,233,176,.8);outline-offset:2px;}
/* S5: Trail */
.ovl-trail{display:flex;align-items:center;gap:0;margin-bottom:14px;position:relative;}
.ovl-trail-seg{flex:1;height:3px;background:rgba(255,255,255,.1);}
.ovl-trail-seg.run{background:linear-gradient(90deg,#5BE9B0,#5FD0DE);}
.ovl-trail-seg.gate{background:#FFB454;}
.ovl-trail-seg.done{background:#5BE9B0;}
.ovl-trail-node{
  width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,.2);
  background:rgba(14,24,40,.9);display:flex;align-items:center;justify-content:center;
  font-size:8px;z-index:2;flex:none;cursor:default;position:relative;
}
.ovl-trail-node.run{border-color:#5BE9B0;background:rgba(91,233,176,.18);box-shadow:0 0 8px rgba(91,233,176,.5);}
.ovl-trail-node.gate{border-color:#FFB454;background:rgba(255,180,84,.18);box-shadow:0 0 8px rgba(255,180,84,.5);}
.ovl-trail-node.done{border-color:#5BE9B0;background:rgba(91,233,176,.12);}
.ovl-trail-node.q{border-color:rgba(95,208,222,.4);background:rgba(95,208,222,.06);}
.ovl-trail-label{
  position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);
  white-space:nowrap;font-size:9px;color:rgba(223,234,245,.5);pointer-events:none;
}
.ovl-trail-label.run{color:#5BE9B0;}
.ovl-trail-label.gate{color:#FFB454;}
.ovl-trail-wrap{position:relative;margin-bottom:28px;}
/* S5: Board/Kanban */
.ovl-board{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;}
.ovl-col{flex:0 0 130px;min-width:0;}
.ovl-col-head{
  font-size:9.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
  color:rgba(223,234,245,.45);margin-bottom:5px;white-space:nowrap;
}
.ovl-card{
  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);
  border-radius:7px;padding:5px 7px;margin-bottom:4px;
}
.ovl-card.active{border-color:rgba(91,233,176,.4);background:rgba(91,233,176,.07);}
.ovl-card.awaiting{border-color:rgba(255,180,84,.4);background:rgba(255,180,84,.07);}
.ovl-card-id{
  font-family:'JetBrains Mono','Fira Mono','Consolas',monospace;
  font-size:9px;color:rgba(223,234,245,.4);
}
.ovl-card-title{font-size:10.5px;color:rgba(223,234,245,.85);line-height:1.35;margin-top:1px;}
.ovl-you-badge{
  display:inline-block;font-size:8px;font-weight:700;padding:1px 5px;border-radius:4px;
  background:rgba(255,180,84,.2);border:1px solid rgba(255,180,84,.35);color:#FFB454;margin-top:3px;
}
.ovl-legend{display:flex;gap:10px;font-size:9.5px;color:rgba(223,234,245,.4);margin-top:8px;flex-wrap:wrap;}
.ovl-legend-dot{width:7px;height:7px;border-radius:50%;flex:none;margin-top:2px;}
/* S5: Up Next list */
.ovl-queue-item{
  display:flex;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.07);align-items:flex-start;
}
.ovl-queue-item:last-child{border-bottom:0}
.ovl-queue-id{
  font-family:'JetBrains Mono','Fira Mono','Consolas',monospace;
  font-size:9.5px;color:rgba(223,234,245,.4);flex:none;margin-top:1px;
}
.ovl-queue-title{font-size:11px;color:rgba(223,234,245,.8);line-height:1.4;flex:1;}
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
  | "top-left"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom-left"
  | "bottom"
  | "you-gates";

const CHIP_POSITIONS: Record<OverlayPosition, React.CSSProperties> = {
  "top-left":     { position: "fixed", top: 16,  left: 16 },
  "top-right":    { position: "fixed", top: 16,  right: 16 },
  "right":        { position: "fixed", top: "50%", right: 16, transform: "translateY(-50%)" },
  "bottom-right": { position: "fixed", bottom: 16, right: 16 },
  "bottom-left":  { position: "fixed", bottom: 16, left:  16 },
  "bottom":       { position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)" },
  "you-gates":    {
    position: "fixed",
    top: "42%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  },
};

const PANEL_POSITIONS: Record<OverlayPosition, React.CSSProperties> = {
  "top-left":     { top: 16,    left: 16, maxWidth: 360 },
  "top-right":    { top: 16,    right: 16 },
  "right":        { top: "50%", right: 16, transform: "translateY(-50%)" },
  "bottom-right": { bottom: 16, right: 16 },
  "bottom-left":  { bottom: 16, left:  16 },
  "bottom":       { bottom: 16, left: "50%", transform: "translateX(-50%)", maxWidth: 680, minWidth: 320 },
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

// ── S5: Helper to adapt MapEpicStory → StatusIssue-like shape for status-derive ─────

// buildTrail/stageOf/epicBucket from status-derive expect StatusIssue objects.
// MapEpicStory carries the minimal fields they need. We cast through a compatible shape.

function storyAsIssue(s: MapEpicStory): Parameters<typeof stageOf>[0] {
  return {
    id: s.id,
    title: s.role ? `[${s.role}] ${s.title}` : s.title, // reconstruct for stageOf
    status: s.status,
    statusType: s.statusType,
    labels: s.labels,
    url: s.url,
    description: "",
    priority: "",
    startedAt: s.startedAt,
    updatedAt: "",
    completedAt: null,
    assignee: null,
    project: null,
    parent: null,
  } as Parameters<typeof stageOf>[0];
}

// ── S5: ScopeSwitcher panel ───────────────────────────────────────────────────

interface ScopeSwitcherPanelProps {
  epics: MapEpicItem[];
  group: "feature" | "persona";
  efilter: "all" | "prog" | "done" | "todo";
  onSelectEpic: (key: string) => void;
  onGroupChange: (g: "feature" | "persona") => void;
  onEfilterChange: (f: "all" | "prog" | "done" | "todo") => void;
}

function ScopeSwitcherPanel({
  epics,
  group,
  efilter,
  onSelectEpic,
  onGroupChange,
  onEfilterChange,
}: ScopeSwitcherPanelProps) {
  const filtered = epics.filter((e) => {
    if (efilter === "prog") return e.bucket === "prog";
    if (efilter === "done") return e.bucket === "done";
    if (efilter === "todo") return e.bucket === "todo";
    return true;
  });

  if (epics.length === 0) {
    return <div className="ovl-empty">ยังไม่มี epic ในโปรเจกต์</div>;
  }

  const filterLabels: { key: "all" | "prog" | "done" | "todo"; label: string }[] = [
    { key: "all",  label: "ทั้งหมด" },
    { key: "prog", label: "กำลังทำ" },
    { key: "done", label: "เสร็จแล้ว" },
    { key: "todo", label: "ยังไม่เริ่ม" },
  ];

  return (
    <>
      {/* Group toggle: Feature | Persona */}
      <div
        className="ovl-seg-group"
        role="tablist"
        aria-label="จัดกลุ่มตาม"
      >
        {(["feature", "persona"] as const).map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={group === g}
            className="ovl-seg-btn"
            onClick={() => onGroupChange(g)}
            data-testid={`segbtn--scope-group-${g}`}
          >
            {g === "feature" ? "Feature" : "Persona"}
          </button>
        ))}
      </div>

      {/* Filter: ทั้งหมด / กำลังทำ / เสร็จแล้ว / ยังไม่เริ่ม */}
      <div className="ovl-filter-row" role="group" aria-label="กรอง epic">
        {filterLabels.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={efilter === key}
            className="ovl-filter-btn"
            onClick={() => onEfilterChange(key)}
            data-testid={`filterbtn--scope-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Epic list */}
      <div
        className="ovl-epic-list"
        role="listbox"
        aria-label="รายการ epic"
        data-testid="list--scope-epics"
      >
        {filtered.length === 0 ? (
          <div className="ovl-empty">ไม่มี epic ที่ตรงกับตัวกรอง</div>
        ) : (
          filtered.map((epic) => {
            const total = epic.stories.length;
            const done  = epic.stories.filter((s) => s.statusType === "completed" || s.status === "Done").length;
            const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
            const subLabel = group === "persona" ? epic.persona || "อื่นๆ" : epic.feature || "—";
            return (
              <button
                key={epic.key}
                type="button"
                role="option"
                aria-selected={false}
                className="ovl-epic-item"
                onClick={() => onSelectEpic(epic.key)}
                data-testid={`epicbtn--scope-${epic.key}`}
              >
                <span className="ovl-epic-name">
                  <span style={{ display: "block" }}>{epic.label}</span>
                  <span style={{ display: "block", fontSize: "9.5px", color: "rgba(223,234,245,.4)", marginTop: "1px" }}>
                    {subLabel}
                  </span>
                </span>
                <span className={`ovl-epic-chip ${epic.bucket}`}>
                  {epic.bucket === "prog" ? "กำลังทำ" : epic.bucket === "done" ? "เสร็จ" : "ยังไม่เริ่ม"}
                </span>
                <span className="ovl-epic-pct">{pct}%</span>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}

// ── S5: EpicProgressPanel (top-right in Epic scope) ──────────────────────────

interface EpicProgressPanelProps {
  stories: MapEpicStory[];
}

function EpicProgressPanel({ stories }: EpicProgressPanelProps) {
  if (stories.length === 0) {
    return <div className="ovl-empty">ยังไม่มีสตอรีใน epic นี้</div>;
  }

  const issues = stories.map(storyAsIssue);
  const trail  = buildTrail(issues);

  const running  = stories.filter((s) => s.status === "In Progress").length;
  const awaiting = stories.filter((s) => s.labels.includes("awaiting-you")).length;
  const shipped  = stories.filter((s) => s.statusType === "completed" || s.status === "Done").length;
  const queued   = stories.filter((s) => {
    const isActive = s.status === "In Progress";
    const isDone   = s.statusType === "completed" || s.status === "Done";
    const hasAwait = s.labels.includes("awaiting-you");
    return !isActive && !isDone && !hasAwait;
  }).length;

  return (
    <>
      {/* Trail visual */}
      <div className="ovl-trail-wrap" data-testid="trail--epic-progress">
        <div className="ovl-trail">
          {trail.nodes.map((node, idx) => (
            <div key={node.name} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div className={`ovl-trail-node ${node.cls}`} aria-label={`${node.name}: ${node.sub}`}>
                {node.cls === "run" && <span style={{ color: "#5BE9B0", fontSize: "9px" }}>▶</span>}
                {node.cls === "gate" && <span style={{ color: "#FFB454", fontSize: "9px" }}>⚑</span>}
                {node.cls === "done" && node.name === "Ship" && <span style={{ color: "#5BE9B0", fontSize: "9px" }}>✓</span>}
                <span className={`ovl-trail-label ${node.cls}`}>{node.name}</span>
              </div>
              {idx < trail.nodes.length - 1 && (
                <div
                  className={`ovl-trail-seg ${trail.curIdx > idx ? "done" : node.cls === "run" ? "run" : node.cls === "gate" ? "gate" : ""}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 4 orbs: กำลังทำ / รอคุณ / ในคิว / ส่งแล้ว */}
      <div className="ovl-orb-row">
        <div className="ovl-orb" data-testid="orb--epic-run">
          <span className="ovl-orb-val">{running}</span>
          <span className="ovl-orb-lbl">กำลังทำ</span>
        </div>
        <div className="ovl-orb" data-testid="orb--epic-need">
          <span className="ovl-orb-val" style={{ color: awaiting > 0 ? "#FFB454" : "#5BE9B0" }}>
            {awaiting}
          </span>
          <span className="ovl-orb-lbl">รอคุณ</span>
        </div>
        <div className="ovl-orb" data-testid="orb--epic-queue">
          <span className="ovl-orb-val" style={{ color: "rgba(223,234,245,.8)" }}>{queued}</span>
          <span className="ovl-orb-lbl">ในคิว</span>
        </div>
        <div className="ovl-orb" data-testid="orb--epic-ship">
          <span className="ovl-orb-val">{shipped}</span>
          <span className="ovl-orb-lbl">ส่งแล้ว</span>
        </div>
      </div>
    </>
  );
}

// ── S5: EpicUpNextPanel (right in Epic scope) ─────────────────────────────────

const COLS_ORDER: string[] = ["Backlog", "Todo", "In Progress", "In Review", "Done"];

interface EpicUpNextPanelProps {
  stories: MapEpicStory[];
}

function EpicUpNextPanel({ stories }: EpicUpNextPanelProps) {
  // Queued = not active, not done, not awaiting
  const queued = stories
    .filter((s) => {
      const isActive = s.status === "In Progress";
      const isDone   = s.statusType === "completed" || s.status === "Done";
      const hasAwait = s.labels.includes("awaiting-you");
      return !isActive && !isDone && !hasAwait;
    })
    .sort((a, b) => COLS_ORDER.indexOf(a.status) - COLS_ORDER.indexOf(b.status));

  if (queued.length === 0) {
    return <div className="ovl-empty">— คิวว่าง</div>;
  }

  return (
    <div data-testid="list--epic-upnext">
      {queued.map((s) => (
        <div key={s.id} className="ovl-queue-item" data-testid={`item--upnext-${s.id}`}>
          <span className="ovl-queue-id">{s.id}</span>
          <span className="ovl-queue-title">{s.title}</span>
        </div>
      ))}
    </div>
  );
}

// ── S5: EpicBoardPanel (bottom in Epic scope) ─────────────────────────────────

const BOARD_COLS: [string, string][] = [
  ["Backlog",     "Backlog"],
  ["Todo",        "Todo"],
  ["In Progress", "กำลังทำ"],
  ["In Review",   "ตรวจสอบ"],
  ["Done",        "เสร็จ"],
];

interface EpicBoardPanelProps {
  stories: MapEpicStory[];
  epicLabel: string;
}

function EpicBoardPanel({ stories, epicLabel }: EpicBoardPanelProps) {
  if (stories.length === 0) {
    return <div className="ovl-empty">ยังไม่มีสตอรีใน epic นี้</div>;
  }

  const byCol: Record<string, MapEpicStory[]> = {};
  BOARD_COLS.forEach(([colKey]) => { byCol[colKey] = []; });
  for (const s of stories) {
    const col = BOARD_COLS.find(([k]) => k === s.status)?.[0] ?? "Backlog";
    byCol[col].push(s);
  }

  return (
    <div data-testid={`board--epic-${epicLabel}`}>
      <div className="ovl-board">
        {BOARD_COLS.map(([colKey, colLabel]) => (
          <div key={colKey} className="ovl-col" data-testid={`col--board-${colKey}`}>
            <div className="ovl-col-head">{colLabel} {byCol[colKey].length > 0 && `(${byCol[colKey].length})`}</div>
            {byCol[colKey].length === 0 ? (
              <div className="ovl-env-empty" style={{ fontSize: "10px" }}>—</div>
            ) : (
              byCol[colKey].map((s) => {
                const isActive = s.status === "In Progress";
                const hasAwait = s.labels.includes("awaiting-you");
                const cardCls  = isActive ? "active" : hasAwait ? "awaiting" : "";
                return (
                  <div
                    key={s.id}
                    className={`ovl-card ${cardCls}`}
                    data-testid={`card--board-${s.id}`}
                  >
                    <div className="ovl-card-id">{s.id}</div>
                    <div className="ovl-card-title">{s.title}</div>
                    {hasAwait && <div className="ovl-you-badge">รอคุณ</div>}
                  </div>
                );
              })
            )}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="ovl-legend">
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span className="ovl-legend-dot" style={{ background: "rgba(91,233,176,.6)" }} />
          กำลังทำ
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span className="ovl-legend-dot" style={{ background: "rgba(255,180,84,.6)" }} />
          รอคุณ
        </span>
      </div>
    </div>
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
  epics: MapEpicItem[];
}

interface MapOverlaysProps {
  model: OverlaySubModel;
  scope: "all" | "epic";
  activeEpic: string;
  activeEpicData: MapEpicItem | null;
  group: "feature" | "persona";
  efilter: "all" | "prog" | "done" | "todo";
  openOverlay: string | null;
  onOpen: (id: string) => void;
  onClose: () => void;
  onSelectEpic: (key: string) => void;
  onBackToOverview: () => void;
  onGroupChange: (g: "feature" | "persona") => void;
  onEfilterChange: (f: "all" | "prog" | "done" | "todo") => void;
}

export function MapOverlays({
  model,
  scope,
  activeEpic,
  activeEpicData,
  group,
  efilter,
  openOverlay,
  onOpen,
  onClose,
  onSelectEpic,
  onBackToOverview,
  onGroupChange,
  onEfilterChange,
}: MapOverlaysProps) {
  const { projectPct, gates, agents, epicsActive, totalEpics, backlogItems, envLanes, epics } = model;

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

  // ── Scope chip labels ──────────────────────────────────────────────────────
  const isEpicScope = scope === "epic";
  const switcherPanelTitle = isEpicScope ? "สลับ epic" : "เลือกขอบเขต";

  // Epic scope overlay summaries
  const epicStories   = activeEpicData?.stories ?? [];
  const epicRunning   = epicStories.filter((s) => s.status === "In Progress").length;
  const epicAwaiting  = epicStories.filter((s) => s.labels.includes("awaiting-you")).length;
  const epicQueued    = epicStories.filter((s) => {
    return s.status !== "In Progress"
      && s.statusType !== "completed"
      && s.status !== "Done"
      && !s.labels.includes("awaiting-you");
  }).length;
  const epicShipped   = epicStories.filter((s) => s.statusType === "completed" || s.status === "Done").length;

  // Progress chip summary for Epic scope
  const epicIssues    = epicStories.map(storyAsIssue);
  const epicTrail     = epicStories.length > 0 ? buildTrail(epicIssues) : null;
  const progressChipLabel = epicTrail
    ? `Stage ${epicTrail.curIdx + 1}/5 ${STAGES[epicTrail.curIdx]} · ▶${epicRunning} ⚑${epicAwaiting} ⏳${epicQueued} ✓${epicShipped}`
    : epicStories.length === 0
      ? "ยังไม่มีสตอรี"
      : "Progress ▾";

  if (isEpicScope) {
    // ── Epic scope overlays ────────────────────────────────────────────────
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: OVERLAY_CSS }} />

        {/* 1. Scope switcher chip — top-left (Epic mode: shows ‹ Overview · {epicName} ▾) */}
        <Overlay
          id="switcher"
          position="top-left"
          chipLabel={`ขอบเขต: ${activeEpic} — กดเพื่อสลับหรือกลับ Overview`}
          chipNode={
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                className="ovl-back-btn"
                style={{ padding: "0 4px" }}
                onClick={(e) => { e.stopPropagation(); onBackToOverview(); }}
                aria-label="กลับ Overview"
              >
                ‹ Overview
              </button>
              <span aria-hidden="true" style={{ color: "rgba(223,234,245,.4)" }}>·</span>
              <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activeEpic}
              </span>
              <span aria-hidden="true">▾</span>
            </span>
          }
          panelTitle={switcherPanelTitle}
          isOpen={openOverlay === "switcher"}
          onOpen={() => open("switcher")}
          onClose={onClose}
        >
          <>
            <button
              type="button"
              className="ovl-back-btn"
              style={{ width: "100%", justifyContent: "flex-start", marginBottom: 10 }}
              onClick={() => { onBackToOverview(); onClose(); }}
              data-testid="btn--scope-back-overview"
            >
              ‹ กลับ Overview (ทั้งหมด)
            </button>
            <ScopeSwitcherPanel
              epics={epics}
              group={group}
              efilter={efilter}
              onSelectEpic={(key) => { onSelectEpic(key); }}
              onGroupChange={onGroupChange}
              onEfilterChange={onEfilterChange}
            />
          </>
        </Overlay>

        {/* 2. Progress chip — top-right (Epic scope: Trail 5 stages + orbs) */}
        <Overlay
          id="epic-progress"
          position="top-right"
          chipLabel={`ความคืบหน้า epic: ${progressChipLabel}`}
          chipNode={<><span>{progressChipLabel}</span> <span aria-hidden="true">▾</span></>}
          panelTitle={`ความคืบหน้า · ${activeEpic}`}
          isOpen={openOverlay === "epic-progress"}
          onOpen={() => open("epic-progress")}
          onClose={onClose}
        >
          <EpicProgressPanel stories={epicStories} />
        </Overlay>

        {/* 3. Up Next chip — right (Epic scope: queued story list) */}
        <Overlay
          id="epic-upnext"
          position="right"
          chipLabel={`ในคิว ${epicQueued}`}
          chipNode={<><span>{`ในคิว ${epicQueued}`}</span> <span aria-hidden="true">▾</span></>}
          panelTitle={`ในคิว · ${activeEpic}`}
          isOpen={openOverlay === "epic-upnext"}
          onOpen={() => open("epic-upnext")}
          onClose={onClose}
        >
          <EpicUpNextPanel stories={epicStories} />
        </Overlay>

        {/* 4. Crew chip — same right position as Overview but scoped to epic's roles */}
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

        {/* 5. Board chip — bottom (Epic scope: 5-column Kanban) */}
        <Overlay
          id="epic-board"
          position="bottom"
          chipLabel={`บอร์ด ${epicStories.length} stories`}
          chipNode={<><span>{`บอร์ด · ${epicStories.length} stories`}</span> <span aria-hidden="true">▾</span></>}
          panelTitle={`บอร์ด · ${activeEpic}`}
          isOpen={openOverlay === "epic-board"}
          onOpen={() => open("epic-board")}
          onClose={onClose}
        >
          <EpicBoardPanel stories={epicStories} epicLabel={activeEpic} />
        </Overlay>

        {/* 6. You/Gates panel — always available */}
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

  // ── Overview scope overlays (default) ─────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: OVERLAY_CSS }} />

      {/* 0. Scope switcher chip — top-left (Overview mode: "ทั้งหมด ▾") */}
      <Overlay
        id="switcher"
        position="top-left"
        chipLabel="ทุก delivery — กดเพื่อเลือก epic"
        chipNode={<><span>ทุก delivery</span> <span aria-hidden="true">▾</span></>}
        panelTitle="เลือกขอบเขต"
        isOpen={openOverlay === "switcher"}
        onOpen={() => open("switcher")}
        onClose={onClose}
      >
        <>
          <div style={{ marginBottom: 10, fontWeight: 600, fontSize: 12, color: "rgba(223,234,245,.7)" }}>
            ทั้งหมด (Overview)
          </div>
          <ScopeSwitcherPanel
            epics={epics}
            group={group}
            efilter={efilter}
            onSelectEpic={(key) => { onSelectEpic(key); }}
            onGroupChange={onGroupChange}
            onEfilterChange={onEfilterChange}
          />
        </>
      </Overlay>

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
