<!--
ticket: CAM-368
epic: Availability Correctness — ว่างจริง (BlockedDate + partial capacity + hold)
feature: Data & Trust
status: Approved (G1 spec-lite folded into G3 packet — delegated autonomy 2026-07-05)
version: v1
spec-class: SPEC-LITE (S) — no schema/migration · no new API contract · shared-hook
  file surface (one new hook + two consuming modals + tests) · expected diff ≤ ~150 lines.
persona: Camper
-->

## Story
As a **Camper** browsing photos with a keyboard or on a phone, I want the photo viewers (flat gallery and panorama) to hold my focus and stop the page behind from scrolling, so that Tab never dumps me into the invisible background page and the page position never jumps while a viewer is open.
Why: G3 review of CAM-354 found both gaps are shared by `ImageGallery` and `PanoramaViewer` (the new viewer faithfully inherited the old gallery's idiom) — fix once, shared.
Scope: one shared client hook providing (a) a Tab/Shift+Tab focus trap scoped to the open dialog and (b) a body scroll lock while open, wired into BOTH modals. No visual change, no new copy, no API change.
Depends on: CAM-354 (merged).

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | modal รูป (แบบแบนหรือพาโนรามา) เปิดอยู่ | ผู้ใช้กด Tab ไปเรื่อยๆ | โฟกัสวนอยู่เฉพาะส่วนควบคุมภายใน modal (ถึงตัวสุดท้ายแล้ววนกลับตัวแรก) ไม่หลุดไปหน้าที่อยู่ข้างหลัง | ไม่มีการเปลี่ยนข้อมูล | EC-1 |
| AC-2 | modal เปิดอยู่ โฟกัสอยู่ตัวควบคุมแรก | ผู้ใช้กด Shift+Tab | โฟกัสวนไปตัวควบคุมสุดท้ายภายใน modal | — | EC-1 |
| AC-3 | modal เปิดอยู่ หน้าเบื้องหลังยาวกว่าจอ | ผู้ใช้หมุนล้อเมาส์/ปัดนิ้วบริเวณฉากหลัง | หน้าเบื้องหลังไม่เลื่อน และเมื่อปิด modal หน้ากลับมาเลื่อนได้ที่ตำแหน่งเดิม | — | EC-2 |
| AC-4 | modal เปิดอยู่ | ผู้ใช้กด Escape หรือปุ่มปิด | ปิดได้เหมือนเดิม และโฟกัสกลับไปยังรูปที่กดเปิด (พฤติกรรมเดิมของทั้งสอง modal ต้องไม่เปลี่ยน) | — | — (regression twin ของทุกแถว) |

## Rules
- BR-1 **One shared hook** `lib/hooks/use-modal-a11y.ts` owns 100% of the trap + scroll-lock logic; `components/ImageGallery.tsx` and `components/PanoramaViewer.tsx` both consume it — no per-modal forks, no copy-paste. (proves AC-1..3)
- BR-2 **Trap mechanics:** on Tab/Shift+Tab, query focusable elements LIVE inside the dialog container (buttons/links/tabindex>=0, visible only) and wrap first<->last; if focus is somehow outside the container, pull it to the first focusable. Escape handling stays where it is today (no behavior change). (proves AC-1/2/4)
- BR-3 **Scroll lock:** on open, lock body scrolling and remember the prior state; on close/unmount (including route-change unmount), restore exactly — never leave the page locked. Compensate layout shift if a scrollbar disappears (no visual jump). (proves AC-3, EC-2)
- BR-4 **Zero new dependencies; token/DOM-only.** No focus-trap libs. (Design gate: no visual change at all.)

## Edge cases
- EC-1 IF the dialog's focusable set changes while open (e.g. an image error swaps controls) THEN the trap still wraps correctly because the set is queried at keydown time, not cached at mount (BR-2)
- EC-2 IF the modal unmounts abnormally (route change/back button) THEN the body scroll state is still restored by the effect cleanup — a locked page with no modal is the worst failure of this story (BR-3)
- EC-3 IF both photo modals somehow mount in the same session sequentially THEN each open/close cycle locks and restores independently (no lock-count leak)

## Data
- None. No schema, no endpoint.

## Seams & refs
<!-- Derivation/enforcement unchanged — inventory sweep N/A (UI behavior only). -->
- Reuse: `components/ImageGallery.tsx` (existing Escape + focus-restore idiom — keep) · `components/PanoramaViewer.tsx` (same) · hook precedent `lib/hooks/use-minimum-loading.ts` (file layout/test conventions).
- Refs: CAM-354 G3 review findings 1-2 (the shared-gap source).

## Out of scope
- aria-hidden/inert on the background tree (heavier pattern; revisit only if AT users report leakage despite aria-modal).
- Any change to gallery navigation, zoom, pan mechanics, or visuals.

## Self-verify
- AC-1/2 + BR-2 + EC-1 → behavioral unit tests on the hook's trap algorithm (mirror-simulator per repo node-env convention: focusable-list wrap logic first/last/shift, live-requery case) + structural test tying both modals to the hook import.
- AC-3 + BR-3 + EC-2/3 → behavioral unit tests on the lock/restore state machine (open->close, unmount cleanup, sequential cycles) + structural test that the hook is the only place touching body overflow.
- AC-4 → structural regression assertions: existing Escape handler + focus-restore code unchanged in both modals.
- Browser-only behaviors (real Tab order, real scroll) → owner-verify on localhost (dev branch) per LESSONS 2026-06-27 (CAM-199).
- Gate = /quality-gate · Done = merged to dev + owner localhost check.

## Changelog
- v1 (2026-07-05) — created (spec-lite, from CAM-354 G3 findings). First story through the dev-branch one-PR flow.
