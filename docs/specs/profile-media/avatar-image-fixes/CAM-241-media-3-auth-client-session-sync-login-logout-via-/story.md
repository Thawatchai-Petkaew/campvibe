---
linear: CAM-241
feature: profile-media
epic: avatar-image-fixes (CAM-238)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-28
---
# MEDIA-3 — auth client-session sync: login + logout via client signIn/signOut (CAM-241)

## Why

ทั้ง login และ logout ไม่อัปเดต navbar (ต้อง hard-reload). รากเดียวกัน: แอปใช้ **server action** ทำ credentials login (`authenticate`→`signIn`→`redirect`) + logout (`handleSignOut`→`signOut`) แต่ navbar/modals อ่าน **client** `useSession()` ซึ่ง `SessionProvider` ไม่ refetch หลัง server-action auth → ค้าง. (Google OK เพราะ full-page redirect; Profile OK เพราะเรียก `update()`.)

## Story

ในฐานะ **ผู้ใช้** ฉันต้องการ **login/logout แล้ว navbar เปลี่ยนสถานะทันที** เพื่อ **ใช้งานบัญชีได้ลื่นไม่ต้องรีโหลด**. ขอบเขต: เปลี่ยน credentials login + logout ไปใช้ client `signIn`/`signOut` (มาตรฐาน NextAuth v5).

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | กรอก email/password ถูก ใน modal | กดเข้าสู่ระบบ | modal ปิด + navbar เป็น logged-in (avatar/ชื่อ) **ทันที ไม่ต้องรีโหลด** | client `signIn('credentials',{redirect:false})` → SessionProvider อัปเดต |
| 2 | กรอกรหัสผิด | กดเข้าสู่ระบบ | เห็นข้อความ `อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองอีกครั้ง` | `result?.error` → แสดง error เดิม (Thai verbatim) |
| 3 | login อยู่ | กด ออกจากระบบ (navbar หรือ dashboard) | ออกทันที กลับหน้าแรก navbar เป็น logged-out | client `signOut({callbackUrl:"/"})` |
| 4 | พยายาม login ผิดเกินกำหนด | กดซ้ำหลายครั้ง | ถูกจำกัด (เหมือนเดิม) | rate-limit ใน authorize callback ยังทำงาน (รันฝั่ง server เสมอ) |
| 5 | login ผ่านปุ่ม Google | กด | ทำงานเหมือนเดิม | googleSignIn server action ไม่แตะ |

## Rules

* **LoginModal + app/login/page.tsx**: ใช้ `signIn('credentials',{ email, password, redirect:false })` (client); `result?.error` → Thai error เดิม; success → ปิด/`router.refresh()` (modal) หรือ `router.push(callbackUrl)` + refresh (page) โดยคง open-redirect guard กับ callbackUrl
* **Navbar + DashboardHeader**: `signOut({ callbackUrl:"/" })` (client) แทน `handleSignOut`
* **lib/actions.ts**: ลบ `authenticate` + `handleSignOut` (เก็บ `register`, `googleSignIn`); เอา import ที่ไม่ใช้แล้วออก
* คงไว้: rate-limit (authorize), Google, register, modal-switch, email validation · token-only · check:ds เขียว
* re-verify ([CAM-203](https://linear.app/campvibe/issue/CAM-203/devops-release-sec-3-strict-csp-nonce-script-src-remove-unsafe-inline)): `/dashboard` ยัง protect

## Out of scope

* register auto-login (คงสลับไป login ตาม [CAM-235](https://linear.app/campvibe/issue/CAM-235/frontend-engineer-auth-g2-auth-modal-switch-google-on-register-modal)) · session strategy

## Self-verify

* login (modal+page) → navbar logged-in ทันที · รหัสผิด → Thai error · logout (navbar+dashboard) → logged-out ทันที · rate-limit ยังทำงาน · Google OK · /dashboard ยัง protect · lint/typecheck/test/build/check:ds เขียว

## Links

* Epic [CAM-238](https://linear.app/campvibe/issue/CAM-238/avatar-and-image-fixes) · ต่อจาก [CAM-240](https://linear.app/campvibe/issue/CAM-240/devops-release-media-2-fix-logout-regression-proxy-apiauth-matcher) · LoginModal.tsx · app/login/page.tsx · Navbar.tsx:265 · DashboardHeader.tsx:87 · lib/actions.ts (authenticate/handleSignOut) · lib/auth.ts authorize (rate-limit)
