# Master Plan — CampVibe

> source-of-truth ทิศทางผลิตภัณฑ์ · อ่านโดย orchestrator + เจ้าของ ก่อนตัดสินเรื่อง scope/priority (ก่อน raise gate)
> สถานะ ณ 2026-06-27 · ส่วน `> TODO(you):` รอเจ้าของเติม (ห้ามเดา)

## What CampVibe is (ยืนยันจาก codebase)
Marketplace **จองแคมป์/ลานกางเต็นท์ในประเทศไทย** — เชื่อม **Camper** (คนหาที่กางเต็นท์) กับ **Host** (เจ้าของแคมป์) ให้ค้นหา–ดูรายละเอียด–จอง–รีวิวได้ในที่เดียว · ภาษาไทยเป็นหลัก (i18n TH/EN)

โดเมนจริงในระบบ: `CampSite` (แคมป์) · `Spot` (จุดกาง/โซนในแคมป์) · `Booking` (การจอง) · `Review` (รีวิว ผูก verified-stay) · `Wishlist` (บันทึกแคมป์ที่ถูกใจ) · `Location/ThailandLocation` (จังหวัด/อำเภอ) · `User` (role CAMPER/ADMIN, `isVerified`)

## Vision
> TODO(you): ประโยควิสัยทัศน์ระยะยาว (เช่น "ให้การออกไปแคมป์ในไทยจองง่ายเหมือนจองโรงแรม")

## Mission (ตอนนี้)
ทำให้ **หาและจองแคมป์ในไทยได้ง่าย น่าเชื่อถือ** — ลด friction ของ camper (ข้อมูลกระจัดกระจาย/จองยาก) และเปิดช่องทางขายให้ host รายเล็ก

## North-star metric
> TODO(you): เลือก 1 ตัวที่สะท้อนคุณค่าที่ส่งจริง — แนะนำ **"จำนวน Booking ที่สำเร็จต่อเดือน"** (หรือ GMV) · ระบุค่าปัจจุบัน + เป้า
- รอง (input metrics): MAU, แคมป์ที่ published, % camper ที่ใช้ wishlist, conversion ค้นหา→จอง, review ต่อ booking

## Strategic pillars
1. **Supply (host/แคมป์):** ได้แคมป์คุณภาพมากพอ + ข้อมูลครบ (รูป/ราคา/ที่ตั้ง/สิ่งอำนวยความสะดวก) + **verified badge** (admin ยืนยัน) สร้างความเชื่อถือ
2. **Demand (camper):** ค้นหา/กรองดี, หน้า detail น่าเชื่อถือ, จองลื่น, wishlist กลับมาจองภายหลัง
3. **Trust & safety:** review ผูก stay จริง, authz/ownership แน่น, PDPA สำหรับ PII คนไทย (ดู `.claude/rules/ux.md`)
4. **Lean ops:** ทีม AI-first ส่งงานเร็ว/ปลอดภัยผ่าน 3-env + gate (ดู `.claude/`)

## Roadmap (phase) — refresh 2026-06-27

- **ส่งมอบแล้ว (core + foundation):** auth · listing+detail แคมป์ · booking · review · wishlist · host dashboard · admin verify/seed · **Atomic Schema** (data-model: enums · money Decimal · CSV→normalized relations · multi-region · Booking snapshot) · **FE quality** (design tokens + dark mode + responsive) · **Image resilience** (prod baseline v0.10.2)
- **ส่งขึ้น staging แล้ว — รอ release prod รวมรอบ (G5):**
  - **Performance หน้า Home** (epic CAM-186): LCP 9.0→**2.4s** · Perf 66→**94** · First-Load JS −61% · keyset pagination + infinite scroll (140 ลานครบ) · catalog caching (TTFB 2.3s→40ms) · next/image webp
  - **Security**: SEC-1 (ปิดช่องมองลานสาธารณะ) · SEC-2 (response headers ครบ) · **SEC-3 strict CSP nonce** (กัน inline-XSS)
  - **Loading UX** (LOAD-1): skeleton ทุกจังหวะโหลด + empty-state SVG (light/dark)
- **เครื่องมือทีม (AI delivery workflow):** /status dashboard + gates G1–G5 + Telegram closed-loop · **/retro** (learning loop ป้อนบทเรียนเข้า rules) · **skill-builder** + **seo audit** skill
- **Next (P1 — ลำดับเต็ม → [product-plan.md](product-plan.md)):** **SEO พื้นฐาน** (sitemap/robots/JSON-LD/per-page metadata — audit เจอว่ายังขาด) · search engine (SEARCH-1 — รอ trigger >~10k ลาน) · notifications สินค้า (email/LINE) · admin console
- **Later:** > TODO(you): payment/escrow? ปฏิทินว่าง/พร้อมจอง? แชร์ wishlist? remarketing?

## ขอบเขต / สิ่งที่ "ยังไม่ทำตอนนี้"
> TODO(you): ระบุชัด เช่น — ยังไม่ทำระบบจ่ายเงินจริง/escrow, ยังไม่ทำ multi-language นอก TH/EN, ยังไม่ทำ mobile app native
(ของที่ตัดออกช่วย orchestrator + เจ้าของ รู้ว่าอะไร "นอก scope" → orchestrator หยุดถามเจ้าของถ้าถูกขอ)

## เกี่ยวข้อง
[business.md](business.md) · [product-strategy.md](product-strategy.md) · [product-plan.md](product-plan.md)
