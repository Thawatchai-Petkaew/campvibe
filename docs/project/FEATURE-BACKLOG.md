# CampVibe — Feature Backlog (Consolidated)

> รวบรวมโดย orchestrator (Discovery ระดับ epic) — แหล่งข้อมูล: **(1) ความจริงในโค้ด** (codebase scan 2026-06-20) + **(2) เอกสารกลยุทธ์** (CampVibe-Master-Plan.md, CampVibe-Context-Brief.md)
> สถานะนี้คือ "ภาพรวมทั้งหมดที่จะทำ" ก่อนเลือก scope — ยังไม่ใช่การ commit ทำทุกตัว
> อัปเดต: 2026-06-20 · ทุก item ที่ถูกเลือกทำ → แปลงเป็น TICKET ผ่าน intake/G1

## วิธีอ่าน
- **Status:** `REAL` (wired end-to-end, ใช้ได้จริง) · `STUB` (UI/schema มี แต่ backend เป็น mock/ไม่ persist) · `MISSING` (ยังไม่มี) · `IN-FLIGHT` (อยู่ในลูปแล้ว)
- **Effort:** S (≤1–2 stories) · M (3–5) · L (6+/มี infra ใหม่)
- **Phase:** อิง roadmap — 0 Validate(คนล้วน) · 1 Core loop ให้ "จริง" · 2 AI depth · 3 Scale
- **Wedge:** A = operator-first (แนะนำ) · B = camper AI discovery

---

## 0. งานค้างกลางทาง (in-flight) — จัดการก่อน
| ID | Feature | Status | Gate | หมายเหตุ |
|---|---|---|---|---|
| TICKET-0001 | Wishlist (บันทึกแคมป์ที่ถูกใจ) | IN-FLIGHT | G1 ✅ → รอ **G2 (design)** | decisions: guest=prompt-login, single-list, navbar heart. spec: Linear (CAM) |

---

## A. มีแล้ว & ใช้ได้จริง (REAL) — ฐานที่ต่อยอดได้
ไม่ต้องสร้างใหม่ แต่บางตัวมี "ขอบ" ที่ต้องเสริม (ดู section B/C)

| Feature | Status | Evidence | ขอบที่ยังขาด |
|---|---|---|---|
| Auth (NextAuth v5 credentials + bcrypt + middleware) | REAL | `lib/auth.ts`, `middleware.ts` | ยังไม่มี LINE/social login |
| CampSite CRUD (operator) | REAL | `app/api/campgrounds/route.ts`, `components/CampgroundForm.tsx` | — |
| Spot management | REAL | `app/api/campsites/[id]/spots/route.ts` | — |
| Booking (create + availability check + price calc) | REAL* | `app/api/bookings/route.ts`, `lib/campsite-availability.ts` | *ไม่มีการ "ชำระเงิน" — totalPrice แค่เก็บ ไม่ได้ charge; ยังไม่กัน concurrency จริง |
| Search / filter (type/price/facilities/activities/terrain/จังหวัด/อำเภอ/วันที่/จำนวนคน) | REAL | `lib/campsite-filters.ts`, `app/api/locations/search/route.ts` | — |
| Team management + RBAC (5 roles) | REAL* | `lib/team-permissions.ts`, `app/api/team/members/route.ts` | *enforcement ไม่ครบ — หลาย endpoint เช็คแค่ operatorId ไม่ได้เช็ค permission |
| Reviews (สร้าง/แสดง/เฉลี่ยดาว) | REAL* | `app/api/reviews/route.ts` | *ไม่มี "verified stay" — ใครก็รีวิวได้ |
| Operator/Team Dashboard (stats, permission-filtered) | REAL | `app/api/operator/dashboard/route.ts` | funnel/analytics ยังไม่มี |
| i18n TH/EN | REAL | `contexts/LanguageContext.tsx`, `locales/translations.json` | — |
| Image upload (Vercel Blob) | REAL | `app/api/upload/route.ts` | — |
| Profile | REAL | `app/profile/page.tsx`, `app/api/user/profile/route.ts` | — |
| Map (Leaflet) | REAL* | campsite detail | *พื้นฐาน — ยังไม่มี click-to-select / map search |
| Web scraper (cheerio) | REAL* | `app/api/scrape-seed/route.ts` | *เป็น one-time seeder ดึงจาก what-the-camp เท่านั้น ไม่ได้ต่อ pipeline จริง |

---

## B. Stub / partial — "ทำครึ่งทาง" ต้องเติมให้ครบ
| ID | Feature | Status | ทำไมต้องทำ | Effort | Phase |
|---|---|---|---|---|---|
| BL-B1 | **RBAC enforcement ให้ครบทุก endpoint** | STUB | ตอนนี้ส่วนใหญ่ owner-only ไม่เช็ค permission ตามบทบาท → ช่องโหว่ authz | M | 1 |
| BL-B2 | **Notifications จริง** (ตอนนี้ in-app polling อย่างเดียว) | STUB | ต่อ email/LINE — ดู BL-C2/C3 | M | 1 |
| BL-B3 | **Host onboarding + KYC flow** (schema มี field แต่ไม่มี UI/flow) | STUB | host บอก "verification coming next round"; ต้องมี submit → admin review → APPROVED/REJECTED | M | 1–2 |
| BL-B4 | **Review verified-stay** (กันรีวิวปลอม) | STUB | ผูกรีวิวกับ Booking ที่ completed | S | 2 |
| BL-B5 | **Map enhance** (click-to-select, map-based search) | STUB | UX ค้นหาเชิงพื้นที่ | S–M | 2 |
| BL-B6 | **Billing settings** (หน้า disabled "coming soon") | STUB | ขึ้นกับ payment (BL-C1) | M | 1–2 |

