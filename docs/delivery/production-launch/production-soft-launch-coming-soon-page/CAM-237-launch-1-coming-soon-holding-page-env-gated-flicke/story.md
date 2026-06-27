---
linear: CAM-237
feature: production-launch
epic: production-soft-launch-coming-soon-page (CAM-236)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-27
---
# LAUNCH-1 — Coming Soon holding page (env-gated) + flicker art (CAM-237)

## Why

ขึ้น prod ครั้งแรกแบบปลอดภัย+ฟรี: โชว์แค่หน้า Coming Soon น่ารักๆ (มาสคอต + "กำลังดำเนินการ") ผ่าน env flag `COMING_SOON`. ลดความเสี่ยง prod เกือบเป็นศูนย์ + ค่า image $0.

## Story

ในฐานะ **ผู้เข้าชมเว็บ** ฉันเห็น **หน้า "กำลังดำเนินการ" ที่มีตัวการ์ตูนน่ารักขยับได้** เพื่อ **รู้ว่าเว็บกำลังจะเปิด** โดยที่หลังบ้านยังไม่เปิดให้เข้า. ขอบเขต: หน้า static 1 หน้า + gate ปิดทุกเส้นทางอื่นบน prod.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | prod เปิดโหมด coming-soon | เปิดเว็บหน้าแรก | เห็นตัวการ์ตูนมาสคอตขยับ (เดิน/ขยับเฟรม) + ข้อความ `เรากำลังดำเนินการ` และ `เว็บไซต์จะเปิดให้บริการเร็วๆ นี้` | render หน้า static, ไม่เรียกฐานข้อมูล |
| 2 | prod โหมด coming-soon | เปิด path ใดก็ได้ เช่น หน้าเข้าสู่ระบบ/รายการแคมป์ | เด้งมาเห็นหน้า "กำลังดำเนินการ" หน้าเดิม | rewrite ทุก route → หน้า coming-soon |
| 3 | prod โหมด coming-soon | เรียก API ตรงๆ | เข้าไม่ได้ (ไม่พบ) | `/api/*` ตอบ 404 |
| 4 | สลับภาษา (อังกฤษ) | ดูหน้า coming-soon | ข้อความเป็นภาษาอังกฤษ `We're working on it` / `Coming soon` | คัดลอกจาก locales (en) |
| 5 | ปิดโหมด coming-soon (flag off) | ใช้งานเว็บ | แอปเต็มทำงานครบเหมือนเดิม (เข้าสู่ระบบ/ดูแคมป์/จอง) | ไม่มี side-effect ใดๆ จาก flag |

## Rules

* gate ที่ `proxy.ts` อ่าน `process.env.COMING_SOON === '1'`; allowlist = `/coming-soon` + `/_next/static` + `/status-map/sprites` + `/mascot` + favicon; นอกนั้น rewrite; `/api/*` → 404 (ขยาย matcher ให้คลุม)
* flag **unset = พฤติกรรมเดิมเป๊ะ** (regression guard สำคัญสุด)
* หน้า coming-soon **ไม่เรียก** `auth()`**/Prisma** · ไม่มี input/form (ลดความเสี่ยง)
* art = static `/public` asset (.webp/.png) immutable cache → ไม่ผ่าน Vercel Image Optimizer ($0); ไม่ใช้ `next/image` optimizer
* token-only (DESIGN.md) · lucide เท่านั้น · check:ds (blocking) เขียว
* ข้อความไทย/อังกฤษ verbatim สรุปที่ design gate (G2)

## Data

* ไม่มี migration · ไม่มี field ใหม่ · env var เดียว `COMING_SOON` (ตั้งเฉพาะ Vercel Production)

## Out of scope

* เปิดแอปเต็มบน prod (พลิก flag off) + เช็กลิสต์ก่อน full launch (Sentry/rollback/PDPA/low-gap/prod-DB) — ทำทีหลัง ไม่อยู่ใน story นี้
* email capture / notify-me form (= API = เพิ่มความเสี่ยง → ไม่ทำ)

## Self-verify

* staging flag on: หน้า render art+copy, ทุก route + /api เด้ง/404 · flag off: แอปเต็มไม่ regress · lint/typecheck/test/build/check:ds เขียว · ไม่มี secret leak · prod smoke: เห็นหน้า coming-soon, /api=404, ไม่มี /_next/image

## Links

* Epic [CAM-236](https://linear.app/campvibe/issue/CAM-236/production-soft-launch-coming-soon-page) · proxy.ts:120 (matcher) · campsite-engine.ts:109 (WALK_SPRITES) · next.config.ts:80 (immutable) · locales/translations.ts
