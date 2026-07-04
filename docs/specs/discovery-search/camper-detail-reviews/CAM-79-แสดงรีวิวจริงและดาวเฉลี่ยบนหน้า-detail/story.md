---
linear: CAM-79
feature: discovery-search
epic: camper-detail-reviews (CAM-34)
persona: camper
artifact: story
owner: product-owner
status: Backlog
version: v1
updated: 2026-06-23
---
# แสดงรีวิวจริงและดาวเฉลี่ยบนหน้า detail (CAM-79)

## ทำไม

หน้า detail ปัจจุบันแสดงดาว "4.8" และ "12 รีวิว" แบบ hardcode ทำให้ข้อมูลไม่น่าเชื่อถือและ Camper ตัดสินใจเลือกแคมป์บนข้อมูลเท็จ การแสดงดาวเฉลี่ยและรายการรีวิวจริงช่วยให้ Camper ตัดสินใจได้อย่างมีข้อมูล เพิ่ม trust และ conversion  
**KPI:** ค่า hardcoded "4.8" และ "12 รีวิว" หายออกจาก production ทุกหน้า detail ภายหลัง story นี้ merge; แคมป์ที่มีรีวิว ≥ 1 แสดงดาวเฉลี่ยที่คำนวณจากข้อมูลจริง

## Story

ในฐานะ **Camper** ฉันต้องการ **เห็นดาวเฉลี่ยและรายการรีวิวจริงของแคมป์บนหน้า detail** เพื่อ **ตัดสินใจจองบนข้อมูลที่เชื่อถือได้**  
ขอบเขต: แสดงดาวเฉลี่ย (คำนวณ runtime จาก Review) + จำนวนรีวิว + รายการรีวิวล่าสุด 10 รายการ บนหน้า `/campgrounds/[slug]` และ widget จอง; ไม่รวมการกรอกรีวิว (C-1.4)

## AC

| # | Given (สถานะตั้งต้น) | When (ผู้ใช้ทำ) | ผลที่ผู้ใช้เห็น (copy ไทยจริง) | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | แคมป์มีรีวิวอยู่ในระบบ (เช่น 5 รีวิว ค่าเฉลี่ย = 4.2) | Camper เปิดหน้า detail | บริเวณชื่อแคมป์แสดง "4.2 (5 รีวิว)" พร้อมไอคอนดาว และ widget จองด้านขวาแสดงตัวเลขเดียวกัน | ระบบดึง Review ทั้งหมดของ campSiteId จาก DB คำนวณ average(rating) และ count แล้ว render server-side |
| 2 | แคมป์ไม่มีรีวิวเลย | Camper เปิดหน้า detail | บริเวณชื่อแคมป์แสดงข้อความ "ยังไม่มีรีวิว" และ widget จองไม่แสดงดาว | ระบบรับ count = 0 จาก DB และ render ข้อความแทนดาว ไม่แสดงตัวเลข 0 หรือดาวว่าง |
| 3 | แคมป์มีรีวิว ≥ 1 รายการ | Camper เลื่อนลงไปที่ส่วนรีวิว | เห็นรายการรีวิวล่าสุดสูงสุด 10 รายการ แต่ละรายการแสดง ชื่อผู้รีวิว, ดาว (1-5), วันที่เขียน, และเนื้อหารีวิว (ถ้ามี) | ระบบ query Review ล่าสุด 10 รายการ เรียงตาม createdAt DESC |
| 4 | แคมป์ไม่มีรีวิวเลย | Camper เลื่อนลงไปที่ส่วนรีวิว | เห็นหัวข้อ "รีวิว" และข้อความ "ยังไม่มีรีวิวสำหรับแคมป์นี้" | ระบบ render empty state แทนรายการ |
| 5 | แคมป์มีรีวิวมากกว่า 10 รายการ | Camper เลื่อนลงไปที่ส่วนรีวิว | เห็นรีวิว 10 รายการแรก และปุ่ม "ดูรีวิวทั้งหมด" | ระบบ query เฉพาะ 10 รายการแรก (take: 10) |
| 6 | ฐานข้อมูลตอบสนองผิดพลาดระหว่างโหลดหน้า | Camper เปิดหน้า detail | ส่วนรีวิวแสดง "ไม่สามารถโหลดรีวิวได้ในขณะนี้" และส่วนอื่นของหน้า (รูป/สิ่งอำนวยความสะดวก/ปฏิทิน) ยังใช้งานได้ปกติ | ระบบ catch error ใน review query แยกต่างหาก ไม่ทำให้ทั้งหน้า error |

