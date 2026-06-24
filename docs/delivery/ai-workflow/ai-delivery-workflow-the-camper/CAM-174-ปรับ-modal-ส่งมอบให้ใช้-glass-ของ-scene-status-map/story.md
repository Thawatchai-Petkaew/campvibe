---
linear: CAM-174
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: platform
artifact: story
owner: product-owner
status: Backlog
version: v1
updated: 2026-06-24
---
# ปรับ modal ส่งมอบให้ใช้ glass ของ scene /status/map (เหมือนการ์ด Backlog/ภาพรวม) (CAM-174)

## ทำไม

[CAM-173](https://linear.app/campvibe/issue/CAM-173/devops-release-ปรบ-modal-สงมอบสำเรจ-ใหเขา-design-system-การด-list-cam) ทำให้ modal ส่งมอบใช้ design-system หลัก (พื้นขาว) ซึ่งตีกับ scene กองไฟของ /status/map ที่เป็นโทนเข้ม เจ้าของต้องการให้ **align กับ CSS ของหน้า /status/map เอง** — ใช้ glass แบบเดียวกับ **การ์ด Backlog / ภาพรวม (Overview)** บนหน้านั้น
**KPI:** modal + การ์ด ใช้ glass treatment เดียวกับ panel อื่นบน /status/map กลมกลืน ไม่ใช่พื้นขาว DS และไม่ทึบแบบสแลปเดิม

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **modal "ส่งมอบสำเร็จ" และการ์ดข้างใน ใช้ glass แบบเดียวกับการ์ด Backlog/ภาพรวม บน /status/map** เพื่อ **ให้กลมกลืนกับ scene ทั้งหน้า ไม่หลุดธีม**
ขอบเขต: restyle เฉพาะ surface ของ modal + delivery cards ใน `delivery-gift.tsx` ให้ใช้ scene CSS (glass tokens) ตาม `campsite-overlays.tsx` (Backlog/Overview panels); คง card-list + decode + logic + gift button เดิม

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น (copy ไทยจริง) | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | มี delivery ที่ยังไม่ดู | เปิด modal | surface เป็น glass โทนเข้มโปร่ง (เบลอพื้นหลัง + ขอบบาง green-tint + เงานุ่ม) เหมือนการ์ด Backlog/ภาพรวม ไม่ใช่พื้นขาว และไม่ทึบ | ไม่เปลี่ยน data |
| 2 | modal เปิด | ดูรายการ | แต่ละงานส่งมอบเป็นการ์ด glass สไตล์เดียวกับ Backlog item (accent ทอง/เขียวของ scene) | อ่าน MapModel เดิม |
| 3 | พื้นเข้ม | อ่านข้อความ | ตัวอักษรใช้สีของ scene (สว่าง/มิวต์) อ่านชัดบน glass | — |
| 4 | ดูแล้วปิด | กดปิด/การ์ด | mark seen → gift หาย → view-once เดิม | localStorage seen เดิม |
| 5 | a11y/responsive | เปิด modal | ปุ่มปิด 44px, focus trap, decode title, ไม่มี CLS/อีโมจิ คงเดิม | — |

## Rules

* ใช้ **scene CSS tokens เท่านั้น** (`var(--glass)`, `--blur`, `--line`/`--line-2`, `--hi`, `--r`, `--text`, `--muted`, `--amber`, teal `#5BE9B0`) ตามที่ `campsite-overlays.tsx` + scene style block ใช้ — **ห้ามใช้ main DS tokens** (`bg-popover`/`bg-card`/`bg-foreground`)
* อ้างอิงการ์ด Backlog/Overview panel ใน `campsite-overlays.tsx` เป็นต้นแบบ glass (background rgba(11,30,24,.4x) + backdrop blur + ขอบ rgba(150,240,195,.1x) + radius + box-shadow inset highlight)
* คง logic `lib/map-delivery.ts` + gift button + decodeHtmlEntities เดิม (เปลี่ยนเฉพาะ surface/สไตล์)

## Out of scope

* logic/trigger/seen/pre-seed → คงเดิม
* gift button บนกองไฟ → คงเดิม

## Self-verify

- [ ] lint · typecheck · test (logic เดิม pass)
- [ ] a11y (44px, focus trap) + decode คงเดิม
- [ ] design: ใช้ scene glass ตรงกับ Backlog/Overview, check:palette + check:ds ผ่าน
- [ ] security: UI ล้วน ไม่มี dangerouslySetInnerHTML/PII
- [ ] verify Staging URL: /status/map → gift → modal glass กลมกลืนกับ scene

## Links

spec: [CAM-173](https://linear.app/campvibe/issue/CAM-173/devops-release-ปรบ-modal-สงมอบสำเรจ-ใหเขา-design-system-การด-list-cam) (over-corrected ไป DS ขาว), [CAM-171](https://linear.app/campvibe/issue/CAM-171/devops-release-การดของขวญ-สงมอบสำเรจ-บนกองไฟ-statusmap-กดดครงเดยว) · ref: app/status/map/campsite-overlays.tsx (Backlog/Overview glass) + campsite-scene.tsx (scene tokens) · design: DESIGN.md
