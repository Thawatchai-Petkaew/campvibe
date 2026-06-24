"use client";
// CAM-159 — HUD redesign: single bottom command dock + expand-panels + Kanban modal.
//
// Architecture:
//   <CommandDock>  — fixed bottom-center glass bar with summary segments.
//     Each segment is a <button aria-expanded> that opens a panel or modal.
//   <ExpandPanel>  — rises above the dock (translateY up + fade, 180ms).
//                    role="dialog" aria-modal, focus-trap, Esc, click-outside, return-focus.
//   <KanbanModal>  — large centered modal (scale+fade ~92%→100%, 200ms) over dimmed backdrop.
//                    Same focus-trap/Esc pattern. Used for Board (heavy data).
//   <ViewToggle>   — centered pill at top of screen (แดชบอร์ด | แผนที่); real anchor links.
//
// Epic bug fixes (CAM-159):
//   1. Overlapping surfaces eliminated: single dock replaces all per-corner chips.
//   2. setScope non-blank: caller falls back to all-agents-visible when epicRoles is empty.
//   3. activeEpicData deep-link: epics.find by key + graceful empty state.
//
// Reduced-motion: all transitions wrapped so prefers-reduced-motion:reduce disables them
// while panels/modals still appear/close (just without animation).
//
// States: dock segments hover/focus/active/disabled; panels/modals open/close/empty/error.
// a11y: dock segments <button aria-expanded>; panels/modals role=dialog aria-modal;
//        focus-trap + Esc + return-focus; ≥44px tap targets; visible focus ring.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Compass, Database, ExternalLink, FileText, GitBranch, Inbox, Layers, Monitor, ShieldCheck, Trophy } from "lucide-react";
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

// ── CSS ───────────────────────────────────────────────────────────────────────

