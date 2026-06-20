# std/api.md — มาตรฐาน API/Backend (Backend)

อ้างอิงของจริงก่อนเขียน: `schema/api-schema.json` + `types/api.ts` + `lib/api-client.ts` + `lib/validations/*` (zod) · อ่าน `std/security.md` คู่กันเสมอ (authz/secret/injection)

## หลักการ
Server เป็นเจ้าของความจริง (server-authoritative): client validation มีไว้เพื่อ UX เท่านั้น ห้ามเชื่อข้อมูลจาก client. ทุก endpoint เป็น contract ที่ตรวจสอบได้ — input ผ่าน boundary มี shape แน่นอน, output ตรง `types/api.ts`, side-effect ทุกอย่างผูกกับ session ที่ยืนยันแล้ว. ข้อมูลเป็น atomic (query อิสระได้, เชื่อมด้วย ID) ไม่ยัดหลายข้อเท็จจริงลง string เดียว.

## มาตรฐาน/กฎ
- **Validate ที่ boundary ด้วย zod ทุก endpoint** — schema อยู่ใน `lib/validations/*`; parse input (body/query/params) ก่อนแตะ logic; parse ล้มเหลว → `400` + field error (ไม่เผย stack/internal)
- **Authz ทุก mutation** — ดึง user จาก session (NextAuth) ฝั่ง server; ห้ามรับ `userId`/`role` จาก client payload; **ownership check** ก่อน update/delete (ของผู้อื่นแก้ไม่ได้ → `403`/`404`); guard ที่ server เสมอ ไม่พึ่ง UI ซ่อนปุ่ม
- **DB ผ่าน Prisma เท่านั้น (parameterized)** — ห้าม raw string concat ใน query; ถ้าจำเป็นต้อง raw ใช้ `$queryRaw` แบบ tagged template (parameterized) เท่านั้น
- **Response shape ตาม `types/api.ts`** — atomic fields (`firstName`/`lastName`, `amount`+`currency`, `provinceId`) ไม่รวมเป็น string เดียว; success/error shape สม่ำเสมอทั้ง API
- **ไม่รั่ว secret/internal** — secret ไม่อยู่ใน response/log/fixture; error message ที่ส่งกลับ client เป็นภาษาคน ไม่เผย SQL/path/env/stack; log internal แยกจาก client error
- **Migration reversible** — ทุก migration มี up/down คู่กัน; **ทดสอบ migrate บน Staging DB ก่อน prod** เสมอ (รัน `prisma migrate deploy` ต่อ env, `DATABASE_URL` แยก staging/prod); ห้าม drop/rename ทำลายข้อมูลโดยไม่มี backfill
- **Idempotent & atomic write** — operation ที่ต้อง all-or-nothing ใช้ `prisma.$transaction`; กัน partial write
- **Audit event สำคัญ** — mutation ที่กระทบสิทธิ์/การเงิน/ข้อมูลผู้ใช้ บันทึก audit (ไม่รั่ว secret); event-code อยู่ใน spec `tech` ไม่อยู่ใน AC

## ต้องคำนึง / anti-patterns
- ❌ เชื่อ `role`/`userId` จาก request body → ✅ อ่านจาก session ฝั่ง server เท่านั้น
- ❌ trust client validation อย่างเดียว → ✅ zod parse ซ้ำที่ server boundary
- ❌ `update where:{id}` โดยไม่เช็คเจ้าของ → ✅ `where:{id, ownerId: session.user.id}`
- ❌ คืน Prisma error/stack ตรงๆ ให้ client → ✅ map เป็น error shape ที่ปลอดภัย
- ❌ migration ไม่มี down / ไม่ลอง rollback → ✅ ทดสอบ up→down→up บน Staging ก่อน
- ❌ ยัด `fullName: "นายสมชาย"`, `price: "฿1,250"` → ✅ atomic fields ตาม `types/api.ts`

## Checklist (DoD ของ Backend)
- [ ] zod validate ครบทุก input boundary + error shape ปลอดภัย
- [ ] authz + ownership check ทุก mutation (ผูก session)
- [ ] query ผ่าน Prisma parameterized ทั้งหมด (ไม่มี raw concat)
- [ ] response ตรง `types/api.ts` (atomic) + contract test ผ่าน
- [ ] **รัน endpoint จริง** ตรวจ happy + error path; ไม่มี secret รั่วใน response/log
- [ ] migration up/down ทดสอบบน Staging สำเร็จ (reversible)
- [ ] ผ่าน quality gate (lint/typecheck/test ≥80% โค้ดใหม่/build/`npm audit`) ก่อน PR เข้า `staging`