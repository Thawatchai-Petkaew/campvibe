# Platform Blueprint — CampVibe (v6 pivot)

> **source-of-truth รูปทรงแพลตฟอร์ม + ลำดับการสร้าง (sequencing)** — สืบทอด (supersede) รายละเอียด roadmap ที่เคยอยู่ใน `master-plan.md` §Roadmap (บรรทัด Next/Later เดิม); `master-plan.md` ยังคงเป็น SoT ของ vision/mission/north-star/pillars
> ที่มา: งานวิจัยของเจ้าของ "Platform Blueprint v6" (2026-07) — กลั่นเป็นเอกสารทำงานฉบับนี้ (ไม่ใช่ก็อปดิบ)
> สถานะ: **Proposed** — ratified เมื่อ PR นี้ merge (= G1 ของ pivot นี้)

## 1. Launch funnel

CampVibe เปลี่ยนจาก marketplace-จองสาธารณะ (public booking/payment) ไปเป็น **HostOS-first**: จองสาธารณะ/payment **ถูกเลื่อนออกจาก initial launch** จนกว่าจะผ่าน BookingReadinessGate (§3, M7.5)

ลำดับ funnel วันเปิดตัว:

```
Discover → Inquiry/Quote → Host Lead Inbox → Quote → Manual Hold → Deposit Record → Manual Stay → POS/Rental → Daily Close
```

จุดยืนเชิงเศรษฐกิจ (economic stance): **Host เป็นคนถือเงิน (handle money) — แพลตฟอร์มเป็นแค่ ledger/workflow** ไม่ใช่ payment processor; ตัดภาระ refund/dispute/payout/fraud ที่มาพร้อม marketplace จริงออกจนกว่าจะพิสูจน์ supply/demand แล้ว

## 2. 8 product layers

| Layer | คืออะไร | Milestone | สถานะใน code วันนี้ |
|---|---|---|---|
| **HostOS / POS-ERP Lite** | back-office ให้ host: lead inbox → quote → hold/deposit → stay → POS/rental → daily close | M1.2 | greenfield |
| **Host Map Builder** | สร้างแผนที่แคมป์ 2D relative ก่อน (ลาน→โซน→จุดกาง / Campground→Zone→Pitch) | M1.5 | greenfield |
| **AI Assistant** | Discover→**Inquiry** (ไม่ใช่ Book) — ค้นหา/ถามสด แล้วส่งต่อเป็นคำขอเข้า lead inbox | M2 | greenfield (tool layer มีสเปกแล้วใน ADR-009, ยังไม่ build) |
| **Trip OS** | วางแผนทริป/เส้นทาง หลัง stay สำเร็จ | M3 | greenfield |
| **Gear Identity** | ข้อมูลอุปกรณ์แคมป์ของผู้ใช้ | M4 | greenfield |
| **Setup Community** | โชว์/แชร์ setup การกางเต็นท์ | M5 | greenfield |
| **Affiliate Hub** | พาร์ทเนอร์/ลิงก์พาไปซื้ออุปกรณ์ | M6 | greenfield |
| **Secondhand Marketplace** | ซื้อขายอุปกรณ์มือสอง (ลำดับสุดท้าย) | M8 | greenfield |

หมายเหตุ: ทุก layer เป็น greenfield ยกเว้นฐานที่ส่งมอบแล้ว (M0 — catalog, reserve-flow foundation แบบไม่มี payment, host dashboard+RBAC, availability lib) ซึ่งเป็นรากที่ M1/M1.2 ต่อยอด ไม่ใช่ layer ใหม่

## 3. Milestone ladder (M0–M8)

| Milestone | Scope | Entry / exit criteria | ระยะเวลาโดยประมาณ |
|---|---|---|---|
| **M0 — Baseline** (ส่งมอบแล้ว) | catalog, reserve-flow foundation (ไม่มี payment), host dashboard + RBAC, availability lib | เข้า: จุดเริ่ม · ออก: deploy แล้วบน staging/prod | เสร็จแล้ว |
| **M1 — Data & Trust** | availability ถูกต้อง (BlockedDate + partial capacity + hold), final price/fee/cancellation เป็น atomic field, verified-stay review gate, rule-based listing quality score + missing-data checklist | เข้า: M0 พร้อม · ออก: ทั้ง 4 รายการผ่าน AC/QA | 2–4 สัปดาห์ |
| **M1.2 — HostOS core** | lead inbox (manual-first), quote builder, hold & deposit ledger, manual stay, POS lite, rental lite, daily close; AI lead parser เป็นรายการ**สุดท้าย**และ spend-gated | เข้า: M1 เสร็จ · ออก: host ปิด lead→stay→daily close ได้ครบ loop โดยไม่ต้องใช้ AI parser | 4–6 สัปดาห์ |
| **M1.5 — Host Map** | model `CampZone`/`CampMap`, 2D SVG canvas builder, zone/pitch editors, facility matrix, guest interactive map → inquiry CTA | เข้า: M1.2 core ใช้งานได้ · ออก: host วาดแผนที่ตัวเองได้ + guest เห็นแผนที่ + กด CTA สอบถามได้ | 4–6 สัปดาห์ |
| **M2 — AI Discover→Inquiry** | NL search, live availability Q&A, การ์ดในแชท, ส่งต่อ inquiry เข้า HostOS lead inbox; runtime = OpenRouter | เข้า: **ต้องมีทั้ง** M1 (data ถูกต้อง) และ M1.2 (lead inbox พร้อมรับ) · ออก: assistant ส่ง inquiry เข้า lead inbox จริงบน staging | 6–10 สัปดาห์ |
| **M3 — Trip OS** | วางแผนทริป/เส้นทางหลัง stay สำเร็จ | เข้า: M2 เสร็จ · ออก: TBD (ยังไม่ discover ละเอียด) | not measured |
| **M4 — Gear Identity** | ข้อมูลอุปกรณ์แคมป์ของผู้ใช้ | เข้า: M3 เสร็จ · ออก: TBD | not measured |
| **M5 — Setup Community** | โชว์/แชร์ setup การกางเต็นท์ | เข้า: M4 เสร็จ · ออก: TBD | not measured |
| **M6 — Affiliate Hub** | พาร์ทเนอร์/ลิงก์พาไปซื้ออุปกรณ์ | เข้า: M5 เสร็จ · ออก: TBD | not measured |
| **M7 — 2.5D showcase** | ยกระดับภาพ/ผังแคมป์เป็น 2.5D | เข้า: M6 เสร็จ · ออก: TBD | not measured |
| **M7.5 — OPTIONAL Booking Engine** | เปิด public booking/payment กลับมา — **readiness-gated ต่อ campsite** ไม่ใช่ทั้งแพลตฟอร์มพร้อมกันครั้งเดียว | ผ่าน **BookingReadinessGate** ทั้ง 5 ข้อ (เจ้าของตัดสินใจเป็นราย campsite): (1) HostOS daily-active adoption ≥ เป้า · (2) map/zone/pitch completeness ≥ เป้า · (3) double-hold incidents = 0 · (4) cancellation/refund policy ครบ · (5) support playbook + audit trail พร้อม | readiness-gated, ไม่ตั้งเวลาตายตัว |
| **M8 — Secondhand Marketplace** | ซื้อขายอุปกรณ์มือสอง (ลำดับสุดท้ายตาม blueprint) | เข้า: M7 เสร็จ · ออก: TBD | not measured |