---

## C. Gap to "ใช้ได้จริง" (core loop) — MISSING แต่จำเป็นตาม Phase 1
| ID | Feature | Status | ทำไมต้องทำ | Effort | Phase | Dep |
|---|---|---|---|---|---|---|
| BL-C1 | **Payment gateway** (Omise/2C2P/Stripe + PromptPay) | MISSING | booking ปิด loop ไม่ได้ถ้าไม่จ่ายเงิน; timing ขึ้นกับ wedge (ถ้า A อาจเลื่อน) | L | 1 | — |
| BL-C2 | **Email notifications** (Resend) | MISSING | ยืนยันจอง/แจ้งเตือน host+camper | S–M | 1 | — |
| BL-C3 | **LINE integration** (notify → login → booking) | MISSING | ช่องทางหลักตลาดไทย (pain ผู้ใช้จริง) | M–L | 1–2 | — |
| BL-C4 | **Inventory lock / concurrency** (กัน overbooking จริง) | MISSING | availability เช็คแล้วแต่ยังไม่ atomic lock | M | 1 | — |
| BL-C5 | **Analytics (PostHog)** funnel + session replay | MISSING | วัด core loop, ตัดสินใจด้วยข้อมูล | S | 2 | — |

---

## D. AI Backlog (จาก Master Plan §3 — ทั้งหมด MISSING, ยังไม่มี AI dep ใด ๆ)
> Foundational dep ร่วม: **ANTHROPIC_API_KEY** (+ `pgvector` สำหรับ semantic search)

| ID | Feature AI | ใช้ data | Impact | Effort | Wedge | Phase |
|---|---|---|---|---|---|---|
| BL-AI1 | **สรุปรีวิว** (ดี/เสีย เป็นข้อ ๆ) ⭐ quick win | `Review.content/rating` | สูง | **S** | — | 1 |
| BL-AI2 | **AI สร้าง Listing** จาก FB/รูป → listing TH/EN + tags | scraper + Blob + `CampSite.*` | สูงมาก | L | **A** ⭐ | 2 |
| BL-AI3 | **NL Search** ภาษาธรรมชาติ (semantic) | attributes + embeddings | สูงมาก | L | B | 2 |
| BL-AI4 | ผู้ช่วยจัดทริป/เส้นทาง | `Booking`+`CampSite` | กลาง | M–L | B | 2–3 |
| BL-AI5 | Dynamic pricing | `CampSite`+ประวัติ `Booking` | สูง | M–L | A | 3 |
| BL-AI6 | AI auto-reply/ตอบลูกค้า (LINE) | `CampSite.*` | สูง | M | A | 2–3 |
| BL-AI7 | Auto-tag รูป / classify วิว | `Spot.images` | กลาง | S–M | A | 2–3 |
| BL-AI8 | Occupancy insight/forecast บน dashboard | `Booking` | กลาง | M | A | 3 |
| BL-AI9 | ช่วยตรวจ KYC / รีวิวปลอม | `kycDocuments`,`Review` | กลาง | M | — | 3 |

---

## E. Platform / Quality / Tech-debt (เจอตอนรันแอป — ต้องเคลียร์ก่อน deploy)
| ID | Item | Severity | หมายเหตุ |
|---|---|---|---|
| BL-E1 | **Migration ↔ schema drift** | 🔴 Blocker (deploy) | `ThailandLocation` ไม่ถูกสร้างใน migration ใด ๆ และ `MasterData` ถูกอ้างถึงแต่ไม่ถูกสร้าง — `migrate status` บอก "up to date" ทั้งที่ DB ไม่ตรง schema → `migrate deploy`+seed พังบน SIT/UAT/prod ต้องมี migration ใหม่ที่ create 2 ตารางนี้ |
| BL-E2 | **Seed stale field `contacts`** | 🟡 (patched, รอ commit) | `prisma/seed.ts` ส่ง field `contacts` ที่ไม่มีใน schema — แก้แล้วใน working tree (strip ก่อน write) ยังไม่ commit |
| BL-E3 | Test coverage / CI quality gate | 🟡 | กฎคุม coverage ≥80% โค้ดใหม่ — ปัจจุบันยังไม่เห็น test สำหรับ flow หลัก |

---

## เส้นทางที่แนะนำ (อิง wedge A + roadmap)
- **ทำก่อนทุกอย่าง (foundational):** BL-E1 (migration fix) — ไม่งั้น deploy ไม่ได้
- **Phase 1 (ทำ core loop ให้จริง):** BL-AI1 (quick win พิสูจน์ลูป) → BL-C2 (email) → BL-B1 (RBAC) → BL-C4 (lock) → [BL-C1 payment ถ้าเลือกเปิดจ่ายเงินรอบนี้]
- **Phase 2 (AI depth / wedge A hero):** BL-AI2 (Listing Builder) → BL-C3 (LINE) → BL-AI3 (NL Search) → BL-C5 (analytics)
- **คู่ขนาน:** ปิด TICKET-0001 Wishlist (G2→merge) ที่ค้างอยู่

> **G1 decision ที่รอมนุษย์:** จะรัน delivery loop ตัวถัดไปกับอะไร — ปิด Wishlist ที่ค้าง / เริ่ม BL-AI1 (quick win) / จัดการ BL-E1 (blocker) ก่อน / หรือกระโดดไป wedge-A hero (BL-AI2)
