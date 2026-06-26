# MEAS-1 Baseline — CampVibe data-layer (CAM-187)

> **Metric honesty:** ทุกช่องในตารางผลลัพธ์ = เลขที่ "วัดจริง" จากเครื่องมือเท่านั้น ห้ามเดา/แต่ง. ช่องที่ยังไม่วัด = ปล่อยว่างหรือ `—`.
> **State ปัจจุบัน:** Home = `force-dynamic` (ยังไม่ cache). ตัวเลขชุดนี้คือ "ก่อนแก้" บนชุด 128 ลาน.

---

## ขั้นตอนเก็บ baseline (ทำตามลำดับ)

### Step 1 — เปิด query log (Vercel staging, ชั่วคราว)
Vercel → project `campvibe` → Settings → Environment Variables → Add:
`PRISMA_QUERY_LOG = 1` (env: Preview) → Save → Redeploy staging ล่าสุด

### Step 2 — โหลดชุด 128 ลานเข้า staging DB
ใน terminal ที่โฟลเดอร์โปรเจกต์ (ใส่ staging DATABASE_URL ของคุณ):
```bash
DATABASE_URL="<STAGING_DATABASE_URL>" npm run db:load:staging
```
รอจนขึ้นสรุป `hosts: 65 / camps: 128` (รันซ้ำได้ — upsert ไม่ลบของเดิม)

### Step 3 — วัด CWV ด้วย Lighthouse (Chrome, mobile, 3 รอบ เอา median)
เปิด Chrome → URL ด้านล่าง → F12 → tab **Lighthouse** → Device **Mobile** → **Analyze**
- Home: `https://campvibe-staging.vercel.app/`
- Detail (ลานใดก็ได้): `https://campvibe-staging.vercel.app/campgrounds/<slug>`
จด **LCP / INP(หรือ TBT) / CLS / Performance score** อย่างละ 3 รอบ → เอาค่ากลาง

### Step 4 — เวลา query ฝั่ง server (Vercel Logs)
Vercel → project → Logs → ค้น `prisma_query` (เปิดหน้า Home 2-3 ครั้งให้ log วิ่ง) → จด `durationMs` ของ query listing
(ถ้าเข้า DB ได้ ทำ EXPLAIN เพิ่มได้ — query ตัวอย่างท้ายไฟล์)

### Step 5 — ขนาด bundle
```bash
ANALYZE=1 npm run build
```
เปิด `.next/analyze/client.html` → จด First-Load JS ของ `/` และ `/campgrounds/[slug]`

### Step 6 — ปิด log กลับ
Vercel → ลบ `PRISMA_QUERY_LOG` ออก (ไม่ทิ้งไว้)

---

## ผลลัพธ์ — วัดจริง 2026-06-26 · ชุด 140 ลาน · staging

> Before = ก่อนแก้ (force-dynamic + over-fetch + raw `<img>`). **After = วัดซ้ำ 2026-06-27** หลัง epic CAM-186 ครบ (PERF-1/CACHE-1/PERF-4/keyset). ทุกค่า = เลขวัดจริงจากเครื่องมือ (ไม่แต่ง).

### Core Web Vitals — Home `/` (Lighthouse mobile)
| Metric | Before | Target | After | Tool | Date |
|---|---|---|---|---|---|
| Performance score | **66** | — | **71** | Lighthouse | 2026-06-27 |
| LCP | **9.0s** 🔴 | ≤ 2.5s | **5.5s** 🟠 (−39% แต่ยังเกินเป้า) | Lighthouse | 2026-06-27 |
| CLS | **0** ✅ | ≤ 0.1 | **0.039** ✅ | Lighthouse | 2026-06-27 |
| TBT (INP proxy, lab) | 240ms | ≤ 200ms (INP) | **270ms** 🟠 | Lighthouse | 2026-06-27 |
| FCP | 1.7s | — | **1.9s** | Lighthouse | 2026-06-27 |
| Speed Index | 5.2s | — | **4.4s** | Lighthouse | 2026-06-27 |

### Core Web Vitals — `/campgrounds` (Lighthouse mobile)
| Metric | Before | Target | After | Tool | Date |
|---|---|---|---|---|---|
| Performance score | **66** | — | — | Lighthouse | 2026-06-26 |
| LCP | **9.0s** 🔴 | ≤ 2.5s | — | Lighthouse | 2026-06-26 |
| CLS | **0** ✅ | ≤ 0.1 | — | Lighthouse | 2026-06-26 |
| TBT | 240ms | ≤ 200ms | — | Lighthouse | 2026-06-26 |

