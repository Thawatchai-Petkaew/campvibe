# DESIGN.md — CampVibe Design System (source of truth)

ทั้ง Designer และ Frontend **อ่านไฟล์นี้ก่อนทำ UI ทุกครั้ง** ใช้ได้เฉพาะ token/component ในระบบ ห้าม hardcode สี/ระยะ/เงา ห้ามประดิษฐ์ component ใหม่นอกระบบ (เปลี่ยน token ได้ที่เดียวคือ `app/globals.css` + ไฟล์นี้)

> **Preset:** shadcn `radix-luma` · baseColor `mist` · icons **tabler** (`@tabler/icons-react`) · ใช้ OKLCH + รองรับ dark mode
> *(ลง preset ด้วย `npx shadcn@latest apply --preset b1GyGd9r6`)*

## Tokens (ค่าจริงจาก `app/globals.css` — OKLCH)
| Token | Light | ใช้ตอน |
|---|---|---|
| `--primary` | `oklch(0.511 0.096 186.391)` (teal) | ปุ่มหลัก, action, ลิงก์เด่น |
| `--primary-foreground` | `oklch(0.984 0.014 180.72)` | ข้อความบนพื้น primary |
| `--secondary` | `oklch(0.967 0.001 286.375)` | พื้นรอง, ปุ่มรอง |
| `--accent` | `oklch(0.511 0.096 186.391)` | เน้น (โทนเดียวกับ primary) |
| `--muted` / `--muted-foreground` | `oklch(0.963 …)` / `oklch(0.56 …)` | พื้น/ข้อความรอง, placeholder |
| `--destructive` | `oklch(0.577 0.245 27.325)` (red) | error, ลบ |
| `--background` / `--foreground` | `oklch(1 0 0)` / `oklch(0.148 …)` | พื้น/ข้อความหลัก |
| `--border` / `--ring` | `oklch(0.925 …)` / `oklch(0.723 …)` | เส้นขอบ / focus ring |
| `--radius` | `0.625rem` (+ scale sm…4xl) | มุมโค้ง — ใช้ scale เท่านั้น |

- **Dark mode:** มี `.dark` ครบทุก token — ห้ามใส่สี light/dark แยกเอง ใช้ token
- ห้ามใส่ค่า hex/px ลอย — อ้าง token เท่านั้น

## Typography
- Body: `--font-sans` = **Inter** · Heading (h1–h6): `--font-display` = **Outfit**

## Components & Icons
- **shadcn/ui (radix-luma)** ใน `components/ui/*` เท่านั้น (Radix-based)
- **ไอคอน: tabler (`@tabler/icons-react`)** สำหรับงานใหม่ *(lucide ยังอยู่ใน deps สำหรับโค้ดเก่า — ของใหม่ใช้ tabler)*
- pattern ฟอร์ม/error: ตาม `components/ui/form-patterns.md` (inline ใต้ field, ErrorBanner บนสุด)
- มี `tw-animate-css` สำหรับ animation utility

## Interaction states (บังคับครบทุก interactive element)
default · hover · focus (มี ring) · active · disabled · loading · empty · error

## Anti-slop (กัน UI generic ซ้ำๆ)
- ❌ อย่าใช้ค่า default ลอยๆ (gradient ม่วง, เงา default, การ์ดซ้อนการ์ดไร้เหตุผล)
- ✅ ทุกค่ามาจาก token; layout มีลำดับชั้นชัด; ยึดโทน CampVibe (teal/mist + ขาวสะอาดแบบ Airbnb-light)
- ก่อนปิดงาน UI: เทียบ screenshot กับ Design Brief + ตรวจ a11y (WCAG AA: contrast, aria-label, focus, tap target ≥44px)

## i18n & Thai copy
- ทุก copy มี TH/EN ใน `locales/` · ห้าม hardcode
- ❌ ห้าม em-dash (—) เป็นตัวคั่นในข้อความไทย (ใช้ จุด/วงเล็บ/และ) · `—` ใช้ได้แค่แทนค่าว่างในตาราง
- ❌ ห้ามศัพท์เทคนิคในข้อความผู้ใช้ (`API`, `webhook`, `OAuth`, `User ID`, `endpoint`)
