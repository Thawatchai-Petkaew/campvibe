# CampVibe — Status Sync Architecture (Linear = Source of Truth)

> ตอบ 3 คำถาม: (1) ทำไมงานไม่อัปเดตเอง (2) agent เสร็จ→Linear→dashboard sync ยังไง (3) **approve ที่ Linear แล้วระบบรู้ได้ยังไงว่าต้องไปต่อ**

## หลักการ: Linear คือ Single Source of Truth (SoT)
- **Linear** = แหล่งความจริงของสถานะงานทั้งหมด (team CAM)
- **Dashboard `/status`** = อ่าน Linear สด ทุก 60s (read-only) — ถูกต้องอยู่แล้ว ✅
- **`linear-snapshot.json`** = snapshot ที่ generate จาก Linear (`npm run status:pull`) — ไม่ใช่แหล่งคู่ขนาน, ห้ามแก้มือ
- **`docs/project/product-plan.md`** = เอกสาร spec/กลยุทธ์ (ไม่ใช่ live status)
- **`docs/delivery/`** = durable **content** (spec/design/test/review/ship) ต่อ Feature→Epic→Story (ไฟล์) ส่วน Linear ถือ **live status**; `INDEX.md` generate ด้วย `node scripts/linear-sync.mjs index`

## Definition of Done & env mapping (3-env: Local→Staging→Prod)
Linear status เปลี่ยนตาม **git/gate event ไม่ผูก env**: เริ่ม→`In Progress` · เปิด PR→`In Review` · merge เข้า `staging`→`Done`
- **Done** (story): merge เข้า `staging` + quality-gate เขียว + migration staging ผ่าน + **verify AC บน Staging URL จริง** → state `Done`
- **Released** (deployment): promote `staging`→`main` + prod deploy + smoke + tag + changelog → label **`released`** (+ git tag) — *ไม่ใช่* state ใหม่ (story ยัง `Done`)
- หลาย story `Done` (อยู่ Staging) ได้ก่อนรวมปล่อยขึ้น prod เป็นรอบ — dashboard โชว์ 2 มิติ: state `Done` + label `released`

| Linear state/label | env | gate | ใครเปลี่ยน |
|---|---|---|---|
| In Progress | local | post-G1/G2 | agent เริ่มงาน (`linear-sync set`) |
| In Review | PR Preview | G3 รอ | เปิด PR (Linear↔GitHub auto) |
| Done | Staging | post-G3 + G4 รอ | merge→`staging` (auto/CLI) |
| label `released` | Production | post-G5 | `linear-sync release <id>` ตอน promote prod |

> "Status เปลี่ยนที่ env ไหน?" → **state เปลี่ยนที่ git event (global)** · `released` ติดตอน **promote ขึ้น prod** เท่านั้น

## ปัญหาเดิม (ก่อนแก้)
ไม่มี **executable mechanism** ที่ push เข้า Linear ได้เอง → ต้องให้ orchestrator เรียก MCP มือในเซสชัน → ระหว่างนั้น "ไม่มีอะไรอัปเดต"

## กลไกใหม่: `scripts/linear-sync.mjs` (ใช้ LINEAR_API_KEY, ไม่ผูก MCP)
รันได้จาก orchestrator / CI / hook / cron:
| คำสั่ง | ทำอะไร |
|---|---|
| `npm run status:linear` | list งานทั้งหมดใน Linear (จัดกลุ่มตาม epic) |
| `npm run status:gates` | **สัญญาณ gate** — gate ไหนรอคุณ vs อนุมัติแล้ว→ไปต่อ (exit 10 ถ้ามี cleared) |
| `npm run status:pull` | ดึง Linear → `.claude/linear-snapshot.json` |
| `node scripts/linear-sync.mjs set CAM-7 --state "In Progress"` | เปลี่ยน state |
| `... set CAM-11 --add-label awaiting-you` / `--remove-label` | ติด/ถอด gate flag |

## Closed loop เต็ม

