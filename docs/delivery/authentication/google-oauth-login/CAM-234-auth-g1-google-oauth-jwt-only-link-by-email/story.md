---
linear: CAM-234
feature: authentication
epic: google-oauth-login (CAM-233)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-27
---
# AUTH-G1 — Google OAuth (JWT-only, link-by-email) (CAM-234)

## Why

เพิ่มทางเข้าระบบด้วย Google ลด friction (ไม่ต้องตั้ง/จำรหัสผ่าน). Approach A (JWT-only upsert) — ไม่ต้อง migration, ฟรี.

## Story

ในฐานะ **camper/host** ฉันต้องการ **เข้าสู่ระบบด้วยบัญชี Google** เพื่อ **เข้าใช้งานได้เร็วโดยไม่ต้องตั้งรหัสผ่าน**. ขอบเขต: Google provider + jwt upsert-by-email + ปุ่ม login (เก็บ Credentials เดิมไว้).

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | อยู่หน้าเข้าสู่ระบบ | กดปุ่มเข้าสู่ระบบด้วย Google | ไปหน้ายินยอมของ Google แล้วกลับมาเข้าระบบสำเร็จ | `signIn('google')`; session มี id + role |
| 2 | ผู้ใช้ใหม่ (ยังไม่มีบัญชี) | เข้าด้วย Google | เข้าระบบเป็นสมาชิกทันที | สร้าง User `role=CAMPER`, `password=null` |
| 3 | ผู้ใช้เดิมที่สมัครด้วยอีเมล+รหัสผ่าน | เข้าด้วย Google อีเมลเดียวกัน | เข้าบัญชีเดิม เห็นข้อมูลเดิม | upsert by email ไม่สร้างซ้ำ |
| 4 | ผู้ใช้เดิม | เข้าด้วยอีเมล+รหัสผ่าน (เดิม) | เข้าได้เหมือนเดิม | Credentials ไม่กระทบ |
| 5 | กดยกเลิกที่หน้า Google | กลับมาที่แอป | กลับหน้าเข้าสู่ระบบ ไม่มี error ค้าง | — |

## Rules

* secret env-only `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` (ต่อ env, ไม่ใช่ NEXT_PUBLIC) · reuse open-redirect guard ใน actions.ts · session shape เดิม (role) · Google PII (email/name/avatar) → field เดิม ไม่ log · ปุ่ม token-only + copy ผ่าน i18n + lucide icon · ไม่แตะ `lib/auth.config.ts`/`middleware.ts`

## Data

ไม่มี migration · `User.password` nullable เดิม รองรับ Google user · ไม่เพิ่ม Account table

## Out of scope

* Prisma adapter (Approach B) · magic-link/OTP · เปิด prod (HELD) · privacy-policy copy (งานแยกก่อนเปิด prod)

## Self-verify

* local: ปุ่ม Google → เข้าได้ · Credentials เดิมยังเข้าได้ · jwt upsert (ใหม่→CAMPER / เดิม→link) มี test ≥80% บนของใหม่ · lint/typecheck/build/check:ds(blocking) เขียว · security review ผ่าน · **staging-verify รอ owner ใส่ secret**

## Links

* Epic [CAM-233](https://linear.app/campvibe/issue/CAM-233/google-oauth-login) · ADR-008 (จะสร้าง) · docs/design/google-oauth-login.html · lib/auth.ts
