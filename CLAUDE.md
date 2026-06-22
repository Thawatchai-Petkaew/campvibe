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
5. **ไม่ข้าม gate** — หยุดขออนุมัติมนุษย์ที่ G1 Scope · G2 Design · G3 Merge→staging · G4 Staging sign-off · G5 Go-live(prod)
6. **Lean** — เพิ่มอะไรต้องตอบได้ว่าทำให้งานดีขึ้นยังไง ไม่งั้นตัดทิ้ง

## Standards (รายละเอียดใน std/)
- Code → `std/code.md` · API/Backend → `std/api.md` · Security → `std/security.md`
- QA/Test → `std/qa.md` · Architecture → `std/architecture.md` · Discovery → `std/discovery.md` · Ops → `std/ops.md`
- Design system → `DESIGN.md` **v2 (AI-First, agent-readable)** — อ่านก่อนงาน UI ทุกครั้ง: brand POV · token tables (usage context) · scales (radius/size/spacing/motion) · component decision matrix · named anti-patterns · Design Gate (block PR) · SEO/AEO → `std/seo.md` · UX Validation+PDPA → `std/ux.md`

## Quality gates (บังคับก่อน merge — `/quality-gate`)
`npm run lint` · `npm run typecheck` · `npm test` (coverage ≥80% โค้ดใหม่) · `npm run build` · `npm audit --omit=dev` (0 high/critical) · design gate (งาน UI)

## Env & Definition of Done (3-env — รายละเอียด `std/ops.md`)
Local Dev → **Staging** (`staging` branch, auto deploy) → **Production** (`main`, promote+tag) · DB แยก staging/prod
- **Done** = merge เข้า `staging` + quality-gate เขียว + **verify AC บน Staging URL จริง** → Linear state `Done`
- **Released** = promote `staging`→`main` + prod deploy + smoke + tag + changelog → label `released` (ไม่ใช่ state) · story หลายตัว Done ได้ก่อนรวมปล่อยเป็นรอบ

## Git
branch `<type>/<kebab>` (`feature/ fix/ chore/ refactor/ docs/ test/ release/ hotfix/`) · Conventional Commits · **feature → PR เข้า `staging` (=Done) → promote `staging`→`main` (=Released)** · `main`+`staging` protected · ผ่าน CI ก่อน merge

## คำสั่ง
`/new-feature "<requirement>"` เริ่ม loop · `/status` ดูสถานะ · `/promote-release --to <staging|prod>` promote ข้าม env
