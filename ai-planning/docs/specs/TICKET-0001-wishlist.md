# Requirements Brief — TICKET-0001: Wishlist (บันทึกแคมป์ที่ถูกใจ)

> สถานะ: `ready` ✅ (ผ่าน Gate G1 แล้ว) · owner: product-owner · updated: 2026-06-20
> *เอกสารนี้ถูกสร้างโดย Discovery loop (§5.5) — ส่วน Open Questions ต้องว่างก่อนผ่าน G1*

## 0. Requirement ดิบ (จากมนุษย์)
"ผู้ใช้อยากบันทึกแคมป์ที่ถูกใจไว้ดูทีหลัง" (Orchestrator เลือกเป็นตัวอย่าง demo)

## 1. Business
- **เป้าหมาย:** เพิ่ม engagement + กลับมาจองภายหลัง (re-engagement)
- **KPI (เสนอ):** % ผู้ใช้ที่ใช้ wishlist, conversion wishlist→booking
- **Scope:** เพิ่ม/ลบ wishlist, ดูรายการ wishlist
- **Out-of-scope (เสนอ):** แชร์ wishlist, แจ้งเตือนราคา/ที่ว่าง, collection หลายอัน

## 2. Functional
- US-1: ในฐานะ camper (ล็อกอิน) กดหัวใจที่การ์ดแคมป์เพื่อบันทึก → ขึ้นทันที (optimistic)
- US-2: ดูหน้า "Wishlist ของฉัน" รวมแคมป์ที่บันทึก
- US-3: กดหัวใจซ้ำเพื่อเอาออก
- AC: Given ล็อกอินแล้ว / When กดหัวใจ / Then บันทึก + ไอคอนเปลี่ยนสถานะ + คงอยู่หลัง refresh

## 3. Technical
- **Data model:** เพิ่ม `model Wishlist { id, userId, campSiteId, createdAt @@unique([userId, campSiteId]) }` + relation เข้า `User` และ `CampSite` (Prisma migration)
- **API:** `POST/DELETE /api/wishlist`, `GET /api/wishlist` (อิงแพตเทิร์น route เดิม + zod ใน `lib/validations/`)
- **Auth:** เฉพาะผู้ใช้ล็อกอิน (NextAuth) — guest จะถูกชวนล็อกอิน
- **Performance:** query wishlist พร้อม campsite ในครั้งเดียว (กัน N+1)

## 4. UX (Design Brief 5 ช่อง)
1. **User job:** บันทึกแคมป์ไว้กลับมาดู/จอง — success = เห็นในหน้า Wishlist
2. **Screen inventory:** ปุ่มหัวใจบน `CampgroundCard`, หน้า `/wishlist`, empty state
3. **Token constraints:** ใช้ token/สีใน `DESIGN.md` (รอ Guardian สร้าง) + shadcn เดิม
4. **Interaction states:** default / saved / loading / error / empty / not-logged-in
5. **Reference:** สไตล์การ์ดเดิมของ CampVibe (คงโทน ไม่ทำ slop)
- a11y: ปุ่มหัวใจมี aria-label + focus state; i18n: TH/EN ใน `locales/`

## 5. NFR
- Security: ผูก wishlist กับ session user เท่านั้น (กันแก้ของคนอื่น)
- Privacy: ไม่เก็บ PII เพิ่ม
- Ops: log ผ่าน Sentry; ไม่ต้อง feature flag (เสี่ยงต่ำ)

## 6. Risks & Assumptions (ปิดแล้วโดยมนุษย์ที่ G1)
- ✅ wishlist เป็น "รายการเดียว" ต่อ user — **ยืนยัน** (scope MVP)
- ✅ guest กดหัวใจ → เด้ง LoginModal ชวนล็อกอิน ไม่เก็บ local — **ยืนยัน**
- ✅ entry point: ไอคอนหัวใจบน navbar — **ยืนยัน**

## 7. Gap Matrix
| มิติ | สถานะ | หมายเหตุ |
|---|---|---|
| Business | 🟡 | KPI ต้อง confirm ว่าจะวัดอะไร |
| Functional | 🟢 | ชัด |
| Technical | 🟢 | model + API ชัด (อิงโค้ดจริง) |
| UX | 🟢 | guest→LoginModal, entry=navbar หัวใจ (ยืนยันที่ G1) |
| Data/Privacy | 🟢 | ไม่มี PII เพิ่ม |
| Security | 🟢 | ownership check |
| Ops | 🟢 | Sentry พอ |
| Risk | 🟢 | สมมติทั้งหมดยืนยันแล้ว |

→ **ไม่มี gap 🔴/🟡 ค้าง → DoR ครบ → ผ่าน Gate G1** ✅

## 8. Open Questions
(ว่าง — ปิดครบที่ G1 แล้ว)
