# Master Plan — CampVibe

> source-of-truth ทิศทางผลิตภัณฑ์ · อ่านโดย `/camper-agent` + orchestrator ก่อนตัดสินเรื่อง scope/priority
> สถานะ ณ 2026-06-21 · ส่วน `> TODO(you):` รอเจ้าของเติม (ห้ามเดา)

## What CampVibe is (ยืนยันจาก codebase)
Marketplace **จองแคมป์/ลานกางเต็นท์ในประเทศไทย** — เชื่อม **Camper** (คนหาที่กางเต็นท์) กับ **Host** (เจ้าของแคมป์) ให้ค้นหา–ดูรายละเอียด–จอง–รีวิวได้ในที่เดียว · ภาษาไทยเป็นหลัก (i18n TH/EN)

โดเมนจริงในระบบ: `CampSite` (แคมป์) · `Spot` (จุดกาง/โซนในแคมป์) · `Booking` (การจอง) · `Review` (รีวิว ผูก verified-stay) · `Wishlist` (บันทึกแคมป์ที่ถูกใจ) · `Location/ThailandLocation` (จังหวัด/อำเภอ) · `User` (role CAMPER/ADMIN, `isVerified`)

## Vision
> TODO(you): ประโยควิสัยทัศน์ระยะยาว (เช่น "ให้การออกไปแคมป์ในไทยจองง่ายเหมือนจองโรงแรม")

## Mission (ตอนนี้)
ทำให้ **หาและจองแคมป์ในไทยได้ง่าย น่าเชื่อถือ** — ลด friction ของ camper (ข้อมูลกระจัดกระจาย/จองยาก) และเปิดช่องทางขายให้ host รายเล็ก

## North-star metric
**จำนวน Booking ที่สำเร็จต่อเดือน** — สะท้อนคุณค่าที่ส่งจริงครบทั้งสองฝั่ง (camper ได้จองที่กาง, host ได้ลูกค้า) · ค่าปัจจุบัน + เป้า: > TODO(you): ระบุตัวเลขจริง
- รอง (input metrics): MAU, แคมป์ที่ published, % camper ที่ใช้ wishlist, conversion ค้นหา→จอง, review ต่อ booking

## Strategic pillars
1. **Supply (host/แคมป์):** ได้แคมป์คุณภาพมากพอ + ข้อมูลครบ (รูป/ราคา/ที่ตั้ง/สิ่งอำนวยความสะดวก) + **verified badge** (admin ยืนยัน) สร้างความเชื่อถือ
2. **Demand (camper):** ค้นหา/กรองดี, หน้า detail น่าเชื่อถือ, จองลื่น, wishlist กลับมาจองภายหลัง
3. **Trust & safety:** review ผูก stay จริง, authz/ownership แน่น, PDPA สำหรับ PII คนไทย (ดู `std/ux.md`)
4. **Lean ops:** ทีม AI-first ส่งงานเร็ว/ปลอดภัยผ่าน 3-env + gate (ดู `ai-planning/`)

## Roadmap (phase)
- **MVP (ทำแล้ว/กำลัง):** auth · listing+detail แคมป์ · booking · review · **wishlist (CAM-18 done staging)** · host dashboard จัดการแคมป์ · admin verify/seed
- **Next (P1 — ดู `ai-planning/FEATURE-BACKLOG.md` + product-strategy.md):** search/filter ตามจังหวัด · notifications (Telegram/email) · ปรับปรุง SEO หน้า public (`std/seo.md`) · ปิด 4 security gap จาก gap-audit
- **Later (ยังไม่ตัดสินลำดับ — ต้องการ owner ยืนยัน):** payment/escrow (BL-C1) · ปฏิทินว่าง/พร้อมจอง · แชร์ wishlist · remarketing/re-engagement · host analytics (BL-C5) · AI features (BL-AI2–AI9 ดู `ai-planning/FEATURE-BACKLOG.md`) · > TODO(you): ยืนยันลำดับ + เลือก Phase 2 hero

## ขอบเขต / สิ่งที่ "ยังไม่ทำตอนนี้"
- **ยังไม่ทำตอนนี้:** ระบบจ่ายเงินจริง/escrow (BL-C1 เลื่อนไป Later) · mobile app native · ตลาดนอกประเทศไทย · social feed / community forum · multi-language นอก TH/EN · ฟีเจอร์ที่ไม่แตะ core loop (ค้นหา→ดู→จอง→wishlist) · > TODO(you): เพิ่ม/ยืนยันรายการที่เจ้าของต้องการ lock ออก
(ของที่ตัดออกช่วย `/camper-agent` รู้ว่าอะไร "นอก scope" → escalate ถ้าถูกขอ)

## เกี่ยวข้อง
[business.md](business.md) · [product-strategy.md](product-strategy.md) · `ai-planning/FEATURE-BACKLOG.md` · `ai-planning/AI-TEAM-PLAYBOOK.md`