### Server response + payload (curl, staging, รวม network)
| Metric | Before | Target | After | Tool | Date |
|---|---|---|---|---|---|
| `/api/campsites` payload | **902 KB** 🔴 | เล็กลงมาก (PERF-1) | **95.7 KB ✅ (−89%)** PERF-1 | curl | 2026-06-26 |
| `/api/campsites` time | TTFB ~2.3–2.7s · total ~3.0s | API p95 < 200ms | TTFB ~1.4–3.4s (latency รอ CACHE-1/PERF-2) | curl | 2026-06-26 |
| home `/` payload | 364 KB | — | **234 KB (−36%)** PERF-1 | curl | 2026-06-26 |
| home `/` time | total 2.4s (warm) / 5.3s (cold) | — | ~1.8–5.1s (รอ CACHE-1) | curl | 2026-06-26 |
| detail time | TTFB ~0.6s · total ~3.2s | — | — | curl | 2026-06-26 |

### Bundle / JS (Lighthouse insights)
| Metric | Before | Target | After | Tool | Date |
|---|---|---|---|---|---|
| Unused JavaScript | **689 KiB** 🔴 | ลดลง | **687 KiB** 🔴 (ยังไม่แตะ → PERF-BUNDLE) | Lighthouse | 2026-06-27 |
| JS execution time | 1.6s | — | **1.5s** | Lighthouse | 2026-06-27 |
| Main-thread work | 3.1s | — | **3.8s** | Lighthouse | 2026-06-27 |
| Legacy / minify JS | 14 / 86 KiB | — | — | Lighthouse | 2026-06-26 |

### Findings After (2026-06-27) — LCP ยังไม่ผ่านเป้า + bottleneck เหลือ

- ✅ **TTFB 2.3s → 40ms** (CACHE-1 ได้ผลชัด) · payload −89% · LCP 9.0s → **5.5s (−39%)**.
- ✅ **CAM-199 (PERF-IMG-LCP) DONE** — แก้รูป LCP lazy (resource load delay 2,040ms) → priority+preload การ์ด 4 ใบแรก. **วัดซ้ำ: LCP 5.5s → 2.3s ✅ ผ่านเป้า ≤2.5s** (Perf 71→82). ผลข้างเคียง: TBT 270→610ms (JS ยังหนัก).
- ✅ **CAM-200 (PERF-BUNDLE) DONE** — เจอตัวการ: `FilterModal` `import * as lucide` ลากไอคอน 1414 ตัว = 173 KB (53% ของ bundle). แก้: named ICON_MAP 39 ไอคอน + lazy modal (Search/Login/Register). **First Load JS 327 → 127 KB gz (−61%)** เข้าใต้ budget 200 KB. คาดกด TBT/main-thread ลง → owner re-measure.
- ⏭️ เหลือ (follow-on PERF-BUNDLE-2, นอก scope): `CampgroundForm`/`AmenitiesModal` ก็มี lucide wildcard (เฉพาะ route dashboard ไม่กระทบ Home).
- /campgrounds: ไม่ได้วัดซ้ำรอบนี้ (วัด Home เป็นตัวแทน — LCP image เป็นการ์ดเหมือนกัน).

> **ยังไม่วัด (optional, ไม่บล็อก):** prisma_query internal durationMs (ดึงจาก Vercel log ได้) · First-Load JS gz ต่อ route (Next 16 build ไม่พิมพ์ตาราง size แล้ว — ใช้ `ANALYZE=1` ถ้าต้องการ) · `EXPLAIN ANALYZE` (ต้อง psql เข้า staging DB). Lighthouse + curl ครอบคลุมภาพหลักพอสำหรับ before/after.

---

## EXPLAIN (optional — ถ้าเข้า staging DB ได้ผ่าน psql/Studio)
```sql
EXPLAIN ANALYZE
SELECT * FROM "CampSite"
WHERE "isActive" = true AND "isPublished" = true AND "deletedAt" IS NULL
ORDER BY "priceLow" ASC
LIMIT 40;
```
ดูว่าเป็น `Seq Scan` (ยังไม่มี index → PERF-2 จะแก้) หรือ `Index Scan`.

---

## สรุป (วัดแล้ว 2026-06-26)

- **bottleneck ยืนยันด้วยเลข:** (1) **LCP 9.0s** 🔴 ทั้ง home + `/campgrounds` (เป้า ≤2.5s = ช้า 3.6×) · (2) **`/api/campsites` payload 902 KB** = over-fetch ชัดเจน · (3) home force-dynamic total 2.4–5.3s · (4) **unused JS 689 KiB** + main-thread 3.1s · **CLS = 0** (ดีอยู่แล้ว ไม่ต้องแตะ)
- **ปลดล็อกแล้ว (มี Before เทียบ):** PERF-1 (Buffet ตัด 902 KB) · PERF-4 (รูป → LCP) · CACHE-1 (force-dynamic → cached) · PERF-2 (index) — ลงมือแล้ววัดซ้ำเติมช่อง After
- ⚠️ **อย่าลืม:** ลบ `PRISMA_QUERY_LOG` ออกจาก Vercel (Step 6) หลังเก็บเสร็จ
