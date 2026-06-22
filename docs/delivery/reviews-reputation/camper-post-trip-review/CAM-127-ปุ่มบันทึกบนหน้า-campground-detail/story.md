---
linear: CAM-127
feature: reviews-reputation
epic: camper-post-trip-review (CAM-35)
persona: camper
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-06-22
---
# ปุ่มบันทึกบนหน้า Campground Detail (CAM-127)

> Story-level (Camper) · epic: [CAM-35](https://linear.app/campvibe/issue/CAM-35/camper-post-trip-and-review) Camper post-trip & review · feature: Wishlist (อยู่ใน project Reviews & Reputation) · gate: G1 ✅ → G2
> Build on the existing wishlist ([CAM-18](https://linear.app/campvibe/issue/CAM-18/wishlist-บนทกแคมปทถกใจ-camper), released): model + API + card heart มีแล้ว — งานนี้คือ wire ปุ่มบนหน้า detail เท่านั้น (frontend)

## Why

camper บันทึกแคมป์ตอนดูรายละเอียด (จุดที่ตัดสินใจ) + เห็นว่าบันทึกไว้แล้ว → ดัน wishlist→booking · **KPI:** % การ save ที่เกิดบนหน้า detail

## Story

ในฐานะ **Camper** ฉันต้องการ **กดบันทึกแคมป์จากหน้ารายละเอียด และเห็นสถานะว่าบันทึกแล้ว** เพื่อ **เก็บไว้กลับมาจองภายหลังโดยไม่ต้องกลับไปหน้ารายการ**
ขอบเขต: wire ปุ่มบันทึกบนหน้า detail (toggle + initial state) ฝั่ง frontend เท่านั้น

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล |
| -- | -- | -- | -- | -- |
| AC-1 | ล็อกอินอยู่ · ยังไม่บันทึกแคมป์นี้ | กดปุ่มบันทึก | หัวใจเต็มสีเขียว + ข้อความ `บันทึกแล้ว` + ข้อความแจ้ง `บันทึกลงรายการที่ถูกใจแล้ว` | POST /api/wishlist → สร้าง Wishlist(userId, campSiteId) |
| AC-2 | ล็อกอินอยู่ · บันทึกแคมป์นี้ไว้แล้ว | เปิดหน้ารายละเอียด | ปุ่มเป็นหัวใจเต็ม + `บันทึกแล้ว` ตั้งแต่โหลด | อ่านสถานะจากเซิร์ฟเวอร์ → บันทึกแล้ว = จริง |
| AC-3 | ล็อกอินอยู่ · บันทึกไว้แล้ว | กดปุ่มซ้ำ | หัวใจกลับเป็นโปร่ง + `บันทึก` + ข้อความแจ้ง `นำออกจากรายการที่ถูกใจแล้ว` | DELETE → ลบ record |
| AC-4 | ยังไม่ล็อกอิน | กดปุ่มบันทึก | เปิดหน้าต่างเข้าสู่ระบบ พร้อมข้อความ `เข้าสู่ระบบเพื่อบันทึกแคมป์นี้` | ไม่สร้าง record |
| AC-5 | ล็อกอินอยู่ · กดบันทึกแต่ระบบขัดข้อง | กดปุ่ม | ปุ่มเด้งกลับสถานะเดิม + ข้อความแจ้ง `บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง` | ไม่มีการเปลี่ยนแปลงข้อมูล (rollback) |

## Rules

* **BR-1** optimistic toggle แล้ว rollback ถ้าระบบขัดข้อง — แพทเทิร์นเดียวกับ CampgroundCard
* **BR-2** guest กด → เปิดหน้าต่างเข้าสู่ระบบ (ข้อความ `เข้าสู่ระบบเพื่อบันทึกแคมป์นี้`) ไม่ยิงคำขอ
* **BR-3** สถานะเริ่มต้นมาจากเซิร์ฟเวอร์ (ค้นว่าผู้ใช้นี้บันทึกแคมป์นี้ไว้ไหม; ไม่ล็อกอิน = ยังไม่บันทึก)
* **BR-4** ข้อความปุ่ม: ยังไม่บันทึก = `บันทึก` · บันทึกแล้ว = `บันทึกแล้ว` · หัวใจเติมสีเขียวเมื่อบันทึก
* **BR-5** ปุ่มกดไม่ได้ระหว่างประมวลผล · พื้นที่กดอย่างน้อย 44px · ป้ายช่วยการเข้าถึงตามสถานะ

## Data

ไม่มี migration — ใช้โมเดล Wishlist + API เดิม. เพิ่มข้อความ `บันทึกแล้ว` (TH/EN) ในชั้นภาษา

## Out of scope

ปุ่มแชร์ (ยังไม่ wire → ticket แยก) · หน้ารายการที่ถูกใจ (มีแล้ว) · แก้ API/โครงสร้างข้อมูล wishlist (เสร็จแล้ว)

## Self-verify

- [ ] lint  - [ ] typecheck  - [ ] test + coverage ≥80%  - [ ] a11y  - [ ] design (token-only)  - [ ] security

## Links

epic: [CAM-35](https://linear.app/campvibe/issue/CAM-35/camper-post-trip-and-review) · reuse: components/CampgroundCard.tsx (pattern) · /api/wishlist* · LoginModal · prior epic [CAM-18](https://linear.app/campvibe/issue/CAM-18/wishlist-บนทกแคมปทถกใจ-camper) (released)
