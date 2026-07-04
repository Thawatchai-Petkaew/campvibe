---
linear: CAM-242
feature: profile-media
epic: avatar-image-fixes (CAM-238)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-28
---
# MEDIA-4 — hydrate SessionProvider (root fix: navbar session sync on all pages) (CAM-242)

## Why

ราก (library-grounded) ของ navbar ไม่ sync (login/logout/avatar) ทุกหน้ายกเว้น /bookings: `SessionProvider` ไม่มี initial `session` → `useSession()` เริ่มที่ `loading` → `navUser` fallback ไป server `currentUser` prop ที่ frozen. มี 2 แหล่ง session resolve คนละเวลา. /bookings ใช้ได้เพราะเป็น client page อ่าน useSession เอง (แหล่งเดียว). 3 fix ก่อน ([CAM-239](https://linear.app/campvibe/issue/CAM-239/devops-release-media-1-fix-avatar-display-image-upload-navbar-stale) A / [CAM-240](https://linear.app/campvibe/issue/CAM-240/devops-release-media-2-fix-logout-regression-proxy-apiauth-matcher) B2 / [CAM-241](https://linear.app/campvibe/issue/CAM-241/devops-release-media-3-auth-client-session-sync-login-logout-via) client signIn-signOut) เป็นปลายเหตุ.

## Story

ในฐานะ **ผู้ใช้** ฉันต้องการ **login/logout/แก้รูป แล้ว navbar เปลี่ยนทันทีเหมือนกันทุกหน้า** เพื่อ **บัญชีทำงานน่าเชื่อถือ**. ขอบเขต: hydrate SessionProvider + ให้ Navbar ใช้ client session แหล่งเดียว.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | อยู่หน้าใดก็ได้ (home/wishlist/host/แคมป์) | login | navbar เป็น logged-in ทันที | useSession authoritative ตั้งแต่ paint แรก (initial session) |
| 2 | อยู่หน้าใดก็ได้ | logout | navbar เป็น logged-out ทันที | client session เคลียร์ + navbar อ่าน session แหล่งเดียว |
| 3 | แก้รูป/ชื่อ ในโปรไฟล์ | กลับมาหน้าที่มี navbar | avatar/ชื่อใหม่ขึ้นทันที | update() รีเฟรช client session → navUser=session.user |
| 4 | โหลดหน้าแรก (ขณะ login อยู่) | paint แรก | navbar logged-in ทันที ไม่มี flash | initial session → ไม่มี loading window |

## Rules

1. `app/layout.tsx`: เป็น async, `const session = await auth()`, `<Providers session={session}>`
2. `components/Providers.tsx`: รับ `session: Session | null` → `<SessionProvider session={session}>`
3. `components/Navbar.tsx`: `const navUser = session?.user ?? null` (ทิ้ง `status==="loading" ? currentUser` dual-source)
4. cleanup: เอา `currentUser` ออกจาก `NavbarProps` + ทุก call site (`app/page.tsx`, `wishlist`, `host`, `host/new`, `campgrounds/[slug]`, `bookings`, `bookings/[id]`, `bookings/[id]/confirmation`) — หน้าเหล่านี้ยังเรียก auth() เพื่ออย่างอื่นได้

* re-verify ([CAM-203](https://linear.app/campvibe/issue/CAM-203/devops-release-sec-3-strict-csp-nonce-script-src-remove-unsafe-inline)/218): `/dashboard` ยัง protect; nonce CSP ยังทำงาน (route เป็น dynamic อยู่แล้ว); ไม่กระทบ /coming-soon gate · token-only · check:ds เขียว

## Out of scope

* session strategy · register auto-login

## Self-verify

* login/logout/แก้รูป → navbar เปลี่ยนทันทีทุกหน้า (home + bookings เหมือนกัน) · ไม่มี loading flash · /dashboard ยัง protect · nonce ยังตั้ง · lint/typecheck/test/build/check:ds เขียว

## Links

* Epic [CAM-238](https://linear.app/campvibe/issue/CAM-238/avatar-and-image-fixes) · root ของ [CAM-239](https://linear.app/campvibe/issue/CAM-239/devops-release-media-1-fix-avatar-display-image-upload-navbar-stale)/240/241 · layout.tsx · Providers.tsx:14 · Navbar.tsx:57 · 8 call sites · next-auth v5 SessionProvider initial-session pattern