const HUD_CSS = `
/* ---- Dock ---- */
.hud-dock {
  position:fixed;
  bottom:18px;
  left:50%;
  transform:translateX(-50%);
  z-index:40;
  display:flex;
  align-items:stretch;
  background:rgba(11,30,24,.56);
  backdrop-filter:saturate(195%) blur(30px);
  -webkit-backdrop-filter:saturate(195%) blur(30px);
  border:1px solid rgba(150,240,195,.13);
  border-radius:999px;
  box-shadow:0 16px 48px rgba(0,0,0,.52),inset 0 1px 0 rgba(200,255,232,.14);
  max-width:min(960px,94vw);
  overflow-x:auto;
  overflow-y:hidden;
  scrollbar-width:none;
}
.hud-dock::-webkit-scrollbar{display:none}

.hud-seg {
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding:10px 16px;
  min-height:48px;
  min-width:44px;
  white-space:nowrap;
  cursor:pointer;
  font-size:12.5px;
  font-weight:600;
  color:rgba(223,234,245,.85);
  background:transparent;
  border:none;
  border-right:1px solid rgba(255,255,255,.12);
  transition:background 140ms, color 140ms;
  position:relative;
  flex-shrink:0;
}
.hud-seg:last-child{border-right:none}
.hud-seg:hover{background:rgba(255,255,255,.07);color:rgba(223,234,245,1)}
.hud-seg:focus-visible{
  outline:2px solid rgba(91,233,176,.8);
  outline-offset:-2px;
  z-index:2;
}
.hud-seg[aria-expanded="true"]{
  background:rgba(91,233,176,.12);
  color:#5BE9B0;
  border-right-color:rgba(91,233,176,.2);
}
.hud-seg:active{background:rgba(255,255,255,.1)}

/* Scope left segment (special: rounded left) */
.hud-seg-scope{
  border-radius:999px 0 0 999px;
  padding-left:20px;
}
/* Board button (special: rounded right) */
.hud-seg-board{
  border-radius:0 999px 999px 0;
  border-right:none;
  padding-right:20px;
}
/* Overview last segment */
.hud-seg-last{
  border-radius:0 999px 999px 0;
  border-right:none;
  padding-right:20px;
}

.hud-seg-val {
  font-family:'JetBrains Mono','Fira Mono','Consolas',monospace;
  font-size:14px;
  font-weight:700;
  color:#5BE9B0;
  line-height:1;
}
.hud-seg-val.amber{color:#FFB454}
.hud-seg-val.muted{color:rgba(223,234,245,.8)}
.hud-seg-lbl {
  font-size:10.5px;
  font-weight:600;
  color:rgba(223,234,245,.55);
  margin-top:1px;
}

/* inline mini-bar for progress */
.hud-prog-bar{
  width:52px;height:4px;border-radius:2px;
  background:rgba(255,255,255,.1);overflow:hidden;flex:none;
}
.hud-prog-fill{
  height:100%;border-radius:2px;
  background:linear-gradient(90deg,#5BE9B0,#5FD0DE);
}
@media (prefers-reduced-motion:no-preference){
  .hud-prog-fill{transition:width 300ms ease-out}
}

/* ---- Expand panel (rises above dock) ---- */
.hud-panel {
  position:fixed;
  bottom:80px;
  z-index:50;
  background:rgba(11,30,24,.62);
  backdrop-filter:saturate(195%) blur(32px);
  -webkit-backdrop-filter:saturate(195%) blur(32px);
  border:1px solid rgba(150,240,195,.13);
  border-radius:18px;
  box-shadow:0 24px 56px rgba(0,0,0,.56),inset 0 1px 0 rgba(200,255,232,.12);
  padding:18px 20px 20px;
  min-width:260px;
  max-width:min(360px,92vw);
  color:rgba(223,234,245,.9);
  font-size:13px;
}
@media (prefers-reduced-motion:no-preference){
  .hud-panel {
    animation:panelRise 180ms cubic-bezier(0.23,1,0.32,1) both;
  }
  @keyframes panelRise{
    from{opacity:0;transform:translateY(12px)}
    to{opacity:1;transform:translateY(0)}
  }
}
.hud-panel-head {
  display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;
}
.hud-panel-title {
  font-family:'Outfit','Anuphan',system-ui,sans-serif;
  font-size:14px;font-weight:700;color:#F1F6FB;
}
.hud-close {
  display:inline-flex;align-items:center;justify-content:center;
  width:32px;height:32px;border-radius:50%;min-width:32px;
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);
  color:rgba(223,234,245,.7);font-size:14px;cursor:pointer;
  transition:background 120ms;
}
.hud-close:hover{background:rgba(255,255,255,.14)}
.hud-close:focus-visible{outline:2px solid rgba(91,233,176,.8);outline-offset:2px}

/* ---- Kanban modal (centered, large) ---- */
.hud-modal-backdrop {
  position:fixed;inset:0;z-index:60;
  background:rgba(4,8,22,.72);
}
@media (prefers-reduced-motion:no-preference){
  .hud-modal-backdrop{animation:bdFade 200ms ease both}
  @keyframes bdFade{from{opacity:0}to{opacity:1}}
}
.hud-modal {
  position:fixed;
  inset:0;z-index:61;
  display:flex;align-items:center;justify-content:center;
  padding:20px 16px;
}
.hud-modal-box {
  width:min(900px,96vw);
  max-height:88vh;
  overflow-y:auto;
  background:rgba(11,30,24,.68);
  backdrop-filter:saturate(195%) blur(34px);
  -webkit-backdrop-filter:saturate(195%) blur(34px);
  border:1px solid rgba(150,240,195,.13);
  border-radius:22px;
  box-shadow:0 32px 72px rgba(0,0,0,.64),inset 0 1px 0 rgba(200,255,232,.14);
  padding:24px 26px 28px;
  color:rgba(223,234,245,.9);
}
@media (prefers-reduced-motion:no-preference){
  .hud-modal-box{animation:modalIn 200ms cubic-bezier(0.23,1,0.32,1) both}
  @keyframes modalIn{
    from{opacity:0;transform:scale(.92)}
    to{opacity:1;transform:scale(1)}
  }
}
.hud-modal-head {
  display:flex;align-items:flex-start;gap:14px;margin-bottom:18px;flex-wrap:wrap;
}
.hud-modal-titles{flex:1;min-width:0}
.hud-modal-title {
  font-family:'Outfit','Anuphan',system-ui,sans-serif;
  font-size:17px;font-weight:700;color:#F1F6FB;line-height:1.25;
}
.hud-modal-sub{font-size:12px;color:rgba(223,234,245,.55);margin-top:4px}
.hud-modal-close {
  display:inline-flex;align-items:center;justify-content:center;
  width:44px;height:44px;min-width:44px;border-radius:50%;
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);
  color:rgba(223,234,245,.7);font-size:18px;cursor:pointer;flex:none;
  transition:background 120ms;
}
.hud-modal-close:hover{background:rgba(255,255,255,.14)}
.hud-modal-close:focus-visible{outline:2px solid rgba(91,233,176,.8);outline-offset:2px}

/* modal metric pills row */
.hud-metric-row{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.hud-metric{
  display:inline-flex;flex-direction:column;align-items:center;
  background:rgba(91,233,176,.07);
  border:1px solid rgba(150,240,195,.15);border-radius:10px;
  padding:8px 14px;min-width:62px;text-align:center;
}
.hud-metric-val{
  font-family:'JetBrains Mono','Fira Mono','Consolas',monospace;
  font-size:18px;font-weight:700;color:#5BE9B0;line-height:1;
}
.hud-metric-val.run{color:#5BE9B0}
.hud-metric-val.rev{color:#B7A6FF}
.hud-metric-val.todo{color:#8FB8F0}
.hud-metric-val.done{color:rgba(223,234,245,.4)}
.hud-metric-val.amber{color:#FFB454}
.hud-metric-lbl{font-size:9.5px;color:rgba(223,234,245,.5);margin-top:4px;letter-spacing:.03em}

/* modal progress bar */
.hud-modal-bar-wrap{
  height:6px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden;margin-bottom:16px;
}
.hud-modal-bar-fill{
  height:100%;border-radius:3px;
  background:linear-gradient(90deg,rgba(91,233,176,.65),#5BE9B0);
}

/* ---- Kanban board inside modal ---- */
.hud-board{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
@media (max-width:700px){.hud-board{grid-template-columns:1fr 1fr}}
@media (max-width:440px){.hud-board{grid-template-columns:1fr}}
.hud-col-head{
  font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
  margin-bottom:8px;white-space:nowrap;
}
.hud-col[data-col="Backlog"] .hud-col-head{color:#aebcc9}
.hud-col[data-col="Todo"] .hud-col-head{color:#8FB8F0}
.hud-col[data-col="In Progress"] .hud-col-head{color:#5BE9B0}
.hud-col[data-col="In Review"] .hud-col-head{color:#B7A6FF}
.hud-col[data-col="Done"] .hud-col-head{color:#76E0AE}

.hud-card{
  background:rgba(91,233,176,.05);
  border:1px solid rgba(150,240,195,.13);
  border-radius:12px;padding:10px 11px;margin-bottom:8px;
}
.hud-card:last-child{margin-bottom:0}
@keyframes hud-card-glow{
  0%,100%{box-shadow:none;border-color:rgba(91,233,176,.22)}
  50%{box-shadow:0 0 12px rgba(91,233,176,.2),0 0 4px rgba(91,233,176,.1);border-color:rgba(91,233,176,.6)}
}
.hud-card.active{border-color:rgba(91,233,176,.35);background:rgba(91,233,176,.09);animation:hud-card-glow 2.4s ease-in-out infinite}
.hud-card.awaiting{border-color:rgba(255,150,52,.45);background:linear-gradient(160deg,rgba(255,150,52,.09),rgba(91,233,176,.04))}
.hud-card-lane{
  font-size:9px;letter-spacing:.08em;text-transform:uppercase;
  color:rgba(223,234,245,.42);margin-bottom:5px;
}
.hud-card.active .hud-card-lane{color:#5BE9B0}
.hud-card.awaiting .hud-card-lane{color:#FFB454}
.hud-card-id{font-size:9.5px;color:rgba(223,234,245,.35)}
.hud-card-title{font-size:12.5px;color:rgba(223,234,245,.88);line-height:1.35;margin-top:2px}
.hud-card-footer{
  display:flex;align-items:center;justify-content:space-between;margin-top:7px;
}
.hud-card-role{
  font-size:9.5px;padding:2px 7px;border-radius:999px;
  background:rgba(91,233,176,.08);border:1px solid rgba(150,240,195,.15);
  color:rgba(223,234,245,.55);
}
.hud-card.active .hud-card-role{color:#5BE9B0;border-color:rgba(91,233,176,.3);background:rgba(91,233,176,.12)}
.hud-card.awaiting .hud-card-role{color:rgba(255,180,80,.85);border-color:rgba(255,150,52,.3)}
.hud-you-badge{
  font-size:8px;font-weight:700;padding:2px 6px;border-radius:4px;
  background:#FFB454;color:#241402;
}
.hud-col-empty{
  border:1px dashed rgba(150,240,195,.13);border-radius:10px;
  padding:18px 6px;text-align:center;color:rgba(223,234,245,.25);font-size:10.5px;font-style:italic;
}
.hud-legend{
  display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin-top:14px;
  font-size:10.5px;color:rgba(223,234,245,.45);
}
.hud-legend-dot{
  width:7px;height:7px;border-radius:50%;flex:none;margin-top:1px;
}

/* ---- Shared panel content helpers ---- */
.hud-orb-row {
  display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;
}
.hud-orb {
  flex:1;min-width:56px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  border-radius:12px;padding:10px 8px;text-align:center;
}
.hud-orb-val {
  font-family:'JetBrains Mono','Fira Mono','Consolas',monospace;
  font-size:18px;font-weight:700;color:#5BE9B0;display:block;line-height:1;
}
.hud-orb-lbl {font-size:9.5px;color:rgba(223,234,245,.6);margin-top:4px;display:block;line-height:1.3}
.hud-progress-bar {
  height:6px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:4px;
}
.hud-progress-fill {
  height:100%;border-radius:999px;background:linear-gradient(90deg,#5BE9B0,#5FD0DE);
}
@media (prefers-reduced-motion:no-preference){
  .hud-progress-fill{transition:width 300ms ease-out}
}
.hud-section-label {
  font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
  color:rgba(223,234,245,.45);margin-bottom:6px;margin-top:10px;
}
.hud-section-label:first-child{margin-top:0}
.hud-empty {font-size:11.5px;color:rgba(223,234,245,.38);text-align:center;padding:12px 0}

/* Crew rows */
.hud-you-row {
  background:rgba(255,180,84,.08);border:1px solid rgba(255,180,84,.22);border-radius:10px;
  padding:8px 10px;margin-bottom:10px;
}
.hud-you-label {font-size:11.5px;font-weight:600;color:#FFB454}
.hud-you-sub {font-size:10.5px;color:rgba(223,234,245,.6);margin-top:2px}
.hud-crew-row {display:flex;align-items:center;gap:8px;margin-bottom:8px}
.hud-crew-label {flex:0 0 72px;font-size:11.5px;color:rgba(223,234,245,.7);white-space:nowrap}
.hud-crew-bars {flex:1;display:flex;gap:2px;align-items:center}
.hud-crew-bar {height:6px;border-radius:3px;min-width:2px}
.hud-crew-sub {font-size:10px;color:rgba(223,234,245,.45);margin-top:1px}

/* Env panel */
.hud-env-cols{display:flex;gap:6px}
.hud-env-col{flex:1;min-width:0}
.hud-env-head{
  font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
  color:rgba(223,234,245,.5);margin-bottom:6px;display:flex;align-items:center;gap:5px;
}
.hud-env-tag{
  font-size:8.5px;font-weight:700;letter-spacing:.07em;padding:1px 5px;border-radius:4px;
  background:rgba(255,180,84,.18);color:#FFB454;border:1px solid rgba(255,180,84,.28);
}
.hud-env-card{
  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);
  border-radius:7px;padding:5px 7px;margin-bottom:4px;
}
.hud-env-id{
  font-family:'JetBrains Mono','Fira Mono','Consolas',monospace;
  font-size:9.5px;color:rgba(223,234,245,.45);
}
.hud-env-name{font-size:10.5px;color:rgba(223,234,245,.8);margin-top:1px;line-height:1.3}
.hud-env-empty{font-size:11px;color:rgba(223,234,245,.3)}

/* Backlog panel */
.hud-bl-item{display:flex;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.07)}
.hud-bl-item:last-child{border-bottom:0}
.hud-bl-id{
  font-family:'JetBrains Mono','Fira Mono','Consolas',monospace;
  font-size:9.5px;color:rgba(223,234,245,.45);flex:none;margin-top:2px;
}
.hud-bl-text{font-size:11px;color:rgba(223,234,245,.8);line-height:1.4;flex:1}
.hud-bl-epic{font-size:9.5px;color:rgba(223,234,245,.45)}

/* Gates panel */
.hud-gate-item{padding:8px 0;border-bottom:1px solid rgba(255,255,255,.07)}
.hud-gate-item:last-child{border-bottom:0}
.hud-gate-title{font-size:12px;color:rgba(223,234,245,.9);line-height:1.4}
.hud-gate-meta{font-size:10px;color:rgba(223,234,245,.45);margin-top:2px}
.hud-gate-link{
  display:inline-flex;align-items:center;gap:4px;margin-top:6px;
  font-size:11px;font-weight:600;color:#5BE9B0;text-decoration:none;
  padding:4px 10px;border:1px solid rgba(91,233,176,.28);border-radius:6px;
  background:rgba(91,233,176,.06);transition:background 120ms;min-height:32px;
}
.hud-gate-link:hover{background:rgba(91,233,176,.14)}
.hud-gate-link:focus-visible{outline:2px solid rgba(91,233,176,.8);outline-offset:2px}

/* Scope switcher inside panel */
.hud-seg-group {
  display:flex;gap:0;border:1px solid rgba(150,240,195,.13);border-radius:8px;overflow:hidden;margin-bottom:8px;
}
.hud-seg-tab {
  flex:1;padding:6px 10px;font-size:11px;font-weight:600;cursor:pointer;
  color:rgba(223,234,245,.6);background:transparent;border:none;
  transition:background 120ms,color 120ms;min-height:36px;
}
.hud-seg-tab[aria-selected="true"]{background:rgba(91,233,176,.18);color:#5BE9B0}
.hud-seg-tab:focus-visible{outline:2px solid rgba(91,233,176,.8);outline-offset:-2px}
.hud-filter-row{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px}
.hud-filter-btn{
  font-size:10.5px;font-weight:600;padding:4px 10px;border-radius:999px;cursor:pointer;min-height:30px;
  background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13);
  color:rgba(223,234,245,.6);transition:background 120ms,color 120ms;
}
.hud-filter-btn[aria-pressed="true"]{
  background:rgba(91,233,176,.18);border-color:rgba(91,233,176,.4);color:#5BE9B0;
}
.hud-filter-btn:focus-visible{outline:2px solid rgba(91,233,176,.8);outline-offset:2px}
.hud-epic-list{max-height:240px;overflow-y:auto}
.hud-epic-item{
  display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:9px;cursor:pointer;
  background:transparent;border:none;width:100%;text-align:left;min-height:44px;
  color:rgba(223,234,245,.85);font-size:12px;transition:background 120ms;
}
.hud-epic-item:hover,.hud-epic-item:focus-visible{background:rgba(255,255,255,.07)}
.hud-epic-item:focus-visible{outline:2px solid rgba(91,233,176,.8);outline-offset:2px}
.hud-epic-name{flex:1;font-weight:600;line-height:1.3}
.hud-epic-pct{
  font-family:'JetBrains Mono','Fira Mono','Consolas',monospace;
  font-size:10px;color:rgba(223,234,245,.5);flex:none;
}
.hud-epic-chip{
  font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;flex:none;
  border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);
  color:rgba(223,234,245,.5);
}
.hud-epic-chip.prog{color:#5FD0DE;border-color:rgba(95,208,222,.3);background:rgba(95,208,222,.08)}
.hud-epic-chip.done{color:#5BE9B0;border-color:rgba(91,233,176,.3);background:rgba(91,233,176,.08)}
.hud-epic-chip.todo{color:rgba(223,234,245,.4)}
.hud-back-btn{
  display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;
  color:rgba(223,234,245,.6);cursor:pointer;border:none;background:none;
  padding:6px 8px;border-radius:7px;transition:color 120ms,background 120ms;min-height:36px;
}
.hud-back-btn:hover{color:rgba(223,234,245,.9);background:rgba(255,255,255,.06)}
.hud-back-btn:focus-visible{outline:2px solid rgba(91,233,176,.8);outline-offset:2px}

/* Trail (Epic progress panel) */
.hud-trail-wrap{position:relative;margin-bottom:28px}
.hud-trail{display:flex;align-items:center;gap:0;margin-bottom:14px;position:relative}
.hud-trail-seg{flex:1;height:3px;background:rgba(255,255,255,.1)}
.hud-trail-seg.run{background:linear-gradient(90deg,#5BE9B0,#5FD0DE)}
.hud-trail-seg.gate{background:#FFB454}
.hud-trail-seg.done{background:#5BE9B0}
.hud-trail-node{
  width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,.2);
  background:rgba(14,24,40,.9);display:flex;align-items:center;justify-content:center;
  font-size:8px;z-index:2;flex:none;cursor:default;position:relative;
}
.hud-trail-node.run{border-color:#5BE9B0;background:rgba(91,233,176,.18);box-shadow:0 0 8px rgba(91,233,176,.5)}
.hud-trail-node.gate{border-color:#FFB454;background:rgba(255,180,84,.18);box-shadow:0 0 8px rgba(255,180,84,.5)}
.hud-trail-node.done{border-color:#5BE9B0;background:rgba(91,233,176,.12)}
.hud-trail-node.q{border-color:rgba(95,208,222,.4);background:rgba(95,208,222,.06)}
.hud-trail-label{
  position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);
  white-space:nowrap;font-size:9px;color:rgba(223,234,245,.5);pointer-events:none;
}
.hud-trail-label.run{color:#5BE9B0}
.hud-trail-label.gate{color:#FFB454}

/* Up-next panel */
.hud-queue-item{display:flex;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.07);align-items:flex-start}
.hud-queue-item:last-child{border-bottom:0}
.hud-queue-id{
  font-family:'JetBrains Mono','Fira Mono','Consolas',monospace;
  font-size:9.5px;color:rgba(223,234,245,.4);flex:none;margin-top:1px;
}
.hud-queue-title{font-size:11px;color:rgba(223,234,245,.8);line-height:1.4;flex:1}

/* View switch → single "Dashboard" button, top-LEFT (top-centre is freed for content) */
.hud-view-toggle {
  display:inline-flex;align-items:center;gap:8px;
  padding:0 16px;min-height:44px;
  border:1px solid rgba(150,240,195,.13);
  border-radius:999px;
  background:rgba(11,30,24,.52);
  backdrop-filter:saturate(195%) blur(26px);
  -webkit-backdrop-filter:saturate(195%) blur(26px);
  box-shadow:0 8px 24px rgba(0,0,0,.32),inset 0 1px 0 rgba(200,255,232,.12);
  color:rgba(223,234,245,.82);
  font-size:12.5px;font-weight:600;text-decoration:none;
  transition:background 120ms,color 120ms,border-color 120ms;
}
.hud-view-toggle:hover{background:rgba(91,233,176,.14);color:#5BE9B0;border-color:rgba(91,233,176,.3)}
.hud-view-toggle:focus-visible{outline:2px solid rgba(91,233,176,.85);outline-offset:2px}
.hud-view-toggle svg{display:block;flex:none}
/* ── Top filter: cascading signposts (Persona→Feature→Epic) ── */
.hud-signposts{display:inline-flex;align-items:center;flex:none}
.hud-signpost-wrap{position:relative;display:inline-flex}
.hud-signpost{
  display:inline-flex;align-items:center;gap:7px;
  padding:0 13px;min-height:40px;
  border:1px solid rgba(150,240,195,.13);
  background:rgba(11,30,24,.50);
  backdrop-filter:saturate(195%) blur(26px);-webkit-backdrop-filter:saturate(195%) blur(26px);
  box-shadow:inset 0 1px 0 rgba(200,255,232,.10);
  color:rgba(223,234,245,.78);font-size:12px;font-weight:600;cursor:pointer;
  transition:background 120ms,color 120ms,border-color 120ms;
}
.hud-signpost-wrap:first-child .hud-signpost{border-radius:999px 0 0 999px;padding-left:15px}
.hud-signpost-wrap:last-child .hud-signpost{border-radius:0 999px 999px 0;padding-right:15px}
.hud-signpost-wrap:not(:first-child) .hud-signpost{border-left:none}
.hud-signpost:hover{background:rgba(91,233,176,.12);color:rgba(223,234,245,.96)}
.hud-signpost.active{color:#5BE9B0}
.hud-sp-icon{display:inline-flex;opacity:.85}
.hud-sp-label{max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hud-sp-caret{opacity:.55;margin-left:2px;display:block;flex:none}
.hud-signpost-menu{
  position:absolute;top:calc(100% + 7px);left:0;z-index:30;width:220px;max-height:62vh;overflow-y:auto;
  display:flex;flex-direction:column;gap:1px;padding:6px;
  border:1px solid rgba(150,240,195,.16);border-radius:14px;
  background:rgba(11,30,24,.72);
  backdrop-filter:saturate(195%) blur(30px);-webkit-backdrop-filter:saturate(195%) blur(30px);
  box-shadow:0 18px 44px rgba(0,0,0,.5),inset 0 1px 0 rgba(200,255,232,.12);
}
.hud-sp-opt{
  display:block;width:100%;
  text-align:left;padding:9px 12px;border-radius:9px;
  font-size:12px;color:rgba(223,234,245,.78);cursor:pointer;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  transition:background 100ms,color 100ms;
}
.hud-sp-opt:hover{background:rgba(91,233,176,.12);color:rgba(223,234,245,.96)}
.hud-sp-opt.sel{background:rgba(91,233,176,.15);color:#5BE9B0}
/* status chips — second floating row under the filter */
.hud-efilter{
  position:fixed;top:64px;left:18px;z-index:22;
  display:inline-flex;align-items:center;gap:4px;
  padding:5px 8px;border-radius:999px;
  border:1px solid rgba(150,240,195,.12);background:rgba(11,30,24,.45);
  backdrop-filter:saturate(195%) blur(24px);-webkit-backdrop-filter:saturate(195%) blur(24px);
  box-shadow:inset 0 1px 0 rgba(200,255,232,.08);
}
.hud-ef-chip{
  padding:5px 11px;border-radius:999px;font-size:11px;font-weight:600;cursor:pointer;
  color:rgba(223,234,245,.6);transition:background 100ms,color 100ms;
}
.hud-ef-chip:hover{color:rgba(223,234,245,.9)}
.hud-ef-chip.on{background:rgba(91,233,176,.16);color:#5BE9B0}

/* ── Summary card (Step 3, left panel below top bar) ── */
/* Summary + Approval cards — positioned by .hud-left-panels wrapper in campsite-scene.tsx */
.hud-summary{}
.hud-sum-chip{
  display:inline-flex;align-items:center;gap:7px;
  padding:7px 14px;border-radius:999px;cursor:pointer;
  border:1px solid rgba(150,240,195,.13);
  background:rgba(11,30,24,.52);
  backdrop-filter:saturate(195%) blur(26px);-webkit-backdrop-filter:saturate(195%) blur(26px);
  box-shadow:0 4px 16px rgba(0,0,0,.28),inset 0 1px 0 rgba(200,255,232,.10);
  color:rgba(223,234,245,.78);font-size:12px;font-weight:600;
  transition:background 120ms,color 120ms;
}
.hud-sum-chip:hover{background:rgba(91,233,176,.10);color:rgba(223,234,245,.92)}
.hud-sum-chip-pct{color:#5BE9B0;font-weight:700}
.hud-sum-chip-dot{opacity:.4;margin:0 1px}
.hud-sum-chip-caret{opacity:.5;display:block;flex:none}
.hud-sum-chip-item{display:inline-flex;align-items:center;gap:4px}
.hud-sum-today-item{display:inline-flex;align-items:center;gap:4px}
.hud-sum-mini{padding:6px 12px 12px}
/* 5 kanban lane chips in a 2-col grid */
.hud-sum-mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
.hud-sum-mini-lane{
  display:flex;align-items:center;gap:6px;
  padding:7px 10px;border-radius:10px;
  background:rgba(91,233,176,.05);border:1px solid rgba(150,240,195,.11);
}
.hud-sum-mini-dot{width:6px;height:6px;border-radius:99px;flex:none}
@keyframes mini-dot-pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(91,233,176,.4)}50%{opacity:.8;box-shadow:0 0 0 3px rgba(91,233,176,.15)}}
.hud-sum-mini-dot.dot-inprog{animation:mini-dot-pulse 2s ease-in-out infinite}
.hud-sum-mini-cnt{font-size:13px;font-weight:800;line-height:1;flex:none}
.hud-sum-mini-lbl{font-size:9.5px;font-weight:600;letter-spacing:.02em;opacity:.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hud-sum-card{
  width:220px;border-radius:18px;overflow:hidden;
  border:1px solid rgba(150,240,195,.13);
  background:rgba(11,30,24,.60);
  backdrop-filter:saturate(195%) blur(28px);-webkit-backdrop-filter:saturate(195%) blur(28px);
  box-shadow:0 12px 36px rgba(0,0,0,.44),inset 0 1px 0 rgba(200,255,232,.12);
}
.hud-sum-head{
  display:flex;align-items:center;justify-content:space-between;
  padding:11px 14px 0;
}
.hud-sum-heading{font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(223,234,245,.38)}
.hud-sum-collapse{
  display:flex;align-items:center;justify-content:center;
  width:26px;height:26px;border-radius:8px;border:none;
  background:transparent;color:rgba(223,234,245,.38);cursor:pointer;
  transition:background 110ms,color 110ms;
}
.hud-sum-collapse:hover{background:rgba(91,233,176,.10);color:rgba(91,233,176,.85)}
.hud-sum-body{padding:4px 16px 14px}
.hud-sum-gauge{margin:6px 0 10px}
.hud-sum-row{
  display:flex;align-items:center;justify-content:space-between;
  padding:3px 0;font-size:12.5px;color:rgba(223,234,245,.65);
}
.hud-sum-row-l{display:flex;align-items:center;gap:5px}
.hud-sum-count{font-size:13px;font-weight:700;color:rgba(223,234,245,.9)}
.hud-sum-sep{height:1px;background:rgba(150,240,195,.09);margin:8px 0 6px}
.hud-sum-today-label{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:rgba(91,233,176,.5);text-align:center;margin-bottom:5px}
.hud-sum-today{display:flex;align-items:center;justify-content:center;gap:8px;font-size:12.5px;font-weight:600;color:rgba(223,234,245,.8);padding-bottom:8px}
.hud-sum-today-none{font-size:11.5px;color:rgba(223,234,245,.3);text-align:center;padding-bottom:8px}
.hud-sum-spark-label{font-size:9.5px;color:rgba(223,234,245,.28);text-align:right;margin-bottom:3px}
.hud-spark{display:flex;align-items:flex-end;gap:3px;height:30px}
.hud-spark-bar{flex:1;background:#5BE9B0;border-radius:3px 3px 2px 2px;min-height:2px;transition:height .4s ease}
/* ── Delivery card ── */
.hud-dlv-card{
  width:220px;border-radius:18px;overflow:hidden;
  border:1px solid rgba(150,240,195,.13);
  background:rgba(11,30,24,.60);
  backdrop-filter:saturate(195%) blur(28px);-webkit-backdrop-filter:saturate(195%) blur(28px);
  box-shadow:0 12px 36px rgba(0,0,0,.44),inset 0 1px 0 rgba(200,255,232,.12);
}
.hud-dlv-head{display:flex;align-items:center;justify-content:space-between;padding:11px 14px 0}
.hud-dlv-heading{font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(223,234,245,.38)}
.hud-dlv-collapse{
  display:flex;align-items:center;justify-content:center;
  width:26px;height:26px;border-radius:8px;border:none;
  background:transparent;color:rgba(223,234,245,.38);cursor:pointer;
  transition:background 110ms,color 110ms;
}
.hud-dlv-collapse:hover{background:rgba(91,233,176,.10);color:rgba(91,233,176,.85)}
.hud-dlv-tabs{
  display:flex;gap:4px;padding:8px 14px 0;
}
.hud-dlv-tab{
  flex:1;padding:5px 0;border-radius:999px;font-size:10.5px;font-weight:700;
  text-align:center;cursor:pointer;border:1px solid rgba(150,240,195,.1);
  background:transparent;color:rgba(223,234,245,.45);
  transition:background 110ms,color 110ms,border-color 110ms;
}
.hud-dlv-tab:hover{color:rgba(223,234,245,.75)}
.hud-dlv-tab.on{background:rgba(91,233,176,.15);border-color:rgba(91,233,176,.3);color:#5BE9B0}
.hud-dlv-body{padding:10px 14px 14px}
/* big-number view (today / week headline) */
.hud-dlv-nums{display:flex;gap:8px;margin-bottom:4px}
.hud-dlv-num{
  flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;
  padding:10px 6px;border-radius:12px;
  background:rgba(91,233,176,.07);border:1px solid rgba(91,233,176,.12);
}
.hud-dlv-big{font-size:28px;font-weight:800;color:#5BE9B0;line-height:1}
.hud-dlv-sub{display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:600;color:rgba(223,234,245,.45);letter-spacing:.05em;text-transform:uppercase}
@keyframes dlv-pulse{
  0%,100%{color:#5BE9B0;text-shadow:0 0 0 rgba(91,233,176,0);transform:scale(1)}
  50%{color:#8fffd6;text-shadow:0 0 14px rgba(91,233,176,.7),0 0 32px rgba(91,233,176,.3);transform:scale(1.06)}
}
.hud-dlv-pulse{animation:dlv-pulse 2.4s ease-in-out infinite}
.hud-dlv-empty{font-size:11.5px;color:rgba(223,234,245,.3);text-align:center;padding:14px 0}
/* sparkline (week) */
.hud-dlv-spark{display:flex;align-items:flex-end;gap:3px;height:44px;margin-bottom:8px}
.hud-dlv-bar{flex:1;background:#5BE9B0;border-radius:3px 3px 2px 2px;min-height:2px}
.hud-dlv-total{font-size:11.5px;color:rgba(223,234,245,.55);text-align:center}
.hud-dlv-total strong{color:rgba(223,234,245,.85);font-size:13px}
/* progress rows (all) */
.hud-dlv-prog-row{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.hud-dlv-prog-label{font-size:11.5px;color:rgba(223,234,245,.55);width:42px;flex:none;display:flex;align-items:center;gap:4px}
.hud-dlv-prog-bar{flex:1;height:6px;border-radius:3px;background:rgba(91,233,176,.1);overflow:hidden}
.hud-dlv-prog-fill{height:100%;background:#5BE9B0;border-radius:3px;transition:width .6s ease}
.hud-dlv-prog-val{font-size:11px;font-weight:700;color:rgba(223,234,245,.7);flex:none;width:40px;text-align:right}
/* mini (collapsed) */
.hud-dlv-mini{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:6px 14px 12px;font-size:12px;font-weight:600;color:rgba(223,234,245,.7)}
.hud-dlv-mini-val{color:#5BE9B0;font-size:13px;font-weight:700}
/* ── Approval card ── */
.hud-appr-card{
  width:220px;border-radius:18px;overflow:hidden;
  border:1px solid rgba(255,190,80,.18);
  background:rgba(11,30,24,.60);
  backdrop-filter:saturate(195%) blur(28px);-webkit-backdrop-filter:saturate(195%) blur(28px);
  box-shadow:0 8px 28px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,220,130,.08);
}
.hud-appr-head{
  display:flex;align-items:center;gap:7px;justify-content:space-between;
  padding:11px 14px 0;
}
.hud-appr-heading{display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,190,80,.7)}
.hud-appr-mini{
  display:flex;align-items:center;justify-content:space-between;
  padding:6px 14px 12px;
  font-size:12px;font-weight:600;color:rgba(223,234,245,.7);
}
.hud-appr-mini-label{display:flex;align-items:center;gap:6px;color:rgba(255,190,80,.85)}
.hud-appr-body{padding:6px 14px 12px;display:flex;flex-direction:column;gap:4px}
.hud-appr-item{
  display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:10px;
  background:rgba(255,190,80,.06);border:1px solid rgba(255,190,80,.12);
}
.hud-appr-badge{
  flex:none;padding:2px 7px;border-radius:99px;font-size:9.5px;font-weight:700;letter-spacing:.04em;
  background:rgba(255,190,80,.2);color:rgba(255,200,80,.9);
}
.hud-appr-title{flex:1;min-width:0;font-size:11.5px;color:rgba(223,234,245,.8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hud-appr-link{
  flex:none;display:inline-flex;align-items:center;
  color:rgba(223,234,245,.35);transition:color 110ms;
}
.hud-appr-link:hover{color:rgba(91,233,176,.8)}
.hud-appr-btn{
  display:flex;align-items:center;justify-content:center;gap:6px;
  margin:4px 0 0;padding:9px 14px;border-radius:12px;
  background:rgba(255,190,80,.12);border:1px solid rgba(255,190,80,.2);
  font-size:12px;font-weight:700;color:rgba(255,200,80,.9);
  cursor:pointer;transition:background 120ms,border-color 120ms;width:100%;
}
.hud-appr-btn:hover{background:rgba(255,190,80,.2);border-color:rgba(255,190,80,.36)}
.hud-appr-collapse{
  display:flex;align-items:center;justify-content:center;
  width:26px;height:26px;border-radius:8px;border:none;
  background:transparent;color:rgba(255,190,80,.45);cursor:pointer;
  transition:background 110ms,color 110ms;
}
.hud-appr-collapse:hover{background:rgba(255,190,80,.1);color:rgba(255,190,80,.9)}

/* Epic open board button inside dock */
.hud-board-btn {
  display:inline-flex;align-items:center;gap:6px;
  padding:10px 20px;min-height:48px;
  font-size:12.5px;font-weight:700;
  color:#5BE9B0;
  border-left:1px solid rgba(91,233,176,.2);
  cursor:pointer;background:rgba(91,233,176,.08);
  border:none;border-radius:0 999px 999px 0;
  transition:background 140ms;flex-shrink:0;
}
.hud-board-btn:hover{background:rgba(91,233,176,.16)}
.hud-board-btn:focus-visible{outline:2px solid rgba(91,233,176,.8);outline-offset:-2px}

/* ── Status Board right panel ── */
.hud-sb-card{
  width:220px;border-radius:18px;
  border:1px solid rgba(150,240,195,.13);
  background:rgba(11,30,24,.60);
  backdrop-filter:saturate(195%) blur(28px);-webkit-backdrop-filter:saturate(195%) blur(28px);
  box-shadow:0 12px 36px rgba(0,0,0,.44),inset 0 1px 0 rgba(200,255,232,.12);
  /* flex:1 so it fills remaining space in the right-panels container */
  display:flex;flex-direction:column;overflow:hidden;flex:1;min-height:0;
}
.hud-sb-head{display:flex;align-items:center;justify-content:space-between;padding:11px 14px 0;flex:none}
.hud-sb-heading{font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(223,234,245,.38)}
.hud-sb-collapse{
  display:flex;align-items:center;justify-content:center;
  width:26px;height:26px;border-radius:8px;border:none;
  background:transparent;color:rgba(223,234,245,.38);cursor:pointer;
  transition:background 110ms,color 110ms;
}
.hud-sb-collapse:hover{background:rgba(91,233,176,.10);color:rgba(91,233,176,.85)}
/* body scrolls when content exceeds available card height */
.hud-sb-body{
  padding:8px 10px 10px;display:flex;flex-direction:column;gap:0;
  overflow-y:auto;flex:1;
  scrollbar-width:thin;scrollbar-color:rgba(91,233,176,.18) transparent;
}
.hud-sb-body::-webkit-scrollbar{width:4px}
.hud-sb-body::-webkit-scrollbar-track{background:transparent}
.hud-sb-body::-webkit-scrollbar-thumb{background:rgba(91,233,176,.2);border-radius:4px}
/* empty lane — compact single-line (no extra row, just dimmed count) */
.hud-sb-lane-empty .hud-sb-lane-head{padding-bottom:6px;opacity:.55}
/* lane header */
.hud-sb-lane-head{
  display:flex;align-items:center;gap:6px;
  padding:6px 2px 5px;
  font-size:11px;font-weight:700;letter-spacing:.03em;
}
.hud-sb-lane-cnt{margin-left:auto;font-size:10.5px;font-weight:600;color:rgba(223,234,245,.42)}
.hud-sb-dot{display:inline-block;width:6px;height:6px;border-radius:99px;flex:none}
.hud-sb-dot.dot-backlog{background:#8a9aa8}
.hud-sb-dot.dot-todo{background:#8FB8F0}
@keyframes sb-dot-pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(91,233,176,.4)}50%{opacity:.8;box-shadow:0 0 0 3px rgba(91,233,176,.15)}}
.hud-sb-dot.dot-inprog{background:#5BE9B0;animation:sb-dot-pulse 2s ease-in-out infinite}
.hud-sb-dot.dot-review{background:#B7A6FF}
.hud-sb-dot.dot-done{background:#76E0AE}
/* lane header label color per lane */
.hud-sb-lane-head.lh-backlog{color:#aebcc9}
.hud-sb-lane-head.lh-todo{color:#8FB8F0}
.hud-sb-lane-head.lh-inprog{color:#5BE9B0}
.hud-sb-lane-head.lh-review{color:#B7A6FF}
.hud-sb-lane-head.lh-done{color:#76E0AE}
/* story card — .kc structure, green-glass HUD palette */
.hud-kc{
  border-radius:12px;padding:10px 11px;margin-bottom:7px;
  border:1px solid rgba(150,240,195,.13);
  background:rgba(91,233,176,.05);
  display:block;min-width:0;text-decoration:none;color:inherit;
}
.hud-kc:last-child{margin-bottom:0}
@keyframes hud-kc-glow{
  0%,100%{box-shadow:none;border-color:rgba(91,233,176,.28)}
  50%{box-shadow:0 0 14px rgba(91,233,176,.22),0 0 4px rgba(91,233,176,.12);border-color:rgba(91,233,176,.7)}
}
.hud-kc.prog{
  border-color:rgba(91,233,176,.35);
  background:rgba(91,233,176,.09);
  animation:hud-kc-glow 2.4s ease-in-out infinite;
}
.hud-kc.gate{
  border-color:rgba(255,150,52,.45);
  background:linear-gradient(160deg,rgba(255,150,52,.09),rgba(91,233,176,.04));
}
/* title row — role icon + title text */
.hud-kt{font-size:12px;color:rgba(223,234,245,.88);line-height:1.35;display:flex;gap:6px;align-items:flex-start;min-width:0}
.hud-kt svg{width:13px;height:13px;flex:none;margin-top:1px;color:rgba(91,233,176,.5)}
.hud-kt span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* bottom row — role label + story id */
.hud-kb{display:flex;align-items:center;justify-content:space-between;margin-top:7px;min-width:0;gap:6px}
.hud-kr{font-size:10.5px;color:rgba(223,234,245,.45);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hud-kc.prog .hud-kr{color:#5BE9B0;font-weight:600}
.hud-kc.gate .hud-kr{color:rgba(255,180,80,.85)}
.hud-tk{font-size:9.5px;color:rgba(223,234,245,.3);flex:none;font-variant-numeric:tabular-nums}
/* empty lane */
.hud-sb-empty{font-size:10.5px;color:rgba(223,234,245,.22);padding:4px 2px 6px;font-style:italic}
/* "+N" overflow */
.hud-sb-more{font-size:10.5px;color:rgba(223,234,245,.38);padding:3px 2px 4px;font-weight:600}
/* see-all button — pinned at bottom of scrollable body */
.hud-sb-seeall{
  display:flex;align-items:center;justify-content:center;gap:5px;
  margin:8px 0 2px;padding:8px 0;border-radius:11px;flex:none;
  background:rgba(91,233,176,.08);border:1px solid rgba(91,233,176,.15);
  font-size:11.5px;font-weight:700;color:rgba(91,233,176,.75);
  cursor:pointer;transition:background 110ms,border-color 110ms;width:100%;position:sticky;bottom:0;
}
.hud-sb-seeall:hover{background:rgba(91,233,176,.15);border-color:rgba(91,233,176,.3)}
/* mini (collapsed) */
.hud-sb-mini{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:6px 14px 12px;font-size:11.5px;color:rgba(223,234,245,.55);font-weight:600}
.hud-sb-mini-cnt{color:rgba(91,233,176,.8);font-size:12px;font-weight:700}
/* hint chip when Feature not selected */
.hud-board-hint{
  display:inline-flex;align-items:center;padding:8px 14px;border-radius:12px;
  background:rgba(11,30,24,.5);border:1px solid rgba(150,240,195,.1);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  font-size:11px;font-weight:600;color:rgba(91,233,176,.4);pointer-events:none;
}
/* ── Team Roster panel ── */
.hud-team-card{
  width:220px;border-radius:18px;
  border:1px solid rgba(150,240,195,.13);
  background:rgba(11,30,24,.60);
  backdrop-filter:saturate(195%) blur(28px);-webkit-backdrop-filter:saturate(195%) blur(28px);
  box-shadow:0 12px 36px rgba(0,0,0,.44),inset 0 1px 0 rgba(200,255,232,.12);
  display:flex;flex-direction:column;overflow:hidden;flex:none;
}
.hud-team-head{display:flex;align-items:center;justify-content:space-between;padding:11px 14px 0;flex:none}
.hud-team-heading{font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(223,234,245,.38)}
.hud-team-collapse{
  display:flex;align-items:center;justify-content:center;
  width:26px;height:26px;border-radius:8px;border:none;
  background:transparent;color:rgba(223,234,245,.38);cursor:pointer;
  transition:background 110ms,color 110ms;
}
.hud-team-collapse:hover{background:rgba(91,233,176,.10);color:rgba(91,233,176,.85)}
.hud-team-body{padding:8px 10px 10px;display:flex;flex-direction:column;gap:4px;overflow-y:auto;flex:1;scrollbar-width:thin;scrollbar-color:rgba(91,233,176,.18) transparent}
.hud-team-body::-webkit-scrollbar{width:4px}
.hud-team-body::-webkit-scrollbar-thumb{background:rgba(91,233,176,.2);border-radius:4px}
/* role row */
.hud-role-row{
  display:flex;align-items:center;gap:7px;
  padding:7px 9px;border-radius:10px;
}
.hud-role-row.active{background:rgba(91,233,176,.08);border:1px solid rgba(91,233,176,.16)}
.hud-role-row.sleep{background:rgba(91,233,176,.02);border:1px solid rgba(150,240,195,.07)}
.hud-role-dot{width:7px;height:7px;border-radius:99px;flex:none}
@keyframes role-dot-pulse{0%,100%{box-shadow:0 0 0 0 rgba(91,233,176,.5)}50%{box-shadow:0 0 0 4px rgba(91,233,176,.1)}}
.hud-role-dot.active{background:#5BE9B0;animation:role-dot-pulse 2.2s ease-in-out infinite}
.hud-role-dot.sleep{background:rgba(223,234,245,.18)}
.hud-role-icon{flex:none;color:rgba(91,233,176,.5)}
.hud-role-row.sleep .hud-role-icon{color:rgba(223,234,245,.2)}
.hud-role-label{font-size:11.5px;font-weight:600;color:rgba(223,234,245,.82);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hud-role-row.sleep .hud-role-label{color:rgba(223,234,245,.32)}
.hud-role-badge{font-size:9px;font-weight:700;letter-spacing:.04em;flex:none;padding:2px 6px;border-radius:6px}
.hud-role-badge.active{color:#5BE9B0;background:rgba(91,233,176,.12)}
.hud-role-badge.sleep{color:rgba(223,234,245,.25);background:rgba(223,234,245,.05)}
/* mini (collapsed) — dot cluster row */
.hud-team-mini{padding:7px 12px 12px;display:flex;flex-direction:column;gap:6px}
.hud-team-mini-dots{display:flex;gap:5px;align-items:center}
.hud-team-mini-dot{width:9px;height:9px;border-radius:99px;flex:none}
.hud-team-mini-dot.active{background:#5BE9B0;animation:role-dot-pulse 2.2s ease-in-out infinite}
.hud-team-mini-dot.sleep{background:rgba(223,234,245,.18)}
.hud-team-mini-txt{font-size:10.5px;color:rgba(223,234,245,.45);font-weight:600}
.hud-team-mini-txt strong{color:#5BE9B0;font-size:12px}
`;

