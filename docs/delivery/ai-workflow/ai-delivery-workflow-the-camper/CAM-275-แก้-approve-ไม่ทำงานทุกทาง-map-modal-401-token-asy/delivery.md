---
linear: CAM-275
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: platform
artifact: delivery
owner: devops-release
status: Done
version: v1
updated: 2026-07-03
---
# Delivery — CAM-275 แก้ approve ไม่ทำงานทุกทาง

## Root causes (3 ชั้น — ทั้งหมดยืนยันด้วย probe/log จริง)
1. **Token asymmetry (regression จาก CAM-215):** `STATUS_TOKEN` ไม่ได้ตั้งบน staging (ตัวแปรมีแต่ค่าใช้ไม่ได้) + API approve/reject/issue = default-deny แต่หน้า /status, /status/map, /status/map/data = default-open → เห็นปุ่ม/modal แต่ทุก mutation 401.
2. **`looksApproved` เป็นจริงไม่ได้เลย (บั๊กตั้งแต่ CAM-184):** `isGate` เช็ค label id เก่ากับ**รายการ label ปัจจุบัน** — ตอน approve ป้าย awaiting-you เพิ่งหลุดจากรายการปัจจุบัน → เงื่อนไข false เสมอ → ข้อความ "Approved" + `repository_dispatch` **ไม่เคยยิงมาก่อนเลย** จากทุกช่องทาง.
3. **ล้มเหลวเงียบ:** `fireDispatch`/`sendTelegram` ไม่ log อะไรเมื่อพลาด → มองไม่เห็นจากภายนอก.

## Fix (2 PRs)
- **PR #282 (part 1):** `lib/status-auth.ts` helper เดียว, default-deny สมมาตรทั้ง **9** surface (2 pages + data + approve/reject/issue + pulse/stream/version), dev exception (NODE_ENV=development), หน้าแจ้ง `ลิงก์ไม่ถูกต้อง...` แทนปุ่มผี, structured logs `gate_dispatch_failed`/`telegram_send_skipped`. 43 guard tests.
- **PR #283 (part 2):** detection ใหม่ — diff prevLabelIds − currentIds = removedIds แล้ว resolve id ของ `awaiting-you` ผ่าน `getLabelIdByName` (extract จาก addLabel, reuse); `looksApproved = awaitingRemoved && !changes-requested`; lookup พลาด → log `gate_detect_label_lookup_failed` (webhook คง 200). +tests (รวม 4,587 ผ่าน).
- **Config (owner):** ตั้งค่าใหม่ให้ `STATUS_TOKEN`, `GITHUB_REPO`, `GH_DISPATCH_TOKEN` (fine-grained PAT, Contents RW) บน Vercel Preview.

## E2E evidence (staging จริง, 2026-07-03)
- ไม่มี token → หน้าโดนบล็อกพร้อมข้อความ ✓ · token ถูก → เข้าได้ ✓
- **เส้นปุ่ม map/modal:** POST approve → `200 approved:true` → label หลุด → webhook จับได้ → **repository_dispatch run "Linear → continue (real-time)" completed success** (08:46) ✓
- **เส้น Telegram:** owner กด Approve จริง → `POST /api/telegram-webhook 200` (08:47:54) → label หลุด → **dispatch run ที่สอง** (08:47:59) ✓
- ข้อความ Approved ส่งเข้า Telegram โดย linear-webhook (single source) ✓

## Ship
- PRs: #282 (merged 08:16Z, `c203ffb`) + #283 (merged 08:41Z, `f3b0ec0`) → staging. G3 approved โดย owner ทั้งสอง PR.
- prod ยังไม่ปล่อย (COMING_SOON gate ปิด /api ทั้งหมดบน prod อยู่แล้ว — webhooks ชี้ staging จนกว่า full-launch แล้วต้องตั้ง env ชุดเดียวกัน + ย้าย webhook).

## Operational notes
- URL หน้า status ต้องมี `?token=` เสมอ (ลิงก์จาก Telegram ใส่ให้อัตโนมัติ) — owner อัปเดต bookmark แล้ว.
- `linear-sync set --label` ไม่ append label ให้จริง (คืน "already in sync") — ใช้ MCP `save_issue` สำหรับเพิ่ม label; ควรแก้ใน iteration ถัดไป.
- Linear GitHub automation ปิด issue เป็น Done เองเมื่อ PR ที่ผูก merge — ระวังอ่านสถานะ.
