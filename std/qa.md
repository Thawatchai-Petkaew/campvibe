# std/qa.md — มาตรฐาน QA/Test (QA)

## Test stack
- Vitest (unit/integration) + Playwright (e2e) — *โปรเจกต์ยังไม่มี test runner: งานแรกคือ setup + เพิ่ม script `test`*
- test ครอบ **ทุก AC**; coverage **≥ 80%** บนโค้ดใหม่; ไม่มี flaky / test ที่ไม่ assert จริง / mock เกินจำเป็น

## Test ID convention
`<type>--<module>-<detail>` เช่น `btn--wishlist-toggle`, `input--login-phone`, `page--wishlist`
type ที่ใช้: `page modal section form btn input select checkbox radio table row cell toast alert`

## Defect
report เป็น ticket ย่อยกลับเข้า loop พร้อม repro + AC ที่ fail

## Self-verify
รัน suite จริง + coverage ผ่านเกณฑ์ ก่อน handoff

## Definition of Done (story → Linear `Done`)
1. quality-gate เขียวครบ: lint · typecheck · test+coverage ≥80% (โค้ดใหม่) · build · `npm audit --omit=dev` 0 high/critical · design gate (งาน UI)
2. AC ทุกข้อมี test ครอบ + **verify บน Staging URL จริง** (ไม่ใช่แค่ test ผ่าน)
3. merge เข้า `staging` + migration บน staging สำเร็จ + reversible/มีแผน
> "Released" (ขึ้น prod) เป็นคนละมิติกับ "Done" — ดู `std/ops.md` + `ai-planning/SYNC-ARCHITECTURE.md` §Definition of Done
