# EPIC-002 — P0 Hardening (Security + Migration)

> Scope ที่มนุษย์อนุมัติ (G1 scope) 2026-06-20: "P0 security + migration ก่อน"
> Why: เคลียร์ deploy blocker + ช่องโหว่ที่ทำให้ขึ้น production ไม่ได้ ก่อนเริ่มฟีเจอร์ใหม่ (อ้างอิง [PRODUCT-PLAN.md](../../PRODUCT-PLAN.md) §F-4)
> กฎ: ทำ **ทีละ 1 atomic story** จบจริง (code+states+validation+self-test) → qa → security → /quality-gate → G3 merge · ทุก transition /update-status

## Atomic stories (เรียงตามลำดับทำ)

### TICKET-0002 — Fix Prisma migration drift 🔴 deploy blocker
**Story:** ในฐานะ DevOps ฉันต้องการให้ `prisma migrate deploy` สร้าง schema ตรงกับ `schema.prisma` เพื่อให้ deploy ขึ้น SIT/UAT/prod + seed ได้โดยไม่พัง
**ปัญหา:** `ThailandLocation` ไม่ถูกสร้างใน migration ใด ๆ และ `MasterData` ถูกอ้างถึง (junction rename) แต่ไม่ถูก CREATE — `migrate status` กลับบอก "up to date" → drift
**AC:**
- [ ] มี migration ใหม่ที่ทำให้ DB ว่าง → `migrate deploy` แล้วได้ทุกตารางตรง schema (รวม ThailandLocation, MasterData, junction `_CampSiteToMasterData`)
- [ ] `npx prisma migrate diff --from-migrations --to-schema-datamodel` = empty (ไม่มี drift)
- [ ] `npx prisma db seed` ผ่านบน DB ที่ migrate ด้วย migrations อย่างเดียว (ไม่ใช้ db push)
- [ ] รวม seed patch (`contacts`) ที่ค้างใน working tree (เดิม TICKET-0006)
- [ ] migration_lock = postgresql คงเดิม
**Decision ที่รอ G1:** กลยุทธ์ migration (corrective forward vs reset/baseline) — ขึ้นกับว่ามี DB ที่ deploy แล้ว (Vercel/Neon demo) ที่ห้ามพังหรือไม่

### TICKET-0003 — Secure seed/scrape endpoints 🔴
**Story:** ปิดไม่ให้คนนอกเรียก data-mutating endpoints
**ปัญหา:** `/api/seed`, `/api/bulk-seed`, `/api/scrape-seed` ไม่มี auth — รีเซ็ต/แก้ DB ได้ผ่าน HTTP
**AC:**
- [ ] ทั้ง 3 endpoint คืน 401/403 เมื่อไม่ใช่ platform-admin
- [ ] ถูกปิดในโหมด production (env guard) เว้นมี flag เปิดชัดเจน
- [ ] มี test ครอบ unauthorized = blocked
**Default (ไม่ต้องถาม):** gate ด้วย `role==='ADMIN'` **และ** block เมื่อ `NODE_ENV==='production'` เว้น `ALLOW_DANGEROUS_SEED=1`

### TICKET-0004 — Reviews authz + verified-stay 🔴
**Story:** กันรีวิวปลอม/รีวิวสวมรอย
**ปัญหา:** `POST /api/reviews` ไม่เช็ค session และรับ `authorId` จาก body → ใครก็โพสต์เป็นใครก็ได้
**AC:**
- [ ] POST ต้องมี session (401 ถ้าไม่มี)
- [ ] `authorId` มาจาก session เท่านั้น (ไม่อ่านจาก body)
- [ ] zod validate input
- [ ] (ขึ้นกับ decision) ต้องมี Booking CONFIRMED/COMPLETED ของ user+campsite ถึงรีวิวได้
- [ ] test ครอบ: ไม่ login → 401, spoof authorId → ใช้ session, ไม่มี booking → block/flag
**Decision ที่รอ G1:** verified-stay = บังคับ (ต้องมี booking) หรือ อนุญาตแต่ติดป้าย verified/unverified

### TICKET-0005 — Propagate role to session + guard isVerified
**Story:** ให้สิทธิ์ platform-admin ใช้งานได้จริง + ป้องกัน verify ลานโดยไม่ใช่ admin
**ปัญหา:** `role` ไม่ถูกใส่ใน NextAuth JWT → `isPlatformAdmin` ใช้ไม่ได้; `isVerified` เขียนได้โดย MANAGER
**AC:**
- [ ] `role` อยู่ใน JWT + session callback (`lib/auth.ts`)
- [ ] เขียน `isVerified`/`verifiedDate` ได้เฉพาะ `role==='ADMIN'`
- [ ] test: non-admin set isVerified → ถูกปฏิเสธ/ละเว้น field
- [ ] ไม่กระทบ RBAC ทีมเดิม

## Out of scope (รอบนี้)
RBAC enforcement ครบทุก endpoint (F-4.7), rate limiting (A-9.2), test coverage backfill ทั้งระบบ (F-4.8) — เป็น P1
