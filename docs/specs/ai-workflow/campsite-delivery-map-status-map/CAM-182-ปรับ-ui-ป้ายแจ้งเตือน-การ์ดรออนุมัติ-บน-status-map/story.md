---
linear: CAM-182
feature: ai-workflow
epic: campsite-delivery-map-status-map (CAM-150)
persona: platform
artifact: story
owner: product-owner
status: Backlog
version: v1
updated: 2026-06-25
---
# ปรับ UI ป้ายแจ้งเตือน + การ์ดรออนุมัติ บน /status/map ให้ดูเป็นเกม/แฟนซีขึ้น (CAM-182)

## ทำไม

บน /status/map ตอนมีงานรอเจ้าของอนุมัติ (gate / awaiting-you) UI 2 จุดยังดูไม่ดี:

1. **ป้ายแจ้งเตือน** (`.you-alert` เหนือตัว "คุณ", copy `รอตรวจสอบ`) — ฟอนต์ 11px เล็ก, จุดสถานะ 7px (DOM span), ใช้ตัวอักษรธง `⚑` แทนไอคอนจริง → ดูเล็กแปลกๆ ไม่เข้าชุด design system
2. **การ์ดรออนุมัติฝั่งซ้าย** (`ApprovalCard` "รออนุมัติ N รายการ") — แบนๆ ขอบ amber บางๆ ไม่มี glow/มิติ ฟอนต์เล็ก ดูธรรมดา
   เจ้าของอยากให้ทั้งสองดู **เป็นเกมขึ้น + แฟนซีขึ้น** (ฉากเป็น campfire เกม)

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **ป้ายแจ้งเตือนและการ์ดรออนุมัติที่ดูเป็นเกมและแฟนซี อ่านง่าย** เพื่อ **รู้ว่ามีงานรออนุมัติแบบสะดุดตาและสนุก ไม่ดูเล็กแปลกๆ**
ขอบเขต: ปรับ UI/visual ของ `.you-alert` (notification) + `ApprovalCard` (การ์ดซ้าย ทั้ง expanded/collapsed) ให้เป็นเกม/แฟนซี; ไม่แตะ logic การ approve / engine / data

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | มี gate รออนุมัติ | ดูตัว "คุณ" บนแผนที่ | ป้ายแจ้งเตือนดูเด่น เป็นเกม ใช้ไอคอน lucide (ไม่ใช่ตัวอักษรธง) ฟอนต์อ่านง่ายขึ้น | logic เดิม (แสดงเมื่อ hasGates) |
| 2 | มีงานรออนุมัติ | ดูการ์ดฝั่งซ้าย | การ์ดดูแฟนซีขึ้น (glow/มิติ/ลำดับชั้นชัด) เข้าธีม campfire | อ่าน gates เดิม |
| 3 | reduced-motion | ดู | ไม่กระพริบแสบตา (glow ลด/นิ่งตาม prefers-reduced-motion) | a11y |
| 4 | กดป้าย/ปุ่มอนุมัติ | คลิก | ทำงานเหมือนเดิม (เปิด approve flow / Linear) ปุ่มแตะ 44px | ไม่เปลี่ยน behavior |

## Rules (design refine ที่ G2 — เจ้าของ approve)

* ใช้ scene tokens (`--amber`, `--amber-glow`, teal, glass) + lucide icons เท่านั้น (เลิกใช้ `&#9873;` / DOM dot แทนไอคอน) · ไม่มี emoji
* notification: ฟอนต์/ไอคอนใหญ่ขึ้นอ่านง่าย, treatment เป็นเกม (glow/pulse พอดี) · การ์ด: เพิ่มมิติ/glow/ลำดับชั้น ให้แฟนซีแต่ยังอ่านง่าย
* คง logic/behavior: hasGates trigger, approve flow, ปุ่มแตะ ≥44px, focus-visible · เคารพ prefers-reduced-motion · ไม่แตะ engine/data/modal
* ดีไซน์รายละเอียด (สี/ขนาด/glow/animation) = decision ที่ G2 (เจ้าของเลือก/อนุมัติ)

## Data

* ไม่มี data/migration (UI/CSS ล้วน)

## Out of scope

* เปลี่ยน approve logic / Linear integration / stage derivation

## Self-verify

- [ ] lint · typecheck · test · build · check:palette · check:ds
- [ ] a11y: 44px tap, focus-visible, prefers-reduced-motion, lucide (ไม่มี emoji/glyph)
- [ ] verify staging /status/map: ป้าย + การ์ด ดูเกม/แฟนซีขึ้น อ่านง่าย กดได้

## Links

ref: app/status/map/campsite-scene.tsx (.you-alert ~L389-399, ~L656-664) · app/status/map/campsite-overlays.tsx (ApprovalCard ~L2076-2130, CSS ~L700-748) · DESIGN.md
