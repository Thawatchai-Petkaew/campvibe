# CampVibe — Product Plan (RESET, by Persona)

> **แผนหลัก (authoritative)** — reset ใหม่ทั้งหมด จัดตาม 3 ฝั่งผู้ใช้ + ติด status ตามความจริงในโค้ด (audit 2026-06-20 โดย product-owner ×3 + Explore)
> แทนที่มุมมอง category ใน [FEATURE-BACKLOG.md](FEATURE-BACKLOG.md) (เก็บไว้เป็น cross-reference) · ทุก item ที่เลือกทำ → แปลงเป็น TICKET ที่ intake/G1
> Status: ✅ DONE (ใช้ได้จริง) · 🟡 PARTIAL (มีแต่ไม่ครบ/มีช่องโหว่) · ⬜ TODO (ยังไม่มี) · 🔵 IN-FLIGHT (อยู่ในลูป) · Effort S/M/L · Phase 1 core-real / 2 AI+depth / 3 scale

## ⚠️ นิยาม "Admin" (กันสับสน)
- **Platform Admin** = ผู้ดูแลแพลตฟอร์ม (เจ้าของธุรกิจ) — `User.role='ADMIN'` → **แผนฝั่ง Admin ด้านล่างคืออันนี้**
- **Team Admin** = role `ADMIN` ใน 5-role RBAC ของทีม host (OWNER/ADMIN/MANAGER/STAFF/VIEWER) — เป็นส่วนหนึ่งของฝั่ง **Host**

---

## 📊 Coverage Summary — "แผนครบหรือยัง?"

| ฝั่ง | ✅ Done | 🟡 Partial | ⬜ Todo | 🔵 In-flight | ความครบของ "ระบบที่ใช้จริง" |
|---|---|---|---|---|---|
| **Host** | ~9 | ~12 | ~22 | 0 | 🟡 จัดการลาน/จอง/ทีม ใช้ได้ — **แต่ไม่มีรับเงิน/payout/KYC/แจ้งเตือน/ปฏิทินบล็อกวัน** |
| **Camper** | ~22 | ~9 | ~20 | 1 | 🟡 ค้นหา→ดู→จอง→ติดตาม ใช้ได้ — **แต่จ่ายเงินไม่ได้, ไม่มี confirmation/email, รีวิวไม่กันของปลอม** |
| **Admin** | ~0 | ~3 | ~40 | 0 | 🔴 **แทบไม่มีจริง** — ไม่มี /admin, ไม่มี KYC review, มีช่องโหว่ security |

**คำตอบสั้น ๆ:** Host/Camper มี "core loop" ครบพอเดโม แต่ยังไม่ใช่ marketplace จริง (ติดเรื่องเงิน+สื่อสาร) · **Admin ยังไม่มีแผนที่ลงมือเลย — ต้องสร้างเกือบทั้งหมด** · และมี **foundation ร่วม** (payment, notification, AI, security) ที่ค้ำหลาย persona พร้อมกัน → แยกเป็น section F

---

## 👤 HOST (เจ้าของลาน / operator)

### H-1 Become a host & KYC
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| H-1.1 | Host landing + CTA สมัคร | 🟡 | S | 1 | `app/host/page.tsx` มี แต่เขียน "verification coming next round" |
| H-1.2 | Business info (ชื่อธุรกิจ/นิติบุคคล/taxId/ที่อยู่) | 🟡 | M | 1 | schema มี field แต่ไม่มี UI เก็บ → null ทุก user |
| H-1.3 | KYC upload เอกสาร (บัตร/ทะเบียน) | ⬜ | L | 1 | schema พร้อม (`kycStatus/kycDocuments/...`) แต่ไม่มี UI/API เลย |
| H-1.4 | Onboarding checklist/progress | ⬜ | M | 2 | — |

