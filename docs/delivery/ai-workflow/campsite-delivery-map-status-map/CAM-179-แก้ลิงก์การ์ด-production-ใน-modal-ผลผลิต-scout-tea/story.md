---
linear: CAM-179
feature: ai-workflow
epic: campsite-delivery-map-status-map (CAM-150)
persona: platform
artifact: story
owner: product-owner
status: Backlog
version: v1
updated: 2026-06-25
---
# แก้ลิงก์การ์ด Production ใน modal ผลผลิต Scout Team (ตอนนี้เด้งไป Staging) (CAM-179)

## ทำไม

ใน modal "ผลผลิต Scout Team" บน /status/map การ์ด **Production** ลิงก์ผิด — กดแล้วเปิด **Staging** แทน. สาเหตุ: `PROD_URL = process.env.NEXT_PUBLIC_PROD_URL ?? ""` แต่ env นี้ไม่ได้ตั้ง → `PROD_URL = ""` → `href={(PROD_URL || STAGING_URL)...}` fallback เป็น STAGING_URL. การ์ด Staging ถูกต้องอยู่แล้ว และทั้งคู่ชี้หน้า home (ENV_PATH = "")

## Story

ในฐานะ **เจ้าของ (platform)** ฉันต้องการ **กดการ์ด Production แล้วเปิดหน้า home ของ production จริง** เพื่อ **เข้าแอป prod ได้จากแผนที่โดยไม่หลุดไป staging**
ขอบเขต: แก้ค่า prod URL ใน EnvPickerPanel ให้ชี้ production จริง (`https://campvibe.vercel.app`) ไม่ fallback ไป staging; ไม่แตะการ์ด Staging / layout / modal อื่น

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล/ระบบ |
| -- | -- | -- | -- | -- |
| 1 | เปิด modal ผลผลิต Scout Team | กดการ์ด **Production** | เปิดแท็บใหม่ไปหน้า home ของ production (`campvibe.vercel.app`) | href = prod URL + "/" |
| 2 | เปิด modal | กดการ์ด **Staging** | เปิดหน้า home ของ staging (`campvibe-staging.vercel.app`) เหมือนเดิม | ไม่เปลี่ยน |
| 3 | NEXT_PUBLIC_PROD_URL ไม่ได้ตั้ง | กด Production | ยังไปหน้า prod (ไม่ fallback ไป staging) | default = prod URL ไม่ใช่ "" |

## Rules

* `PROD_URL = process.env.NEXT_PUBLIC_PROD_URL || "https://campvibe.vercel.app"` (default เป็น prod ไม่ใช่ค่าว่าง)
* prod card `href={PROD_URL + ENV_PATH}` (ตัด `|| STAGING_URL` fallback ออก)
* ทั้งสองการ์ดชี้ home (ENV_PATH = "") · ไม่แตะ visual/modal อื่น

## Data

* ไม่มี data/migration (frontend URL constant ล้วน)

## Out of scope

* แก้ปัญหา prod deploy ที่ ERROR (คนละเรื่อง — Vercel provisioning)

## Self-verify

- [ ] lint · typecheck · test · build · check:palette · check:ds
- [ ] guard test: prod card href = prod URL (ไม่ใช่ staging)
- [ ] verify staging /status/map: กด Production → ไป campvibe.vercel.app

## Links

ref: app/status/map/campsite-overlays.tsx (EnvPickerPanel ~2155-2220) · เดิม [CAM-168](https://linear.app/campvibe/issue/CAM-168/devops-release-statusmap-ปม-ผลผลต-scout-team-modal-เลอก-env)/[CAM-169](https://linear.app/campvibe/issue/CAM-169/frontend-engineer-cr-cam-168-ปมขนาดตรง-dashboard-modal-กลางจอ-lucide) (env picker)
