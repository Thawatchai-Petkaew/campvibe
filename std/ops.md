# std/ops.md — มาตรฐาน Ops/Release (DevOps)

## Environments
| Env | deploy เมื่อ | อนุมัติ | DB |
|---|---|---|---|
| SIT | อัตโนมัติหลัง merge + smoke | — | SIT DB |
| UAT | promote จาก SIT เขียว | G4 | UAT DB |
| Production | promote จาก UAT | G5 | prod DB |

## Vercel mapping
branch `develop` → SIT · `release/*` → UAT · tag บน `main` → prod · DATABASE_URL แยกต่อ env · รัน `prisma migrate deploy` ต่อ env

## Promotion rules (บังคับ)
- prod ต้องผ่าน SIT+UAT เสมอ ห้ามข้าม
- ทุก prod release มี **tag + changelog + rollback plan**
- migration reversible + ทดสอบบน SIT/UAT ก่อน
- fail ที่ env ใด → หยุด promote + เปิด Linear ticket อัตโนมัติ

## หลัง deploy
เฝ้า error (Sentry) N นาที → error spike = auto-rollback + แจ้ง; error จริง → เปิด bug ticket เข้า loop

## Git/CI
ใช้ `git`+`gh` CLI; CI (`.github/workflows/ci.yml`) รัน gate ฝั่ง server ทุก PR

## Self-verify
build+migrate สำเร็จ + verify URL จริง + เฝ้า error ก่อนปิดงาน
