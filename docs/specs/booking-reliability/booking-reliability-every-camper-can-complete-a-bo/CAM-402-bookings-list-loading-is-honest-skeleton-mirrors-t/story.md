---
artifact: story
owner: product-owner
version: 1
status: In Progress
---

# CAM-402 — Bookings list loading is honest: skeleton mirrors the fixed card and no empty-state flash

## Story

As a **Camper** opening my bookings list, I want the loading state to look like the real page and never flash "no bookings", so that loading reads as loading, not as a broken or empty page. Scope: `app/bookings/page.tsx` (render branch) + `components/ui/booking-list-skeleton.tsx`. Depends on: CAM-398. Why (G4 findings with screenshot): the skeleton kept the pre-CAM-398 pinned thumbnail (`md:w-64 h-48`) so it shows the exact bottom gap the real card was cured of; and during `useMinimumLoading`'s ~300ms delay window (`showSkeleton=false`, `isLoading=true`, `bookings=[]`) the render falls through to the EMPTY STATE for a flash before the skeleton appears.

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | เปิดหน้ารายการการจอง ระหว่างโหลด | ดูโครงโหลด (จอเดสก์ท็อป) | ช่องรูปของโครงโหลดเต็มคอลัมน์ซ้าย ไม่มีช่องว่างใต้รูป (เหมือนการ์ดจริง) | skeleton mirrors the CAM-398 card exactly (CLS ≈ 0) | EC-1 |
| AC-2 | เปิดหน้าแล้วข้อมูลยังมาไม่ถึง | ช่วง ~300ms แรก | หน้าว่างเฉย ๆ (ไม่มีข้อความ `ยังไม่มีการจอง` แวบขึ้น) | delay window renders nothing; empty state only after loading finishes | EC-2 |
| AC-3 | ผู้ใช้ไม่มีการจองจริง | โหลดเสร็จ | ข้อความ `ยังไม่มีการจอง` ตามเดิม | empty state unchanged when genuinely empty | — |

## Rules

- BR-1: skeleton = the real card's shell (loading.md §2 structural coupling): thumbnail wrapper `md:w-64 h-48 md:h-auto` + inner Skeleton `w-full h-full`; mobile unchanged.
- BR-2: render branch order = `showSkeleton ? skeleton : isLoading ? null : hasError ? error : empty/list` — the empty/list branches are gated on `!isLoading`, never on `showSkeleton` alone (loading.md §4: the delay window intentionally shows nothing).
- BR-3: no behavior change to error state, list rendering, or the hook's delay/minDisplay values.

## Edge cases

- EC-1: IF the real card layout changes again THEN the skeleton guard test fails (pin both to the same classes).
- EC-2: IF the fetch resolves within the delay window THEN content renders directly with no loader flash (existing hook behavior, preserved).

## Data

None.

## Seams & refs

`useMinimumLoading` (`lib/hooks/use-minimum-loading.ts`) unchanged · real card classes from CAM-398 (`app/bookings/page.tsx` image wrapper) · loading.md §2/§4.

## Out of scope

Any other page's skeleton; hook API changes.

## Self-verify

Tests: skeleton classes mirror the card (both pinned); branch order guards (empty unreachable while isLoading). Suite/lint/typecheck green; owner-verify: no flash + no gap on staging.
