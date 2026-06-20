# CLAUDE.md — CampVibe (AI Delivery Team)

Memory กลางของทีม AI agent โหลดอัตโนมัติทุก session **กฎทั้งหมดในไฟล์นี้ override ความสะดวก/ความเร็ว**

> วิธีทำงานของทีม (ฉบับเต็ม): `ai-planning/AI-TEAM-PLAYBOOK.md` — ไฟล์นี้คือฉบับบังคับใช้แบบย่อ

## Stack
Next.js (App Router) · TypeScript (strict) · Prisma + PostgreSQL · Tailwind v4 + shadcn/ui (new-york) · NextAuth · Vercel · Linear (tracker)

## กฎเหล็ก (ทุก agent)
1. **Spec-first** — ไม่มีโค้ดถ้าไม่มี spec; โค้ดทุกชิ้นต้องโยงกลับ ticket/AC ได้ ถ้า prompt คลุมเครือ → หยุด เขียน spec ก่อน
2. **ทีละ 1 atomic story** — ทำเสร็จจริง (code+states+validation+self-test) ก่อนขยับ ห้ามเขียนเผื่ออนาคต/dead code
3. **Self-verify ก่อน handoff** — รันคำสั่งจริงของ domain ตน (lint/type/test/scan) ห้ามส่งงานที่ยังไม่ verify
4. **อ่าน memory ก่อนทำงาน** — agent อ่าน `std/<ของตน>.md` + `DESIGN.md` (งาน UI) ก่อนเริ่มทุกครั้ง
5. **ไม่ข้าม gate** — หยุดขออนุมัติมนุษย์ที่ G1 Scope · G2 Design · G3 Merge · G4 UAT · G5 Go-live
6. **Lean** — เพิ่มอะไรต้องตอบได้ว่าทำให้งานดีขึ้นยังไง ไม่งั้นตัดทิ้ง

## Standards (รายละเอียดใน std/)
- Code → `std/code.md` · API/Backend → `std/api.md` · Security → `std/security.md`
- QA/Test → `std/qa.md` · Architecture → `std/architecture.md` · Discovery → `std/discovery.md` · Ops → `std/ops.md`
- Design system → `DESIGN.md` (token-only, anti-slop)

## Quality gates (บังคับก่อน merge — `/quality-gate`)
`npm run lint` · `npm run typecheck` · `npm test` (coverage ≥80% โค้ดใหม่) · `npm run build` · `npm audit --omit=dev` (0 high/critical) · design gate (งาน UI)

## Git
branch `<type>/<kebab>` (`feature/ fix/ chore/ refactor/ docs/ test/ release/ hotfix/`) · Conventional Commits · main protected · ผ่าน CI ก่อน merge

## คำสั่ง
`/new-feature "<requirement>"` เริ่ม loop · `/status` ดูสถานะ · `/release` promote ข้าม env
