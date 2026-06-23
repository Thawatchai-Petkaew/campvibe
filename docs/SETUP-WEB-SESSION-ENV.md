# SETUP-WEB-SESSION-ENV — ตั้ง env/secret สำหรับ Claude Code on the web

> คู่กับ `docs/SETUP-ENVS.md` (3-env: Local → Staging → Prod) — ไฟล์นี้เจาะจง **session ที่รันบน Claude Code web** (remote ephemeral container) ให้ AI delivery workflow (Linear + Telegram closed loop) ทำงานได้เหมือนตอนรัน local

## ทำไมต้องมีไฟล์นี้

Claude Code on the web **ไม่ได้รันบนเครื่อง local ของคุณ** — มันรันใน container บน cloud ที่ clone repo ใหม่สดทุกครั้ง

- `.env` ของคุณ (ที่มี `LINEAR_API_KEY`, `TELEGRAM_*`) **ถูก gitignore** (`.gitignore`: `.env*` ยกเว้น `.env.example`)
- → clone มาในนี้จึง **ไม่มี `.env` ติดมาด้วย** มีแค่ `.env.example`
- → `scripts/linear-sync.mjs` (เครื่องมือ closed loop) **รันไม่ได้** เพราะไม่มี key → ไม่มี ticket / ไม่มี label / ไม่มี Telegram

workflow ไม่ได้พัง — แค่ container remote นี้ยังไม่มีสำเนา secret ของคุณ ต้อง **inject ผ่าน environment settings ของ web session**

## ตั้งที่ไหน

Claude Code on the web → **environment variables / secrets** ของ environment นั้น → ระบบ inject เข้า process env ของ container ตอนรัน
อ้างอิง: https://code.claude.com/docs/en/claude-code-on-the-web

## ตัวแปรที่ต้องตั้ง

### A. จำเป็นสำหรับ AI workflow closed loop (Linear + Telegram)
ครบชุดนี้ = `scripts/linear-sync.mjs` ทำงานได้: เปิด ticket, ติด label `awaiting-you`, ยิง Telegram, sync `/status`

| Var | หน้าที่ | ค่าเอามาจาก |
|---|---|---|
| `LINEAR_API_KEY` | เปิด/อัปเดต Linear issue + label + state (server-side) | Linear → Settings → Security & access → Personal API keys |
| `LINEAR_TEAM_KEY` | team key | ใส่ `CAM` (ค่า default) |
| `TELEGRAM_BOT_TOKEN` | ยิงแจ้งเตือน Telegram ตอนถึง gate | @BotFather |
| `TELEGRAM_CHAT_ID` | chat ปลายทาง | ส่งข้อความหา bot แล้วอ่านจาก `getUpdates` |
| `STATUS_TOKEN` | ป้องกัน `/status?token=...` + linear-sync ใช้ทำลิงก์ | ตั้งเอง (random string) |

### B. เสริม — reply loop (ปุ่ม Approve/Reject ใน Telegram ตอบกลับเข้าระบบ)
| Var | หน้าที่ |
|---|---|
| `TELEGRAM_WEBHOOK_SECRET` | verify ขา Telegram → `/api/telegram-webhook` |
| `APP_BASE_URL` | base ของลิงก์ /status ใน Telegram (default staging) |

> ขา **ส่งแจ้งเตือน (outbound)** ใช้แค่ชุด A พอ — ขา reply loop ต้องมี webhook ชี้มาที่ `/api/telegram-webhook` บน deployment จริงเพิ่ม

### C. ระดับแอป (ตั้งเฉพาะถ้าจะรันแอป/แตะ DB ใน session นี้ — ไม่เกี่ยวกับ workflow)
`DATABASE_URL` · `AUTH_SECRET` · `BLOB_READ_WRITE_TOKEN` · `RESEND_API_KEY` / `EMAIL_FROM`

> ⚠️ ห้ามชี้ `DATABASE_URL` ของ web session ไปที่ prod DB (กันเขียนทับข้อมูลจริง) — ดู `docs/SETUP-ENVS.md`

## กลไก: Telegram ผูกกับ status/label ของ Linear

การแจ้งเตือนไม่ใช่ระบบแยก — มันเป็น **side-effect ของการเปลี่ยน label/state ผ่าน `scripts/linear-sync.mjs`**

- ติด label `awaiting-you` (ถึง human gate) → `linear-sync.mjs` ยิง Telegram พร้อมปุ่ม Approve/Reject (ดู `scripts/linear-sync.mjs` — `notifyTelegram`)
- `handoff` สลับ `role:` label → ยิง Telegram notice หา role ถัดไป

> ❗ การแก้ Linear ผ่าน **MCP ตรง ๆ** จะ **bypass** loop นี้ (ไม่ accumulate `role:` label, ไม่ยิง Telegram) — ต้องผ่าน `linear-sync.mjs` เท่านั้น

## ใครเปิด ticket

**Orchestrator (The Camper)** เป็นเจ้าของ ตาม `.claude/agents/orchestrator.md` + `.claude/commands/new-feature.md`:
- Intake: `node scripts/linear-sync.mjs scaffold <CAM-id>` → product-owner เติม `feature/epic/story`
- G1: ออก story ticket เป็น Linear issue
- ทุก transition: skill `update-status` → `linear-sync.mjs` sync Linear

(skill `update-status` **ไม่ใช้สร้าง issue** — สร้างที่ Discovery)

## Verify หลังตั้ง env เสร็จ

```bash
# 1) ยืนยันว่า inject เข้ามาแล้ว (ชื่อเท่านั้น ไม่โชว์ค่า)
env | grep -E 'LINEAR|TELEGRAM|STATUS_TOKEN' | sed 's/=.*/=<set>/'

# 2) ต่อ Linear ติดไหม
node scripts/linear-sync.mjs list      # หรือ npm run status:linear

# 3) เช็ค gate
npm run status:gates                    # exit 10 = cleared, exit 0 = waiting
```

- [ ] `linear-sync.mjs list` คืนรายการ issue ของ team CAM (= LINEAR_API_KEY ใช้ได้)
- [ ] ทดลองติด label `awaiting-you` กับ issue ทดสอบ → Telegram เด้ง (= TELEGRAM_* ใช้ได้)

## หลักที่ห้ามพลาด
- secret ของ web session **แยกจาก** Vercel/GitHub Actions — ตั้งคนละที่ (อย่าคิดว่าตั้งที่ Vercel แล้ว session web จะเห็น)
- อย่า commit ค่า secret ลง repo — ใช้ environment settings เท่านั้น (`.env*` ถูก gitignore อยู่แล้ว)
- ตั้ง `LINEAR_API_KEY` เป็น **Personal API key** ไม่ใช่ OAuth token
