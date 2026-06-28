---
linear: CAM-239
feature: profile-media
epic: avatar-image-fixes (CAM-238)
persona: platform
artifact: story
owner: product-owner
status: Todo
version: v1
updated: 2026-06-28
---
# staging Blob · Google CSP) (CAM-239)

## Why

ผู้ใช้อัปโหลด/เชื่อม Google แล้วรูปไม่แสดง/อัปโหลดไม่ได้ — กระทบความน่าเชื่อถือของโปรไฟล์ทั้ง camper และ host. 3 ราก: A (Navbar avatar ไม่อัปเดตหลังอัปโหลด), B (upload พังบน staging), C (รูป Google ถูก CSP บล็อก).

## Story

ในฐานะ **ผู้ใช้ (camper/host)** ฉันต้องการ **อัปโหลดรูปโปรไฟล์/รูปแคมป์ แล้วเห็นรูปแสดงทุกที่ทันที และรูปจาก Google ขึ้นตามปกติ** เพื่อ **โปรไฟล์ดูสมบูรณ์น่าเชื่อถือ**. ขอบเขต: A+B+C ด้านล่าง (ไม่มี UI ใหม่ ไม่มี migration).

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | อยู่หน้าโปรไฟล์ มีรูปเดิม | อัปโหลดรูปใหม่สำเร็จ | รูปใหม่ขึ้นทั้งหน้าโปรไฟล์ **และ avatar ที่แถบเมนูด้านบน ทันที (ไม่ต้องรีโหลด)** | PATCH บันทึก `User.image`; เรียก session update + refresh ให้ค่าใหม่กระจาย |
| 2 | แก้ชื่อในโปรไฟล์ | กดบันทึก | ชื่อที่แถบเมนูด้านบนอัปเดตตาม | session/prop รีเฟรชค่าใหม่ |
| 3 | login ด้วย Google ที่มีรูปโปรไฟล์ | เข้าระบบ/ดูหน้า | เห็นรูปโปรไฟล์จาก Google (ไม่ใช่ไอคอนเปล่า) | รูปจาก googleusercontent โหลดได้ (ไม่ถูกบล็อก) |
| 4 | บนระบบจริง (staging/prod) | อัปโหลดรูปโปรไฟล์/รูปแคมป์/โลโก้ | อัปโหลดสำเร็จ รูปขึ้น | ไฟล์ถูกเก็บที่ Vercel Blob; ได้ URL ใช้งานได้ |
| 5 | ระบบยังไม่ได้ตั้งค่าที่เก็บรูป (เช่นยังไม่ต่อ Blob) | อัปโหลด | เห็นข้อความผิดพลาดที่ชัดเจน `ระบบจัดเก็บรูปยังไม่พร้อม กรุณาติดต่อผู้ดูแล` | คืน error ชัดเจน + log; ไม่พยายามเขียนไฟล์ลงเครื่องที่เขียนไม่ได้ |

## Rules

* **A** `app/profile/page.tsx` saveProfile สำเร็จ → `await useSession().update()` (jwt re-read DB image/name — มีที่ `lib/auth.ts` trigger==="update") **+** `router.refresh()` (ดัน server prop ที่ Navbar อ่าน). เรียกครั้งเดียวหลังสำเร็จ (กัน loop)
* **B** `app/api/upload/route.ts` — local-FS fallback เฉพาะ `NODE_ENV==="development"`; production ไม่มี Blob token/Blob throw → คืน error ชัด (เช่น 503) + log ไม่เขียน FS
* **C** `proxy.ts buildCsp` เพิ่ม `https://lh3.googleusercontent.com` ใน img-src (เจาะจง host); `next.config.ts` remotePatterns เพิ่ม `*.googleusercontent.com` (defensive)
* avatar คง plain `<img>` (ไม่แตะ next/image → $0) · token-only · ข้อความ error เป็นภาษาคน ไม่มี jargon · check:ds เขียว

## Data

* ไม่มี migration · ไม่มี field ใหม่ · ใช้ `User.image` เดิม · env `BLOB_READ_WRITE_TOKEN` (owner ต่อ Vercel Blob store)

## Out of scope

* ต่อ Vercel Blob store + redeploy = งาน owner/infra (บล็อก AC-4 บน staging แต่โค้ด merge ได้ก่อน)
* เปลี่ยน avatar ไป next/image / image optimization · crop/resize UI

## Self-verify

* A: อัปโหลด → Navbar avatar เปลี่ยนทันที (local ทดสอบได้) · C: CSP header มี [lh3.googleusercontent.com](<http://lh3.googleusercontent.com>) · B: prod-no-token → error ชัด (ไม่เขียน FS), dev → ยังเขียน local ได้ · lint/typecheck/test/build/check:ds เขียว · security review CSP

## Links

* Epic [CAM-238](https://linear.app/campvibe/issue/CAM-238/avatar-and-image-fixes) · Navbar.tsx:48,201 · profile/page.tsx:135-165 · lib/auth.ts:173-184 · upload/route.ts:99-120 · proxy.ts:61 (img-src) · next.config.ts remotePatterns
