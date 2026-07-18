---
artifact: story
owner: product-owner
version: 1
status: In Progress
---

# CAM-397 — First press after login works: gates read the live client session (reserve + wishlist)

## Story

As a **Camper** who just logged in through the login window, I want my first press of the book (or wishlist) button to work immediately, so that I never have to press twice. Scope: `components/CampgroundDetailClient.tsx` only. Depends on: CAM-396. Why: the CAM-396 gate reads the server-rendered `isLoggedIn` prop, which stays stale until `router.refresh()` lands after a modal login (G4 finding; CAM-241/242 class, now promoted into code.md).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | ยังไม่ได้เข้าสู่ระบบ เลือกวันครบ | กดปุ่มจอง | หน้าต่างเข้าสู่ระบบเปิดขึ้น | ไม่มีคำขอจองถูกส่ง (พฤติกรรม CAM-396 คงเดิม) | EC-1 |
| AC-2 | เพิ่งเข้าสู่ระบบผ่านหน้าต่าง (ไม่รีเฟรชหน้า) เลือกวันครบ | กดปุ่มจอง **ครั้งแรก** | ไปหน้ายืนยันการจองทันที (ไม่ต้องกดซ้ำ) | Booking ถูกสร้างในครั้งแรก | EC-2 |
| AC-3 | เพิ่งเข้าสู่ระบบผ่านหน้าต่าง (ไม่รีเฟรชหน้า) | กดปุ่มหัวใจ **ครั้งแรก** | สถานะบันทึกเปลี่ยนทันที | Wishlist toggle ในครั้งแรก | EC-2 |

## Rules

- BR-1: both gates read the LIVE client session — `useSession()` `status === "authenticated"` — never the server-snapshot `isLoggedIn` prop (code.md promoted rule, CAM-396).
- BR-2: server behavior unchanged; `requireAuth` 401 stays authoritative.
- BR-3: verify once that the root layout hydrates `<SessionProvider session={await auth()}>` (CAM-242) so the live value is correct on first render — if it does not, hydrate it in this story.

## Edge cases

- EC-1: IF a guest presses book/heart THEN the login modal opens and no request is sent.
- EC-2: IF the user logs in via the modal THEN the very next press succeeds without a page refresh (`update()` flips the client session immediately). **Browser-only transition — explicit owner-verify AC row (qa.md promoted rule).**

## Data

None.

## Seams & refs

`useSession` from `next-auth/react` · `LoginModal.handleSubmit` already calls `update()` (LoginModal.tsx:52-67) · wishlist path `lib/wishlist-toggle.ts:102` receives the gate value as an argument — pass the live value, don't change the util.

## Out of scope

Auto-resume the pending booking intent after login (one-press-total UX) — candidate follow-up under CAM-395.

## Self-verify

Source guards: both handlers gate on the live session, the prop is no longer the gate input; suite/lint/typecheck green; owner-verify: the EC-2 transition on staging.
