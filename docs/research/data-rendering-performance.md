# Research Map — CampVibe Data Layer (Performance · Freshness · Visibility) | Next-phase plan

> **สถานะ:** Research + Solution Design สำหรับ **Phase ถัดไป** — ยังไม่ build ใน phase นี้ (เอกสารคือแผน)
> **โจทย์ (เจ้าของ):** (1) ลานเยอะ/รูปเยอะ → เปิด Home/listing/filter แล้ว render การ์ด กิน performance สูง ขนาดใช้คนเดียวก็เริ่มหนัก · (2) หลังเจ้าของลงลานเสร็จ ต้องขึ้นแบบ real-time ไหม → research + design solution ทั้งระบบข้อมูล (ไม่ใช่แค่รูป)
> **ยึดตาม:** `.claude/rules/performance.md` (Measure → Identify → Fix → Verify → Guard · metric honesty · budgets) + `.claude/rules/architecture.md` (Pixel/Set/Buffet · no N+1 · compute-on-the-fly) + `.claude/rules/seo.md` (SSR/ISR crawlable) + `.claude/rules/security.md` (default-deny / visibility)
> **Metric honesty:** **ยังไม่ได้วัดจริง (NOT MEASURED)** — วิเคราะห์จากกลไก (query shape / Big-O) + โค้ดจริง; ตัวเลขที่ยกเป็น "ภาพประกอบเชิงกลไก" ไม่ใช่ผลวัด ขั้นแรกของ Phase ถัดไป = **วัดก่อน (MEAS-1)**
> **Provenance:** §6–§7 (freshness + visibility) มาจาก multi-agent review (8 agents · 3 adversarial lenses) ที่ตรวจ claim กับโค้ดจริง — confidence ระบุราย item ใน §11

---

## 0. How to use this map (สำหรับ AI agent ที่จะวางแผน/ลงมือต่อ)

อ่านแล้ววางแผนต่อได้เลยตามนี้:

1. **§11 AI-Actionable Backlog คือคิวงาน** — แต่ละ item มี `ID · type · priority · status · depends · evidence(file:line) · AC · pickup`
2. **เคารพ `status`:**

   - `DECIDED` → พร้อมเข้า Discovery (`/discover`) → G1 ได้เลย
   - `NEEDS-MEASUREMENT` → ต้องทำ **MEAS-1** ก่อน (ห้ามแก้ก่อนวัด — performance.md)
   - `NEEDS-HUMAN-DECISION` → **ถามเจ้าของก่อน** อย่าเดา (ดู §10 Decisions Log)
   - `NEEDS-VERIFY` → ตรวจโค้ดยืนยันก่อนตัดสิน
   - `DEFERRED` → มี trigger กำหนด อย่าเพิ่งเริ่ม

3. **เคารพ `depends`** — อย่าทำ `CACHE-*` ก่อน `MEAS-1` + `SEC-1` + การต่อสาย `FRESH-1` ครบ
4. **ก่อนลงมือทุกครั้ง:** re-verify `evidence` (file:line) ว่ายังอยู่จริง (โค้ดขยับได้) → run `/discover` ปิด gap → 1 item ≈ 1 atomic story (PR ≤ ~400 บรรทัด, ใหญ่กว่านั้นแตกย่อย) → ผ่าน gates G1–G5 + `.claude/rules`
5. **ลำดับแนะนำ:** `SEC-1` + `MEAS-1` ก่อน (อิสระ ไม่ต้องรอใคร) → §9 Roadmap

---

## 1. TL;DR (สรุปสำหรับตัดสินใจ)

**A. เรื่อง performance — ที่หนักตอนใช้คนเดียวไม่ใช่เพราะข้อมูลเยอะ** แต่เพราะ 2 อย่าง:

