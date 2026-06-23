# CAM-157 (S7) — Design-gate / Perf hardening pass

> Status SoT = Linear CAM-157. Content SoT = this folder. Parent epic: [CAM-150](../feature.md).

## Why

S1–S6 deliver a fully functional animated campsite delivery map with real-time data, epic scope, and dashboard linkage. S7 closes the remaining design-gate and WCAG gaps: reduced-motion completeness, keyboard/screen-reader access, error/loading/empty states fully verified, bundle budget measured and confirmed, and the deep-link scope bug fixed. No new features are added.

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **ดูแผนที่แคมป์ที่ใช้งานได้สมบูรณ์ด้วยคีย์บอร์ดและ screen reader รวมถึงแสดงผลได้ถูกต้องเมื่อตั้งค่า reduced-motion** เพื่อ **ให้ทุกคนใช้งานได้และผ่าน Design Gate ก่อน merge**

**ขอบเขต:** a11y hardening (role="img", character buttons, reduced-motion labels, focus ring, tap targets) + error/loading/empty state verification + perf budget measurement + deep-link scope fix. ไม่เพิ่มฟีเจอร์ใหม่.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
|---|---|---|---|---|
| 1 | `prefers-reduced-motion: reduce` เปิดอยู่ | หน้า `/status/map` โหลด | ตัวละครทุกตัวแสดง ชื่อ (display name) + แถบสถานะ (`กำลังทำ`/`พัก`) ใต้รูป; You แสดง `⚑N รอคุณ` หรือ `ปกติ` | ไม่มี rAF loop; CSS .rm-label แสดงผล; ทุก signal ที่ motion ส่งยังอ่านได้เป็น text |
| 2 | หน้า `/status/map` เปิดอยู่ | ใช้คีย์บอร์ด Tab | You ได้ focus ก่อน → agents ตามลำดับ → overlay chips; กด Enter/Space บน agent → Crew panel เปิด; scene root มี role="img" + aria-label สรุปภาพรวม | แต่ละ agent เป็น `<button>` จริง; focus ring มองเห็น; tap target ≥44px |
| 3 | server fetch ล้มเหลว | `/status/map` โหลด | แสดง `โหลดข้อมูลจาก Linear ไม่ได้: {err}` บน night-scene (ไม่ขาว/เปล่า) | copy ตรงกับ `/status` verbatim; SCENE background render ก่อน error banner |
| 4 | scene กำลัง hydrate | first paint | เห็น `กำลังโหลดแผนที่แคมป์…` placeholder บน night-scene พร้อม role="status" aria-live="polite" | loading placeholder labelled; ไม่ blank |
| 5 | overlay ต่างๆ ว่างเปล่า | เปิด panel | copy empty state ครบ: ไม่มีงาน/epic/backlog/คิว/board-column | ทุก overlay panel มี empty state copy ภาษาไทย |
| 6 | หลัง build | ตรวจ route bundle | First Load JS `/status/map` route: entry ~44KB gzipped; lazy scene chunks ~18KB gzipped; รวม ~62KB — ต่ำกว่า 200KB budget | sprites ทุกไฟล์ <200KB; dynamic ssr:false ใช้งาน |
| 7 | URL `/status/map?scope=epic&epic=X` | โหลดหน้า | scene แสดง Epic scope ถูกต้องจาก frame แรก (agents ที่ไม่อยู่ใน epic ถูก dim) | `engineReady` state ถูก include ใน scope-effect deps; scope apply ทันที engine start |

## Rules

- reduced-motion labels (`.rm-label`) อยู่ใน accessibility tree เสมอ (`aria-hidden="true"` บน element แต่ text อยู่ใน DOM); display:none ถูก override โดย `@media (prefers-reduced-motion: reduce)` CSS
- Agent เปลี่ยนจาก `<div>` เป็น `<button>` — You render ก่อนใน DOM เพื่อให้ tab order ถูกต้อง
- Error copy: `โหลดข้อมูลจาก Linear ไม่ได้:` — ตรงกับ `/status` verbatim (no deviation)
- ไม่มี feature ใหม่ — S7 เป็น hardening pass เท่านั้น
- ไม่มี em-dash, ไม่มี jargon ใน Thai copy

## Data

ไม่มี schema/API changes. เพิ่ม:
- `engineReady` state ใน `campsite-scene.tsx` (no new export)
- `.rm-label` CSS block (ภายใน `SCENE_CSS` string)

## Out of scope

- Walking animation เมื่อ agent status เปลี่ยน (ทำได้ใน S8)
- axe/contrast automated measurement (browser-only — ระบุใน test.md)
- Lighthouse CWV measurement (browser-only — ระบุใน delivery.md)

## Self-verify

- `npm run lint` → 0 errors (224 pre-existing warnings unchanged)
- `npm run typecheck` → clean
- `npm test` → 2309 passed (2282 pre-S7 + 27 new S7 tests)
- `npm run build` → build success
- `npm run check:palette` → PASS 0 violations

## Links

- Parent: CAM-150 (Campsite delivery map feature)
- Previous story: CAM-156 (S6 — Real-time + Dashboard|Map linkage)
