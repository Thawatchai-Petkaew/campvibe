/**
 * CAM-286 — Card detail modal replaces Linear links (map + dashboard).
 *
 * Layer: unit (static source analysis — fs.readFileSync, no DOM renderer), matching the
 * existing convention for these string-templated /status surfaces (see cam-184-approve-
 * reject-ui.test.ts, status-dashboard-csp.test.ts).
 *
 * AC coverage:
 *   AC1  /status/map: kanban board card / mini board / mobile board-sheet cards no longer
 *        <a href={s.url}> straight to Linear; they open TicketDetailModal (read-only).
 *   AC2  /status dashboard: cards + "Review →"-style links use data-act="open-ticket"
 *        (CSP-safe delegation, CAM-265 pattern) instead of href={i.url}/href={g.url}.
 *   AC3  Legacy imported tickets show "เปิด Linear (ประวัติ)" in the modal footer, gated on
 *        the fetched detail payload's url (empty for new self-hosted tickets).
 *   AC4  Modal a11y: role=dialog, aria-modal=true, close button ≥44px tap target.
 *   Guard: the existing gate/approve flow (GateDetailModal + ApprovalCard) is untouched —
 *        it keeps its own amber accent, its own unconditional "เปิด Linear" link, and its
 *        approve/reject buttons (re-asserted here, redundant with cam-184-approve-reject-
 *        ui.test.ts, which still passes unmodified).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

const overlaySrc = read("app/status/map/campsite-overlays.tsx");
const sceneSrc = read("app/status/map/campsite-scene.tsx");
const pageSrc = read("app/status/page.tsx");
const clientSrc = read("app/status/dashboard-client.tsx");
const assetsSrc = read("app/status/dashboard-assets.ts");

// ── AC1: map — TicketDetailModal (read-only) ─────────────────────────────────

describe("CAM-286 AC1: TicketDetailModal exists (map, read-only)", () => {
  it("is exported from campsite-overlays", () => {
    expect(overlaySrc).toContain("export function TicketDetailModal");
  });

  it("uses the neutral scene-glass box, not the amber gate-modal box", () => {
    expect(overlaySrc).toMatch(/className="hud-ticket-modal-box"/);
  });

  it("has role=dialog aria-modal=true", () => {
    const idx = overlaySrc.indexOf("export function TicketDetailModal");
    const slice = overlaySrc.slice(idx, idx + 4000);
    expect(slice).toContain('role="dialog"');
    expect(slice).toContain('aria-modal="true"');
  });

  it("has no approve/reject action buttons (read-only)", () => {
    const idx = overlaySrc.indexOf("export function TicketDetailModal");
    const nextFn = overlaySrc.indexOf("\n// ── Summary Card", idx);
    const slice = overlaySrc.slice(idx, nextFn > 0 ? nextFn : idx + 4000);
    expect(slice).not.toContain("hud-gate-btn-approve");
    expect(slice).not.toContain("hud-gate-btn-reject");
  });

  it("shows the legacy history link only when detail.url is present", () => {
    expect(overlaySrc).toContain("{detail?.url && (");
    expect(overlaySrc).toContain("เปิด Linear (ประวัติ)");
  });

  it("reuses fetchGateDetail (the existing source-agnostic detail fetch)", () => {
    const idx = overlaySrc.indexOf("export function TicketDetailModal");
    const slice = overlaySrc.slice(idx, idx + 2000);
    expect(slice).toContain("fetchGateDetail(ticketId, token)");
  });
});

describe("CAM-286 AC1: kanban board card no longer links straight to Linear", () => {
  it("KanbanModal's card is a <button>, not <a href={s.url}>", () => {
    const idx = overlaySrc.indexOf("export function KanbanModal");
    const nextFn = overlaySrc.indexOf("// ── Panel content sub-components", idx);
    const slice = overlaySrc.slice(idx, nextFn > 0 ? nextFn : idx + 6000);
    expect(slice).not.toMatch(/<a\s+[^>]*href=\{s\.url\}/);
    expect(slice).toMatch(/<button[\s\S]*?className=\{`hud-card/);
  });

  it("StatusBoard's mini card is a <button>, not <a href={s.url}>", () => {
    const idx = overlaySrc.indexOf("export function StatusBoard");
    const nextFn = overlaySrc.indexOf("export function StatusBoardHint", idx);
    const slice = overlaySrc.slice(idx, nextFn > 0 ? nextFn : idx + 6000);
    expect(slice).not.toMatch(/<a\s+[^>]*href=\{s\.url\}/);
    expect(slice).toMatch(/<button[\s\S]*?className=\{`hud-kc/);
  });

  it("the mobile Board Sheet card (campsite-scene.tsx) is a <button>, not <a href={s.url}>", () => {
    const idx = sceneSrc.indexOf('data-testid="sheet--map-board"');
    const slice = sceneSrc.slice(idx, idx + 3000);
    expect(slice).not.toMatch(/<a\s+[^>]*href=\{s\.url\}/);
    expect(slice).toMatch(/<button[\s\S]*?className=\{`hud-kc/);
  });
});

describe("CAM-286: gate/approve flow stays untouched (GateDetailModal + ApprovalCard)", () => {
  it("GateDetailModal still exports its own approve/reject buttons", () => {
    expect(overlaySrc).toContain("export function GateDetailModal");
    expect(overlaySrc).toContain("hud-gate-btn-approve");
    expect(overlaySrc).toContain("hud-gate-btn-reject");
  });

  it("GateDetailModal keeps its unconditional 'เปิด Linear' link (not the ticket modal's history-only variant)", () => {
    const idx = overlaySrc.indexOf("export function GateDetailModal");
    const nextFn = overlaySrc.indexOf("// ── TicketDetailModal", idx);
    const slice = overlaySrc.slice(idx, nextFn > 0 ? nextFn : idx + 6000);
    expect(slice).toContain("hud-gate-link-linear");
    expect(slice).toContain("เปิด Linear");
  });

  it("ApprovalCard rows still call onOpenDetail (approve modal), unchanged", () => {
    expect(overlaySrc).toContain("onClick={() => onOpenDetail(g.id)}");
  });
});

// ── AC2/AC3: dashboard — data-act delegation replaces href={i.url}/{g.url} ───

describe("CAM-286 AC2: dashboard page.tsx cards use data-act=\"open-ticket\" (CSP-safe)", () => {
  it("no card/link renders href={esc(i.url)} or href={esc(g.url)} any more", () => {
    expect(pageSrc).not.toMatch(/href="\$\{esc\(i\.url\)\}"/);
    expect(pageSrc).not.toMatch(/href="\$\{esc\(g\.url\)\}"/);
  });

  it('uses data-act="open-ticket" with a data-arg ticket id', () => {
    expect(pageSrc).toMatch(/data-act="open-ticket" data-arg="\$\{esc\(i\.id\)\}"/);
    expect(pageSrc).toMatch(/data-act="open-ticket" data-arg="\$\{esc\(g\.id\)\}"/);
  });

  it("the env pane / backlog / gates / action-card / up-next / board cards are all <button> now", () => {
    const openTicketCount = (pageSrc.match(/data-act="open-ticket"/g) || []).length;
    expect(openTicketCount).toBeGreaterThanOrEqual(6);
  });

  it("still has no inline onclick (CAM-265 CSP guard, unaffected)", () => {
    expect(pageSrc).not.toMatch(/\bonclick=/);
  });
});

describe("CAM-286 AC2/AC4: dashboard-client.tsx renders the read-only ticket detail modal", () => {
  it('registers the "open-ticket" delegated action', () => {
    expect(clientSrc).toContain('w["open-ticket"]');
  });

  it("captures the trigger element for return-focus via the same delegated-click path", () => {
    expect(clientSrc).toContain('if (act === "open-ticket") ticketTriggerRef.current = el;');
  });

  it("fetches ticket detail from the shared /api/status/issue endpoint", () => {
    expect(clientSrc).toContain("/api/status/issue/");
  });

  it("modal panel has role=dialog aria-modal=true and a ≥44px close button", () => {
    expect(clientSrc).toContain('role="dialog"');
    expect(clientSrc).toContain('aria-modal="true"');
    expect(clientSrc).toContain('className="td-close"');
  });

  it("shows the legacy history link only when ticketDetail.url is present", () => {
    expect(clientSrc).toContain("{ticketDetail?.url && (");
    expect(clientSrc).toContain("เปิด Linear (ประวัติ)");
  });

  it("supports Esc-to-close and focus trap (Tab cycling)", () => {
    expect(clientSrc).toContain('e.key === "Escape"');
    expect(clientSrc).toContain('e.key !== "Tab"');
  });
});

describe("CAM-286 AC4: dashboard ticket modal CSS is neutral (own classes, ≥44px close target)", () => {
  it(".td-close is 44x44 (tap target)", () => {
    const match = assetsSrc.match(/\.td-close\{[^}]*\}/);
    expect(match).not.toBeNull();
    expect(match![0]).toContain("width:44px");
    expect(match![0]).toContain("height:44px");
  });

  it(".td-panel reuses the existing glass shell tokens (var(--glass)/var(--blur))", () => {
    const match = assetsSrc.match(/\.td-panel\{[^}]*\}/);
    expect(match).not.toBeNull();
    expect(match![0]).toContain("var(--glass)");
  });
});
