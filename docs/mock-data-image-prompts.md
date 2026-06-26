# Image Generation Prompts — CampVibe staging mock (48 camps)

> เอา prompt เหล่านี้ไปให้ Gemini generate รูป แล้วบันทึกตาม **path** ที่ระบุ (ให้ตรงกับ field ใน `prisma/data/mock-staging.json`)
>
> **สไตล์รวม:** ภาพถ่ายเสมือนจริง (photorealistic) บรรยากาศแคมป์ปิ้งในประเทศไทย แสงธรรมชาติ ไม่มีตัวอักษร/ลายน้ำบนภาพถ่าย (เฉพาะโลโก้เป็น flat vector ได้) ไม่มีคนหันหน้าชัด
>
> **กติกาความหลากหลาย:** แยก prompt ตาม terrain และ mood อย่าใช้โครงเดียวกันทั้งชุด
> - ภูเขา/ทะเลหมอก: สลับ dawn, blue hour, overcast, post-sunrise และเปลี่ยนมุมจาก wide, tent, detail, aerial
> - ป่า/ผจญภัย: ใช้ canopy, wet trail, filtered light, mist between trees
> - ริมธาร/ริมน้ำ: เน้น rock, shallow water, reflections, bank vegetation
> - ทุ่งหญ้า/ชมดาว: ใช้ open meadow, horizon, stars, wind, long exposure feel
> - ริมทะเล/ทะเลสาบ: ใช้ shoreline, waterline, calm surface, sunset or still dawn
>
> **โลโก้ต้องต่างกันตามลาน:** หลีกเลี่ยงวงกลม+เต็นท์เป็นค่า default; ให้ terrain เป็นตัวกำหนด shape และ icon เช่น mountain badge, forest shield, wave crest, horizon mark, lake reflection, sun disk, leaf mark

## Host avatars (13)

- `/seed/hosts/C1/avatar.jpg` (1:1) — **บริษัท นอร์ทเทิร์นแคมป์ จำกัด** (COMPANY): Clean professional brand emblem for outdoor camping company, tent + เชียงใหม่ nature motif, 2-tone earthy green, flat vector, white background
- `/seed/hosts/C2/avatar.jpg` (1:1) — **บริษัท ซีไซด์แคมป์ปิ้ง จำกัด** (COMPANY): Clean professional brand emblem for outdoor camping company, tent + กระบี่ nature motif, 2-tone earthy green, flat vector, white background
- `/seed/hosts/C3/avatar.jpg` (1:1) — **บริษัท เขาค้อแคมป์ รีสอร์ท จำกัด** (COMPANY): Clean professional brand emblem for outdoor camping company, tent + เพชรบูรณ์ nature motif, 2-tone earthy green, flat vector, white background
- `/seed/hosts/C4/avatar.jpg` (1:1) — **บริษัท อีสานแอดเวนเจอร์ จำกัด** (COMPANY): Clean professional brand emblem for outdoor camping company, tent + นครราชสีมา nature motif, 2-tone earthy green, flat vector, white background
- `/seed/hosts/C5/avatar.jpg` (1:1) — **บริษัท เลคแอนด์เลเชอร์ จำกัด** (COMPANY): Clean professional brand emblem for outdoor camping company, tent + สุราษฎร์ธานี nature motif, 2-tone earthy green, flat vector, white background
- `/seed/hosts/P1/avatar.jpg` (1:1) — **ห้างหุ้นส่วนจำกัด เลยไฮแลนด์** (PARTNERSHIP): Rustic camp brand logo, hand-drawn tent and mountain, warm earthy tones, flat vector, white background
- `/seed/hosts/P2/avatar.jpg` (1:1) — **ห้างหุ้นส่วนจำกัด แม่ฮ่องสอนแคมป์** (PARTNERSHIP): Rustic camp brand logo, hand-drawn tent and mountain, warm earthy tones, flat vector, white background
- `/seed/hosts/P3/avatar.jpg` (1:1) — **ห้างหุ้นส่วนจำกัด เชียงรายวิว** (PARTNERSHIP): Rustic camp brand logo, hand-drawn tent and mountain, warm earthy tones, flat vector, white background
- `/seed/hosts/I1/avatar.jpg` (1:1) — **ไร่ลุงนวลแคมป์** (INDIVIDUAL): Friendly badge for a small local Thai camp owner, circular tent icon, soft natural colors, flat illustration, white background
- `/seed/hosts/I2/avatar.jpg` (1:1) — **พิมพ์ใจ ใจดี** (INDIVIDUAL): Friendly badge for a small local Thai camp owner, circular tent icon, soft natural colors, flat illustration, white background
- `/seed/hosts/I3/avatar.jpg` (1:1) — **บ้านเลริมหาด** (INDIVIDUAL): Friendly badge for a small local Thai camp owner, circular tent icon, soft natural colors, flat illustration, white background
- `/seed/hosts/I4/avatar.jpg` (1:1) — **ประภาส ไพรวัลย์** (INDIVIDUAL): Friendly badge for a small local Thai camp owner, circular tent icon, soft natural colors, flat illustration, white background
- `/seed/hosts/I5/avatar.jpg` (1:1) — **ลานริมโขงน้องแอน** (INDIVIDUAL): Friendly badge for a small local Thai camp owner, circular tent icon, soft natural colors, flat illustration, white background

## Campsite images

### โฮสต์ C3 — บริษัท เขาค้อแคมป์ รีสอร์ท จำกัด (COMPANY)

