# std/ux.md — มาตรฐาน UX Validation + PDPA Masking (Designer + Frontend + Backend)

> อ่านก่อนทำงาน: ไฟล์นี้ + `DESIGN.md` (states/a11y/i18n/form-error pattern/test-id/no-em-dash/no-tech-jargon) + `std/api.md` (server enforce validation) + `std/qa.md` (test ครอบ validation) + `std/security.md` (audit logging)
> ขอบเขตไฟล์นี้: **catalog กลาง** ของ field validation + PDPA masking เท่านั้น สิ่งที่ `DESIGN.md` เป็นเจ้าของอยู่แล้ว (interaction states, a11y, i18n, em-dash, ศัพท์เทคนิค, test-id, form/error pattern) **ไม่ทำซ้ำ** ให้อ้างถึงแทน

## หลักการ
- **Schema เดียว แชร์ client+server** — validation ทุก field นิยามด้วย `zod` ครั้งเดียว, type = `z.infer<typeof schema>`; ฟอร์มใช้ shadcn form + `<form noValidate>` (custom validation ตาม `DESIGN.md`), server enforce ด้วย schema ตัวเดียวกันนี้ (ดู `std/api.md`) ห้ามมี logic validate ซ้อนต่างกันสองที่
- **Catalog เดียว** — ทุก field ที่ validate ต้องดึง rule + error copy จากตารางนี้ ห้าม inline regex/ข้อความเองในแต่ละฟอร์ม ฟิลด์ใหม่ → เพิ่มในตารางนี้ก่อน แล้วค่อยอ้าง
- **Error copy = UI จริง** — ข้อความไทยในตารางคือ copy ที่ผู้ใช้เห็นจริง (verbatim) เก็บใน `locales/` เป็น source-of-truth (TH/EN) ห้าม hardcode; QA assert ตรงตัวอักษร
- **Masked-by-default** — PII อ่อนไหวแสดง mask โดย default, เผยเฉพาะเมื่อผู้ใช้กดเอง (PDPA: การ "แสดง" = การใช้ข้อมูลที่ผู้ใช้ควบคุม)

## Validation catalog
trigger/timing ตาม form pattern ใน `DESIGN.md`; ข้อความ = verbatim
| Field | rule / regex | error copy (ไทย verbatim) |
|---|---|---|
| เบอร์มือถือ `phone` | `^0[689]\d{8}$` (10 หลัก, ตัวเลขล้วน strip non-digit) | "กรุณากรอกเบอร์มือถือที่ถูกต้อง" |
| อีเมล `email` | max 100, ไม่มีอักขระไทย `[฀-๿]`, รูปแบบ `^[^\s@]+@[^\s@]+\.[^\s@]+$` | "รูปแบบอีเมลไม่ถูกต้อง" |
| ชื่อ-สกุล (ไทย) `firstName`/`lastName` | `^[ก-๙\s]+$` max 50 | "กรุณากรอกเฉพาะภาษาไทย" |
| รหัสผ่าน `password` | ≥8 ตัว, มีตัวอักษร+ตัวเลข, แสดง strength meter | "รหัสผ่านต้องมีอย่างน้อย 8 ตัว ผสมตัวอักษรและตัวเลข" |
| OTP `otp` | 6 หลักตัวเลข, ≤5 ครั้ง/session, บล็อก 300 วินาที | "รหัส OTP ไม่ถูกต้อง" |
| ชื่อแคมป์ `campName` | `^[a-zA-Z0-9ก-๙\s]+$` max 100 (ไม่มีอักขระพิเศษ) | "ชื่อแคมป์ไม่รองรับอักขระพิเศษ" |
| ราคา/คืน `pricePerNight` | จำนวนเต็มบวก 0–100,000 บาท | "ราคาต้องอยู่ระหว่าง 0–100,000 บาท" |
| จำนวนผู้เข้าพัก/ความจุ `capacity` | จำนวนเต็ม ≥1 | "จำนวนผู้เข้าพักต้องมากกว่า 0" |
| ช่วงวันที่จอง `checkIn`/`checkOut` | check-out > check-in, ห้ามย้อนหลัง (≥ วันนี้) | "วันเช็คเอาท์ต้องหลังวันเช็คอิน" |
| จังหวัด `provinceId` | เลือกจาก master list (required) | "กรุณาเลือกจังหวัด" |
| พิกัดแคมป์ `lat`/`lng` | lat -90…90, lng -180…180 (จุดทศนิยม) | "พิกัดไม่ถูกต้อง" |

