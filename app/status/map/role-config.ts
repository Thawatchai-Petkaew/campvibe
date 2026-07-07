// /status/map — shared role display data (CAM-372 S1c).
//
// Single source of truth for the Thai-friendly displayName + roleLabel per
// canonical role. Both the renderer-agnostic shell (campsite-scene.tsx's
// Roster Sheet) and the 2D renderer (campsite-canvas.tsx's ROLE_CONFIG —
// node/color/poseIdx stay 2D-specific, local to that file) import from here,
// so the shell never depends on a specific renderer's data. Pure data only —
// no React import, no "use client" (mirrors map-types.ts).

export interface RoleDisplay {
  displayName: string;
  roleLabel: string;
}

export const ROLE_DISPLAY: Record<string, RoleDisplay> = {
  "architect":          { displayName: "Architect", roleLabel: "วางแผนระบบ" },
  "ux-designer":        { displayName: "Designer",  roleLabel: "UX และวิชวล" },
  "backend-engineer":   { displayName: "Backend",   roleLabel: "API และบริการ" },
  "frontend-engineer":  { displayName: "Frontend",  roleLabel: "หน้าแอป" },
  "devops-release":     { displayName: "DevOps",    roleLabel: "CI/CD" },
  "qa-engineer":        { displayName: "QA",        roleLabel: "ทดสอบและตรวจสอบ" },
  "security-reviewer":  { displayName: "Security",  roleLabel: "ความปลอดภัย" },
};
