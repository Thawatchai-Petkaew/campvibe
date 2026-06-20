# SETUP-ENVS — Runbook ตั้ง 3-env (Local → Staging → Production)

> คู่กับ `std/ops.md` (Environments + Promotion) · เป้าหมาย: ทำให้แต่ละ env "กดเล่นได้" และ **ข้อมูลไม่ปนกัน**

## 1. มี env อยู่ 3 ที่ — ต้อง align เป็น "รางเดียว"
| ที่ | คุมอะไร |
|---|---|
| **Git (GitHub)** | โค้ดอยู่ branch ไหน + Actions secrets/variables (CI, webhook, smoke) |
| **Vercel** | environment + env vars ต่อ env = **runtime ใช้ค่าชุดไหน → ชี้ DB ไหน** |
| **Prisma/Postgres** | database = **ข้อมูลจริง** |

**กฎ:** push `staging` → Vercel build env "Staging" → อ่าน `DATABASE_URL` ของ Staging → ชี้ **staging DB**
ถ้าไม่ align (staging ใช้ `DATABASE_URL` ของ prod) = เขียนทับข้อมูล prod ⚠️ — จึงต้องแยก DB ต่อ env

## 2. รางต่อ env
| Layer | Local | Staging | Production |
|---|---|---|---|
| Git branch | `feature/*` | `staging` | `main` |
| Vercel env | (local dev) | **Staging** | Production |
| Prisma DB | local Postgres | **`campvibe-staging`** | prod DB (Prisma Postgres) |
| URL | `localhost:3000` | `campvibe-git-staging-*.vercel.app` | `campvibe.vercel.app` |

## 3. env var matrix (ต้องตรงกันไหม)
| Var | Local | Staging | Prod | กลุ่ม |
|---|---|---|---|---|
| `DATABASE_URL` | local PG | staging DB | prod DB | 🔴 **ต่างทุก env** (สำคัญสุด) |
| `AUTH_SECRET` | set | set | set | ต้อง set ทุก env (`openssl rand -base64 32`; แยกค่าดีกว่า) |
| `NEXTAUTH_URL` | `localhost:3000` | — | — | local เท่านั้น (Vercel/NextAuth v5 infer host เอง) |
| `LINEAR_API_KEY` · `LINEAR_TEAM_KEY=CAM` · `STATUS_TOKEN` · `BLOB_READ_WRITE_TOKEN` | ใช้ร่วม | ใช้ร่วม | ใช้ร่วม | 🟢 shared ได้ (Linear = global) |
| `LINEAR_WEBHOOK_SECRET` · `GH_DISPATCH_TOKEN` · `GITHUB_REPO` | — | — | set | 🟡 **prod เท่านั้น** (webhook continuation) |
| `ALLOW_DANGEROUS_SEED` | `=1` ถ้าจะ seed | **ไม่ตั้ง** | **ไม่ตั้ง** | ⚫ local only (กัน seed หลุด prod) |
| `NODE_ENV` | auto | auto | auto | platform ตั้งให้ (ห้ามตั้งมือ) |

> สรุป: `DATABASE_URL` แยก 3 ตัว · `AUTH_SECRET` set ทุก env · ที่เหลือ shared ได้ · webhook เฉพาะ prod

## 4. Setup ต่อ env

### Local ✅ (มีแล้ว)
`.env`: `DATABASE_URL`(local) + `AUTH_SECRET` + `NEXTAUTH_URL=http://localhost:3000` (+ `LINEAR_API_KEY`/`STATUS_TOKEN` ถ้าจะดู /status)

### Staging (ส่วนที่ขาด — 4 ขั้น)
1. **Prisma** → สร้าง database `campvibe-staging` → คัด connection string
2. **Vercel** → Settings → Environments → **Create Environment "Staging"** → ผูก Git branch `staging` → ใส่ env (scope = Staging):
   - `DATABASE_URL` = staging string
   - `AUTH_SECRET` = ตัวใหม่
   - `LINEAR_API_KEY` · `LINEAR_TEAM_KEY=CAM` · `STATUS_TOKEN` (ถ้าอยากให้ /status ทำงานบน staging)
   - `BLOB_READ_WRITE_TOKEN` (ถ้าใช้อัปโหลดรูป)
   - ❌ ไม่ตั้ง: webhook vars, `ALLOW_DANGEROUS_SEED`
3. **Migrate + seed** staging DB (ให้มีข้อมูลกดเล่น):
   ```bash
   DATABASE_URL="<staging-connection-string>" npx prisma migrate deploy
   DATABASE_URL="<staging-connection-string>" npx prisma db seed
   ```
4. **push `staging`** → Vercel auto-deploy → เปิด staging URL กดเล่น

### Production ✅ (มีแล้ว — อ้างอิงสิ่งที่ตั้ง)
`main` → Vercel Production: `DATABASE_URL`(prod) · `AUTH_SECRET` · Linear/status vars · webhook vars (`LINEAR_WEBHOOK_SECRET`/`GH_DISPATCH_TOKEN`/`GITHUB_REPO`)

### GitHub (Actions — เสริม)
- **Variables:** `LINEAR_TEAM_KEY=CAM` · `STAGING_URL` · `PROD_URL` (ให้ smoke job ใน `ci.yml` เช็ค URL จริงหลัง deploy)
- **Secrets:** `LINEAR_API_KEY` (มีแล้ว) · `ANTHROPIC_API_KEY` (optional — เปิด autonomous continuation)

## 5. Verify "กดเล่นได้" (ต่อ env)
- [ ] เปิด URL ของ env แล้ว load ได้ (ไม่ 500)
- [ ] `/login` + สมัคร/ล็อกอินได้ (= `AUTH_SECRET` + DB ใช้ได้)
- [ ] มีข้อมูลแคมป์ (= migrate + seed รันแล้ว)
- [ ] (ถ้าตั้ง) `/status?token=...` โหลด Linear ได้
- [ ] staging/prod: `/api/seed` คืน 403 (`ALLOW_DANGEROUS_SEED` ไม่ถูกตั้ง)

## หลักที่ห้ามพลาด
- `DATABASE_URL` **แยกเด็ดขาด** ต่อ env — กันเทสต์เขียนทับ prod
- `AUTH_SECRET` ต้อง set ทุก env ไม่งั้น login พัง
- `ALLOW_DANGEROUS_SEED` **ห้ามตั้ง** ใน staging/prod
- migrate ทดสอบบน Staging ก่อน prod เสมอ (ข้อดีหลักของ 3-env)
