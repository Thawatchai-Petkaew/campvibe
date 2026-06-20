---
name: promote-release
description: deploy/promote ข้าม env (staging->prod) + migrate + smoke test + tag + changelog + rollback ตาม promotion rules — ใช้เมื่อต้อง promote โค้ดข้าม env (merge→staging = Done, staging→main = Released). อย่าใช้สำหรับเปิด PR (ใช้ open-pr) หรือรัน quality gate (ใช้ quality-gate)
---
# promote-release — deploy/promote โค้ดข้าม env (staging→prod) พร้อม migrate, smoke, tag, changelog, rollback
อ่านก่อน: `std/ops.md` · `ai-planning/SYNC-ARCHITECTURE.md` (Done vs Released, Linear sync) · 3-env: Local→Staging→Prod

## Input / preconditions
- `promote-release --to <staging|prod>` · ระบุ CAM-id ของ story ที่อยู่ในรอบ promote
- `--to staging`: merge เข้า `staging` แล้ว · quality-gate เขียวครบ
- `--to prod`: Staging เขียว + **G4 sign-off แล้ว** (ห้ามข้าม) · มี rollback plan
- env vars: `DATABASE_URL` แยก staging/prod · `LINEAR_API_KEY` (ให้ `linear-sync.mjs` ทำงาน)

## วิธีทำ — `--to staging` (auto หลัง merge เข้า `staging`)
1. `prisma migrate deploy` บน **staging DB** + `npm run build`
2. Vercel deploy Staging env (branch `staging`) + smoke/health check
3. **verify AC บน Staging URL จริง** → `node scripts/linear-sync.mjs set <CAM-id> --state "Done"` (state เปลี่ยนตาม git event, ไม่ผูก env)
4. fail ที่ขั้นใด → หยุด promote + rollback + เปิด Linear bug ticket อัตโนมัติ

## วิธีทำ — `--to prod` (promote `staging`→`main`, ต้องผ่าน G5)
1. **pre-condition:** Staging เขียว + G4 sign-off (ตรวจ `npm run status:gates`; ห้ามข้าม)
2. เปิด/merge PR `staging`→`main` → Vercel Production deploy + `prisma migrate deploy` บน **prod DB**
3. smoke/health check + `git tag vX.Y.Z` + changelog + rollback plan
4. `node scripts/linear-sync.mjs release <CAM-id>` ต่อ story ที่ปล่อย → ติด label `released` (state ยังคง `Done`, ไม่ใช่ state ใหม่)
5. เฝ้า Sentry N นาที → error spike = auto-rollback + แจ้ง; fail = rollback + เปิด ticket

## ต้องคำนึง
- **Done ≠ Released:** Done = staging state `Done` · Released = label `released` + git tag บน prod เท่านั้น
- prod ต้องผ่าน Staging (Done + G4) เสมอ — ห้าม promote `feature/*`→`main` ตรง
- migration reversible + ทดสอบบน Staging ก่อน prod (อย่ารัน migrate prod ที่ยังไม่ผ่าน staging)
- หลาย story `Done` รวมปล่อยเป็นรอบเดียว (release train) ได้ — `release <CAM-id>` ทีละตัวที่อยู่ในรอบ
- ห้ามแก้ `STATUS.json`/`linear-snapshot.json` มือ (generate จาก Linear ผ่าน `npm run status:pull`)

## Output / postconditions
- `--to staging`: Staging deploy เขียว + migration staging สำเร็จ + AC verify → story Linear state `Done`
- `--to prod`: Production deploy เขียว + tag `vX.Y.Z` + changelog + rollback plan → story label `released`
- fail ทุกกรณี: rollback แล้ว + Linear bug ticket เปิดเข้า loop

## Verify
- build + `prisma migrate deploy` สำเร็จต่อ env ที่ promote
- smoke/health check ผ่านบน URL จริง (staging หรือ prod)
- Linear state/label ถูกต้อง (`Done` หรือ `released`) — เช็คด้วย `npm run status:linear`
- prod: tag + changelog ครบ + เฝ้า Sentry ไม่มี error spike ก่อนปิดงาน