### H-2 Create & manage listing
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| H-2.1 | สร้าง/แก้/ลบ campsite | ✅ | M | 1 | `components/CampgroundForm.tsx`, `app/api/campgrounds/route.ts` — core ใช้ได้ |
| H-2.2 | Publish/Unpublish | 🟡 | S | 1 | toggle อยู่ในฟอร์ม; ไม่มีปุ่มลัดที่หน้า list |
| H-2.3 | Spot/zone CRUD + ราคาต่อ spot | ✅ | M | 1 | `app/api/campsites/[id]/spots/route.ts` |
| H-2.4 | จัดการแกลเลอรีรูป (เรียง/ลบทีละรูป/ปก) | ⬜ | M | 2 | รูปเก็บเป็น CSV string — แก้ทีละรูปไม่ได้ |
| H-2.5 | Listing preview (ดูแบบ guest ก่อน publish) | ⬜ | S | 2 | — |
| H-2.6 | **AI Listing Builder** (FB/รูป→ร่าง listing) ⭐wedge A | ⬜ | L | 2 | ต้อง AI infra (F-3) |
| H-2.7 | AI auto-tag รูป/ประเภทวิว | ⬜ | M | 3 | ต้อง F-3 |

### H-3 Inventory & calendar
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| H-3.1 | คำนวณ capacity ต่อวัน (API) | ✅ | M | 1 | `lib/campsite-availability.ts` |
| H-3.2 | ปฏิทิน host (เห็นการจองแบบเดือน) | ⬜ | M | 1 | ตอนนี้เป็นตารางใน `app/dashboard/bookings` |
| H-3.3 | **บล็อกวันเอง** (ปิดวันซ่อม/งานส่วนตัว) | ⬜ | M | 1 | ไม่มี BlockedDate model — host ต้องสร้าง booking ปลอม |
| H-3.4 | กฎ min/max nights, advance window | ⬜ | M | 2 | — |
| H-3.5 | Inventory lock กัน overbooking (atomic) | 🟡 | M | 1 | เช็ค overlap แล้วแต่ไม่มี DB lock/transaction → race ได้ (F-1.x) |

### H-4 Bookings management
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| H-4.1 | ดูรายการจอง (ตาราง+filter+pagination) | ✅ | M | 1 | `app/api/operator/bookings/route.ts` |
| H-4.2 | ยืนยัน/ยกเลิกการจอง | ✅ | S | 1 | PATCH + RBAC `BOOKING_UPDATE` |
| H-4.3 | Auto-confirm option | ⬜ | S | 2 | `bookingMethod` มีใน schema แต่ logic ไม่ใช้ |
| H-4.4 | หน้า booking detail + special requests | ⬜ | M | 1 | ไม่มี `/dashboard/bookings/[id]`, ไม่มี field notes |
| H-4.5 | Mark completed / no-show | 🟡 | S | 1 | API รองรับ COMPLETED แต่ไม่มีปุ่ม; ไม่มี NO_SHOW |
| H-4.6 | Cancellation policy + refund rule | ⬜ | L | 2 | ต้อง F-1 payment |
| H-4.7 | Export bookings (CSV) | ⬜ | S | 2 | — |

### H-5 Get paid (เงิน) — ดู F-1
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| H-5.1 | รับชำระเงินออนไลน์ (ผ่าน F-1) | ⬜ | L | 1 | totalPrice เก็บแต่ไม่ charge |
| H-5.2 | Payout/settlement + บัญชีธนาคาร host | ⬜ | L | 1 | ไม่มี model |
| H-5.3 | รายงานรายได้ + กราฟ | 🟡 | M | 1 | dashboard มีตัวเลขรวม แต่ "+20.1%" hardcode, ไม่มีกราฟ |
| H-5.4 | ใบเสร็จ/ภาษี (หัก ณ ที่จ่าย 3% อุทยาน) | ⬜ | L | 3 | ข้อกำหนดไทย |
| H-5.5 | ค่าธรรมเนียมแพลตฟอร์ม (fee config) | ⬜ | M | 2 | — |

### H-6 Communicate — ดู F-2
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| H-6.1 | Notification center (in-app polling) | 🟡 | M | 1 | `components/NotificationCenter.tsx` — มีแต่ poll 30s |
| H-6.2 | Email แจ้งจอง/ยกเลิก (Resend) | ⬜ | M | 1 | ไม่มี email infra เลย |
| H-6.3 | LINE notify host เมื่อมีจอง | ⬜ | M | 1 | `lineId` เก็บไว้แต่ไม่ได้ใช้ส่ง |
| H-6.4 | กล่องแชต guest-host | ⬜ | L | 2 | ไม่มี Message model |
| H-6.5 | AI auto-reply (LINE/in-app) | ⬜ | L | 3 | ต้อง H-6.4 + F-3 |

