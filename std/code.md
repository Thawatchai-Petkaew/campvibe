# std/code.md — มาตรฐาน Code (Frontend/ทั่วไป)

> Memory ของ role **Frontend** (และทุก agent ที่เขียน TS/TSX) — อ่านไฟล์นี้ + `DESIGN.md` ก่อนเริ่มทุกงาน UI
> when-to-use: เขียน/แก้ component, hook, page, client logic, lib ฝั่ง frontend · when-NOT: งาน API/migration/authz → `std/api.md` · งาน token/สี/ระยะ → `DESIGN.md`

## หลักการ
- โค้ดทุกชิ้นโยงกลับ ticket/AC ได้ (spec-first) — ไม่มี story = ไม่มีโค้ด
- เขียนให้ลบง่าย: หน่วยเล็ก, ขอบเขตชัด, ไม่เผื่ออนาคต — ความซับซ้อนคือหนี้
- type & boundary คือ contract: บั๊กที่ compile/validate จับได้ ดีกว่าจับตอน runtime

## มาตรฐาน/กฎ

### TypeScript

- `strict` mode เปิดเสมอ; **ห้าม `any` ที่ไม่ justify** (คอมเมนต์เหตุผล) — ใช้ `unknown` + narrow แทน
- type ครบที่ทุก boundary (props, return ของ exported fn, response ฝั่ง client)
- validate input ข้าม boundary ด้วย **zod** (ดู `lib/validations/*`); type มาจาก `z.infer` ไม่ประกาศซ้ำ
- นามสกุล: `.tsx` ถ้ามี JSX, ไม่งั้น `.ts` · component = **default export** · hook/provider/util = **named export**

### Next.js (App Router)

- แยก server/client component ให้ถูก: `"use client"` เฉพาะที่ต้องใช้ state/effect/event เท่านั้น
- **ห้ามเรียก DB/Prisma จาก client** — ผ่าน server action (`lib/actions.ts`) หรือ `lib/api-client.ts` เท่านั้น
- ห้ามยิง backend/3rd-party ตรงจาก client (กัน secret รั่ว + SSRF) — ผ่าน facade ฝั่ง server
- UI ทุกชิ้นยึด `DESIGN.md` (token-only); ไม่ hardcode สี/ระยะ/เงา/component นอกระบบ

### ขนาด/ขอบเขต

- **1 PR = 1 atomic story, ≤ ~400 บรรทัด** — เกินให้ซอย story; PR base = `staging`
- ทำ story ให้ครบ **code + ทุก state (empty/loading/error/success) + validation + self-test** ก่อนขยับ
- ห้ามโค้ดเผื่ออนาคต / dead branch / `// TODO for later` / commented-out code

### i18n & copy

- ทุก user-facing copy อยู่ใน layer i18n (`locales/translations.ts`) — **ห้าม hardcode string ใน component**
- copy ไทย: ห้าม em-dash (—) เป็นตัวคั่น (ใช้จุด/วงเล็บ/และ), ห้ามศัพท์เทคนิค (API/webhook/endpoint/User ID) ในข้อความผู้ใช้

### Test ID

- ใส่ `data-testid` ตาม convention `<type>--<module>-<detail>` เช่น `btn--wishlist-toggle` ทุก element ที่ QA ต้อง assert

## ต้องคำนึง / anti-patterns
- ❌ `any` ดับ error → ✅ `unknown` + zod/narrow
- ❌ `fetch` DB หรือ secret ใน client component → ✅ server action / api-client facade
- ❌ hardcode `"จองสำเร็จ"` / `className="text-[#1a7f37]"` → ✅ key i18n + token จาก `DESIGN.md`
- ❌ PR ก้อนใหญ่หลาย concern → ✅ 1 atomic story ≤400 บรรทัด
- ❌ ลืม state error/empty (โชว์แค่ happy path) → ✅ ครบทุก state ตาม AC
- ❌ เขียน util เผื่อใช้ทีหลัง → ✅ เพิ่มเมื่อมี caller จริง

## Checklist (DoD ก่อน handoff)
- [ ] โยงกลับ ticket/AC ได้ทุกส่วน; ครบทุก state + validation ตาม AC
- [ ] ไม่มี `any` ไม่ justify, ไม่มี dead/commented code, copy อยู่ใน i18n
- [ ] UI ผ่าน design gate (token-only + a11y + anti-slop) เทียบ `DESIGN.md`
- [ ] รัน self-verify เขียวครบ: `npm run lint` · `npm run typecheck` · `npm test` · (UI) design gate
- [ ] PR เดียว = 1 story เข้า `staging`; เตรียม verify AC บน Staging URL จริง (= Done)
