---
linear: CAM-180
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: platform
artifact: story
owner: product-owner
status: Backlog
version: v1
updated: 2026-06-25
---
# กล่องของขวัญบนกองไฟ: ยก z-index เหนือตัวละคร + เลื่อนตำแหน่งลงนิด (CAM-180)

## ทำไม

กล่องของขวัญ (gift indicator) บนกองไฟ /status/map (1) ถูกตัวละคร (agent) ที่เดินผ่านบังทับ และ (2) เจ้าของอยากให้เลื่อนลงมาอีกนิดให้อยู่ตำแหน่งพอดีกับกองไฟ
สาเหตุการทับ: ใน `.scout-layer` เดียวกัน ตัวละครได้ z-index จาก engine `Math.round(pos.y * 12) + 5` (pos.y เป็น % 0-100) → ตัวแถวกองไฟ (y~44-52%) ได้ z-index ~530-630 (สูงสุด ~1205) แต่ `.delivery-gift-wrapper` มี z-index แค่ **25** → ตัวละครทับ. ตำแหน่งปัจจุบัน `top: 44%`

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **เห็นกล่องของขวัญอยู่เหนือตัวละครเสมอ และอยู่ตำแหน่งต่ำลงมาอีกนิด** เพื่อ **สังเกตการส่งมอบได้ชัด ไม่ถูกบัง และวางพอดีกับกองไฟ**
ขอบเขต: ยก z-index ของ gift wrapper เหนือ z-index สูงสุดของตัวละคร + เลื่อน `top` ลงเล็กน้อย; ไม่แตะขนาด/animation/logic/engine

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | มีกล่องของขวัญ + ตัวละครเดินผ่านกองไฟ | ดู scene | กล่องอยู่**เหนือ**ตัวละครเสมอ ไม่ถูกบัง | gift z-index > z-index สูงสุดของ agent |
| 2 | เทียบกับเดิม | ดู scene | กล่องอยู่**ต่ำลงมาเล็กน้อย** (ใกล้กองไฟขึ้น) | top เพิ่มจาก 44% เป็น ~48% |
| 3 | กดกล่อง | คลิก | เปิด modal ได้ตามเดิม | pointer-events เดิม |
| 4 | dark scene | ดู | ขนาด/glow/animation ไม่เปลี่ยน | เปลี่ยนแค่ z-index + top |

## Rules

* `.delivery-gift-wrapper` z-index 25 → ค่าสูงกว่า agent max (`Math.round(100*12)+5 = 1205`) เช่น 1300 (ใต้ dev overlay 2000, ไม่กระทบ HUD ที่คนละ stacking context)
* `.delivery-gift-wrapper` top 44% → ~48% (เลื่อนลงเล็กน้อย; fine-tune ได้ให้พอดีกองไฟ)
* ไม่แตะ transform/ขนาด/animation/pointer-events ของ gift · ไม่แตะ engine zIndex ตัวละคร · ไม่แตะ modal

## Data

* ไม่มี data/migration (CSS z-index + top ล้วน)

## Out of scope

* เปลี่ยน depth-sorting / engine ของตัวละคร

## Self-verify

- [ ] lint · typecheck · test · build · check:palette · check:ds
- [ ] guard test: gift wrapper z-index > 1205
- [ ] verify staging /status/map: ตัวละครเดินผ่าน → กล่องอยู่บนสุด + ตำแหน่งต่ำลงนิด + กดได้

## Links

ref: app/status/map/delivery-gift.tsx (.delivery-gift-wrapper ~L349-353) · engine zIndex: app/status/map/campsite-scene.tsx (Math.round(pos.y*12)+5) · เดิม [CAM-171](https://linear.app/campvibe/issue/CAM-171/devops-release-การดของขวญ-สงมอบสำเรจ-บนกองไฟ-statusmap-กดดครงเดยว) (gift)
