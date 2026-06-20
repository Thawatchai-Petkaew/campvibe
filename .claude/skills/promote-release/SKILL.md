---
name: promote-release
description: deploy/promote ข้าม env (SIT->UAT->prod) + migrate + smoke test + tag + changelog + rollback ตาม promotion rules
---
# promote-release
อ่าน std/ops.md  ใช้: promote-release --to <sit|uat|prod>
1. pre-condition: env ก่อนหน้าเขียว (prod ต้องผ่าน UAT sign-off G4)
2. build + prisma migrate deploy บน DB ของ env เป้าหมาย
3. deploy (Vercel) + smoke/health check
4. (prod) tag เวอร์ชัน + changelog
5. update STATUS/Linear; fail → rollback + เปิด ticket
6. (prod) เฝ้า Sentry N นาที → error spike = auto-rollback + แจ้ง
กฎ: prod ต้องผ่าน SIT+UAT เสมอ; ห้ามข้าม
