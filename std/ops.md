# std/ops.md — มาตรฐาน Ops/Release (DevOps)

## หลักการ
- **3-env lean** สำหรับ solo/Hobby: Local Dev → Staging → Production. ยุบ SIT+UAT เดิมเป็น **Staging เดียว** เพื่อ lean; per-PR ได้ Vercel Preview (ephemeral) ไว้ตรวจเร็วก่อน merge
- **prod ต้องผ่าน Staging เสมอ** — ไม่มี shortcut; ทุกการเปลี่ยนแปลงพิสูจน์บน env จริงก่อนขยับขึ้น
- **Done ≠ Released** — story Done ได้หลายตัวก่อนรวมปล่อยเป็นรอบ (release train) เพื่อคุมความเสี่ยง
- **deploy ปลอดภัย = reversible** — ทุก release ต้องถอยกลับได้ (rollback plan + reversible migration) ไม่งั้นห้ามขึ้น

## มาตรฐาน/กฎ

### Environments (3-env)
| Env | deploy เมื่อ | branch | อนุมัติ | DB | บทบาท |
|---|---|---|---|---|---|
| Local Dev | — | `feature/*` | — | local Postgres | พัฒนา + self-verify |
| Staging | auto เมื่อ merge เข้า `staging` + smoke | `staging` (integration) | G4 sign-off (ก่อน promote) | staging DB | งาน **"Done"** + acceptance/demo |
| Production | promote `staging`→`main` + tag | `main` (release) | G5 | prod DB | **"Released"** |

### Vercel mapping
`feature/*` → Preview (ephemeral) · `staging` → Staging env · `main` → Production · `DATABASE_URL` แยก staging/prod · รัน `prisma migrate deploy` ต่อ env

### Definition of Done vs Released
- **Done** (story → Linear state `Done`): merge เข้า `staging` + quality-gate เขียวครบ + migration บน staging สำเร็จ + **AC verify บน Staging URL จริง**
- **Released** (deployment → label `released` + git tag): promote `staging`→`main` + Production deploy + smoke เขียว + tag + changelog + rollback plan + G5
- `released` เป็น **label ไม่ใช่ state**; story หลายตัว Done ก่อนรวมปล่อยเป็นรอบได้
> รายละเอียดเต็ม: `ai-planning/SYNC-ARCHITECTURE.md` §Definition of Done

### Promotion rules (บังคับ)
- prod ต้องผ่าน Staging (Done + G4 sign-off) เสมอ ห้ามข้าม
- ทุก prod release มี **tag + changelog + rollback plan**
- migration **reversible + ทดสอบบน Staging ก่อน prod**
- fail ที่ env ใด → **หยุด promote + เปิด Linear ticket อัตโนมัติ** เข้า loop
- promote ข้าม env ผ่าน `/promote-release --to <staging|prod>` เท่านั้น (merge→staging = Done, staging→main = Released)

### Git/CI
- ใช้ `git`+`gh` CLI; branch `<type>/<kebab>` · Conventional Commits · `main`+`staging` protected
- CI (`.github/workflows/ci.yml`) รัน gate ฝั่ง server ทุก PR (base `staging`/`main`); ผ่าน CI ก่อน merge
- flow: feature → PR เข้า `staging` (=Done) → promote `staging`→`main` (=Released)

### หลัง deploy (observability)
- เฝ้า error (Sentry) N นาทีหลัง deploy → error spike = **auto-rollback + แจ้ง**; error จริง → เปิด bug ticket เข้า loop
- ticket ฝั่ง Linear ตรวจตรง STORY-TICKET template ด้วย `node scripts/linear-sync.mjs audit`

## ต้องคำนึง / anti-patterns
- ❌ promote prod ตรงจาก feature/Preview → ✅ ผ่าน Staging + G4 sign-off ก่อนเสมอ
- ❌ migration irreversible / ทดสอบครั้งแรกบน prod → ✅ reversible + ทดสอบบน Staging ก่อน
- ❌ release ไม่มี tag/changelog/rollback → ✅ ครบทั้ง 3 ทุก prod release
- ❌ fail แล้ว retry เงียบ → ✅ หยุด promote + เปิด Linear ticket อัตโนมัติ
- ❌ ปิดงานเป็น Done จากผล local/Preview → ✅ verify AC บน Staging URL จริง
- ❌ ใช้ `DATABASE_URL` เดียวข้าม env → ✅ แยก staging/prod เด็ดขาด

## Checklist (DoD ของ Ops)
- [ ] build + `prisma migrate deploy` สำเร็จบน env เป้าหมาย
- [ ] migration reversible + ทดสอบบน Staging ก่อน prod
- [ ] verify AC บน **URL จริง** (Staging→Done / Production→smoke เขียว)
- [ ] (prod) tag + changelog + rollback plan ครบ + G5 ผ่าน
- [ ] เฝ้า error หลัง deploy; spike → auto-rollback; error จริง → เปิด bug ticket
- [ ] สถานะ Linear sync (`linear-sync.mjs audit` ผ่าน) ก่อนปิดงาน
