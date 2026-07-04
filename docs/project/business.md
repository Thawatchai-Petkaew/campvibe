# Business — CampVibe

> model ธุรกิจ + คุณค่า · อ่านโดย orchestrator + เจ้าของ ก่อนตัดสิน gate เพื่อประเมิน "feature นี้คุ้ม/ตรงโมเดลไหม" + ตรวจ **cost rule** (action ใดมีค่าใช้จ่าย → orchestrator หยุดถามเจ้าของ)
> ส่วน `> TODO(you):` รอเจ้าของเติม — **ห้ามเดาตัวเลข/โมเดลรายได้**

## Value proposition
> **อัปเดต 2026-07-04 (Blueprint v6, ADR-011):** ปรับ framing ตาม HostOS-first pivot — Camper เน้น trusted discovery + สอบถามได้คำตอบเร็ว (ไม่ใช่ online booking ใน v1); Host เน้น operations-first back-office

**สำหรับ Camper:** ที่เดียวจบสำหรับค้นหาแคมป์ในไทยที่เชื่อถือได้ (ที่ตั้ง/ราคา/สิ่งอำนวยความสะดวก), ดูข้อมูล+รีวิวที่เชื่อถือได้ (verified badge + review จาก stay จริง), สอบถาม/ขอราคาแล้วได้คำตอบเร็ว แม้ยังไม่จ่ายเงินออนไลน์ (เก็บ wishlist ไว้กลับมาสอบถามภายหลัง)
**สำหรับ Host:** ระบบหลังบ้าน (operations-first) ที่รวม lead → ใบเสนอราคา → มัดจำ → ปิดยอด (POS/ขายหน้าลาน) ไว้ครบในที่เดียว แทนที่จะกระจายอยู่ใน LINE/สมุด/Excel หลายที่ ช่วยไม่ให้หลุดลูกค้าและปิดยอดแต่ละวันได้ถูกต้อง โดยไม่ต้องทำเว็บเอง

## Business model
> TODO(you): เลือก/ยืนยันโมเดลรายได้ — ตัวเลือกที่พบบ่อยในตลาด marketplace:
> - **Commission ต่อ booking** (เก็บ % จาก host หรือ camper)
> - **Subscription/listing fee** สำหรับ host
> - **Featured/ads** (ดันแคมป์ขึ้นบนสุด)
> - **Freemium** (ฟรีตอนนี้เพื่อสะสม supply/demand แล้วค่อย monetize)
> ระบุที่เลือก + อัตรา/ราคา + เหตุผล
>
> หมายเหตุ codebase: มี `priceLow`/`priceHigh` ต่อแคมป์ + `Booking` แต่ **ยังไม่พบ payment/commission logic จริง** → ตอนนี้ถือว่ายังไม่ monetize (ยืนยัน/แก้ได้) — สอดคล้องกับ ADR-011 by design (host ถือเงินเอง)
>
> **PROPOSED (Blueprint v6, awaiting owner):**
> - primary: HostOS SaaS (subscription) + POS module fees + AI credits (parser/chat usage)
> - secondary: affiliate hub (M6), sponsored placement
> - booking commission: **เฉพาะ M7.5+** (หลัง BookingReadinessGate เปิด public booking/payment ต่อ campsite) — ก่อนหน้านั้น host ถือเงินเองทั้งหมด (manual hold + deposit record), platform เป็น ledger/workflow ไม่แตะเงินจอง
> อ้างอิง: `docs/adr/ADR-011-strategy-pivot-hostos-first.md` · `docs/project/platform-blueprint.md`

## Pricing
> TODO(you): โครงสร้างราคา (ถ้ามี) — ฝั่ง host จ่ายอะไร, ฝั่ง camper จ่ายอะไรนอกค่าแคมป์

## Unit economics
> TODO(you): ต่อ 1 booking/host — รายได้, ต้นทุนแปรผัน (payment fee, infra, support), contribution margin, CAC, LTV
> ใช้เป็นเกณฑ์ตัดสินว่าฟีเจอร์/แคมเปญไหน "คุ้ม"

## ต้นทุน/ค่าใช้จ่ายที่รู้แล้ว (สำหรับ cost rule)
ของที่ **มีค่าใช้จ่ายเงิน** → ตามกฎเหล็ก orchestrator ต้อง **หยุดถามเจ้าของเสมอ** ก่อนทำ:
- **prod deploy** (Vercel) / การ provision infra ใหม่ (DB, blob storage)
- **paid API** ภายนอก (เช่น map/geocoding, SMS, payment gateway, model API ที่คิดเงิน)
- **ส่งข้อความจริง** ออกนอกระบบ (email/SMS/Telegram broadcast ไปผู้ใช้จริง)
- โดเมน, ค่า service ราย commit
- **OpenRouter tokens** (AI parser/chat — AI-PARSE, AI-1/2/3 ใน `ai-product-roadmap.md`) — G2 ก่อนใช้จริง
- **LINE Messaging API** (HostOS lead inbox, Blueprint v6) — G2 ก่อนใช้จริง
- **weather API** (D3 ใน `ai-product-roadmap.md`, R3) — G2 ก่อนใช้จริง
> TODO(you): เติมรายการ + เพดานงบที่ "ทำเองได้โดยไม่ถาม" (ถ้ามี — ถ้าไม่ระบุ = ถามทุกค่าใช้จ่าย)

## Go-to-market
> TODO(you): ช่องทางหา camper + host (SEO, social, community แคมป์ปิ้ง, partnership อุทยาน/ลานกาง), กลยุทธ์ตั้งต้น supply ก่อนหรือ demand ก่อน

## Moat / ความได้เปรียบ
> TODO(you): อะไรทำให้ลอกยาก — network effect (แคมป์เยอะ→คนเยอะ), verified inventory + review จริง, data, brand
- ที่ยืนยันได้: review ผูก verified-stay (กัน fake) + verified badge (admin) = trust ที่ aggregator ทั่วไปไม่มี

## เกี่ยวข้อง
[market-size.md](market-size.md) · [product-strategy.md](product-strategy.md) · `.claude/rules/ux.md` (PDPA) · `.claude/rules/security.md`
