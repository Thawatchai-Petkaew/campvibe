---
name: quality-gate
description: รัน quality gate บังคับก่อน merge — lint, typecheck, test+coverage, build, npm audit, (UI) design gate แล้วสรุป pass/fail
---
# quality-gate
รันตามลำดับ หยุดทันทีที่ fail:
1. npm run lint            → 0 error
2. npm run typecheck       → 0 error (ห้าม any ไม่ justify)
3. npm test -- --coverage  → ผ่าน + coverage >=80% โค้ดใหม่
4. npm run build           → สำเร็จ
5. npm audit --omit=dev    → 0 high/critical
6. (งาน UI) design gate: token-only + a11y + anti-slop audit + เทียบ screenshot กับ brief
สรุปผลเป็นตาราง pass/fail; fail → เปิด Linear ticket + บล็อก merge