## Rules

* ดาวเฉลี่ยปัดเป็นทศนิยม 1 ตำแหน่ง (เช่น 4.16667 แสดงเป็น "4.2") โดยใช้ `Math.round(avg * 10) / 10`
* ดาวเฉลี่ยต้องแสดงเฉพาะเมื่อมีรีวิว ≥ 1 รายการ ถ้า count = 0 แสดงข้อความ "ยังไม่มีรีวิว" แทน ไม่แสดงเลข 0 หรือดาวว่าง
* รายการรีวิวดึงล่าสุด 10 รายการ เรียงตาม createdAt DESC (ใหม่สุดก่อน)
* รีวิวที่ไม่มี content (เนื้อหา) แสดงเฉพาะดาวและวันที่ ไม่แสดงกล่อง content ว่าง
* ค่า hardcoded "4.8" และ "12 รีวิว" ใน `CampgroundDetailClient.tsx` ต้องถูกลบออกทั้งหมด
* Review.author แสดง `author.name` ถ้าไม่มี name แสดง "ผู้ใช้งาน"
* ปุ่ม "ดูรีวิวทั้งหมด" (เมื่อมี > 10 รายการ) ในขณะนี้ไม่ต้องทำงาน (placeholder) → C-2.6 จะ implement modal/pagination
* ข้อมูลรีวิว (average + list) ต้องโหลด server-side พร้อมหน้า (ใน `app/campgrounds/[slug]/page.tsx`) ไม่ใช่ client-side fetch แยก
* authz: รีวิวที่แสดงต้องไม่เปิดเผย authorId ต่อ client — แสดงเฉพาะ `author.name`

## Data

* `Review.rating: Int` (1-5), `Review.content: String?`, `Review.title: String?`, `Review.authorId: String`, `Review.campSiteId: String`, `Review.createdAt: DateTime` — ทั้งหมดมีอยู่แล้วใน schema
* `Review.author` relation → `User.name: String?` มีอยู่แล้ว
* ไม่มี aggregate field บน `CampSite` ต้องเพิ่ม: คำนวณ runtime ด้วย Prisma `_avg` + `_count` ใน `app/campgrounds/[slug]/page.tsx`
* ไม่มี migration ต้องทำ
* query ที่ต้องเพิ่มใน `app/campgrounds/[slug]/page.tsx`:
  * `prisma.review.aggregate({ where: { campSiteId }, _avg: { rating: true }, _count: { rating: true } })`
  * `prisma.review.findMany({ where: { campSiteId }, include: { author: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 10 })`
* ต้องเพิ่ม `GET /api/reviews?campSiteId=` หากต้องการรองรับ client-side pagination ในอนาคต แต่ในขณะนี้ไม่ต้อง (server-side เพียงพอ)

## Out of scope

* การกรอก/ส่งรีวิว (POST /api/reviews) — มีอยู่แล้ว ครอบคลุมโดย C-1.4
* Histogram แสดง breakdown ดาว 1-5 ดาว → C-2.6
* รีวิวที่มีรูปภาพ (mediaUrls) → C-2.8
* AI สรุปรีวิว → C-2.7
* Sort รีวิวตามคะแนน (Sort คะแนนรีวิวบนหน้า list) → C-1.4
* Pagination แบบ load more / infinite scroll → C-2.6
* ปุ่ม "ดูรีวิวทั้งหมด" ที่ใช้งานได้จริง (open modal/navigate) → C-2.6

## Self-verify

- [ ] lint
- [ ] typecheck
- [ ] test coverage ≥ 80% (unit test: การคำนวณ average + round, empty state เมื่อ count=0, server query params ถูกต้อง)
- [ ] a11y (ดาวมี aria-label บอกค่า, รายการรีวิวใช้ semantic list)
- [ ] design (token-only, ไม่มี hardcoded color)
- [ ] security (authorId ไม่ถูก expose ใน HTML หรือ JSON response ที่ส่งไป client)
- [ ] verify Staging URL: เปิดหน้า detail แคมป์ที่มีรีวิวใน staging DB ตรวจว่าดาวและรายการรีวิวแสดงถูกต้อง; เปิดหน้าแคมป์ที่ไม่มีรีวิวตรวจว่าแสดง "ยังไม่มีรีวิว"

## Links

spec: ai-planning/docs/specs/ · PR: — · preview: campvibe-staging.vercel.app · design: DESIGN.md
