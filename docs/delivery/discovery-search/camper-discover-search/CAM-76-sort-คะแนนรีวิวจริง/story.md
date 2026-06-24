---
linear: CAM-76
feature: discovery-search
epic: camper-discover-search (CAM-33)
persona: camper
artifact: story
owner: product-owner
status: Backlog
version: v1
updated: 2026-06-23
---
# Sort คะแนนรีวิวจริง (CAM-76)

## ทำไม

ปุ่ม "คะแนนรีวิว" ใน SortDropdown แสดงผลเหมือนเรียงวันที่ (fallback `createdAt`) ทำให้ลานที่มีรีวิวดีจริงจมหาย Camper ต้องเปิดทีละการ์ดเพื่อเทียบดาว ลดความเชื่อมั่นในแพลตฟอร์ม
**KPI:** Camper เลือก sort=rating แล้วลานอันดับ 1 มีคะแนนเฉลี่ยจริง ≥ ลานอันดับ 2 ทุกครั้ง (verified บน Staging)

## Story

ในฐานะ **Camper** ฉันต้องการ **เรียงผลการค้นหาตามคะแนนรีวิวเฉลี่ยจริงจากสูงไปต่ำ** เพื่อ **เห็นลานที่ได้รับการยืนยันว่าดีจากนักแคมป์คนอื่นก่อน**
ขอบเขต: แก้ logic การเรียงลำดับสำหรับ sort=rating ที่หน้าแรก (`app/page.tsx`) และ API campsites/campgrounds ให้ใช้ค่าเฉลี่ย rating จริงแทน createdAt; ไม่รวมการแสดงผลคะแนนบนการ์ดหรือหน้า detail (C-2.5)

## AC

| # | Given (สถานะตั้งต้น) | When (ผู้ใช้ทำ) | ผลที่ผู้ใช้เห็น (copy ไทยจริง) | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | หน้าแรก แสดงรายการลานปัจจุบัน (sort ใดก็ได้) | ผู้ใช้เลือก "คะแนนรีวิว" จาก dropdown เรียงลำดับ | การ์ดลานเรียงจากซ้ายบนไปขวาล่างตามดาวสูงสุดก่อน; ลานที่ไม่มีรีวิวแสดงต่อท้าย | ลำดับ response ตรงกับค่าเฉลี่ย rating จริง (AVG ของ Review.rating ในแต่ละ CampSite) เรียง descending; ลานที่ไม่มีรีวิวอยู่ส่วนท้าย |
| 2 | หน้าแรก sort=rating, มีลานที่มีรีวิวและไม่มีรีวิวปนกัน | ผู้ใช้ดูผลลัพธ์โดยไม่ทำอะไรเพิ่ม | ลานที่ไม่มีรีวิวแสดงต่อท้ายรายการทั้งหมด | ลาน avgRating = null จัดอยู่หลังลานที่มี avgRating จริง |
| 3 | ผู้ใช้เลือก sort=rating แล้วเปลี่ยนเป็น "ราคาต่ำสุด" | ผู้ใช้เลือก "ราคาต่ำสุด" จาก dropdown | การ์ดเรียงใหม่ตาม priceLow จากต่ำสุดก่อน | orderBy เปลี่ยนเป็น priceLow asc; ไม่ใช้ rating |
| 4 | sort=rating แต่ฐานข้อมูลไม่มีลานที่ active/published เลย | ผู้ใช้ดูผลลัพธ์ | แสดงข้อความ "ไม่พบลานแคมป์" พร้อมปุ่ม "ล้างการค้นหา" | response คืน array ว่าง |
| 5 | URL มี `?sort=rating` โดยตรง (deep link / share) | เพจโหลด | เพจแสดงลานเรียงตามคะแนนรีวิวโดยอัตโนมัติ ไม่ต้อง reload | SortDropdown highlight ตัวเลือก "คะแนนรีวิว"; ลำดับถูกต้องตั้งแต่ SSR |

## Rules

* คะแนนเฉลี่ยคำนวณจาก Review.rating (INT 1-5) ของรีวิวทั้งหมดที่ผูกกับ [CampSite.id](<http://CampSite.id>) นั้น (ไม่กรองตามสถานะรีวิว เนื่องจากยังไม่มี status field บน Review)
* ลาน avgRating = null (ไม่มีรีวิว) จัดอยู่ลำดับท้ายสุด (NULLS LAST)
* sort=rating ต้องทำงานร่วมกับ filter อื่น (keyword, province, facilities ฯลฯ) ได้ปกติ หลัง filter แล้วค่อยเรียง
* จำนวนสูงสุดที่ดึงต่อหน้ายังคงเป็น 40 รายการ (เหมือน sort อื่น)
* ค่า sort ที่รองรับ: `related` (default) | `price_asc` | `price_desc` | `rating` — ค่าอื่นให้ treat เป็น `related`
* ไม่มี error message สำหรับ user สำหรับ AC นี้ (ไม่มี invalid state ที่ user กระทำได้); error ระดับ DB ให้ fallback เป็น empty list เงียบๆ (ตาม pattern ปัจจุบัน)

## Data

* อ้างอิง field: `Review.rating: Int` (มีอยู่แล้ว) และ `CampSite.reviews: Review[]` (relation มีอยู่แล้ว)
* `CampSite` ไม่มี field `avgRating` สำเร็จรูป — architect ต้องเลือก approach: (a) in-memory sort หลัง `findMany` include reviews, (b) Prisma `groupBy` + `_avg`, หรือ (c) raw SQL subquery
* ไม่ต้องมี migration schema ใหม่สำหรับ story นี้ (ถ้าใช้ computed ใน query layer); ถ้า architect เลือกเพิ่ม column `avgRating Float?` ใน CampSite เพื่อ performance ให้แยก migration ticket
* Field ที่แตะจริง: `CampSite.id`, `Review.campSiteId`, `Review.rating`

## Out of scope

* การแสดงคะแนนดาวบนการ์ด CampgroundCard (ปัจจุบัน hardcode 4.8) → C-2.5
* การแสดงจำนวนรีวิวบนการ์ด → C-2.5
* Rating breakdown histogram → C-2.6
* AI review summary → C-2.7
* Pagination (เกิน 40 รายการ) → C-1.x (ยังไม่กำหนด)
* การ cache / invalidate avgRating เมื่อมีรีวิวใหม่ → ถ้าใช้ stored column ให้ architect ออกแบบใน C-2.5 หรือ separate ticket

## Self-verify

- [ ] lint (`npm run lint` ผ่านไม่มี error)
- [ ] typecheck (`npm run typecheck` ผ่าน strict mode)
- [ ] test ครอบ: sort=rating คืนลำดับถูก, sort=rating + filter ทำงานร่วมกัน, ลานไม่มีรีวิวอยู่ท้าย, sort invalid fallback เป็น related; coverage ≥80% โค้ดใหม่
- [ ] a11y: SortDropdown ยังคงใช้ keyboard ได้ ค่า aria ถูกต้อง
- [ ] design: ไม่มี UI ใหม่ ไม่ต้อง design gate
- [ ] security: ไม่รับ user input เข้า DB query โดยตรง (sanitize sort param ก่อน switch/map)
- [ ] verify Staging URL: เปิด campvibe-staging.vercel.app?sort=rating แล้วตรวจว่าลานอันดับ 1 มีคะแนนเฉลี่ยสูงสุดจริง

## Links

spec: ai-planning/PRODUCT-PLAN.md (C-1.4) · PR: — · preview: campvibe-staging.vercel.app · design: DESIGN.md · เชื่อมโยง: C-2.5 (รับช่วง aggregate display)
