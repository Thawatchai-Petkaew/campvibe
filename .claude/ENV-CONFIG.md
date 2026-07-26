# ENV-CONFIG — ตาราง config: Dev / Staging / Production

> สร้างตามคำขอ owner 2026-07-05 ประกอบแผน "dev branch + dev DB local-first workflow" — **executed 2026-07-05**: vercel.json allow-list + vercel-ignore.sh (PR 389) · branch `dev` + protection · repo vars STAGING_URL/PROD_URL · ci.yml dev triggers + db-sync script (PR นี้) · การสลับ .env + sync รอบแรกทำในเครื่อง owner
> สถานะรายช่อง: ✅ มีแล้ว · ➕ ต้องเพิ่ม · ➖ ไม่ต้องเติม (จงใจไม่ตั้ง) · ⚠ ตรวจค่าใน dashboard (ผมอ่านค่า secret ตรงไม่ได้)

## 1. โครงต่อ environment

| | **Dev (ใหม่)** | **Staging** | **Production** |
|---|---|---|---|
| Git branch | `dev` ➕ | `staging` ✅ | `main` ✅ |
| ใครเข้าถึง | owner + AI (localhost) | owner + คนที่ได้ URL (demo/G4) | สาธารณะ (Coming Soon อยู่) |
| URL | `http://localhost:3000` | `https://campvibe-staging.vercel.app` ✅ | `https://campvibe.vercel.app` ✅ |
| Vercel deploy | **ไม่มีเลย** (allow-list ตัดทิ้ง) ➕ | auto ตอน promote `dev→staging` (batch, ~1-3/วัน) | auto ตอน promote `staging→main` (release train) |
| Product DB | **Postgres ในเครื่อง** (ของเดิม `LOCAL_DATABASE_URL`) ➕ สลับกลับ | Prisma Postgres staging ✅ | Prod DB ✅ |
| ข้อมูลใน DB | clone จาก staging ผ่าน `db:sync-from-staging` (ทิศเดียว) ➕ | ข้อมูลจริง/demo — สะอาดขึ้นเพราะการทดสอบย้ายไป dev | ข้อมูลจริง |
| Migration | `prisma migrate dev` อิสระ + พิสูจน์ up→down→up | `migrate deploy` รันอัตโนมัติใน Vercel build ตอน promote ✅ | `migrate deploy` ตอน release ✅ |
| บทบาทใน flow | สร้าง + verify AC ทุกใบ (Done = merged เข้า dev + verified ที่นี่) | G4 นั่งตรวจ/โชว์ลูกค้า (label `on-staging`) | Released |

## 2. Environment variables (จากการ inventory โค้ดจริง)

