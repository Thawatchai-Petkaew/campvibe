# CampVibe — Status Sync Architecture (Self-hosted delivery ticket DB = Source of Truth)

> ตอบ 3 คำถาม: (1) ทำไมงานไม่อัปเดตเอง (2) agent เสร็จ→ticket DB→dashboard sync ยังไง (3) **approve แล้วระบบรู้ได้ยังไงว่าต้องไปต่อ**
>
> **ประวัติ:** เอกสารนี้เคยอธิบายสถาปัตยกรรมยุค Linear (webhook `app/api/linear-webhook/route.ts` + `scripts/linear-sync.mjs`). Epic "Self-hosted Delivery Tickets" (CAM-276, ADR-010, T-0..T-6) ย้ายทุกอย่างมาที่ตารางของเราเอง — เอกสารนี้ถูกเขียนใหม่ทั้งหมดใน T-6 (CAM-282) ให้ตรงกับสถาปัตยกรรมปัจจุบัน ไม่ใช่แค่แก้คำ.

## หลักการ: Delivery ticket DB คือ Single Source of Truth (SoT)

- **Delivery ticket DB** (`prisma/delivery/schema.prisma`, database แยกจากของจริงคนละตัว, env `DELIVERY_DATABASE_URL`) = แหล่งความจริงของสถานะงานทั้งหมด (team `CAM`, identifier รูปแบบ `CAM-###` เหมือนเดิม — เลขลำดับเดียวกันทั้งระบบ, prefix `"CAM-"` **hardcode ไว้ใน `lib/delivery/tickets.ts`'s `createTicket()`**, ไม่มี env ให้ override — ดู PORTABILITY.md ถ้าจะย้ายไปโปรเจกต์อื่น)
- **Dashboard `/status`** = อ่านจาก `/api/tickets` (ผ่าน `lib/delivery/status-adapter.ts`) สด ทุก 60s (read-only, cache คีย์ด้วย `DeliveryPulse.version` — ไม่ใช่ fixed-time cache ธรรมดา จึงได้ข้อมูลใหม่ทันทีที่ pulse ขยับ ไม่ต้องรอ webhook) ✅
- **`.claude/linear-snapshot.json`** = snapshot ที่ generate จาก ticket DB (`npm run tickets:pull` = `node scripts/ticket-sync.mjs pull`) — ไม่ใช่แหล่งคู่ขนาน, ห้ามแก้มือ
- **`docs/project/product-plan.md`** = เอกสาร spec/กลยุทธ์ (ไม่ใช่ live status)
- **`docs/specs/`** = durable **content** (spec/design/test/review/ship) ต่อ Feature→Epic→Story (ไฟล์) ส่วน ticket DB ถือ **live status**; `INDEX.md` generate ด้วย `node scripts/ticket-sync.mjs index`
- **Linear (ของเดิม)** = เก็บไว้เป็น **read-only archive** เท่านั้น (275 ใบเก่า + `.mcp.json`'s Linear MCP server ยังต่ออยู่แต่ใช้อ่านประวัติเท่านั้น) — ห้ามเขียน/สร้าง issue ใหม่ผ่าน MCP อีกต่อไป

## State machine (ADR-010) — แทนที่ state+label คู่ขนานแบบ Linear เดิม

Ticket หนึ่งใบมี **state จริง** ที่ผ่าน guarded verb เท่านั้น (ไม่ใช่ label ที่ตั้งเป็นอิสระจาก state แบบ Linear):

```text
                         ┌──────────────────────────────────────────────┐
   create           start(role?)      raiseGate        approve(nextRole) │
(none)──▶ BACKLOG ───────────▶ TODO ───────▶ IN_PROGRESS ───────▶ AWAITING_GATE ─┘
             │                                  ▲   ▲                  │  │
             │  cancel (จาก state ที่ไม่ terminal)  │   │  reject          │  │ complete
             ▼                                  └──────────────────────┘  ▼
          CANCELED ───reopen(note)───▶ BACKLOG                          DONE ──release──▶ DONE (releasedAt stamped)
```

9 verbs: `create · start · raiseGate · approve · reject · complete · release · cancel · reopen` (+ 2 orthogonal toggle: `setBlocked` · `archive`, + plain-field `updateFields` + `handoff`). ทุก verb เขียนผ่าน **`lib/delivery/tickets.ts`** ตัวเดียว (service module เดียว ไม่มี route ไหนแตะ Prisma ของ delivery DB ตรง ๆ) และทุก verb: (1) เช็ค precondition ตาม state ปัจจุบัน (2) เขียนแถว `Ticket` + append แถว `TicketEvent` (audit ledger, append-only) ใน `$transaction` เดียวกัน (3) bump `DeliveryPulse.version` (4) ยิง Telegram + (เฉพาะ `approve`) ยิง `repository_dispatch` — **ทั้งหมดในคำขอ (request) เดียว ไม่มี webhook คั่นกลาง**.

**⚠️ ข้อควรระวัง — ปุ่ม Approve ทั่วไปไปไม่ถึง `Done`:** ปุ่ม/tap Approve (Telegram, `/status` UI, `/status/map`) เรียก verb `approve()` เท่านั้น ซึ่งพา ticket กลับไป `IN_PROGRESS` (เหมาะกับ gate ที่ไม่ใช่ terminal เช่น G1–G3) `Done` (G4 Staging sign-off, terminal gate) มาจาก verb `complete()` ต่างหาก — ไม่มีปุ่มไหนเรียก verb นี้ ต้องรัน `node scripts/ticket-sync.mjs set <CAM-id> --state Done` ตรง ๆ ตอน ticket ยังอยู่ `AWAITING_GATE` (ก่อนที่ปุ่ม Approve ทั่วไปจะเปลี่ยน state กลับเป็น `IN_PROGRESS`).

## Definition of Done & env mapping (3-env: Local→Staging→Prod)

Ticket state เปลี่ยนตาม **git/gate event ไม่ผูก env**: เริ่ม→`IN_PROGRESS` · เปิด PR→board แสดง "In Review" อัตโนมัติ (derived, ไม่ใช่ state แยก) · merge เข้า `staging`→`DONE`
- **Done** (story): merge เข้า `staging` + quality-gate เขียว + migration staging ผ่าน + **verify AC บน Staging URL จริง** → state `DONE` (ผ่าน `complete()`, ดูคำเตือนด้านบน)
- **Released** (deployment): promote `staging`→`main` + prod deploy + smoke + tag + changelog → `release()` stamp **`releasedAt`** (+ git tag) — *ไม่ใช่* state ใหม่ (ticket ยัง `DONE`)
- หลาย story `DONE` (อยู่ Staging) ได้ก่อนรวมปล่อยขึ้น prod เป็นรอบ — dashboard โชว์ 2 มิติ: state `Done` + `releasedAt` (แสดงเป็น label `released` สังเคราะห์)

| state / flag | env | gate | ใครเปลี่ยน |
|---|---|---|---|
| IN_PROGRESS | local | post-G1/G2 | agent เริ่มงาน (`ticket-sync set` หรือ `handoff`) |
| (board: In Review) | PR Preview | G3 รอ | เปิด PR (derived จาก currentRole/awaiting-you, ไม่ต้องสั่งเอง) |
| DONE | Staging | post-G3 + G4 รอ | `ticket-sync set <id> --state Done` ตอน ticket ยัง `AWAITING_GATE` (= `complete()`) |
| releasedAt stamped | Production | post-G5 | `ticket-sync release <id>` ตอน promote prod |

> "Status เปลี่ยนที่ env ไหน?" → **state เปลี่ยนที่ git event (global)** · `releasedAt` ติดตอน **promote ขึ้น prod** เท่านั้น

## ปัญหาเดิม (ก่อนแก้ — บริบททางประวัติศาสตร์)

ยุค Linear ไม่มี **executable mechanism** ที่ push เข้า Linear ได้เอง (ต้องพึ่ง MCP มือในเซสชัน) และ state/label เป็นอิสระต่อกัน (Linear ตั้ง `Done` เองแบบสุ่มผ่าน GitHub automation, gate เป็นแค่ label ที่ไม่มีอะไรบังคับ) — ดู ADR-010 Context เต็ม ๆ ที่ `docs/adr/ADR-010-self-hosted-delivery-tickets.md`. Epic CAM-276 แก้ทั้งสองปัญหาด้วยการมี state machine + database เป็นของเราเอง.

## กลไกปัจจุบัน: `scripts/ticket-sync.mjs` (HTTP client เหนือ `/api/tickets/*`, ใช้ `STATUS_TOKEN`)

รันได้จาก orchestrator / CI / hook / cron — เป็น thin client เท่านั้น ไม่แตะ Prisma ของ delivery DB ตรง ๆ:

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run tickets:list` (= `node scripts/ticket-sync.mjs list`) | list งานทั้งหมด (จัดกลุ่มตาม epic) |
| `npm run tickets:gates` (= `... gates`) | **สัญญาณ gate** — ticket ไหน `AWAITING_GATE` (รอคุณ) vs `changesRequested=true` (reject แล้ว, พร้อมทำต่อ → exit 10) |
| `npm run tickets:pull` (= `... pull`) | ดึง ticket DB → `.claude/linear-snapshot.json` |
| `node scripts/ticket-sync.mjs set CAM-7 --state "In Progress"` | map legacy state name → guarded verb (`start`/`approve`/`complete`/`cancel`/`reopen`) |
| `... set CAM-11 --add-label awaiting-you` / `--remove-label` | map legacy label → verb (`raiseGate`/`approve`/`release`/`setBlocked`/`updateFields`) |
| `... handoff CAM-7 --role backend-engineer [--state "In Progress"]` | เปลี่ยน `currentRole` + push `roleHistory` + แจ้ง Telegram ในคำขอเดียว |
| `... create --type epic\|story\|task --title "..." [--epic <id>] [--role r] [--persona p] [--feature "name"]` | สร้าง ticket ใหม่ (แทนที่ Linear MCP `save_issue`/`save_project`) |
| `... comment CAM-7 --body "..."` / `... show CAM-7` | เขียน/อ่าน comment + `TicketEvent` history (แทนที่ Linear MCP `list_comments`/`get_issue`) |
| `... audit` | ตรวจ template + artifact ↔ `roleHistory` consistency (exit 11 ถ้าไม่ผ่าน) |
| `... release CAM-7` | stamp `releasedAt` (state ยัง `DONE`) |

ตารางแปลง legacy vocabulary → guarded verb เต็ม ๆ อยู่ที่ `scripts/lib/ticket-sync-mapping.mjs` (unit tested).

## Closed loop เต็ม

```
1. requirement ─▶ orchestrator (Discovery) ─▶ สร้าง ticket ทันที (intake, ticket-sync create)
                                                     │  ← "เพิ่ม requirement/replan" = สร้าง/แก้ ticket ที่นี่
2. agent ทำงาน ─▶ orchestrator: ticket-sync set <id> --state "In Progress"/"Done"  ──▶ DELIVERY TICKET DB (SoT)
3. ถึง gate มนุษย์ ─▶ ticket-sync set <gate> --add-label awaiting-you (= raiseGate) + Gate Review Packet comment
                                                     │
4.            👤 คุณ review → Telegram tap / `/status` Approve / `/status/map` Approve = approve() (หรือ Reject = reject())
                                                     │
5.  ┌─ WATCHER เห็นสัญญาณ (ticket-sync gates → ticket ออกจาก AWAITING_GATE) ─┐
    │   trigger ได้ 3 ทาง:                                                    │
    │   (a) คุณพิมพ์ในเซสชัน "approved / ไปต่อ" → orchestrator poll gates แล้วเดินต่อ │
    │   (b) /loop ทุก N นาที รัน gates → cleared (changesRequested) → resume เอง   │
    │   (c) repository_dispatch (`gate-approved`) จาก approve() ตรง ๆ            │
    └──────────────────────────────────────────────────────────────────────┘
                                                     │
6. orchestrator spawn agent stage ถัดไป → set state → (วน 2)
                                                     ▼
            DASHBOARD /status อ่าน ticket DB สด (pulse-keyed cache) — เห็นการเปลี่ยนแทบทันที ✅
```

## ตอบ: "approve แล้วรู้ได้ยังไงว่าไปต่อ"

**Convention:** gate ที่รอคุณ = ticket state `AWAITING_GATE` (เทียบเท่า legacy label `awaiting-you`) → คุณ **approve/reject ผ่าน Telegram tap, `/status` UI, หรือ `/status/map`** = อนุมัติ/ตีกลับ

**Detection:** `node scripts/ticket-sync.mjs gates` แปลงสัญญาณนั้นเป็นผลลัพธ์ machine-readable:
- ยัง `AWAITING_GATE` → แสดง `⏳ WAITING-ON-YOU` (exit 0)
- `reject()` แล้ว (`changesRequested=true`, กลับมา `IN_PROGRESS` ให้ role เดิมแก้) → แสดง `🔁 CLEARED → CONTINUE` (**exit 10**) — role ที่ถูกมอบหมายควรทำงานต่อ
- `approve()` แล้ว (`changesRequested=false`, กลับมา `IN_PROGRESS`) — ไม่มี bucket แยกใน `gates` (ต่างจาก legacy) เพราะ ADR-010: `approve`/`complete` เคลียร์ gate + เดิน state + ยิง `repository_dispatch` **ในธุรกรรมเดียวกัน** ไม่มีช่วงที่ ticket "cleared แต่ค้าง" แบบ Linear เดิม (root cause ของปัญหาเดิมที่ทำให้ต้อง poll หา limbo นั้นหายไปเอง)

ความจริงที่ต้องเข้าใจ: **orchestrator ไม่ใช่ daemon ที่รันค้าง** การจะ "รู้เอง" ต้องมีตัว **poll** —
- **ตอนนี้ (manual, ในเซสชัน):** คุณ approve แล้วบอกในเซสชัน "ไปต่อ" → orchestrator รัน `ticket-sync gates` ยืนยัน แล้วเดินต่อ
- **อัตโนมัติ:** ตั้ง `/loop 10m` หรือ `/schedule` ให้ orchestrator รัน `ticket-sync gates` เป็นรอบ → เจอ exit 10 (reject-resume) หรือ `repository_dispatch` มาเอง (approve) → เดินต่อไม่ต้องรอคุณพิมพ์

## Real-time mode (in-process, ไม่มี webhook) — เปลี่ยนจาก Linear webhook เดิม

```
เจ้าของ approve/reject (Telegram tap / `/status` UI / `/status/map`)
        │  → POST /api/status/approve หรือ /api/status/reject (Vercel)
        ▼
lib/delivery/tickets.ts's approve()/reject() ──▶ (1) เขียน Ticket + TicketEvent ($transaction)
                                                  (2) bump DeliveryPulse.version
                                                  (3) ยิง Telegram (buildEventMessage)
                                                  (4) (เฉพาะ approve) ยิง repository_dispatch
                                                       event_type="gate-approved"
        │
        ▼
GitHub Action .github/workflows/gate-continue.yml
   → node scripts/ticket-sync.mjs gates  (ยืนยัน exit 10 = cleared จริง)
   → claude -p (headless orchestrator) เดิน stage ถัดไป → **draft PR เท่านั้น ห้ามแตะ main** → update ticket DB
```

ไฟล์หลัก: `lib/delivery/tickets.ts` (mutation + notify + dispatch ในที่เดียว) · `app/api/status/approve/route.ts` · `app/api/status/reject/route.ts` · `app/api/telegram-webhook/route.ts` (Telegram Approve/Reject tap) · `.github/workflows/gate-continue.yml` (เดิมชื่อ `linear-continue.yml` / event `linear-gate-approved` — เปลี่ยนชื่อใน `chore/retire-linear-sync` หนึ่งรอบหลัง cutover) · `.github/workflows/camper-adhoc.yml` (ad-hoc `/camper` request, ไม่ผูก gate). **ไฟล์ที่ถูกลบไปแล้ว:** `app/api/linear-webhook/route.ts` (Linear event webhook, retired T-5b/CAM-281 — ไม่มีอีกต่อไปในโค้ด), `scripts/linear-sync.mjs` (deprecated legacy Linear writer, retired ใน `chore/retire-linear-sync`).

### ⚠️ ช่องว่างที่พบระหว่างเขียนเอกสารนี้ใหม่ (T-6) — SSE auto-refresh ยังผูกกับ pulse ยุคเก่า

`app/api/status/stream/route.ts` (SSE ที่ดัน "refresh" ให้ browser ที่เปิด `/status` ค้างอยู่) ยังอ่าน `lib/status-pulse.ts`'s `readPulse()` — นั่นคือ `StatusPulse` model ใน **product schema** (`prisma/schema.prisma`, database คนละตัวกับ delivery ticket DB) ไม่ใช่ `lib/delivery/pulse.ts`'s `DeliveryPulse` (delivery schema) ที่ `lib/delivery/tickets.ts` bump จริงตอนมี mutation. ผลคือ:

- **ข้อมูลที่ dashboard ดึงเอง (list read) ถูกต้องและสดจริง** — `lib/delivery/status-adapter.ts`'s `unstable_cache` รับ `pulse` (จาก `readDeliveryPulse()`) เป็น argument ซึ่ง Next.js เอาไปรวมเป็นส่วนหนึ่งของ cache key เอง ทำให้พอ pulse ขยับ การอ่านครั้งถัดไปได้ข้อมูลใหม่ทันที ไม่ต้องรอ 60s เต็ม ๆ และไม่ต้องพึ่ง webhook
- **แต่ SSE "ดันให้ browser ที่เปิดค้างอยู่ refetch เอง" ยังไม่ทำงานกับ mutation ใหม่** — เพราะมันฟัง pulse คนละตัว (ของ product DB เดิม ที่ไม่มีอะไรมา bump แล้วนอกจาก legacy `POST /api/status/pulse`, ซึ่งไม่มีอะไรเรียกใช้อีกต่อไปแล้วหลัง `scripts/linear-sync.mjs` ถูกลบใน `chore/retire-linear-sync`). ผู้ใช้ที่เปิด `/status` ค้างไว้จะไม่เห็น auto-refresh ทันทีที่มี ticket ใหม่เปลี่ยนสถานะ (ต้อง refresh มือ หรือรอ 60s cache หมดอายุตามการ poll ปกติของ browser)
- **นี่คือ gap จริงที่ตรวจสอบโค้ดแล้วยืนยัน ไม่ใช่แค่คาดเดา** — ยังไม่มี story ไหนแก้ (T-0..T-6 ไม่มีสโคปนี้). แก้ได้โดยเปลี่ยน `app/api/status/stream/route.ts` ให้อ่าน `readDeliveryPulse()` แทน (หรือรวมสัญญาณทั้งสอง pulse) — เป็น follow-up ticket ที่แนะนำ ไม่ใช่ scope ของ T-6 (docs/convention only)

## Rollback levers (retired — เก็บไว้ตามแผน ADR-010 หนึ่ง cycle, ถอดแล้วใน `chore/retire-linear-sync`)

| Lever | สถานะ | เคยใช้ทำอะไร |
|---|---|---|
| `TICKETS_SOURCE` env | **ถอดแล้ว** — `lib/linear.ts`'s `fetchStatusIssues()` อ่านจาก delivery ticket DB (`lib/delivery/status-adapter.ts`) เสมอ ไม่มี branch แล้ว | เดิม: unset/`"db"` = อ่านจาก delivery ticket DB · `"linear"` = อ่านจาก Linear ผ่าน `lib/linear.ts` (fallback ถ้า delivery DB มีปัญหา) |
| `scripts/linear-sync.mjs` | **ลบไฟล์แล้ว** | เดิม: เขียนเข้า Linear โดยตรง (ใช้ตอน dual-mode T-5a เท่านั้น) — rollback lever ของฝั่งเขียน คู่กับ `TICKETS_SOURCE=linear` ฝั่งอ่าน |
| Linear MCP (`.mcp.json`) | ยังต่ออยู่ (ไม่ใช่ rollback lever ของ cutover นี้) | อ่านประวัติ 275+ ใบเก่า (archive) เท่านั้น ไม่มีกำหนดถอด แต่ **ห้ามเขียน** ผ่านทางนี้อีก |

## Import / parity tooling (บันทึกการย้ายข้อมูล)

- **`scripts/import-linear.mjs`** (T-4, CAM-280) — นำเข้า 275+ Linear issue เดิมเข้า delivery ticket DB ครั้งเดียว (idempotent, ปลอดภัยรันซ้ำ); map field ทุกตัวตาม ADR-010 "StatusIssue coverage" table; ของที่ map ไม่ได้ (label แปลก ๆ) เก็บลง `legacyLabels[]`/`legacyUrl` ไม่ทิ้ง
- **`scripts/parity-check.mjs`** (T-4) — เทียบจำนวน/สถานะ Linear vs delivery DB หลัง import (ดู `docs/specs/self-hosted-delivery-tickets/parity-report-2026-07-03.md` — 223/223 ตรงกัน, benign delta มีบันทึกไว้)
- ทั้งสองไฟล์เป็น **บันทึกการย้ายข้อมูล (migration record)** เก็บไว้เพื่อ reproducibility/audit ไม่ใช่เครื่องมือที่ใช้ประจำวันอีกต่อไป (ใช้ครั้งเดียวตอน T-4)

## วินัย orchestrator (กฎตายตัว — กัน "ลืม sync")

ทุก transition ต้องลงด้วยคำสั่งจริง ไม่ใช่แค่จำ:
- intake → สร้าง ticket (`ticket-sync create`) + ใส่ persona/feature
- เริ่มงาน → `set <id> --state "In Progress"`
- เสร็จ → `set <id> --state Done` (ต้องยังอยู่ `AWAITING_GATE` — ดูคำเตือนเรื่อง `complete()` ด้านบน)
- ถึง gate → `set <gate> --add-label awaiting-you` (= `raiseGate`)
- หลัง gate ผ่าน → ตรวจ `ticket-sync gates` → เดินต่อ
- (option) hook เตือนตอน Stop ถ้ามี transition ที่ยังไม่ push

## อะไรอัตโนมัติ / อะไรยัง manual (สรุปตรง ๆ)

| ขั้น | สถานะ |
|---|---|
| Dashboard อ่าน ticket DB สด (list read) | ✅ อัตโนมัติ (pulse-keyed cache, ≤60s) |
| Push สถานะเข้า ticket DB | ✅ มีกลไกแล้ว (CLI + service module) — orchestrator/CI เรียก |
| SSE auto-refresh ดัน browser ที่เปิดค้าง | ⚠️ **ยังผูกกับ pulse ยุคเก่า** (ดู "ช่องว่างที่พบ" ด้านบน) — ยังไม่แก้ |
| PR merge → Done | manual (`set --state Done`) หรือผูก CI ในอนาคต — ยังไม่มี GitHub↔ticket-DB auto-sync แบบที่ Linear เคยมี |
| approve → ไปต่อ | ⚡ **real-time** (in-process notify + dispatch ด้านบน) หรือ 🔁 manual/`/loop` |

## Reference Files

- `docs/adr/ADR-010-self-hosted-delivery-tickets.md` — state machine เต็ม, atomic columns, alternatives ที่ปฏิเสธ
- `lib/delivery/PORTABILITY.md` — manifest ก็อปปี้ระบบนี้ไปโปรเจกต์ใหม่
- `scripts/ticket-sync.mjs` (usage header) + `scripts/lib/ticket-sync-mapping.mjs` (ตาราง legacy→verb เต็ม)
- `.claude/commands/camper.md` — Ticket delivery convention (epic/story/role/persona) เต็ม ๆ
- `docs/specs/self-hosted-delivery-tickets/` — feature/epic rollup ของ epic นี้ทั้งหมด (T-0..T-6)
