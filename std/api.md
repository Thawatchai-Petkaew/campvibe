# std/api.md — มาตรฐาน API/Backend (Backend)

อ้างอิงของจริง: `schema/api-schema.json` + `types/api.ts` + `lib/api-client.ts` + `lib/validations/*` (zod)

## กฎ
- ทุก endpoint **validate ด้วย zod ที่ boundary** (server-authoritative; client validation = UX เท่านั้น)
- **Authz ทุก mutation** — ผูกกับ session user; ห้ามเชื่อ id/role จาก client; กันแก้ของผู้อื่น (ownership check)
- query ผ่าน Prisma เท่านั้น (parameterized) — ห้าม raw string concat
- ไม่รั่ว secret ใน response/log; error message ไม่เผยภายใน
- migration **reversible** + ทดสอบบน SIT/UAT ก่อน prod
- response shape ตาม `types/api.ts` (atomic fields)

## Self-verify
contract test ผ่าน + รัน endpoint จริง + ตรวจ migration up/down ก่อน handoff
