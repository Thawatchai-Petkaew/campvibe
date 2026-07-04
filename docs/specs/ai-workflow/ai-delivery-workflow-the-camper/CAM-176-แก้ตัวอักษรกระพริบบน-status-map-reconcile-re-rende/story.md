---
linear: CAM-176
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: platform
artifact: story
owner: product-owner
status: Backlog
version: v1
updated: 2026-06-25
---
# แก้ตัวอักษรกระพริบบน /status/map (reconcile re-render ทุก 15s แม้ข้อมูลไม่เปลี่ยน) (CAM-176)

## ทำไม

ตัวอักษร/การ์ดบน /status/map กระพริบเป็นจังหวะบน Staging/Prod (Local ไม่เป็น) สาเหตุ: `campsite-scene.tsx` reconcile (poll ทุก 15s + SSE) เรียก `setLiveModel(next)` **ทุกครั้งแม้ payload เดิมเป๊ะ** → React re-render ทั้ง scene → CSS animation บน text (badge ของ agent) restart + `summaryStats` (คำนวณจาก `Date.now()`) คิดใหม่ → เห็นเป็นการกระพริบ
**ทำไม Local ไม่เป็น:** Local ไม่มี webhook + ข้อมูลนิ่ง/ว่าง → ค่าที่ render เหมือนเดิม ไม่สะดุดตา · Staging/Prod มีข้อมูลจริง + reconcile ถี่ ([CAM-175](https://linear.app/campvibe/issue/CAM-175/devops-release-ปรบ-board-statusmap-ลงเลนใหถก-qasecurityรออนมต-ตรวจสอบ) ลด 60s→15s) → เห็นชัด 4×
**KPI:** board นิ่ง ไม่กระพริบเมื่อข้อมูลไม่เปลี่ยน · ยังอัปเดตทันทีเมื่อข้อมูลเปลี่ยนจริง (คงความสดจาก [CAM-175](https://linear.app/campvibe/issue/CAM-175/devops-release-ปรบ-board-statusmap-ลงเลนใหถก-qasecurityรออนมต-ตรวจสอบ))

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **board /status/map ที่นิ่งไม่กระพริบเมื่อไม่มีอะไรเปลี่ยน** เพื่อ **ดูสถานะได้สบายตา ไม่ล้า**
ขอบเขต: ใส่ guard ใน reconcile() ให้ข้าม `setLiveModel` เมื่อ payload ที่ดึงมาเท่ากับของเดิม (เทียบ JSON ดิบ); ไม่แตะ interval/SSE/logic อื่น; ไม่เปลี่ยน visual

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น (copy ไทยจริง) | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | เปิด /status/map ค้างไว้ ไม่มีงานเปลี่ยน | รอ ผ่านหลายรอบ poll | board นิ่ง ตัวอักษร/การ์ดไม่กระพริบ | reconcile ที่ payload เดิม → ไม่ setLiveModel → ไม่ re-render |
| 2 | มีงานเปลี่ยนสถานะจริง (เช่น handoff) | poll/SSE รอบถัดไป | board อัปเดตตามจริงภายในไม่กี่วินาที (คงความสด) | payload ต่าง → setLiveModel → update |
| 3 | fetch /status/map/data ล้มเหลวชั่วคราว | poll | คงข้อมูลล่าสุด ไม่ค้าง/ไม่จอเปล่า | catch เดิมคงไว้ |

## Rules

* ใน `app/status/map/campsite-scene.tsx` reconcile(): เก็บ JSON string ของ payload ล่าสุด (`useRef`, init = `JSON.stringify(model)`) → ถ้า `res.text()` เท่าเดิม **return** ก่อน setLiveModel; ถ้าต่าง ค่อย `setLiveModel(JSON.parse(...))` + อัปเดต ref
* คง interval (15s) / SSE / backoff / error-catch เดิมทั้งหมด (ไม่ revert [CAM-175](https://linear.app/campvibe/issue/CAM-175/devops-release-ปรบ-board-statusmap-ลงเลนใหถก-qasecurityรออนมต-ตรวจสอบ))
* ไม่เปลี่ยน visual/animation/lane/สี · ไม่แตะ data route / MapModel / fetch logic
* แยก helper บริสุทธิ์เล็กๆ ถ้าช่วยให้ unit-test ได้ (เช่น เทียบ payload)

## Data

* ไม่มี data/API/migration เปลี่ยน (frontend render guard ล้วน)

## Out of scope

* memoize summaryStats / refactor AgentScout (guard ตัด no-op re-render ที่ต้นทางแล้ว ไม่ต้อง)
* เปลี่ยน interval/SSE infra

## Self-verify

- [ ] lint · typecheck · build · check:palette · check:ds
- [ ] test: reconcile ข้าม setLiveModel เมื่อ payload เดิม / setLiveModel เมื่อต่าง (helper หรือ source-inspection)
- [ ] regression: ทั้งชุดเขียว
- [ ] verify Staging /status/map: เปิดค้าง ~1 นาที ไม่กระพริบ; เปลี่ยนงานจริง → ยังอัปเดต

## Links

ref: app/status/map/campsite-scene.tsx (reconcile ~1377-1395, summaryStats ~1049-1088) · เกี่ยวกับ [CAM-175](https://linear.app/campvibe/issue/CAM-175/devops-release-ปรบ-board-statusmap-ลงเลนใหถก-qasecurityรออนมต-ตรวจสอบ) (ลด interval ทำให้เห็นชัดขึ้น)
