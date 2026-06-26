---
linear: CAM-189
feature: performance-and-freshness
epic: data-layer-performance-and-freshness (CAM-186)
persona: platform
artifact: story
owner: product-owner
status: In Progress
version: v1
updated: 2026-06-26
---
# AGG-1 maintained avgRating / reviewCount (CAM-189)

## Why

ตอนนี้คำนวณคะแนนเฉลี่ยใหม่ทุกครั้งโดยลากรีวิวทั้งหมดมานับ → หนัก + มีเพดาน ~200 ลาน. เก็บค่าไว้ล่วงหน้าจะเบา + ปลดเพดาน. เริ่มได้เลย (ไม่ติด MEAS-1).

## Story

ในฐานะ platform ฉันต้องการ เก็บคะแนนเฉลี่ยและจำนวนรีวิวเป็นคอลัมน์ (อัปเดตตอนมีรีวิว) เพื่อ แสดงการ์ดโดยไม่ต้องนับรีวิวใหม่ทุกครั้ง. ขอบเขต: เพิ่มคอลัมน์ + อัปเดตตอนเขียนรีวิว (ในทรานแซกชัน) + งานตรวจซ่อม (reconcile) + backfill.

## AC

| # | Given | When | ผลที่ผู้ใช้เห็น | ผลเชิงข้อมูล |
| -- | -- | -- | -- | -- |
| AC-1 | มีรีวิวใหม่หรือถูกลบ | บันทึกสำเร็จ | คะแนนเฉลี่ยอัปเดตตาม | avgRating/reviewCount อัปเดตในทรานแซกชันเดียวกับการเขียนรีวิว |
| AC-2 | ค่าที่เก็บกับค่าจริงอาจคลาด | รันงานตรวจซ่อม | ค่าตรงกับความจริง | ตรงกับการคำนวณรีวิวจริง 100% (ซ่อมตัวเองได้) |

## Rules

อัปเดตในทรานแซกชัน + งานตรวจซ่อมเป็นตัวสำรอง (ไม่ใช้ trigger เป็นหลัก) · avgRating เก็บทศนิยม 1 ตำแหน่ง · ต้องออกแบบเส้นทางแก้/ลบรีวิว (ยังไม่มี) ให้อัปเดตค่าด้วย.

## Data

migration: + avgRating (ทศนิยม 1) + reviewCount บน CampSite · additive + reversible + backfill + test staging.

## Out of scope

เรียงตามคะแนนที่ฐานข้อมูล (= PERF-5).

## Self-verify

[ ] lint [ ] typecheck [ ] migrate reversible+backfill [ ] reconcile ตรง [ ] test staging

## Links

Research Map §11 AGG-1 · ADR-009 · epic [CAM-186](https://linear.app/campvibe/issue/CAM-186/data-layer-performance-and-freshness)
