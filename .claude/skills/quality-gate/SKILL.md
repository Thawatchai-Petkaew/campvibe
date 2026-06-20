---
name: quality-gate
description: รัน quality gate บังคับก่อน merge — lint, typecheck, test+coverage, build, npm audit, (UI) design gate แล้วสรุป pass/fail. ใช้เมื่อ atomic story เสร็จก่อนเปิด/merge PR เข้า `staging` (เกณฑ์ "Done"). อย่าใช้เป็นตัวตัดสิน "Released" — prod ผ่าน `/promote-release --to prod` (smoke/tag/changelog แยกต่างหาก)
---
# quality-gate — รัน gate บังคับก่อน merge เข้า `staging`, สรุป pass/fail แล้วบล็อก merge ถ้าแดง
อ่านก่อน: `CLAUDE.md` (Quality gates) · `std/qa.md` · `std/ops.md` (Done vs Released) · `DESIGN.md` (งาน UI)

## Input / preconditions
- atomic story เขียนเสร็จจริง (code + states + validation) แล้ว — gate ไม่ใช่ที่ไล่เขียนงาน
- รันที่ repo root, branch `feature/*` ที่จะเปิด PR เข้า `staging`
- รู้ว่างานนี้แตะ UI หรือไม่ (ตัดสินว่าต้องรัน design gate ข้อ 6)

## วิธีทำ — รันตามลำดับ หยุดทันทีที่ fail
1. `npm run lint` → 0 error
2. `npm run typecheck` → 0 error (ห้าม `any` ที่ไม่ justify)
3. `npm test -- --coverage` → ทุก test เขียว + coverage ≥ 80% บนโค้ดใหม่ (ทุก AC มี test ครอบ)
4. `npm run build` → สำเร็จ (รวม `prisma generate`)
5. `npm audit --omit=dev` → 0 high/critical
6. **(เฉพาะงาน UI)** design gate: token-only (ไม่ hardcode สี/ระยะ/เงา) + a11y WCAG AA (contrast, aria-label, focus, tap target ≥44px) + anti-slop audit + เทียบ screenshot กับ Design Brief
7. สรุปผลทุกข้อเป็นตาราง pass/fail

## ต้องคำนึง
- fail ข้อใด → หยุดทันที, เปิด Linear ticket (defect, repro + เกณฑ์ที่ fail), **บล็อก merge** — ห้าม merge ทั้งที่แดง
- coverage วัด **โค้ดใหม่** ไม่ใช่ทั้ง repo; test ต้อง assert จริง ไม่ flaky ไม่ mock เกินจำเป็น
- gate เขียวยังไม่ใช่ "Done" — "Done" ต้อง merge เข้า `staging` + migration บน staging สำเร็จ + **verify AC บน Staging URL จริง** ด้วย (ดู `std/ops.md`)
- งานไม่แตะ UI: ข้ามข้อ 6 ได้ แต่ระบุในตารางว่า "N/A — ไม่มีงาน UI"
- gate นี้รันฝั่ง local ก่อน push; CI (`.github/workflows/ci.yml`) รันซ้ำฝั่ง server ทุก PR base `staging`/`main` — ผลต้องตรงกัน

## Output / postconditions
- ตาราง pass/fail ครบ 6 ข้อ (UI) หรือ 5 ข้อ + N/A (ไม่มี UI)
- เขียวครบ → พร้อมเปิด PR เข้า `staging` (`/open-pr`); ยังไม่เปลี่ยน Linear state เป็น `Done` จนกว่าจะ verify Staging URL
- แดง → ticket defect เปิดแล้ว + merge ถูกบล็อก, story ยังไม่ขยับ

## Verify
- ทุกบรรทัดในตารางมีผลจริงจากคำสั่งที่รัน (ไม่เดา/ไม่ข้าม)
- ไม่มีข้อใดค้าง "skipped" โดยไม่มีเหตุผล (UI ที่ข้ามข้อ 6 ต้องยืนยันว่าไม่มี diff ใน `app/`/`components/`)
- ก่อน handoff: STORY-TICKET ผ่าน `node scripts/linear-sync.mjs audit` (มี ## Story + ## AC)
