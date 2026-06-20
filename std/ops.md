# std/ops.md — มาตรฐาน Ops/Release (DevOps)

## Environments (3-env — lean สำหรับ solo/Hobby)
| Env | deploy เมื่อ | branch | อนุมัติ | DB | บทบาท |
|---|---|---|---|---|---|
| Local Dev | - | `feature/*` | — | local Postgres | พัฒนา + self-verify |
| Staging | auto เมื่อ merge เข้า `staging` + smoke | `staging` (integration) | G4 sign-off (ก่อน promote) | staging DB | งาน **"Done"** + acceptance/demo |
| Production | promote `staging`→`main` + tag | `main` (release) | G5 | prod DB | **"Released"** |

> ยุบ SIT+UAT เดิมเป็น **Staging เดียว** (lean) · per-PR ได้ Vercel Preview (ephemeral) ไว้ตรวจเร็วก่อน merge

## Vercel mapping
`feature/*` → Preview (ephemeral) · `staging` → Staging env · `main` → Production · `DATABASE_URL` แยก staging/prod · รัน `prisma migrate deploy` ต่อ env

## Definition of Done vs Released
- **Done** (story → Linear state `Done`): merge เข้า `staging` + quality-gate เขียวครบ + migration บน staging สำเร็จ + **AC verify บน Staging URL จริง**
- **Released** (deployment → label `released` + git tag): promote `staging`→`main` + Production deploy + smoke เขียว + tag + changelog + rollback plan + G5
> รายละเอียดเต็ม: `ai-planning/SYNC-ARCHITECTURE.md` §Definition of Done

## Promotion rules (บังคับ)
- prod ต้องผ่าน Staging (Done + G4 sign-off) เสมอ ห้ามข้าม
- ทุก prod release มี **tag + changelog + rollback plan**
- migration reversible + ทดสอบบน Staging ก่อน prod
- fail ที่ env ใด → หยุด promote + เปิด Linear ticket อัตโนมัติ

## หลัง deploy
เฝ้า error (Sentry) N นาที → error spike = auto-rollback + แจ้ง; error จริง → เปิด bug ticket เข้า loop

## Git/CI
ใช้ `git`+`gh` CLI; CI (`.github/workflows/ci.yml`) รัน gate ฝั่ง server ทุก PR (base `staging`/`main`) · feature → PR เข้า `staging` · promote `staging`→`main` = release

## Self-verify
build+migrate สำเร็จ + verify URL จริง + เฝ้า error ก่อนปิดงาน
