---
linear: CAM-173
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: platform
artifact: story
owner: product-owner
status: Backlog
version: v1
updated: 2026-06-24
---
# ปรับ modal "ส่งมอบสำเร็จ" ให้เข้า design system + การ์ด list (CAM-171 follow-up) (CAM-173)

## ทำไม

modal "ส่งมอบสำเร็จ" จาก [CAM-171](https://linear.app/campvibe/issue/CAM-171/devops-release-การดของขวญ-สงมอบสำเรจ-บนกองไฟ-statusmap-กดดครงเดยว) ดูทึบและธรรมดาเกินไป ไม่เข้าชุดกับ UI ส่วนอื่นของแอป รายการที่ส่งมอบเป็นแถวเปล่าๆ ไม่สื่อความรู้สึก "ของขวัญที่ส่งมอบ" และชื่อเรื่องแสดง HTML entity (`&quot;`) ดิบ ลดความน่าเชื่อถือ/ความ polish
**KPI:** modal เข้าชุดกับ design system, แต่ละงานส่งมอบเป็นการ์ดที่อ่านง่ายและดูน่าฉลอง, ไม่มี entity ดิบในชื่อ

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **modal ส่งมอบที่ดูเข้าชุดกับ UI ส่วนอื่น และแต่ละงานที่ส่งมอบเป็นการ์ดที่ดูน่าฉลอง** เพื่อ **รู้สึกถึงการส่งมอบจริงและสบายตาเข้าระบบ**
ขอบเขต: ปรับ surface/background ของ modal ใน `delivery-gift` ให้ใช้ design-system tokens เหมือน modal/การ์ดอื่น + render แต่ละ delivery เป็น "การ์ด" ใน list + decode HTML entity ในชื่อก่อนแสดง; ไม่แตะ logic เดิม (helpers/seen-set/view-once)

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น (copy ไทยจริง) | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | มี delivery ที่ยังไม่ดู | เปิด modal | modal surface เข้าชุดกับ design system (ไม่ทึบ ใช้ token พื้น/ขอบ/มุมโค้ง/เงา) อ่านง่ายบน scene กองไฟ | ไม่เปลี่ยน data |
| 2 | modal เปิดอยู่ | ดูรายการ | แต่ละ ticket ที่ส่งมอบเป็น **การ์ด** (ไอคอน + ชื่อเรื่อง + chip epic + วันที่ไทย) เรียงเป็น list ไม่ใช่แถวเปล่า | อ่านจาก MapModel เดิม |
| 3 | ชื่อเรื่องมีอักขระพิเศษ (เช่น เครื่องหมายคำพูด) | เปิด modal | ชื่อแสดงถูกต้อง ไม่มี `&quot;`/entity ดิบ | decode HTML entity ก่อน render |
| 4 | ดู modal แล้วปิด | กดปิด/กดการ์ด | mark seen → gift หาย → reload ยังหาย (behavior เดิม) | localStorage seen-set เดิม |
| 5 | dark scene + responsive | เปิด modal | อ่านชัด ไม่มี CLS ไม่มีอีโมจิ ปุ่มปิด 44px focus-trap คงเดิม | — |

## Rules

* ใช้ DESIGN.md tokens; modal สอดคล้องกับ modal/การ์ดอื่นในแอป (เช่น booking confirm / AlertDialog / Card pattern) แต่ readable บน scene กองไฟที่เป็นโทนเข้ม
* **ไม่เปลี่ยน** `lib/map-delivery.ts` **logic** (pure helpers / seen-set / pre-seed / view-once เดิม) — เป็นงาน UI ล้วน
* decode HTML entity (`&quot; &amp; &lt; &gt; &#39;`) ในชื่อก่อนแสดง (defensive ครอบทุก title)
* gift button บนกองไฟปรับเฉพาะเท่าที่จำเป็นให้เข้าชุด (focus = ตัว modal + การ์ด list)

## Data

* ไม่มีการเปลี่ยน data / API / migration (UI ล้วน อ่าน MapModel เดิม)

## Out of scope

* เปลี่ยน trigger / seen logic / pre-seed → คงเดิม ([CAM-171](https://linear.app/campvibe/issue/CAM-171/devops-release-การดของขวญ-สงมอบสำเรจ-บนกองไฟ-statusmap-กดดครงเดยว))
* server-side seen-state / cross-device → Phase 2

## Self-verify

- [ ] lint · typecheck
- [ ] test เดิมยัง pass (lib/map-delivery.ts ไม่แตะ) + ถ้าเพิ่ม decode helper ให้ unit test
- [ ] a11y (ปุ่ม 44px, focus trap, อ่านการ์ดได้) คงเดิม
- [ ] design (token-only, dark-safe, no CLS, no emoji, lucide) + เข้าชุด design system
- [ ] security (UI ล้วน ไม่มี data/PII เปลี่ยน; decode ปลอดภัย ไม่ใช้ dangerouslySetInnerHTML)
- [ ] verify Staging URL: เปิด /status/map → gift → modal เข้าชุด + การ์ด list + ชื่อถูกต้อง

## Links

spec: [CAM-171](https://linear.app/campvibe/issue/CAM-171/devops-release-การดของขวญ-สงมอบสำเรจ-บนกองไฟ-statusmap-กดดครงเดยว) (ฟีเจอร์เดิม) · scene: app/status/map/delivery-gift.tsx + campsite-scene.tsx · design: DESIGN.md · preview: campvibe-staging.vercel.app/status/map
