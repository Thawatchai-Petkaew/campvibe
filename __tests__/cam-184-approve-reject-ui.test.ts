/**
 * CAM-184 — Interactive Approve/Reject + GateDetailModal + visual polish.
 *
 * Layer: unit (static source analysis — fs.readFileSync, no DOM renderer).
 *
 * AC coverage:
 *   AC-card-1    ApprovalCard background is amber-tinted glass (rgba(40,26,6,.42))
 *   AC-card-2    .hud-appr-badge CSS removed from HUD_CSS
 *   AC-card-3    No hud-appr-badge JSX element in ApprovalCard
 *   AC-card-4    .hud-appr-heading color is #FFB454 (full opacity)
 *   AC-card-5    .hud-appr-heading font-weight is 800
 *   AC-card-6    Gate rows are <button> elements (not <div>) with aria-label
 *   AC-card-7    Footer CTA text is "อนุมัติทั้งหมด" (not "ดูและอนุมัติทั้งหมด")
 *   AC-modal-1   GateDetailModal component exists in overlays
 *   AC-modal-2   GateDetailModal has role="dialog" aria-modal="true"
 *   AC-modal-3   GateDetailModal has aria-label="รายละเอียดงานรออนุมัติ"
 *   AC-modal-4   GateDetailModal has Approve + ส่งกลับ + reason textarea
 *   AC-modal-5   GateDetailModal fetches /api/status/issue
 *   AC-modal-6   GateDetailModal calls /api/status/approve
 *   AC-modal-7   GateDetailModal calls /api/status/reject
 *   AC-notify-1  .you-alert font-size is 12px (CAM-184 reduction)
 *   AC-notify-2  .you-alert svg (icon) is 13px (CAM-184 reduction)
 *   AC-notify-3  .you-alert padding is 5px 11px (CAM-184 reduction)
 *   AC-notify-4  .scout.has-gate .popover{display:none} rule present
 *   AC-notify-5  .popover border uses rgba(255,255,255,.10) (not var(--line-2))
 *   AC-notify-6  .pop-role border uses rgba(255,255,255,.08) (not var(--line))
 *   AC-notify-7  .badge border uses rgba(255,255,255,.10) (not rgba(150,240,195,.13))
 *   AC-action-1  approveGate exported fn calls /api/status/approve
 *   AC-action-2  rejectGate exported fn calls /api/status/reject
 *   AC-action-3  fetchGateDetail exported fn calls /api/status/issue
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

const sceneSrc    = read("app/status/map/campsite-scene.tsx");
const overlaySrc  = read("app/status/map/campsite-overlays.tsx");

// ── Part 1: ApprovalCard amber-tinted glass background ───────────────────────

describe("CAM-184 AC-card-1: ApprovalCard amber-tinted glass background", () => {
  it(".hud-appr-card uses rgba(40,26,6,.42) amber base in the gradient", () => {
    expect(overlaySrc).toContain("rgba(40,26,6,.42)");
  });

  it(".hud-appr-card uses linear-gradient for background", () => {
    expect(overlaySrc).toMatch(/\.hud-appr-card\{[^}]*background:linear-gradient/);
  });
});

// ── Part 2: Badge removal ─────────────────────────────────────────────────────

describe("CAM-184 AC-card-2: .hud-appr-badge CSS removed", () => {
  it(".hud-appr-badge CSS block is absent from HUD_CSS", () => {
    // The class definition must be gone
    expect(overlaySrc).not.toMatch(/\.hud-appr-badge\{/);
  });
});

describe("CAM-184 AC-card-3: No hud-appr-badge JSX in ApprovalCard", () => {
  it("JSX does not render className=\"hud-appr-badge\"", () => {
    expect(overlaySrc).not.toContain('"hud-appr-badge"');
  });
});

// ── Part 3: Heading style ─────────────────────────────────────────────────────

describe("CAM-184 AC-card-4: .hud-appr-heading color is #FFB454", () => {
  it(".hud-appr-heading CSS has color:#FFB454", () => {
    expect(overlaySrc).toMatch(/\.hud-appr-heading\{[^}]*color:#FFB454/);
  });
});

describe("CAM-184 AC-card-5: .hud-appr-heading font-weight is 800", () => {
  it(".hud-appr-heading CSS has font-weight:800", () => {
    expect(overlaySrc).toMatch(/\.hud-appr-heading\{[^}]*font-weight:800/);
  });
});

// ── Part 4: Gate rows as buttons ─────────────────────────────────────────────

describe("CAM-184 AC-card-6: gate rows are <button> with aria-label", () => {
  it("renders a button element for each gate row (not div)", () => {
    // The hud-appr-item is now rendered as a button in ApprovalCard
    expect(overlaySrc).toMatch(/<button[^>]*className="hud-appr-item"/);
  });

  it("gate row button has aria-label with ดูรายละเอียด", () => {
    expect(overlaySrc).toContain("ดูรายละเอียด");
  });
});

// ── Part 5: Footer CTA text ──────────────────────────────────────────────────

describe("CAM-184 AC-card-7: footer CTA text is อนุมัติทั้งหมด", () => {
  it("contains อนุมัติทั้งหมด (not ดูและอนุมัติทั้งหมด)", () => {
    expect(overlaySrc).toContain("อนุมัติทั้งหมด");
    expect(overlaySrc).not.toContain("ดูและอนุมัติทั้งหมด");
  });
});

// ── Part 6: GateDetailModal ───────────────────────────────────────────────────

describe("CAM-184 AC-modal-1: GateDetailModal component exists", () => {
  it("GateDetailModal is exported from campsite-overlays", () => {
    expect(overlaySrc).toContain("export function GateDetailModal");
  });
});

describe("CAM-184 AC-modal-2: GateDetailModal has role=dialog aria-modal=true", () => {
  it("modal box has role=\"dialog\"", () => {
    expect(overlaySrc).toContain('role="dialog"');
  });

  it("modal box has aria-modal=\"true\"", () => {
    expect(overlaySrc).toContain('aria-modal="true"');
  });
});

describe("CAM-184 AC-modal-3: GateDetailModal has correct aria-label", () => {
  it("modal has aria-label รายละเอียดงานรออนุมัติ", () => {
    expect(overlaySrc).toContain("รายละเอียดงานรออนุมัติ");
  });
});

describe("CAM-184 AC-modal-4: GateDetailModal has Approve + ส่งกลับ + reason textarea", () => {
  it("contains อนุมัติ button text", () => {
    expect(overlaySrc).toContain("อนุมัติ");
  });

  it("contains ส่งกลับ button text", () => {
    expect(overlaySrc).toContain("ส่งกลับ");
  });

  it("contains reason textarea with aria-label เหตุผลในการส่งกลับ", () => {
    expect(overlaySrc).toContain("เหตุผลในการส่งกลับ");
  });

  it("contains hud-gate-modal-textarea class", () => {
    expect(overlaySrc).toContain("hud-gate-modal-textarea");
  });
});

describe("CAM-184 AC-modal-5: GateDetailModal fetches /api/status/issue", () => {
  it("fetchGateDetail calls /api/status/issue/", () => {
    expect(overlaySrc).toContain("/api/status/issue/");
  });
});

describe("CAM-184 AC-modal-6: approveGate calls /api/status/approve", () => {
  it("approveGate fn contains /api/status/approve", () => {
    expect(overlaySrc).toContain("/api/status/approve");
  });
});

describe("CAM-184 AC-modal-7: rejectGate calls /api/status/reject", () => {
  it("rejectGate fn contains /api/status/reject", () => {
    expect(overlaySrc).toContain("/api/status/reject");
  });
});

// ── Part 7: Notification .you-alert smaller sizes ────────────────────────────

describe("CAM-184 AC-notify-1: .you-alert font-size is 12px", () => {
  it(".you-alert CSS has font-size:12px", () => {
    // .you-alert definition has font-size:12px — use the larger block that includes padding
    expect(sceneSrc).toContain("font-size:12px");
    // The .you-alert rule block must contain font-size:12px (look for the one with padding)
    const match = sceneSrc.match(/\.you-alert\{[\s\S]*?font-size:12px/);
    expect(match).not.toBeNull();
  });
});

describe("CAM-184 AC-notify-2: .you-alert svg icon is 13px", () => {
  it(".you-alert svg CSS has width:13px and height:13px", () => {
    expect(sceneSrc).toContain("width:13px;height:13px");
  });
});

describe("CAM-184 AC-notify-3: .you-alert padding is 5px 11px", () => {
  it(".you-alert CSS has padding:5px 11px", () => {
    expect(sceneSrc).toContain("padding:5px 11px");
  });
});

// ── Part 8: Suppress popover when has-gate ───────────────────────────────────

describe("CAM-184 AC-notify-4: .scout.has-gate .popover{display:none} present", () => {
  it("SCENE_CSS has .scout.has-gate .popover with display:none", () => {
    expect(sceneSrc).toContain(".scout.has-gate .popover");
    expect(sceneSrc).toContain("display:none");
  });

  it("has-gate class is applied to YouScout when gates present", () => {
    expect(sceneSrc).toContain("has-gate");
  });
});

// ── Part 9: Remove green lines ───────────────────────────────────────────────

describe("CAM-184 AC-notify-5: .popover border is rgba(255,255,255,.10) not var(--line-2)", () => {
  it(".popover border does not use var(--line-2)", () => {
    // The main .popover rule (not .scout.has-gate .popover) must use the neutral border
    // Find the first .popover{ block that contains "border-radius" (the main definition)
    const match = sceneSrc.match(/\.popover\{[\s\S]*?border-radius:[\s\S]*?\}/);
    expect(match).not.toBeNull();
    const block = match![0];
    expect(block).not.toContain("var(--line-2)");
    expect(block).toContain("rgba(255,255,255,.10)");
  });
});

describe("CAM-184 AC-notify-6: .pop-role border is rgba(255,255,255,.08) not var(--line)", () => {
  it(".pop-role border does not use var(--line)", () => {
    const roleIdx = sceneSrc.indexOf(".pop-role{");
    const nextBrace = sceneSrc.indexOf("}", roleIdx);
    const block = sceneSrc.slice(roleIdx, nextBrace);
    expect(block).not.toContain("var(--line)");
    expect(block).toContain("rgba(255,255,255,.08)");
  });
});

describe("CAM-184 AC-notify-7: .badge border is rgba(255,255,255,.10) not rgba(150,240,195,.13)", () => {
  it(".badge border does not use rgba(150,240,195,.13)", () => {
    // The main .badge rule contains border:1px solid ... (the rule with border-radius:999px)
    const match = sceneSrc.match(/\.badge\{[\s\S]*?border:1px solid[\s\S]*?\}/);
    expect(match).not.toBeNull();
    const block = match![0];
    expect(block).not.toContain("rgba(150,240,195,.13)");
    expect(block).toContain("rgba(255,255,255,.10)");
  });
});

// ── Part 10: Action function exports ─────────────────────────────────────────

describe("CAM-184 AC-action-1: approveGate exported", () => {
  it("approveGate is exported from campsite-overlays", () => {
    expect(overlaySrc).toContain("export async function approveGate");
  });
});

describe("CAM-184 AC-action-2: rejectGate exported", () => {
  it("rejectGate is exported from campsite-overlays", () => {
    expect(overlaySrc).toContain("export async function rejectGate");
  });
});

describe("CAM-184 AC-action-3: fetchGateDetail exported", () => {
  it("fetchGateDetail is exported from campsite-overlays", () => {
    expect(overlaySrc).toContain("export async function fetchGateDetail");
  });
});