```
1. requirement ─▶ orchestrator (Discovery) ─▶ สร้าง Linear issues ทันที (intake)
                                                     │  ← "เพิ่ม requirement/replan" = สร้าง/แก้ issue ที่นี่
2. agent ทำงาน ─▶ orchestrator: linear-sync set <id> --state "In Progress"/"Done"   ──▶ LINEAR (SoT)
3. ถึง gate มนุษย์ ─▶ linear-sync set <gate> --add-label awaiting-you (+ Gate Review comment)
                                                     │
4.            👤 คุณ review ใน Linear → APPROVE = ถอด label awaiting-you (หรือย้ายเป็น Done)
                                                     │
5.  ┌─ WATCHER เห็นสัญญาณ (npm run status:gates → "CLEARED → CONTINUE", exit 10) ─┐
    │   trigger ได้ 3 ทาง:                                                        │
    │   (a) คุณพิมพ์ในเซสชัน "approved / ไปต่อ"  → orchestrator อ่าน gates แล้วเดินต่อ │
    │   (b) /loop ทุก N นาที รัน gates → ถ้า cleared → spawn stage ถัดไปอัตโนมัติ      │
    │   (c) /schedule (cron cloud agent) รัน gates เป็นรอบ                          │
    └──────────────────────────────────────────────────────────────────────────┘
                                                     │
6. orchestrator spawn agent stage ถัดไป → set state → (วน 2)
                                                     ▼
            DASHBOARD /status อ่าน Linear สด — เห็นทุกการเปลี่ยนภายใน 60s ✅
```

## ตอบ: "approve ที่ Linear แล้วรู้ได้ยังไงว่าไปต่อ"
**Convention:** gate ที่รอคุณ = มี label `awaiting-you` → คุณ **ถอด label นั้นใน Linear = อนุมัติ**
**Detection:** `npm run status:gates` แปลงสัญญาณนั้นเป็นผลลัพธ์ machine-readable:
- ยังมี `awaiting-you` → `⏳ WAITING-ON-YOU` (exit 0)
- ถอดแล้ว แต่ยังไม่ Done → `✅ CLEARED → CONTINUE` (**exit 10**)

ความจริงที่ต้องเข้าใจ: **orchestrator ไม่ใช่ daemon ที่รันค้าง** การจะ "รู้เอง" ต้องมีตัว **poll** —
- **ตอนนี้ (manual):** คุณ approve ใน Linear แล้วบอกในเซสชัน "ไปต่อ" → orchestrator รัน `status:gates` ยืนยัน แล้วเดินต่อ
- **อัตโนมัติ:** ตั้ง `/loop 10m` หรือ `/schedule` ให้ orchestrator รัน `status:gates` เป็นรอบ → เจอ exit 10 → spawn stage ถัดไปเอง (ไม่ต้องรอคุณพิมพ์)

## Auto-sync ของจริงสำหรับ "PR merge → Done": Linear ↔ GitHub native
Linear gen `gitBranchName` ให้ทุก issue แล้ว (เช่น `tpetkaew/cam-7-...`). ถ้าเชื่อม **Linear → GitHub integration** (Linear Settings → Integrations → GitHub):
- ตั้งชื่อ branch = `gitBranchName` ของ issue **หรือ** ใส่ `CAM-7` / `Closes CAM-7` ใน PR
- เปิด PR → Linear ย้าย issue เป็น "In Progress/In Review" อัตโนมัติ
- **merge PR → Linear ย้ายเป็น Done อัตโนมัติ** ← นี่คือ auto-sync ขั้น build→ship ที่ไม่ต้องเขียนโค้ดเอง

> 👉 สิ่งเดียวที่คุณต้องทำเพื่อปลดล็อก auto-sync ขั้นนี้: เชื่อม Linear↔GitHub ในหน้า Linear settings (1 ครั้ง)

## วินัย orchestrator (กฎตายตัว — กัน "ลืม sync")
ทุก transition ต้องลงด้วยคำสั่งจริง ไม่ใช่แค่จำ:
- intake → สร้าง Linear issues + ติด persona label
- เริ่มงาน → `set <id> --state "In Progress"`
- เสร็จ → `set <id> --state Done` (หรือให้ PR merge ทำผ่าน GitHub integration)
- ถึง gate → `set <gate> --add-label awaiting-you`
- หลัง gate ผ่าน → ตรวจ `status:gates` → เดินต่อ
- (option) hook เตือนตอน Stop ถ้ามี transition ที่ยังไม่ push

