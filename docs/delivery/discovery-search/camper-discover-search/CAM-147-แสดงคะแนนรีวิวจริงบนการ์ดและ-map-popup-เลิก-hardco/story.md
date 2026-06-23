---
linear: CAM-147
feature: discovery-search
epic: camper-discover-search (CAM-33)
persona: camper
artifact: story
owner: product-owner
status: Backlog
version: v1
updated: 2026-06-23
---
# แสดงคะแนนรีวิวจริงบนการ์ดและ map popup (เลิก hardcode 4.8) (CAM-147)

## ทำไม

แม้ [CAM-79](https://linear.app/campvibe/issue/CAM-79/devops-release-แสดงรววจรงและดาวเฉลยบนหนา-detail) จะแก้หน้า detail ให้แสดงคะแนนจริงแล้ว แต่การ์ดลานแคมป์บนหน้าแรก/ผลค้นหา/wishlist และ popup บนแผนที่ยังแสดงดาว "4.8" แบบ hardcode ทำให้ Camper เห็นคะแนนปลอมตั้งแต่จุดแรกของ funnel (ก่อนเข้า detail) ลดความน่าเชื่อถือและทำให้เปรียบเทียบลานผิด
**KPI:** ค่า hardcoded "4.8" หายจากทุก CampgroundCard + map popup บน production; การ์ดของลานที่มีรีวิว ≥ 1 แสดงค่าเฉลี่ยจริงตรงกับหน้า detail

## Story

ในฐานะ **Camper** ฉันต้องการ **เห็นคะแนนรีวิวเฉลี่ยจริงบนการ์ดลานแคมป์และ popup แผนที่** เพื่อ **เปรียบเทียบลานได้ตั้งแต่หน้ารายการโดยไม่ต้องเปิดทีละลาน**
ขอบเขต: แทนค่า hardcode 4.8 บน `CampgroundCard` และ `MapComponent` popup ด้วยค่าเฉลี่ยจริง (reuse `computeAvgRating` จาก `lib/sort-utils.ts`); ดึงข้อมูล server-side ใน `app/page.tsx` (ทุก sort), `app/wishlist`, และ data ของแผนที่; ไม่รวม histogram และไม่แตะหน้า detail ([CAM-79](https://linear.app/campvibe/issue/CAM-79/devops-release-แสดงรววจรงและดาวเฉลยบนหนา-detail) ทำแล้ว)

## AC

| # | Given (สถานะตั้งต้น) | When (ผู้ใช้ทำ) | ผลที่ผู้ใช้เห็น (copy ไทยจริง) | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | ลานมีรีวิวในระบบ (เช่น ค่าเฉลี่ย 4.2 จาก 5 รีวิว) | Camper เปิดหน้าแรก | การ์ดของลานนั้นแสดงไอคอนดาวและเลข "4.2" (ค่าเฉลี่ยจริง) | ระบบคำนวณ average จาก Review.rating (เฉพาะ deletedAt = null) ของลานนั้น |
| 2 | ลานไม่มีรีวิวเลย | Camper เปิดหน้าแรก | การ์ดแสดงข้อความ "ยังไม่มีรีวิว" แทนดาว ไม่แสดงเลข 4.8 หรือ 0 หรือดาวว่าง | count = 0 → ไม่แสดงดาว |
| 3 | ลานมีรีวิว | Camper เปิด popup ของลานนั้นบนแผนที่ | popup แสดงดาวและค่าเฉลี่ยจริง (ไม่ใช่ 4.8) | คำนวณเหมือนการ์ด |
| 4 | ลานไม่มีรีวิว | Camper เปิด popup บนแผนที่ | popup แสดง "ยังไม่มีรีวิว" ไม่แสดงดาวหรือ 4.8 | count = 0 |
| 5 | ผู้ใช้บันทึกลานไว้ใน wishlist | Camper เปิดหน้า wishlist | การ์ดใน wishlist แสดงคะแนนจริงเหมือนหน้าแรก | ใช้การคำนวณชุดเดียวกัน |

## Rules

* ค่าเฉลี่ยปัดทศนิยม 1 ตำแหน่ง (`Math.round(avg * 10) / 10`) — สอดคล้องกับ [CAM-79](https://linear.app/campvibe/issue/CAM-79/devops-release-แสดงรววจรงและดาวเฉลยบนหนา-detail)
* count = 0 → แสดง "ยังไม่มีรีวิว" ไม่แสดงดาว/เลข 0/ดาวว่าง (สอดคล้องกับหน้า detail)
* reuse `computeAvgRating` จาก `lib/sort-utils.ts` — ห้าม duplicate logic
* ไม่ leak authorId หรือ review PII; ส่งเฉพาะ `avgRating` + `reviewCount` เข้า client (ห้ามส่ง array reviews เข้า card/map)
* การคำนวณทำ server-side; การ์ด/popup รับ `avgRating` + `reviewCount` เป็น prop
* การแสดงคะแนนต้องไม่ทำให้ layout การ์ดเลื่อน (no CLS); ดาวใช้ token เดิม (`fill-foreground text-foreground`)

## Data

* reuse `Review.rating` (Int 1-5), relation `CampSite.reviews`
* เพิ่ม include `reviews: { where: { deletedAt: null }, select: { rating: true } }` ใน query ของ `app/page.tsx` (ทุก sort branch ไม่ใช่แค่ rating), `app/wishlist/page.tsx`, และ data source ของ `MapComponent`; map เป็น `avgRating` + `reviewCount` แล้ว strip `reviews` ก่อนส่ง client
* ไม่มี migration
* field ที่แตะ: `CampgroundCardProps` (+ avgRating, reviewCount), `MapComponent` props, query ที่กล่าวข้างต้น

## Out of scope

* Histogram / breakdown ดาว 1-5 → C-2.6
* หน้า detail (ทำแล้ว [CAM-79](https://linear.app/campvibe/issue/CAM-79/devops-release-แสดงรววจรงและดาวเฉลยบนหนา-detail))
* คะแนนเฉลี่ยใน Host Dashboard → [CAM-82](https://linear.app/campvibe/issue/CAM-82/แสดงคะแนนเฉลยและจำนวนรววใน-host-dashboard)
* stored `CampSite.avgRating` column (perf เมื่อ catalog > ~200 ลาน) → separate migration ticket

## Self-verify

- [ ] lint
- [ ] typecheck
- [ ] test coverage ≥ 80% โค้ดใหม่ (reuse computeAvgRating; test การ map avg→prop + empty state)
- [ ] a11y (ดาวมี aria-label บอกค่า; "ยังไม่มีรีวิว" อ่านได้)
- [ ] design (token-only, ไม่มี hardcoded color, ไม่มี CLS)
- [ ] security (authorId/review ไม่ถูกส่งเข้า client)
- [ ] verify Staging URL: เปิดหน้าแรกบน campvibe-staging.vercel.app ตรวจว่าการ์ดไม่มี 4.8 hardcode แล้ว

## Links

spec: product-plan C-2.5 · related: [CAM-79](https://linear.app/campvibe/issue/CAM-79/devops-release-แสดงรววจรงและดาวเฉลยบนหนา-detail) (detail done), [CAM-76](https://linear.app/campvibe/issue/CAM-76/devops-release-sort-คะแนนรววจรง) (sort) · PR: — · preview: campvibe-staging.vercel.app · design: DESIGN.md