// ── Focus trap helpers ────────────────────────────────────────────────────────

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  triggerRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!isOpen) return;
    const el = ref.current;
    if (!el) return;
    // Capture in a non-null const so closures see it as HTMLElement (not null).
    const container: HTMLElement = el;

    const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
    (focusables[0] ?? container).focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        triggerRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const els = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    function onClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (container.contains(t) || triggerRef.current?.contains(t)) return;
      onClose();
    }

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("mousedown", onClickOutside, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("mousedown", onClickOutside, true);
    };
  }, [isOpen, onClose, ref, triggerRef]);
}

// ── ExpandPanel — rises above the dock ────────────────────────────────────────

interface ExpandPanelProps {
  id: string;
  title: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
  anchorStyle?: React.CSSProperties;
  children: React.ReactNode;
}

function ExpandPanel({ id, title, triggerRef, isOpen, onClose, anchorStyle, children }: ExpandPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef as React.RefObject<HTMLElement | null>, triggerRef as React.RefObject<HTMLElement | null>, isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      id={`panel--hud-${id}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="hud-panel"
      style={anchorStyle}
      data-testid={`panel--hud-${id}`}
      tabIndex={-1}
    >
      <div className="hud-panel-head">
        <span className="hud-panel-title">{title}</span>
        <button
          type="button"
          className="hud-close"
          aria-label="ปิดแผง"
          onClick={() => { onClose(); triggerRef.current?.focus(); }}
        >
          ✕
        </button>
      </div>
      {children}
    </div>
  );
}

// ── KanbanModal — large centered modal ────────────────────────────────────────

interface KanbanModalProps {
  epicLabel: string;
  epicPct: number;
  stories: MapEpicStory[];
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
}

const BOARD_COLS: [string, string][] = [
  ["Backlog",     "Backlog"],
  ["Todo",        "Todo"],
  ["In Progress", "กำลังทำ"],
  ["In Review",   "ตรวจสอบ"],
  ["Done",        "เสร็จ"],
];

export function KanbanModal({ epicLabel, epicPct, stories, triggerRef, isOpen, onClose }: KanbanModalProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  useFocusTrap(boxRef as React.RefObject<HTMLElement | null>, triggerRef as React.RefObject<HTMLElement | null>, isOpen, onClose);

  if (!isOpen) return null;

  const running = stories.filter((s) => s.status === "In Progress").length;
  const inReview = stories.filter((s) => s.status === "In Review").length;
  const todo = stories.filter((s) => s.status === "Todo" || s.status === "Backlog").length;
  const done = stories.filter((s) => s.statusType === "completed" || s.status === "Done").length;
  const awaiting = stories.filter((s) => s.labels.includes("awaiting-you")).length;

  const byCol: Record<string, MapEpicStory[]> = {};
  BOARD_COLS.forEach(([k]) => { byCol[k] = []; });
  for (const s of stories) {
    const col = BOARD_COLS.find(([k]) => k === s.status)?.[0] ?? "Backlog";
    byCol[col].push(s);
  }

  return createPortal(
    <>
      <div
        className="hud-modal-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <div className="hud-modal" data-testid={`modal--hud-board`}>
        <div
          ref={boxRef}
          className="hud-modal-box"
          role="dialog"
          aria-modal="true"
          aria-label={`บอร์ด ${epicLabel}`}
          tabIndex={-1}
        >
          {/* Header */}
          <div className="hud-modal-head">
            <div className="hud-modal-titles">
              <div className="hud-modal-title">บอร์ด · {epicLabel}</div>
              <div className="hud-modal-sub">{stories.length} story ทั้งหมด</div>
            </div>
            <button
              type="button"
              className="hud-modal-close"
              aria-label="ปิดบอร์ด"
              onClick={() => { onClose(); triggerRef.current?.focus(); }}
            >
              ✕
            </button>
          </div>

          {/* Progress bar */}
          <div
            className="hud-modal-bar-wrap"
            role="progressbar"
            aria-valuenow={epicPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`ความคืบหน้า ${epicPct}%`}
          >
            <div className="hud-modal-bar-fill" style={{ width: `${epicPct}%` }} />
          </div>

          {/* Metric pills */}
          <div className="hud-metric-row">
            <div className="hud-metric" data-testid="metric--modal-run">
              <span className="hud-metric-val run">{running}</span>
              <span className="hud-metric-lbl">กำลังทำ</span>
            </div>
            <div className="hud-metric" data-testid="metric--modal-review">
              <span className="hud-metric-val rev">{inReview}</span>
              <span className="hud-metric-lbl">ตรวจสอบ</span>
            </div>
            <div className="hud-metric" data-testid="metric--modal-todo">
              <span className="hud-metric-val todo">{todo}</span>
              <span className="hud-metric-lbl">รอทำ</span>
            </div>
            <div className="hud-metric" data-testid="metric--modal-done">
              <span className="hud-metric-val done">{done}</span>
              <span className="hud-metric-lbl">เสร็จ</span>
            </div>
            {awaiting > 0 && (
              <div className="hud-metric" data-testid="metric--modal-await">
                <span className="hud-metric-val amber">{awaiting}</span>
                <span className="hud-metric-lbl">รอคุณ</span>
              </div>
            )}
          </div>

          {/* Empty state */}
          {stories.length === 0 ? (
            <div className="hud-empty" data-testid="empty--modal-board">ยังไม่มีสตอรีใน epic นี้</div>
          ) : (
            <>
              {/* Kanban columns */}
              <div className="hud-board" data-testid={`board--hud-${epicLabel}`}>
                {BOARD_COLS.map(([colKey, colLabel]) => (
                  <div key={colKey} className="hud-col" data-col={colKey} data-testid={`col--hud-board-${colKey}`}>
                    <div className="hud-col-head">
                      {colLabel} {byCol[colKey].length > 0 && `(${byCol[colKey].length})`}
                    </div>
                    {byCol[colKey].length === 0 ? (
                      <div className="hud-col-empty">—</div>
                    ) : (
                      byCol[colKey].map((s) => {
                        const isActive = s.status === "In Progress";
                        const hasAwait = s.labels.includes("awaiting-you");
                        const cardCls = isActive ? "active" : hasAwait ? "awaiting" : "";
                        const laneText = isActive ? "กำลังทำ" : hasAwait ? "รอคุณ" : colLabel;
                        return (
                          <div
                            key={s.id}
                            className={`hud-card ${cardCls}`}
                            data-testid={`card--hud-board-${s.id}`}
                          >
                            <div className="hud-card-lane">{laneText}</div>
                            <div className="hud-card-id">{s.id}</div>
                            <div className="hud-card-title">{s.title}</div>
                            <div className="hud-card-footer">
                              <span className="hud-card-role">
                                {s.role || "—"}
                              </span>
                              {hasAwait && (
                                <span className="hud-you-badge">รอคุณ</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="hud-legend">
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="hud-legend-dot" style={{ background: "rgba(91,233,176,.7)" }} />
                  กำลังทำ
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="hud-legend-dot" style={{ background: "rgba(255,150,52,.7)" }} />
                  รอคุณ
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Panel content sub-components ─────────────────────────────────────────────

const ROLE_DISPLAY: Record<string, string> = {
  "architect":          "Architect",
  "ux-designer":        "Designer",
  "backend-engineer":   "Backend",
  "frontend-engineer":  "Frontend",
  "devops-release":     "DevOps",
  "qa-engineer":        "QA",
  "security-reviewer":  "Security",
};

interface DeliveryPanelProps {
  projectPct: number;
  gateCount: number;
  epicsActive: number;
  totalEpics: number;
  backlogCount: number;
}

function DeliveryPanel({ projectPct, gateCount, epicsActive, totalEpics, backlogCount }: DeliveryPanelProps) {
  if (totalEpics === 0) {
    return <div className="hud-empty">ยังไม่มีสตอรีในโปรเจกต์</div>;
  }
  return (
    <>
      <div className="hud-orb-row">
        <div className="hud-orb" data-testid="orb--delivery-pct">
          <span className="hud-orb-val">{projectPct}%</span>
          <span className="hud-orb-lbl">สตอรีเสร็จแล้ว</span>
        </div>
        <div className="hud-orb" data-testid="orb--delivery-gates">
          <span className="hud-orb-val" style={{ color: gateCount > 0 ? "#FFB454" : "#5BE9B0" }}>
            {gateCount}
          </span>
          <span className="hud-orb-lbl">รออนุมัติจากคุณ</span>
        </div>
        <div className="hud-orb" data-testid="orb--delivery-epics">
          <span className="hud-orb-val">{epicsActive}/{totalEpics}</span>
          <span className="hud-orb-lbl">Epic ที่กำลังทำ</span>
        </div>
        <div className="hud-orb" data-testid="orb--delivery-backlog">
          <span className="hud-orb-val" style={{ color: "rgba(223,234,245,.8)" }}>
            {backlogCount}
          </span>
          <span className="hud-orb-lbl">สตอรีใน Backlog</span>
        </div>
      </div>
      <div
        className="hud-progress-bar"
        role="progressbar"
        aria-valuenow={projectPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`ความคืบหน้า ${projectPct}%`}
      >
        <div className="hud-progress-fill" style={{ width: `${projectPct}%` }} />
      </div>
    </>
  );
}

interface CrewPanelProps {
  agents: MapAgent[];
  gateCount: number;
}

function CrewPanel({ agents, gateCount }: CrewPanelProps) {
  return (
    <>
      <div className="hud-you-row" data-testid="row--crew-you">
        <div className="hud-you-label">คุณ (เจ้าของ)</div>
        <div className="hud-you-sub">
          {gateCount > 0 ? `${gateCount} gate รอตรวจ` : "ไม่มี gate รออนุมัติ"}
        </div>
      </div>
      {agents.map((a) => {
        const total = a.done + a.activeCount + a.queued;
        const doneW = total > 0 ? (a.done / total) * 100 : 0;
        const actW  = total > 0 ? (a.activeCount / total) * 100 : 0;
        const quW   = total > 0 ? (a.queued / total) * 100 : 0;
        const label = ROLE_DISPLAY[a.role] ?? a.role;
        return (
          <div key={a.role} className="hud-crew-row" data-testid={`row--crew-${a.role}`}>
            <span className="hud-crew-label">{label}</span>
            <div style={{ flex: 1 }}>
              <div className="hud-crew-bars">
                {doneW > 0 && (
                  <div className="hud-crew-bar" style={{ width: `${doneW}%`, background: "#5BE9B0" }} aria-label={`${a.done} เสร็จ`} />
                )}
                {actW > 0 && (
                  <div className="hud-crew-bar" style={{ width: `${actW}%`, background: "#5FD0DE" }} aria-label={`${a.activeCount} กำลังทำ`} />
                )}
                {quW > 0 && (
                  <div className="hud-crew-bar" style={{ width: `${quW}%`, background: "#8FB8F0" }} aria-label={`${a.queued} ในคิว`} />
                )}
                {total === 0 && (
                  <div className="hud-crew-bar" style={{ width: "100%", background: "rgba(255,255,255,.1)" }} aria-label="ยังไม่มีงาน" />
                )}
              </div>
              <div className="hud-crew-sub">{a.done} เสร็จ · {a.queued} ในคิว</div>
            </div>
          </div>
        );
      })}
    </>
  );
}

interface EnvPanelProps {
  envLanes: { dev: MapEnvItem[]; staging: MapEnvItem[]; prod: MapEnvItem[] };
}

function EnvPanel({ envLanes }: EnvPanelProps) {
  const cols: { key: "dev" | "staging" | "prod"; label: string }[] = [
    { key: "dev",     label: "Dev" },
    { key: "staging", label: "Staging" },
    { key: "prod",    label: "Prod" },
  ];
  return (
    <div className="hud-env-cols">
      {cols.map(({ key, label }) => {
        const items = envLanes[key];
        const isStaging = key === "staging";
        return (
          <div key={key} className="hud-env-col" data-testid={`col--env-${key}`}>
            <div className="hud-env-head">
              {label}
              {isStaging && items.length > 0 && (
                <span className="hud-env-tag">RELEASE</span>
              )}
            </div>
            {items.length === 0 ? (
              <div className="hud-env-empty">—</div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="hud-env-card" data-testid={`card--env-${item.id}`}>
                  <div className="hud-env-id">{item.id}</div>
                  <div className="hud-env-name">{item.title}</div>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

interface BacklogPanelProps {
  items: MapBacklogItem[];
}

function BacklogPanel({ items }: BacklogPanelProps) {
  if (items.length === 0) {
    return <div className="hud-empty">— ไม่มี story ใน backlog</div>;
  }
  const groups: Record<string, MapBacklogItem[]> = {};
  for (const item of items) {
    const k = item.role || "other";
    (groups[k] = groups[k] || []).push(item);
  }
  return (
    <>
      {Object.entries(groups).map(([role, roleItems]) => (
        <div key={role} data-testid={`grp--backlog-${role}`}>
          <div className="hud-section-label">{ROLE_DISPLAY[role] ?? role}</div>
          {roleItems.map((item) => (
            <div key={item.id} className="hud-bl-item" data-testid={`item--backlog-${item.id}`}>
              <span className="hud-bl-id">{item.id}</span>
              <span>
                <div className="hud-bl-text">{item.title}</div>
                {item.epicKey && <div className="hud-bl-epic">{item.epicKey}</div>}
              </span>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

interface GatesPanelProps {
  gates: MapGate[];
}

function GatesPanel({ gates }: GatesPanelProps) {
  if (gates.length === 0) {
    return (
      <div className="hud-empty" data-testid="empty--gates">
        ✓ ไม่มีงานรออนุมัติจากคุณตอนนี้
      </div>
    );
  }
  return (
    <>
      {gates.map((g) => (
        <div key={g.id} className="hud-gate-item" data-testid={`item--gate-${g.id}`}>
          <div className="hud-gate-title">{g.title}</div>
          <div className="hud-gate-meta">
            {g.epicKey && `${g.epicKey} · `}{g.priority}
          </div>
          <a
            href={g.url}
            className="hud-gate-link"
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

// ── Story shape adapter for status-derive ────────────────────────────────────

function storyAsIssue(s: MapEpicStory): Parameters<typeof stageOf>[0] {
  return {
    id: s.id,
    title: s.role ? `[${s.role}] ${s.title}` : s.title,
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

// ── ScopeSwitcherPanel ────────────────────────────────────────────────────────

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
  if (epics.length === 0) {
    return <div className="hud-empty">ยังไม่มี epic ในโปรเจกต์</div>;
  }

  const filtered = epics.filter((e) => {
    if (efilter === "prog") return e.bucket === "prog";
    if (efilter === "done") return e.bucket === "done";
    if (efilter === "todo") return e.bucket === "todo";
    return true;
  });

  const filterLabels: { key: "all" | "prog" | "done" | "todo"; label: string }[] = [
    { key: "all",  label: "ทั้งหมด" },
    { key: "prog", label: "กำลังทำ" },
    { key: "done", label: "เสร็จแล้ว" },
    { key: "todo", label: "ยังไม่เริ่ม" },
  ];

  return (
    <>
      <div className="hud-seg-group" role="tablist" aria-label="จัดกลุ่มตาม">
        {(["feature", "persona"] as const).map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={group === g}
            className="hud-seg-tab"
            onClick={() => onGroupChange(g)}
            data-testid={`segbtn--scope-group-${g}`}
          >
            {g === "feature" ? "Feature" : "Persona"}
          </button>
        ))}
      </div>

      <div className="hud-filter-row" role="group" aria-label="กรอง epic">
        {filterLabels.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={efilter === key}
            className="hud-filter-btn"
            onClick={() => onEfilterChange(key)}
            data-testid={`filterbtn--scope-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="hud-epic-list" role="listbox" aria-label="รายการ epic" data-testid="list--scope-epics">
        {filtered.length === 0 ? (
          <div className="hud-empty">ไม่มี epic ที่ตรงกับตัวกรอง</div>
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
                className="hud-epic-item"
                onClick={() => onSelectEpic(epic.key)}
                data-testid={`epicbtn--scope-${epic.key}`}
              >
                <span className="hud-epic-name">
                  <span style={{ display: "block" }}>{epic.label}</span>
                  <span style={{ display: "block", fontSize: "9.5px", color: "rgba(223,234,245,.4)", marginTop: "1px" }}>
                    {subLabel}
                  </span>
                </span>
                <span className={`hud-epic-chip ${epic.bucket}`}>
                  {epic.bucket === "prog" ? "กำลังทำ" : epic.bucket === "done" ? "เสร็จ" : "ยังไม่เริ่ม"}
                </span>
                <span className="hud-epic-pct">{pct}%</span>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}

// ── EpicProgressPanel ─────────────────────────────────────────────────────────

interface EpicProgressPanelProps {
  stories: MapEpicStory[];
}

function EpicProgressPanel({ stories }: EpicProgressPanelProps) {
  if (stories.length === 0) {
    return <div className="hud-empty">ยังไม่มีสตอรีใน epic นี้</div>;
  }

  const issues  = stories.map(storyAsIssue);
  const trail   = buildTrail(issues);
  const running = stories.filter((s) => s.status === "In Progress").length;
  const awaiting = stories.filter((s) => s.labels.includes("awaiting-you")).length;
  const shipped  = stories.filter((s) => s.statusType === "completed" || s.status === "Done").length;
  const queued   = stories.filter((s) => {
    return s.status !== "In Progress"
      && s.statusType !== "completed"
      && s.status !== "Done"
      && !s.labels.includes("awaiting-you");
  }).length;

  return (
    <>
      <div className="hud-trail-wrap" data-testid="trail--epic-progress">
        <div className="hud-trail">
          {trail.nodes.map((node, idx) => (
            <div key={node.name} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div className={`hud-trail-node ${node.cls}`} aria-label={`${node.name}: ${node.sub}`}>
                {node.cls === "run" && <span style={{ color: "#5BE9B0", fontSize: "9px" }}>▶</span>}
                {node.cls === "gate" && <span style={{ color: "#FFB454", fontSize: "9px" }}>⚑</span>}
                {node.cls === "done" && node.name === "Ship" && <span style={{ color: "#5BE9B0", fontSize: "9px" }}>✓</span>}
                <span className={`hud-trail-label ${node.cls}`}>{node.name}</span>
              </div>
              {idx < trail.nodes.length - 1 && (
                <div className={`hud-trail-seg ${trail.curIdx > idx ? "done" : node.cls === "run" ? "run" : node.cls === "gate" ? "gate" : ""}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="hud-orb-row">
        <div className="hud-orb" data-testid="orb--epic-run">
          <span className="hud-orb-val">{running}</span>
          <span className="hud-orb-lbl">กำลังทำ</span>
        </div>
        <div className="hud-orb" data-testid="orb--epic-need">
          <span className="hud-orb-val" style={{ color: awaiting > 0 ? "#FFB454" : "#5BE9B0" }}>{awaiting}</span>
          <span className="hud-orb-lbl">รอคุณ</span>
        </div>
        <div className="hud-orb" data-testid="orb--epic-queue">
          <span className="hud-orb-val" style={{ color: "rgba(223,234,245,.8)" }}>{queued}</span>
          <span className="hud-orb-lbl">ในคิว</span>
        </div>
        <div className="hud-orb" data-testid="orb--epic-ship">
          <span className="hud-orb-val">{shipped}</span>
          <span className="hud-orb-lbl">ส่งแล้ว</span>
        </div>
      </div>
    </>
  );
}

// ── EpicUpNextPanel ────────────────────────────────────────────────────────────

const COLS_ORDER: string[] = ["Backlog", "Todo", "In Progress", "In Review", "Done"];

function EpicUpNextPanel({ stories }: { stories: MapEpicStory[] }) {
  const queued = stories
    .filter((s) => {
      const isActive = s.status === "In Progress";
      const isDone   = s.statusType === "completed" || s.status === "Done";
      const hasAwait = s.labels.includes("awaiting-you");
      return !isActive && !isDone && !hasAwait;
    })
    .sort((a, b) => COLS_ORDER.indexOf(a.status) - COLS_ORDER.indexOf(b.status));

  if (queued.length === 0) {
    return <div className="hud-empty">— คิวว่าง</div>;
  }

  return (
    <div data-testid="list--epic-upnext">
      {queued.map((s) => (
        <div key={s.id} className="hud-queue-item" data-testid={`item--upnext-${s.id}`}>
          <span className="hud-queue-id">{s.id}</span>
          <span className="hud-queue-title">{s.title}</span>
        </div>
      ))}
    </div>
  );
}

// ── ViewToggle (top center) ────────────────────────────────────────────────────

interface ViewToggleProps {
  dashboardHref: string;
}

// ── Top filter: cascading signposts + status chips ───────────────────────────
const PERSONA_LABEL: Record<string, string> = {
  host: "Host", camper: "Camper", admin: "Admin", platform: "Platform",
};
const EF_OPTS: Array<[("all" | "prog" | "done" | "todo"), string]> = [
  ["all", "ทั้งหมด"], ["prog", "กำลังทำ"], ["done", "เสร็จ"], ["todo", "ยังไม่เริ่ม"],
];

const SpIcon = {
  persona: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 19c.7-3.2 3.3-5 6.5-5s5.8 1.8 6.5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  feature: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  epic: (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
      <path d="M12 5 3.4 20h17.2L12 5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9.3 20 12 12.4 14.7 20" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
};

interface FilterSignpostsProps {
  personas: string[];
  features: string[];
  epics: Array<{ key: string; label: string }>;
  persona: string;
  feature: string;
  epic: string;
  onChange: (level: "persona" | "feature" | "epic", value: string) => void;
}

export function FilterSignposts({ personas, features, epics, persona, feature, epic, onChange }: FilterSignpostsProps) {
  const [open, setOpen] = useState<null | "persona" | "feature" | "epic">(null);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const epicLabel = epic ? (epics.find((e) => e.key === epic)?.label ?? epic) : "All Epic";
  const signs = [
    { key: "persona" as const, value: persona, valueLabel: persona ? (PERSONA_LABEL[persona] ?? persona) : "All Persona",
      opts: [{ v: "", l: "All Persona" }, ...personas.map((p) => ({ v: p, l: PERSONA_LABEL[p] ?? p }))] },
    { key: "feature" as const, value: feature, valueLabel: feature || "All Feature",
      opts: [{ v: "", l: "All Feature" }, ...features.map((f) => ({ v: f, l: f }))] },
    { key: "epic" as const, value: epic, valueLabel: epicLabel,
      opts: [{ v: "", l: "All Epic" }, ...epics.map((e) => ({ v: e.key, l: e.label.replace(/\[[a-z-]+\]\s*/gi, "").trim() }))] },
  ];

  return (
    <div className="hud-signposts" onPointerDown={(e) => e.stopPropagation()} data-testid="nav--map-filter">
      {signs.map((s) => (
        <div className="hud-signpost-wrap" key={s.key}>
          <button
            type="button"
            className={s.value ? "hud-signpost active" : "hud-signpost"}
            aria-expanded={open === s.key}
            onClick={() => setOpen(open === s.key ? null : s.key)}
            data-testid={`btn--map-filter-${s.key}`}
          >
            <span className="hud-sp-icon" aria-hidden="true">{SpIcon[s.key]}</span>
            <span className="hud-sp-label">{s.valueLabel}</span>
            <svg className="hud-sp-caret" viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
              <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {open === s.key && (
            <div className="hud-signpost-menu">
              {s.opts.map((o) => (
                <button
                  type="button"
                  key={o.v || "all"}
                  className={o.v === s.value ? "hud-sp-opt sel" : "hud-sp-opt"}
                  onClick={() => { onChange(s.key, o.v); setOpen(null); }}
                >
                  {o.l}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function EfilterChips({ efilter, onChange }: { efilter: "all" | "prog" | "done" | "todo"; onChange: (f: "all" | "prog" | "done" | "todo") => void }) {
  return (
    <div className="hud-efilter" role="group" aria-label="กรองตามสถานะงาน" data-testid="nav--map-efilter">
      {EF_OPTS.map(([v, l]) => (
        <button type="button" key={v} className={efilter === v ? "hud-ef-chip on" : "hud-ef-chip"} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

// ── Summary Card (Step 3) ────────────────────────────────────────────────────

function GaugeRing({ pct }: { pct: number }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(pct / 100, 1)) * circ;
  return (
    <svg width="82" height="82" viewBox="0 0 82 82" aria-hidden="true" style={{ display: "block", margin: "0 auto" }}>
      <defs>
        <filter id="glow-sum" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx="41" cy="41" r={r} fill="none" stroke="rgba(91,233,176,.12)" strokeWidth="7" />
      <circle
        cx="41" cy="41" r={r} fill="none"
        stroke="#5BE9B0" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        filter="url(#glow-sum)"
        style={{ transform: "rotate(-90deg)", transformOrigin: "41px 41px", transition: "stroke-dasharray .7s cubic-bezier(.34,1.56,.64,1)" }}
      />
      <text x="41" y="46" textAnchor="middle" fill="#5BE9B0" fontSize="15" fontWeight="700" fontFamily="system-ui,sans-serif">{pct}%</text>
    </svg>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="hud-spark" aria-hidden="true">
      {data.map((v, i) => (
        <div
          key={i}
          className="hud-spark-bar"
          style={{ height: `${Math.max(2, Math.round((v / max) * 28))}px`, opacity: i === 6 ? 1 : 0.3 + i * 0.1 }}
        />
      ))}
    </div>
  );
}

const MINI_LANES: Array<{ key: string; label: string; dot: string; cls?: string }> = [
  { key: "Backlog",     label: "Backlog",  dot: "#8a9aa8" },
  { key: "Todo",        label: "To Do",    dot: "#8FB8F0" },
  { key: "In Progress", label: "กำลังทำ", dot: "#5BE9B0", cls: "dot-inprog" },
  { key: "In Review",   label: "ตรวจสอบ", dot: "#B7A6FF" },
  { key: "Done",        label: "เสร็จ",   dot: "#76E0AE" },
];

export interface SummaryCardProps {
  pct: number;
  epicDone: number;
  epicTotal: number;
  storyDone: number;
  storyTotal: number;
  backlog: number;
  statusCounts: Record<string, number>;
  collapsed: boolean;
  onToggle: () => void;
}

export function SummaryCard({ pct, epicDone, epicTotal, storyDone, storyTotal, backlog, statusCounts, collapsed, onToggle }: SummaryCardProps) {
  if (collapsed) {
    return (
      <div className="hud-summary">
        <div className="hud-sum-card" role="complementary" aria-label="ภาพรวมโครงการ">
          <div className="hud-sum-head">
            <span className="hud-sum-heading">ภาพรวม</span>
            <button type="button" className="hud-sum-collapse" onClick={onToggle} aria-label="ขยายภาพรวม" aria-expanded="false">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
                <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="hud-sum-mini">
            <div className="hud-sum-mini-grid">
              {MINI_LANES.map(lane => {
                const cnt = statusCounts[lane.key] ?? 0;
                return (
                  <div key={lane.key} className="hud-sum-mini-lane">
                    <span className={`hud-sum-mini-dot${lane.cls ? " " + lane.cls : ""}`} style={{ background: lane.dot }} />
                    <span className="hud-sum-mini-cnt" style={{ color: lane.dot }}>{cnt}</span>
                    <span className="hud-sum-mini-lbl">{lane.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="hud-summary">
      <div className="hud-sum-card" role="complementary" aria-label="ภาพรวมโครงการ">
        <div className="hud-sum-head">
          <span className="hud-sum-heading">ภาพรวม</span>
          <button type="button" className="hud-sum-collapse" onClick={onToggle} aria-label="ย่อภาพรวม" aria-expanded="true">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
              <path d="m6 15 6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="hud-sum-body">
          <div className="hud-sum-gauge"><GaugeRing pct={pct} /></div>
          <div className="hud-sum-row">
            <span className="hud-sum-row-l"><Layers size={13} strokeWidth={1.7} /><span>Epic</span></span>
            <span className="hud-sum-count">{epicDone} / {epicTotal}</span>
          </div>
          <div className="hud-sum-row">
            <span className="hud-sum-row-l"><FileText size={13} strokeWidth={1.7} /><span>Story</span></span>
            <span className="hud-sum-count">{storyDone} / {storyTotal}</span>
          </div>
          <div className="hud-sum-row">
            <span className="hud-sum-row-l"><Inbox size={13} strokeWidth={1.7} /><span>Backlog</span></span>
            <span className="hud-sum-count">{backlog}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Delivery Card (split from Step 3) ────────────────────────────────────────

type DeliveryPeriod = "today" | "week" | "all";

export interface DeliveryCardProps {
  todayEpics: number;
  todayStories: number;
  weekEpics: number;
  weekStories: number;
  sparkline: number[];
  epicDone: number;
  epicTotal: number;
  storyDone: number;
  storyTotal: number;
  collapsed: boolean;
  onToggle: () => void;
}

export function DeliveryCard({ todayEpics, todayStories, weekEpics, weekStories, sparkline, epicDone, epicTotal, storyDone, storyTotal, collapsed, onToggle }: DeliveryCardProps) {
  const [period, setPeriod] = useState<DeliveryPeriod>("today");

  const sparMax = Math.max(...sparkline, 1);
  const TABS: [DeliveryPeriod, string][] = [["today", "วันนี้"], ["week", "7 วัน"], ["all", "ทั้งหมด"]];

  function CollapseBtn({ isCollapsed }: { isCollapsed: boolean }) {
    return (
      <button type="button" className="hud-dlv-collapse" onClick={onToggle}
        aria-label={isCollapsed ? "ขยายส่งมอบ" : "ย่อส่งมอบ"} aria-expanded={!isCollapsed}>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
          <path d={isCollapsed ? "m6 9 6 6 6-6" : "m6 15 6-6 6 6"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }

  if (collapsed) {
    const miniVal = period === "today" ? todayStories : period === "week" ? weekStories : storyDone;
    const miniLabel = period === "today" ? "Story วันนี้" : period === "week" ? "Story 7 วัน" : `Story ${storyDone}/${storyTotal}`;
    return (
      <div className="hud-dlv-card" role="complementary" aria-label="งานส่งมอบ">
        <div className="hud-dlv-head">
          <span className="hud-dlv-heading">ส่งมอบ</span>
          <CollapseBtn isCollapsed />
        </div>
        <div className="hud-dlv-mini">
          <span className="hud-dlv-mini-val">{miniVal}</span>
          <span>{miniLabel}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="hud-dlv-card" role="complementary" aria-label="งานส่งมอบ">
      <div className="hud-dlv-head">
        <span className="hud-dlv-heading">ส่งมอบ</span>
        <CollapseBtn isCollapsed={false} />
      </div>
      <div className="hud-dlv-tabs" role="group" aria-label="ช่วงเวลา">
        {TABS.map(([v, l]) => (
          <button key={v} type="button" className={period === v ? "hud-dlv-tab on" : "hud-dlv-tab"} onClick={() => setPeriod(v)}>{l}</button>
        ))}
      </div>
      <div className="hud-dlv-body">
        {period === "today" && (
          todayStories === 0 && todayEpics === 0 ? (
            <div className="hud-dlv-empty">ยังไม่มีงานส่งมอบวันนี้</div>
          ) : (
            <div className="hud-dlv-nums">
              {todayEpics > 0 && (
                <div className="hud-dlv-num">
                  <span className="hud-dlv-big hud-dlv-pulse">{todayEpics}</span>
                  <span className="hud-dlv-sub"><Trophy size={10} strokeWidth={1.8} />Epic</span>
                </div>
              )}
              {todayStories > 0 && (
                <div className="hud-dlv-num">
                  <span className="hud-dlv-big hud-dlv-pulse" style={{ animationDelay: ".3s" }}>{todayStories}</span>
                  <span className="hud-dlv-sub"><CheckCircle2 size={10} strokeWidth={1.8} />Story</span>
                </div>
              )}
            </div>
          )
        )}
        {period === "week" && (
          <>
            <div className="hud-dlv-spark" aria-hidden="true">
              {sparkline.map((v, i) => (
                <div key={i} className="hud-dlv-bar"
                  style={{ height: `${Math.max(2, Math.round((v / sparMax) * 42))}px`, opacity: i === 6 ? 1 : 0.3 + i * 0.1 }} />
              ))}
            </div>
            <div className="hud-dlv-total">
              <strong>{weekStories}</strong> Story · <strong>{weekEpics}</strong> Epic (7 วัน)
            </div>
          </>
        )}
        {period === "all" && (
          <>
            <div className="hud-dlv-prog-row">
              <span className="hud-dlv-prog-label"><Layers size={11} strokeWidth={1.7} />Epic</span>
              <div className="hud-dlv-prog-bar">
                <div className="hud-dlv-prog-fill" style={{ width: `${epicTotal ? Math.round((epicDone / epicTotal) * 100) : 0}%` }} />
              </div>
              <span className="hud-dlv-prog-val">{epicDone}/{epicTotal}</span>
            </div>
            <div className="hud-dlv-prog-row">
              <span className="hud-dlv-prog-label"><FileText size={11} strokeWidth={1.7} />Story</span>
              <div className="hud-dlv-prog-bar">
                <div className="hud-dlv-prog-fill" style={{ width: `${storyTotal ? Math.round((storyDone / storyTotal) * 100) : 0}%` }} />
              </div>
              <span className="hud-dlv-prog-val">{storyDone}/{storyTotal}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Approval Card (Step 4) ───────────────────────────────────────────────────

interface ApprovalCardProps {
  gates: MapGate[];
  collapsed: boolean;
  onToggle: () => void;
  onOpen: () => void;
}

function ChevronToggle({ collapsed, onClick, label }: { collapsed: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" className="hud-appr-collapse" onClick={onClick} aria-label={label} aria-expanded={!collapsed}>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
        <path d={collapsed ? "m6 9 6 6 6-6" : "m6 15 6-6 6 6"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function ApprovalCard({ gates, collapsed, onToggle, onOpen }: ApprovalCardProps) {
  const count = gates.length;
  const PRIORITY_ORDER: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
  const sorted = [...gates].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));

  if (collapsed) {
    return (
      <div className="hud-appr-card" role="complementary" aria-label="งานรออนุมัติ">
        <div className="hud-appr-head">
          <span className="hud-appr-heading">
            <AlertTriangle size={12} strokeWidth={2} />
            รออนุมัติ
          </span>
          <ChevronToggle collapsed onClick={onToggle} label="ขยายรออนุมัติ" />
        </div>
        <div className="hud-appr-mini">
          <span className="hud-appr-mini-label">
            <AlertTriangle size={11} strokeWidth={2} />
            {count} รายการรออนุมัติ
          </span>
          <button type="button" className="hud-appr-btn" style={{ width: "auto", padding: "5px 12px", margin: 0, fontSize: "11px" }} onClick={onOpen}>
            ดู
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hud-appr-card" role="complementary" aria-label="งานรออนุมัติ">
      <div className="hud-appr-head">
        <span className="hud-appr-heading">
          <AlertTriangle size={12} strokeWidth={2} />
          รออนุมัติ {count} รายการ
        </span>
        <ChevronToggle collapsed={false} onClick={onToggle} label="ย่อรออนุมัติ" />
      </div>
      <div className="hud-appr-body">
        {sorted.map((g) => (
          <div key={g.id} className="hud-appr-item">
            {g.priority && <span className="hud-appr-badge">{g.priority}</span>}
            <span className="hud-appr-title">{g.title}</span>
            <a href={g.url} target="_blank" rel="noopener noreferrer" className="hud-appr-link" aria-label="เปิดใน Linear">
              <ExternalLink size={12} strokeWidth={1.8} />
            </a>
          </div>
        ))}
        <button type="button" className="hud-appr-btn" onClick={onOpen}>
          <AlertTriangle size={12} strokeWidth={2} />
          ดูและอนุมัติทั้งหมด
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function ViewToggle({ dashboardHref }: ViewToggleProps) {
  return (
    <a
      href={dashboardHref}
      className="hud-view-toggle"
      data-testid="link--map-to-dashboard"
      aria-label="กลับไปดูแดชบอร์ด"
    >
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      </svg>
      <span>แดชบอร์ด</span>
    </a>
  );
}

// ── Status Board (Step 5 — right panel) ──────────────────────────────────────

const SB_LANES: Array<{ key: string; label: string; dot: string; lh: string }> = [
  { key: "Backlog",     label: "Backlog",    dot: "dot-backlog", lh: "lh-backlog" },
  { key: "Todo",        label: "To Do",      dot: "dot-todo",    lh: "lh-todo"    },
  { key: "In Progress", label: "กำลังทำ",   dot: "dot-inprog",  lh: "lh-inprog"  },
  { key: "In Review",   label: "ตรวจสอบ",   dot: "dot-review",  lh: "lh-review"  },
  { key: "Done",        label: "เสร็จ",      dot: "dot-done",    lh: "lh-done"    },
];

const ROLE_LABEL_SB: Record<string, string> = {
  architect: "Architect", "ux-designer": "Designer",
  "frontend-engineer": "Frontend", "backend-engineer": "Backend",
  "qa-engineer": "QA", "security-reviewer": "Security",
  "devops-release": "DevOps", "product-owner": "Product",
};

function RoleIconSB({ role }: { role: string }) {
  const props = { size: 13, strokeWidth: 1.6, "aria-hidden": true };
  switch (role) {
    case "architect":          return <Layers {...props} />;
    case "ux-designer":        return <Compass {...props} />;
    case "backend-engineer":   return <Database {...props} />;
    case "frontend-engineer":  return <Monitor {...props} />;
    case "qa-engineer":        return <ClipboardCheck {...props} />;
    case "security-reviewer":  return <ShieldCheck {...props} />;
    case "devops-release":     return <GitBranch {...props} />;
    default:                   return <FileText {...props} />;
  }
}

export interface StatusBoardProps {
  stories: MapEpicStory[];
  label: string;
  pct: number;
  collapsed: boolean;
  onToggle: () => void;
}

export function StatusBoard({ stories, label, pct, collapsed, onToggle }: StatusBoardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const modalTriggerRef = useRef<HTMLButtonElement>(null);

  const byLane = Object.fromEntries(SB_LANES.map(l => [l.key, [] as MapEpicStory[]]));
  for (const s of stories) {
    const k = SB_LANES.find(l => l.key === s.status)?.key ?? "Backlog";
    byLane[k].push(s);
  }

  const ChevBtn = () => (
    <button type="button" className="hud-sb-collapse" onClick={onToggle}
      aria-label={collapsed ? "ขยายบอร์ด" : "ย่อบอร์ด"} aria-expanded={!collapsed}>
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
        <path d={collapsed ? "m6 9 6 6 6-6" : "m6 15 6-6 6 6"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  if (collapsed) {
    return (
      <div className="hud-sb-card" role="complementary" aria-label="บอร์ดงาน">
        <div className="hud-sb-head">
          <span className="hud-sb-heading">บอร์ดงาน</span>
          <ChevBtn />
        </div>
        <div className="hud-sb-mini">
          {SB_LANES.map(l => {
            const cnt = byLane[l.key].length;
            if (!cnt) return null;
            return (
              <span key={l.key} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span className={`hud-sb-dot ${l.dot}`} />
                <span className="hud-sb-mini-cnt">{cnt}</span>
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="hud-sb-card" role="complementary" aria-label="บอร์ดงาน">
      <div className="hud-sb-head">
        <span className="hud-sb-heading">บอร์ดงาน</span>
        <ChevBtn />
      </div>
      <div className="hud-sb-body">
        {SB_LANES.map(lane => {
          const items = byLane[lane.key];
          const shown = items.slice(0, 3);
          const extra = items.length - shown.length;
          return (
            /* empty lanes use compact header-only display to save space */
            <div key={lane.key} className={items.length === 0 ? "hud-sb-lane-empty" : undefined}>
              {/* Lane header — colour-coded matching dashboard .col-h */}
              <div className={`hud-sb-lane-head ${lane.lh}`}>
                <span className={`hud-sb-dot ${lane.dot}`} />
                <span>{lane.label}</span>
                <span className="hud-sb-lane-cnt">{items.length}</span>
              </div>
              {/* Story cards — mirrors .kc from dashboard */}
              {shown.map(s => {
                const isActive = s.status === "In Progress";
                const isAwaiting = s.labels.includes("awaiting-you");
                const roleKey = s.role ?? "";
                const roleStr = ROLE_LABEL_SB[roleKey] ?? roleKey ?? "team";
                return (
                  <div key={s.id} className={`hud-kc${isActive ? " prog" : ""}${isAwaiting ? " gate" : ""}`}>
                    <div className="hud-kt">
                      <RoleIconSB role={roleKey} />
                      <span title={s.title}>{s.title}</span>
                    </div>
                    <div className="hud-kb">
                      <span className="hud-kr">{isActive && <span style={{ marginRight: 4 }}>●</span>}{isAwaiting ? "รอคุณ" : roleStr}</span>
                      <span className="hud-tk">{s.id}</span>
                    </div>
                  </div>
                );
              })}
              {extra > 0 && <div className="hud-sb-more">+{extra} อื่นๆ</div>}
            </div>
          );
        })}
        <button type="button" ref={modalTriggerRef} className="hud-sb-seeall" onClick={() => setModalOpen(true)}>
          ดูทั้งหมด →
        </button>
      </div>
      <KanbanModal
        epicLabel={label}
        epicPct={pct}
        stories={stories}
        triggerRef={modalTriggerRef}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

export function StatusBoardHint() {
  return <div className="hud-board-hint">เลือก Feature เพื่อดูบอร์ด</div>;
}

// ── Team Roster panel ─────────────────────────────────────────────────────────

const ROLE_SHORT: Record<string, string> = {
  architect:          "Architect",
  "ux-designer":      "Designer",
  "frontend-engineer":"Frontend",
  "backend-engineer": "Backend",
  "devops-release":   "DevOps",
  "qa-engineer":      "QA",
  "security-reviewer":"Security",
};

export interface TeamRosterProps {
  agents: MapAgent[];
  collapsed: boolean;
  onToggle: () => void;
}

export function TeamRoster({ agents, collapsed, onToggle }: TeamRosterProps) {
  const activeCount = agents.filter(a => a.active).length;

  function ChevBtn() {
    return (
      <button type="button" className="hud-team-collapse" onClick={onToggle}
        aria-label={collapsed ? "ขยายทีม" : "ย่อทีม"} aria-expanded={!collapsed}>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">
          <path d={collapsed ? "m6 9 6 6 6-6" : "m6 15 6-6 6 6"}
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }

  if (collapsed) {
    return (
      <div className="hud-team-card" role="complementary" aria-label="ทีม">
        <div className="hud-team-head">
          <span className="hud-team-heading">ทีม</span>
          <ChevBtn />
        </div>
        <div className="hud-team-mini">
          <div className="hud-team-mini-dots">
            {agents.map(a => (
              <span key={a.role} className={`hud-team-mini-dot ${a.active ? "active" : "sleep"}`}
                title={ROLE_SHORT[a.role] ?? a.role} />
            ))}
          </div>
          <span className="hud-team-mini-txt">
            <strong>{activeCount}</strong> / {agents.length} active
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="hud-team-card" role="complementary" aria-label="ทีม">
      <div className="hud-team-head">
        <span className="hud-team-heading">ทีม · {agents.length} คน</span>
        <ChevBtn />
      </div>
      <div className="hud-team-body">
        {agents.map(agent => {
          const label = ROLE_SHORT[agent.role] ?? agent.role;
          const isActive = agent.active;
          return (
            <div key={agent.role} className={`hud-role-row ${isActive ? "active" : "sleep"}`}>
              <span className={`hud-role-dot ${isActive ? "active" : "sleep"}`} />
              <span className="hud-role-icon"><RoleIconSB role={agent.role} /></span>
              <span className="hud-role-label">{label}</span>
              <span className={`hud-role-badge ${isActive ? "active" : "sleep"}`}>
                {isActive ? "Active" : "Sleep"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MapOverlays (main export) ─────────────────────────────────────────────────

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

  const activeAgents  = agents.filter((a) => a.active).length;
  const stagingCount  = envLanes.staging.length;
  const isEpicScope   = scope === "epic";

  // Epic scope data
  const epicStories  = activeEpicData?.stories ?? [];
  const epicRunning  = epicStories.filter((s) => s.status === "In Progress").length;
  const epicAwaiting = epicStories.filter((s) => s.labels.includes("awaiting-you")).length;
  const epicQueued   = epicStories.filter((s) => {
    return s.status !== "In Progress"
      && s.statusType !== "completed"
      && s.status !== "Done"
      && !s.labels.includes("awaiting-you");
  }).length;
  const epicShipped  = epicStories.filter((s) => s.statusType === "completed" || s.status === "Done").length;

  const epicIssues = epicStories.map(storyAsIssue);
  const epicTrail  = epicStories.length > 0 ? buildTrail(epicIssues) : null;

  // Epic percent (for modal progress bar)
  const epicTotal = epicStories.length;
  const epicPct   = epicTotal > 0 ? Math.round((epicShipped / epicTotal) * 100) : 0;

  // Trigger refs (for return-focus after close)
  const scopeRef   = useRef<HTMLButtonElement>(null);
  const delivRef   = useRef<HTMLButtonElement>(null);
  const crewRef    = useRef<HTMLButtonElement>(null);
  const envRef     = useRef<HTMLButtonElement>(null);
  const backlogRef = useRef<HTMLButtonElement>(null);
  const gatesRef   = useRef<HTMLButtonElement>(null);
  const progressRef = useRef<HTMLButtonElement>(null);
  const upnextRef  = useRef<HTMLButtonElement>(null);
  const boardRef   = useRef<HTMLButtonElement>(null);

  const open = useCallback((id: string) => onOpen(id), [onOpen]);

  // Panel horizontal anchoring: offset from center based on segment position
  // Panels in the dock are centered; clamp them to stay in viewport.
  const PANEL_CENTER: React.CSSProperties = { left: "50%", transform: "translateX(-50%)" };
  const PANEL_LEFT:   React.CSSProperties = { left: "max(16px, calc(50% - 280px))" };
  const PANEL_RIGHT:  React.CSSProperties = { right: "max(16px, calc(50% - 280px))" };

  // ── Overview scope ─────────────────────────────────────────────────────────
  if (!isEpicScope) {
    const delivSummary = `${projectPct}%`;
    const envSummary   = `Dev ${envLanes.dev.length}·St ${envLanes.staging.length}${stagingCount > 0 ? "↑" : ""}·Pr ${envLanes.prod.length}`;

    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: HUD_CSS }} />

        {/* Bottom command dock — Overview mode */}
        <div className="hud-dock" role="toolbar" aria-label="สรุปภาพรวม" data-testid="dock--hud-overview">
          {/* Scope selector */}
          <button
            ref={scopeRef}
            type="button"
            className="hud-seg hud-seg-scope"
            aria-expanded={openOverlay === "switcher"}
            aria-controls="panel--hud-switcher"
            aria-label="ทุก delivery — กดเพื่อเลือก epic"
            onClick={() => openOverlay === "switcher" ? onClose() : open("switcher")}
            data-testid="seg--hud-scope"
          >
            <span>ทุก delivery</span>
            <span aria-hidden="true" style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
          </button>

          {/* Delivery progress */}
          <button
            ref={delivRef}
            type="button"
            className="hud-seg"
            aria-expanded={openOverlay === "delivery"}
            aria-controls="panel--hud-delivery"
            aria-label={`ความคืบหน้า ${projectPct}%`}
            onClick={() => openOverlay === "delivery" ? onClose() : open("delivery")}
            data-testid="seg--hud-delivery"
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span className="hud-seg-val">{delivSummary}</span>
              <div className="hud-prog-bar" aria-hidden="true">
                <div className="hud-prog-fill" style={{ width: `${projectPct}%` }} />
              </div>
            </div>
            <span className="hud-seg-lbl" style={{ marginLeft: 2 }}>เสร็จ</span>
          </button>

          {/* Gates */}
          <button
            ref={gatesRef}
            type="button"
            className="hud-seg"
            aria-expanded={openOverlay === "gates"}
            aria-controls="panel--hud-gates"
            aria-label={`gate รออนุมัติ ${gates.length} รายการ`}
            onClick={() => openOverlay === "gates" ? onClose() : open("gates")}
            data-testid="seg--hud-gates"
          >
            <span className={`hud-seg-val${gates.length > 0 ? " amber" : ""}`}>⚑ {gates.length}</span>
            <span className="hud-seg-lbl">gate</span>
          </button>

          {/* Crew */}
          <button
            ref={crewRef}
            type="button"
            className="hud-seg"
            aria-expanded={openOverlay === "crew"}
            aria-controls="panel--hud-crew"
            aria-label={`ทีม ${activeAgents}/7 คนกำลังทำงาน`}
            onClick={() => openOverlay === "crew" ? onClose() : open("crew")}
            data-testid="seg--hud-crew"
          >
            <span className="hud-seg-val">{activeAgents}/7</span>
            <span className="hud-seg-lbl">ทีม</span>
          </button>

          {/* Env */}
          <button
            ref={envRef}
            type="button"
            className="hud-seg"
            aria-expanded={openOverlay === "env"}
            aria-controls="panel--hud-env"
            aria-label={`สภาพแวดล้อม: ${envSummary}`}
            onClick={() => openOverlay === "env" ? onClose() : open("env")}
            data-testid="seg--hud-env"
          >
            <span className="hud-seg-val muted" style={{ fontSize: 11 }}>{envSummary}</span>
            <span className="hud-seg-lbl">Env</span>
          </button>

          {/* Backlog */}
          <button
            ref={backlogRef}
            type="button"
            className="hud-seg hud-seg-last"
            aria-expanded={openOverlay === "backlog"}
            aria-controls="panel--hud-backlog"
            aria-label={`Backlog ${backlogItems.length} story`}
            onClick={() => openOverlay === "backlog" ? onClose() : open("backlog")}
            data-testid="seg--hud-backlog"
          >
            <span className="hud-seg-val muted">{backlogItems.length}</span>
            <span className="hud-seg-lbl">Backlog</span>
          </button>
        </div>

        {/* Expand panels */}
        <ExpandPanel id="switcher" title="เลือกขอบเขต" triggerRef={scopeRef} isOpen={openOverlay === "switcher"} onClose={onClose} anchorStyle={PANEL_LEFT}>
          <>
            <div style={{ marginBottom: 10, fontWeight: 600, fontSize: 12, color: "rgba(223,234,245,.7)" }}>
              ทั้งหมด (Overview)
            </div>
            <ScopeSwitcherPanel epics={epics} group={group} efilter={efilter} onSelectEpic={(key) => { onSelectEpic(key); }} onGroupChange={onGroupChange} onEfilterChange={onEfilterChange} />
          </>
        </ExpandPanel>

        <ExpandPanel id="delivery" title="ภาพรวมการส่งมอบ" triggerRef={delivRef} isOpen={openOverlay === "delivery"} onClose={onClose} anchorStyle={PANEL_CENTER}>
          <DeliveryPanel projectPct={projectPct} gateCount={gates.length} epicsActive={epicsActive} totalEpics={totalEpics} backlogCount={backlogItems.length} />
        </ExpandPanel>

        <ExpandPanel id="gates" title={`รออนุมัติจากคุณ (${gates.length})`} triggerRef={gatesRef} isOpen={openOverlay === "gates"} onClose={onClose} anchorStyle={PANEL_CENTER}>
          <GatesPanel gates={gates} />
        </ExpandPanel>

        <ExpandPanel id="crew" title="ทีม delivery" triggerRef={crewRef} isOpen={openOverlay === "crew"} onClose={onClose} anchorStyle={PANEL_CENTER}>
          <CrewPanel agents={agents} gateCount={gates.length} />
        </ExpandPanel>

        <ExpandPanel id="env" title="สภาพแวดล้อม" triggerRef={envRef} isOpen={openOverlay === "env"} onClose={onClose} anchorStyle={PANEL_RIGHT}>
          <EnvPanel envLanes={envLanes} />
        </ExpandPanel>

        <ExpandPanel id="backlog" title="Backlog" triggerRef={backlogRef} isOpen={openOverlay === "backlog"} onClose={onClose} anchorStyle={PANEL_RIGHT}>
          <BacklogPanel items={backlogItems} />
        </ExpandPanel>
      </>
    );
  }

  // ── Epic scope ─────────────────────────────────────────────────────────────
  const stageLabel = epicTrail
    ? `Stage ${epicTrail.curIdx + 1}/5 ${STAGES[epicTrail.curIdx]}`
    : epicStories.length === 0
      ? "ยังไม่มีสตอรี"
      : "Stage 1/5";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: HUD_CSS }} />

      {/* Bottom command dock — Epic mode */}
      <div className="hud-dock" role="toolbar" aria-label={`Epic ${activeEpic}`} data-testid="dock--hud-epic">
        {/* Back/scope — left */}
        <button
          ref={scopeRef}
          type="button"
          className="hud-seg hud-seg-scope"
          aria-expanded={openOverlay === "switcher"}
          aria-controls="panel--hud-switcher"
          aria-label={`กลับ Overview หรือสลับ epic: ปัจจุบัน ${activeEpic}`}
          onClick={() => openOverlay === "switcher" ? onClose() : open("switcher")}
          data-testid="seg--hud-scope"
        >
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <button
              type="button"
              className="hud-back-btn"
              style={{ padding: "0 4px", fontSize: 11, minHeight: 28 }}
              onClick={(e) => { e.stopPropagation(); onBackToOverview(); }}
              aria-label="กลับ Overview"
              data-testid="btn--scope-back-overview"
            >
              ‹ Overview
            </button>
            <span aria-hidden="true" style={{ color: "rgba(223,234,245,.35)", fontSize: 10 }}>·</span>
            <span style={{ maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>
              {activeEpic}
            </span>
          </span>
          <span aria-hidden="true" style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
        </button>

        {/* Stage progress */}
        <button
          ref={progressRef}
          type="button"
          className="hud-seg"
          aria-expanded={openOverlay === "epic-progress"}
          aria-controls="panel--hud-epic-progress"
          aria-label={`ความคืบหน้า epic: ${stageLabel}`}
          onClick={() => openOverlay === "epic-progress" ? onClose() : open("epic-progress")}
          data-testid="seg--hud-epic-progress"
        >
          <span className="hud-seg-val" style={{ fontSize: 11 }}>{stageLabel}</span>
          <span className="hud-seg-lbl">ขั้นตอน</span>
        </button>

        {/* Running / await counts */}
        <button
          ref={gatesRef}
          type="button"
          className="hud-seg"
          aria-expanded={openOverlay === "gates"}
          aria-controls="panel--hud-gates"
          aria-label={`ทำอยู่ ${epicRunning} รอคุณ ${epicAwaiting} ในคิว ${epicQueued} เสร็จ ${epicShipped}`}
          onClick={() => openOverlay === "gates" ? onClose() : open("gates")}
          data-testid="seg--hud-epic-counts"
        >
          <span style={{ fontSize: 11.5, fontFamily: "monospace" }}>
            <span style={{ color: "#5BE9B0" }}>▶{epicRunning}</span>
            {" "}
            <span style={{ color: epicAwaiting > 0 ? "#FFB454" : "rgba(223,234,245,.55)" }}>⚑{epicAwaiting}</span>
            {" "}
            <span style={{ color: "rgba(223,234,245,.55)" }}>⏳{epicQueued}</span>
            {" "}
            <span style={{ color: "rgba(223,234,245,.45)" }}>✓{epicShipped}</span>
          </span>
          <span className="hud-seg-lbl">สตอรี</span>
        </button>

        {/* Crew */}
        <button
          ref={crewRef}
          type="button"
          className="hud-seg"
          aria-expanded={openOverlay === "crew"}
          aria-controls="panel--hud-crew"
          aria-label={`ทีม ${activeAgents}/7 คนกำลังทำงาน`}
          onClick={() => openOverlay === "crew" ? onClose() : open("crew")}
          data-testid="seg--hud-crew"
        >
          <span className="hud-seg-val">{activeAgents}/7</span>
          <span className="hud-seg-lbl">ทีม</span>
        </button>

        {/* Up next */}
        <button
          ref={upnextRef}
          type="button"
          className="hud-seg"
          aria-expanded={openOverlay === "epic-upnext"}
          aria-controls="panel--hud-epic-upnext"
          aria-label={`ในคิว ${epicQueued} story`}
          onClick={() => openOverlay === "epic-upnext" ? onClose() : open("epic-upnext")}
          data-testid="seg--hud-upnext"
        >
          <span className="hud-seg-val muted">{epicQueued}</span>
          <span className="hud-seg-lbl">ในคิว</span>
        </button>

        {/* Open board — prominent CTA */}
        <button
          ref={boardRef}
          type="button"
          className="hud-board-btn"
          aria-label="เปิดบอร์ด Kanban"
          onClick={() => openOverlay === "epic-board" ? onClose() : open("epic-board")}
          data-testid="seg--hud-board"
        >
          เปิดบอร์ด
        </button>
      </div>

      {/* Expand panels */}
      <ExpandPanel id="switcher" title="สลับ epic" triggerRef={scopeRef} isOpen={openOverlay === "switcher"} onClose={onClose} anchorStyle={PANEL_LEFT}>
        <>
          <button
            type="button"
            className="hud-back-btn"
            style={{ width: "100%", justifyContent: "flex-start", marginBottom: 10 }}
            onClick={() => { onBackToOverview(); onClose(); }}
            data-testid="btn--scope-back-overview"
          >
            ‹ กลับ Overview (ทั้งหมด)
          </button>
          <ScopeSwitcherPanel epics={epics} group={group} efilter={efilter} onSelectEpic={(key) => { onSelectEpic(key); }} onGroupChange={onGroupChange} onEfilterChange={onEfilterChange} />
        </>
      </ExpandPanel>

      <ExpandPanel id="epic-progress" title={`ความคืบหน้า · ${activeEpic}`} triggerRef={progressRef} isOpen={openOverlay === "epic-progress"} onClose={onClose} anchorStyle={PANEL_CENTER}>
        <EpicProgressPanel stories={epicStories} />
      </ExpandPanel>

      <ExpandPanel id="gates" title={`รออนุมัติจากคุณ (${gates.length})`} triggerRef={gatesRef} isOpen={openOverlay === "gates"} onClose={onClose} anchorStyle={PANEL_CENTER}>
        <GatesPanel gates={gates} />
      </ExpandPanel>

      <ExpandPanel id="crew" title="ทีม delivery" triggerRef={crewRef} isOpen={openOverlay === "crew"} onClose={onClose} anchorStyle={PANEL_CENTER}>
        <CrewPanel agents={agents} gateCount={gates.length} />
      </ExpandPanel>

      <ExpandPanel id="epic-upnext" title={`ในคิว · ${activeEpic}`} triggerRef={upnextRef} isOpen={openOverlay === "epic-upnext"} onClose={onClose} anchorStyle={PANEL_RIGHT}>
        <EpicUpNextPanel stories={epicStories} />
      </ExpandPanel>

      {/* Kanban modal (heavy data — large centered modal) */}
      <KanbanModal
        epicLabel={activeEpic}
        epicPct={epicPct}
        stories={epicStories}
        triggerRef={boardRef}
        isOpen={openOverlay === "epic-board"}
        onClose={onClose}
      />
    </>
  );
}