## PDPA masking defaults
mask glyph = `•` (U+2022) เท่านั้น · เผยผ่าน eye-toggle component, auto-revert 30 วินาที · ทุกครั้งที่เผย → backend emit audit event `pdpa.sensitive_field_revealed` `{userId, field, ts, ip}` (นิยาม/เก็บ log ตาม `std/security.md` ไม่ redefine ที่นี่)
| Field | mask อย่างไร (glyph `•`) | เผยอย่างไร |
|---|---|---|
| เลขบัตรประชาชน `nationalId` | เก็บตัวแรก 1 + ท้าย 1 → `1-••••-••••XXX-Y` | eye-toggle 30s + audit |
| เบอร์มือถือ `phone` | เก็บตัวแรก 3 + ท้าย 2 → `081-•••-••XX` | eye-toggle 30s + audit |
| ชื่อ-สกุล (ไทย+อังกฤษ) `fullName` | ตัวแรกของแต่ละคำ → `เ•••••์ พ•••••••` | eye-toggle 30s + audit |
| วันเกิด `birthDate` | mask เต็ม → `••/••/••••` | eye-toggle 30s + audit |
| เลขบัญชี/พร้อมเพย์ (payout เจ้าของแคมป์) `payoutAccount` | เก็บตัวแรก 3 + ท้าย 1 → `XXX-•-•••••XX-X` | eye-toggle 30s + audit |
| **ไม่ mask:** อีเมล (ต้องแก้ไขเองได้) · ที่ตั้ง/ที่อยู่จัดส่งแคมป์ (จำเป็นต่อ flow จอง/เดินทาง) · จังหวัด | แสดงเต็ม | — |

**Rule of thumb:** mask ถ้า field ใช้ (เดี่ยวหรือรวมกัน) เพื่อ (ก) สวมรอยผู้ใช้ (ข) ทำธุรกรรมการเงิน (ค) link ข้ามแอป — ไม่ mask ข้อมูล demographic/categorical/ที่ผู้ใช้ต้องแก้เอง

## ต้องคำนึง / anti-patterns
- ❌ mask ด้วย `X` / `*` / `_` → ✅ `•` เท่านั้น (รวมกับ `-` `/` `()` เพื่อคงรูปแบบได้)
- ❌ validation ต่างกันระหว่าง client/server → ✅ zod schema เดียว แชร์สองฝั่ง (server = authoritative, ดู `std/api.md`)
- ❌ error เป็นศัพท์เทคนิค (`regex invalid`, `400`) → ✅ copy ไทยตามตาราง (โยง `DESIGN.md` no-tech-jargon)
- ❌ เผย PII แล้วไม่ log → ✅ emit audit event ต่อการเผยทุกครั้ง (`std/security.md`)
- ❌ เขียน validation rule / error string ซ้ำในหลายฟอร์ม → ✅ catalog เดียว ดึงไปใช้ร่วม

## Checklist (DoD ของ domain)
- [ ] ทุก field ที่ validate ใช้ rule + copy จาก catalog (ไม่ inline เอง)
- [ ] zod schema ตัวเดียวแชร์ client + server (`z.infer` เป็น type)
- [ ] PII ทุกตัวตาม masking table: glyph `•` + reveal 30s + audit event
- [ ] error copy ไทย verbatim ตรง catalog + อยู่ใน `locales/` (TH/EN)
- [ ] มี test ครอบ validation (happy + boundary + error) ฝั่ง server ด้วย ตาม `std/qa.md` (coverage ≥80% โค้ดใหม่)