### H-7 Team & staff (RBAC)
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| H-7.1 | 5-role RBAC model | 🟡 | M | 1 | `lib/team-permissions.ts` ดี — แต่ **enforcement ไม่ครบ** หลาย endpoint owner-only |
| H-7.2 | เพิ่ม/แก้/ลบ team member + UI | 🟡 | M | 1 | `components/settings/TeamManagement.tsx` |
| H-7.3 | เชิญ user ที่ยังไม่สมัคร (invite by email) | ⬜ | M | 2 | ตอนนี้ต้องให้สมัครก่อน |
| H-7.4 | Audit log ทีม (ใครทำอะไร) | ⬜ | M | 3 | ดู F-4 |

### H-8 Reviews & reputation
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| H-8.1 | แสดงรีวิว/คะแนนเฉลี่ยใน dashboard | 🟡 | S | 1 | dashboard นับจำนวน แต่ไม่โชว์เฉลี่ย |
| H-8.2 | Host ตอบรีวิว | ⬜ | M | 2 | ไม่มี field reply |
| H-8.3 | ขอรีวิวหลังเข้าพัก (auto) | ⬜ | M | 2 | ต้อง email |

### H-9 Analytics
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| H-9.1 | KPI cards (รายได้/จอง/จำนวนลาน) | 🟡 | M | 1 | มี แต่ revenue = ประมาณการ (ไม่มี payment จริง) |
| H-9.2 | กราฟรายได้/occupancy | ⬜ | M | 2 | ไม่มี chart lib |
| H-9.3 | AI occupancy forecast / dynamic pricing | ⬜ | L | 3 | ต้อง F-3 |

---

## 🏕️ CAMPER (นักแคมป์ / ผู้จอง)

### C-1 Discover & search
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| C-1.1 | หน้าแรก grid + category bar | ✅ | — | 1 | `app/page.tsx` (cap 40, ยังไม่มี pagination จริง) |
| C-1.2 | ค้นหา keyword + filter (ราคา/สิ่งอำนวย/กิจกรรม/ภูมิประเทศ/จังหวัด/อำเภอ/วันที่) | ✅ | — | 1 | `lib/campsite-filters.ts` ครบมาก |
| C-1.3 | Sort ราคา | ✅ | — | 1 | — |
| C-1.4 | Sort คะแนนรีวิว | 🟡 | S | 1 | branch มีแต่ fallback เป็น createdAt (ไม่ได้เรียงจริง) |
| C-1.5 | filter จำนวนคน = ตาม capacity จริง | 🟡 | S | 1 | parse param แล้วแต่ไม่กรองด้วย maxGuests → กลุ่ม 20 เจอลาน 4 คนได้ |
| C-1.6 | Map-based search (คลิกแผนที่/วาดพื้นที่) | ⬜ | L | 2 | map มีแค่หน้า detail |
| C-1.7 | **AI NL Search** ("ริมน้ำ เงียบ หมาเข้าได้ ≤2ชม") | ⬜ | L | 2 | ต้อง F-3 + pgvector |
| C-1.8 | Save search / alerts | ⬜ | M | 3 | — |

### C-2 Detail & reviews
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| C-2.1 | หน้า detail เต็ม (รูป/สิ่งอำนวย/กิจกรรม/เวลา/ติดต่อ) | ✅ | — | 1 | `CampgroundDetailClient.tsx` |
| C-2.2 | Image gallery + amenities modal | ✅ | — | 1 | — |
| C-2.3 | แผนที่ Leaflet (พิน) | 🟡 | — | 1 | พื้นฐาน ไม่มีนำทาง |
| C-2.4 | **ปุ่มนำทาง Google Maps** (lat/lon มีแล้ว) | ⬜ | S | 1 | คุ้มสุดต่อ effort — แค่ลิงก์เดียว |
| C-2.5 | แสดงรีวิว + ดาวเฉลี่ย | 🟡 | S | 1 | ไม่มี aggregate เก็บใน schema |
| C-2.6 | ratings breakdown (histogram) | ⬜ | S | 2 | — |
| C-2.7 | **AI Review Summary** (สรุปดี/เสีย) | ⬜ | M | 2 | ต้อง F-3 |
| C-2.8 | รูปในรีวิว (mediaUrls) | 🟡 | M | 2 | field มี แต่ไม่มี upload UI |

