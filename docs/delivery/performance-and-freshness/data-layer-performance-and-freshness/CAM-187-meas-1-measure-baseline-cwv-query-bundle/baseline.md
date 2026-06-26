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

> Before = ก่อนแก้ (force-dynamic + over-fetch + raw `<img>`). After = เว้นไว้จนหลัง PERF-1/CACHE-1/PERF-4. ทุกค่า = เลขวัดจริงจากเครื่องมือ (ไม่แต่ง).

### Core Web Vitals — Home `/` (Lighthouse mobile)
| Metric | Before | Target | After | Tool | Date |
|---|---|---|---|---|---|
| Performance score | **66** | — | — | Lighthouse | 2026-06-26 |
| LCP | **9.0s** 🔴 | ≤ 2.5s | — | Lighthouse | 2026-06-26 |
| CLS | **0** ✅ | ≤ 0.1 | — | Lighthouse | 2026-06-26 |
| TBT (INP proxy, lab) | 240ms | ≤ 200ms (INP) | — | Lighthouse | 2026-06-26 |
| FCP | 1.7s | — | — | Lighthouse | 2026-06-26 |
| Speed Index | 5.2s | — | — | Lighthouse | 2026-06-26 |

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
| Unused JavaScript | **689 KiB** 🔴 | ลดลง | — | Lighthouse | 2026-06-26 |
| JS execution time | 1.6s | — | — | Lighthouse | 2026-06-26 |
| Main-thread work | 3.1s | — | — | Lighthouse | 2026-06-26 |
| Legacy / minify JS | 14 / 86 KiB | — | — | Lighthouse | 2026-06-26 |

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
