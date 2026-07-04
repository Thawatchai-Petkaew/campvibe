---
linear: CAM-275
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: platform
artifact: story
owner: product-owner
status: Done
version: v1
updated: 2026-07-03
---
# แก้ approve ไม่ทำงานทุกทาง (map/modal 401 token asymmetry + dispatch ล้มเหลวเงียบ) (CAM-275)

## Why

Owner กด Approve จากหน้า /status/map, modal รายการรออนุมัติ, และ Telegram แล้วไม่ทำงาน. Investigation (ground truth): (1) `STATUS_TOKEN` ไม่ได้ตั้งบน staging + [CAM-215](https://linear.app/campvibe/issue/CAM-215/backend-engineer-sec-a-access-control-same-origin-redirect-status) ทำ API approve/reject/detail เป็น default-deny แต่หน้า map/data เป็น default-open → เห็นปุ่มแต่ทุก mutation 401. (2) `fireDispatch` ใน linear-webhook ล้มเหลวเงียบ (GITHUB_REPO/GH_DISPATCH_TOKEN ไม่ตั้ง/พลาด → คืน dispatched:false โดยไม่ log) → approve แล้ว orchestrator ไม่ continue. (3) Telegram tap ไม่พบใน log 7 วัน — ต้องทดสอบสดหลังแก้. KPI: อนุมัติจากทุกทางแล้วเกิดผลจริงครบ chain (label หลุด, แจ้งกลับ, dispatch ยิง).

## Story

ในฐานะเจ้าของแพลตฟอร์ม ฉันต้องการกดอนุมัติงานจากหน้าสถานะหรือจาก Telegram แล้วระบบเดินต่อให้จริงทุกครั้ง เพื่อคุมงานของทีมได้โดยไม่ต้องเข้าไปแก้ใน Linear เอง. (ขอบเขต: helper token กลาง + ปรับ 6 surface ให้สมมาตร + log ความล้มเหลวของ dispatch/notify; ไม่แตะ logic Linear/notify เดิม)

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล |
| -- | -- | -- | -- | -- |
| 1 | ไม่มี token หรือ token ผิด (บน staging/prod) | เปิดหน้าสถานะ/แผนที่สถานะ | หน้าแจ้ง `ลิงก์ไม่ถูกต้อง เปิดผ่านลิงก์จาก Telegram` ไม่เห็นข้อมูล/ปุ่ม | ทุก surface ปฏิเสธเหมือนกัน ไม่มีปุ่มผี |
| 2 | เปิดด้วยลิงก์ที่มี token ถูก | กดอนุมัติจากการ์ด/modal | อนุมัติสำเร็จ + ป้ายรออนุมัติหายไป | awaiting-you ถูกเอาออกใน Linear + dispatch ยิง |
| 3 | กด Approve ใน Telegram | ระบบรับ | ปุ่มตอบรับ + ข้อความยืนยันตามมา | webhook 200, label หลุด, dispatch ยิง |
| 4 | dispatch/แจ้งเตือนล้มเหลว | เกิด error | ไม่เงียบ | log JSON structured ใน Vercel (ไม่มี secret) |
| 5 | รันบนเครื่อง dev | เปิดหน้าโดยไม่มี token | เปิดได้ปกติ | dev exception (NODE_ENV=development) |

## Rules

* helper เดียว `lib/status-auth.ts` ใช้ทั้ง 6 surface (2 pages + data + approve/reject/issue APIs); default-deny เมื่อ STATUS_TOKEN ไม่ตั้ง (ยกเว้น development).
* ห้ามใส่ token ลง log/response.
* อัปเดต guard tests เดิม ([CAM-215](https://linear.app/campvibe/issue/CAM-215/backend-engineer-sec-a-access-control-same-origin-redirect-status)/184) ให้ตรงพฤติกรรมใหม่ + test ใหม่สำหรับ helper/log.

## Data

* ไม่มี migration. Config: ตั้ง STATUS_TOKEN, GITHUB_REPO, GH_DISPATCH_TOKEN บน Vercel Preview (owner).

## Out of scope

* ย้าย webhook ไป prod (รอ full-launch) · rework UI ปุ่มสองจังหวะ.

## Self-verify

* lint/typecheck/test/build เขียว · E2E บน staging: no-token บล็อก, token ถูกอนุมัติได้จริง, Telegram tap 200, เห็น repository_dispatch run

## Links

* Epic [CAM-138](https://linear.app/campvibe/issue/CAM-138/ai-delivery-workflow-the-camper) · เกี่ยวข้อง [CAM-215](https://linear.app/campvibe/issue/CAM-215/backend-engineer-sec-a-access-control-same-origin-redirect-status) (SEC-A ต้นเหตุ asymmetry), [CAM-184](https://linear.app/campvibe/issue/CAM-184/qa-engineer-approvereject-งานจากหนา-statusmap-ไดจรง-detail-view-ปรบ-ui) (map approve), [CAM-237](https://linear.app/campvibe/issue/CAM-237/frontend-engineer-launch-1-coming-soon-holding-page-env-gated-flicker)/240 (COMING_SOON/proxy) · `app/api/status/*` · `app/api/linear-webhook/route.ts`
