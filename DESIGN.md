# DESIGN.md — Design System (token-only, anti-slop)

ทั้ง **Designer (UX+DS)** และ **Frontend** อ่านไฟล์นี้ก่อนทำ UI ทุกครั้ง (memory = `design`) ใช้ได้เฉพาะ token/component ในระบบ ห้าม hardcode สี/ระยะ/เงา ห้ามประดิษฐ์ component นอกระบบ — เปลี่ยน token ได้ที่เดียวคือ `app/globals.css` + ไฟล์นี้ ไฟล์นี้คือ source of truth ของ Design Gate และ **มีอำนาจ block PR งาน UI**

> **Preset:** shadcn `radix-luma` · baseColor `mist` · icons **tabler** (`@tabler/icons-react`) · OKLCH + dark mode · ลง preset: `npx shadcn@latest apply --preset b1GyGd9r6`
> **อ่านคู่กัน:** งานหน้า public (metadata/JSON-LD/sitemap/Core Web Vitals) → `std/seo.md` · field validation catalog + PDPA masking → `std/ux.md` (DESIGN.md ไม่ทำซ้ำ 2 เรื่องนี้)

## หลักการ — design ethos ของ CampVibe
- โทน **CampVibe = teal/mist + ขาวสะอาดแบบ Airbnb-light**: เนื้อหานำ, chrome เบา, ลำดับชั้นชัดด้วย spacing/typography ไม่ใช่เส้น/เงาหนัก
- **Token-only**: ทุกค่ามาจาก token; UI สม่ำเสมอเพราะแก้ที่เดียว ไม่ใช่ตกแต่งราย component
- **Lean = ไม่มี fluff**: ทุก element ตอบได้ว่ารับใช้ task ผู้ใช้อย่างไร ไม่งั้นตัดทิ้ง (สอดคล้องกฎเหล็ก §6 CLAUDE.md)
- มี **Design Brief สั้น** ก่อนทำ UI: task ผู้ใช้ · component ที่ใช้ · token · states (empty/loading/error/…) · reference 1 ตัว

## Tokens / constraints — ใช้ token เท่านั้น (ค่าจริง `app/globals.css`, OKLCH)
| Token | Light | ใช้ตอน |
|---|---|---|
| `--primary` / `--primary-foreground` | `oklch(0.511 0.096 186.391)` teal / `oklch(0.984 0.014 180.72)` | ปุ่มหลัก, action, ลิงก์เด่น / ข้อความบนพื้น primary |
| `--secondary` | `oklch(0.967 0.001 286.375)` | พื้นรอง, ปุ่มรอง |
| `--accent` | `oklch(0.511 0.096 186.391)` | เน้น (โทนเดียวกับ primary) |
| `--muted` / `--muted-foreground` | `oklch(0.963 …)` / `oklch(0.56 …)` | พื้น/ข้อความรอง, placeholder |
| `--destructive` | `oklch(0.577 0.245 27.325)` red | error, ลบ |
| `--success` / `--success-foreground` | `oklch(0.530 0.148 144.184)` / `oklch(0.984 0.014 158.52)` | สำเร็จ (accepted, confirmed) |
| `--background` / `--foreground` | `oklch(1 0 0)` / `oklch(0.148 …)` | พื้น/ข้อความหลัก |
| `--border` / `--ring` | `oklch(0.925 …)` / `oklch(0.723 0.014 214.4)` | เส้นขอบ / focus ring |
| `--radius` | `0.625rem` (scale `sm…4xl`) | มุมโค้ง — ใช้ scale เท่านั้น |

- **Dark mode**: `.dark` มีครบทุก token — ห้ามใส่สี light/dark แยกเอง ใช้ token
- ห้ามใส่ค่า hex/px ลอย — อ้าง token เท่านั้น
- **Typography**: body `--font-sans` = **Inter** · heading h1–h6 `--font-display` = **Outfit**
- **Components**: shadcn/ui (radix-luma) ใน `components/ui/*` เท่านั้น (Radix-based) — ห้ามสร้างนอกระบบ
- **Icons**: tabler (`@tabler/icons-react`) สำหรับงานใหม่ (lucide ยังอยู่ใน deps สำหรับโค้ดเก่า — ของใหม่ใช้ tabler)
- animation: ใช้ utility จาก `tw-animate-css`

## Interaction states — บังคับครบทุก interactive element
`default · hover · focus (มี ring) · active · loading · error · empty · disabled`
- **Form/error pattern** (`components/ui/form-patterns.md`): client validation → inline ใต้ field; server error → `ErrorBanner` บนสุดของฟอร์มหลัง submit; `<form noValidate>` เสมอ ใช้ custom validation
- ขาด state ใด state หนึ่ง = ไม่ผ่าน Design Gate (ไม่ใช่ "Done" ต่อ CLAUDE.md)

## Anti-slop rules — กัน generic AI look
- ❌ default ลอยๆ: gradient ม่วง, เงา default, การ์ดซ้อนการ์ดไร้เหตุผล, ค่า hex/px/สีนอก token
- ❌ ประดิษฐ์ component นอก `components/ui/*` หรือ icon set อื่นนอก tabler (งานใหม่)
- ✅ hallmark ที่ต้องมี: ทุกค่ามาจาก token · layout มีลำดับชั้นชัด · ยึดโทน teal/mist + ขาวสะอาด · เทียบ screenshot กับ Design Brief ก่อนปิดงาน

## a11y / i18n — WCAG AA + TH/EN
- **a11y**: contrast ผ่าน AA · ทุก interactive มี focus ring (`--ring`) มองเห็นได้ · `aria-label` ครบ · tap target ≥ 44px
- **Test ID**: `<type>--<module>-<detail>` (เช่น `btn--wishlist-toggle`) เพื่อให้ QA ผูก test ได้
- **i18n**: ทุก copy มี TH/EN ใน `locales/` (`translations.json`/`.ts`) — ห้าม hardcode; copy = source-of-truth เดียว (glossary)
- ❌ em-dash (—) เป็นตัวคั่นในข้อความไทย (ใช้ จุด/วงเล็บ/และ) · `—` ใช้ได้แค่แทนค่าว่างในตาราง
- ❌ ศัพท์เทคนิคในข้อความผู้ใช้ (`API`, `webhook`, `OAuth`, `User ID`, `endpoint`) → ใช้ภาษาคน

## Design gate checklist — เกณฑ์ผ่าน (block PR ได้)
รันก่อน merge เข้า `staging` (= "Done"); fail ข้อใด = ตีกลับ ไม่ผ่าน gate:
- [ ] **Token-only**: ไม่มี hex/px/สีลอย — อ้าง token + scale ทั้งหมด (light + dark)
- [ ] **Component-in-system**: shadcn `components/ui/*` + icon tabler เท่านั้น (งานใหม่)
- [ ] **States ครบ**: default/hover/focus/active/loading/error/empty/disabled + form/error pattern
- [ ] **a11y**: contrast AA · focus ring · aria-label · tap ≥44px
- [ ] **i18n**: TH/EN ใน `locales/` · ไม่มี em-dash คั่น · ไม่มีศัพท์เทคนิคในข้อความผู้ใช้
- [ ] **Anti-slop**: เทียบ screenshot กับ Design Brief — ลำดับชั้นชัด, โทน CampVibe, ไม่มี default slop

> verify AC จริงบน **Staging URL** ถึงนับ Done (CLAUDE.md / `std/ops.md`) · Released = promote `staging`→`main` แยกต่างหาก