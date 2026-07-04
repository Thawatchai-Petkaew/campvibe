---
linear: CAM-240
feature: profile-media
epic: avatar-image-fixes (CAM-238)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-28
---
# MEDIA-2 — fix logout regression (proxy /api/auth matcher) + avatar live-update (CAM-240)

## Why

Verification ของ [CAM-239](https://linear.app/campvibe/issue/CAM-239/devops-release-media-1-fix-avatar-display-image-upload-navbar-stale) เจอ 2 ปัญหา: (B1) **regression จาก** [CAM-237](https://linear.app/campvibe/issue/CAM-237/frontend-engineer-launch-1-coming-soon-holding-page-env-gated-flicker) — proxy.ts matcher เอา `api` ออก → middleware `auth()` ครอบ `/api/auth/*` ของ NextAuth → หลัง logout ช้า/login ใหม่ไม่ได้/favorite ค้าง; (B2) avatar ที่ navbar ต้อง re-login ถึงอัปเดต ([CAM-239](https://linear.app/campvibe/issue/CAM-239/devops-release-media-1-fix-avatar-display-image-upload-navbar-stale) fix A ไม่ครบ — `update()` ไม่ re-issue server cookie). ทั้งคู่ full-app (staging), prod Coming Soon ไม่กระทบ.

## Story

ในฐานะ **ผู้ใช้** ฉันต้องการ **logout/login ได้ลื่นและสะอาด และเห็นรูป/ชื่อใหม่ทันทีหลังแก้โปรไฟล์** เพื่อ **ใช้งานบัญชีได้ปกติ**. ขอบเขต: B1 (matcher regression) + B2 (avatar live-update) + B3 (favorite clear on logout, ถ้ายังค้างหลัง B1).

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | login อยู่ | กด Logout | ออกจากระบบทันที ไม่ช้า | session/cookie ถูกเคลียร์สะอาด; `/api/auth/*` ไม่ผ่าน middleware |
| 2 | เพิ่ง logout | กด เข้าสู่ระบบ ใหม่ | login ได้ทันที ไม่ติด | signin flow ปกติ (ไม่ถูก middleware ครอบ) |
| 3 | logout แล้ว | ดูหน้าเว็บ | ไม่เห็นรายการ favorite ของบัญชีเดิม | currentUser=null → UI wishlist ซ่อน/เคลียร์ |
| 4 | แก้รูป/ชื่อ ในโปรไฟล์ สำเร็จ | กลับไปหน้าอื่น (เช่นหน้าแรก) | avatar/ชื่อ ที่ navbar เป็นค่าใหม่ทันที (ไม่ต้อง re-login) | navbar อ่าน client session ที่ update() รีเฟรช |
| 5 | prod อยู่โหมด Coming Soon | เรียก `/api/campsites` | ยังถูกบล็อก (ไม่พบ) | COMING_SOON gate ยัง 404 `/api/*` อื่น (ยกเว้น `/api/auth`) |

## Rules

* **B1** `proxy.ts` matcher → exclude `/api/auth` : `'/((?!_next/static|_next/image|favicon.ico|.*\\.png$|api/auth).*)'`. NextAuth routes ไม่ผ่าน middleware (clean). COMING_SOON gate ยังจับ `/api/*` อื่น (data) → 404 บน prod-coming-soon. `/api/auth` reachable บน prod-coming-soon = ยอมรับได้ (ไม่มี login UI + ไม่มี prod DB)
* **B2** `components/Navbar.tsx` ใช้ `const user = session?.user ?? currentUser` (มี `useSession()` อยู่แล้วสำหรับ status) — SSR ใช้ currentUser (ไม่ flash), หลัง `update()` client session เข้ามาแทน. คง `currentUser` prop ไว้เป็น initial
* **B3** (ถ้า favorite ยังค้างหลัง B1) เคลียร์ client `saved` state เมื่อ session → unauthenticated
* re-verify route protection ([CAM-203](https://linear.app/campvibe/issue/CAM-203/devops-release-sec-3-strict-csp-nonce-script-src-remove-unsafe-inline)): `/dashboard` ยัง protect, `/api/auth/session` ทำงาน, CSP nonce ยังตั้ง · token-only · check:ds เขียว

## Data

* ไม่มี migration · ไม่มี field ใหม่ · แก้ matcher + Navbar + (อาจ) wishlist client state

## Out of scope

* เปลี่ยน session strategy / re-issue cookie แบบ manual · login rate-limit reset (แยกเรื่อง ถ้าพบว่าเป็นปัญหาจริงหลัง B1)

## Self-verify

* logout → ลื่น, login ใหม่ได้, favorite หาย · แก้โปรไฟล์ → navbar อัปเดตทันทีทุกหน้า · prod gate ยัง 404 /api/campsites · `/dashboard` ยัง redirect login · sec3-csp-nonce + COMING_SOON gate tests เขียว · lint/typecheck/test/build/check:ds เขียว

## Links

* Epic [CAM-238](https://linear.app/campvibe/issue/CAM-238/avatar-and-image-fixes) · regression from [CAM-237](https://linear.app/campvibe/issue/CAM-237/frontend-engineer-launch-1-coming-soon-holding-page-env-gated-flicker) (proxy matcher) · proxy.ts matcher · Navbar.tsx (useSession) · app/page.tsx:85 (server currentUser) · lib/auth.ts:173 (jwt update)
