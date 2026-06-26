---
linear: CAM-181
feature: ai-workflow
epic: campsite-delivery-map-status-map (CAM-150)
persona: platform
artifact: story
owner: product-owner
status: Backlog
version: v1
updated: 2026-06-25
---
# เพิ่มหิ่งห้อยวูปวาปเล็กๆ บน scene /status/map (ambient) (CAM-181)

## ทำไม

เจ้าของอยากเพิ่มบรรยากาศกลางคืนให้ scene กองไฟ /status/map ด้วยหิ่งห้อยดวงเล็กๆ ที่วูปวาบ (กระพริบเบาๆ ติด-ดับ) เพื่อให้ฉากมีชีวิตชีวาขึ้น เป็นรายละเอียด ambient

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **เห็นหิ่งห้อยดวงเล็กๆ วูปวาบลอยอยู่ใน scene กองไฟ** เพื่อ **บรรยากาศกลางคืนดูมีชีวิตและน่าดูขึ้น**
ขอบเขต: เพิ่ม layer หิ่งห้อย (decorative) บน /status/map scene; เป็น ambient อย่างเดียว ไม่กระทบ data/interaction/agent/gift/HUD

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | เปิด /status/map | ดู scene | เห็นหิ่งห้อยดวงเล็กๆ หลายดวง วูปวาบ (จางเข้า-ออก) กระจายในฉาก ไม่เด่นเกินไป | decorative layer เท่านั้น |
| 2 | เปิดเครื่องที่ตั้ง reduced-motion | ดู scene | ไม่กระพริบถี่/แสบตา (ลดหรือคงที่ตาม prefers-reduced-motion) | a11y ผ่าน |
| 3 | กดตัวละคร/กล่องของขวัญ/ปุ่ม HUD | คลิกผ่านบริเวณหิ่งห้อย | คลิกทะลุได้ปกติ หิ่งห้อยไม่บัง | pointer-events: none |
| 4 | scene โหลด | render | ไม่มี layout shift, ไม่กระทบ perf (CSS animation) | ไม่ใช่ rAF/JS หนัก |

## Rules (design จะ refine ที่ G2 — เจ้าของเลือก)

* decorative layer, `pointer-events: none`, z-index ต่ำกว่า characters/gift/HUD (เป็น background ambiance) — **ยกเว้นถ้าเจ้าของเลือกให้ลอยหน้า** (กำหนดที่ G2)
* dark-safe, ไม่มี emoji, ใช้ CSS animation (opacity twinkle) ไม่ใช่ JS per-frame; เคารพ `prefers-reduced-motion`
* ไม่แตะ engine/agent/gift/modal/data · สี/จำนวน/ขนาด/การเคลื่อนไหว = decision ที่ G2 (เจ้าของเลือก)

## Data

* ไม่มี data/migration (decorative CSS/markup ล้วน)

## Out of scope

* interaction กับหิ่งห้อย (คลิก/hover) · หิ่งห้อยที่ผูกกับ data

## Self-verify

- [ ] lint · typecheck · test · build · check:palette · check:ds
- [ ] a11y: prefers-reduced-motion เคารพ, pointer-events none
- [ ] verify staging /status/map: เห็นหิ่งห้อยวูปวาบ ไม่บังคลิก ไม่กระพริบแสบตา

## Links

ref: app/status/map/campsite-scene.tsx (SCENE_CSS, .scout-layer/.map-wrap) · DESIGN.md (motion/a11y) · scene tokens (--amber, etc.)
