# std/security.md — มาตรฐาน Security (Security)

> อ่านก่อนทำงานทุกครั้ง: ไฟล์นี้ + diff ของ story · scope = security gate ต่อ **ทุก atomic story** ก่อน G3 (merge→staging) และ re-check ก่อน G5 (release→prod)

## หลักการ
- **Assume breach + least privilege** — ทุก request อาจปลอม; ให้สิทธิ์น้อยสุดที่ทำงานได้ ตรวจที่ server เสมอ ไม่เชื่อ client
- **Defense ที่ boundary** — authz/validation อยู่ที่ API route + Prisma layer ไม่ใช่แค่ UI; client validation = UX เท่านั้น
- **Shift-left** — scan ที่ตัว story (เร็ว ถูก) ไม่รอ release; gap 🔴 ด้านความปลอดภัย = หยุด ยกเป็นคำถาม ห้ามเดาเงียบ

## มาตรฐาน/กฎ (OWASP — บังคับต่อทุก story)
1. **Access control** — ตรวจสิทธิ์ทุก action ฝั่ง server; ดึง `userId`/`role` จาก NextAuth session เท่านั้น ห้ามรับจาก body/query/header; ownership check ทุก mutation (`where: { id, ownerId: session.user.id }`); default-deny
2. **Injection** — DB ผ่าน Prisma parameterized เท่านั้น ห้าม `$queryRawUnsafe`/string-concat SQL; input ทุกตัวผ่าน zod ที่ boundary (อ้าง `std/api.md`)
3. **Secrets** — อยู่ใน env เท่านั้น (Vercel env แยก staging/prod); ห้ามใน client bundle (`NEXT_PUBLIC_*` = public เท่านั้น) / log / fixture / commit; rotate เมื่อรั่ว
4. **Insecure design** — threat-model abuse case ไม่ใช่แค่ happy path (replay, IDOR, mass-assignment, rate abuse); whitelist field ที่เขียนได้ ห้าม spread req body ลง Prisma ตรง
5. **Misconfig** — prod ไม่มี debug/verbose error/stack trace ส่งถึง client; CORS/headers แน่น; cookie `httpOnly`+`secure`+`sameSite`
6. **Vulnerable deps** — `npm audit --omit=dev` = 0 high/critical ก่อน merge; ไม่เพิ่ม dep โดยไม่ justify (อ้าง playbook §10)
7. **Auth failures** — auth ผ่าน NextAuth เท่านั้น ห้าม session/token เอง; ตรวจ session ทุก protected route + server action
8. **Logging/audit** — log event security-relevant (login fail, authz deny, mutation สำคัญ) ตาม audit req; ห้ามรั่ว secret/PII/token ลง log
9. **SSRF** — ไม่ fetch URL จาก client โดยไม่ allow-list domain; เรียก external ผ่าน proxy/facade ฝั่ง server

## ต้องคำนึง / anti-patterns
- ❌ `where: { id }` ใน mutation (IDOR) → ✅ `where: { id, ownerId: session.user.id }`
- ❌ `prisma.x.update({ data: req.body })` (mass-assignment) → ✅ pick เฉพาะ field ที่อนุญาตหลัง zod parse
- ❌ เชื่อ `role` จาก client/JWT ที่ตั้งเอง → ✅ อ่าน role จาก DB/session ฝั่ง server
- ❌ route `app/api/seed`, `bulk-seed`, `scrape-seed` เปิดใน prod → ✅ guard ด้วย env (`NODE_ENV !== 'production'` หรือ secret token) — **ตรวจทุก release ก่อน G5**
- ❌ ส่ง error ดิบ/stack ให้ client → ✅ ข้อความ generic + log ฝั่ง server (และ copy ไทยตาม `playbook §6.6` ไม่มีศัพท์เทคนิค)

## Checklist (DoD ของ domain — ก่อน handoff/G3)
- [ ] scan diff: authz check + ownership ครบทุก mutation ใหม่
- [ ] zod validate ทุก input boundary; ไม่มี raw SQL/mass-assignment
- [ ] ไม่มี secret ใน diff/log/client bundle
- [ ] `npm audit --omit=dev` = 0 high/critical (รันจริง)
- [ ] seed/scrape routes guard แล้ว (ยืนยันก่อน release→prod)
- [ ] event security-relevant ถูก log (ไม่รั่ว secret/PII)
