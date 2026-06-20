# std/code.md — มาตรฐาน Code (Frontend/ทั่วไป)

## TypeScript
- strict mode; ไม่มี `any` ที่ไม่ justify; type ครบที่ boundary
- `.tsx` ถ้ามี JSX, ไม่งั้น `.ts`; component = default export, hook/provider = named export

## Next.js (App Router)
- แยก server/client component ถูกต้อง; ห้ามเรียก DB จาก client
- ดึงข้อมูลผ่าน `lib/api-client.ts`; UI ตาม `DESIGN.md` (token-only)

## ขนาด/ขอบเขต
- **1 PR = 1 atomic story, ≤ ~400 บรรทัด**; ไม่มีโค้ดเผื่ออนาคต/dead branch/commented "for later"
- i18n: ทุก copy ใน `locales/` ห้าม hardcode

## Self-verify (ก่อน handoff)
`npm run lint` · `npm run typecheck` · `npm test` · (งาน UI) design gate