#### ม่านหมอกภูทับเบิก — Phu Thap Boek Mist  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Phetchabun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/phu-thap-boek-mist-1/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ม่านหมอกภูทับเบิก  
  Minimal flat vector logo for a campsite "Phu Thap Boek Mist" (ม่านหมอกภูทับเบิก), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phu-thap-boek-mist-1/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ม่านหมอกภูทับเบิก  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ภูทับเบิก Phetchabun Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/phu-thap-boek-mist-1/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ม่านหมอกภูทับเบิก  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ภูทับเบิก Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phu-thap-boek-mist-1/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ม่านหมอกภูทับเบิก  
  signature hero view of Phu Thap Boek Mist: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/phu-thap-boek-mist-1/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ม่านหมอกภูทับเบิก  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in ภูทับเบิก, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phu-thap-boek-mist-1/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ม่านหมอกภูทับเบิก  
  close detail of the ทะเลหมอกภูเขา surroundings at ภูทับเบิก Phetchabun (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phu-thap-boek-mist-1/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ม่านหมอกภูทับเบิก  
  aerial drone top-down view of the ทะเลหมอกภูเขา campsite at ภูทับเบิก, tents arranged on the ground, surrounding MTNS and FORE landscape, golden sunrise with low fog, 16:9

#### ระเบียงดาวเขาค้อ — Khao Kho Star Terrace  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Phetchabun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/khao-kho-star-terrace-2/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ระเบียงดาวเขาค้อ  
  Minimal flat vector logo for a campsite "Khao Kho Star Terrace" (ระเบียงดาวเขาค้อ), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/khao-kho-star-terrace-2/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ระเบียงดาวเขาค้อ  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at เขาค้อ Phetchabun Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/khao-kho-star-terrace-2/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ระเบียงดาวเขาค้อ  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, เขาค้อ Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/khao-kho-star-terrace-2/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ระเบียงดาวเขาค้อ  
  signature hero view of Khao Kho Star Terrace: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/khao-kho-star-terrace-2/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ระเบียงดาวเขาค้อ  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in เขาค้อ, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/khao-kho-star-terrace-2/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ระเบียงดาวเขาค้อ  
  close detail of the ทะเลหมอกภูเขา surroundings at เขาค้อ Phetchabun (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/khao-kho-star-terrace-2/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ระเบียงดาวเขาค้อ  
  aerial drone top-down view of the ทะเลหมอกภูเขา campsite at เขาค้อ, tents arranged on the ground, surrounding MTNS and FORE landscape, golden sunrise with low fog, 16:9
- `/seed/camps/khao-kho-star-terrace-2/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ระเบียงดาวเขาค้อ  
  night scene of Khao Kho Star Terrace, glowing tents and warm string lights at a ทะเลหมอกภูเขา site in เขาค้อ, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ C1 — บริษัท นอร์ทเทิร์นแคมป์ จำกัด (COMPANY)

#### ดอยอ่างขางไฮแลนด์ — Doi Ang Khang Highland  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Mai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/doi-ang-khang-highland-3/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ดอยอ่างขางไฮแลนด์  
  Minimal flat vector logo for a campsite "Doi Ang Khang Highland" (ดอยอ่างขางไฮแลนด์), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/doi-ang-khang-highland-3/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ดอยอ่างขางไฮแลนด์  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ดอยอ่างขาง Chiang Mai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9

#### ม่อนแจ่มวิวหมอก — Mon Jam Mist View  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Mai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/mon-jam-mist-view-4/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ม่อนแจ่มวิวหมอก  
  Minimal flat vector logo for a campsite "Mon Jam Mist View" (ม่อนแจ่มวิวหมอก), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/mon-jam-mist-view-4/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ม่อนแจ่มวิวหมอก  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ม่อนแจ่ม Chiang Mai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/mon-jam-mist-view-4/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ม่อนแจ่มวิวหมอก  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ม่อนแจ่ม Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/mon-jam-mist-view-4/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ม่อนแจ่มวิวหมอก  
  signature hero view of Mon Jam Mist View: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/mon-jam-mist-view-4/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ม่อนแจ่มวิวหมอก  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in ม่อนแจ่ม, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/mon-jam-mist-view-4/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ม่อนแจ่มวิวหมอก  
  close detail of the ทะเลหมอกภูเขา surroundings at ม่อนแจ่ม Chiang Mai (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/mon-jam-mist-view-4/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ม่อนแจ่มวิวหมอก  
  aerial drone top-down view of the ทะเลหมอกภูเขา campsite at ม่อนแจ่ม, tents arranged on the ground, surrounding MTNS and FORE landscape, golden sunrise with low fog, 16:9
- `/seed/camps/mon-jam-mist-view-4/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ม่อนแจ่มวิวหมอก  
  night scene of Mon Jam Mist View, glowing tents and warm string lights at a ทะเลหมอกภูเขา site in ม่อนแจ่ม, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ P3 — ห้างหุ้นส่วนจำกัด เชียงรายวิว (PARTNERSHIP)

#### ภูชี้ฟ้าอรุณรุ่ง — Phu Chi Fa Sunrise  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Rai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/phu-chi-fa-sunrise-5/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ภูชี้ฟ้าอรุณรุ่ง  
  Minimal flat vector logo for a campsite "Phu Chi Fa Sunrise" (ภูชี้ฟ้าอรุณรุ่ง), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phu-chi-fa-sunrise-5/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ภูชี้ฟ้าอรุณรุ่ง  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ภูชี้ฟ้า Chiang Rai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/phu-chi-fa-sunrise-5/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ภูชี้ฟ้าอรุณรุ่ง  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ภูชี้ฟ้า Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phu-chi-fa-sunrise-5/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ภูชี้ฟ้าอรุณรุ่ง  
  signature hero view of Phu Chi Fa Sunrise: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/phu-chi-fa-sunrise-5/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ภูชี้ฟ้าอรุณรุ่ง  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in ภูชี้ฟ้า, warm evening glow, candid lifestyle photo, 16:9

#### ดอยแม่สลองหมอกเช้า — Doi Mae Salong Morning Mist  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Rai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/doi-mae-salong-morning-mist-6/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ดอยแม่สลองหมอกเช้า  
  Minimal flat vector logo for a campsite "Doi Mae Salong Morning Mist" (ดอยแม่สลองหมอกเช้า), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/doi-mae-salong-morning-mist-6/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ดอยแม่สลองหมอกเช้า  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ดอยแม่สลอง Chiang Rai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/doi-mae-salong-morning-mist-6/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ดอยแม่สลองหมอกเช้า  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ดอยแม่สลอง Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9

### โฮสต์ P2 — ห้างหุ้นส่วนจำกัด แม่ฮ่องสอนแคมป์ (PARTNERSHIP)

#### บ้านรักไทยม่านหมอก — Ban Rak Thai Misty  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Mae Hong Son · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/ban-rak-thai-misty-7/cover.jpg` (1:1, logo) — _alt:_ โลโก้ บ้านรักไทยม่านหมอก  
  Minimal flat vector logo for a campsite "Ban Rak Thai Misty" (บ้านรักไทยม่านหมอก), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ban-rak-thai-misty-7/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง บ้านรักไทยม่านหมอก  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at บ้านรักไทย Mae Hong Son Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9

### โฮสต์ P1 — ห้างหุ้นส่วนจำกัด เลยไฮแลนด์ (PARTNERSHIP)

#### ภูเรือลมหนาว — Phu Ruea Cold Breeze  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/phu-ruea-cold-breeze-8/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ภูเรือลมหนาว  
  Minimal flat vector logo for a campsite "Phu Ruea Cold Breeze" (ภูเรือลมหนาว), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phu-ruea-cold-breeze-8/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ภูเรือลมหนาว  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ภูเรือ Loei Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/phu-ruea-cold-breeze-8/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ภูเรือลมหนาว  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ภูเรือ Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phu-ruea-cold-breeze-8/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ภูเรือลมหนาว  
  signature hero view of Phu Ruea Cold Breeze: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/phu-ruea-cold-breeze-8/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ภูเรือลมหนาว  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in ภูเรือ, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phu-ruea-cold-breeze-8/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ภูเรือลมหนาว  
  close detail of the ทะเลหมอกภูเขา surroundings at ภูเรือ Loei (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phu-ruea-cold-breeze-8/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ภูเรือลมหนาว  
  aerial drone top-down view of the ทะเลหมอกภูเขา campsite at ภูเรือ, tents arranged on the ground, surrounding MTNS and FORE landscape, golden sunrise with low fog, 16:9

#### ภูป่าเปาะฟูจิเมืองเลย — Phu Pa Po Fuji  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/phu-pa-po-fuji-9/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ภูป่าเปาะฟูจิเมืองเลย  
  Minimal flat vector logo for a campsite "Phu Pa Po Fuji" (ภูป่าเปาะฟูจิเมืองเลย), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phu-pa-po-fuji-9/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ภูป่าเปาะฟูจิเมืองเลย  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ภูป่าเปาะ Loei Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9

### โฮสต์ C1 — บริษัท นอร์ทเทิร์นแคมป์ จำกัด (COMPANY)

#### ดอยม่อนล้านทะเลหมอก — Doi Mon Lan Sea of Mist  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Mai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/doi-mon-lan-sea-of-mist-10/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ดอยม่อนล้านทะเลหมอก  
  Minimal flat vector logo for a campsite "Doi Mon Lan Sea of Mist" (ดอยม่อนล้านทะเลหมอก), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/doi-mon-lan-sea-of-mist-10/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ดอยม่อนล้านทะเลหมอก  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ม่อนล้าน Chiang Mai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/doi-mon-lan-sea-of-mist-10/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ดอยม่อนล้านทะเลหมอก  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ม่อนล้าน Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9

### โฮสต์ C3 — บริษัท เขาค้อแคมป์ รีสอร์ท จำกัด (COMPANY)

#### ภูลมโลทุ่งหมอก — Phu Lom Lo Mist Field  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Phetchabun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/phu-lom-lo-mist-field-11/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ภูลมโลทุ่งหมอก  
  Minimal flat vector logo for a campsite "Phu Lom Lo Mist Field" (ภูลมโลทุ่งหมอก), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phu-lom-lo-mist-field-11/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ภูลมโลทุ่งหมอก  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ภูลมโล Phetchabun Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/phu-lom-lo-mist-field-11/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ภูลมโลทุ่งหมอก  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ภูลมโล Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phu-lom-lo-mist-field-11/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ภูลมโลทุ่งหมอก  
  signature hero view of Phu Lom Lo Mist Field: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/phu-lom-lo-mist-field-11/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ภูลมโลทุ่งหมอก  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in ภูลมโล, warm evening glow, candid lifestyle photo, 16:9

### โฮสต์ P3 — ห้างหุ้นส่วนจำกัด เชียงรายวิว (PARTNERSHIP)

#### ยอดดอยผาตั้ง — Doi Pha Tang Peak  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Rai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/doi-pha-tang-peak-12/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ยอดดอยผาตั้ง  
  Minimal flat vector logo for a campsite "Doi Pha Tang Peak" (ยอดดอยผาตั้ง), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/doi-pha-tang-peak-12/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ยอดดอยผาตั้ง  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ผาตั้ง Chiang Rai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/doi-pha-tang-peak-12/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ยอดดอยผาตั้ง  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ผาตั้ง Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/doi-pha-tang-peak-12/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ยอดดอยผาตั้ง  
  signature hero view of Doi Pha Tang Peak: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9

### โฮสต์ C1 — บริษัท นอร์ทเทิร์นแคมป์ จำกัด (COMPANY)

#### ม่อนเงาะวิวเขา — Mon Ngo Hill View  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Mai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/mon-ngo-hill-view-13/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ม่อนเงาะวิวเขา  
  Minimal flat vector logo for a campsite "Mon Ngo Hill View" (ม่อนเงาะวิวเขา), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/mon-ngo-hill-view-13/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ม่อนเงาะวิวเขา  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ม่อนเงาะ Chiang Mai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/mon-ngo-hill-view-13/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ม่อนเงาะวิวเขา  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ม่อนเงาะ Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/mon-ngo-hill-view-13/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ม่อนเงาะวิวเขา  
  signature hero view of Mon Ngo Hill View: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/mon-ngo-hill-view-13/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ม่อนเงาะวิวเขา  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in ม่อนเงาะ, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/mon-ngo-hill-view-13/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ม่อนเงาะวิวเขา  
  close detail of the ทะเลหมอกภูเขา surroundings at ม่อนเงาะ Chiang Mai (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ I2 — พิมพ์ใจ ใจดี (INDIVIDUAL)

#### ดอยสุเทพระเบียงเมือง — Doi Suthep City Terrace  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Mai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/doi-suthep-city-terrace-14/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ดอยสุเทพระเบียงเมือง  
  Minimal flat vector logo for a campsite "Doi Suthep City Terrace" (ดอยสุเทพระเบียงเมือง), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/doi-suthep-city-terrace-14/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ดอยสุเทพระเบียงเมือง  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ดอยสุเทพ Chiang Mai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9

### โฮสต์ C3 — บริษัท เขาค้อแคมป์ รีสอร์ท จำกัด (COMPANY)

#### ทุ่งกังหันเขาค้อ — Khao Kho Windmill Meadow  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Phetchabun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/khao-kho-windmill-meadow-15/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งกังหันเขาค้อ  
  Minimal flat vector logo for a campsite "Khao Kho Windmill Meadow" (ทุ่งกังหันเขาค้อ), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/khao-kho-windmill-meadow-15/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งกังหันเขาค้อ  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at เขาค้อ Phetchabun Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/khao-kho-windmill-meadow-15/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งกังหันเขาค้อ  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, เขาค้อ Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9

### โฮสต์ C4 — บริษัท อีสานแอดเวนเจอร์ จำกัด (COMPANY)

#### ไร่ดาวลับฟ้าวังน้ำเขียว — Wang Nam Khiao Stargaze Farm  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Nakhon Ratchasima · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/wang-nam-khiao-stargaze-farm-16/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ไร่ดาวลับฟ้าวังน้ำเขียว  
  Minimal flat vector logo for a campsite "Wang Nam Khiao Stargaze Farm" (ไร่ดาวลับฟ้าวังน้ำเขียว), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/wang-nam-khiao-stargaze-farm-16/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ไร่ดาวลับฟ้าวังน้ำเขียว  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at วังน้ำเขียว Nakhon Ratchasima Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/wang-nam-khiao-stargaze-farm-16/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ไร่ดาวลับฟ้าวังน้ำเขียว  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, วังน้ำเขียว Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/wang-nam-khiao-stargaze-farm-16/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ไร่ดาวลับฟ้าวังน้ำเขียว  
  signature hero view of Wang Nam Khiao Stargaze Farm: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/wang-nam-khiao-stargaze-farm-16/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ไร่ดาวลับฟ้าวังน้ำเขียว  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in วังน้ำเขียว, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/wang-nam-khiao-stargaze-farm-16/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ไร่ดาวลับฟ้าวังน้ำเขียว  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at วังน้ำเขียว Nakhon Ratchasima (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/wang-nam-khiao-stargaze-farm-16/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ไร่ดาวลับฟ้าวังน้ำเขียว  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at วังน้ำเขียว, tents arranged on the ground, surrounding MTNS and FORE landscape, clear starry night, 16:9
- `/seed/camps/wang-nam-khiao-stargaze-farm-16/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ไร่ดาวลับฟ้าวังน้ำเขียว  
  night scene of Wang Nam Khiao Stargaze Farm, glowing tents and warm string lights at a ทุ่งหญ้า/ชมดาว site in วังน้ำเขียว, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ P1 — ห้างหุ้นส่วนจำกัด เลยไฮแลนด์ (PARTNERSHIP)

#### ทุ่งหญ้าภูสวนทราย — Phu Suan Sai Meadow  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/phu-suan-sai-meadow-17/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งหญ้าภูสวนทราย  
  Minimal flat vector logo for a campsite "Phu Suan Sai Meadow" (ทุ่งหญ้าภูสวนทราย), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phu-suan-sai-meadow-17/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งหญ้าภูสวนทราย  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ภูสวนทราย Loei Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/phu-suan-sai-meadow-17/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งหญ้าภูสวนทราย  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ภูสวนทราย Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phu-suan-sai-meadow-17/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทุ่งหญ้าภูสวนทราย  
  signature hero view of Phu Suan Sai Meadow: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9

### โฮสต์ P3 — ห้างหุ้นส่วนจำกัด เชียงรายวิว (PARTNERSHIP)

#### ลานเล่นลมเชียงราย — Chiang Rai Windplay Field  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Chiang Rai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/chiang-rai-windplay-field-18/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ลานเล่นลมเชียงราย  
  Minimal flat vector logo for a campsite "Chiang Rai Windplay Field" (ลานเล่นลมเชียงราย), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chiang-rai-windplay-field-18/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ลานเล่นลมเชียงราย  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ดอยช้าง Chiang Rai Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/chiang-rai-windplay-field-18/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ลานเล่นลมเชียงราย  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ดอยช้าง Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chiang-rai-windplay-field-18/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ลานเล่นลมเชียงราย  
  signature hero view of Chiang Rai Windplay Field: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/chiang-rai-windplay-field-18/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ลานเล่นลมเชียงราย  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ดอยช้าง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/chiang-rai-windplay-field-18/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ลานเล่นลมเชียงราย  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at ดอยช้าง Chiang Rai (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/chiang-rai-windplay-field-18/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ลานเล่นลมเชียงราย  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at ดอยช้าง, tents arranged on the ground, surrounding MTNS and FORE landscape, clear starry night, 16:9

### โฮสต์ I1 — ไร่ลุงนวลแคมป์ (INDIVIDUAL)

#### ทุ่งดอกไม้เขาค้อ — Khao Kho Flower Field  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Phetchabun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/khao-kho-flower-field-19/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งดอกไม้เขาค้อ  
  Minimal flat vector logo for a campsite "Khao Kho Flower Field" (ทุ่งดอกไม้เขาค้อ), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/khao-kho-flower-field-19/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งดอกไม้เขาค้อ  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at เขาค้อ Phetchabun Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/khao-kho-flower-field-19/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งดอกไม้เขาค้อ  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, เขาค้อ Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/khao-kho-flower-field-19/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทุ่งดอกไม้เขาค้อ  
  signature hero view of Khao Kho Flower Field: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/khao-kho-flower-field-19/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ทุ่งดอกไม้เขาค้อ  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in เขาค้อ, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/khao-kho-flower-field-19/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ทุ่งดอกไม้เขาค้อ  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at เขาค้อ Phetchabun (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/khao-kho-flower-field-19/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ทุ่งดอกไม้เขาค้อ  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at เขาค้อ, tents arranged on the ground, surrounding MTNS and FORE landscape, clear starry night, 16:9
- `/seed/camps/khao-kho-flower-field-19/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ทุ่งดอกไม้เขาค้อ  
  night scene of Khao Kho Flower Field, glowing tents and warm string lights at a ทุ่งหญ้า/ชมดาว site in เขาค้อ, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ C4 — บริษัท อีสานแอดเวนเจอร์ จำกัด (COMPANY)

#### วิวกว้างวังน้ำเขียว — Wang Nam Khiao Wide View  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Nakhon Ratchasima · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/wang-nam-khiao-wide-view-20/cover.jpg` (1:1, logo) — _alt:_ โลโก้ วิวกว้างวังน้ำเขียว  
  Minimal flat vector logo for a campsite "Wang Nam Khiao Wide View" (วิวกว้างวังน้ำเขียว), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/wang-nam-khiao-wide-view-20/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง วิวกว้างวังน้ำเขียว  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at วังน้ำเขียว Nakhon Ratchasima Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/wang-nam-khiao-wide-view-20/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ วิวกว้างวังน้ำเขียว  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, วังน้ำเขียว Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9

### โฮสต์ I5 — ลานริมโขงน้องแอน (INDIVIDUAL)

#### ลานตะวันรอนภูเรือ — Phu Ruea Sunset Lawn  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/phu-ruea-sunset-lawn-21/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ลานตะวันรอนภูเรือ  
  Minimal flat vector logo for a campsite "Phu Ruea Sunset Lawn" (ลานตะวันรอนภูเรือ), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phu-ruea-sunset-lawn-21/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ลานตะวันรอนภูเรือ  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ภูเรือ Loei Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/phu-ruea-sunset-lawn-21/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ลานตะวันรอนภูเรือ  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ภูเรือ Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phu-ruea-sunset-lawn-21/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ลานตะวันรอนภูเรือ  
  signature hero view of Phu Ruea Sunset Lawn: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/phu-ruea-sunset-lawn-21/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ลานตะวันรอนภูเรือ  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ภูเรือ, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phu-ruea-sunset-lawn-21/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ลานตะวันรอนภูเรือ  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at ภูเรือ Loei (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ P3 — ห้างหุ้นส่วนจำกัด เชียงรายวิว (PARTNERSHIP)

#### ทุ่งหญ้าเลี้ยงดาวเชียงราย — Chiang Rai Star Pasture  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Chiang Rai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/chiang-rai-star-pasture-22/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งหญ้าเลี้ยงดาวเชียงราย  
  Minimal flat vector logo for a campsite "Chiang Rai Star Pasture" (ทุ่งหญ้าเลี้ยงดาวเชียงราย), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chiang-rai-star-pasture-22/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งหญ้าเลี้ยงดาวเชียงราย  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ดอยตุง Chiang Rai Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/chiang-rai-star-pasture-22/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งหญ้าเลี้ยงดาวเชียงราย  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ดอยตุง Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chiang-rai-star-pasture-22/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทุ่งหญ้าเลี้ยงดาวเชียงราย  
  signature hero view of Chiang Rai Star Pasture: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/chiang-rai-star-pasture-22/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ทุ่งหญ้าเลี้ยงดาวเชียงราย  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ดอยตุง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/chiang-rai-star-pasture-22/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ทุ่งหญ้าเลี้ยงดาวเชียงราย  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at ดอยตุง Chiang Rai (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/chiang-rai-star-pasture-22/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ทุ่งหญ้าเลี้ยงดาวเชียงราย  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at ดอยตุง, tents arranged on the ground, surrounding MTNS and FORE landscape, clear starry night, 16:9
- `/seed/camps/chiang-rai-star-pasture-22/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ทุ่งหญ้าเลี้ยงดาวเชียงราย  
  night scene of Chiang Rai Star Pasture, glowing tents and warm string lights at a ทุ่งหญ้า/ชมดาว site in ดอยตุง, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ C2 — บริษัท ซีไซด์แคมป์ปิ้ง จำกัด (COMPANY)

#### หาดไร่เลย์แคมป์ — Railay Beach Camp  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Krabi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/railay-beach-camp-23/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดไร่เลย์แคมป์  
  Minimal flat vector logo for a campsite "Railay Beach Camp" (หาดไร่เลย์แคมป์), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/railay-beach-camp-23/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดไร่เลย์แคมป์  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดไร่เลย์ Krabi Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/railay-beach-camp-23/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดไร่เลย์แคมป์  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดไร่เลย์ Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/railay-beach-camp-23/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น หาดไร่เลย์แคมป์  
  signature hero view of Railay Beach Camp: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/railay-beach-camp-23/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ หาดไร่เลย์แคมป์  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in หาดไร่เลย์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/railay-beach-camp-23/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ หาดไร่เลย์แคมป์  
  close detail of the ริมทะเล/ชายหาด surroundings at หาดไร่เลย์ Krabi (BEAC terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/railay-beach-camp-23/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง หาดไร่เลย์แคมป์  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at หาดไร่เลย์, tents arranged on the ground, surrounding BEAC landscape, warm sunset over the sea, 16:9
- `/seed/camps/railay-beach-camp-23/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน หาดไร่เลย์แคมป์  
  night scene of Railay Beach Camp, glowing tents and warm string lights at a ริมทะเล/ชายหาด site in หาดไร่เลย์, starry sky, long exposure, cozy mood, 16:9

#### อ่าวนางริมเล — Ao Nang Seaside  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Krabi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/ao-nang-seaside-24/cover.jpg` (1:1, logo) — _alt:_ โลโก้ อ่าวนางริมเล  
  Minimal flat vector logo for a campsite "Ao Nang Seaside" (อ่าวนางริมเล), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ao-nang-seaside-24/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง อ่าวนางริมเล  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at อ่าวนาง Krabi Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/ao-nang-seaside-24/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ อ่าวนางริมเล  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, อ่าวนาง Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/ao-nang-seaside-24/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น อ่าวนางริมเล  
  signature hero view of Ao Nang Seaside: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/ao-nang-seaside-24/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ อ่าวนางริมเล  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in อ่าวนาง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/ao-nang-seaside-24/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ อ่าวนางริมเล  
  close detail of the ริมทะเล/ชายหาด surroundings at อ่าวนาง Krabi (BEAC terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/ao-nang-seaside-24/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง อ่าวนางริมเล  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at อ่าวนาง, tents arranged on the ground, surrounding BEAC landscape, warm sunset over the sea, 16:9

### โฮสต์ I3 — บ้านเลริมหาด (INDIVIDUAL)

#### เกาะลันตาซันเซ็ต — Koh Lanta Sunset  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Krabi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/koh-lanta-sunset-25/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เกาะลันตาซันเซ็ต  
  Minimal flat vector logo for a campsite "Koh Lanta Sunset" (เกาะลันตาซันเซ็ต), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/koh-lanta-sunset-25/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เกาะลันตาซันเซ็ต  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at เกาะลันตา Krabi Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/koh-lanta-sunset-25/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เกาะลันตาซันเซ็ต  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, เกาะลันตา Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/koh-lanta-sunset-25/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เกาะลันตาซันเซ็ต  
  signature hero view of Koh Lanta Sunset: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/koh-lanta-sunset-25/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ เกาะลันตาซันเซ็ต  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in เกาะลันตา, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/koh-lanta-sunset-25/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ เกาะลันตาซันเซ็ต  
  close detail of the ริมทะเล/ชายหาด surroundings at เกาะลันตา Krabi (BEAC terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ C2 — บริษัท ซีไซด์แคมป์ปิ้ง จำกัด (COMPANY)

#### หาดในหานภูเก็ต — Nai Harn Beach Phuket  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Phuket · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/nai-harn-beach-phuket-26/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดในหานภูเก็ต  
  Minimal flat vector logo for a campsite "Nai Harn Beach Phuket" (หาดในหานภูเก็ต), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nai-harn-beach-phuket-26/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดในหานภูเก็ต  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดในหาน Phuket Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/nai-harn-beach-phuket-26/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดในหานภูเก็ต  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดในหาน Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nai-harn-beach-phuket-26/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น หาดในหานภูเก็ต  
  signature hero view of Nai Harn Beach Phuket: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9

#### ไม้ขาวบีชแคมป์ — Mai Khao Beach Camp  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Phuket · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/mai-khao-beach-camp-27/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ไม้ขาวบีชแคมป์  
  Minimal flat vector logo for a campsite "Mai Khao Beach Camp" (ไม้ขาวบีชแคมป์), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/mai-khao-beach-camp-27/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ไม้ขาวบีชแคมป์  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดไม้ขาว Phuket Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/mai-khao-beach-camp-27/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ไม้ขาวบีชแคมป์  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดไม้ขาว Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9

#### เกาะกูดทะเลใส — Koh Kood Clearwater  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Trat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/koh-kood-clearwater-28/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เกาะกูดทะเลใส  
  Minimal flat vector logo for a campsite "Koh Kood Clearwater" (เกาะกูดทะเลใส), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/koh-kood-clearwater-28/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เกาะกูดทะเลใส  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at เกาะกูด Trat Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/koh-kood-clearwater-28/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เกาะกูดทะเลใส  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, เกาะกูด Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/koh-kood-clearwater-28/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เกาะกูดทะเลใส  
  signature hero view of Koh Kood Clearwater: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/koh-kood-clearwater-28/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ เกาะกูดทะเลใส  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in เกาะกูด, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/koh-kood-clearwater-28/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ เกาะกูดทะเลใส  
  close detail of the ริมทะเล/ชายหาด surroundings at เกาะกูด Trat (BEAC terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/koh-kood-clearwater-28/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง เกาะกูดทะเลใส  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at เกาะกูด, tents arranged on the ground, surrounding BEAC landscape, warm sunset over the sea, 16:9

### โฮสต์ I3 — บ้านเลริมหาด (INDIVIDUAL)

#### เกาะหมากเงียบสงบ — Koh Mak Serene  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Trat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/koh-mak-serene-29/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เกาะหมากเงียบสงบ  
  Minimal flat vector logo for a campsite "Koh Mak Serene" (เกาะหมากเงียบสงบ), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/koh-mak-serene-29/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เกาะหมากเงียบสงบ  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at เกาะหมาก Trat Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/koh-mak-serene-29/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เกาะหมากเงียบสงบ  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, เกาะหมาก Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/koh-mak-serene-29/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เกาะหมากเงียบสงบ  
  signature hero view of Koh Mak Serene: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/koh-mak-serene-29/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ เกาะหมากเงียบสงบ  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in เกาะหมาก, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/koh-mak-serene-29/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ เกาะหมากเงียบสงบ  
  close detail of the ริมทะเล/ชายหาด surroundings at เกาะหมาก Trat (BEAC terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/koh-mak-serene-29/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง เกาะหมากเงียบสงบ  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at เกาะหมาก, tents arranged on the ground, surrounding BEAC landscape, warm sunset over the sea, 16:9
- `/seed/camps/koh-mak-serene-29/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน เกาะหมากเงียบสงบ  
  night scene of Koh Mak Serene, glowing tents and warm string lights at a ริมทะเล/ชายหาด site in เกาะหมาก, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ C2 — บริษัท ซีไซด์แคมป์ปิ้ง จำกัด (COMPANY)

#### หาดทรายเกาะช้าง — Koh Chang Sandy Bay  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Trat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/koh-chang-sandy-bay-30/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดทรายเกาะช้าง  
  Minimal flat vector logo for a campsite "Koh Chang Sandy Bay" (หาดทรายเกาะช้าง), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/koh-chang-sandy-bay-30/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดทรายเกาะช้าง  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at เกาะช้าง Trat Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/koh-chang-sandy-bay-30/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดทรายเกาะช้าง  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, เกาะช้าง Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9

#### เกาะเต่าใต้ดาว — Koh Tao Under Stars  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Surat Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/koh-tao-under-stars-31/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เกาะเต่าใต้ดาว  
  Minimal flat vector logo for a campsite "Koh Tao Under Stars" (เกาะเต่าใต้ดาว), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/koh-tao-under-stars-31/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เกาะเต่าใต้ดาว  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at เกาะเต่า Surat Thani Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/koh-tao-under-stars-31/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เกาะเต่าใต้ดาว  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, เกาะเต่า Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/koh-tao-under-stars-31/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เกาะเต่าใต้ดาว  
  signature hero view of Koh Tao Under Stars: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/koh-tao-under-stars-31/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ เกาะเต่าใต้ดาว  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in เกาะเต่า, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/koh-tao-under-stars-31/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ เกาะเต่าใต้ดาว  
  close detail of the ริมทะเล/ชายหาด surroundings at เกาะเต่า Surat Thani (BEAC terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/koh-tao-under-stars-31/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง เกาะเต่าใต้ดาว  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at เกาะเต่า, tents arranged on the ground, surrounding BEAC landscape, warm sunset over the sea, 16:9
- `/seed/camps/koh-tao-under-stars-31/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน เกาะเต่าใต้ดาว  
  night scene of Koh Tao Under Stars, glowing tents and warm string lights at a ริมทะเล/ชายหาด site in เกาะเต่า, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ P2 — ห้างหุ้นส่วนจำกัด แม่ฮ่องสอนแคมป์ (PARTNERSHIP)

#### ปางอุ๋งริมทะเลสาบ — Pang Ung Lakeside  
ธีม: ริมทะเลสาบ · จังหวัด: Mae Hong Son · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/pang-ung-lakeside-32/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ปางอุ๋งริมทะเลสาบ  
  Minimal flat vector logo for a campsite "Pang Ung Lakeside" (ปางอุ๋งริมทะเลสาบ), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pang-ung-lakeside-32/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ปางอุ๋งริมทะเลสาบ  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ปางอุ๋ง Mae Hong Son Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/pang-ung-lakeside-32/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ปางอุ๋งริมทะเลสาบ  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ปางอุ๋ง Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/pang-ung-lakeside-32/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ปางอุ๋งริมทะเลสาบ  
  signature hero view of Pang Ung Lakeside: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/pang-ung-lakeside-32/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ปางอุ๋งริมทะเลสาบ  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in ปางอุ๋ง, warm evening glow, candid lifestyle photo, 16:9

### โฮสต์ C5 — บริษัท เลคแอนด์เลเชอร์ จำกัด (COMPANY)

#### เชี่ยวหลานกุ้ยหลินเมืองไทย — Cheow Lan Guilin  
ธีม: ริมทะเลสาบ · จังหวัด: Surat Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/cheow-lan-guilin-33/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เชี่ยวหลานกุ้ยหลินเมืองไทย  
  Minimal flat vector logo for a campsite "Cheow Lan Guilin" (เชี่ยวหลานกุ้ยหลินเมืองไทย), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/cheow-lan-guilin-33/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เชี่ยวหลานกุ้ยหลินเมืองไทย  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at เขื่อนเชี่ยวหลาน Surat Thani Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/cheow-lan-guilin-33/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เชี่ยวหลานกุ้ยหลินเมืองไทย  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, เขื่อนเชี่ยวหลาน Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/cheow-lan-guilin-33/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เชี่ยวหลานกุ้ยหลินเมืองไทย  
  signature hero view of Cheow Lan Guilin: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/cheow-lan-guilin-33/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ เชี่ยวหลานกุ้ยหลินเมืองไทย  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in เขื่อนเชี่ยวหลาน, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/cheow-lan-guilin-33/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ เชี่ยวหลานกุ้ยหลินเมืองไทย  
  close detail of the ริมทะเลสาบ surroundings at เขื่อนเชี่ยวหลาน Surat Thani (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9

#### แพริมเขื่อนเชี่ยวหลาน — Cheow Lan Raft Stay  
ธีม: ริมทะเลสาบ · จังหวัด: Surat Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/cheow-lan-raft-stay-34/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แพริมเขื่อนเชี่ยวหลาน  
  Minimal flat vector logo for a campsite "Cheow Lan Raft Stay" (แพริมเขื่อนเชี่ยวหลาน), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/cheow-lan-raft-stay-34/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แพริมเขื่อนเชี่ยวหลาน  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at เขื่อนเชี่ยวหลาน Surat Thani Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/cheow-lan-raft-stay-34/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แพริมเขื่อนเชี่ยวหลาน  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, เขื่อนเชี่ยวหลาน Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/cheow-lan-raft-stay-34/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แพริมเขื่อนเชี่ยวหลาน  
  signature hero view of Cheow Lan Raft Stay: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9

### โฮสต์ P2 — ห้างหุ้นส่วนจำกัด แม่ฮ่องสอนแคมป์ (PARTNERSHIP)

#### ทะเลสาบสายหมอกปางอุ๋ง — Pang Ung Misty Lake  
ธีม: ริมทะเลสาบ · จังหวัด: Mae Hong Son · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/pang-ung-misty-lake-35/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทะเลสาบสายหมอกปางอุ๋ง  
  Minimal flat vector logo for a campsite "Pang Ung Misty Lake" (ทะเลสาบสายหมอกปางอุ๋ง), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pang-ung-misty-lake-35/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทะเลสาบสายหมอกปางอุ๋ง  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ปางอุ๋ง Mae Hong Son Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/pang-ung-misty-lake-35/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทะเลสาบสายหมอกปางอุ๋ง  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ปางอุ๋ง Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/pang-ung-misty-lake-35/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทะเลสาบสายหมอกปางอุ๋ง  
  signature hero view of Pang Ung Misty Lake: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9

### โฮสต์ P1 — ห้างหุ้นส่วนจำกัด เลยไฮแลนด์ (PARTNERSHIP)

#### อ่างเก็บน้ำภูสวรรค์ — Phu Sawan Reservoir  
ธีม: ริมทะเลสาบ · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/phu-sawan-reservoir-36/cover.jpg` (1:1, logo) — _alt:_ โลโก้ อ่างเก็บน้ำภูสวรรค์  
  Minimal flat vector logo for a campsite "Phu Sawan Reservoir" (อ่างเก็บน้ำภูสวรรค์), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phu-sawan-reservoir-36/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง อ่างเก็บน้ำภูสวรรค์  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ภูสวรรค์ Loei Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/phu-sawan-reservoir-36/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ อ่างเก็บน้ำภูสวรรค์  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ภูสวรรค์ Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9

### โฮสต์ P2 — ห้างหุ้นส่วนจำกัด แม่ฮ่องสอนแคมป์ (PARTNERSHIP)

#### ปายริมธารแคมป์ — Pai Riverside Camp  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Mae Hong Son · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/pai-riverside-camp-37/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ปายริมธารแคมป์  
  Minimal flat vector logo for a campsite "Pai Riverside Camp" (ปายริมธารแคมป์), use a flowing river-wave badge with smooth stones and a small pine or riverbank reed, no tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pai-riverside-camp-37/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ปายริมธารแคมป์  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ปาย Mae Hong Son Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/pai-riverside-camp-37/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ปายริมธารแคมป์  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ปาย Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/pai-riverside-camp-37/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ปายริมธารแคมป์  
  signature hero view of Pai Riverside Camp: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/pai-riverside-camp-37/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ปายริมธารแคมป์  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ปาย, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/pai-riverside-camp-37/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ปายริมธารแคมป์  
  close detail of the ริมน้ำ/ลำธาร surroundings at ปาย Mae Hong Son (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/pai-riverside-camp-37/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ปายริมธารแคมป์  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ปาย, tents arranged on the ground, surrounding RIVE and FORE landscape, soft morning light through trees, 16:9
- `/seed/camps/pai-riverside-camp-37/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ปายริมธารแคมป์  
  night scene of Pai Riverside Camp, glowing tents and warm string lights at a ริมน้ำ/ลำธาร site in ปาย, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ I5 — ลานริมโขงน้องแอน (INDIVIDUAL)

#### เชียงคานริมโขง — Chiang Khan Mekong Bank  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/chiang-khan-mekong-bank-38/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เชียงคานริมโขง  
  Minimal flat vector logo for a campsite "Chiang Khan Mekong Bank" (เชียงคานริมโขง), use a Mekong river crest badge with a horizon line and riverbank reeds, no tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chiang-khan-mekong-bank-38/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เชียงคานริมโขง  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at เชียงคาน Loei Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/chiang-khan-mekong-bank-38/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เชียงคานริมโขง  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, เชียงคาน Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chiang-khan-mekong-bank-38/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เชียงคานริมโขง  
  signature hero view of Chiang Khan Mekong Bank: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/chiang-khan-mekong-bank-38/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ เชียงคานริมโขง  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in เชียงคาน, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/chiang-khan-mekong-bank-38/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ เชียงคานริมโขง  
  close detail of the ริมน้ำ/ลำธาร surroundings at เชียงคาน Loei (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ C4 — บริษัท อีสานแอดเวนเจอร์ จำกัด (COMPANY)

#### ลำธารใสวังน้ำเขียว — Wang Nam Khiao Clear Stream  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Nakhon Ratchasima · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/wang-nam-khiao-clear-stream-39/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ลำธารใสวังน้ำเขียว  
  Minimal flat vector logo for a campsite "Wang Nam Khiao Clear Stream" (ลำธารใสวังน้ำเขียว), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/wang-nam-khiao-clear-stream-39/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ลำธารใสวังน้ำเขียว  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at วังน้ำเขียว Nakhon Ratchasima Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9

### โฮสต์ P2 — ห้างหุ้นส่วนจำกัด แม่ฮ่องสอนแคมป์ (PARTNERSHIP)

#### ห้วยน้ำดังสายหมอก — Huai Nam Dang Stream  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Mae Hong Son · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/huai-nam-dang-stream-40/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ห้วยน้ำดังสายหมอก  
  Minimal flat vector logo for a campsite "Huai Nam Dang Stream" (ห้วยน้ำดังสายหมอก), use a stream-line badge with layered water ripples and mist, no tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/huai-nam-dang-stream-40/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ห้วยน้ำดังสายหมอก  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ห้วยน้ำดัง Mae Hong Son Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/huai-nam-dang-stream-40/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ห้วยน้ำดังสายหมอก  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ห้วยน้ำดัง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/huai-nam-dang-stream-40/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ห้วยน้ำดังสายหมอก  
  signature hero view of Huai Nam Dang Stream: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/huai-nam-dang-stream-40/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ห้วยน้ำดังสายหมอก  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ห้วยน้ำดัง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/huai-nam-dang-stream-40/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ห้วยน้ำดังสายหมอก  
  close detail of the ริมน้ำ/ลำธาร surroundings at ห้วยน้ำดัง Mae Hong Son (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ P1 — ห้างหุ้นส่วนจำกัด เลยไฮแลนด์ (PARTNERSHIP)

#### ริมธารภูกระดึงน้อย — Little Phu Kradueng Stream  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/little-phu-kradueng-stream-41/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมธารภูกระดึงน้อย  
  Minimal flat vector logo for a campsite "Little Phu Kradueng Stream" (ริมธารภูกระดึงน้อย), use a rocky stream badge with a water curve and fern, no tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/little-phu-kradueng-stream-41/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมธารภูกระดึงน้อย  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ภูกระดึง Loei Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/little-phu-kradueng-stream-41/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมธารภูกระดึงน้อย  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ภูกระดึง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/little-phu-kradueng-stream-41/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมธารภูกระดึงน้อย  
  signature hero view of Little Phu Kradueng Stream: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/little-phu-kradueng-stream-41/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมธารภูกระดึงน้อย  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ภูกระดึง, warm evening glow, candid lifestyle photo, 16:9

### โฮสต์ C4 — บริษัท อีสานแอดเวนเจอร์ จำกัด (COMPANY)

#### แก่งน้ำใสปากช่อง — Pak Chong Clearwater Rapids  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Nakhon Ratchasima · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/pak-chong-clearwater-rapids-42/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แก่งน้ำใสปากช่อง  
  Minimal flat vector logo for a campsite "Pak Chong Clearwater Rapids" (แก่งน้ำใสปากช่อง), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pak-chong-clearwater-rapids-42/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แก่งน้ำใสปากช่อง  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ปากช่อง Nakhon Ratchasima Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/pak-chong-clearwater-rapids-42/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แก่งน้ำใสปากช่อง  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ปากช่อง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/pak-chong-clearwater-rapids-42/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แก่งน้ำใสปากช่อง  
  signature hero view of Pak Chong Clearwater Rapids: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/pak-chong-clearwater-rapids-42/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แก่งน้ำใสปากช่อง  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ปากช่อง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/pak-chong-clearwater-rapids-42/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ แก่งน้ำใสปากช่อง  
  close detail of the ริมน้ำ/ลำธาร surroundings at ปากช่อง Nakhon Ratchasima (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/pak-chong-clearwater-rapids-42/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง แก่งน้ำใสปากช่อง  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ปากช่อง, tents arranged on the ground, surrounding RIVE and FORE landscape, soft morning light through trees, 16:9

#### ป่าใหญ่เขาใหญ่แคมป์ — Khao Yai Jungle Camp  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Nakhon Ratchasima · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/khao-yai-jungle-camp-43/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าใหญ่เขาใหญ่แคมป์  
  Minimal flat vector logo for a campsite "Khao Yai Jungle Camp" (ป่าใหญ่เขาใหญ่แคมป์), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/khao-yai-jungle-camp-43/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าใหญ่เขาใหญ่แคมป์  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at เขาใหญ่ Nakhon Ratchasima Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/khao-yai-jungle-camp-43/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าใหญ่เขาใหญ่แคมป์  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, เขาใหญ่ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/khao-yai-jungle-camp-43/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าใหญ่เขาใหญ่แคมป์  
  signature hero view of Khao Yai Jungle Camp: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/khao-yai-jungle-camp-43/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าใหญ่เขาใหญ่แคมป์  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in เขาใหญ่, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/khao-yai-jungle-camp-43/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ป่าใหญ่เขาใหญ่แคมป์  
  close detail of the ป่าลึก/ผจญภัย surroundings at เขาใหญ่ Nakhon Ratchasima (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/khao-yai-jungle-camp-43/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ป่าใหญ่เขาใหญ่แคมป์  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at เขาใหญ่, tents arranged on the ground, surrounding FORE and MTNS landscape, misty early morning, 16:9

### โฮสต์ C5 — บริษัท เลคแอนด์เลเชอร์ จำกัด (COMPANY)

#### เขาสกป่าฝนแคมป์ — Khao Sok Rainforest  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Surat Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/khao-sok-rainforest-44/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เขาสกป่าฝนแคมป์  
  Minimal flat vector logo for a campsite "Khao Sok Rainforest" (เขาสกป่าฝนแคมป์), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/khao-sok-rainforest-44/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เขาสกป่าฝนแคมป์  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at เขาสก Surat Thani Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/khao-sok-rainforest-44/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เขาสกป่าฝนแคมป์  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, เขาสก Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/khao-sok-rainforest-44/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เขาสกป่าฝนแคมป์  
  signature hero view of Khao Sok Rainforest: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/khao-sok-rainforest-44/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ เขาสกป่าฝนแคมป์  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in เขาสก, warm evening glow, candid lifestyle photo, 16:9

### โฮสต์ P1 — ห้างหุ้นส่วนจำกัด เลยไฮแลนด์ (PARTNERSHIP)

#### ภูกระดึงยอดป่า — Phu Kradueng Summit Forest  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/phu-kradueng-summit-forest-45/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ภูกระดึงยอดป่า  
  Minimal flat vector logo for a campsite "Phu Kradueng Summit Forest" (ภูกระดึงยอดป่า), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phu-kradueng-summit-forest-45/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ภูกระดึงยอดป่า  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ภูกระดึง Loei Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/phu-kradueng-summit-forest-45/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ภูกระดึงยอดป่า  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ภูกระดึง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9

### โฮสต์ I4 — ประภาส ไพรวัลย์ (INDIVIDUAL)

#### ไพรพนาวังน้ำเขียว — Wang Nam Khiao Woodland  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Nakhon Ratchasima · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/wang-nam-khiao-woodland-46/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ไพรพนาวังน้ำเขียว  
  Minimal flat vector logo for a campsite "Wang Nam Khiao Woodland" (ไพรพนาวังน้ำเขียว), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/wang-nam-khiao-woodland-46/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ไพรพนาวังน้ำเขียว  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at วังน้ำเขียว Nakhon Ratchasima Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/wang-nam-khiao-woodland-46/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ไพรพนาวังน้ำเขียว  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, วังน้ำเขียว Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/wang-nam-khiao-woodland-46/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ไพรพนาวังน้ำเขียว  
  signature hero view of Wang Nam Khiao Woodland: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9

### โฮสต์ C5 — บริษัท เลคแอนด์เลเชอร์ จำกัด (COMPANY)

#### ป่าดิบชื้นเขาสก — Khao Sok Evergreen  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Surat Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/khao-sok-evergreen-47/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าดิบชื้นเขาสก  
  Minimal flat vector logo for a campsite "Khao Sok Evergreen" (ป่าดิบชื้นเขาสก), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/khao-sok-evergreen-47/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าดิบชื้นเขาสก  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at เขาสก Surat Thani Thailand, misty early morning, photorealistic, highly detailed, 16:9

### โฮสต์ C4 — บริษัท อีสานแอดเวนเจอร์ จำกัด (COMPANY)

#### พงไพรเขาใหญ่ — Khao Yai Wildwood  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Nakhon Ratchasima · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/khao-yai-wildwood-48/cover.jpg` (1:1, logo) — _alt:_ โลโก้ พงไพรเขาใหญ่  
  Minimal flat vector logo for a campsite "Khao Yai Wildwood" (พงไพรเขาใหญ่), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/khao-yai-wildwood-48/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง พงไพรเขาใหญ่  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at เขาใหญ่ Nakhon Ratchasima Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/khao-yai-wildwood-48/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ พงไพรเขาใหญ่  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, เขาใหญ่ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/khao-yai-wildwood-48/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น พงไพรเขาใหญ่  
  signature hero view of Khao Yai Wildwood: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/khao-yai-wildwood-48/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ พงไพรเขาใหญ่  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in เขาใหญ่, warm evening glow, candid lifestyle photo, 16:9
