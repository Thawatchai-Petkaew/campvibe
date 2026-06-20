# std/security.md — มาตรฐาน Security (Security)

## OWASP (บังคับต่อทุก story)
1. **Access control** — ตรวจสิทธิ์ทุก action; ownership ผูก session; ไม่เชื่อ id/role จาก client
2. **Injection** — parameterized ผ่าน Prisma เท่านั้น
3. **Secrets** — ห้ามอยู่ใน client/log/fixture; ใช้ env/secret handling
4. **Insecure design** — threat-model abuse case ไม่ใช่แค่ happy path
5. **Misconfig** — ไม่มี debug/verbose error ใน prod
6. **Vulnerable deps** — `npm audit --omit=dev` 0 high/critical; ไม่เพิ่ม dep โดยไม่ justify
7. **Auth failures** — ผ่าน NextAuth เท่านั้น
8. **Logging** — log event security-relevant (ไม่รั่ว secret) ตาม audit req
9. **SSRF** — ไม่ fetch URL จาก client โดยไม่ allow-list

## จุดเสี่ยงเฉพาะ CampVibe
- route `app/api/seed`, `bulk-seed`, `scrape-seed` ต้องปิด/ป้องกันใน production (ตรวจทุก release)

## Self-verify
scan diff + `npm audit` จริง → 0 critical ก่อนสรุป
