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

## ผลลัพธ์ (กรอกเลขจริง)

### Core Web Vitals — Home `/`
| Metric | Before (force-dynamic, 128 ลาน) | Target | After (post-CACHE-1) | Tool | Date/SHA |
|---|---|---|---|---|---|
| LCP | — | ≤ 2.5s | — | Lighthouse mobile (median/3) | — |
| INP | — | ≤ 200ms | — | Lighthouse / field | — |
| CLS | — | ≤ 0.1 | — | Lighthouse | — |
| Performance score | — | — | — | Lighthouse | — |

### Core Web Vitals — Detail `/campgrounds/[slug]`
| Metric | Before | Target | After | Tool | Date/SHA |
|---|---|---|---|---|---|
| LCP | — | ≤ 2.5s | — | Lighthouse mobile (median/3) | — |
| CLS | — | ≤ 0.1 | — | Lighthouse | — |

### Server / payload
| Metric | Before | Target | After | Tool | Date/SHA |
|---|---|---|---|---|---|
| listing query durationMs (warm) | — | < 200ms | — | prisma_query log | — |
| listing query durationMs (cold) | — | — | — | prisma_query log | — |
| First-Load JS `/` | — | < 200KB gz | — | bundle analyzer | — |
| First-Load JS detail | — | < 200KB gz | — | bundle analyzer | — |
| EXPLAIN: index hit? | — | ใช้ index | — | EXPLAIN ANALYZE | — |

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

## สรุป (เติมหลังวัด)
- bottleneck ที่ยืนยันด้วยเลข: …
- ปลดล็อกอะไรต่อ: PERF-1/PERF-2 (ตามเลข query/bundle) · CACHE-1 (ต้องมี Before นี้ก่อน ship)