| ตัวแปร | ใช้ทำอะไร (ไฟล์หลัก) | Dev (.env ในเครื่อง) | Staging (Vercel) | Prod (Vercel) |
|---|---|---|---|---|
| `DATABASE_URL` | product DB (`prisma/schema.prisma`) | ➕ **สลับกลับเป็น local** (ค่า comment รออยู่ใน .env) | ✅ ⚠ | ✅ ⚠ |
| `DELIVERY_DATABASE_URL` | **ticket DB แยกคนละก้อนกับ product** (`lib/delivery/client.ts`) — /status + ticket-sync | ✅ **ห้ามแตะตอนสลับ DB** — tickets อยู่ก้อนเดิมทุก env | ✅ ⚠ | ✅ ⚠ |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | NextAuth session | ✅ | ✅ ⚠ | ✅ ⚠ |
| `NEXTAUTH_URL` | callback base | ✅ localhost:3000 | ➖ (Vercel จัดการเอง) | ➖ |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth (optional — หลักคือ credentials) | ⚠ มีถ้าจะทดสอบ Google login | ⚠ | ⚠ |
| `BLOB_READ_WRITE_TOKEN` | อัปโหลดรูป Vercel Blob | ➖ ไม่ต้อง — dev เขียน `public/uploads` fallback (NODE_ENV=development, CAM-239) | ✅ ⚠ | ✅ ⚠ |
| `RESEND_API_KEY` + `EMAIL_FROM` | ส่งอีเมล | ➖ ยังไม่ใช้ใน dev | ⚠ ตามที่เปิดใช้ | ⚠ |
| `STATUS_TOKEN` | authz ทุก mutation ของ /status + ticket-sync CLI (`lib/status-auth`) | ✅ | ✅ ⚠ | ✅ ⚠ |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` / `TELEGRAM_WEBHOOK_SECRET` | แจ้งเตือน gate/handoff | ✅ | ✅ ⚠ | ✅ ⚠ |
| `GH_DISPATCH_TOKEN` + `GITHUB_REPO` | ปุ่ม Approve บน /status ยิง gate-continue workflow | ✅ (approve จาก localhost ได้) | ✅ ⚠ | ✅ ⚠ |
| `APP_BASE_URL` | ลิงก์ในข้อความ Telegram | ➖ ใช้ default | ➖ default = staging URL | ⚠ ควรชี้ prod ถ้า notify จาก prod |
| `COMING_SOON` | gate ปิดหน้าเว็บ prod (`proxy.ts`, =1 คือปิด) | ➖ | ➖ ไม่ตั้ง (เปิดเต็ม) | ✅ `=1` จนกว่าจะ full launch |
| `TICKETS_SOURCE` | delivery adapter (`db` ปัจจุบัน) | ✅ | ✅ ⚠ | ✅ ⚠ |
| `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` + `OPENROUTER_MODEL_FALLBACK` | AI assistant tool layer (`lib/ai/openrouter-client.ts`, CAM-270) — key absent = client self-skips (no spend, no network call), safe blank in dev/CI | ➖ ยังไม่ใช้ใน dev (real spend เป็น G2 owner-gated) | ⚠ ตั้งเมื่อ owner approve ทดสอบจริง | ⚠ ตั้งเมื่อ owner approve จริง |
| `CRON_SECRET` | **➕ ใหม่ (CAM-422)** — guard `GET /api/cron/ai-chat-retention` (`lib/cron-auth.ts`); Vercel Cron ส่ง `Authorization: Bearer $CRON_SECRET` อัตโนมัติเมื่อตั้งค่าไว้บน project; ไม่ตั้ง = route 401 เสมอ (default-deny) | ➖ dev ไม่มี cron วิ่งเอง — ทดสอบ route ด้วย curl + secret ชั่วคราวในเครื่องพอ | ➕ **ต้องตั้งก่อน promote** — ไม่งั้น cron ที่ Vercel ยิงมาจะ 401 ทุกครั้ง (ไม่ลบอะไรเลย เงียบๆ) | ➕ **ต้องตั้งก่อน promote** เหตุผลเดียวกัน |
| `GOOGLE_GEOCODING_API_KEY` | **➕ ใหม่ (CAM-554)** — server-only key for `app/api/geocode/reverse` + `.../forward` (`app/api/geocode/_shared.ts`); Google Geocoding API only, restricted to that API, NEVER `NEXT_PUBLIC_` — Leaflet stays the browser map, no Google Maps JS key exists anywhere; absent = both routes return a generic `500` (logged server-side only, never the missing-key detail to the client) | ⚠ ต้องตั้งเพื่อทดสอบปักหมุด/AC-2 ในเครื่อง | ⚠ **ต้องตั้งก่อน promote** — ไม่งั้นปักหมุดจะ 500 เงียบๆ ทุกครั้ง (เหมือนบทเรียน `CRON_SECRET` ข้างบน) | ⚠ **ต้องตั้งก่อน promote** เหตุผลเดียวกัน |
| `PRISMA_QUERY_LOG` · `STATUS_STREAM_*` | debug/tuning | ➖ เปิดเฉพาะตอน debug | ➖ | ➖ |
| `ALLOW_DB_RESET` / `ALLOW_DANGEROUS_SEED` | กันยิง seed/reset พลาด | ➖ ตั้งชั่วคราวเฉพาะตอนใช้ | ➖ **ห้ามมี** | ➖ **ห้ามมี** |
| `.env.e2e` (แยกไฟล์, gitignored) | e2e regression (db-guard บังคับ localhost, port 3100) | ✅ — ทำงานเข้ากับ dev DB local โดยธรรมชาติ | ➖ e2e ไม่วิ่งบน Vercel | ➖ |

## 3. GitHub (Actions / repo)

| รายการ | สถานะ | หมายเหตุ |
|---|---|---|
| Secrets: `ANTHROPIC_API_KEY` `STATUS_TOKEN` `TELEGRAM_BOT_TOKEN` `TELEGRAM_CHAT_ID` | ✅ | headless workflows (camper-adhoc, gate-continue) |
| Secret: `LINEAR_API_KEY` | ✅ (archive-read-only) | คงไว้เฉยๆ ได้ |
| Vars: `APP_BASE_URL` (=staging URL) · `TICKETS_SOURCE=db` | ✅ | |
| **Vars: `STAGING_URL` + `PROD_URL`** | ➕ **ขาดจริง — พบวันนี้** | smoke job ใน ci.yml เลือก URL จากสองตัวนี้ → ไม่เคยถูกตั้ง = smoke **ข้ามตัวเองเงียบๆ มาตลอด** ตั้งแล้ว smoke จะตรวจ 200 หลัง deploy ให้จริง |
| Branch protection `staging` + `main` (required: quality-gate) | ✅ | |
| **Branch protection `dev`** | ➕ ตามแผน | required check เดียวกับ staging |
| **`ci.yml` push triggers เพิ่ม `dev`** | ➕ ตามแผน | post-merge CI บน dev; smoke มี guard เดิม (ไม่มี URL var ของ dev → ข้าม) |
| `VERCEL_TOKEN` ใน Actions | ➖ ไม่ต้อง | เราไม่ deploy จาก Actions — Vercel Git integration ทำเอง |

## 4. Vercel (project campvibe)

| รายการ | สถานะ | หมายเหตุ |
|---|---|---|
| Git integration + branch mapping (staging/main) | ✅ | staging เป็น preview-class + fixed alias |
| **`vercel.json` — `git.deploymentEnabled` allow-list `{"**": false, "staging": true, "main": true}`** | ➕ **หัวใจของแผน** | ทางเดียวที่ไม่เผาโควตา (build ที่ skip ยังนับเต็ม — official docs) · `dev` และ `feature/*` = ไม่สร้าง deployment เลย |
| **`scripts/vercel-ignore.sh` (ignoreCommand)** | ➕ | skip build เมื่อ diff มีแต่ docs/*.md (ประหยัด build minutes, ไม่ประหยัดโควตา — รู้ไว้ตรงๆ) |
| Env vars แยก scope staging/prod | ✅ ⚠ | ตรวจรายตัวตามตาราง §2 |
| Custom Environment "staging" ของจริง | ➖ ไม่ต้อง | ฟีเจอร์ Pro/Enterprise — branch-preview + alias ที่ใช้อยู่เพียงพอ |
| `DEV_URL` / deploy ของ dev | ➖ ไม่มีโดยตั้งใจ | dev อ่านผ่าน localhost เท่านั้น |
| Preview Deployments toggle ใน dashboard | ➖ ไม่มีให้กด | Vercel ไม่มี setting นี้ — allow-list ใน vercel.json คือทางเดียว |

## 5. Checklist ตอน execute (ครั้งเดียว)

1. ➕ PR-1: `vercel.json` + `scripts/vercel-ignore.sh` → พิสูจน์: push branch แล้ว **ไม่มี** deployment เกิด
2. ➕ สร้าง branch `dev` จาก staging + protection + เพิ่มใน ci.yml push triggers
3. ➕ สลับ `.env` main tree: `DATABASE_URL` → local Postgres (ค่า `LOCAL_DATABASE_URL` เดิม) — **คง `DELIVERY_DATABASE_URL` และตัวอื่นไว้ทั้งหมด**
4. ➕ `scripts/db-sync-from-staging.mjs` + รันรอบแรก → owner เปิด localhost เห็นลานจริง/โซน 378/รูปครบ
5. ➕ ตั้ง repo vars `STAGING_URL` + `PROD_URL` → smoke ทำงานจริงครั้งแรก
6. Main tree checkout `dev` · dev server restart · ผม verify ครบก่อนส่งมอบ

## สิ่งที่จงใจ "ไม่เติม" (สรุป)

dev ไม่มี URL สาธารณะ ไม่มี Vercel deploy ไม่มี blob token ไม่มี email key · staging/prod ไม่มี ALLOW_DB_RESET/ALLOW_DANGEROUS_SEED เด็ดขาด · ไม่ใช้ VERCEL_TOKEN/CLI deploy จาก CI · ไม่ซื้อ Custom Environment · ticket DB (`DELIVERY_DATABASE_URL`) ไม่แยกตาม env — เป็นก้อนกลางก้อนเดียวของทีมส่งงาน