### C-3 Availability & booking
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| C-3.1 | ปฏิทิน availability real-time (capacity เหลือ) | ✅ | — | 1 | ดึง 3 เดือนล่วงหน้า |
| C-3.2 | ฟอร์มจอง + สรุปราคา | ✅ | — | 1 | — |
| C-3.3 | สร้าง booking (PENDING) + validate overlap/capacity | ✅ | — | 1 | `app/api/bookings/route.ts` |
| C-3.4 | ความโปร่งใสค่าธรรมเนียม | 🟡 | S | 1 | **bug:** UI โชว์ค่าทำความสะอาด/บริการ (20+35) แต่ totalPrice ที่เก็บไม่รวม |
| C-3.5 | หน้า confirmation + booking reference | 🟡 | S | 1 | ตอนนี้ redirect ไป /bookings ใน 1.5s ไม่มีหน้า success |
| C-3.6 | Special requests/notes | ⬜ | S | 2 | ไม่มี field |
| C-3.7 | Guest checkout (จองไม่ต้อง login) | ⬜ | L | 3 | — |

### C-4 Pay — ดู F-1
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| C-4.1 | ชำระเงิน (PromptPay/บัตร ผ่าน F-1) | ⬜ | L | 1-2 | ไม่มี paymentStatus ใน Booking |
| C-4.2 | E-receipt/ใบกำกับ (PDF) | ⬜ | M | 2 | — |
| C-4.3 | Refund ตอนยกเลิก | ⬜ | L | 2 | — |

### C-5 Pre-trip & my bookings
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| C-5.1 | My bookings list (ของตัวเอง) | ✅ | — | 1 | `app/bookings/page.tsx` ใช้ได้จริง |
| C-5.2 | Status badge + ยกเลิกเอง | ✅ | — | 1 | camper ทำได้แค่ CANCELLED |
| C-5.3 | Status label แปลไทย | 🟡 | S | 1 | โชว์ "PENDING/CONFIRMED" ดิบ |
| C-5.4 | หน้า booking detail `/bookings/[id]` | ⬜ | S | 1 | ไม่มี |
| C-5.5 | Filter upcoming/past/cancelled | ⬜ | S | 2 | list เดียวยาว |
| C-5.6 | Email/LINE ยืนยันจอง (ผ่าน F-2) | ⬜ | M | 1 | — |
| C-5.7 | QR/booking ref ใช้เช็คอิน | ⬜ | M | 2 | — |
| C-5.8 | Weather widget ช่วงวันจอง | ⬜ | M | 3 | — |
| C-5.9 | AI trip/route planner | ⬜ | L | 3 | ต้อง F-3 |

### C-6 Post-trip & re-engage
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| C-6.1 | เขียนรีวิว (ดาว/หัวข้อ/เนื้อหา) | 🟡 | M | 1 | สร้างได้ — **แต่ไม่มี auth/verified-stay** (ดู F-4.3) |
| C-6.2 | Verified-stay gate | ⬜ | S | 1 | ผูกกับ booking CONFIRMED/COMPLETED |
| C-6.3 | แก้/ลบรีวิวของตัวเอง | ⬜ | S | 2 | — |
| C-6.4 | **Wishlist** (บันทึกแคมป์) | 🔵 | M | 1 | **TICKET-0001 — ผ่าน G1 รอ G2** |
| C-6.5 | Share (คัดลอกลิงก์/LINE) | ⬜ | S | 2 | ไอคอน Share import ไว้แต่ไม่ wire |
| C-6.6 | LINE login | ⬜ | M | 2 | — |
| C-6.7 | Loyalty/points | ⬜ | L | 3 | — |

---

## 🛡️ ADMIN (Platform Admin) — 🔴 แทบไม่มีจริง

> **Critical:** ไม่มี `/admin` route, ไม่มีหน้า admin, ไม่มี guard `role='ADMIN'` ฝั่ง server, `role` ไม่ถูกใส่ใน NextAuth JWT (ทำให้ ADMIN bypass ไม่ทำงาน), admin login แล้วเด้งเข้า dashboard host ที่ข้อมูลว่าง

### A-1 KYC verification queue
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| A-1.1 | host ส่ง KYC (เชื่อม H-1.3) | ⬜ | M | 1 | ไม่มี API เขียน kycStatus เลย |
| A-1.2 | คิว KYC ให้ admin review | ⬜ | M | 1 | สร้าง end-to-end |
| A-1.3 | อนุมัติ/ปฏิเสธ (+เหตุผล) + แจ้ง host | ⬜ | M | 1 | schema field พร้อม (kycReviewedBy/RejectionReason) |
| A-1.4 | AI ช่วยตรวจเอกสาร | ⬜ | L | 3 | ต้อง F-3 |

