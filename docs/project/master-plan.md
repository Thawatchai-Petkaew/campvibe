# Master Plan — CampVibe

> source-of-truth ทิศทางผลิตภัณฑ์ · อ่านโดย orchestrator + เจ้าของ ก่อนตัดสินเรื่อง scope/priority (ก่อน raise gate)
> สถานะ ณ 2026-06-27 · ส่วน `> TODO(you):` รอเจ้าของเติม (ห้ามเดา)

## What CampVibe is (ยืนยันจาก codebase + Platform Blueprint v6 — ดู [platform-blueprint.md](platform-blueprint.md))
แพลตฟอร์ม **HostOS-first สำหรับแคมป์/ลานกางเต็นท์ในประเทศไทย** — แกนหลักคือ back-office ให้ **Host** รันธุรกิจได้ครบวงจร (lead → quote → hold/deposit → stay → POS → daily close) บวกฝั่ง **Camper** ค้นหา–ดูรายละเอียด–สอบถามได้ในที่เดียว · public booking/payment **เลื่อนออกไป** จนกว่าจะผ่าน BookingReadinessGate (ดู platform-blueprint.md §3 M7.5) · ภาษาไทยเป็นหลัก (i18n TH/EN)

โดเมนจริงในระบบ: `CampSite` (แคมป์) · `Spot` (จุดกาง/โซนในแคมป์) · `Booking` (การจอง) · `Review` (รีวิว ผูก verified-stay) · `Wishlist` (บันทึกแคมป์ที่ถูกใจ) · `Location/ThailandLocation` (จังหวัด/อำเภอ) · `User` (role CAMPER/ADMIN, `isVerified`) — (แผน M1.2: Lead · Quote · Hold · DepositRecord · Stay — ยังไม่มีใน code)

## Vision
> TODO(you): ประโยควิสัยทัศน์ระยะยาว (เช่น "ให้การออกไปแคมป์ในไทยจองง่ายเหมือนจองโรงแรม")
> PROPOSED (awaiting owner): เป็นระบบปฏิบัติการของการแคมป์ไทย — host รันธุรกิจได้ทั้งวันในระบบเดียว, camper ค้นหา-สอบถาม-ไปแคมป์ได้อย่างมั่นใจ

## Mission (ตอนนี้)
ทำให้ **host รายเล็กรันธุรกิจแคมป์ได้ในระบบเดียว และ camper หา-สอบถามแคมป์ที่เชื่อถือได้**

## North-star metric
> TODO(you): เลือก 1 ตัวที่สะท้อนคุณค่าที่ส่งจริง — แนะนำ **"จำนวน Booking ที่สำเร็จต่อเดือน"** (หรือ GMV) · ระบุค่าปัจจุบัน + เป้า
> PROPOSED (awaiting owner): ตาม Platform Blueprint v6 แนะนำเปลี่ยนเป็น **"confirmed stays/เดือน"** (ดู [platform-blueprint.md](platform-blueprint.md) §5) — เจ้าของยืนยัน/ปรับได้
- รอง (input metrics): MAU, แคมป์ที่ published, % camper ที่ใช้ wishlist, review ต่อ booking, qualified inquiries, lead→close rate, host DAU/WAU, ledger accuracy

## Strategic pillars
1. **Supply (host/แคมป์):** ได้แคมป์คุณภาพมากพอ + ข้อมูลครบ (รูป/ราคา/ที่ตั้ง/สิ่งอำนวยความสะดวก) + **verified badge** (admin ยืนยัน) สร้างความเชื่อถือ
2. **Demand (camper):** ค้นหา/กรองดี → สอบถามลื่น ได้คำตอบเร็ว (dual demand loop — ดู [platform-blueprint.md](platform-blueprint.md) §1), wishlist กลับมาสอบถามภายหลัง
3. **Host operations:** HostOS ที่ host เปิดใช้ทุกวัน — lead→quote→hold/deposit→stay→daily close ในระบบเดียว
4. **Trust & safety:** review ผูก stay จริง, authz/ownership แน่น, PDPA สำหรับ PII คนไทย (ดู `.claude/rules/ux.md`), **deterministic money/availability core — AI ไม่แตะ**
5. **Lean ops:** ทีม AI-first ส่งงานเร็ว/ปลอดภัยผ่าน 3-env + gate (ดู `.claude/`)