1. หน้า Home เป็น **`force-dynamic`** → ปิด cache ทั้งหมด ทุก request รัน query หนักใหม่ ([app/page.tsx:15](app/page.tsx#L15))
2. **Over-fetch** — ดึงรีวิวทั้งหมด + รูปทั้งหมด + spots/options ต่อลาน เพื่อแสดงการ์ดที่ใช้แค่ชื่อ/ราคา/เรตติ้ง/รูปเดียว

> "ดึงแยกทีละตัว" ไม่ได้เกิดจริง — เป็น `findMany` ก้อนเดียว ไม่มี N+1 · filter อยู่ฝั่ง DB อยู่แล้ว ✅ ปัญหาคือก้อนเดียวนั้น `include` หนักเกินจำเป็น

**ทางแก้หลัก:** **"List Buffet"** (read-model ของการ์ด) + maintained aggregate + keyset pagination + cache (revalidate) + next/image

**B. เรื่อง real-time — ไม่จำเป็น** (รายละเอียด §6): catalog สาธารณะไม่ต้อง push/websocket · `force-dynamic` ขึ้นทันทีอยู่แล้ว · ไม่มีด่านอนุมัติให้ต้องรอ · สิ่งที่ต้องการคือ **"freshness ขึ้นไวในไม่กี่วินาที"** ทำด้วย **on-demand revalidation** (`revalidateTag` ตอน publish) ไม่ใช่ real-time

**C. เจอช่องโหว่จริง (BLOCKER, §7):** หน้า detail สาธารณะดึงด้วย slug อย่างเดียว **ไม่กรอง** `isPublished/isActive/deletedAt` → ลานที่ยังไม่เผยแพร่/ปิด/ลบ เปิดดูได้ตรงๆ ผ่าน URL → **`SEC-1` แก้ก่อน เป็นอิสระจากเรื่อง cache**

**ลำดับความคุ้ม:** วัด baseline + ปิดช่องโหว่ → projection/index/pagination → images → maintained aggregate → caching (หลังวัด) → search (เมื่อถึง trigger)

---

## 2. ขอบเขต (Scope & Non-goals)

**ทำใน Phase ถัดไป:** ปิดช่องโหว่ visibility · read-model (Buffet) · caching + freshness strategy · image pipeline · pagination · maintained aggregate · DB indexes · availability correctness · instrumentation (วัด)

**ไม่ทำตอนนี้:** ยังไม่เขียนโค้ด (เอกสารคือแผน) · ยังไม่ย้าย search engine · ยังไม่ทำ pgvector/semantic (ADR-008 deferred) · ยัง**ไม่**เปลี่ยน `force-dynamic` → cache จนกว่าจะวัด + ต่อสาย invalidation ครบ

**Non-goals:** ไม่ rewrite ระบบ · ไม่ over-engineer ให้รองรับ 1M ลานทั้งที่ยังหลักร้อย — scale ตามจริง · ไม่ทำ real-time push (ไม่จำเป็น §6)

---

## 3. Current State — สิ่งที่เป็นอยู่จริง (grounded, NOT MEASURED)

### 3.1 หน้า Home — query shape จริง

[app/page.tsx](app/page.tsx) (Server Component, `dynamic = 'force-dynamic'`):

```ts
// ทั้ง 2 สาขา (rating / price) include เหมือนกัน:
const rows = await prisma.campSite.findMany({
  where,                                   // buildCampSiteWhere — filter ฝั่ง DB ✅
  include: {
    location: true,
    operator: { select: { name: true } },
    images: { orderBy: { sortOrder: 'asc' } }, // ⚠️ ดึงรูป "ทั้งหมด" ต่อลาน
    _count: { select: { reviews: true } },
    reviews: { where: { deletedAt: null }, select: { rating: true } }, // ⚠️ ดึงรีวิว "ทั้งหมด" ต่อลาน
  },
  // rating: ไม่มี orderBy/take → JS sort + slice(0,40) | price: orderBy + take:40 ✅ แต่ priceLow ไม่มี index ⚠️
});
campSites = rows.map(({ reviews, ...rest }) => ({ ...rest, avgRating: computeAvgRating(reviews), reviewCount: reviews.length }));
```

### 3.2 Performance bottlenecks (พร้อมหลักฐาน)

| # | ปัญหา | หลักฐาน | กลไก (NOT MEASURED) |
| --- | --- | --- | --- |
| **B1** | ไม่มี cache — `force-dynamic` | [app/page.tsx:15](app/page.tsx#L15) | ทุก request = query หนัก + render ใหม่ แม้ข้อมูลไม่เปลี่ยน |
| **B2** | Over-fetch รีวิวทั้งหมดต่อลาน | include `reviews` | ภาพประกอบ: 100 ลาน × 50 รีวิว = ~5,000 แถว เพื่อค่าเฉลี่ย 100 ค่า |
| **B3** | Rating sort in-memory cap 40 | [lib/sort-utils.ts:30-46](lib/sort-utils.ts#L30-L46) (scale-guard ~200 ลาน) | ดึง published ทั้งหมด → sort ใน JS → พังเกิน ~200 ลาน |
| **B4** | Over-fetch รูปทั้งหมดต่อลาน | include `images` ไม่มี `take` | การ์ดใช้รูปเดียว แต่ดึงทั้ง 7+ รูป × ทุกลาน |
| **B5** | API ไม่มี pagination | [app/api/campsites/route.ts](app/api/campsites/route.ts), [app/api/campgrounds/route.ts](app/api/campgrounds/route.ts) | คืนทุกแถวที่ match — payload โตไม่จำกัด |
| **B6** | รูปใช้ `<img>` ดิบ | [components/ui/image-with-fallback.tsx](components/ui/image-with-fallback.tsx) | ไม่ optimize, CLS, ไม่มี responsive/AVIF/WebP/lazy/placeholder |
| **B7** | ไม่มี index บนคอลัมน์ที่ sort | [prisma/schema.prisma:335-338](prisma/schema.prisma#L335-L338) | sort `priceLow`/`createdAt` = scan เมื่อข้อมูลโต |

### 3.3 Visibility & correctness findings (verified กับโค้ด)

| # | สิ่งที่พบ | หลักฐาน | ระดับ |
| --- | --- | --- | --- |
| **V1** | **หน้า detail สาธารณะไม่กรองการมองเห็น** — `findFirst` by slug อย่างเดียว ไม่มี `isPublished/isActive/deletedAt` ไม่ผ่าน `buildCampSiteWhere` → ลานยังไม่เผยแพร่/ปิด/ลบ เปิดดูได้ผ่าน URL slug | [app/campgrounds/[slug]/page.tsx:20](app/campgrounds/[slug]/page.tsx#L20) | 🔴 BLOCKER |
| **V2** | **GET by-id ก็ไม่กรอง** เช่นกัน (ผ่าน `getCampSiteWithCapacity` → `findUnique({where:{id}})`) | [app/api/campsites/[id]/route.ts:9-19](app/api/campsites/[id]/route.ts#L9-L19) | 🔴 |
| **V3** | **availability สดทุก request (ถูกต้อง)** — นับ booking CONFIRMED+PENDING ต่อวันเทียบ `maxGuestsPerDay/maxTentsPerDay` → ต้องคง no-store ห้ามใส่ tab cache catalog | [lib/campsite-availability.ts](lib/campsite-availability.ts) | ⚠️ ต้องคงสภาพ |
| **V4** | **ไม่มี moderation gate** — visibility = `isActive + isPublished + deletedAt:null` ที่เดียว; `isVerified` เป็นแค่ badge ไม่กั้น; publish = ขึ้นทันที; และ **3 path seed/scrape ตั้ง `isPublished:true` เอง** (seed:100, bulk-seed:92, scrape-seed:181) | [lib/campsite-filters.ts:41-45](lib/campsite-filters.ts#L41-L45) | ⚪ product Q |
| **V5** | **DELETE เป็น hard delete** (ไม่ใช่ soft `deletedAt`) — แถวหายเลย | [app/api/campsites/[id]/route.ts:141](app/api/campsites/[id]/route.ts#L141) | ℹ️ ข้อเท็จจริง |

> **สิ่งที่ทำถูกอยู่แล้ว:** filter ฝั่ง DB (`buildCampSiteWhere`) ใช้ร่วมกันทุก path ของ **listing** (home + 2 API + 2 count action) ✅ · หน้า detail ใช้ `review.aggregate` ถูกต้อง · wishlist ไม่ N+1 · มี composite `@@index([isPublished, deletedAt])`

---

## 4. หลักการออกแบบ — "List Buffet" (read-model ของการ์ด)

ตาม `.claude/rules/architecture.md` (Pixel · Set · **Buffet**): client ผูกกับ Buffet (read layer UI-neutral) ไม่ใช่ raw table — listing ไม่ควรดึง "Set เต็ม" มาแสดงการ์ด

**การ์ดต้องการแค่:** `id, nameTh/En, slug, priceLow, province, avgRating, reviewCount, createdAt, isVerified, รูปปก 1 (+blur)` ([components/CampgroundCard.tsx:15-27](components/CampgroundCard.tsx#L15-L27))

```ts
// lib/queries/camp-card.ts (Phase ถัดไป) — Buffet สำหรับการ์ด listing
export const campCardSelect = {
  id: true, nameTh: true, nameEn: true, nameThSlug: true, nameEnSlug: true,
  priceLow: true, priceCurrency: true, isVerified: true, createdAt: true,
  avgRating: true, reviewCount: true,                       // ← คอลัมน์ใหม่ (§5E / AGG-1)
  location: { select: { province: true } },
  images: { select: { url: true, blurDataURL: true }, orderBy: { sortOrder: 'asc' }, take: 1 },
} satisfies Prisma.CampSiteSelect;
```

ตัด B2 (ไม่ดึงรีวิว) + B4 (รูปเดียว) ในการเปลี่ยนจุดเดียว

---

## 5. Solution Design ทั้งระบบ (5 ชั้น)

### A. Query / Data layer

- **A1** ใช้ `campCardSelect` (Buffet) แทน include หนัก ทุกหน้า listing → ตัด B2/B4 → `PERF-1`
- **A2** Keyset (cursor) pagination แทน offset/slice — O(1) ([Prisma pagination](https://www.prisma.io/docs/orm/prisma-client/queries/pagination)); cursor บนคอลัมน์ที่มี index ตรง orderBy เช่น `(priceLow, id)` · หมายเหตุ Prisma cursor desc เคยช้า ([prisma#12650](https://github.com/prisma/prisma/issues/12650)) → EXPLAIN ก่อน lock → `PERF-3`
- **A3** ฆ่า rating-sort in-memory (B3) → sort ด้วยคอลัมน์ `avgRating` ฝั่ง DB + index → `PERF-5`
- **A4** DB indexes (B7): `@@index([avgRating])`, `@@index([priceLow])`, `@@index([createdAt])`, composite `@@index([isPublished, deletedAt, priceLow])`; ตรวจ `EXPLAIN ANALYZE` → `PERF-2`
- **A5** filter คงฝั่ง DB (ดีอยู่แล้ว); availability filter ([lib/campsite-filters.ts:118-134](lib/campsite-filters.ts#L118-L134)) แพง+cache ยาก → §7 / `AVAIL-1`

### B. Caching / Rendering layer (Next.js 16 — Cache Components) → `CACHE-1` (หลังวัด)

โปรเจกต์อยู่ **Next 16.2.9** → ใช้ `'use cache'` + `cacheLife` + `cacheTag`/`updateTag` + PPR ได้ ([Next.js caching](https://nextjs.org/docs/app/getting-started/caching))

- **B1** เลิก `force-dynamic` → เปิด `cacheComponents` · **B2** PPR static shell + dynamic ส่วน per-user ใต้ `<Suspense>` · **B3** `'use cache'` ใกล้จุดดึงข้อมูล + `cacheLife` + `cacheTag('campsites')` · **B4** wishlist (per-user) แยกออกจาก cache catalog
- **สำคัญ:** cache **ตัวการดึงข้อมูล (data fetch) ไม่ใช่ทั้ง route** — `app/page.tsx` รับ searchParams ~14 ตัว → route เป็น per-variant ไม่ใช่ก้อน cache เดียว · invalidation + CDN trap + measurement → §6

### C. Image layer → `PERF-4` (Phase 1) + `IMG-CDN-2` (Phase 2, deferred)

**CDN ≠ optimization:** "ขนาดเหมาะแต่ละที่" = image **OPTIMIZATION** (resize+format ผ่าน `sizes`/srcset) ไม่ใช่ CDN. บน Vercel `next/image` ให้ **optimization + edge CDN ในตัว** → **ไม่ต้องตั้ง/เช่า CDN แยกตอนนี้** (verified — workflow `image-cdn-decision`, Vercel docs 2026-02)

สถานะจริง: [image-with-fallback.tsx](components/ui/image-with-fallback.tsx) เป็น `<img>` ดิบ (มีแค่ login/register ใช้ next/image) · [next.config.ts](next.config.ts) hotlink unsplash อย่างเดียว ไม่ตั้ง qualities/formats/deviceSizes/TTL · **origin ทำแล้ว:** [app/api/upload/route.ts](app/api/upload/route.ts) อัปโหลดเข้า Vercel Blob อยู่แล้ว (`put()`+MIME allow-list+5MB, fallback `/uploads`) → งานคือ "ยืนยัน + เพิ่ม remotePattern" ไม่ใช่ "ย้าย"

- **C1** migrate `ImageWithFallback` `<img>` → `next/image` (คง fallback) — **blast radius:** wrapper ใช้ ~11 จุด (card/gallery/LogoUpload/ImageUpload/PreviewClient/bookings/dashboard) → preview ที่เป็น `blob:`/`data:` URL optimize ไม่ได้ → ต้องมี prop `unoptimized` escape hatch; น่าจะแตก >1 PR (>400 บรรทัด)
- **C2** `sizes` ต่อบริบท **ดึงจาก layout จริง** — การ์ด aspect-square (วัดคอลัมน์จริง) · thumbnail = `80px` (`w-20` ไม่ใช่ 96px) · detail-hero (LCP) อยู่ที่ [CampgroundDetailClient.tsx](components/CampgroundDetailClient.tsx) **ไม่ใช่** ImageGallery lightbox (mount เฉพาะตอนเปิด = offscreen, preload จะทำ LCP แย่ลง)
- **C3** กัน CLS: `fill` กับรูปเต็มกล่อง (wrapper relative+overflow แล้ว) / `width`+`height` กับขนาดคงที่ · lightbox `object-contain` **อย่าใช้** `fill`
- **C4** LCP: `priority` ถูก deprecate ใน Next 16 → ใช้ `preload`/`fetchPriority=high` เฉพาะ hero above-the-fold จริง
- **C5** `next.config` v16: **`qualities:[75]` REQUIRED** (ไม่ตั้ง = build error) · `formats:['image/webp']` (ยังไม่เปิด AVIF) · trim `deviceSizes/imageSizes` เหลือเท่าที่ layout ใช้ · `minimumCacheTTL` ~31 วัน (+ ตั้ง `Cache-Control` max-age ยาวที่ Blob origin ด้วย — remote image ฟัง upstream TTL) · `dangerouslyAllowSVG=false`
- **C6** `remotePatterns`: เพิ่ม `*.public.blob.vercel-storage.com` (wildcard) คง unsplash (seed); `/uploads/*` same-origin ไม่ต้องใส่
- **C7** `blurDataURL` = **งาน backend จริง** (gen LQIP ตอน upload ด้วย sharp/plaiceholder เก็บใน `Image` model) ไม่ใช่ toggle — อย่า ship `placeholder="blur"` โดยไม่มีค่า (runtime error)

**Cost / เมื่อไรค่อยมี dedicated CDN (`IMG-CDN-2`, DEFERRED):**

- คิดเงินที่ **distinct transformation** (width×quality×format×source) บน cache MISS/STALE + **delivery (Fast Data Transfer + Edge Request) ทุก HIT** — ที่ scale **delivery ครองบิล** ไม่ใช่ transform
- 🔴 **URL-stability trap:** Vercel แคช optimizer ด้วย source URL — ถ้า Blob URL signed/มี query แปรผัน → MISS ทุกครั้ง re-bill ไม่จบ → **ต้องใช้ public URL คงที่** + ดู cache-writes/วัน สัปดาห์แรก
- **ตั้ง Vercel Spend Management cap + alert ตั้งแต่ตอนนี้** (ถูกสุด กันบิลพุ่ง)
- **commercial gate:** marketplace live บน Hobby ผิด ToS → ต้อง **Pro (~$20/seat/mo floor)** + metered → Phase 1 "ฟรี" จริงเฉพาะ non-commercial
- **trigger ย้าย:** เมื่อ image-line ของบิล Vercel เกินงบ/เดือน หรือ FDT จากรูปสูง → ย้าย **Cloudflare R2 (egress ฟรี) + Cloudflare Images** ผ่าน next/image `loaderFile` (bypass optimizer แต่ยังได้ srcset) · flat: Bunny · เลี่ยง imgix / ระวัง Cloudinary suspend · **ราคา 3rd-party = indicative ต้อง verify ตอนตัดสิน** (metric honesty)

### D. Search / Filter scaling path (decision gate) → `SEARCH-1` (DEFERRED)

| ระยะ | ลาน (โดยประมาณ) | วิธี |
| --- | --- | --- |
| ตอนนี้–ใกล้ | < ~10k | Postgres `WHERE` + B-tree index (มีอยู่ + A4) ([Supabase FTS](https://supabase.com/blog/postgres-full-text-search-vs-the-rest)) |
| keyword search | มี search box | Postgres FTS (`tsvector`) + `pg_trgm` |
| faceted UX + โต | filter/count ซับซ้อน / โตมาก | Meilisearch/Typesense (index แยก) ([Meilisearch vs PG](https://www.meilisearch.com/blog/postgres-full-text-search-limitations)) |

→ **อย่าเพิ่ง** (single user, ~128 ลาน) — trigger ชัด: search UX เป็น growth lever / faceted count / > ~10k ลาน

### E. Aggregate maintenance (compute-on-the-fly ที่ถูกต้อง) → `AGG-1`

ตาม architecture.md §12: aggregate ต้อง derive จาก source ได้เสมอ (cache เป็นคอลัมน์ได้ แต่ต้องมี derivation trail)

- **E1** เก็บ `CampSite.avgRating` + `reviewCount` อัปเดตใน transaction เดียวกับการเขียน/ลบ Review · **E2** job recompute reconcile จาก `review.aggregate` · **E3** availability คำนวณ on-demand + index `Booking(checkInDate,checkOutDate)`/`BlockedDate` → §7

---

## 6. Freshness & Real-time decision (จาก multi-agent review)

### 6.1 ตอบโจทย์: **ไม่จำเป็นต้อง real-time**

ไม่ต้อง websocket/push สำหรับลานที่เพิ่งลง เพราะ: (1) ไม่มีด่านอนุมัติให้รอ (V4) — publish = ขึ้นทันที · (2) `force-dynamic` ตอนนี้สดอยู่แล้ว · (3) โจทย์คือ **freshness (ขึ้นในไม่กี่วินาที) ไม่ใช่ real-time (push ต่ำกว่าวินาที)**

### 6.2 แยกผู้ชม 4 กลุ่ม (ความต้องการต่างกัน)

| กลุ่ม | real-time? | วิธีถูกต้อง |
| --- | --- | --- |
| A. แคตตาล็อกสาธารณะ | ❌ | คงความสด + (ภายหลัง) cache + invalidate ตอน publish (`CACHE-1`) |
| B. เจ้าของเห็นลานตัวเอง | ❌ (แต่เห็นทันที) | หน้า dashboard เจ้าของ = no-store เฉพาะหน้านั้น / refetch หลัง save — ไม่ใช่ push ทั้งระบบ (`FRESH-2`) |
| C. availability/ที่ว่าง | ✅ time-sensitive จริง | คงสด (no-store) เสมอ + กัน double-book ที่ transaction (`AVAIL-1`) |
| D. /status ops | คนละเรื่อง | แยกพิจารณา (ไม่อยู่ในการตัดสินนี้) |

### 6.3 วิธีที่แนะนำ — on-demand revalidation (ไม่ใช่ push)

catalog: `force-dynamic` → fetch ติด tag (`next:{tags:['campsites']}` / `unstable_cache`) แล้ว `revalidateTag('campsites')` ตอน publish → ขึ้นให้ทุกคนในไม่กี่วินาที **โดยยังได้ cache**

**ต้องต่อ `revalidateTag('campsites')` ครบทุก write path ที่เปลี่ยนการมองเห็น (FRESH-1)** ไม่งั้นลาน stale:

- POST create+publish ([app/api/campsites/route.ts:124](app/api/campsites/route.ts#L124))
- PUT แก้ `isPublished`/`isActive`/filterable fields ([app/api/campsites/[id]/route.ts](app/api/campsites/[id]/route.ts) — endpoint เดียวกัน)
- hard DELETE ([app/api/campsites/[id]/route.ts:141](app/api/campsites/[id]/route.ts#L141))
- **3 path ไม่ใช่เจ้าของ:** seed:100, bulk-seed:92, scrape-seed:181
- **regression guard (test)** จับ write path ใหม่ที่ลืม `revalidateTag` ("พลาดอันเดียว = ลาน stale")

### 6.4 กับดักที่ต้องระวัง

- **CDN trap:** `revalidateTag` ล้าง cache ฝั่ง Next เท่านั้น ไม่ล้าง `Cache-Control`/`s-maxage` ระดับ CDN — ถ้าเพิ่ม header CDN ภายหลังต้องคู่กับ edge purge
- **cache cardinality:** searchParams ~14 ตัว → cache key เยอะ; tag เดียว invalidate ทั้งหมดตอน publish (ถูกเรื่อง freshness แต่ลดประโยชน์ด้าน cost) → cache ที่ชั้น data fetch
- **cross-region:** อย่าสัญญา "ขึ้นทันทีทุกคน" เป็นข้อเท็จจริง — SLA ที่ถูกคือ "ในไม่กี่วินาที"
- **detail page** ([app/campgrounds/[slug]/page.tsx](app/campgrounds/[slug]/page.tsx)) ถ้า cache ภายหลังต้องใช้ tag ราย id (`camp:<id>`) ไม่ใช่ tag catalog + ตอนนี้ยังไม่มี `generateMetadata`/`dynamic`/`revalidate`

### 6.5 เงื่อนไขสำคัญ

**ห้าม ship `CACHE-1` พร้อมการตัดสิน real-time นี้** — `force-dynamic` ให้ความสดที่ถูกต้องอยู่แล้ว การไป cache = แลกความสดที่การันตีแล้วกับ CWV/cost ที่ **ยังไม่ได้วัด** → ต้องผ่าน `MEAS-1` (วัดก่อน-หลัง) + ต่อ `FRESH-1` ครบก่อน

---

## 7. Visibility · Availability · Booking correctness

- **SEC-1 (BLOCKER, อิสระ ทำก่อน):** ปิดช่องโหว่ V1+V2 — หน้า detail ([app/campgrounds/[slug]/page.tsx:20](app/campgrounds/[slug]/page.tsx#L20)) + GET by-id ([app/api/campsites/[id]/route.ts:9-19](app/api/campsites/[id]/route.ts#L9-L19)) ต้องกรอง `isPublished+isActive+deletedAt:null` (หรือ route ผ่าน `buildCampSiteWhere`) สำหรับผู้ชมสาธารณะ; เจ้าของ/แอดมินยัง preview ลานตัวเองได้
- **AVAIL-1:** availability ([lib/campsite-availability.ts](lib/campsite-availability.ts)) คงสด (no-store) **ห้าม**ใส่ tag `campsites`; ตัวคุมความถูกต้องจริง = **เช็คความจุแบบ transaction ตอนสร้างการจอง** (กัน double-book); ต้องนับ `BlockedDate` ([prisma/schema.prisma:634](prisma/schema.prisma#L634)) เป็นแหล่งที่ว่างที่สองด้วย
- **BOOK-1 (verify):** ยืนยัน snapshot-on-CONFIRMED (architecture §13) ถูกบังคับใน `lib/bookings.ts` — ตรึงราคา/นโยบาย/ช่วงวันลง Booking ตอน CONFIRMED เพื่อกันเจ้าของแก้ราคาระหว่างลูกค้าจอง
- **PROD-1 (ถามเจ้าของ):** ตอนนี้ publish = ขึ้นสาธารณะทันที ไม่มีรีวิวคุณภาพ (รวม seed/scrape) — ตั้งใจไหม? ถ้าอยากคุมคุณภาพ คันโยกคือ draft/review/cooldown (ไม่ใช่ real-time)

---

## 8. Budgets & Instrumentation (ต้อง "วัดก่อน" — performance.md) → `MEAS-1`

| Metric | เป้า | วัดด้วย |
| --- | --- | --- |
| LCP (p75 field) | ≤ 2.5s | `web-vitals` + Lighthouse/PageSpeed |
| INP | ≤ 200ms | web-vitals / Vercel Speed Insights |
| CLS | ≤ 0.1 | web-vitals (เป้าหลังแก้รูป) |
| API p95 | < 200ms | Vercel Analytics + log เวลา query |
| JS bundle / route | < 200KB gz | `next build` + bundle analyzer |
| รูป/ภาพ | < 200KB | network panel หลัง next/image |

**เครื่องมือ:** Prisma query log (`log:['query']` / `$on('query')`) + `EXPLAIN ANALYZE` (index hit) · Vercel Speed Insights/Analytics (field CWV)
**Guard:** test ยืนยัน listing query ไม่ดึง `reviews` relation · budget check ใน CI (ต่อจาก `check:ds`/`check:palette`) · alert API p95 เกินงบ

---

## 9. Phased Roadmap (ลำดับลงมือ)

> loop: วัด → แก้ ROI สูงก่อน → วัดซ้ำ → ใส่ guard

| Phase | งาน (item IDs) | trigger / เหตุผล | effort (NOT MEASURED) |
| --- | --- | --- | --- |
| **P0 — Measure + Secure** | `MEAS-1` วัด baseline · `SEC-1` ปิดช่องโหว่ visibility | ห้ามแก้ก่อนวัด · ช่องโหว่อิสระ ทำได้เลย | S |
| **P1 — Read-model + index** | `PERF-1` Buffet · `PERF-2` indexes · `PERF-3` pagination/API take | ROI สูงสุด, แก้อาการ over-fetch | M |
| **P2 — Aggregate + images** | `AGG-1` maintained avgRating · `PERF-5` rating sort ฝั่ง DB · `PERF-4` images | ปลด scale-guard 200 ลาน + คุม CWV/payload | M-L |
| **P3 — Caching (หลังวัด)** | `CACHE-1` + `FRESH-1` revalidate wiring + guard · `FRESH-2` host preview no-store | freshness โดยยัง cache; **ต้องผ่าน MEAS-1 ก่อน** | M |
| **P-correctness (ขนาน)** | `AVAIL-1` · `BOOK-1` · `PROD-1` (ถามเจ้าของ) | ความถูกต้อง booking/visibility | M |
| **P4 — Search (มี trigger)** | `SEARCH-1` Postgres FTS → engine | search UX / faceted / > ~10k ลาน | L (ภายหลัง) |

---

## 10. Decisions Log

| สถานะ | เรื่อง | สรุป |
| --- | --- | --- |
| ✅ DECIDED | real-time ลานใหม่ | **ไม่ทำ** — freshness ผ่าน on-demand revalidation พอ (§6) |
| ✅ DECIDED | image CDN | **ไม่มี CDN แยก** — next/image (Vercel optimize+CDN ในตัว) + origin Vercel Blob (มีแล้ว); dedicated CDN = deferred (`IMG-CDN-2`, §5C) |
| ✅ DECIDED | read-model | ใช้ List Buffet `campCardSelect` (§4) |
| ✅ DECIDED | pagination | keyset/cursor ไม่ใช่ offset (A2) |
| ✅ DECIDED | aggregate | denormalize `avgRating`/`reviewCount` + derivation trail (E/AGG-1) |
| ✅ DONE | ช่องโหว่ visibility (`SEC-1`) | แก้แล้ว — gate detail + by-id + availability + spots · CAM-185 · PR #181 merged staging |
| ✅ DECIDED (delegated) | moderation/draft gate (`PROD-1`) | **ไม่เพิ่ม** ขั้น draft/review · เผยแพร่ทันทีตามเดิม (lean; เพิ่มภายหลังได้ถ้าธุรกิจต้องคุมคุณภาพ) |
| ✅ DECIDED | soft-404 page | bundle เข้า `SEO-1` (deferred) — page คืน 200 เพราะ middleware+notFound; ข้อมูลปลอดภัยแล้ว ไม่ใช่ security |
| ⏸️ BLOCKED-ON-MEASUREMENT | force-dynamic → cache | optimization ที่ยังไม่ได้วัด — ต้อง `MEAS-1` ก่อน (§6.5) |
| 🕒 DEFERRED | search engine | `SEARCH-1` — trigger-based (D) |
| ✅ DECIDED | CWV telemetry | **ตัวฟรีของเราเอง** — `web-vitals` → `POST /api/vitals` (ไม่ใช่ Vercel Speed Insights ที่เสียเงิน) |
| ✅ DECIDED | images (`PERF-4`) | **วัดก่อน (MEAS-1) ค่อยตัดสิน** ว่ารูปเป็นคอขวดจริงไหม → next/image+spend-cap หรือ defer `IMG-CDN-2` (cost → escalate) |
| 🎯 TARGET | caching (`CACHE-1`) | **PPR / `'use cache'`** เป็นเป้า (spike ยืนยัน Next 16.2 ก่อน) · fallback `unstable_cache + revalidateTag` ถ้าไม่ viable · ยัง blocked-on-MEAS-1 |

---

## 11. AI-Actionable Backlog

> 1 item ≈ 1 atomic story · ก่อนทำ: re-verify evidence (file:line) + `/discover` ปิด gap + ผ่าน gates · respect `status`/`depends`

| ID | Title | type | prio | status | depends | evidence |
| --- | --- | --- | --- | --- | --- | --- |
| **MEAS-1** | วัด baseline (CWV/API/bundle) | perf | P0 | DECIDED | — | §8 |
| **SEC-1** | ปิดช่องโหว่ public visibility (detail + by-id + availability + spots) | security | P0 | ✅ DONE (CAM-185 · PR #181 staging) | — | page.tsx · [id]/availability/spots routes |
| **SEO-1** | detail page SEO: generateMetadata + robots + canonical + JSON-LD + **hard-404** (แก้ soft-404 จาก middleware+notFound) | seo | P3 | DEFERRED (รวม hard-404 จาก SEC-1) | — | page.tsx (ไม่มี generateMetadata) · middleware.ts |
| **PERF-1** | List Buffet `campCardSelect` (การ์ด = carousel → `images take:5` ไม่ใช่ take:1) | perf | P1 | DECIDED | MEAS-1 | §4 · lib/read-models/camp-card.ts · CampgroundCard.tsx |
| **PERF-2** | DB indexes (priceLow/createdAt/avgRating/composite) | perf | P1 | DECIDED | — | schema:335-338 |
| **PERF-3** | Keyset pagination + API `take` | perf | P1 | DECIDED | PERF-2 | A2 · routes |
| **AGG-1** | Maintained `avgRating`/`reviewCount` (txn + reconcile job) | data | P2 | DECIDED | — | sort-utils.ts:30-32 |
| **PERF-5** | Rating sort ฝั่ง DB (เลิก in-memory) | perf | P2 | DECIDED | AGG-1, PERF-2 | page.tsx:94-122 |
| **PERF-4** | Images → next/image + `sizes` (~22 จุด/9 ไฟล์; วัดก่อน MEAS-1 ค่อยตัดสิน + spend cap) | perf | P2 | DECIDED (gated by MEAS-1) | MEAS-1, PERF-1 | image-with-fallback.tsx:63 · next.config.ts |
| **IMG-CDN-2** | Dedicated image CDN (R2 + Cloudflare Images via `loaderFile`) | perf | — | DEFERRED | PERF-4 + cost trigger | §5C |
| **CACHE-1** | force-dynamic → cached catalog (PPR/`use cache`) | perf | P3 | NEEDS-MEASUREMENT | MEAS-1, SEC-1, FRESH-1 | §6 |
| **FRESH-1** | `revalidateTag` wiring ครบทุก write path + guard | correctness | P3 | DECIDED | CACHE-1 | §6.3 |
| **FRESH-2** | host preview/dashboard = no-store/refetch | ux | P2 | NEEDS-VERIFY | — | (หา host management routes) |
| **AVAIL-1** | availability no-store + transactional capacity + BlockedDate | correctness | P1 | 🟡 PARTIAL — booking-write เสร็จ (BlockedDate+Serializable tx+P2034+CAM-57 tests); เหลือ GET availability นับ BlockedDate + explicit no-store + verify staging | — | app/api/bookings/route.ts · campsite-availability.ts:8 · [id]/availability routes |
| **BOOK-1** | verify snapshot-on-CONFIRMED | correctness | P2 | ✅ VERIFIED — snapshot ตรึงตอน create (PENDING) ใน txn | — | app/api/bookings/route.ts:145-171 |
| **PROD-1** | moderation/draft gate? | product | P1 | ✅ DECIDED (delegated): ไม่เพิ่ม — เผยแพร่ทันทีตามเดิม | — | V4 |
| **SEARCH-1** | search engine decision gate | arch | — | DEFERRED | trigger | §5D |

### Acceptance criteria (รายตัวที่สำคัญ)

- **SEC-1** — ขอ detail by slug / GET by-id ของลานที่ `isPublished=false` หรือ `isActive=false` หรือ `deletedAt!=null` โดย anonymous/ผู้ไม่ใช่เจ้าของ → **404/ไม่พบ**; เจ้าของ/แอดมิน preview ลานตัวเองได้; เพิ่ม test ครอบทั้ง 2 path; ตรวจว่า slug page ไม่ leak ใน sitemap/SEO
- **MEAS-1** — มีตัวเลข baseline จริง (LCP/INP/CLS/API p95/bundle) บนชุด 128 ลาน + EXPLAIN ของ query listing → เก็บไว้เทียบก่อน-หลัง (ห้ามอ้างเลขที่ไม่ได้วัด)
- **PERF-1** — listing query **ไม่** include `reviews`/`spots`/`options`/รูปเกิน 1; test assert select shape; การ์ดแสดงครบเหมือนเดิม
- **AGG-1** — `avgRating`/`reviewCount` อัปเดตใน txn เดียวกับ review write/delete; job reconcile ตรงกับ `review.aggregate`; migration reversible + backfill + test staging
- **AVAIL-1** — availability ไม่ถูก cache (สดเสมอ); สร้าง booking เกินความจุพร้อมกัน 2 รายการ → กันได้ที่ transaction (ทดสอบ concurrent); นับ BlockedDate ด้วย
- **CACHE-1** — **ต้องมีเลข MEAS-1 ก่อน-หลัง** + `FRESH-1` ครบทุก path + guard ผ่าน จึง ship ได้; ถ้าตัวเลขไม่ดีขึ้น → ไม่ ship (คง force-dynamic)
- **FRESH-1** — เผยแพร่/แก้/ลบ/seed/scrape ลาน → ปรากฏ/หายจาก catalog ภายในไม่กี่วินาที; test จับ write path ที่ลืม `revalidateTag`
- **PERF-4** — `ImageWithFallback` ใช้ `next/image` + `sizes` ต่อบริบท (card / thumb `80px` / detail-hero) + `unoptimized` escape hatch สำหรับ `blob:`/`data:`/preview; `next.config` มี `qualities:[75]` + `formats:['image/webp']` + trim deviceSizes/imageSizes + `minimumCacheTTL` + remotePattern `*.public.blob.vercel-storage.com`; LCP = CampgroundDetailClient hero (ไม่ใช่ lightbox); `dangerouslyAllowSVG=false`; ตั้ง Vercel Spend cap; วัด CWV (LCP≤2.5s/CLS≤0.1) บน detail+grid จริง before/after (measured); แตก PR ถ้า >400 บรรทัด

---

## 12. ADR-worthy decisions (บันทึกตอนหยิบทำ — G2)

ต่อจาก [docs/adr/ADR-000-index.md](docs/adr/ADR-000-index.md) (ปัจจุบันถึง ADR-008 pgvector deferred):

- **ADR-009** — List-projection "Buffet" + denormalized `avgRating`/`reviewCount` (compute-on-the-fly + derivation trail)
- **ADR-010** — Image pipeline + storage: next/image + Vercel Image Optimization (= optimize + edge CDN ในตัว, **ไม่มี dedicated CDN จนชน cost trigger**) · origin = Vercel Blob (public **stable** URL, มีแล้ว) · v16 `qualities` required + webp-only ก่อน · blurDataURL/dimensions ใน `Image` model · commercial = Vercel Pro · Phase 2 = R2 + Cloudflare Images ผ่าน `loaderFile` (`IMG-CDN-2`)
- **ADR-011** — Pagination = keyset/cursor + composite index
- **ADR-012** — Caching/freshness model (Cache Components: PPR + `use cache` + `revalidateTag`; เลิก force-dynamic; **no real-time push**) + invalidation contract (ทุก write path)
- **ADR-013** — Search decision gate (Postgres FTS → dedicated engine) + synergy ADR-008
- **ADR-014** — Public visibility gate consolidation (ทุก public read path ต้องผ่าน gate เดียว incl. detail + by-id) — รองรับ `SEC-1`
- **ADR-015** — Availability/inventory freshness = no-store + transactional capacity check (กัน double-book) + BlockedDate

แต่ละ ADR = Context · Decision · Alternatives · Consequences; migration reversible + test staging (architecture.md §6)

---

## 13. Risks & migration notes

- **Denormalized aggregate เพี้ยน** → write-time txn + reconcile job + test
- **Cache invalidation พลาด** → cacheTag ผูกชัด + invalidate ทุกจุดเขียน (incl. seed/scrape) + regression guard; cacheLife สั้นก่อนค่อยยืด; ระวัง CDN trap (§6.4)
- **Migration คอลัมน์ใหม่** (`avgRating`, `reviewCount`, image dims/blur) → reversible + backfill + test staging ก่อน prod (ops.md)
- **next/image domain** → เพิ่ม remotePatterns ของ storage ใหม่ ไม่งั้นรูปแตก
- **Image cost พุ่ง** → source URL ต้องคงที่ (กัน MISS storm re-bill), ตั้ง Vercel Spend cap, commercial = Pro floor; ที่ scale **delivery (FDT) ครองบิล** → trigger ย้าย R2 + Cloudflare Images (`IMG-CDN-2`); ราคา 3rd-party verify ตอนตัดสิน
- **PPR/use cache** (Next 16 ใหม่) → ทดสอบบน Preview/Staging; per-user data ห้ามหลุดเข้า static shell (security)
- **SEC-1 regression** → ระวังตัด preview ของเจ้าของไปด้วย (ต้องแยก public vs owner/admin)
- **Over-engineering** = ความเสี่ยง — ทำตาม trigger/threshold อย่าเร่ง P4 ก่อนถึงเพดาน

---

## 14. References

- **Provenance:** freshness/visibility (§6–§7, V1–V5) จาก workflow `realtime-listing-decision` (8 agents · 3 lenses) · image layer (§5C) จาก workflow `image-cdn-decision` (verifiers ตรวจโค้ด + Vercel docs 2026-02) — claims verified กับโค้ดจริง
- [Next.js — Caching](https://nextjs.org/docs/app/getting-started/caching) · [use cache](https://nextjs.org/docs/app/api-reference/directives/use-cache) · [cacheLife](https://nextjs.org/docs/app/api-reference/functions/cacheLife) · [cacheComponents](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
- [Next.js — Image Optimization](https://nextjs.org/docs/app/api-reference/components/image) · [Vercel — Image Optimization pricing/limits](https://vercel.com/docs/image-optimization) · ราคา 3rd-party (Cloudflare Images / Bunny / imgix / Cloudinary) = verify ตอนตัดสิน
- [Prisma — Pagination](https://www.prisma.io/docs/orm/prisma-client/queries/pagination) · [keyset vs offset](https://www.stacksync.com/blog/keyset-cursors-postgres-pagination-fast-accurate-scalable) · [cursor desc perf (prisma#12650)](https://github.com/prisma/prisma/issues/12650)
- [Supabase — Postgres FTS vs the rest](https://supabase.com/blog/postgres-full-text-search-vs-the-rest) · [Meilisearch — Postgres FTS limitations](https://www.meilisearch.com/blog/postgres-full-text-search-limitations)
- โค้ดอ้างอิงภายใน: [app/page.tsx](app/page.tsx) · [app/campgrounds/[slug]/page.tsx](app/campgrounds/[slug]/page.tsx) · [app/api/campsites/[id]/route.ts](app/api/campsites/[id]/route.ts) · [lib/sort-utils.ts](lib/sort-utils.ts) · [lib/campsite-filters.ts](lib/campsite-filters.ts) · [lib/campsite-availability.ts](lib/campsite-availability.ts) · [components/CampgroundCard.tsx](components/CampgroundCard.tsx) · [prisma/schema.prisma](prisma/schema.prisma) · [next.config.ts](next.config.ts)
- กฎภายใน: `.claude/rules/performance.md` · `.claude/rules/architecture.md` · `.claude/rules/seo.md` · `.claude/rules/security.md` · `.claude/rules/ops.md`
