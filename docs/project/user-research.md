# User Research — CampVibe

> personas + JTBD + pain points · อ่านโดย orchestrator + เจ้าของ ก่อนตัดสิน gate เพื่อเช็ก "feature นี้แก้ pain ของ persona ไหนจริงไหม"
> personas/JTBD ด้านล่าง derive จากโดเมนในระบบ (ยืนยันได้) · **ข้อมูล research จริง (สัมภาษณ์/ตัวเลขพฤติกรรม) เป็น `> TODO(you):` — ห้ามแต่ง insight ขึ้นเอง**

## Personas (จาก role จริงในระบบ)

### 1) Camper — ผู้จอง (role `CAMPER`)
- **คือใคร:** คนหา/อยากไปกางเต็นท์ในไทย (มือใหม่อยากลอง → สายแคมป์ตัวจริง)
- **JTBD:** "เมื่อฉันอยากไปแคมป์สุดสัปดาห์ ฉันอยาก _หาแคมป์ที่ตรงงบ/ทำเล/บรรยากาศ และมั่นใจว่าจองได้จริง_ เพื่อ _ไปเที่ยวได้โดยไม่เสี่ยงผิดหวัง_"
- **Pain points (สมมุติฐานจากช่องว่างตลาด — > TODO(you): ยืนยันด้วย research):**
  - ข้อมูลแคมป์กระจัดกระจาย (เพจ FB/รีวิวปนกัน) เทียบยาก
  - ไม่มั่นใจว่ารูป/ราคาตรงจริงไหม, รีวิวจริงหรือปลอม
  - จองยาก (ต้องทักแชต/โทร), ลืมแคมป์ที่ถูกใจ
- **Features ที่ตอบ:** ค้นหา/ดู detail · verified badge + review จาก stay จริง · booking · **wishlist** (กลับมาจองภายหลัง)

### 2) Host — เจ้าของแคมป์ (role `CAMPER` + เป็น `operator` ของ `CampSite`; team member ได้)
- **คือใคร:** เจ้าของลานกาง/แคมป์รายเล็ก-กลาง อยากได้ลูกค้าออนไลน์
- **JTBD:** "เมื่อฉันมีลานกางให้เช่า ฉันอยาก _ลงประกาศ+รับจองออนไลน์ง่าย ๆ_ เพื่อ _เพิ่มลูกค้าโดยไม่ต้องทำเว็บ/ดูแลแชตเอง_"
- **Pain points (> TODO(you): ยืนยัน):** ทำการตลาดออนไลน์เองยาก, จัดการคิว/ราคา/spot หลายโซนวุ่น, ความน่าเชื่อถือสู้รายใหญ่ไม่ได้
- **Features ที่ตอบ:** host dashboard (จัดการแคมป์/spot/ราคา) · ลงประกาศ+รูป · รับ booking · verified badge

### 3) Admin — ผู้ดูแลระบบ (role `ADMIN`)
- **JTBD:** คุมคุณภาพ supply + ความปลอดภัย — verify แคมป์ (`isVerified`), จัดการข้อมูลตั้งต้น (seed/scrape), กันสแปม/ของปลอม
- **Features:** verify/admin-only fields, seed/scrape (guarded), moderation

## Insight ที่ยืนยันแล้ว (จากการ build)
- review **ต้องผูก stay จริง** (verified-stay) — ทีมเลือกออกแบบเพื่อกัน fake review = สัญญาณว่า "trust" คือ core
- wishlist (CAM-18) ออกแบบ guest กดหัวใจ → ชวนล็อกอิน (ไม่เก็บ local) = ดัน sign-up + ผูกตัวตน

## สมมุติฐานที่ยังต้อง validate
> TODO(you): ใส่ผล research/interview จริง เมื่อมี
- [ ] camper ตัดสินใจจองด้วยปัจจัยอะไรมากสุด (ราคา? รูป? รีวิว? ระยะทาง?)
- [ ] host ยอมจ่าย commission/fee เท่าไรเพื่อ booking
- [ ] อุปสรรคหลักที่ทำให้ camper ไม่จองจบในแอป
- [ ] ขนาด/ความถี่การไปแคมป์ของกลุ่มเป้าหมาย

## Addendum 2026-07 — HostOS pivot (host เป็น primary user)
> เพิ่มเติมจาก personas เดิมด้านบน (ไม่แก้ไขของเดิม) — สะท้อน Blueprint v6 pivot (ADR-011, PR #302): HostOS-first, **payment** deferred หลัง BookingReadinessGate (M7.5) — การจองฝั่ง camper ไม่ได้ถูกเลื่อน (ADR-016, 2026-07-28). Ladder SoT: `docs/project/platform-blueprint.md`.

**Host JTBD ใหม่ (hypothesis — > TODO(you): ยืนยันด้วย research):**
- "เมื่อมี lead เข้าจากหลายช่องทาง (LINE/FB/โทร/walk-in) ฉันอยาก _รวม lead-ใบเสนอราคา-มัดจำ-ขายหน้าลาน ไว้ระบบเดียว_ เพื่อ _ไม่หลุดลูกค้าและปิดยอดแต่ละวันได้ถูกต้อง_"

**Camper JTBD — หมายเหตุปรับถ้อยคำ (ไม่แก้ของเดิมด้านบน โปรดอ่านคู่กัน):**
- ส่วนที่เคยเขียนว่า "...และมั่นใจว่าจองได้จริง..." ให้เข้าใจในบริบทใหม่ว่า "...**จองได้จริงในแอป แต่ยังไม่จ่ายเงินออนไลน์**..." — **แก้ไข 2026-07-28 ([ADR-016](../adr/ADR-016-camper-direct-booking-and-in-chat-completion.md)):** ข้อความเดิมที่ว่า "v1 คือ inquiry ไม่ใช่ online booking; camper สอบถาม/ขอราคาแล้วรอ host ตอบ" **ไม่ตรงกับของจริง** — camper กด `จอง` แล้วได้ Booking สถานะ `PENDING` จริงมาตั้งแต่ M0 สิ่งที่ยังไม่มีคือ **การจ่ายเงิน** และ **การแจ้งเตือน host** (ดู ADR-016 RISK-1/RISK-2)

**คำถาม validate ใหม่ (เพิ่มเติมจากชุดเดิมด้านบน ของเดิมยังไม่ลบ):**
> TODO(you): host ยอมจ่าย SaaS/POS/AI-credit เท่าไร (แทนคำถาม commission เดิมที่ตั้งไว้ตอนยังเป็น booking-marketplace)
> TODO(you): สัดส่วนรายได้ของ host ที่มาจากมัดจำ (deposit) เทียบกับยอดขายรวม
> TODO(you): วันนี้ host ใช้อะไรจัดการ lead (LINE + สมุด + Excel?)
> TODO(you): ช่องทาง lead หลักของ host (LINE / FB / โทร / walk-in / อื่น ๆ) สัดส่วนเท่าไรต่อช่องทาง
> TODO(you): การสอบถามแบบไม่จ่ายออนไลน์ (inquiry-only) ทำให้ camper หลุดไหม เทียบกับการทักแชตปกติที่ทำอยู่แล้ว
> TODO(you): ปริมาณขายหน้าลาน/เช่าอุปกรณ์ (POS/rental) ต่อวัน/เดือน โดยประมาณ

## เกี่ยวข้อง
[market-size.md](market-size.md) · [product-strategy.md](product-strategy.md) · `.claude/rules/discovery.md` (เขียน AC อ้าง persona เหล่านี้)
