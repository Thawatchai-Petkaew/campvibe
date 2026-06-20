---
name: update-status
description: อัปเดตสถานะ ticket ใน Linear (team Campvibe/CAM) แบบ atomic — เปลี่ยน state/label, ติด awaiting-you เมื่อถึง gate มนุษย์, log การตัดสินใจ, mark Done(staging)/released(prod). ใช้ทุกครั้งที่งานข้าม transition (เริ่ม/เปิด PR/merge→staging/ถึง gate/ปล่อย prod/gate fail). อย่าใช้สำหรับสรุปภาพรวมงานทั้งทีม (ใช้ /status), สร้าง issue ใหม่ตอน intake (ทำใน Discovery), หรือ promote/deploy ข้าม env (ใช้ /promote-release)
---
# update-status — บันทึก state transition ของ ticket ลง Linear ด้วยคำสั่งจริง (executable, ไม่ใช่แค่จำ)
อ่านก่อน: `ai-planning/SYNC-ARCHITECTURE.md` (Linear = SoT + closed loop), `std/ops.md` (Done vs Released, 3-env), `scripts/linear-sync.mjs` (usage header)

## Input / preconditions
- มี `LINEAR_API_KEY` ใน env (ไม่ผูก MCP) · team = `CAM` (override ด้วย `LINEAR_TEAM_KEY`)
- รู้ `<CAM-id>` ของ issue ที่จะเปลี่ยน (story = issue ที่ title มี `·`) และ transition ที่เพิ่งเกิด (git/gate event)
- **Linear = single source of truth** — ห้ามแก้ `STATUS.json`/`linear-snapshot.json` มือ (เป็น snapshot จาก `status:pull`)

## วิธีทำ — เลือก transition แล้วรันคำสั่งจริง
1. **เริ่มงาน** (post-G1/G2) → `node scripts/linear-sync.mjs set <CAM-id> --state "In Progress"`
2. **เปิด PR** (G3 รอ) → state `In Review` (Linear↔GitHub integration ทำเองถ้า branch = `gitBranchName` หรือใส่ `CAM-id`/`Closes CAM-id` ใน PR)
3. **Done** (= merge เข้า `staging` + quality-gate เขียว + migration staging ผ่าน + **verify AC บน Staging URL จริง**) → `node scripts/linear-sync.mjs set <CAM-id> --state Done --remove-label awaiting-you` (หรือปล่อย PR merge→`staging` trigger ผ่าน integration)
4. **Released** (= promote `staging`→`main` + prod deploy + smoke + tag + changelog ผ่าน /promote-release) → `node scripts/linear-sync.mjs release <CAM-id>` (= state Done + label `released`) — **`released` คือ label ไม่ใช่ state ใหม่**
5. **ถึง gate มนุษย์ G1-G5** → `node scripts/linear-sync.mjs set <gate-id> --add-label awaiting-you` + โพสต์ **Gate Review Packet** เป็น comment (G1 brief+gap · G2 spec+design · G3 PR diff+ผล gate+preview · G4 Staging URL+AC · G5 changelog+rollback)
6. **เช็คว่ามนุษย์ approve หรือยัง** → `npm run status:gates` (ยังมี `awaiting-you`=exit 0 รอ; ถอดแล้ว=`CLEARED → CONTINUE` **exit 10**)
7. **มนุษย์ approve** (ถอด `awaiting-you` ใน Linear) → `node scripts/linear-sync.mjs set <gate-id> --state Done` แล้ว spawn stage ถัดไป
8. **gate fail / bug หลัง deploy** → เปิด Linear issue ใหม่ + link กลับ ticket เดิม (เข้า loop)

## ต้องคำนึง
- **Done(staging) ≠ Released(prod)** — story หลายตัว Done (อยู่ Staging) ได้ก่อนรวมปล่อย prod เป็นรอบ; dashboard โชว์ 2 มิติ (state `Done` + label `released`)
- state เปลี่ยนที่ **git/gate event (global) ไม่ผูก env** · `released` ติดเฉพาะตอน promote ขึ้น prod เท่านั้น
- **gate = convention `awaiting-you`** — คุณถอด label ใน Linear = อนุมัติ; ห้าม spawn stage ถัดไปก่อน `status:gates` ยืนยัน exit 10
- ทุก transition ลงด้วยคำสั่งจริง (วินัย orchestrator กัน "ลืม sync") — ไม่ใช่แค่จำในหัว
- `--add`/`--remove` เป็น alias ของ `--add-label`/`--remove-label`; state ที่พิมพ์ผิดจะ error พร้อม list state ที่มี

## Output / postconditions
- Linear issue เปลี่ยน state/label ตาม transition (push เข้า SoT) → dashboard `/status` เห็นภายใน 60s
- gate ที่รอมนุษย์ติด `awaiting-you` + มี Gate Review Packet comment พร้อมตัดสินใจ
- story ที่ Done อยู่ Staging รอ G4; ที่ released อยู่ prod พร้อม tag
- การตัดสินใจ/เหตุผลถูก log เป็น comment บน issue (trace ได้)

## Verify
- `npm run status:linear` — ยืนยัน issue อยู่ state/label ที่ตั้งใจ
- `npm run status:gates` — exit 10 ก่อนเดินต่อ (gate cleared จริง), exit 0 = ยังรอมนุษย์
- `node scripts/linear-sync.mjs audit` — story issue ต้องมี `## Story` + `## AC` (exit 11 = template ผิด, แก้ก่อน handoff)
- (อัตโนมัติ) watcher ให้ orchestrator เดินต่อเองเมื่อ gate cleared: `/loop 10m npm run status:gates` หรือ `/schedule`
