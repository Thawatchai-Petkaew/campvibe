---
linear: CAM-235
feature: authentication
epic: google-oauth-login (CAM-233)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-27
---
# AUTH-G2 — auth modal switch + Google on register + modal perf/X-bounce fixes (CAM-235)

## Why

เจ้าของพบ 4 bug ของ auth modal + modal ทั่วไป: register ไม่มี Google, ลิงก์สลับ login/register ไม่ทำงาน (ไป page แทน switch modal), /register ไม่ 404, และ modal เปิด/ปิดช้า + ปุ่ม X เด้งลง.

## Story

ในฐานะ **camper** ฉันต้องการ **สมัคร/เข้าระบบผ่าน modal ที่สลับกันลื่นและเปิดปิดไว** เพื่อ **เข้าใช้งานสะดวกไม่สะดุด**. ขอบเขต: 4 จุดด้านล่าง.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | modal สมัครสมาชิก | ดู | มีปุ่ม "เข้าสู่ระบบด้วย Google" เหมือนหน้าเข้าสู่ระบบ | RegisterModal เรียก `googleSignIn` |
| 2 | อยู่ใน modal สมัครสมาชิก | กด "เข้าสู่ระบบ" ด้านล่าง | modal สลับไปเป็นเข้าสู่ระบบ (ไม่หาย) | ปิด register + เปิด login |
| 3 | อยู่ใน modal เข้าสู่ระบบ | กด "ลงทะเบียน" ด้านล่าง | modal สลับไปเป็นสมัครสมาชิก (ไม่ไปหน้าใหม่) | ปิด login + เปิด register |
| 4 | เปิด URL `/register` ตรงๆ | โหลด | เห็นหน้า "ไม่พบหน้านี้" (404) | `notFound()` |
| 5 | กดปุ่มเข้าสู่ระบบ/สมัคร ที่ navbar | เปิด/ปิด modal | เปิดไว ปิดไว ไม่ช้า | ถอด backdrop-blur ที่ overlay |
| 6 | กดปุ่ม X ปิด modal ใดก็ได้ | กด | ปุ่มไม่เด้งลง | neutralize `active:translate-y-px` ที่ปุ่ม X (ModalHeader) |

## Rules

* modal switch ผ่าน callback จาก Navbar (`onSwitchToLogin`/`onSwitchToRegister`) — ใช้ state `isLoginOpen`/`isRegisterOpen` ที่มีอยู่
* **เก็บ /login** (ปลายทาง NextAuth signIn redirect) · 404 เฉพาะ /register · standalone /login register-link → ชี้ `/` (กัน dead link)
* perf: overlay เอา `backdrop-blur` ออก (คง `bg-foreground/15` dim) — GPU ลด, เปิดปิดไว · X: override active-translate เฉพาะปุ่มปิด (ไม่ถอด affordance ปุ่มทั่วไป)
* token-only · reuse i18n keys · check:ds blocking ต้องเขียว

## Out of scope

* 404 /login + เปลี่ยน signIn redirect (follow-up ถ้าเจ้าของอยากได้ modal-only เต็ม) · ทำหน้า standalone login/register ใหม่

## Self-verify

* register มีปุ่ม Google · สลับ login↔register ได้ 2 ทาง · /register → 404 · เปิด/ปิด modal ไว (ไม่มี blur ค้าง) · X ไม่เด้ง · lint/typecheck/test/build/check:ds เขียว

## Links

* Epic [CAM-233](https://linear.app/campvibe/issue/CAM-233/google-oauth-login) · LoginModal:208 (a href) · RegisterModal:243 (onClose) · Navbar:54-55 state · dialog.tsx:42 (overlay blur) · button.tsx:8 (active translate)
