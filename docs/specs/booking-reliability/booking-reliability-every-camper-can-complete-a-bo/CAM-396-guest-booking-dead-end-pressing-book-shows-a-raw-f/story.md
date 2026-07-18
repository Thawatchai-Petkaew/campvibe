---
artifact: story
owner: product-owner
version: 1
status: In Progress
---

# CAM-396 — Guest booking dead-end: pressing book shows a raw fail toast instead of the login modal

## Story

As a **Camper** (not yet logged in), I want pressing the book button to open the login window instead of failing, so that I can sign in and complete my booking instead of hitting a dead-end error. Scope: `components/CampgroundDetailClient.tsx` (`handleReserve` + failure-toast copy) only. Depends on: — . Why: every guest press currently fires an unauthenticated `POST /api/bookings` → 401 → a raw English "Unauthorized" toast (reproduced live); the wishlist button in the same component already gates correctly.

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | ผู้ใช้ยังไม่ได้เข้าสู่ระบบ เลือกวันเช็คอิน/เช็คเอาท์แล้ว | กดปุ่มจอง | หน้าต่างเข้าสู่ระบบเปิดขึ้น (ไม่มีข้อความผิดพลาดสีแดง) | ไม่มีการยิงคำขอจองไปที่เซิร์ฟเวอร์ | EC-1 |
| AC-2 | ผู้ใช้เข้าสู่ระบบแล้ว เลือกวันครบ | กดปุ่มจอง | ไปยังหน้ายืนยันการจองตามปกติ | Booking ถูกสร้าง (พฤติกรรมเดิม ไม่เปลี่ยน) | EC-2 |
| AC-3 | ผู้ใช้เข้าสู่ระบบแล้ว แต่เซิร์ฟเวอร์ปฏิเสธ (เช่น วันถูกจองแล้ว) | กดปุ่มจอง | ข้อความผิดพลาดภาษาไทย `จองไม่สำเร็จ` (ไม่มีคำภาษาอังกฤษดิบจากระบบ) | ไม่มี Booking ถูกสร้าง | EC-3 |

## Rules

- BR-1: the login gate reads the existing `isLoggedIn` prop (server-resolved) and opens the existing `LoginModal` — identical to the wishlist path; no new UI.
- BR-2: the failure toast NEVER shows the server's raw `data.error` English string; known cases map to existing Thai copy, everything else falls back to `จองไม่สำเร็จ` (`t.newCampground.failedToReserve`).
- BR-3: server behavior unchanged — 401 stays the authoritative guard; the client gate is UX only.

## Edge cases

- EC-1: IF a guest presses book THEN no network request is sent and the login modal opens.
- EC-2: IF a logged-in user books successfully THEN the redirect to the confirmation page is unchanged.
- EC-3: IF the server returns any error (401/409/500) THEN the toast shows Thai copy, never a raw English string.

## Data

None — no schema/API change (spec-lite qualifier).

## Seams & refs

Reuse: `isLoggedIn` prop + `setLoginOpen`/`LoginModal` (the wishlist gate in the same file, ~L321-354) · `t.newCampground.*` keys in `locales/translations.json` · sonner toast (existing).

## Out of scope

The latent per-spot 0-capacity calendar/write-gate divergence (no such camp exists today) → follow-up ticket candidate under CAM-395.

## Self-verify

`npx vitest run __tests__/cam-396-booking-login-gate.test.ts` (Prove-It: repro test red before the fix) · `npm run lint` · `npm run typecheck` · suite green · localhost AC walk (guest → modal; logged-in → booking OK).
