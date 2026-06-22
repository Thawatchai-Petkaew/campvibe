---
name: CampVibe Design Language
version: 2.0
lastReviewed: 2026-06-22
sourcesOfTruth:
  - app/globals.css        # token values (OKLCH, light + .dark) — authoritative
  - components/ui/*         # the only component vocabulary
  - app/preview             # living reference (kitchen-sink)
enforcement: npm run check:palette   # CI guard, exits 1 on hardcoded palette
precedence: token > scale utility > inline value (inline = ตีกลับ)
audience: AI agents (primary) + humans
---

# DESIGN.md — CampVibe Design Language (v2, AI-First)

> ไฟล์นี้คือ **single source of truth** ของ design ทั้งหมด **agent อ่านทุกครั้งก่อนทำงาน UI** (และมนุษย์ก็อ่าน) มีอำนาจ **block PR** งาน UI ผ่าน Design Gate (§6)
> เปลี่ยน token ที่เดียว = `app/globals.css` + ไฟล์นี้ · งาน public (metadata/JSON-LD/CWV) → `std/seo.md` · field validation + PDPA → `std/ux.md` (ไม่ทำซ้ำที่นี่)

---

## §0 How to use this doc (สำหรับ AI agent + มนุษย์)

1. **อ่านไฟล์นี้ก่อนเริ่มงาน UI ทุก session** — เป็นสัญญา ไม่ใช่คำแนะนำ การตัดสินใจ design ทุกอย่างมาจากที่นี่ → ผลลัพธ์ session ที่ 10 ต้องเหมือน session ที่ 1
2. **Precedence:** ใช้ **semantic token** (เช่น `bg-card`, `text-muted-foreground`) → ถ้าไม่มี ใช้ **scale utility** (`rounded-3xl`, `h-11`, `gap-6`) → **ห้าม inline value** (`bg-[#..]`, `h-[52px]`, hex/px ลอย)
3. **Closed token layer:** ถ้าค่าที่ต้องการ **ไม่มีใน token/scale** → **หยุด ไม่ประดิษฐ์ค่าเอง** ให้เสนอเพิ่ม token ที่ `app/globals.css` (Designer+Architect เคาะ) แล้วค่อยใช้
4. **Enforcement:** `npm run check:palette` (CI, exit 1) จับ hardcoded palette ทั่ว repo (ยกเว้น `app/globals.css`, `app/status/**`) — PR ผ่านไม่ได้ถ้ามี violation
5. **ทุกกฎในไฟล์นี้เป็นเลขตายตัว + อ้าง token/primitive จริง** — ถ้าเจอเคสที่ไฟล์นี้ตอบไม่ได้ ให้ถามมนุษย์ ไม่เดา

---

## §1 Brand spec & POV — CampVibe

**Identity:** teal/mist + ขาวสะอาดแบบ **Airbnb-light** — เนื้อหานำ, chrome เบา, ลำดับชั้นชัดด้วย **spacing + typography** ไม่ใช่เส้น/เงาหนัก

**จุดยืนเดียวที่ commit (the one strong opinion):** **teal calm-confidence** — สีหลัก teal สุขุมน่าเชื่อถือ (ไม่ใช่ neon/loud), พื้นที่ว่างคือฟีเจอร์, ความสงบ = ความน่าเชื่อถือของแพลตฟอร์มจองแคมป์ ทุกหน้าจอต้อง "รู้สึกเป็น CampVibe" ไม่ใช่ template กลางๆ

**Design parameters (ค่าโหมดของแบรนด์ — ใช้ปรับน้ำหนักงาน):**
| param | ค่า CampVibe |
|---|---|
| mode | **brand-forward** บนหน้า public/marketing · **product-utility** บน dashboard/operator (chrome เบาลง, density สูงขึ้น) |
| density | comfortable (public) · compact (dashboard table) |
| design-variance | low-medium — สม่ำเสมอ > หวือหวา; ความต่างมาจาก content/รูปจริง ไม่ใช่ decoration |
| motion-intensity | restrained (§2 motion) |
| type-direction | Outfit display (มี personality) + Inter/Sarabun body (อ่านง่าย เป็นกลาง) |

**Voice/personality:** outdoor-warm, น่าเชื่อถือ, เป็นมิตรแต่ไม่ cutesy · พูดกับผู้ใช้แบบเพื่อนที่รู้จริงเรื่องแคมป์

---

## §2 Tokens — machine-readable (ค่าจริงจาก `app/globals.css`, OKLCH light/.dark)

### Color (semantic — ใช้ token เท่านั้น, มี usage ต่อแถว)
| token (Tailwind class) | light | dark | ✅ ใช้กับ | ❌ อย่าใช้กับ |
|---|---|---|---|---|
| `primary` / `primary-foreground` | `0.511 0.096 186.391` / `0.984 0.014 180.72` | `0.437 0.078 188.216` / `0.984 0.014 180.72` | ปุ่มหลัก, action, ลิงก์เด่น, selected | พื้นหลังกว้างๆ, ข้อความ body |
| `secondary` / `secondary-foreground` | `0.967 0.001 286.375` / `0.21 0.006 285.885` | `0.274 0.006 286.033` / `0.985 0 0` | ปุ่มรอง, พื้นรองอ่อน | action หลัก |
| `accent` | = primary | = primary | hover/active accent, focus tint | (โทนเดียว primary) |
| `muted` / `muted-foreground` | `0.963 0.002 197.1` / `0.56 0.021 213.5` | `0.275 0.011 216.9` / `0.723 0.014 214.4` | พื้นรอง, ข้อความรอง, placeholder, skeleton | ข้อความหลัก (contrast ไม่พอ) |
| `destructive` | `0.577 0.245 27.325` | `0.704 0.191 22.216` | error, ลบ, cancel (ใช้คู่ `text-primary-foreground`/ขาวบนพื้น) | success/info |
| `success` / `success-foreground` | `0.530 0.148 144.184` / `0.984 0.014 158.52` | `0.645 0.168 150.323` / `0.148 0.004 228.8` | confirmed, accepted, paid | error/warning |
| `background` / `foreground` | `1 0 0` / `0.148 0.004 228.8` | `0.148 0.004 228.8` / `0.987 0.002 197.1` | พื้นหน้า/ข้อความหลัก | — |
| `card` / `card-foreground` | `1 0 0` / `0.148…` | `0.218 0.008 223.9` / `0.987…` | พื้น card/surface ยกระดับ | พื้นเต็มหน้า (ใช้ background) |
| `popover` / `popover-foreground` | = card | = card | dropdown/select/popover/tooltip panel | — |
| `border` / `input` | `0.925 0.005 214.3` | `1 0 0 / 10%` , `/15%` | เส้นขอบ, ขอบ input | เน้น (ใช้ ring/primary) |
| `ring` | `0.723 0.014 214.4` | `0.56 0.021 213.5` | focus ring (`outline-ring/50` มี global) | — |

**กฎสี:**
- ❌ **ห้าม pure `#000`/`#fff`** — ใช้ `foreground`/`background` (foreground = `oklch(0.148…)` navy ไม่ใช่ดำสนิท) · `text-white` อนุญาตเฉพาะ **เหนือรูปภาพ/พื้น primary-fill** (overlay scrim, ปุ่ม primary)
- neutral ทุกตัว **tint เข้า teal hue** อยู่แล้ว (hue ~197–228) — อย่าใส่ gray กลางๆ (zinc/slate/neutral numbered)
- dark mode flip อัตโนมัติผ่าน `.dark` — **ห้ามเขียน `dark:` override สี** เอง
- การ์ดค่า `--color-primary:#0d9488` ใน `@theme` (globals.css บนสุด) = stale hex → `:root` OKLCH คือ authoritative (cleanup อยู่ใน backlog)

### Typography (bilingual)
| ภาษา | display/heading | body/UI |
|---|---|---|
| Latin/EN | **Outfit** (`--font-display`) | **Inter** (`--font-sans`) |
| ไทย | **Sarabun** semibold | **Sarabun** (Google Fonts, subset thai+latin) |
- font stack แยกตามภาษา (Thai font var / `:lang(th)`) — Outfit/Inter ไม่มี glyph ไทย ห้ามปล่อย fallback ระบบ
- `font-variant-numeric: tabular-nums` (`tabular-nums`) สำหรับ **ราคา/วันที่/ตัวเลขสถิติ** เสมอ
- line-height body ~**1.5** (ไทย ~**1.6**) · paragraph วัด **65–75ch** · ลำดับชั้น heading/body/label/caption ชัด
- *(หมายเหตุ: Sarabun ยังไม่ wire — ดู backlog §8 ข้อ 9; ปัจจุบันไทย fallback ระบบ)*

### Spacing & density
| บริบท | ค่า |
|---|---|
| card padding | `p-4 md:p-6` |
| modal content | `p-6 md:p-8` |
| form max-width | `max-w-xl` (อ่าน) / `max-w-2xl` (ฟอร์มกว้าง) |
| gutter | `gap-4` (mobile) / `gap-6` (desktop) |
| section spacing | `space-y-6`/`space-y-8` |

### Radius (soft-rounded — ใช้ token เดียวต่อบทบาท, เลิกปนค่า)
| บทบาท | radius | px (base 10px) |
|---|---|---|
| button · input · select-trigger · chip/pill · icon-button | `rounded-full` | — |
| card · modal/dialog · sheet | `rounded-3xl` | 22px |
| popover · select/dropdown/command content | `rounded-2xl` | 18px |
| inner element · badge · small inset | `rounded-xl` | 14px |

### Size — height scale
| size | height | ใช้กับ |
|---|---|---|
| sm | `h-9` | control แน่น (toolbar, inline) |
| **md** (default) | `h-11` | form control, select, ปุ่มทั่วไป |
| lg | `h-12` | **primary CTA**, input ใน modal/search |
| icon-button | `h-11 w-11` | ปุ่ม icon-only (tap ≥44px) |

### Shadow tiers (ใช้เมื่อจำเป็น — เน้น border+spacing ก่อน)
`shadow-sm` card · `shadow-md` raised/hover · `shadow-lg` dropdown/popover · `shadow-2xl` modal · ❌ ไม่มี tier อื่น

### Motion tokens
- duration **120–250ms** · easing **`cubic-bezier(0.23,1,0.32,1)`** (responsive) — `tw-animate-css` utilities
- animate **เฉพาะ `transform` + `opacity`** · ❌ `transition: all` · ❌ animate width/height/margin/top/left
- ❌ `ease-in` สำหรับ entrance · ปุ่มกด `active:scale-95`
- ❌ motion กับ action ถี่ (filter/search/keyboard) · ✅ respect `prefers-reduced-motion`

---

## §3 Component contracts + decision matrix (ใช้ primitive ไหนกับงานไหน)

**vocabulary = `components/ui/*` เท่านั้น** (28 ตัว: button, input, input-field, input-group, label, textarea, checkbox, select, dropdown-menu, popover, command, dialog, alert-dialog, sheet, calendar, date-range-picker, tooltip, tabs, scroll-area, card, badge, skeleton, loading-spinner, loading-skeleton, error-banner, permission-tooltip, truncated-label, sonner). ห้ามประดิษฐ์นอกระบบ

### เลือก "ตัวเลือก/เมนู" — grammar เดียวต่อบทบาท (แก้เคส Profile vs Filter ที่เจ้าของชี้)
| งาน | ใช้ | สเปก | ❌ อย่าใช้ |
|---|---|---|---|
| เลือก **ค่าเดียว** จาก list สั้น (form) | `Select` | trigger `rounded-full h-11` · content `rounded-2xl` · item `rounded-xl py-2.5` | DropdownMenu, custom button |
| list **ยาว/ค้นหาได้** (จังหวัด/สถานที่) | `Popover` + `Command` | content `rounded-2xl` · item `rounded-xl` | Select ยาวๆ |
| **เมนูคำสั่ง/บัญชี** (ไป action ไม่ใช่เลือกค่า) เช่น Profile menu | `DropdownMenu` | content `rounded-2xl` · item `rounded-xl` (น้ำหนักปกติ) — **grammar เดียวกับ Select** | ❌ panel rounded-xl + item bold rounded-lg (ของเดิมที่ทำให้ดูไม่เหมือนกัน) |
| **เลือกหลายค่า/toggle filter** (FilterModal) | pattern **FilterChip** | pill `rounded-full border`; selected = `bg-foreground text-background`; variant การ์ดภาพ `rounded-2xl` สำหรับหมวดมีรูป — **style เดียว** | Select, raw `<span>` |
| boolean | `Checkbox` / Switch | — | — |
| ยืนยัน/ลบ (destructive) | `AlertDialog` | — | `window.confirm` |
| feedback ชั่วคราว | `toast` (sonner) | — | inline alert ค้าง |

> **คำตอบเคสเจ้าของ:** Profile dropdown = `DropdownMenu` (เมนูคำสั่ง), Filter selection = `FilterChip` (multi-select) — **คนละบทบาท จึงคนละ component ได้** แต่ **grammar ต้องร่วมกัน**: radius/size/spacing จาก §2 ชุดเดียว → ดู "เป็นตระกูลเดียวกัน" แม้ทำงานต่างกัน

### Overlay grammar
| ใช้ | เมื่อ |
|---|---|
| `Dialog` | modal งานโฟกัส, centered, `rounded-3xl`, close `h-11 w-11` มุมขวาบน |
| `Sheet` | drawer ข้าง/ล่าง — เนื้อหายาว/contextual |
| `AlertDialog` | ยืนยัน/destructive เท่านั้น |
| `Popover` | panel เล็ก anchored (date, picker) `rounded-2xl` |
| `Tooltip` | hint text สั้นเท่านั้น (ไม่ใส่ action) |

### Button grammar
- variant: `default`(primary teal) · `secondary` · `outline` · `ghost` · `destructive` · `link`
- size: `sm h-9` · `md h-11` · `lg h-12` — **ทุกตัว `rounded-full`**
- **1 primary action ต่อ view** (ห้าม CTA primary ซ้ำเจตนา) · ❌ **ห้าม override height inline** (`!h-12`) — ใช้ size prop
- icon-button = `h-11 w-11` + `aria-label`

### Component อื่นๆ (coverage ครบ — ใช้ตัวนี้กับงานนี้)
| งาน | ใช้ | หมายเหตุ |
|---|---|---|
| สลับ section ภายในหน้าเดียว | `Tabs` | ไม่ใช่ navigation ข้ามหน้า (ใช้ link) · active segment โทน accent ไม่ใช่เส้นหนา |
| เลือกวันที่ / ช่วงวัน | `Calendar` (เดี่ยว) / `DateRangePicker` (ช่วง) ใน `Popover` | trigger `rounded-full h-11` |
| ป้ายสถานะ (ไม่กดได้) | `Badge` `rounded-xl` | status (confirmed/paid) ใช้ `Badge` + token success/destructive/muted — **ไม่ใช้ raw `<span>`** · filter ที่กดได้ → FilterChip (§ ตาราง) |
| ข้อความ truncate + tooltip | `TruncatedLabel` | — |

### Composition (custom wrapper ที่มีอยู่ — ใช้ซ้ำ ไม่สร้างใหม่)
`InputField` (input+label+inline error) · `InputGroup` · `DateRangePicker` · `ErrorBanner` (server error บนฟอร์ม) · `LoadingSpinner`/`Skeleton`/`LoadingSkeleton` (loading) · `PermissionTooltip` · `TruncatedLabel`

### Interaction states (บังคับครบทุก interactive element)
`default · hover · focus (มี ring `ring-ring`) · active · loading · error · empty · disabled` — ขาดข้อใด = ไม่ผ่าน Design Gate
**Form/error pattern** (`components/ui/form-patterns.md`): client validation → inline ใต้ field · server error → `ErrorBanner` บนสุดหลัง submit · `<form noValidate>` เสมอ

---

## §4 Copy & content
- โทนไทย **เป็นกันเองแต่สุภาพ + action-oriented** ("เลือกวันเช็คอิน" ไม่ใช่ "คุณสามารถเลือก...") · EN concise imperative ("Choose dates")
- ❌ ศัพท์เทคนิคในข้อความผู้ใช้ (`API`, `OAuth`, `endpoint`, `validation`, `User ID`) → ภาษาคน
- ❌ **em-dash (—) เป็นตัวคั่น** ในข้อความ → ใช้ `,` `:` วงเล็บ (— ใช้ได้แค่แทนค่าว่างในตาราง)
- ราคา/วันที่/ตัวเลข = `tabular-nums`
- ทุก copy มี **TH/EN ใน `locales/`** (ห้าม hardcode) — copy = glossary เดียว
- **Do:** "ยืนยันการจอง" · **Don't:** "Submit booking request" / "validation error: date-before-today"

---

## §5 Named anti-patterns — กัน AI-slop (บอก agent ให้ "หนีออก" จากค่ากลางของ training)

> LLM มักผลิตค่ากลาง = slop ระบุชื่อมันตรงๆ เพื่อผลักออก ถ้างานออกมาหน้าตาแบบนี้ = **ผิด ตีกลับ**

| ❌ AI-slop tell | ✅ CampVibe counter |
|---|---|
| centered hero + gradient ม่วง-น้ำเงิน + 3 การ์ดเหมือนกันเป๊ะ | asymmetric, **1 dominant cell** ต่อ section, ผสมขนาด cell, teal POV ไม่มี gradient |
| ฟอนต์ generic ใน heading (Inter/Roboto/Arial/system) | **Outfit** (EN) / **Sarabun semibold** (ไทย) |
| การ์ด radius 16px เท่ากันหมดทั้งหน้า | radius ตามบทบาท §2 (card rounded-3xl, control rounded-full) |
| badge ตกแต่งไร้ความหมาย, fake mockup, floating icon pills | element ทุกตัวรับใช้ task (Lean §1) ตัดที่ไม่จำเป็น |
| สี over-saturated / washed-out / gray กลางๆ | OKLCH token, neutral tint เข้า teal |
| empty grid cell, layout symmetric ทื่อๆ | เติม cell ครบ, จัดวางมีน้ำหนัก |
| gradient/เงาหนา/การ์ดซ้อนการ์ด | เนื้อหานำ chrome เบา (border+spacing > shadow) |
| em-dash, ศัพท์เทคนิค, copy generic | §4 |

---

## §6 Quality gate — pre-delivery checklist (block PR ได้, รันก่อน merge→staging = "Done")
- [ ] **Token-only** — ไม่มี hex/px/สีลอย, อ้าง token+scale (light+dark) · `npm run check:palette` เขียว
- [ ] **Component-in-system** — `components/ui/*` เท่านั้น, ไม่ประดิษฐ์นอกระบบ · icon import **ใหม่** ใช้ **lucide** (§7) — tabler ใน primitive = legacy รอ migrate (ไม่ fail gate)
- [ ] **Scale ถูกบทบาท** — radius/size/spacing ตาม §2 (ไม่ override height inline)
- [ ] **States ครบ 8** — default/hover/focus/active/loading/error/empty/disabled + form/error pattern
- [ ] **a11y AA** — contrast **4.5:1 body / 3:1 heading**, focus ring มองเห็น, `aria-label` ครบ, tap ≥44px
- [ ] **i18n** — TH/EN ใน `locales/`, ไม่มี em-dash คั่น, ไม่มีศัพท์เทคนิค, tabular-nums
- [ ] **Motion** — เฉพาะ transform/opacity, 120–250ms, ไม่ `transition:all`, respect reduced-motion
- [ ] **Layout sanity** — nav < 80px สูง, CTA ไม่ wrap, ไม่มี duplicate CTA intent, ไม่มี generic card-grid
- [ ] **Anti-slop (§5)** — เทียบ screenshot กับ §1 POV: เป็น CampVibe ไม่ใช่ template
- [ ] **Test ID** — `<type>--<module>-<detail>` (เช่น `btn--wishlist-toggle`)
> verify AC จริงบน **Staging URL** ถึงนับ Done · enforcement guard: `scripts/check-palette.mjs` (+ เสนอ consistency guard, backlog §8)

---

## §7 Icon policy
- **lucide-only** (`lucide-react`) สำหรับ static UI + facility/DB-driven icons — **library เดียว**
- *(ปัจจุบัน `components/ui/*` ใช้ tabler อยู่ → migration tabler→lucide = backlog §8 ข้อ 7; งานใหม่ใช้ lucide)*

---

## §8 Living reference & consolidation backlog
**Living reference = `/preview`** (kitchen-sink, noindex) — agent/มนุษย์ดูของจริงที่นี่ · ต้องเสริม (backlog): size/variant grid, composite patterns (form+validation+error+loading), decision-matrix examples, mobile view

**Consolidation backlog (epic ถัดไป — ใช้ DESIGN.md v2 นี้เป็น spec, เรียงตาม impact):**
1. **Dropdown/select → 1 grammar** + สร้าง `FilterChip` component (Profile menu + Search/Sort/Form/Team Select align + FilterModal chips)
2. **Button `size="lg"` (h-12)** + เลิก inline `!h-12`/`h-10` override ทุกจุด
3. **Card primitive** — CampgroundCard + CampgroundForm เลิก hardcode `rounded-xl`/`rounded-3xl` ให้ใช้ `Card`
4. **Modal shell เดียว** (`rounded-3xl`, close `h-11 w-11`) — AmenitiesModal (`rounded-2xl`) align
5. **Input `size="lg"`** (h-12 rounded-full) — เลิก `!h-12` ใน LoginModal/SearchModal
6. **Badge taxonomy** — status=`Badge`, filter=`FilterChip`; เลิก raw `<span>` (เช่น booking status)
7. **Icon migration tabler→lucide** (รวม `components/ui/*`)
8. **Consistency CI guard** — ขยาย `check-palette.mjs` จับ inline height/radius นอก scale (กัน drift เหมือน palette)
9. **Wire Sarabun** — `next/font/google` subset thai+latin + Thai font stack (`:lang(th)`) → heading Sarabun semibold
10. **Cleanup** — ลบ stale hex `--color-primary:#0d9488` ใน `@theme` (globals.css), comment "orange-600" ที่ไม่ตรงค่า

---

*v1 (token + Design Gate) ยังเป็นแกน — v2 เพิ่ม brand POV, scales เลขตายตัว, component decision matrix, motion, named anti-patterns, AI-agent framing เพื่อให้ deterministic + กัน slop*
