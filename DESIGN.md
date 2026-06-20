# DESIGN.md — CampVibe Design System (source of truth)

ทั้ง Designer และ Frontend **อ่านไฟล์นี้ก่อนทำ UI ทุกครั้ง** ใช้ได้เฉพาะ token/component ในระบบ ห้าม hardcode สี/ระยะ/เงา ห้ามประดิษฐ์ component ใหม่นอกระบบ (เปลี่ยน token ได้ที่เดียวคือแก้ไฟล์นี้ + `app/globals.css`)

## Tokens (จาก `app/globals.css` จริง)
| Token | ค่า | ใช้ตอน |
|---|---|---|
| `--color-primary` | `#0d9488` (teal-600) | ปุ่มหลัก, action, ลิงก์เด่น |
| `--color-primary-foreground` | `#ffffff` | ข้อความบนพื้น primary |
| `--color-background` / `--color-foreground` | ตาม theme | พื้น/ข้อความหลัก |
| `--color-muted(-foreground)` | ตาม theme | ข้อความรอง, placeholder |
| `--color-destructive` | ตาม theme | error, ลบ |
| `--color-border` / `--color-ring` | ตาม theme | เส้นขอบ, focus ring |
| radius | `--radius-sm…4xl` scale | มุมโค้ง — ใช้ scale เท่านั้น |

## Typography
- Body: `--font-sans` = **Inter** (`var(--font-inter)`)
- Heading (h1–h6): `--font-display` = **Outfit** (`var(--font-outfit)`)
- ห้ามใส่ font อื่น

## Components
- ใช้ **shadcn/ui (new-york)** ใน `components/ui/*` เท่านั้น (Radix-based) · ไอคอน **lucide-react** เท่านั้น
- pattern ฟอร์ม/error: ตาม `components/ui/form-patterns.md` (inline ใต้ field, ErrorBanner บนสุด)

## Interaction states (บังคับครบทุก interactive element)
default · hover · focus (มี ring) · active · disabled · loading · empty · error

## Anti-slop (กัน UI generic ซ้ำๆ)
- ❌ อย่าใช้ค่า default ลอยๆ (purple gradient, เงา default, การ์ดซ้อนการ์ดไร้เหตุผล)
- ✅ ทุกค่ามาจาก token; layout มีลำดับชั้นชัด; ยึดโทน CampVibe (teal + ขาวสะอาดแบบ Airbnb-light)
- ก่อนปิดงาน UI: เทียบ screenshot กับ Design Brief + ตรวจ a11y (WCAG AA: contrast, aria-label, focus, tap target ≥44px)

## i18n
ทุก copy ต้องมี TH/EN ใน `locales/` · ห้าม hardcode ข้อความในคอมโพเนนต์

## Thai UX copy
- ❌ ห้าม em-dash (—) เป็นตัวคั่น (ใช้ จุด/วงเล็บ/และ) · `—` ใช้ได้แค่แทนค่าว่างในตาราง
- ❌ ห้ามศัพท์เทคนิคในข้อความผู้ใช้ (`API`, `webhook`, `OAuth`, `User ID`, `endpoint`) → ใช้ภาษาคน