### A-2 Campsite moderation
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| A-2.1 | รายการลานทั้งหมด (ทุก owner) | ⬜ | S | 1 | ไม่มี endpoint admin |
| A-2.2 | Verify ลาน (isVerified) **admin-only** | 🟡 | S | 1 | field มี แต่ **ใครมี CAMPSITE_UPDATE ก็ติ๊กได้** → security (F-4.2) |
| A-2.3 | ระงับ/takedown ลาน + audit | ⬜ | M | 2 | — |
| A-2.4 | Featured/promoted ลาน | ⬜ | M | 2 | ต้อง migration |

### A-3 User management
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| A-3.1 | รายชื่อ user + ค้นหา/filter | ⬜ | M | 1 | — |
| A-3.2 | เปลี่ยน role (CAMPER/OPERATOR/ADMIN) | ⬜ | S | 1 | ต้อง audit |
| A-3.3 | ระงับ/แบน user | ⬜ | M | 1 | User ไม่มี field isBanned/status |
| A-3.4 | Support tools (impersonate, reset pw) | ⬜ | L | 3 | compliance risk |

### A-4 MasterData / taxonomy
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| A-4.1 | CRUD MasterData (สิ่งอำนวย/กิจกรรม ฯลฯ) | ⬜ | S | 2 | ตอนนี้แก้ต้อง re-seed/SQL |
| A-4.2 | จัดการ ThailandLocation | ⬜ | M | 3 | — |

### A-5 Reviews & content moderation
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| A-5.1 | รายการรีวิวทั้งหมด (filter) | ⬜ | S | 2 | — |
| A-5.2 | ซ่อน/ลบรีวิว | ⬜ | M | 2 | ไม่มี field isHidden, ไม่มี DELETE |
| A-5.3 | ผู้ใช้ report รีวิว | ⬜ | M | 2 | — |
| A-5.4 | AI fake-review detection | ⬜ | L | 3 | ต้อง F-3 |

### A-6 Bookings/disputes · A-7 Payments oversight · A-8 Analytics · A-9 Trust&Safety · A-10 System
| ID | Feature | Status | Effort | Phase | Note |
|---|---|---|---|---|---|
| A-6.1 | view การจองทั้งแพลตฟอร์ม | ⬜ | M | 1 | operator endpoint scope แค่ลานตัวเอง |
| A-6.2 | dispute/ร้องเรียน + workflow | ⬜ | L | 2 | ไม่มี Dispute model |
| A-7.1 | payout queue/approval + reconciliation | ⬜ | L | 2 | ต้อง F-1 |
| A-8.1 | KPI ทั้งแพลตฟอร์ม (GMV/จอง/host/camper funnel) | ⬜ | M | 2 | — |
| A-9.1 | **Audit log** (ใครทำอะไรเมื่อไหร่) | ⬜ | L | 1 | ต้องมีก่อน admin write ใด ๆ (F-4) |
| A-9.2 | Rate limiting public API | ⬜ | M | 1 | /api/reviews,/api/bookings เปิดโล่ง |
| A-10.1 | **ปิด/ป้องกัน seed endpoints** | ⬜ | S | 1 | 🔴 `/api/seed`,`/api/bulk-seed`,`/api/scrape-seed` ไม่มี auth — ใครก็เรียกได้ (F-4.1) |
| A-10.2 | CMS หน้าแรก / featured / email template | ⬜ | L | 3 | — |

---

## 🧱 F. Foundations ร่วม (ค้ำหลาย persona — ทำทีเดียวปลดล็อกหลายช่อง)

### F-1 Payment & money (ปลดล็อก H-5, C-4, A-7)
| ID | Item | Status | Effort | Phase |
|---|---|---|---|---|
| F-1.1 | Payment gateway (Omise/2C2P + **PromptPay QR**) | ⬜ | L | 1 |
| F-1.2 | `Payment`/`Payout` model + paymentStatus บน Booking | ⬜ | L | 1 |
| F-1.3 | Refund + cancellation policy engine | ⬜ | L | 2 |
| F-1.4 | Inventory lock atomic (transaction/SELECT FOR UPDATE) | ⬜ | M | 1 |