## อะไรอัตโนมัติ / อะไรยัง manual (สรุปตรง ๆ)
| ขั้น | สถานะ |
|---|---|
| Dashboard อ่าน Linear สด | ✅ อัตโนมัติ (60s) |
| Push สถานะเข้า Linear | ✅ มีกลไกแล้ว (CLI) — orchestrator/CI เรียก |
| PR merge → Done | ⚙️ อัตโนมัติได้ ถ้าเชื่อม Linear↔GitHub (คุณทำ 1 ครั้ง) |
| approve ใน Linear → ไปต่อ | ⚡ **real-time** (webhook ด้านล่าง) หรือ 🔁 manual/`/loop` |

---

# Real-time mode (webhook) — สร้างไว้แล้ว ⚡

```
Linear (ถอด awaiting-you) ──webhook──▶ POST /api/linear-webhook  (Vercel, มีแล้ว)
   verify HMAC signature → ตรวจว่าเป็น gate ที่ถูก approve → ยิง repository_dispatch
        │
        ▼
GitHub Action .github/workflows/linear-continue.yml
   → node scripts/linear-sync.mjs gates  (ยืนยัน exit 10 = cleared จริง)
   → claude -p (headless orchestrator)  เดิน stage ถัดไป → **draft PR เท่านั้น ห้ามแตะ main** → update Linear
```
ไฟล์ที่สร้าง: `app/api/linear-webhook/route.ts` · `.github/workflows/linear-continue.yml`

## Setup ที่คุณต้องทำ (ผมทำแทนไม่ได้ — ต้องใช้สิทธิ์/secret ของคุณ)
**A. Vercel → Settings → Environment Variables (Production):**
- `LINEAR_WEBHOOK_SECRET` = signing secret จาก Linear (ขั้น B)
- `GITHUB_REPO` = `Thawatchai-Petkaew/campvibe`
- `GH_DISPATCH_TOKEN` = GitHub fine-grained PAT (สิทธิ์ Contents: read & write บน repo นี้)
- (+ ของ dashboard: `LINEAR_API_KEY`, `LINEAR_TEAM_KEY=CAM`, `STATUS_TOKEN`)

**B. Linear → Settings → API → Webhooks → New:**
- URL = `https://campvibe.vercel.app/api/linear-webhook`
- Resource = **Issues**
- คัดลอก **Signing secret** → ไปใส่ Vercel เป็น `LINEAR_WEBHOOK_SECRET`

**C. GitHub → repo → Settings → Secrets and variables → Actions:**
- secret `LINEAR_API_KEY` (ให้ CLI ใน Action)
- secret `ANTHROPIC_API_KEY` *(optional)* — ใส่ = เปิด autonomous continuation; ไม่ใส่ = Action แค่ log ว่า gate พร้อม
- (variable) `LINEAR_TEAM_KEY = CAM`

**D. ต้อง merge ไฟล์เหล่านี้เข้า `main`** — repository_dispatch ยิง workflow ได้เฉพาะที่อยู่บน default branch + Vercel ต้อง deploy route ใหม่

## ⚠️ ต้นทุน / ความปลอดภัย (อ่านก่อนเปิด)
- ทุกครั้งที่ approve = 1 CI run + (ถ้าเปิด) **ค่า Claude tokens** — มี cost ต่อครั้ง
- webhook **verify signature** (ปฏิเสธ request ที่ไม่ sign) · ใช้ PAT สิทธิ์แคบ
- autonomous continuation เขียนโค้ดบน **branch + draft PR เท่านั้น ไม่ merge/ไม่แตะ main** → คุณรีวิว PR เอง
- `--dangerously-skip-permissions` รันเฉพาะใน CI runner (sandbox) ตอนแรกแนะนำ **ไม่ใส่ ANTHROPIC_API_KEY** ก่อน (mode log-only) ดูว่า webhook→dispatch ทำงาน แล้วค่อยเปิด autonomous

## ทดสอบ end-to-end
1. ตั้ง A–D + redeploy/merge main
2. ใน Linear ถอด label `awaiting-you` จาก CAM-11 (จำลอง approve)
3. ดู: Vercel route log → GitHub Actions tab มี run "Linear → continue" → (ถ้าเปิด) draft PR โผล่
