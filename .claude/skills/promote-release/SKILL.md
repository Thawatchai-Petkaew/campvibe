---
name: promote-release
description: deploy/promote ข้าม env (staging->prod) + migrate + smoke test + tag + changelog + rollback ตาม promotion rules
---
# promote-release
อ่าน `std/ops.md` ก่อน · 3-env (Local→Staging→Prod) · ใช้: `promote-release --to <staging|prod>`

## `--to staging`  (auto หลัง merge เข้า `staging`)
1. `prisma migrate deploy` บน **staging DB** + build
2. Vercel deploy Staging + smoke/health check
3. update Linear: story ในรอบนี้ → state `Done` (หลัง **verify AC บน Staging URL จริง**)
4. fail → rollback + เปิด ticket

## `--to prod`  (promote `staging`→`main`, ต้องผ่าน G5)
1. **pre-condition:** Staging เขียว + G4 sign-off แล้ว (ห้ามข้าม)
2. เปิด/merge PR `staging`→`main` → Vercel Production deploy + `prisma migrate deploy` บน **prod DB**
3. smoke/health check + `git tag vX.Y.Z` + changelog + rollback plan
4. `node scripts/linear-sync.mjs release <CAM-id>` (state Done + label `released`) ต่อ story ที่ปล่อย
5. เฝ้า Sentry N นาที → error spike = auto-rollback + แจ้ง; fail → rollback + เปิด ticket

กฎ: prod ต้องผ่าน Staging (Done + G4) เสมอ; ห้ามข้าม · "Done" (staging) แยกจาก "Released" (prod) ดู `ai-planning/SYNC-ARCHITECTURE.md`
