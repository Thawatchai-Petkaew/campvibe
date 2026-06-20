# Business — CampVibe

> model ธุรกิจ + คุณค่า · `/camper-agent` ใช้ประเมิน "feature นี้คุ้ม/ตรงโมเดลไหม" + ตรวจ **cost rule** (action ใดมีค่าใช้จ่าย = escalate)
> ส่วน `> TODO(you):` รอเจ้าของเติม — **ห้ามเดาตัวเลข/โมเดลรายได้**

## Value proposition
**สำหรับ Camper:** ที่เดียวจบ — หาแคมป์ในไทยที่ตรงใจ (ที่ตั้ง/ราคา/สิ่งอำนวยความสะดวก), ดูข้อมูล+รีวิวที่เชื่อถือได้ (verified badge + review จาก stay จริง), จอง+เก็บ wishlist ไว้กลับมาจองภายหลัง
**สำหรับ Host:** ช่องทางออนไลน์ลงประกาศแคมป์ + จัดการ spot/ราคา + รับการจอง โดยไม่ต้องทำเว็บเอง เข้าถึง camper ที่กำลังหาที่กาง

## Business model
> TODO(you): เลือก/ยืนยันโมเดลรายได้ — ตัวเลือกที่พบบ่อยในตลาด marketplace:
> - **Commission ต่อ booking** (เก็บ % จาก host หรือ camper)
> - **Subscription/listing fee** สำหรับ host
> - **Featured/ads** (ดันแคมป์ขึ้นบนสุด)
> - **Freemium** (ฟรีตอนนี้เพื่อสะสม supply/demand แล้วค่อย monetize)
> ระบุที่เลือก + อัตรา/ราคา + เหตุผล
>
> หมายเหตุ codebase: มี `priceLow`/`priceHigh` ต่อแคมป์ + `Booking` แต่ **ยังไม่พบ payment/commission logic จริง** → ตอนนี้ถือว่ายังไม่ monetize (ยืนยัน/แก้ได้)

## Pricing
> TODO(you): โครงสร้างราคา (ถ้ามี) — ฝั่ง host จ่ายอะไร, ฝั่ง camper จ่ายอะไรนอกค่าแคมป์

## Unit economics
> TODO(you): ต่อ 1 booking/host — รายได้, ต้นทุนแปรผัน (payment fee, infra, support), contribution margin, CAC, LTV
> ใช้เป็นเกณฑ์ตัดสินว่าฟีเจอร์/แคมเปญไหน "คุ้ม"

## ต้นทุน/ค่าใช้จ่ายที่รู้แล้ว (สำหรับ cost rule ของ `/camper-agent`)
ของที่ **มีค่าใช้จ่ายเงิน** → ตามกฎเหล็ก `/camper-agent` ต้อง **escalate เสมอ** ก่อนทำ:
- **prod deploy** (Vercel) / การ provision infra ใหม่ (DB, blob storage)
- **paid API** ภายนอก (เช่น map/geocoding, SMS, payment gateway, model API ที่คิดเงิน)
- **ส่งข้อความจริง** ออกนอกระบบ (email/SMS/Telegram broadcast ไปผู้ใช้จริง)
- โดเมน, ค่า service ราย commit
> TODO(you): เติมรายการ + เพดานงบที่ "ทำเองได้โดยไม่ถาม" (ถ้ามี — ถ้าไม่ระบุ = ถามทุกค่าใช้จ่าย)

## Go-to-market
> TODO(you): ช่องทางหา camper + host (SEO, social, community แคมป์ปิ้ง, partnership อุทยาน/ลานกาง), กลยุทธ์ตั้งต้น supply ก่อนหรือ demand ก่อน

## Moat / ความได้เปรียบ
- **ที่ยืนยันได้จาก codebase และการออกแบบจงใจ:**
  - review ผูก verified-stay (ต้องมี booking จริงก่อนรีวิว — CAM-15 shipped v0.1.0) = กัน fake review; aggregator ทั่วไปไม่ได้ enforce นี้
  - verified badge (admin-only `isVerified`) = quality signal สำหรับ camper + แรงจูงใจให้ host ดูแลแคมป์
  - wishlist (CAM-18) = ผูก camper กับ platform (sign-up required, ไม่เก็บ local) → retention signal
- **Network effect (เชิงโครงสร้าง — ยังต้องพิสูจน์ด้วย traction จริง):** แคมป์มากขึ้น → camper มาขึ้น → review มากขึ้น → แคมป์ใหม่อยากอยู่บน platform → ยากลอกเพราะ review corpus สะสม
- > TODO(you): ยืนยัน moat ที่ 3 (data/brand) เมื่อมี traction จริง

## เกี่ยวข้อง
[market-size.md](market-size.md) · [product-strategy.md](product-strategy.md) · `std/ux.md` (PDPA) · `std/security.md`