## Roadmap (phase) — refresh 2026-07-04 (Platform Blueprint v6 pivot — ดู [platform-blueprint.md](platform-blueprint.md), [ADR-011](../adr/ADR-011-strategy-pivot-hostos-first.md))

**M0 baseline:**
- **ส่งมอบแล้ว (core + foundation):** auth · listing+detail แคมป์ · booking · review · wishlist · host dashboard · admin verify/seed · **Atomic Schema** (data-model: enums · money Decimal · CSV→normalized relations · multi-region · Booking snapshot) · **FE quality** (design tokens + dark mode + responsive) · **Image resilience** (prod baseline v0.10.2)
- **ส่งขึ้น staging แล้ว — รอ release prod รวมรอบ (G5):**
  - **Performance หน้า Home** (epic CAM-186): LCP 9.0→**2.4s** · Perf 66→**94** · First-Load JS −61% · keyset pagination + infinite scroll (140 ลานครบ) · catalog caching (TTFB 2.3s→40ms) · next/image webp
  - **Security**: SEC-1 (ปิดช่องมองลานสาธารณะ) · SEC-2 (response headers ครบ) · **SEC-3 strict CSP nonce** (กัน inline-XSS)
  - **Loading UX** (LOAD-1): skeleton ทุกจังหวะโหลด + empty-state SVG (light/dark)
- **เครื่องมือทีม (AI delivery workflow):** /status dashboard + gates G1–G5 + Telegram closed-loop · **/retro** (learning loop ป้อนบทเรียนเข้า rules) · **skill-builder** + **seo audit** skill

**M1→M8 milestone ladder (รายละเอียดเต็ม → [platform-blueprint.md](platform-blueprint.md) §3):**
- **M1 — Data & Trust:** availability ถูกต้อง + final price/fee/cancellation atomic + verified-stay gate + listing quality score
- **M1.2 — HostOS core:** lead inbox → quote → hold/deposit → manual stay → POS/rental → daily close
- **M1.5 — Host Map:** CampZone/CampMap, 2D SVG builder, zone/pitch editor, guest interactive map
- **M2 — AI Discover→Inquiry:** NL search + live availability Q&A + การ์ดในแชท → ส่งต่อเข้า HostOS lead inbox
- **M3 — Trip OS** · **M4 — Gear Identity** · **M5 — Setup Community** · **M6 — Affiliate Hub** · **M7 — 2.5D showcase**
- **M7.5 — OPTIONAL Booking Engine:** เปิด public booking/payment กลับมาเมื่อผ่าน BookingReadinessGate ต่อ campsite (ไม่ผูกเวลาตายตัว)
- **M8 — Secondhand Marketplace:** ลำดับสุดท้ายตาม blueprint
- **Later (superseded):** เดิมเป็น `> TODO(you): payment/escrow? ปฏิทินว่าง/พร้อมจอง? แชร์ wishlist? remarketing?` — คำถามนี้ถูกตอบแล้วโดย Platform Blueprint v6: payment/escrow → M7.5 (readiness-gated) · ปฏิทินว่าง/พร้อมจอง → ส่วนหนึ่งของ M1 availability · แชร์ wishlist/remarketing → ยังไม่จัดคิว (ยังไม่อยู่ใน ladder M1–M8, พิจารณาใหม่หลัง M2)

## ขอบเขต / สิ่งที่ "ยังไม่ทำตอนนี้"
> TODO(you): ระบุชัด เช่น — ยังไม่ทำระบบจ่ายเงินจริง/escrow, ยังไม่ทำ multi-language นอก TH/EN, ยังไม่ทำ mobile app native
> PROPOSED (awaiting owner): online payment/booking checkout จนกว่าผ่าน BookingReadinessGate (M7.5, ดู [platform-blueprint.md](platform-blueprint.md) §3) · native app · ตลาดนอกไทย · secondhand marketplace ก่อน M8
(ของที่ตัดออกช่วย orchestrator + เจ้าของ รู้ว่าอะไร "นอก scope" → orchestrator หยุดถามเจ้าของถ้าถูกขอ)

## เกี่ยวข้อง
[platform-blueprint.md](platform-blueprint.md) · [business.md](business.md) · [product-strategy.md](product-strategy.md) · [product-plan.md](product-plan.md)