### F-2 Notifications (ปลดล็อก H-6, C-5.6)
| ID | Item | Status | Effort | Phase |
|---|---|---|---|---|
| F-2.1 | Email infra (Resend) + templates | ⬜ | M | 1 |
| F-2.2 | LINE Messaging API (notify→login→booking) | ⬜ | M-L | 1-2 |
| F-2.3 | Notification model (persistent read/unread) | ⬜ | M | 2 |

### F-3 AI infra (ปลดล็อก H-2.6/H-9.3, C-1.7/C-2.7/C-5.9, A-1.4/A-5.4)
| ID | Item | Status | Effort | Phase |
|---|---|---|---|---|
| F-3.1 | Anthropic SDK + `ANTHROPIC_API_KEY` + prompt layer | ⬜ | S | 1 |
| F-3.2 | `pgvector` + embeddings pipeline (สำหรับ NL search) | ⬜ | M | 2 |
| F-3.3 | **AI Review Summary** = ตัว build แรกที่พิสูจน์ F-3 (quick win) | ⬜ | S | 1 |

### F-4 Security & tech-debt (🔴 ต้องเคลียร์ก่อน production)
| ID | Item | Status | Severity | Note |
|---|---|---|---|---|
| F-4.1 | ปิด auth ให้ seed endpoints | ⬜ | 🔴 | `/api/seed`,`/api/bulk-seed`,`/api/scrape-seed` เปิดโล่ง — รีเซ็ต DB ได้ |
| F-4.2 | `isVerified` เขียนได้เฉพาะ platform-admin | ⬜ | 🔴 | ตอนนี้ MANAGER ก็ติ๊กได้ |
| F-4.3 | `/api/reviews` POST ต้อง auth + authorId จาก session (ไม่ใช่ body) + verified-stay | ⬜ | 🔴 | ตอนนี้ใครก็โพสต์รีวิวเป็นใครก็ได้ |
| F-4.4 | ใส่ `role` ลง NextAuth JWT (ADMIN bypass ใช้งานได้จริง) | ⬜ | 🟠 | latent bug |
| F-4.5 | **Migration ↔ schema drift** (ThailandLocation/MasterData ไม่มีใน migration) | ⬜ | 🔴 | deploy SIT/UAT/prod พัง — ต้อง migration ใหม่ |
| F-4.6 | seed stale `contacts` (patched, รอ commit) | 🟡 | 🟡 | แก้ใน working tree แล้ว |
| F-4.7 | RBAC enforcement ให้ครบทุก endpoint (H-7.1) | ⬜ | 🟠 | หลาย endpoint owner-only |
| F-4.8 | Test coverage ≥80% โค้ดใหม่ + CI | ⬜ | 🟡 | กฎ quality-gate |

### F-5 Analytics
| ID | Item | Status | Effort | Phase |
|---|---|---|---|---|
| F-5.1 | PostHog (funnel + session replay) | ⬜ | S | 2 |
| F-5.2 | Chart lib สำหรับ dashboard | ⬜ | S | 2 |

---

## 🗺️ ลำดับที่แนะนำ (sequencing)
- **P0 ก่อนทุกอย่าง (deploy/security blocker):** F-4.5 migration · F-4.1/4.2/4.3 security · F-4.6 commit seed patch
- **Phase 1 — ทำ core loop ให้ "จริง":** F-3.3 AI Review Summary (quick win พิสูจน์ F-3) → F-2.1 email → C-2.4 ปุ่มนำทาง (คุ้มสุด) → C-3.4/C-3.5 fix ราคา+confirmation → H-3.3 บล็อกวัน → H-7.1 RBAC enforcement → A-1+A-9.1+A-10.1 admin/KYC/audit baseline → [F-1 payment ถ้าจะเปิดจ่ายเงินรอบนี้]
- **Phase 2 — AI depth / wedge A:** H-2.6 AI Listing Builder → F-2.2 LINE → C-1.7 NL Search → F-5 analytics
- **คู่ขนาน:** ปิด 🔵 TICKET-0001 Wishlist (G2→merge)

## ⛳ รอ G1 (มนุษย์): จะรัน delivery loop ตัวถัดไปกับอะไร
ตัวเลือกหลัก: **(ก)** P0 security/migration ก่อน · **(ข)** F-3.3 AI Review Summary quick win · **(ค)** ปิด Wishlist ที่ค้าง · **(ง)** เปิด epic Admin (A-1 KYC + A-9/A-10 baseline) · **(จ)** F-1 payment เปิด core loop จริง