จนกว่า campsite หนึ่งจะผ่าน gate: ทุก CTA ที่ดูเหมือน "จอง" ต้องใช้คำ **สอบถาม / ขอราคา / ส่งคำขอ** แทน (ดู §4 ข้อ 4)

### 3.1 ชื่อบนบอร์ด /status (owner rule 2026-07-04)

รหัส milestone (M0/M1/…) เป็น**ตัวบอกลำดับในเอกสารนี้เท่านั้น** — บนบอร์ดทุกชื่อ (เลน/epic/story) เป็นภาษาอังกฤษที่สื่อสารด้วยตัวเองโดยไม่ต้องเปิดเอกสาร รหัส blueprint (OS1, HM3, …) อยู่ในวงเล็บท้ายชื่อ (convention เต็ม: `.claude/commands/camper.md`)

| Milestone | เลนบนบอร์ด (featureName) |
|---|---|
| M0 | Platform Core |
| M1 | Data & Trust |
| M1.2 | HostOS |
| M1.5 | Camp Map & Host Onboarding |
| M2 | AI Assistant |
| M3 | Trip OS |
| M4 | Gear Locker |
| M5 | Community |
| M6 | Affiliate Hub |
| M7 | Setup Showcase (Future) |
| M7.5 | Booking Engine (Gated) |
| M8 | Secondhand Marketplace (Future) |
| ข้ามชั้น | Trust & Admin |

## 4. Guardrails (4 ข้อ — บังคับทุก milestone)

1. **AI ไม่ auto-publish แผนที่** — ทุก draft ที่ AI สร้าง (แผนที่/โซน/ข้อมูล) ต้องให้ host ยืนยันก่อนเผยแพร่เสมอ
2. **AI ไม่เขียนเงิน/availability โดยไม่ผ่าน host ยืนยัน** — AI drafts/summarizes/suggests เท่านั้น ไม่ commit การเปลี่ยนแปลงที่กระทบเงินหรือที่ว่างโดยตรง
3. **Deterministic core vs AI-assist layer แยกกันชัด** — ledger, availability, state transitions, daily-close math ต้อง deterministic (ไม่พึ่ง AI); AI อยู่ใน layer แยกที่ทำได้แค่ draft/summary/suggestion
4. **กฎคำ CTA** — ตราบใดที่ campsite นั้นยังไม่ผ่าน BookingReadinessGate ปุ่ม/ข้อความที่ดูเหมือน "จอง" ต้องเปลี่ยนเป็น สอบถาม/ขอราคา/ส่งคำขอ เสมอ

## 5. KPI shift

| | เดิม | ใหม่ |
|---|---|---|
| North-star | Booking สำเร็จ/เดือน + conversion ค้นหา→จอง | **confirmed stays/เดือน** (north-star recommendation) + qualified inquiries |
| Input metrics เพิ่ม | — | lead→close rate, host daily/weekly-active usage, ledger accuracy |
| Guardrail เพิ่ม | อัตรา booking ล้มเหลว | double-hold = 0, ledger mismatch = 0 (คง CWV + security guardrail เดิม) |

metric SoT ที่ฟันธงตัวเลขเป้าจริงอยู่ที่ [product-strategy.md](product-strategy.md) — ไฟล์นี้ระบุแค่ "อะไรคือ metric" ไม่ใช่ "เป้าเท่าไหร่"

## 6. เกี่ยวข้อง

[ADR-011](../adr/ADR-011-strategy-pivot-hostos-first.md) (ตัดสินใจ + rationale + alternatives) · [product-plan.md](product-plan.md) (feature backlog รายละเอียด — ต้อง re-sequence ตาม ladder นี้ในรอบถัดไป) · [ai-product-roadmap.md](ai-product-roadmap.md) (AI requirement table — cluster C ต้อง amend ตาม ADR-009 `## Amendment 2026-07`) · [business.md](business.md) (revenue model ยังเป็น TODO — ทิศทางที่เสนอบันทึกไว้ใน ADR-011 เท่านั้น รอเจ้าของยืนยัน)
