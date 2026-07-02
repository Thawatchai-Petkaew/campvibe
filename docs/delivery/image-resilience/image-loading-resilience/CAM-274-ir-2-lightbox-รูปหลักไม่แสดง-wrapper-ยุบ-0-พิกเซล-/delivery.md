---
linear: CAM-274
feature: image-resilience
epic: image-loading-resilience (CAM-132)
persona: camper
artifact: delivery
owner: devops-release
status: Done
version: v1
updated: 2026-07-03
---
# Delivery — CAM-274 IR-2 lightbox รูปหลักไม่แสดง + มุมโค้งรูป preview

## Root cause
Regression จาก CAM-194 (migrate next/image): รูปหลักใน `components/ImageGallery.tsx` ใช้ `ImageWithFallback` โหมด fill แต่ wrapper ได้ `max-w-full max-h-full` (ไม่มีขนาดจริง) และลูกแบบ fill เป็น absolute → wrapper ยุบ 0x0 รูปไม่แสดง (thumbnail รอดเพราะปุ่ม `w-20 h-20`).

## Change
- รูปหลัก → Mode B (`width/height` intrinsic hints) + `w-auto h-auto max-w-[calc(100vw-6rem)] max-h-[calc(100vh-11rem)] object-contain` (viewport-based กัน circular sizing).
- Wrapper `rounded-3xl bg-transparent` (+ overflow-hidden เดิม) — มุมโค้งแนบขอบรูปจริง, ไม่มีแผ่น muted บน scrim.
- Container padding responsive `p-4 md:p-20` (mobile).
- Guard tests: ไฟล์ใหม่ `__tests__/cam-274-lightbox-image.test.ts` (21 ข้อ, พิสูจน์ red-before-green: ถอด fix แล้ว fail 9) + ปรับ `cam-194-perf4-next-image.test.ts` (Mode B main / fill thumbnails).
- ไม่แตะ thumbnail strip, keyboard nav, backdrop close, a11y, `CampgroundDetailClient.tsx`.

## Quality gate (รันจริง pre-merge)
lint 0 errors · typecheck clean · test 93 files / 4534 passed · build OK · check:ds PASS · check:palette PASS. CI quality-gate PASS บน PR #280 (`visual-a11y` fail = env ของ workflow ขาด DATABASE_URL — advisory, ไม่เกี่ยว diff).

## Evidence (Playwright วัด DOM จริง)
- Dev server: desktop 1280x800 img box 800x533 (เดิม 0x0), wrapper borderRadius 22px, bg transparent · mobile 375x667 img 279px = ตรงขอบเขต calc(100vw-6rem) เป๊ะ · broken URL → ImageOff fallback แสดง.
- **Staging จริง** (`campvibe-staging.vercel.app/campgrounds/ban-rak-thai-mist-80-th`, หลัง merge): เปิด lightbox สำเร็จ, รูปหลัก **936x624**, radius **22px**, bg โปร่งใส — ยืนยันโดย Playwright ยิงใส่ URL จริง (deployment `48b405a` READY ยืนยันผ่าน Vercel).

## Ship
- PR: https://github.com/Thawatchai-Petkaew/campvibe/pull/280 → merged `staging` 2026-07-02T17:44:39Z (`48b405a`), G3 approved โดย owner (ดูจาก Vercel preview ก่อน merge), branch deleted.
- prod ยังไม่ปล่อย (Done ≠ Released) — เข้าคิว release train ถัดไปพร้อม batch ที่ค้าง.
