# std/seo.md — มาตรฐาน SEO/AEO (Frontend เป็นเจ้าของ · Designer คุม semantic/a11y · Backend จัดหา data ที่ publishable)

> อ่านก่อนทำงาน: ไฟล์นี้ + `CLAUDE.md` + `DESIGN.md` (semantic HTML/a11y — ไม่เขียนซ้ำที่นี่) · งานหน้า public ให้เทียบ route จริงใน `app/` + แหล่งข้อมูลใน `prisma/schema.prisma`
> หน้าที่: ทำให้ทุก surface สาธารณะ crawlable + machine-readable ตั้งแต่ต้น (ไม่ bolt-on ทีหลัง), แยกชัดหน้า index vs noindex
> **When NOT:** ไม่ออกแบบ heading/content hierarchy เอง (ส่ง Designer), ไม่ทำ data model/API contract (ส่ง Architect/Backend) — แค่บริโภค data ที่ publishable มาแล้ว

## หลักการ

- **Public = server-rendered + crawlable:** หน้า list แคมป์ / detail แคมป์ / host profile / บทความ ต้อง render เนื้อหาหลัก+ข้อเท็จจริงสำคัญ (ชื่อ/ราคา/ที่ตั้ง/rating) ใน HTML จาก server เสมอ — crawler/AI ต้องเห็นโดยไม่รัน JS
- **AEO = ตอบคำถามได้ตรง + machine-readable:** เนื้อหาวางแบบ question→answer, ใช้ entity term สม่ำเสมอ (glossary), เปิด structured FAQ/llms.txt ให้ answer engine quote ได้ถูก
- **แยก index/noindex โดยตั้งใจ:** public = index; auth (dashboard/booking/wishlist) = `noindex` เสมอ — ห้ามสลับหลุด
- **Lean & Done-on-Staging:** เพิ่ม metadata/JSON-LD เท่าที่หน้าจริงมีเนื้อหารองรับ (ไม่ markup ของที่ไม่ render); Done = verify signal บน **Staging URL จริง** (view-source/Rich Results) ไม่ใช่แค่ local

## มาตรฐาน/กฎ

- **Rendering:** หน้า public = Server Component (default) SSG/ISR; หน้าแคมป์ใช้ ISR (`revalidate`) ดึงผ่าน service/Prisma — **ห้าม client-only fetch บนหน้า public** (crawler เห็นหน้าเปล่า); ส่วน interactive แยกเป็น Client Component เล็กๆ ใต้ shell ที่ server render แล้ว
- **Metadata (Metadata API):** ทุกหน้า public มี `generateMetadata` ของตัวเอง — `title` เฉพาะต่อแคมป์/หน้า + `description` ไม่ซ้ำ + `alternates.canonical` + Open Graph/Twitter (ใช้ `app/opengraph-image`) + `alternates.languages` hreflang `th`/`en` (i18n) + `robots` ถูกต้อง
- **Structured data (JSON-LD):** ใส่ผ่าน `<script type="application/ld+json">` ใน Server Component — หน้าแคมป์ = `Campground`/`Product`/`LocalBusiness` (`name`,`price`,`aggregateRating`,`geo`,`image`,`address`) + `BreadcrumbList`; site = `Organization`; หน้าที่มี Q&A = `FAQPage`
- **Semantic HTML:** `h1` เดียวต่อหน้า, `h2/h3` มีลำดับ, landmark (`header/nav/main/footer`), `alt` ครบ, descriptive link — รายละเอียด a11y baseline อยู่ที่ `DESIGN.md` (ไม่เขียนซ้ำ)
- **Performance (Core Web Vitals):** budget LCP/CLS/INP ผ่าน; ใช้ `next/image` ทุกรูป + `priority` รูป above-the-fold + กำหนด `width/height` กัน CLS; `preconnect` ฟอนต์
- **sitemap & robots:** `app/sitemap.ts` + `app/robots.ts` generate จาก Prisma (เฉพาะแคมป์/บทความที่ `published`) — รวม URL public ทั้งหมด, robots block path auth
- **noindex บน auth:** ทุกหน้า dashboard/booking/wishlist ตั้ง `robots: { index: false }` โดยตั้งใจ — ห้าม `noindex` หลุดไปบนหน้า public และห้ามลืม `noindex` หน้า auth
- **AEO:** โครงคำถาม→คำตอบในบทความ/FAQ, term จาก glossary สม่ำเสมอ, จัดทำ structured FAQ + `llms.txt` ให้ answer engine อ้างอิงได้แม่น

## ต้องคำนึง / anti-patterns

- ❌ client-only render หน้าแคมป์ (crawler เห็นหน้าเปล่า) → ✅ Server Component + `generateMetadata`, fetch ฝั่ง server
- ❌ `title`/`description` ซ้ำทุกหน้า → ✅ เฉพาะต่อแคมป์/หน้า จากข้อมูลจริง
- ❌ ลืม `canonical` → duplicate content (param/หน้าซ้ำ) → ✅ ตั้ง `alternates.canonical` ทุกหน้า
- ❌ `noindex` หลุดบนหน้า public / ลืม `noindex` หน้า dashboard → ✅ ตรวจ robots ต่อ route ก่อน merge
- ❌ รูปไม่มี `alt` / ไม่ใช้ `next/image` → ✅ `next/image` + `alt` สื่อความ + `priority` above-the-fold
- ❌ JSON-LD ไม่ตรงกับเนื้อหาที่ render (Google โทษ/penalty) → ✅ markup สะท้อนค่าที่ render จริงเท่านั้น

## Checklist (DoD ของ domain — ต่อหน้า public)

- [ ] server-rendered (SSG/ISR) เนื้อหาหลักอยู่ใน HTML — ไม่มี client-only fetch บนเนื้อหาที่ต้อง crawl
- [ ] `generateMetadata` ครบ: `title` เฉพาะ + `description` + `canonical` + OG/Twitter + hreflang `th`/`en` + `robots`
- [ ] JSON-LD ตรงเนื้อหาที่ render (`Campground`/`Product` + `BreadcrumbList`; `Organization`; `FAQPage` ถ้ามี Q&A)
- [ ] `h1` เดียว + heading มีลำดับ + landmark + `alt` ครบ (อ้าง `DESIGN.md`)
- [ ] `next/image` ทุกรูป + `priority` above-the-fold + Core Web Vitals (LCP/CLS/INP) ผ่าน
- [ ] อยู่ใน `app/sitemap.ts` (ถ้า `published`) + `app/robots.ts` ไม่ block
- [ ] หน้า auth (dashboard/booking/wishlist) ตั้ง `noindex` โดยตั้งใจ — ตรวจไม่ให้หลุดบนหน้า public
- [ ] **verify signal บน Staging URL จริง** (view-source / Rich Results / Lighthouse) ก่อน story เข้า state `Done`
