# CAM-159 — HUD Redesign: Bottom Dock + Expand Panels + Kanban Modal

> Status SoT = Linear CAM-159. Content SoT = this folder. Parent epic: [CAM-150](../feature.md).

## Why

The four corner glass-chip overlays (top-left/top-right/bottom-left/bottom-right) are hard to read at a glance and feel scattered. In Epic scope, the Up-next and Crew overlays both use `position="right"`, causing them to overlap and render a broken view. The owner wants one cohesive, easy-to-read summary surface that expands on click, with heavy data (the Kanban board) in a large centered modal.

**KPI:** Epic scope no longer overlaps or blanks the scene; all data visible from a single bottom bar without moving the eye to four corners.

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **ดูสรุปการส่งมอบจาก command dock แถบเดียวที่ด้านล่างหน้าจอ** แทนที่จะเป็น chips สี่มุม และต้องการให้หน้า Epic แสดงผลได้โดยไม่ซ้อนทับกันและฉากไม่หายไป เพื่อ **ให้อ่านสถานะได้ทันทีโดยไม่ต้องมองสี่มุมจอ**

**ขอบเขต:** เปลี่ยน overlay system เป็น bottom dock + expand-panels + Kanban modal; แก้ Epic bug (overlapping chips + blank scene); ย้าย view toggle จาก top-left ไป top-center; ไม่เปลี่ยน data wiring, engine, หรือ API.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
|---|---|---|---|---|
| 1 | `/status/map` เปิดอยู่ (Overview scope) | ดูหน้าจอ | เห็น command dock แถบเดียวตรงกลางด้านล่าง แสดง: scope picker / % เสร็จ + mini-bar / ⚑ gate count / ทีม N/7 / Env Dev·St·Pr / Backlog N | ไม่มี chip ที่มุมจอ; dock fixed bottom-center translateX(-50%) |
| 2 | กดปุ่มใดก็ตามใน dock | ปุ่มถูกกด | panel ลอยขึ้นเหนือ dock (translateY up + fade 180ms); panel มี role=dialog, focus-trap, Esc ปิดได้ | animation ภายใน prefers-reduced-motion:no-preference; ใน reduce-motion panel ปรากฏทันที |
| 3 | Epic scope, กด `เปิดบอร์ด` | ปุ่มถูกกด | modal ขนาดใหญ่กลางหน้าจอ (scale+fade 200ms, backdrop dimmed) แสดง header + progress bar + metric pills + 5-column Kanban | Modal role=dialog aria-modal, focus-trap, Esc ปิด, click-outside ปิด |
| 4 | Epic scope (เดิม) | ดูหน้าจอ | ไม่มี chip ซ้อนกัน; dock แสดง Stage N/5, ▶/⚑/⏳/✓ counts, ทีม N/7, ในคิว N, ปุ่ม `เปิดบอร์ด` | Up-next และ Crew ไม่ใช้ position="right" อีกต่อไป |
| 5 | Epic stories ไม่มี [role] tag ใดเลย | เข้า Epic scope | ฉากยังแสดงตัวละครทุกตัว (ไม่มีตัวถูก dim) | setScope fallback to "all" เมื่อ epicRoles.length === 0 |
| 6 | URL `/status/map?scope=epic&epic=X` ที่ epic ไม่พบในข้อมูล | โหลดหน้า | ฉากแสดง Overview (ไม่ขาว ไม่ crash) พร้อม empty state ใน dock | activeEpicData = null; scene renders normally |
| 7 | ดู view toggle | ดูหน้าจอ | toggle pill `แดชบอร์ด | แผนที่` อยู่กลางบนสุด (top-center), ไม่ใช่มุมซ้ายบน | position:fixed top:18px left:50% translateX(-50%) |
| 8 | prefers-reduced-motion: reduce เปิดอยู่ | เปิด/ปิด panel หรือ modal | panel/modal ยังปรากฏและปิดได้ แต่ไม่มี animation | CSS transitions ภายใน @media (prefers-reduced-motion:no-preference) block เท่านั้น |

## Rules

- ไม่แตะ `campsite-engine.ts`, `/api/status/`, `lib/status-map-model.ts`, `lib/status-derive.ts`
- ข้อมูลทุกตัวเลขมาจาก model ที่ส่งเข้ามา (projectPct, gates, agents, epics, etc.) — ไม่ hardcode
- Thai copy: ไม่มี em-dash เป็น separator, ไม่มี jargon (API, webhook, endpoint)
- Empty states ทุก panel ต้องมี Thai copy ที่ถูกต้อง (เหมือนเดิม)
- a11y: dock segments เป็น `<button aria-expanded>`, panels/modals เป็น `role=dialog aria-modal`, focus-trap + Esc + return-focus, ≥44px tap, visible focus ring

## Data

ไม่มี schema/API changes. เปลี่ยนเฉพาะ:
- `app/status/map/campsite-overlays.tsx` — rewrite presentation layer
- `app/status/map/campsite-scene.tsx` — import ViewToggle, fix setScope guard, fix activeEpicData fallback, remove old inline nav
- `__tests__/status-map.test.ts` — add CAM-159 source-inspection tests

## Out of scope

- เปลี่ยน token หรือสร้าง component ใหม่ใน `components/ui/` (ใช้ custom CSS ใน internal ops dashboard)
- เปลี่ยน engine animation หรือ data endpoint
- Drag-and-drop บน Kanban (ทำได้ใน story ถัดไป)

## Self-verify

- `npm run lint` → 0 errors
- `npm run typecheck` → clean
- `npm test` → all green including new CAM-159 tests
- `npm run build` → success
- `npm run check:palette` → PASS (status/** exempt)

## Links

- Parent: CAM-150 (Campsite delivery map feature)
- Previous story: CAM-157 (S7 — A11y + perf hardening)
- Previous story: CAM-158 (S8 — Forest background)
