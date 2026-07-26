# Image Generation Prompts — CampVibe staging mock (210 camps, 77 provinces)

> เอา prompt เหล่านี้ไปให้ Gemini generate รูป แล้วบันทึกตาม **path** ที่ระบุ (ให้ตรงกับ field ใน `prisma/data/mock-staging.json`)
>
> **สไตล์รวม:** ภาพถ่ายเสมือนจริง (photorealistic) บรรยากาศแคมป์ปิ้งในประเทศไทย แสงธรรมชาติ ไม่มีตัวอักษร/ลายน้ำบนภาพถ่าย (เฉพาะโลโก้เป็น flat vector ได้) ไม่มีคนหันหน้าชัด

## Host avatars (19)

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
- `/seed/hosts/RGN/avatar.jpg` (1:1) — **บริษัท ภาคเหนือแคมป์ปิ้ง เน็ตเวิร์ก จำกัด** (COMPANY): Clean professional brand emblem for outdoor camping company, tent + ภาคเหนือ nature motif, 2-tone earthy green, flat vector, white background
- `/seed/hosts/RGNE/avatar.jpg` (1:1) — **ห้างหุ้นส่วนจำกัด อีสานฟาร์มสเตย์** (PARTNERSHIP): Rustic camp brand logo, hand-drawn tent and mountain, warm earthy tones, flat vector, white background
- `/seed/hosts/RGC/avatar.jpg` (1:1) — **อัครเดช ที่ราบกลาง** (INDIVIDUAL): Friendly badge for a small local Thai camp owner, circular tent icon, soft natural colors, flat illustration, white background
- `/seed/hosts/RGE/avatar.jpg` (1:1) — **บริษัท ตะวันออกแคมป์ กรุ๊ป จำกัด** (COMPANY): Clean professional brand emblem for outdoor camping company, tent + ภาคตะวันออก nature motif, 2-tone earthy green, flat vector, white background
- `/seed/hosts/RGW/avatar.jpg` (1:1) — **ห้างหุ้นส่วนจำกัด ตะวันตกไพรวัลย์** (PARTNERSHIP): Rustic camp brand logo, hand-drawn tent and mountain, warm earthy tones, flat vector, white background
- `/seed/hosts/RGS/avatar.jpg` (1:1) — **สุนิสา ทะเลใต้** (INDIVIDUAL): Friendly badge for a small local Thai camp owner, circular tent icon, soft natural colors, flat illustration, white background

## Campsite images

### โฮสต์ C3 — บริษัท เขาค้อแคมป์ รีสอร์ท จำกัด (COMPANY)

#### ม่านหมอกภูทับเบิก — Phu Thap Boek Mist  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Phetchabun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

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
  close detail of the ทะเลหมอกภูเขา surroundings at ภูทับเบิก Phetchabun (MTNS+FORE+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phu-thap-boek-mist-1/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ม่านหมอกภูทับเบิก  
  aerial drone top-down view of the ทะเลหมอกภูเขา campsite at ภูทับเบิก, tents arranged on the ground, surrounding MTNS and FORE and WATF and SWMH and CAVE landscape, golden sunrise with low fog, 16:9
- `/seed/camps/phu-thap-boek-mist-1/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ม่านหมอกภูทับเบิก  
  night scene of Phu Thap Boek Mist, glowing tents and warm string lights at a ทะเลหมอกภูเขา site in ภูทับเบิก, starry sky, long exposure, cozy mood, 16:9

#### ระเบียงดาวเขาค้อ — Khao Kho Star Terrace  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Phetchabun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

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
  close detail of the ทะเลหมอกภูเขา surroundings at เขาค้อ Phetchabun (MTNS+FORE+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ C1 — บริษัท นอร์ทเทิร์นแคมป์ จำกัด (COMPANY)

#### ดอยอ่างขางไฮแลนด์ — Doi Ang Khang Highland  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Mai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/doi-ang-khang-highland-3/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ดอยอ่างขางไฮแลนด์  
  Minimal flat vector logo for a campsite "Doi Ang Khang Highland" (ดอยอ่างขางไฮแลนด์), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/doi-ang-khang-highland-3/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ดอยอ่างขางไฮแลนด์  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ดอยอ่างขาง Chiang Mai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/doi-ang-khang-highland-3/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ดอยอ่างขางไฮแลนด์  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ดอยอ่างขาง Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/doi-ang-khang-highland-3/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ดอยอ่างขางไฮแลนด์  
  signature hero view of Doi Ang Khang Highland: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/doi-ang-khang-highland-3/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ดอยอ่างขางไฮแลนด์  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in ดอยอ่างขาง, warm evening glow, candid lifestyle photo, 16:9

#### ม่อนแจ่มวิวหมอก — Mon Jam Mist View  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Mai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/mon-jam-mist-view-4/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ม่อนแจ่มวิวหมอก  
  Minimal flat vector logo for a campsite "Mon Jam Mist View" (ม่อนแจ่มวิวหมอก), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/mon-jam-mist-view-4/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ม่อนแจ่มวิวหมอก  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ม่อนแจ่ม Chiang Mai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9

### โฮสต์ P3 — ห้างหุ้นส่วนจำกัด เชียงรายวิว (PARTNERSHIP)

#### ภูชี้ฟ้าอรุณรุ่ง — Phu Chi Fa Sunrise  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Rai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/phu-chi-fa-sunrise-5/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ภูชี้ฟ้าอรุณรุ่ง  
  Minimal flat vector logo for a campsite "Phu Chi Fa Sunrise" (ภูชี้ฟ้าอรุณรุ่ง), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phu-chi-fa-sunrise-5/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ภูชี้ฟ้าอรุณรุ่ง  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ภูชี้ฟ้า Chiang Rai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/phu-chi-fa-sunrise-5/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ภูชี้ฟ้าอรุณรุ่ง  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ภูชี้ฟ้า Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9

#### ดอยแม่สลองหมอกเช้า — Doi Mae Salong Morning Mist  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Rai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/doi-mae-salong-morning-mist-6/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ดอยแม่สลองหมอกเช้า  
  Minimal flat vector logo for a campsite "Doi Mae Salong Morning Mist" (ดอยแม่สลองหมอกเช้า), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/doi-mae-salong-morning-mist-6/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ดอยแม่สลองหมอกเช้า  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ดอยแม่สลอง Chiang Rai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/doi-mae-salong-morning-mist-6/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ดอยแม่สลองหมอกเช้า  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ดอยแม่สลอง Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/doi-mae-salong-morning-mist-6/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ดอยแม่สลองหมอกเช้า  
  signature hero view of Doi Mae Salong Morning Mist: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/doi-mae-salong-morning-mist-6/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ดอยแม่สลองหมอกเช้า  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in ดอยแม่สลอง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/doi-mae-salong-morning-mist-6/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ดอยแม่สลองหมอกเช้า  
  close detail of the ทะเลหมอกภูเขา surroundings at ดอยแม่สลอง Chiang Rai (MTNS+FORE+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ P2 — ห้างหุ้นส่วนจำกัด แม่ฮ่องสอนแคมป์ (PARTNERSHIP)

#### บ้านรักไทยม่านหมอก — Ban Rak Thai Misty  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Mae Hong Son · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/ban-rak-thai-misty-7/cover.jpg` (1:1, logo) — _alt:_ โลโก้ บ้านรักไทยม่านหมอก  
  Minimal flat vector logo for a campsite "Ban Rak Thai Misty" (บ้านรักไทยม่านหมอก), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ban-rak-thai-misty-7/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง บ้านรักไทยม่านหมอก  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at บ้านรักไทย Mae Hong Son Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/ban-rak-thai-misty-7/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ บ้านรักไทยม่านหมอก  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, บ้านรักไทย Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/ban-rak-thai-misty-7/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น บ้านรักไทยม่านหมอก  
  signature hero view of Ban Rak Thai Misty: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/ban-rak-thai-misty-7/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ บ้านรักไทยม่านหมอก  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in บ้านรักไทย, warm evening glow, candid lifestyle photo, 16:9

### โฮสต์ P1 — ห้างหุ้นส่วนจำกัด เลยไฮแลนด์ (PARTNERSHIP)

#### ภูเรือลมหนาว — Phu Ruea Cold Breeze  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

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
  close detail of the ทะเลหมอกภูเขา surroundings at ภูเรือ Loei (MTNS+FORE+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phu-ruea-cold-breeze-8/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ภูเรือลมหนาว  
  aerial drone top-down view of the ทะเลหมอกภูเขา campsite at ภูเรือ, tents arranged on the ground, surrounding MTNS and FORE and WATF and SWMH and CAVE landscape, golden sunrise with low fog, 16:9
- `/seed/camps/phu-ruea-cold-breeze-8/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ภูเรือลมหนาว  
  night scene of Phu Ruea Cold Breeze, glowing tents and warm string lights at a ทะเลหมอกภูเขา site in ภูเรือ, starry sky, long exposure, cozy mood, 16:9

#### ภูป่าเปาะฟูจิเมืองเลย — Phu Pa Po Fuji  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/phu-pa-po-fuji-9/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ภูป่าเปาะฟูจิเมืองเลย  
  Minimal flat vector logo for a campsite "Phu Pa Po Fuji" (ภูป่าเปาะฟูจิเมืองเลย), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phu-pa-po-fuji-9/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ภูป่าเปาะฟูจิเมืองเลย  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ภูป่าเปาะ Loei Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/phu-pa-po-fuji-9/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ภูป่าเปาะฟูจิเมืองเลย  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ภูป่าเปาะ Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phu-pa-po-fuji-9/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ภูป่าเปาะฟูจิเมืองเลย  
  signature hero view of Phu Pa Po Fuji: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/phu-pa-po-fuji-9/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ภูป่าเปาะฟูจิเมืองเลย  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in ภูป่าเปาะ, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phu-pa-po-fuji-9/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ภูป่าเปาะฟูจิเมืองเลย  
  close detail of the ทะเลหมอกภูเขา surroundings at ภูป่าเปาะ Loei (MTNS+FORE+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ C1 — บริษัท นอร์ทเทิร์นแคมป์ จำกัด (COMPANY)

#### ดอยม่อนล้านทะเลหมอก — Doi Mon Lan Sea of Mist  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Mai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/doi-mon-lan-sea-of-mist-10/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ดอยม่อนล้านทะเลหมอก  
  Minimal flat vector logo for a campsite "Doi Mon Lan Sea of Mist" (ดอยม่อนล้านทะเลหมอก), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/doi-mon-lan-sea-of-mist-10/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ดอยม่อนล้านทะเลหมอก  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ม่อนล้าน Chiang Mai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9

### โฮสต์ C3 — บริษัท เขาค้อแคมป์ รีสอร์ท จำกัด (COMPANY)

#### ภูลมโลทุ่งหมอก — Phu Lom Lo Mist Field  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Phetchabun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

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
- `/seed/camps/phu-lom-lo-mist-field-11/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ภูลมโลทุ่งหมอก  
  close detail of the ทะเลหมอกภูเขา surroundings at ภูลมโล Phetchabun (MTNS+FORE+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phu-lom-lo-mist-field-11/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ภูลมโลทุ่งหมอก  
  aerial drone top-down view of the ทะเลหมอกภูเขา campsite at ภูลมโล, tents arranged on the ground, surrounding MTNS and FORE and WATF and SWMH and CAVE landscape, golden sunrise with low fog, 16:9
- `/seed/camps/phu-lom-lo-mist-field-11/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ภูลมโลทุ่งหมอก  
  night scene of Phu Lom Lo Mist Field, glowing tents and warm string lights at a ทะเลหมอกภูเขา site in ภูลมโล, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ P3 — ห้างหุ้นส่วนจำกัด เชียงรายวิว (PARTNERSHIP)

#### ยอดดอยผาตั้ง — Doi Pha Tang Peak  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Rai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/doi-pha-tang-peak-12/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ยอดดอยผาตั้ง  
  Minimal flat vector logo for a campsite "Doi Pha Tang Peak" (ยอดดอยผาตั้ง), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/doi-pha-tang-peak-12/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ยอดดอยผาตั้ง  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ผาตั้ง Chiang Rai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/doi-pha-tang-peak-12/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ยอดดอยผาตั้ง  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ผาตั้ง Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/doi-pha-tang-peak-12/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ยอดดอยผาตั้ง  
  signature hero view of Doi Pha Tang Peak: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/doi-pha-tang-peak-12/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ยอดดอยผาตั้ง  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in ผาตั้ง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/doi-pha-tang-peak-12/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ยอดดอยผาตั้ง  
  close detail of the ทะเลหมอกภูเขา surroundings at ผาตั้ง Chiang Rai (MTNS+FORE+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/doi-pha-tang-peak-12/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ยอดดอยผาตั้ง  
  aerial drone top-down view of the ทะเลหมอกภูเขา campsite at ผาตั้ง, tents arranged on the ground, surrounding MTNS and FORE and WATF and SWMH and CAVE landscape, golden sunrise with low fog, 16:9

### โฮสต์ C1 — บริษัท นอร์ทเทิร์นแคมป์ จำกัด (COMPANY)

#### ม่อนเงาะวิวเขา — Mon Ngo Hill View  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Mai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/mon-ngo-hill-view-13/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ม่อนเงาะวิวเขา  
  Minimal flat vector logo for a campsite "Mon Ngo Hill View" (ม่อนเงาะวิวเขา), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/mon-ngo-hill-view-13/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ม่อนเงาะวิวเขา  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ม่อนเงาะ Chiang Mai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/mon-ngo-hill-view-13/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ม่อนเงาะวิวเขา  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ม่อนเงาะ Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9

### โฮสต์ I2 — พิมพ์ใจ ใจดี (INDIVIDUAL)

#### ดอยสุเทพระเบียงเมือง — Doi Suthep City Terrace  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Mai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/doi-suthep-city-terrace-14/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ดอยสุเทพระเบียงเมือง  
  Minimal flat vector logo for a campsite "Doi Suthep City Terrace" (ดอยสุเทพระเบียงเมือง), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/doi-suthep-city-terrace-14/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ดอยสุเทพระเบียงเมือง  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ดอยสุเทพ Chiang Mai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/doi-suthep-city-terrace-14/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ดอยสุเทพระเบียงเมือง  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ดอยสุเทพ Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/doi-suthep-city-terrace-14/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ดอยสุเทพระเบียงเมือง  
  signature hero view of Doi Suthep City Terrace: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/doi-suthep-city-terrace-14/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ดอยสุเทพระเบียงเมือง  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in ดอยสุเทพ, warm evening glow, candid lifestyle photo, 16:9

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
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at วังน้ำเขียว Nakhon Ratchasima (MTNS+FORE+FILD+FARM terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/wang-nam-khiao-stargaze-farm-16/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ไร่ดาวลับฟ้าวังน้ำเขียว  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at วังน้ำเขียว, tents arranged on the ground, surrounding MTNS and FORE and FILD and FARM landscape, clear starry night, 16:9
- `/seed/camps/wang-nam-khiao-stargaze-farm-16/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ไร่ดาวลับฟ้าวังน้ำเขียว  
  night scene of Wang Nam Khiao Stargaze Farm, glowing tents and warm string lights at a ทุ่งหญ้า/ชมดาว site in วังน้ำเขียว, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ P1 — ห้างหุ้นส่วนจำกัด เลยไฮแลนด์ (PARTNERSHIP)

#### ทุ่งหญ้าภูสวนทราย — Phu Suan Sai Meadow  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/phu-suan-sai-meadow-17/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งหญ้าภูสวนทราย  
  Minimal flat vector logo for a campsite "Phu Suan Sai Meadow" (ทุ่งหญ้าภูสวนทราย), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phu-suan-sai-meadow-17/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งหญ้าภูสวนทราย  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ภูสวนทราย Loei Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/phu-suan-sai-meadow-17/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งหญ้าภูสวนทราย  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ภูสวนทราย Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phu-suan-sai-meadow-17/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทุ่งหญ้าภูสวนทราย  
  signature hero view of Phu Suan Sai Meadow: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/phu-suan-sai-meadow-17/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ทุ่งหญ้าภูสวนทราย  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ภูสวนทราย, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phu-suan-sai-meadow-17/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ทุ่งหญ้าภูสวนทราย  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at ภูสวนทราย Loei (MTNS+FORE+FILD+FARM terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phu-suan-sai-meadow-17/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ทุ่งหญ้าภูสวนทราย  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at ภูสวนทราย, tents arranged on the ground, surrounding MTNS and FORE and FILD and FARM landscape, clear starry night, 16:9

### โฮสต์ P3 — ห้างหุ้นส่วนจำกัด เชียงรายวิว (PARTNERSHIP)

#### ลานเล่นลมเชียงราย — Chiang Rai Windplay Field  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Chiang Rai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

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
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at เขาค้อ Phetchabun (MTNS+FORE+FILD+FARM terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/khao-kho-flower-field-19/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ทุ่งดอกไม้เขาค้อ  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at เขาค้อ, tents arranged on the ground, surrounding MTNS and FORE and FILD and FARM landscape, clear starry night, 16:9
- `/seed/camps/khao-kho-flower-field-19/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ทุ่งดอกไม้เขาค้อ  
  night scene of Khao Kho Flower Field, glowing tents and warm string lights at a ทุ่งหญ้า/ชมดาว site in เขาค้อ, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ C4 — บริษัท อีสานแอดเวนเจอร์ จำกัด (COMPANY)

#### วิวกว้างวังน้ำเขียว — Wang Nam Khiao Wide View  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Nakhon Ratchasima · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/wang-nam-khiao-wide-view-20/cover.jpg` (1:1, logo) — _alt:_ โลโก้ วิวกว้างวังน้ำเขียว  
  Minimal flat vector logo for a campsite "Wang Nam Khiao Wide View" (วิวกว้างวังน้ำเขียว), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/wang-nam-khiao-wide-view-20/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง วิวกว้างวังน้ำเขียว  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at วังน้ำเขียว Nakhon Ratchasima Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/wang-nam-khiao-wide-view-20/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ วิวกว้างวังน้ำเขียว  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, วังน้ำเขียว Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/wang-nam-khiao-wide-view-20/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น วิวกว้างวังน้ำเขียว  
  signature hero view of Wang Nam Khiao Wide View: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/wang-nam-khiao-wide-view-20/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ วิวกว้างวังน้ำเขียว  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in วังน้ำเขียว, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/wang-nam-khiao-wide-view-20/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ วิวกว้างวังน้ำเขียว  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at วังน้ำเขียว Nakhon Ratchasima (MTNS+FORE+FILD+FARM terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ I5 — ลานริมโขงน้องแอน (INDIVIDUAL)

#### ลานตะวันรอนภูเรือ — Phu Ruea Sunset Lawn  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

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

### โฮสต์ P3 — ห้างหุ้นส่วนจำกัด เชียงรายวิว (PARTNERSHIP)

#### ทุ่งหญ้าเลี้ยงดาวเชียงราย — Chiang Rai Star Pasture  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Chiang Rai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

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
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at ดอยตุง Chiang Rai (MTNS+FORE+FILD+FARM terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ C2 — บริษัท ซีไซด์แคมป์ปิ้ง จำกัด (COMPANY)

#### หาดไร่เลย์แคมป์ — Railay Beach Camp  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Krabi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

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
  close detail of the ริมทะเล/ชายหาด surroundings at อ่าวนาง Krabi (BEAC+SEA+COAS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/ao-nang-seaside-24/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง อ่าวนางริมเล  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at อ่าวนาง, tents arranged on the ground, surrounding BEAC and SEA and COAS landscape, warm sunset over the sea, 16:9

### โฮสต์ I3 — บ้านเลริมหาด (INDIVIDUAL)

#### เกาะลันตาซันเซ็ต — Koh Lanta Sunset  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Krabi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

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
  close detail of the ริมทะเล/ชายหาด surroundings at เกาะลันตา Krabi (BEAC+SEA+COAS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/koh-lanta-sunset-25/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง เกาะลันตาซันเซ็ต  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at เกาะลันตา, tents arranged on the ground, surrounding BEAC and SEA and COAS landscape, warm sunset over the sea, 16:9

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
ธีม: ริมทะเล/ชายหาด · จังหวัด: Trat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

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
  close detail of the ริมทะเล/ชายหาด surroundings at เกาะกูด Trat (BEAC+SEA+COAS terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ I3 — บ้านเลริมหาด (INDIVIDUAL)

#### เกาะหมากเงียบสงบ — Koh Mak Serene  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Trat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

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
  close detail of the ริมทะเล/ชายหาด surroundings at เกาะหมาก Trat (BEAC+SEA+COAS terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ C2 — บริษัท ซีไซด์แคมป์ปิ้ง จำกัด (COMPANY)

#### หาดทรายเกาะช้าง — Koh Chang Sandy Bay  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Trat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/koh-chang-sandy-bay-30/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดทรายเกาะช้าง  
  Minimal flat vector logo for a campsite "Koh Chang Sandy Bay" (หาดทรายเกาะช้าง), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/koh-chang-sandy-bay-30/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดทรายเกาะช้าง  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at เกาะช้าง Trat Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/koh-chang-sandy-bay-30/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดทรายเกาะช้าง  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, เกาะช้าง Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/koh-chang-sandy-bay-30/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น หาดทรายเกาะช้าง  
  signature hero view of Koh Chang Sandy Bay: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/koh-chang-sandy-bay-30/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ หาดทรายเกาะช้าง  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in เกาะช้าง, warm evening glow, candid lifestyle photo, 16:9

#### เกาะเต่าใต้ดาว — Koh Tao Under Stars  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Surat Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

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

### โฮสต์ P2 — ห้างหุ้นส่วนจำกัด แม่ฮ่องสอนแคมป์ (PARTNERSHIP)

#### ปางอุ๋งริมทะเลสาบ — Pang Ung Lakeside  
ธีม: ริมทะเลสาบ · จังหวัด: Mae Hong Son · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/pang-ung-lakeside-32/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ปางอุ๋งริมทะเลสาบ  
  Minimal flat vector logo for a campsite "Pang Ung Lakeside" (ปางอุ๋งริมทะเลสาบ), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pang-ung-lakeside-32/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ปางอุ๋งริมทะเลสาบ  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ปางอุ๋ง Mae Hong Son Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9

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
  close detail of the ริมทะเลสาบ surroundings at เขื่อนเชี่ยวหลาน Surat Thani (RIVE+FORE+LAKE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9

#### แพริมเขื่อนเชี่ยวหลาน — Cheow Lan Raft Stay  
ธีม: ริมทะเลสาบ · จังหวัด: Surat Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/cheow-lan-raft-stay-34/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แพริมเขื่อนเชี่ยวหลาน  
  Minimal flat vector logo for a campsite "Cheow Lan Raft Stay" (แพริมเขื่อนเชี่ยวหลาน), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/cheow-lan-raft-stay-34/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แพริมเขื่อนเชี่ยวหลาน  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at เขื่อนเชี่ยวหลาน Surat Thani Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/cheow-lan-raft-stay-34/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แพริมเขื่อนเชี่ยวหลาน  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, เขื่อนเชี่ยวหลาน Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/cheow-lan-raft-stay-34/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แพริมเขื่อนเชี่ยวหลาน  
  signature hero view of Cheow Lan Raft Stay: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/cheow-lan-raft-stay-34/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แพริมเขื่อนเชี่ยวหลาน  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in เขื่อนเชี่ยวหลาน, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/cheow-lan-raft-stay-34/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ แพริมเขื่อนเชี่ยวหลาน  
  close detail of the ริมทะเลสาบ surroundings at เขื่อนเชี่ยวหลาน Surat Thani (RIVE+FORE+LAKE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/cheow-lan-raft-stay-34/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง แพริมเขื่อนเชี่ยวหลาน  
  aerial drone top-down view of the ริมทะเลสาบ campsite at เขื่อนเชี่ยวหลาน, tents arranged on the ground, surrounding RIVE and FORE and LAKE and WATF and SWMH landscape, still dawn with mist on the water, 16:9
- `/seed/camps/cheow-lan-raft-stay-34/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน แพริมเขื่อนเชี่ยวหลาน  
  night scene of Cheow Lan Raft Stay, glowing tents and warm string lights at a ริมทะเลสาบ site in เขื่อนเชี่ยวหลาน, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ P2 — ห้างหุ้นส่วนจำกัด แม่ฮ่องสอนแคมป์ (PARTNERSHIP)

#### ทะเลสาบสายหมอกปางอุ๋ง — Pang Ung Misty Lake  
ธีม: ริมทะเลสาบ · จังหวัด: Mae Hong Son · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/pang-ung-misty-lake-35/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทะเลสาบสายหมอกปางอุ๋ง  
  Minimal flat vector logo for a campsite "Pang Ung Misty Lake" (ทะเลสาบสายหมอกปางอุ๋ง), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pang-ung-misty-lake-35/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทะเลสาบสายหมอกปางอุ๋ง  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ปางอุ๋ง Mae Hong Son Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9

### โฮสต์ P1 — ห้างหุ้นส่วนจำกัด เลยไฮแลนด์ (PARTNERSHIP)

#### อ่างเก็บน้ำภูสวรรค์ — Phu Sawan Reservoir  
ธีม: ริมทะเลสาบ · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/phu-sawan-reservoir-36/cover.jpg` (1:1, logo) — _alt:_ โลโก้ อ่างเก็บน้ำภูสวรรค์  
  Minimal flat vector logo for a campsite "Phu Sawan Reservoir" (อ่างเก็บน้ำภูสวรรค์), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phu-sawan-reservoir-36/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง อ่างเก็บน้ำภูสวรรค์  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ภูสวรรค์ Loei Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/phu-sawan-reservoir-36/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ อ่างเก็บน้ำภูสวรรค์  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ภูสวรรค์ Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phu-sawan-reservoir-36/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น อ่างเก็บน้ำภูสวรรค์  
  signature hero view of Phu Sawan Reservoir: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/phu-sawan-reservoir-36/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ อ่างเก็บน้ำภูสวรรค์  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in ภูสวรรค์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phu-sawan-reservoir-36/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ อ่างเก็บน้ำภูสวรรค์  
  close detail of the ริมทะเลสาบ surroundings at ภูสวรรค์ Loei (RIVE+FORE+LAKE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phu-sawan-reservoir-36/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง อ่างเก็บน้ำภูสวรรค์  
  aerial drone top-down view of the ริมทะเลสาบ campsite at ภูสวรรค์, tents arranged on the ground, surrounding RIVE and FORE and LAKE and WATF and SWMH landscape, still dawn with mist on the water, 16:9
- `/seed/camps/phu-sawan-reservoir-36/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน อ่างเก็บน้ำภูสวรรค์  
  night scene of Phu Sawan Reservoir, glowing tents and warm string lights at a ริมทะเลสาบ site in ภูสวรรค์, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ P2 — ห้างหุ้นส่วนจำกัด แม่ฮ่องสอนแคมป์ (PARTNERSHIP)

#### ปายริมธารแคมป์ — Pai Riverside Camp  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Mae Hong Son · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/pai-riverside-camp-37/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ปายริมธารแคมป์  
  Minimal flat vector logo for a campsite "Pai Riverside Camp" (ปายริมธารแคมป์), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pai-riverside-camp-37/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ปายริมธารแคมป์  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ปาย Mae Hong Son Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/pai-riverside-camp-37/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ปายริมธารแคมป์  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ปาย Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9

### โฮสต์ I5 — ลานริมโขงน้องแอน (INDIVIDUAL)

#### เชียงคานริมโขง — Chiang Khan Mekong Bank  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/chiang-khan-mekong-bank-38/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เชียงคานริมโขง  
  Minimal flat vector logo for a campsite "Chiang Khan Mekong Bank" (เชียงคานริมโขง), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chiang-khan-mekong-bank-38/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เชียงคานริมโขง  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at เชียงคาน Loei Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/chiang-khan-mekong-bank-38/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เชียงคานริมโขง  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, เชียงคาน Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chiang-khan-mekong-bank-38/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เชียงคานริมโขง  
  signature hero view of Chiang Khan Mekong Bank: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9

### โฮสต์ C4 — บริษัท อีสานแอดเวนเจอร์ จำกัด (COMPANY)

#### ลำธารใสวังน้ำเขียว — Wang Nam Khiao Clear Stream  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Nakhon Ratchasima · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/wang-nam-khiao-clear-stream-39/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ลำธารใสวังน้ำเขียว  
  Minimal flat vector logo for a campsite "Wang Nam Khiao Clear Stream" (ลำธารใสวังน้ำเขียว), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/wang-nam-khiao-clear-stream-39/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ลำธารใสวังน้ำเขียว  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at วังน้ำเขียว Nakhon Ratchasima Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/wang-nam-khiao-clear-stream-39/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ลำธารใสวังน้ำเขียว  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, วังน้ำเขียว Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9

### โฮสต์ P2 — ห้างหุ้นส่วนจำกัด แม่ฮ่องสอนแคมป์ (PARTNERSHIP)

#### ห้วยน้ำดังสายหมอก — Huai Nam Dang Stream  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Mae Hong Son · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/huai-nam-dang-stream-40/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ห้วยน้ำดังสายหมอก  
  Minimal flat vector logo for a campsite "Huai Nam Dang Stream" (ห้วยน้ำดังสายหมอก), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/huai-nam-dang-stream-40/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ห้วยน้ำดังสายหมอก  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ห้วยน้ำดัง Mae Hong Son Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/huai-nam-dang-stream-40/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ห้วยน้ำดังสายหมอก  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ห้วยน้ำดัง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/huai-nam-dang-stream-40/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ห้วยน้ำดังสายหมอก  
  signature hero view of Huai Nam Dang Stream: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/huai-nam-dang-stream-40/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ห้วยน้ำดังสายหมอก  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ห้วยน้ำดัง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/huai-nam-dang-stream-40/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ห้วยน้ำดังสายหมอก  
  close detail of the ริมน้ำ/ลำธาร surroundings at ห้วยน้ำดัง Mae Hong Son (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/huai-nam-dang-stream-40/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ห้วยน้ำดังสายหมอก  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ห้วยน้ำดัง, tents arranged on the ground, surrounding RIVE and FORE and WATF and SWMH landscape, soft morning light through trees, 16:9

### โฮสต์ P1 — ห้างหุ้นส่วนจำกัด เลยไฮแลนด์ (PARTNERSHIP)

#### ริมธารภูกระดึงน้อย — Little Phu Kradueng Stream  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/little-phu-kradueng-stream-41/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมธารภูกระดึงน้อย  
  Minimal flat vector logo for a campsite "Little Phu Kradueng Stream" (ริมธารภูกระดึงน้อย), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
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
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Nakhon Ratchasima · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/pak-chong-clearwater-rapids-42/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แก่งน้ำใสปากช่อง  
  Minimal flat vector logo for a campsite "Pak Chong Clearwater Rapids" (แก่งน้ำใสปากช่อง), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pak-chong-clearwater-rapids-42/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แก่งน้ำใสปากช่อง  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ปากช่อง Nakhon Ratchasima Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/pak-chong-clearwater-rapids-42/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แก่งน้ำใสปากช่อง  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ปากช่อง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/pak-chong-clearwater-rapids-42/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แก่งน้ำใสปากช่อง  
  signature hero view of Pak Chong Clearwater Rapids: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9

#### ป่าใหญ่เขาใหญ่แคมป์ — Khao Yai Jungle Camp  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Nakhon Ratchasima · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

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
  close detail of the ป่าลึก/ผจญภัย surroundings at เขาใหญ่ Nakhon Ratchasima (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ C5 — บริษัท เลคแอนด์เลเชอร์ จำกัด (COMPANY)

#### เขาสกป่าฝนแคมป์ — Khao Sok Rainforest  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Surat Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/khao-sok-rainforest-44/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เขาสกป่าฝนแคมป์  
  Minimal flat vector logo for a campsite "Khao Sok Rainforest" (เขาสกป่าฝนแคมป์), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/khao-sok-rainforest-44/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เขาสกป่าฝนแคมป์  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at เขาสก Surat Thani Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/khao-sok-rainforest-44/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เขาสกป่าฝนแคมป์  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, เขาสก Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/khao-sok-rainforest-44/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เขาสกป่าฝนแคมป์  
  signature hero view of Khao Sok Rainforest: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9

### โฮสต์ P1 — ห้างหุ้นส่วนจำกัด เลยไฮแลนด์ (PARTNERSHIP)

#### ภูกระดึงยอดป่า — Phu Kradueng Summit Forest  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/phu-kradueng-summit-forest-45/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ภูกระดึงยอดป่า  
  Minimal flat vector logo for a campsite "Phu Kradueng Summit Forest" (ภูกระดึงยอดป่า), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phu-kradueng-summit-forest-45/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ภูกระดึงยอดป่า  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ภูกระดึง Loei Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/phu-kradueng-summit-forest-45/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ภูกระดึงยอดป่า  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ภูกระดึง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phu-kradueng-summit-forest-45/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ภูกระดึงยอดป่า  
  signature hero view of Phu Kradueng Summit Forest: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/phu-kradueng-summit-forest-45/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ภูกระดึงยอดป่า  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ภูกระดึง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phu-kradueng-summit-forest-45/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ภูกระดึงยอดป่า  
  close detail of the ป่าลึก/ผจญภัย surroundings at ภูกระดึง Loei (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phu-kradueng-summit-forest-45/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ภูกระดึงยอดป่า  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ภูกระดึง, tents arranged on the ground, surrounding FORE and MTNS and WATF and SWMH and CAVE landscape, misty early morning, 16:9
- `/seed/camps/phu-kradueng-summit-forest-45/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ภูกระดึงยอดป่า  
  night scene of Phu Kradueng Summit Forest, glowing tents and warm string lights at a ป่าลึก/ผจญภัย site in ภูกระดึง, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ I4 — ประภาส ไพรวัลย์ (INDIVIDUAL)

#### ไพรพนาวังน้ำเขียว — Wang Nam Khiao Woodland  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Nakhon Ratchasima · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/wang-nam-khiao-woodland-46/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ไพรพนาวังน้ำเขียว  
  Minimal flat vector logo for a campsite "Wang Nam Khiao Woodland" (ไพรพนาวังน้ำเขียว), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/wang-nam-khiao-woodland-46/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ไพรพนาวังน้ำเขียว  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at วังน้ำเขียว Nakhon Ratchasima Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/wang-nam-khiao-woodland-46/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ไพรพนาวังน้ำเขียว  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, วังน้ำเขียว Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/wang-nam-khiao-woodland-46/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ไพรพนาวังน้ำเขียว  
  signature hero view of Wang Nam Khiao Woodland: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/wang-nam-khiao-woodland-46/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ไพรพนาวังน้ำเขียว  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in วังน้ำเขียว, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/wang-nam-khiao-woodland-46/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ไพรพนาวังน้ำเขียว  
  close detail of the ป่าลึก/ผจญภัย surroundings at วังน้ำเขียว Nakhon Ratchasima (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/wang-nam-khiao-woodland-46/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ไพรพนาวังน้ำเขียว  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at วังน้ำเขียว, tents arranged on the ground, surrounding FORE and MTNS and WATF and SWMH and CAVE landscape, misty early morning, 16:9
- `/seed/camps/wang-nam-khiao-woodland-46/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ไพรพนาวังน้ำเขียว  
  night scene of Wang Nam Khiao Woodland, glowing tents and warm string lights at a ป่าลึก/ผจญภัย site in วังน้ำเขียว, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ C5 — บริษัท เลคแอนด์เลเชอร์ จำกัด (COMPANY)

#### ป่าดิบชื้นเขาสก — Khao Sok Evergreen  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Surat Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/khao-sok-evergreen-47/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าดิบชื้นเขาสก  
  Minimal flat vector logo for a campsite "Khao Sok Evergreen" (ป่าดิบชื้นเขาสก), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/khao-sok-evergreen-47/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าดิบชื้นเขาสก  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at เขาสก Surat Thani Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/khao-sok-evergreen-47/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าดิบชื้นเขาสก  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, เขาสก Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/khao-sok-evergreen-47/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าดิบชื้นเขาสก  
  signature hero view of Khao Sok Evergreen: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/khao-sok-evergreen-47/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าดิบชื้นเขาสก  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in เขาสก, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/khao-sok-evergreen-47/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ป่าดิบชื้นเขาสก  
  close detail of the ป่าลึก/ผจญภัย surroundings at เขาสก Surat Thani (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ C4 — บริษัท อีสานแอดเวนเจอร์ จำกัด (COMPANY)

#### พงไพรเขาใหญ่ — Khao Yai Wildwood  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Nakhon Ratchasima · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

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
- `/seed/camps/khao-yai-wildwood-48/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ พงไพรเขาใหญ่  
  close detail of the ป่าลึก/ผจญภัย surroundings at เขาใหญ่ Nakhon Ratchasima (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ RGC — อัครเดช ที่ราบกลาง (INDIVIDUAL)

#### หาดชายฝั่งเงียบกรุงเทพมหานคร — Bangkok Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Bangkok · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/bangkok-beachside-camp-1-49/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดชายฝั่งเงียบกรุงเทพมหานคร  
  Minimal flat vector logo for a campsite "Bangkok Beachside Camp 1" (หาดชายฝั่งเงียบกรุงเทพมหานคร), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/bangkok-beachside-camp-1-49/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดชายฝั่งเงียบกรุงเทพมหานคร  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดชายฝั่งเงียบ Bangkok Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/bangkok-beachside-camp-1-49/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดชายฝั่งเงียบกรุงเทพมหานคร  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดชายฝั่งเงียบ Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/bangkok-beachside-camp-1-49/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น หาดชายฝั่งเงียบกรุงเทพมหานคร  
  signature hero view of Bangkok Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/bangkok-beachside-camp-1-49/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ หาดชายฝั่งเงียบกรุงเทพมหานคร  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in หาดชายฝั่งเงียบ, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/bangkok-beachside-camp-1-49/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ หาดชายฝั่งเงียบกรุงเทพมหานคร  
  close detail of the ริมทะเล/ชายหาด surroundings at หาดชายฝั่งเงียบ Bangkok (BEAC+SEA+COAS terrain), natural textures and foliage, soft light, 16:9

#### ป่าเบญจพรรณชานเมืองกรุงเทพมหานคร — Bangkok Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Bangkok · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/bangkok-forest-camp-2-50/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองกรุงเทพมหานคร  
  Minimal flat vector logo for a campsite "Bangkok Forest Camp 2" (ป่าเบญจพรรณชานเมืองกรุงเทพมหานคร), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/bangkok-forest-camp-2-50/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองกรุงเทพมหานคร  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Bangkok Thailand, misty early morning, photorealistic, highly detailed, 16:9

#### ริมทะเลนอกเมืองสมุทรปราการ — Samut Prakan Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Samut Prakan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/samut-prakan-beachside-camp-1-51/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมทะเลนอกเมืองสมุทรปราการ  
  Minimal flat vector logo for a campsite "Samut Prakan Beachside Camp 1" (ริมทะเลนอกเมืองสมุทรปราการ), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/samut-prakan-beachside-camp-1-51/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมทะเลนอกเมืองสมุทรปราการ  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at ริมทะเลนอกเมือง Samut Prakan Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/samut-prakan-beachside-camp-1-51/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมทะเลนอกเมืองสมุทรปราการ  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, ริมทะเลนอกเมือง Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9

#### ป่าชุมชนใกล้เมืองสมุทรปราการ — Samut Prakan Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Samut Prakan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/samut-prakan-forest-camp-2-52/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองสมุทรปราการ  
  Minimal flat vector logo for a campsite "Samut Prakan Forest Camp 2" (ป่าชุมชนใกล้เมืองสมุทรปราการ), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/samut-prakan-forest-camp-2-52/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองสมุทรปราการ  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Samut Prakan Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/samut-prakan-forest-camp-2-52/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าชุมชนใกล้เมืองสมุทรปราการ  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าชุมชนใกล้เมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9

#### ริมบึงธรรมชาติสมุทรปราการ — Samut Prakan Lakeside Camp 3  
ธีม: ริมทะเลสาบ · จังหวัด: Samut Prakan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/samut-prakan-lakeside-camp-3-53/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมบึงธรรมชาติสมุทรปราการ  
  Minimal flat vector logo for a campsite "Samut Prakan Lakeside Camp 3" (ริมบึงธรรมชาติสมุทรปราการ), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/samut-prakan-lakeside-camp-3-53/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมบึงธรรมชาติสมุทรปราการ  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ริมบึงธรรมชาติ Samut Prakan Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/samut-prakan-lakeside-camp-3-53/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมบึงธรรมชาติสมุทรปราการ  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ริมบึงธรรมชาติ Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9

#### แหล่งน้ำใหญ่กลางหุบเขานนทบุรี — Nonthaburi Lakeside Camp 1  
ธีม: ริมทะเลสาบ · จังหวัด: Nonthaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/nonthaburi-lakeside-camp-1-54/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหล่งน้ำใหญ่กลางหุบเขานนทบุรี  
  Minimal flat vector logo for a campsite "Nonthaburi Lakeside Camp 1" (แหล่งน้ำใหญ่กลางหุบเขานนทบุรี), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nonthaburi-lakeside-camp-1-54/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหล่งน้ำใหญ่กลางหุบเขานนทบุรี  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at แหล่งน้ำใหญ่กลางหุบเขา Nonthaburi Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/nonthaburi-lakeside-camp-1-54/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหล่งน้ำใหญ่กลางหุบเขานนทบุรี  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, แหล่งน้ำใหญ่กลางหุบเขา Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nonthaburi-lakeside-camp-1-54/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหล่งน้ำใหญ่กลางหุบเขานนทบุรี  
  signature hero view of Nonthaburi Lakeside Camp 1: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9

#### ริมแม่น้ำสายหลักนนทบุรี — Nonthaburi Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Nonthaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/nonthaburi-riverside-camp-2-55/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักนนทบุรี  
  Minimal flat vector logo for a campsite "Nonthaburi Riverside Camp 2" (ริมแม่น้ำสายหลักนนทบุรี), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nonthaburi-riverside-camp-2-55/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักนนทบุรี  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Nonthaburi Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/nonthaburi-riverside-camp-2-55/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักนนทบุรี  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nonthaburi-riverside-camp-2-55/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมแม่น้ำสายหลักนนทบุรี  
  signature hero view of Nonthaburi Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/nonthaburi-riverside-camp-2-55/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมแม่น้ำสายหลักนนทบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมแม่น้ำสายหลัก, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/nonthaburi-riverside-camp-2-55/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมแม่น้ำสายหลักนนทบุรี  
  close detail of the ริมน้ำ/ลำธาร surroundings at ริมแม่น้ำสายหลัก Nonthaburi (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9

#### ริมคลองร่มรื่นปทุมธานี — Pathum Thani Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Pathum Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/pathum-thani-riverside-camp-1-56/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นปทุมธานี  
  Minimal flat vector logo for a campsite "Pathum Thani Riverside Camp 1" (ริมคลองร่มรื่นปทุมธานี), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pathum-thani-riverside-camp-1-56/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นปทุมธานี  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Pathum Thani Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/pathum-thani-riverside-camp-1-56/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นปทุมธานี  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/pathum-thani-riverside-camp-1-56/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมคลองร่มรื่นปทุมธานี  
  signature hero view of Pathum Thani Riverside Camp 1: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/pathum-thani-riverside-camp-1-56/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมคลองร่มรื่นปทุมธานี  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมคลองร่มรื่น, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/pathum-thani-riverside-camp-1-56/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมคลองร่มรื่นปทุมธานี  
  close detail of the ริมน้ำ/ลำธาร surroundings at ริมคลองร่มรื่น Pathum Thani (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9

#### ชายป่าอนุรักษ์ปทุมธานี — Pathum Thani Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Pathum Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/pathum-thani-forest-camp-2-57/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์ปทุมธานี  
  Minimal flat vector logo for a campsite "Pathum Thani Forest Camp 2" (ชายป่าอนุรักษ์ปทุมธานี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pathum-thani-forest-camp-2-57/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์ปทุมธานี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Pathum Thani Thailand, misty early morning, photorealistic, highly detailed, 16:9

#### ชายป่าอนุรักษ์พระนครศรีอยุธยา — Phra Nakhon Si Ayutthaya Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Phra Nakhon Si Ayutthaya · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/phra-nakhon-si-ayutthaya-forest-camp-1-58/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์พระนครศรีอยุธยา  
  Minimal flat vector logo for a campsite "Phra Nakhon Si Ayutthaya Forest Camp 1" (ชายป่าอนุรักษ์พระนครศรีอยุธยา), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phra-nakhon-si-ayutthaya-forest-camp-1-58/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์พระนครศรีอยุธยา  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Phra Nakhon Si Ayutthaya Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/phra-nakhon-si-ayutthaya-forest-camp-1-58/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์พระนครศรีอยุธยา  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phra-nakhon-si-ayutthaya-forest-camp-1-58/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์พระนครศรีอยุธยา  
  signature hero view of Phra Nakhon Si Ayutthaya Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9

#### แนวป่าเขตรักษาพันธุ์พระนครศรีอยุธยา — Phra Nakhon Si Ayutthaya Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Phra Nakhon Si Ayutthaya · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/phra-nakhon-si-ayutthaya-forest-camp-2-59/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แนวป่าเขตรักษาพันธุ์พระนครศรีอยุธยา  
  Minimal flat vector logo for a campsite "Phra Nakhon Si Ayutthaya Forest Camp 2" (แนวป่าเขตรักษาพันธุ์พระนครศรีอยุธยา), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phra-nakhon-si-ayutthaya-forest-camp-2-59/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แนวป่าเขตรักษาพันธุ์พระนครศรีอยุธยา  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at แนวป่าเขตรักษาพันธุ์ Phra Nakhon Si Ayutthaya Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/phra-nakhon-si-ayutthaya-forest-camp-2-59/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แนวป่าเขตรักษาพันธุ์พระนครศรีอยุธยา  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, แนวป่าเขตรักษาพันธุ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phra-nakhon-si-ayutthaya-forest-camp-2-59/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แนวป่าเขตรักษาพันธุ์พระนครศรีอยุธยา  
  signature hero view of Phra Nakhon Si Ayutthaya Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/phra-nakhon-si-ayutthaya-forest-camp-2-59/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แนวป่าเขตรักษาพันธุ์พระนครศรีอยุธยา  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in แนวป่าเขตรักษาพันธุ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phra-nakhon-si-ayutthaya-forest-camp-2-59/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ แนวป่าเขตรักษาพันธุ์พระนครศรีอยุธยา  
  close detail of the ป่าลึก/ผจญภัย surroundings at แนวป่าเขตรักษาพันธุ์ Phra Nakhon Si Ayutthaya (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9

#### ริมคลองร่มรื่นอ่างทอง — Ang Thong Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Ang Thong · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/ang-thong-riverside-camp-1-60/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นอ่างทอง  
  Minimal flat vector logo for a campsite "Ang Thong Riverside Camp 1" (ริมคลองร่มรื่นอ่างทอง), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ang-thong-riverside-camp-1-60/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นอ่างทอง  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Ang Thong Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/ang-thong-riverside-camp-1-60/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นอ่างทอง  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/ang-thong-riverside-camp-1-60/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมคลองร่มรื่นอ่างทอง  
  signature hero view of Ang Thong Riverside Camp 1: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/ang-thong-riverside-camp-1-60/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมคลองร่มรื่นอ่างทอง  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมคลองร่มรื่น, warm evening glow, candid lifestyle photo, 16:9

#### ริมแม่น้ำสายหลักอ่างทอง — Ang Thong Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Ang Thong · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/ang-thong-riverside-camp-2-61/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักอ่างทอง  
  Minimal flat vector logo for a campsite "Ang Thong Riverside Camp 2" (ริมแม่น้ำสายหลักอ่างทอง), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ang-thong-riverside-camp-2-61/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักอ่างทอง  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Ang Thong Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/ang-thong-riverside-camp-2-61/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักอ่างทอง  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/ang-thong-riverside-camp-2-61/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมแม่น้ำสายหลักอ่างทอง  
  signature hero view of Ang Thong Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9

#### ต้นน้ำชานเมืองอ่างทอง — Ang Thong Riverside Camp 3  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Ang Thong · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/ang-thong-riverside-camp-3-62/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองอ่างทอง  
  Minimal flat vector logo for a campsite "Ang Thong Riverside Camp 3" (ต้นน้ำชานเมืองอ่างทอง), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ang-thong-riverside-camp-3-62/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองอ่างทอง  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Ang Thong Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9

#### ป่าเบญจพรรณชานเมืองลพบุรี — Lop Buri Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Lop Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/lop-buri-forest-camp-1-63/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองลพบุรี  
  Minimal flat vector logo for a campsite "Lop Buri Forest Camp 1" (ป่าเบญจพรรณชานเมืองลพบุรี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/lop-buri-forest-camp-1-63/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองลพบุรี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Lop Buri Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/lop-buri-forest-camp-1-63/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองลพบุรี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/lop-buri-forest-camp-1-63/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าเบญจพรรณชานเมืองลพบุรี  
  signature hero view of Lop Buri Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9

#### แนวป่าเขตรักษาพันธุ์ลพบุรี — Lop Buri Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Lop Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/lop-buri-forest-camp-2-64/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แนวป่าเขตรักษาพันธุ์ลพบุรี  
  Minimal flat vector logo for a campsite "Lop Buri Forest Camp 2" (แนวป่าเขตรักษาพันธุ์ลพบุรี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/lop-buri-forest-camp-2-64/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แนวป่าเขตรักษาพันธุ์ลพบุรี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at แนวป่าเขตรักษาพันธุ์ Lop Buri Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/lop-buri-forest-camp-2-64/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แนวป่าเขตรักษาพันธุ์ลพบุรี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, แนวป่าเขตรักษาพันธุ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/lop-buri-forest-camp-2-64/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แนวป่าเขตรักษาพันธุ์ลพบุรี  
  signature hero view of Lop Buri Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/lop-buri-forest-camp-2-64/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แนวป่าเขตรักษาพันธุ์ลพบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in แนวป่าเขตรักษาพันธุ์, warm evening glow, candid lifestyle photo, 16:9

#### แหล่งน้ำใหญ่กลางหุบเขาสิงห์บุรี — Sing Buri Lakeside Camp 1  
ธีม: ริมทะเลสาบ · จังหวัด: Sing Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/sing-buri-lakeside-camp-1-65/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหล่งน้ำใหญ่กลางหุบเขาสิงห์บุรี  
  Minimal flat vector logo for a campsite "Sing Buri Lakeside Camp 1" (แหล่งน้ำใหญ่กลางหุบเขาสิงห์บุรี), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sing-buri-lakeside-camp-1-65/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหล่งน้ำใหญ่กลางหุบเขาสิงห์บุรี  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at แหล่งน้ำใหญ่กลางหุบเขา Sing Buri Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/sing-buri-lakeside-camp-1-65/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหล่งน้ำใหญ่กลางหุบเขาสิงห์บุรี  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, แหล่งน้ำใหญ่กลางหุบเขา Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/sing-buri-lakeside-camp-1-65/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหล่งน้ำใหญ่กลางหุบเขาสิงห์บุรี  
  signature hero view of Sing Buri Lakeside Camp 1: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9

#### ป่าชุมชนใกล้เมืองสิงห์บุรี — Sing Buri Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Sing Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/sing-buri-forest-camp-2-66/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองสิงห์บุรี  
  Minimal flat vector logo for a campsite "Sing Buri Forest Camp 2" (ป่าชุมชนใกล้เมืองสิงห์บุรี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sing-buri-forest-camp-2-66/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองสิงห์บุรี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Sing Buri Thailand, misty early morning, photorealistic, highly detailed, 16:9

#### ริมคลองร่มรื่นชัยนาท — Chai Nat Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Chai Nat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/chai-nat-riverside-camp-1-67/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นชัยนาท  
  Minimal flat vector logo for a campsite "Chai Nat Riverside Camp 1" (ริมคลองร่มรื่นชัยนาท), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chai-nat-riverside-camp-1-67/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นชัยนาท  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Chai Nat Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/chai-nat-riverside-camp-1-67/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นชัยนาท  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chai-nat-riverside-camp-1-67/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมคลองร่มรื่นชัยนาท  
  signature hero view of Chai Nat Riverside Camp 1: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9

#### เนินหญ้าชายทุ่งชัยนาท — Chai Nat Meadow Camp 2  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Chai Nat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/chai-nat-meadow-camp-2-68/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เนินหญ้าชายทุ่งชัยนาท  
  Minimal flat vector logo for a campsite "Chai Nat Meadow Camp 2" (เนินหญ้าชายทุ่งชัยนาท), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chai-nat-meadow-camp-2-68/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เนินหญ้าชายทุ่งชัยนาท  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at เนินหญ้าชายทุ่ง Chai Nat Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/chai-nat-meadow-camp-2-68/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เนินหญ้าชายทุ่งชัยนาท  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, เนินหญ้าชายทุ่ง Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chai-nat-meadow-camp-2-68/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เนินหญ้าชายทุ่งชัยนาท  
  signature hero view of Chai Nat Meadow Camp 2: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9

#### ริมคลองร่มรื่นชัยนาท — Chai Nat Riverside Camp 3  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Chai Nat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/chai-nat-riverside-camp-3-69/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นชัยนาท  
  Minimal flat vector logo for a campsite "Chai Nat Riverside Camp 3" (ริมคลองร่มรื่นชัยนาท), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chai-nat-riverside-camp-3-69/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นชัยนาท  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Chai Nat Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/chai-nat-riverside-camp-3-69/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นชัยนาท  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chai-nat-riverside-camp-3-69/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมคลองร่มรื่นชัยนาท  
  signature hero view of Chai Nat Riverside Camp 3: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/chai-nat-riverside-camp-3-69/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมคลองร่มรื่นชัยนาท  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมคลองร่มรื่น, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/chai-nat-riverside-camp-3-69/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมคลองร่มรื่นชัยนาท  
  close detail of the ริมน้ำ/ลำธาร surroundings at ริมคลองร่มรื่น Chai Nat (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9

#### ริมคลองร่มรื่นสระบุรี — Saraburi Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Saraburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/saraburi-riverside-camp-1-70/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นสระบุรี  
  Minimal flat vector logo for a campsite "Saraburi Riverside Camp 1" (ริมคลองร่มรื่นสระบุรี), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/saraburi-riverside-camp-1-70/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นสระบุรี  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Saraburi Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/saraburi-riverside-camp-1-70/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นสระบุรี  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9

#### แนวป่าเขตรักษาพันธุ์สระบุรี — Saraburi Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Saraburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/saraburi-forest-camp-2-71/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แนวป่าเขตรักษาพันธุ์สระบุรี  
  Minimal flat vector logo for a campsite "Saraburi Forest Camp 2" (แนวป่าเขตรักษาพันธุ์สระบุรี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/saraburi-forest-camp-2-71/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แนวป่าเขตรักษาพันธุ์สระบุรี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at แนวป่าเขตรักษาพันธุ์ Saraburi Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/saraburi-forest-camp-2-71/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แนวป่าเขตรักษาพันธุ์สระบุรี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, แนวป่าเขตรักษาพันธุ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/saraburi-forest-camp-2-71/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แนวป่าเขตรักษาพันธุ์สระบุรี  
  signature hero view of Saraburi Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/saraburi-forest-camp-2-71/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แนวป่าเขตรักษาพันธุ์สระบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in แนวป่าเขตรักษาพันธุ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/saraburi-forest-camp-2-71/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ แนวป่าเขตรักษาพันธุ์สระบุรี  
  close detail of the ป่าลึก/ผจญภัย surroundings at แนวป่าเขตรักษาพันธุ์ Saraburi (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/saraburi-forest-camp-2-71/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง แนวป่าเขตรักษาพันธุ์สระบุรี  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at แนวป่าเขตรักษาพันธุ์, tents arranged on the ground, surrounding FORE and MTNS and WATF and SWMH and CAVE landscape, misty early morning, 16:9

#### ริมคลองร่มรื่นสระบุรี — Saraburi Riverside Camp 3  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Saraburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/saraburi-riverside-camp-3-72/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นสระบุรี  
  Minimal flat vector logo for a campsite "Saraburi Riverside Camp 3" (ริมคลองร่มรื่นสระบุรี), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/saraburi-riverside-camp-3-72/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นสระบุรี  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Saraburi Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/saraburi-riverside-camp-3-72/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นสระบุรี  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/saraburi-riverside-camp-3-72/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมคลองร่มรื่นสระบุรี  
  signature hero view of Saraburi Riverside Camp 3: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/saraburi-riverside-camp-3-72/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมคลองร่มรื่นสระบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมคลองร่มรื่น, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/saraburi-riverside-camp-3-72/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมคลองร่มรื่นสระบุรี  
  close detail of the ริมน้ำ/ลำธาร surroundings at ริมคลองร่มรื่น Saraburi (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/saraburi-riverside-camp-3-72/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ริมคลองร่มรื่นสระบุรี  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ริมคลองร่มรื่น, tents arranged on the ground, surrounding RIVE and FORE and WATF and SWMH landscape, soft morning light through trees, 16:9
- `/seed/camps/saraburi-riverside-camp-3-72/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ริมคลองร่มรื่นสระบุรี  
  night scene of Saraburi Riverside Camp 3, glowing tents and warm string lights at a ริมน้ำ/ลำธาร site in ริมคลองร่มรื่น, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ RGE — บริษัท ตะวันออกแคมป์ กรุ๊ป จำกัด (COMPANY)

#### แหลมหาดทรายชลบุรี — Chon Buri Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Chon Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/chon-buri-beachside-camp-1-73/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายชลบุรี  
  Minimal flat vector logo for a campsite "Chon Buri Beachside Camp 1" (แหลมหาดทรายชลบุรี), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chon-buri-beachside-camp-1-73/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายชลบุรี  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Chon Buri Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9

#### ชายป่าอนุรักษ์ชลบุรี — Chon Buri Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Chon Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/chon-buri-forest-camp-2-74/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์ชลบุรี  
  Minimal flat vector logo for a campsite "Chon Buri Forest Camp 2" (ชายป่าอนุรักษ์ชลบุรี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chon-buri-forest-camp-2-74/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์ชลบุรี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Chon Buri Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/chon-buri-forest-camp-2-74/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์ชลบุรี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chon-buri-forest-camp-2-74/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์ชลบุรี  
  signature hero view of Chon Buri Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/chon-buri-forest-camp-2-74/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์ชลบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/chon-buri-forest-camp-2-74/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ชายป่าอนุรักษ์ชลบุรี  
  close detail of the ป่าลึก/ผจญภัย surroundings at ชายป่าอนุรักษ์ Chon Buri (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9

#### อ่าวเล็กปลายแหลมระยอง — Rayong Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Rayong · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/rayong-beachside-camp-1-75/cover.jpg` (1:1, logo) — _alt:_ โลโก้ อ่าวเล็กปลายแหลมระยอง  
  Minimal flat vector logo for a campsite "Rayong Beachside Camp 1" (อ่าวเล็กปลายแหลมระยอง), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/rayong-beachside-camp-1-75/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง อ่าวเล็กปลายแหลมระยอง  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at อ่าวเล็กปลายแหลม Rayong Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/rayong-beachside-camp-1-75/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ อ่าวเล็กปลายแหลมระยอง  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, อ่าวเล็กปลายแหลม Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9

#### หาดชายฝั่งเงียบระยอง — Rayong Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Rayong · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/rayong-beachside-camp-2-76/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดชายฝั่งเงียบระยอง  
  Minimal flat vector logo for a campsite "Rayong Beachside Camp 2" (หาดชายฝั่งเงียบระยอง), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/rayong-beachside-camp-2-76/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดชายฝั่งเงียบระยอง  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดชายฝั่งเงียบ Rayong Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/rayong-beachside-camp-2-76/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดชายฝั่งเงียบระยอง  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดชายฝั่งเงียบ Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/rayong-beachside-camp-2-76/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น หาดชายฝั่งเงียบระยอง  
  signature hero view of Rayong Beachside Camp 2: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/rayong-beachside-camp-2-76/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ หาดชายฝั่งเงียบระยอง  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in หาดชายฝั่งเงียบ, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/rayong-beachside-camp-2-76/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ หาดชายฝั่งเงียบระยอง  
  close detail of the ริมทะเล/ชายหาด surroundings at หาดชายฝั่งเงียบ Rayong (BEAC+SEA+COAS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/rayong-beachside-camp-2-76/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง หาดชายฝั่งเงียบระยอง  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at หาดชายฝั่งเงียบ, tents arranged on the ground, surrounding BEAC and SEA and COAS landscape, warm sunset over the sea, 16:9

#### แหลมหาดทรายจันทบุรี — Chanthaburi Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Chanthaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/chanthaburi-beachside-camp-1-77/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายจันทบุรี  
  Minimal flat vector logo for a campsite "Chanthaburi Beachside Camp 1" (แหลมหาดทรายจันทบุรี), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chanthaburi-beachside-camp-1-77/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายจันทบุรี  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Chanthaburi Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/chanthaburi-beachside-camp-1-77/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหลมหาดทรายจันทบุรี  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, แหลมหาดทราย Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chanthaburi-beachside-camp-1-77/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหลมหาดทรายจันทบุรี  
  signature hero view of Chanthaburi Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/chanthaburi-beachside-camp-1-77/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แหลมหาดทรายจันทบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in แหลมหาดทราย, warm evening glow, candid lifestyle photo, 16:9

#### แหล่งน้ำใหญ่กลางหุบเขาจันทบุรี — Chanthaburi Lakeside Camp 2  
ธีม: ริมทะเลสาบ · จังหวัด: Chanthaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/chanthaburi-lakeside-camp-2-78/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหล่งน้ำใหญ่กลางหุบเขาจันทบุรี  
  Minimal flat vector logo for a campsite "Chanthaburi Lakeside Camp 2" (แหล่งน้ำใหญ่กลางหุบเขาจันทบุรี), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chanthaburi-lakeside-camp-2-78/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหล่งน้ำใหญ่กลางหุบเขาจันทบุรี  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at แหล่งน้ำใหญ่กลางหุบเขา Chanthaburi Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/chanthaburi-lakeside-camp-2-78/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหล่งน้ำใหญ่กลางหุบเขาจันทบุรี  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, แหล่งน้ำใหญ่กลางหุบเขา Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chanthaburi-lakeside-camp-2-78/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหล่งน้ำใหญ่กลางหุบเขาจันทบุรี  
  signature hero view of Chanthaburi Lakeside Camp 2: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/chanthaburi-lakeside-camp-2-78/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แหล่งน้ำใหญ่กลางหุบเขาจันทบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in แหล่งน้ำใหญ่กลางหุบเขา, warm evening glow, candid lifestyle photo, 16:9

#### ชายป่าอนุรักษ์จันทบุรี — Chanthaburi Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Chanthaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/chanthaburi-forest-camp-3-79/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์จันทบุรี  
  Minimal flat vector logo for a campsite "Chanthaburi Forest Camp 3" (ชายป่าอนุรักษ์จันทบุรี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chanthaburi-forest-camp-3-79/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์จันทบุรี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Chanthaburi Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/chanthaburi-forest-camp-3-79/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์จันทบุรี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chanthaburi-forest-camp-3-79/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์จันทบุรี  
  signature hero view of Chanthaburi Forest Camp 3: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/chanthaburi-forest-camp-3-79/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์จันทบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9

#### อ่าวเล็กปลายแหลมฉะเชิงเทรา — Chachoengsao Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Chachoengsao · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/chachoengsao-beachside-camp-1-80/cover.jpg` (1:1, logo) — _alt:_ โลโก้ อ่าวเล็กปลายแหลมฉะเชิงเทรา  
  Minimal flat vector logo for a campsite "Chachoengsao Beachside Camp 1" (อ่าวเล็กปลายแหลมฉะเชิงเทรา), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chachoengsao-beachside-camp-1-80/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง อ่าวเล็กปลายแหลมฉะเชิงเทรา  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at อ่าวเล็กปลายแหลม Chachoengsao Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/chachoengsao-beachside-camp-1-80/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ อ่าวเล็กปลายแหลมฉะเชิงเทรา  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, อ่าวเล็กปลายแหลม Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chachoengsao-beachside-camp-1-80/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น อ่าวเล็กปลายแหลมฉะเชิงเทรา  
  signature hero view of Chachoengsao Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9

#### ป่าชุมชนใกล้เมืองฉะเชิงเทรา — Chachoengsao Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Chachoengsao · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/chachoengsao-forest-camp-2-81/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองฉะเชิงเทรา  
  Minimal flat vector logo for a campsite "Chachoengsao Forest Camp 2" (ป่าชุมชนใกล้เมืองฉะเชิงเทรา), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chachoengsao-forest-camp-2-81/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองฉะเชิงเทรา  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Chachoengsao Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/chachoengsao-forest-camp-2-81/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าชุมชนใกล้เมืองฉะเชิงเทรา  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าชุมชนใกล้เมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chachoengsao-forest-camp-2-81/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าชุมชนใกล้เมืองฉะเชิงเทรา  
  signature hero view of Chachoengsao Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/chachoengsao-forest-camp-2-81/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าชุมชนใกล้เมืองฉะเชิงเทรา  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าชุมชนใกล้เมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/chachoengsao-forest-camp-2-81/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ป่าชุมชนใกล้เมืองฉะเชิงเทรา  
  close detail of the ป่าลึก/ผจญภัย surroundings at ป่าชุมชนใกล้เมือง Chachoengsao (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9

#### ริมแม่น้ำสายหลักฉะเชิงเทรา — Chachoengsao Riverside Camp 3  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Chachoengsao · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/chachoengsao-riverside-camp-3-82/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักฉะเชิงเทรา  
  Minimal flat vector logo for a campsite "Chachoengsao Riverside Camp 3" (ริมแม่น้ำสายหลักฉะเชิงเทรา), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chachoengsao-riverside-camp-3-82/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักฉะเชิงเทรา  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Chachoengsao Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/chachoengsao-riverside-camp-3-82/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักฉะเชิงเทรา  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9

#### ป่าเบญจพรรณชานเมืองปราจีนบุรี — Prachin Buri Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Prachin Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/prachin-buri-forest-camp-1-83/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองปราจีนบุรี  
  Minimal flat vector logo for a campsite "Prachin Buri Forest Camp 1" (ป่าเบญจพรรณชานเมืองปราจีนบุรี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/prachin-buri-forest-camp-1-83/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองปราจีนบุรี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Prachin Buri Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/prachin-buri-forest-camp-1-83/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองปราจีนบุรี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/prachin-buri-forest-camp-1-83/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าเบญจพรรณชานเมืองปราจีนบุรี  
  signature hero view of Prachin Buri Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/prachin-buri-forest-camp-1-83/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าเบญจพรรณชานเมืองปราจีนบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าเบญจพรรณชานเมือง, warm evening glow, candid lifestyle photo, 16:9

#### แหล่งน้ำใหญ่กลางหุบเขาปราจีนบุรี — Prachin Buri Lakeside Camp 2  
ธีม: ริมทะเลสาบ · จังหวัด: Prachin Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/prachin-buri-lakeside-camp-2-84/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหล่งน้ำใหญ่กลางหุบเขาปราจีนบุรี  
  Minimal flat vector logo for a campsite "Prachin Buri Lakeside Camp 2" (แหล่งน้ำใหญ่กลางหุบเขาปราจีนบุรี), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/prachin-buri-lakeside-camp-2-84/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหล่งน้ำใหญ่กลางหุบเขาปราจีนบุรี  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at แหล่งน้ำใหญ่กลางหุบเขา Prachin Buri Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/prachin-buri-lakeside-camp-2-84/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหล่งน้ำใหญ่กลางหุบเขาปราจีนบุรี  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, แหล่งน้ำใหญ่กลางหุบเขา Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/prachin-buri-lakeside-camp-2-84/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหล่งน้ำใหญ่กลางหุบเขาปราจีนบุรี  
  signature hero view of Prachin Buri Lakeside Camp 2: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/prachin-buri-lakeside-camp-2-84/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แหล่งน้ำใหญ่กลางหุบเขาปราจีนบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in แหล่งน้ำใหญ่กลางหุบเขา, warm evening glow, candid lifestyle photo, 16:9

### โฮสต์ RGC — อัครเดช ที่ราบกลาง (INDIVIDUAL)

#### ต้นน้ำชานเมืองนครนายก — Nakhon Nayok Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Nakhon Nayok · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/nakhon-nayok-riverside-camp-1-85/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองนครนายก  
  Minimal flat vector logo for a campsite "Nakhon Nayok Riverside Camp 1" (ต้นน้ำชานเมืองนครนายก), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-nayok-riverside-camp-1-85/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองนครนายก  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Nakhon Nayok Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-nayok-riverside-camp-1-85/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ต้นน้ำชานเมืองนครนายก  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ต้นน้ำชานเมือง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-nayok-riverside-camp-1-85/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ต้นน้ำชานเมืองนครนายก  
  signature hero view of Nakhon Nayok Riverside Camp 1: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/nakhon-nayok-riverside-camp-1-85/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ต้นน้ำชานเมืองนครนายก  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ต้นน้ำชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/nakhon-nayok-riverside-camp-1-85/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ต้นน้ำชานเมืองนครนายก  
  close detail of the ริมน้ำ/ลำธาร surroundings at ต้นน้ำชานเมือง Nakhon Nayok (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9

#### ริมบึงธรรมชาตินครนายก — Nakhon Nayok Lakeside Camp 2  
ธีม: ริมทะเลสาบ · จังหวัด: Nakhon Nayok · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/nakhon-nayok-lakeside-camp-2-86/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมบึงธรรมชาตินครนายก  
  Minimal flat vector logo for a campsite "Nakhon Nayok Lakeside Camp 2" (ริมบึงธรรมชาตินครนายก), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-nayok-lakeside-camp-2-86/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมบึงธรรมชาตินครนายก  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ริมบึงธรรมชาติ Nakhon Nayok Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-nayok-lakeside-camp-2-86/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมบึงธรรมชาตินครนายก  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ริมบึงธรรมชาติ Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-nayok-lakeside-camp-2-86/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมบึงธรรมชาตินครนายก  
  signature hero view of Nakhon Nayok Lakeside Camp 2: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/nakhon-nayok-lakeside-camp-2-86/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมบึงธรรมชาตินครนายก  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in ริมบึงธรรมชาติ, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/nakhon-nayok-lakeside-camp-2-86/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมบึงธรรมชาตินครนายก  
  close detail of the ริมทะเลสาบ surroundings at ริมบึงธรรมชาติ Nakhon Nayok (RIVE+FORE+LAKE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/nakhon-nayok-lakeside-camp-2-86/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ริมบึงธรรมชาตินครนายก  
  aerial drone top-down view of the ริมทะเลสาบ campsite at ริมบึงธรรมชาติ, tents arranged on the ground, surrounding RIVE and FORE and LAKE and WATF and SWMH landscape, still dawn with mist on the water, 16:9
- `/seed/camps/nakhon-nayok-lakeside-camp-2-86/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ริมบึงธรรมชาตินครนายก  
  night scene of Nakhon Nayok Lakeside Camp 2, glowing tents and warm string lights at a ริมทะเลสาบ site in ริมบึงธรรมชาติ, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ RGE — บริษัท ตะวันออกแคมป์ กรุ๊ป จำกัด (COMPANY)

#### ริมแม่น้ำสายหลักสระแก้ว — Sa Kaeo Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Sa Kaeo · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/sa-kaeo-riverside-camp-1-87/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักสระแก้ว  
  Minimal flat vector logo for a campsite "Sa Kaeo Riverside Camp 1" (ริมแม่น้ำสายหลักสระแก้ว), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sa-kaeo-riverside-camp-1-87/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักสระแก้ว  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Sa Kaeo Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9

#### ต้นน้ำชานเมืองสระแก้ว — Sa Kaeo Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Sa Kaeo · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/sa-kaeo-riverside-camp-2-88/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองสระแก้ว  
  Minimal flat vector logo for a campsite "Sa Kaeo Riverside Camp 2" (ต้นน้ำชานเมืองสระแก้ว), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sa-kaeo-riverside-camp-2-88/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองสระแก้ว  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Sa Kaeo Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9

#### ชายป่าอนุรักษ์สระแก้ว — Sa Kaeo Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Sa Kaeo · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/sa-kaeo-forest-camp-3-89/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์สระแก้ว  
  Minimal flat vector logo for a campsite "Sa Kaeo Forest Camp 3" (ชายป่าอนุรักษ์สระแก้ว), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sa-kaeo-forest-camp-3-89/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์สระแก้ว  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Sa Kaeo Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/sa-kaeo-forest-camp-3-89/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์สระแก้ว  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/sa-kaeo-forest-camp-3-89/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์สระแก้ว  
  signature hero view of Sa Kaeo Forest Camp 3: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/sa-kaeo-forest-camp-3-89/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์สระแก้ว  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/sa-kaeo-forest-camp-3-89/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ชายป่าอนุรักษ์สระแก้ว  
  close detail of the ป่าลึก/ผจญภัย surroundings at ชายป่าอนุรักษ์ Sa Kaeo (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/sa-kaeo-forest-camp-3-89/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ชายป่าอนุรักษ์สระแก้ว  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ชายป่าอนุรักษ์, tents arranged on the ground, surrounding FORE and MTNS and WATF and SWMH and CAVE landscape, misty early morning, 16:9

### โฮสต์ RGNE — ห้างหุ้นส่วนจำกัด อีสานฟาร์มสเตย์ (PARTNERSHIP)

#### ป่าเบญจพรรณชานเมืองบุรีรัมย์ — Buri Ram Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Buri Ram · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/buri-ram-forest-camp-1-90/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองบุรีรัมย์  
  Minimal flat vector logo for a campsite "Buri Ram Forest Camp 1" (ป่าเบญจพรรณชานเมืองบุรีรัมย์), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/buri-ram-forest-camp-1-90/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองบุรีรัมย์  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Buri Ram Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/buri-ram-forest-camp-1-90/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองบุรีรัมย์  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/buri-ram-forest-camp-1-90/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าเบญจพรรณชานเมืองบุรีรัมย์  
  signature hero view of Buri Ram Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/buri-ram-forest-camp-1-90/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าเบญจพรรณชานเมืองบุรีรัมย์  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าเบญจพรรณชานเมือง, warm evening glow, candid lifestyle photo, 16:9

#### แนวป่าเขตรักษาพันธุ์บุรีรัมย์ — Buri Ram Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Buri Ram · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/buri-ram-forest-camp-2-91/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แนวป่าเขตรักษาพันธุ์บุรีรัมย์  
  Minimal flat vector logo for a campsite "Buri Ram Forest Camp 2" (แนวป่าเขตรักษาพันธุ์บุรีรัมย์), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/buri-ram-forest-camp-2-91/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แนวป่าเขตรักษาพันธุ์บุรีรัมย์  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at แนวป่าเขตรักษาพันธุ์ Buri Ram Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/buri-ram-forest-camp-2-91/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แนวป่าเขตรักษาพันธุ์บุรีรัมย์  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, แนวป่าเขตรักษาพันธุ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/buri-ram-forest-camp-2-91/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แนวป่าเขตรักษาพันธุ์บุรีรัมย์  
  signature hero view of Buri Ram Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9

#### ทุ่งโล่งชานเมืองสุรินทร์ — Surin Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Surin · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/surin-meadow-camp-1-92/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งโล่งชานเมืองสุรินทร์  
  Minimal flat vector logo for a campsite "Surin Meadow Camp 1" (ทุ่งโล่งชานเมืองสุรินทร์), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/surin-meadow-camp-1-92/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งโล่งชานเมืองสุรินทร์  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ทุ่งโล่งชานเมือง Surin Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/surin-meadow-camp-1-92/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งโล่งชานเมืองสุรินทร์  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ทุ่งโล่งชานเมือง Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/surin-meadow-camp-1-92/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทุ่งโล่งชานเมืองสุรินทร์  
  signature hero view of Surin Meadow Camp 1: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9

#### ริมแม่น้ำสายหลักสุรินทร์ — Surin Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Surin · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/surin-riverside-camp-2-93/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักสุรินทร์  
  Minimal flat vector logo for a campsite "Surin Riverside Camp 2" (ริมแม่น้ำสายหลักสุรินทร์), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/surin-riverside-camp-2-93/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักสุรินทร์  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Surin Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/surin-riverside-camp-2-93/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักสุรินทร์  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/surin-riverside-camp-2-93/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมแม่น้ำสายหลักสุรินทร์  
  signature hero view of Surin Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/surin-riverside-camp-2-93/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมแม่น้ำสายหลักสุรินทร์  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมแม่น้ำสายหลัก, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/surin-riverside-camp-2-93/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมแม่น้ำสายหลักสุรินทร์  
  close detail of the ริมน้ำ/ลำธาร surroundings at ริมแม่น้ำสายหลัก Surin (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/surin-riverside-camp-2-93/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ริมแม่น้ำสายหลักสุรินทร์  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ริมแม่น้ำสายหลัก, tents arranged on the ground, surrounding RIVE and FORE and WATF and SWMH landscape, soft morning light through trees, 16:9
- `/seed/camps/surin-riverside-camp-2-93/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ริมแม่น้ำสายหลักสุรินทร์  
  night scene of Surin Riverside Camp 2, glowing tents and warm string lights at a ริมน้ำ/ลำธาร site in ริมแม่น้ำสายหลัก, starry sky, long exposure, cozy mood, 16:9

#### ทุ่งโล่งชานเมืองศรีสะเกษ — Si Sa Ket Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Si Sa Ket · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/si-sa-ket-meadow-camp-1-94/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งโล่งชานเมืองศรีสะเกษ  
  Minimal flat vector logo for a campsite "Si Sa Ket Meadow Camp 1" (ทุ่งโล่งชานเมืองศรีสะเกษ), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/si-sa-ket-meadow-camp-1-94/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งโล่งชานเมืองศรีสะเกษ  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ทุ่งโล่งชานเมือง Si Sa Ket Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/si-sa-ket-meadow-camp-1-94/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งโล่งชานเมืองศรีสะเกษ  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ทุ่งโล่งชานเมือง Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/si-sa-ket-meadow-camp-1-94/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทุ่งโล่งชานเมืองศรีสะเกษ  
  signature hero view of Si Sa Ket Meadow Camp 1: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9

#### เนินหญ้าชายทุ่งศรีสะเกษ — Si Sa Ket Meadow Camp 2  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Si Sa Ket · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/si-sa-ket-meadow-camp-2-95/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เนินหญ้าชายทุ่งศรีสะเกษ  
  Minimal flat vector logo for a campsite "Si Sa Ket Meadow Camp 2" (เนินหญ้าชายทุ่งศรีสะเกษ), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/si-sa-ket-meadow-camp-2-95/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เนินหญ้าชายทุ่งศรีสะเกษ  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at เนินหญ้าชายทุ่ง Si Sa Ket Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/si-sa-ket-meadow-camp-2-95/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เนินหญ้าชายทุ่งศรีสะเกษ  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, เนินหญ้าชายทุ่ง Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/si-sa-ket-meadow-camp-2-95/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เนินหญ้าชายทุ่งศรีสะเกษ  
  signature hero view of Si Sa Ket Meadow Camp 2: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9

#### ริมแม่น้ำสายหลักอุบลราชธานี — Ubon Ratchathani Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Ubon Ratchathani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/ubon-ratchathani-riverside-camp-1-96/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักอุบลราชธานี  
  Minimal flat vector logo for a campsite "Ubon Ratchathani Riverside Camp 1" (ริมแม่น้ำสายหลักอุบลราชธานี), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ubon-ratchathani-riverside-camp-1-96/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักอุบลราชธานี  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Ubon Ratchathani Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/ubon-ratchathani-riverside-camp-1-96/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักอุบลราชธานี  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9

#### ริมคลองร่มรื่นอุบลราชธานี — Ubon Ratchathani Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Ubon Ratchathani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/ubon-ratchathani-riverside-camp-2-97/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นอุบลราชธานี  
  Minimal flat vector logo for a campsite "Ubon Ratchathani Riverside Camp 2" (ริมคลองร่มรื่นอุบลราชธานี), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ubon-ratchathani-riverside-camp-2-97/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นอุบลราชธานี  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Ubon Ratchathani Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/ubon-ratchathani-riverside-camp-2-97/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นอุบลราชธานี  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/ubon-ratchathani-riverside-camp-2-97/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมคลองร่มรื่นอุบลราชธานี  
  signature hero view of Ubon Ratchathani Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/ubon-ratchathani-riverside-camp-2-97/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมคลองร่มรื่นอุบลราชธานี  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมคลองร่มรื่น, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/ubon-ratchathani-riverside-camp-2-97/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมคลองร่มรื่นอุบลราชธานี  
  close detail of the ริมน้ำ/ลำธาร surroundings at ริมคลองร่มรื่น Ubon Ratchathani (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/ubon-ratchathani-riverside-camp-2-97/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ริมคลองร่มรื่นอุบลราชธานี  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ริมคลองร่มรื่น, tents arranged on the ground, surrounding RIVE and FORE and WATF and SWMH landscape, soft morning light through trees, 16:9

#### ชายป่าอนุรักษ์ยโสธร — Yasothon Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Yasothon · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/yasothon-forest-camp-1-98/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์ยโสธร  
  Minimal flat vector logo for a campsite "Yasothon Forest Camp 1" (ชายป่าอนุรักษ์ยโสธร), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/yasothon-forest-camp-1-98/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์ยโสธร  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Yasothon Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/yasothon-forest-camp-1-98/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์ยโสธร  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/yasothon-forest-camp-1-98/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์ยโสธร  
  signature hero view of Yasothon Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/yasothon-forest-camp-1-98/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์ยโสธร  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/yasothon-forest-camp-1-98/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ชายป่าอนุรักษ์ยโสธร  
  close detail of the ป่าลึก/ผจญภัย surroundings at ชายป่าอนุรักษ์ Yasothon (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/yasothon-forest-camp-1-98/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ชายป่าอนุรักษ์ยโสธร  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ชายป่าอนุรักษ์, tents arranged on the ground, surrounding FORE and MTNS and WATF and SWMH and CAVE landscape, misty early morning, 16:9
- `/seed/camps/yasothon-forest-camp-1-98/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ชายป่าอนุรักษ์ยโสธร  
  night scene of Yasothon Forest Camp 1, glowing tents and warm string lights at a ป่าลึก/ผจญภัย site in ชายป่าอนุรักษ์, starry sky, long exposure, cozy mood, 16:9

#### ทุ่งกว้างริมหมู่บ้านยโสธร — Yasothon Meadow Camp 2  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Yasothon · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/yasothon-meadow-camp-2-99/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งกว้างริมหมู่บ้านยโสธร  
  Minimal flat vector logo for a campsite "Yasothon Meadow Camp 2" (ทุ่งกว้างริมหมู่บ้านยโสธร), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/yasothon-meadow-camp-2-99/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งกว้างริมหมู่บ้านยโสธร  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ทุ่งกว้างริมหมู่บ้าน Yasothon Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/yasothon-meadow-camp-2-99/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งกว้างริมหมู่บ้านยโสธร  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ทุ่งกว้างริมหมู่บ้าน Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/yasothon-meadow-camp-2-99/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทุ่งกว้างริมหมู่บ้านยโสธร  
  signature hero view of Yasothon Meadow Camp 2: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9

#### ชายป่าอนุรักษ์ยโสธร — Yasothon Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Yasothon · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/yasothon-forest-camp-3-100/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์ยโสธร  
  Minimal flat vector logo for a campsite "Yasothon Forest Camp 3" (ชายป่าอนุรักษ์ยโสธร), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/yasothon-forest-camp-3-100/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์ยโสธร  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Yasothon Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/yasothon-forest-camp-3-100/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์ยโสธร  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/yasothon-forest-camp-3-100/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์ยโสธร  
  signature hero view of Yasothon Forest Camp 3: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/yasothon-forest-camp-3-100/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์ยโสธร  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/yasothon-forest-camp-3-100/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ชายป่าอนุรักษ์ยโสธร  
  close detail of the ป่าลึก/ผจญภัย surroundings at ชายป่าอนุรักษ์ Yasothon (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/yasothon-forest-camp-3-100/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ชายป่าอนุรักษ์ยโสธร  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ชายป่าอนุรักษ์, tents arranged on the ground, surrounding FORE and MTNS and WATF and SWMH and CAVE landscape, misty early morning, 16:9

#### ริมคลองร่มรื่นชัยภูมิ — Chaiyaphum Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Chaiyaphum · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/chaiyaphum-riverside-camp-1-101/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นชัยภูมิ  
  Minimal flat vector logo for a campsite "Chaiyaphum Riverside Camp 1" (ริมคลองร่มรื่นชัยภูมิ), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chaiyaphum-riverside-camp-1-101/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นชัยภูมิ  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Chaiyaphum Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/chaiyaphum-riverside-camp-1-101/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นชัยภูมิ  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chaiyaphum-riverside-camp-1-101/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมคลองร่มรื่นชัยภูมิ  
  signature hero view of Chaiyaphum Riverside Camp 1: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/chaiyaphum-riverside-camp-1-101/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมคลองร่มรื่นชัยภูมิ  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมคลองร่มรื่น, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/chaiyaphum-riverside-camp-1-101/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมคลองร่มรื่นชัยภูมิ  
  close detail of the ริมน้ำ/ลำธาร surroundings at ริมคลองร่มรื่น Chaiyaphum (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/chaiyaphum-riverside-camp-1-101/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ริมคลองร่มรื่นชัยภูมิ  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ริมคลองร่มรื่น, tents arranged on the ground, surrounding RIVE and FORE and WATF and SWMH landscape, soft morning light through trees, 16:9
- `/seed/camps/chaiyaphum-riverside-camp-1-101/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ริมคลองร่มรื่นชัยภูมิ  
  night scene of Chaiyaphum Riverside Camp 1, glowing tents and warm string lights at a ริมน้ำ/ลำธาร site in ริมคลองร่มรื่น, starry sky, long exposure, cozy mood, 16:9

#### ป่าชุมชนใกล้เมืองชัยภูมิ — Chaiyaphum Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Chaiyaphum · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/chaiyaphum-forest-camp-2-102/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองชัยภูมิ  
  Minimal flat vector logo for a campsite "Chaiyaphum Forest Camp 2" (ป่าชุมชนใกล้เมืองชัยภูมิ), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chaiyaphum-forest-camp-2-102/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองชัยภูมิ  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Chaiyaphum Thailand, misty early morning, photorealistic, highly detailed, 16:9

#### แนวป่าเขตรักษาพันธุ์ชัยภูมิ — Chaiyaphum Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Chaiyaphum · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/chaiyaphum-forest-camp-3-103/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แนวป่าเขตรักษาพันธุ์ชัยภูมิ  
  Minimal flat vector logo for a campsite "Chaiyaphum Forest Camp 3" (แนวป่าเขตรักษาพันธุ์ชัยภูมิ), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chaiyaphum-forest-camp-3-103/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แนวป่าเขตรักษาพันธุ์ชัยภูมิ  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at แนวป่าเขตรักษาพันธุ์ Chaiyaphum Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/chaiyaphum-forest-camp-3-103/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แนวป่าเขตรักษาพันธุ์ชัยภูมิ  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, แนวป่าเขตรักษาพันธุ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chaiyaphum-forest-camp-3-103/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แนวป่าเขตรักษาพันธุ์ชัยภูมิ  
  signature hero view of Chaiyaphum Forest Camp 3: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/chaiyaphum-forest-camp-3-103/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แนวป่าเขตรักษาพันธุ์ชัยภูมิ  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in แนวป่าเขตรักษาพันธุ์, warm evening glow, candid lifestyle photo, 16:9

#### ริมคลองร่มรื่นอำนาจเจริญ — Amnat Charoen Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Amnat Charoen · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/amnat-charoen-riverside-camp-1-104/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นอำนาจเจริญ  
  Minimal flat vector logo for a campsite "Amnat Charoen Riverside Camp 1" (ริมคลองร่มรื่นอำนาจเจริญ), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/amnat-charoen-riverside-camp-1-104/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นอำนาจเจริญ  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Amnat Charoen Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/amnat-charoen-riverside-camp-1-104/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นอำนาจเจริญ  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/amnat-charoen-riverside-camp-1-104/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมคลองร่มรื่นอำนาจเจริญ  
  signature hero view of Amnat Charoen Riverside Camp 1: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/amnat-charoen-riverside-camp-1-104/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมคลองร่มรื่นอำนาจเจริญ  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมคลองร่มรื่น, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/amnat-charoen-riverside-camp-1-104/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมคลองร่มรื่นอำนาจเจริญ  
  close detail of the ริมน้ำ/ลำธาร surroundings at ริมคลองร่มรื่น Amnat Charoen (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/amnat-charoen-riverside-camp-1-104/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ริมคลองร่มรื่นอำนาจเจริญ  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ริมคลองร่มรื่น, tents arranged on the ground, surrounding RIVE and FORE and WATF and SWMH landscape, soft morning light through trees, 16:9
- `/seed/camps/amnat-charoen-riverside-camp-1-104/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ริมคลองร่มรื่นอำนาจเจริญ  
  night scene of Amnat Charoen Riverside Camp 1, glowing tents and warm string lights at a ริมน้ำ/ลำธาร site in ริมคลองร่มรื่น, starry sky, long exposure, cozy mood, 16:9

#### ป่าเบญจพรรณชานเมืองอำนาจเจริญ — Amnat Charoen Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Amnat Charoen · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/amnat-charoen-forest-camp-2-105/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองอำนาจเจริญ  
  Minimal flat vector logo for a campsite "Amnat Charoen Forest Camp 2" (ป่าเบญจพรรณชานเมืองอำนาจเจริญ), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/amnat-charoen-forest-camp-2-105/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองอำนาจเจริญ  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Amnat Charoen Thailand, misty early morning, photorealistic, highly detailed, 16:9

#### แนวป่าเขตรักษาพันธุ์บึงกาฬ — Bueng Kan Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Bueng Kan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/bueng-kan-forest-camp-1-106/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แนวป่าเขตรักษาพันธุ์บึงกาฬ  
  Minimal flat vector logo for a campsite "Bueng Kan Forest Camp 1" (แนวป่าเขตรักษาพันธุ์บึงกาฬ), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/bueng-kan-forest-camp-1-106/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แนวป่าเขตรักษาพันธุ์บึงกาฬ  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at แนวป่าเขตรักษาพันธุ์ Bueng Kan Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/bueng-kan-forest-camp-1-106/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แนวป่าเขตรักษาพันธุ์บึงกาฬ  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, แนวป่าเขตรักษาพันธุ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/bueng-kan-forest-camp-1-106/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แนวป่าเขตรักษาพันธุ์บึงกาฬ  
  signature hero view of Bueng Kan Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/bueng-kan-forest-camp-1-106/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แนวป่าเขตรักษาพันธุ์บึงกาฬ  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in แนวป่าเขตรักษาพันธุ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/bueng-kan-forest-camp-1-106/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ แนวป่าเขตรักษาพันธุ์บึงกาฬ  
  close detail of the ป่าลึก/ผจญภัย surroundings at แนวป่าเขตรักษาพันธุ์ Bueng Kan (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/bueng-kan-forest-camp-1-106/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง แนวป่าเขตรักษาพันธุ์บึงกาฬ  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at แนวป่าเขตรักษาพันธุ์, tents arranged on the ground, surrounding FORE and MTNS and WATF and SWMH and CAVE landscape, misty early morning, 16:9

#### ฝั่งลำธารชนบทบึงกาฬ — Bueng Kan Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Bueng Kan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/bueng-kan-riverside-camp-2-107/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ฝั่งลำธารชนบทบึงกาฬ  
  Minimal flat vector logo for a campsite "Bueng Kan Riverside Camp 2" (ฝั่งลำธารชนบทบึงกาฬ), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/bueng-kan-riverside-camp-2-107/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ฝั่งลำธารชนบทบึงกาฬ  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ฝั่งลำธารชนบท Bueng Kan Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/bueng-kan-riverside-camp-2-107/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ฝั่งลำธารชนบทบึงกาฬ  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ฝั่งลำธารชนบท Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/bueng-kan-riverside-camp-2-107/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ฝั่งลำธารชนบทบึงกาฬ  
  signature hero view of Bueng Kan Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9

#### ฝั่งลำธารชนบทหนองบัวลำภู — Nong Bua Lam Phu Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Nong Bua Lam Phu · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/nong-bua-lam-phu-riverside-camp-1-108/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ฝั่งลำธารชนบทหนองบัวลำภู  
  Minimal flat vector logo for a campsite "Nong Bua Lam Phu Riverside Camp 1" (ฝั่งลำธารชนบทหนองบัวลำภู), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nong-bua-lam-phu-riverside-camp-1-108/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ฝั่งลำธารชนบทหนองบัวลำภู  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ฝั่งลำธารชนบท Nong Bua Lam Phu Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/nong-bua-lam-phu-riverside-camp-1-108/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ฝั่งลำธารชนบทหนองบัวลำภู  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ฝั่งลำธารชนบท Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nong-bua-lam-phu-riverside-camp-1-108/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ฝั่งลำธารชนบทหนองบัวลำภู  
  signature hero view of Nong Bua Lam Phu Riverside Camp 1: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/nong-bua-lam-phu-riverside-camp-1-108/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ฝั่งลำธารชนบทหนองบัวลำภู  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ฝั่งลำธารชนบท, warm evening glow, candid lifestyle photo, 16:9

#### ต้นน้ำชานเมืองหนองบัวลำภู — Nong Bua Lam Phu Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Nong Bua Lam Phu · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/nong-bua-lam-phu-riverside-camp-2-109/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองหนองบัวลำภู  
  Minimal flat vector logo for a campsite "Nong Bua Lam Phu Riverside Camp 2" (ต้นน้ำชานเมืองหนองบัวลำภู), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nong-bua-lam-phu-riverside-camp-2-109/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองหนองบัวลำภู  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Nong Bua Lam Phu Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9

#### ทุ่งกว้างริมหมู่บ้านขอนแก่น — Khon Kaen Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Khon Kaen · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/khon-kaen-meadow-camp-1-110/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งกว้างริมหมู่บ้านขอนแก่น  
  Minimal flat vector logo for a campsite "Khon Kaen Meadow Camp 1" (ทุ่งกว้างริมหมู่บ้านขอนแก่น), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/khon-kaen-meadow-camp-1-110/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งกว้างริมหมู่บ้านขอนแก่น  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ทุ่งกว้างริมหมู่บ้าน Khon Kaen Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/khon-kaen-meadow-camp-1-110/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งกว้างริมหมู่บ้านขอนแก่น  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ทุ่งกว้างริมหมู่บ้าน Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/khon-kaen-meadow-camp-1-110/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทุ่งกว้างริมหมู่บ้านขอนแก่น  
  signature hero view of Khon Kaen Meadow Camp 1: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/khon-kaen-meadow-camp-1-110/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ทุ่งกว้างริมหมู่บ้านขอนแก่น  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ทุ่งกว้างริมหมู่บ้าน, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/khon-kaen-meadow-camp-1-110/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ทุ่งกว้างริมหมู่บ้านขอนแก่น  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at ทุ่งกว้างริมหมู่บ้าน Khon Kaen (MTNS+FORE+FILD+FARM terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/khon-kaen-meadow-camp-1-110/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ทุ่งกว้างริมหมู่บ้านขอนแก่น  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at ทุ่งกว้างริมหมู่บ้าน, tents arranged on the ground, surrounding MTNS and FORE and FILD and FARM landscape, clear starry night, 16:9
- `/seed/camps/khon-kaen-meadow-camp-1-110/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ทุ่งกว้างริมหมู่บ้านขอนแก่น  
  night scene of Khon Kaen Meadow Camp 1, glowing tents and warm string lights at a ทุ่งหญ้า/ชมดาว site in ทุ่งกว้างริมหมู่บ้าน, starry sky, long exposure, cozy mood, 16:9

#### ป่าชุมชนใกล้เมืองขอนแก่น — Khon Kaen Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Khon Kaen · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/khon-kaen-forest-camp-2-111/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองขอนแก่น  
  Minimal flat vector logo for a campsite "Khon Kaen Forest Camp 2" (ป่าชุมชนใกล้เมืองขอนแก่น), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/khon-kaen-forest-camp-2-111/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองขอนแก่น  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Khon Kaen Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/khon-kaen-forest-camp-2-111/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าชุมชนใกล้เมืองขอนแก่น  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าชุมชนใกล้เมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9

#### เนินหญ้าชายทุ่งขอนแก่น — Khon Kaen Meadow Camp 3  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Khon Kaen · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/khon-kaen-meadow-camp-3-112/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เนินหญ้าชายทุ่งขอนแก่น  
  Minimal flat vector logo for a campsite "Khon Kaen Meadow Camp 3" (เนินหญ้าชายทุ่งขอนแก่น), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/khon-kaen-meadow-camp-3-112/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เนินหญ้าชายทุ่งขอนแก่น  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at เนินหญ้าชายทุ่ง Khon Kaen Thailand, clear starry night, photorealistic, highly detailed, 16:9

#### เนินหญ้าชายทุ่งอุดรธานี — Udon Thani Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Udon Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/udon-thani-meadow-camp-1-113/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เนินหญ้าชายทุ่งอุดรธานี  
  Minimal flat vector logo for a campsite "Udon Thani Meadow Camp 1" (เนินหญ้าชายทุ่งอุดรธานี), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/udon-thani-meadow-camp-1-113/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เนินหญ้าชายทุ่งอุดรธานี  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at เนินหญ้าชายทุ่ง Udon Thani Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/udon-thani-meadow-camp-1-113/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เนินหญ้าชายทุ่งอุดรธานี  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, เนินหญ้าชายทุ่ง Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/udon-thani-meadow-camp-1-113/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เนินหญ้าชายทุ่งอุดรธานี  
  signature hero view of Udon Thani Meadow Camp 1: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9

#### เนินหญ้าชายทุ่งอุดรธานี — Udon Thani Meadow Camp 2  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Udon Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/udon-thani-meadow-camp-2-114/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เนินหญ้าชายทุ่งอุดรธานี  
  Minimal flat vector logo for a campsite "Udon Thani Meadow Camp 2" (เนินหญ้าชายทุ่งอุดรธานี), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/udon-thani-meadow-camp-2-114/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เนินหญ้าชายทุ่งอุดรธานี  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at เนินหญ้าชายทุ่ง Udon Thani Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/udon-thani-meadow-camp-2-114/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เนินหญ้าชายทุ่งอุดรธานี  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, เนินหญ้าชายทุ่ง Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/udon-thani-meadow-camp-2-114/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เนินหญ้าชายทุ่งอุดรธานี  
  signature hero view of Udon Thani Meadow Camp 2: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/udon-thani-meadow-camp-2-114/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ เนินหญ้าชายทุ่งอุดรธานี  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in เนินหญ้าชายทุ่ง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/udon-thani-meadow-camp-2-114/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ เนินหญ้าชายทุ่งอุดรธานี  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at เนินหญ้าชายทุ่ง Udon Thani (MTNS+FORE+FILD+FARM terrain), natural textures and foliage, soft light, 16:9

#### ฝั่งลำธารชนบทอุดรธานี — Udon Thani Riverside Camp 3  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Udon Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/udon-thani-riverside-camp-3-115/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ฝั่งลำธารชนบทอุดรธานี  
  Minimal flat vector logo for a campsite "Udon Thani Riverside Camp 3" (ฝั่งลำธารชนบทอุดรธานี), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/udon-thani-riverside-camp-3-115/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ฝั่งลำธารชนบทอุดรธานี  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ฝั่งลำธารชนบท Udon Thani Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/udon-thani-riverside-camp-3-115/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ฝั่งลำธารชนบทอุดรธานี  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ฝั่งลำธารชนบท Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/udon-thani-riverside-camp-3-115/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ฝั่งลำธารชนบทอุดรธานี  
  signature hero view of Udon Thani Riverside Camp 3: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/udon-thani-riverside-camp-3-115/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ฝั่งลำธารชนบทอุดรธานี  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ฝั่งลำธารชนบท, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/udon-thani-riverside-camp-3-115/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ฝั่งลำธารชนบทอุดรธานี  
  close detail of the ริมน้ำ/ลำธาร surroundings at ฝั่งลำธารชนบท Udon Thani (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9

#### เนินหญ้าชายทุ่งหนองคาย — Nong Khai Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Nong Khai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/nong-khai-meadow-camp-1-116/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เนินหญ้าชายทุ่งหนองคาย  
  Minimal flat vector logo for a campsite "Nong Khai Meadow Camp 1" (เนินหญ้าชายทุ่งหนองคาย), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nong-khai-meadow-camp-1-116/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เนินหญ้าชายทุ่งหนองคาย  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at เนินหญ้าชายทุ่ง Nong Khai Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/nong-khai-meadow-camp-1-116/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เนินหญ้าชายทุ่งหนองคาย  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, เนินหญ้าชายทุ่ง Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nong-khai-meadow-camp-1-116/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เนินหญ้าชายทุ่งหนองคาย  
  signature hero view of Nong Khai Meadow Camp 1: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9

#### ชายป่าอนุรักษ์หนองคาย — Nong Khai Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Nong Khai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/nong-khai-forest-camp-2-117/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์หนองคาย  
  Minimal flat vector logo for a campsite "Nong Khai Forest Camp 2" (ชายป่าอนุรักษ์หนองคาย), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nong-khai-forest-camp-2-117/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์หนองคาย  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Nong Khai Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/nong-khai-forest-camp-2-117/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์หนองคาย  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nong-khai-forest-camp-2-117/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์หนองคาย  
  signature hero view of Nong Khai Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/nong-khai-forest-camp-2-117/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์หนองคาย  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/nong-khai-forest-camp-2-117/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ชายป่าอนุรักษ์หนองคาย  
  close detail of the ป่าลึก/ผจญภัย surroundings at ชายป่าอนุรักษ์ Nong Khai (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/nong-khai-forest-camp-2-117/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ชายป่าอนุรักษ์หนองคาย  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ชายป่าอนุรักษ์, tents arranged on the ground, surrounding FORE and MTNS and WATF and SWMH and CAVE landscape, misty early morning, 16:9

#### ทุ่งโล่งชานเมืองหนองคาย — Nong Khai Meadow Camp 3  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Nong Khai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/nong-khai-meadow-camp-3-118/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งโล่งชานเมืองหนองคาย  
  Minimal flat vector logo for a campsite "Nong Khai Meadow Camp 3" (ทุ่งโล่งชานเมืองหนองคาย), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nong-khai-meadow-camp-3-118/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งโล่งชานเมืองหนองคาย  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ทุ่งโล่งชานเมือง Nong Khai Thailand, clear starry night, photorealistic, highly detailed, 16:9

#### ทุ่งกว้างริมหมู่บ้านมหาสารคาม — Maha Sarakham Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Maha Sarakham · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/maha-sarakham-meadow-camp-1-119/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งกว้างริมหมู่บ้านมหาสารคาม  
  Minimal flat vector logo for a campsite "Maha Sarakham Meadow Camp 1" (ทุ่งกว้างริมหมู่บ้านมหาสารคาม), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/maha-sarakham-meadow-camp-1-119/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งกว้างริมหมู่บ้านมหาสารคาม  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ทุ่งกว้างริมหมู่บ้าน Maha Sarakham Thailand, clear starry night, photorealistic, highly detailed, 16:9

#### ป่าเบญจพรรณชานเมืองมหาสารคาม — Maha Sarakham Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Maha Sarakham · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/maha-sarakham-forest-camp-2-120/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองมหาสารคาม  
  Minimal flat vector logo for a campsite "Maha Sarakham Forest Camp 2" (ป่าเบญจพรรณชานเมืองมหาสารคาม), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/maha-sarakham-forest-camp-2-120/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองมหาสารคาม  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Maha Sarakham Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/maha-sarakham-forest-camp-2-120/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองมหาสารคาม  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/maha-sarakham-forest-camp-2-120/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าเบญจพรรณชานเมืองมหาสารคาม  
  signature hero view of Maha Sarakham Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9

#### ป่าชุมชนใกล้เมืองมหาสารคาม — Maha Sarakham Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Maha Sarakham · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/maha-sarakham-forest-camp-3-121/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองมหาสารคาม  
  Minimal flat vector logo for a campsite "Maha Sarakham Forest Camp 3" (ป่าชุมชนใกล้เมืองมหาสารคาม), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/maha-sarakham-forest-camp-3-121/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองมหาสารคาม  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Maha Sarakham Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/maha-sarakham-forest-camp-3-121/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าชุมชนใกล้เมืองมหาสารคาม  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าชุมชนใกล้เมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9

#### เนินหญ้าชายทุ่งร้อยเอ็ด — Roi Et Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Roi Et · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/roi-et-meadow-camp-1-122/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เนินหญ้าชายทุ่งร้อยเอ็ด  
  Minimal flat vector logo for a campsite "Roi Et Meadow Camp 1" (เนินหญ้าชายทุ่งร้อยเอ็ด), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/roi-et-meadow-camp-1-122/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เนินหญ้าชายทุ่งร้อยเอ็ด  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at เนินหญ้าชายทุ่ง Roi Et Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/roi-et-meadow-camp-1-122/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เนินหญ้าชายทุ่งร้อยเอ็ด  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, เนินหญ้าชายทุ่ง Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/roi-et-meadow-camp-1-122/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เนินหญ้าชายทุ่งร้อยเอ็ด  
  signature hero view of Roi Et Meadow Camp 1: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/roi-et-meadow-camp-1-122/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ เนินหญ้าชายทุ่งร้อยเอ็ด  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in เนินหญ้าชายทุ่ง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/roi-et-meadow-camp-1-122/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ เนินหญ้าชายทุ่งร้อยเอ็ด  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at เนินหญ้าชายทุ่ง Roi Et (MTNS+FORE+FILD+FARM terrain), natural textures and foliage, soft light, 16:9

#### ป่าเบญจพรรณชานเมืองร้อยเอ็ด — Roi Et Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Roi Et · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/roi-et-forest-camp-2-123/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองร้อยเอ็ด  
  Minimal flat vector logo for a campsite "Roi Et Forest Camp 2" (ป่าเบญจพรรณชานเมืองร้อยเอ็ด), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/roi-et-forest-camp-2-123/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองร้อยเอ็ด  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Roi Et Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/roi-et-forest-camp-2-123/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองร้อยเอ็ด  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/roi-et-forest-camp-2-123/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าเบญจพรรณชานเมืองร้อยเอ็ด  
  signature hero view of Roi Et Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/roi-et-forest-camp-2-123/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าเบญจพรรณชานเมืองร้อยเอ็ด  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าเบญจพรรณชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/roi-et-forest-camp-2-123/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ป่าเบญจพรรณชานเมืองร้อยเอ็ด  
  close detail of the ป่าลึก/ผจญภัย surroundings at ป่าเบญจพรรณชานเมือง Roi Et (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9

#### ป่าเบญจพรรณชานเมืองร้อยเอ็ด — Roi Et Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Roi Et · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/roi-et-forest-camp-3-124/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองร้อยเอ็ด  
  Minimal flat vector logo for a campsite "Roi Et Forest Camp 3" (ป่าเบญจพรรณชานเมืองร้อยเอ็ด), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/roi-et-forest-camp-3-124/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองร้อยเอ็ด  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Roi Et Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/roi-et-forest-camp-3-124/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองร้อยเอ็ด  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/roi-et-forest-camp-3-124/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าเบญจพรรณชานเมืองร้อยเอ็ด  
  signature hero view of Roi Et Forest Camp 3: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9

#### ที่ราบเชิงเขากาฬสินธุ์ — Kalasin Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Kalasin · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/kalasin-meadow-camp-1-125/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ที่ราบเชิงเขากาฬสินธุ์  
  Minimal flat vector logo for a campsite "Kalasin Meadow Camp 1" (ที่ราบเชิงเขากาฬสินธุ์), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/kalasin-meadow-camp-1-125/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ที่ราบเชิงเขากาฬสินธุ์  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ที่ราบเชิงเขา Kalasin Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/kalasin-meadow-camp-1-125/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ที่ราบเชิงเขากาฬสินธุ์  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ที่ราบเชิงเขา Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/kalasin-meadow-camp-1-125/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ที่ราบเชิงเขากาฬสินธุ์  
  signature hero view of Kalasin Meadow Camp 1: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9

#### ชายป่าอนุรักษ์กาฬสินธุ์ — Kalasin Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Kalasin · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/kalasin-forest-camp-2-126/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์กาฬสินธุ์  
  Minimal flat vector logo for a campsite "Kalasin Forest Camp 2" (ชายป่าอนุรักษ์กาฬสินธุ์), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/kalasin-forest-camp-2-126/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์กาฬสินธุ์  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Kalasin Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/kalasin-forest-camp-2-126/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์กาฬสินธุ์  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/kalasin-forest-camp-2-126/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์กาฬสินธุ์  
  signature hero view of Kalasin Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/kalasin-forest-camp-2-126/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์กาฬสินธุ์  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/kalasin-forest-camp-2-126/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ชายป่าอนุรักษ์กาฬสินธุ์  
  close detail of the ป่าลึก/ผจญภัย surroundings at ชายป่าอนุรักษ์ Kalasin (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/kalasin-forest-camp-2-126/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ชายป่าอนุรักษ์กาฬสินธุ์  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ชายป่าอนุรักษ์, tents arranged on the ground, surrounding FORE and MTNS and WATF and SWMH and CAVE landscape, misty early morning, 16:9

#### ที่ราบเชิงเขาสกลนคร — Sakon Nakhon Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Sakon Nakhon · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/sakon-nakhon-meadow-camp-1-127/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ที่ราบเชิงเขาสกลนคร  
  Minimal flat vector logo for a campsite "Sakon Nakhon Meadow Camp 1" (ที่ราบเชิงเขาสกลนคร), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sakon-nakhon-meadow-camp-1-127/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ที่ราบเชิงเขาสกลนคร  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ที่ราบเชิงเขา Sakon Nakhon Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/sakon-nakhon-meadow-camp-1-127/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ที่ราบเชิงเขาสกลนคร  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ที่ราบเชิงเขา Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9

#### ริมคลองร่มรื่นสกลนคร — Sakon Nakhon Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Sakon Nakhon · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/sakon-nakhon-riverside-camp-2-128/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นสกลนคร  
  Minimal flat vector logo for a campsite "Sakon Nakhon Riverside Camp 2" (ริมคลองร่มรื่นสกลนคร), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sakon-nakhon-riverside-camp-2-128/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นสกลนคร  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Sakon Nakhon Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/sakon-nakhon-riverside-camp-2-128/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นสกลนคร  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/sakon-nakhon-riverside-camp-2-128/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมคลองร่มรื่นสกลนคร  
  signature hero view of Sakon Nakhon Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/sakon-nakhon-riverside-camp-2-128/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมคลองร่มรื่นสกลนคร  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมคลองร่มรื่น, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/sakon-nakhon-riverside-camp-2-128/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมคลองร่มรื่นสกลนคร  
  close detail of the ริมน้ำ/ลำธาร surroundings at ริมคลองร่มรื่น Sakon Nakhon (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9

#### ชายป่าอนุรักษ์นครพนม — Nakhon Phanom Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Nakhon Phanom · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/nakhon-phanom-forest-camp-1-129/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์นครพนม  
  Minimal flat vector logo for a campsite "Nakhon Phanom Forest Camp 1" (ชายป่าอนุรักษ์นครพนม), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-phanom-forest-camp-1-129/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์นครพนม  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Nakhon Phanom Thailand, misty early morning, photorealistic, highly detailed, 16:9

#### ต้นน้ำชานเมืองนครพนม — Nakhon Phanom Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Nakhon Phanom · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/nakhon-phanom-riverside-camp-2-130/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองนครพนม  
  Minimal flat vector logo for a campsite "Nakhon Phanom Riverside Camp 2" (ต้นน้ำชานเมืองนครพนม), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-phanom-riverside-camp-2-130/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองนครพนม  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Nakhon Phanom Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-phanom-riverside-camp-2-130/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ต้นน้ำชานเมืองนครพนม  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ต้นน้ำชานเมือง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-phanom-riverside-camp-2-130/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ต้นน้ำชานเมืองนครพนม  
  signature hero view of Nakhon Phanom Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/nakhon-phanom-riverside-camp-2-130/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ต้นน้ำชานเมืองนครพนม  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ต้นน้ำชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/nakhon-phanom-riverside-camp-2-130/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ต้นน้ำชานเมืองนครพนม  
  close detail of the ริมน้ำ/ลำธาร surroundings at ต้นน้ำชานเมือง Nakhon Phanom (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9

#### เนินหญ้าชายทุ่งมุกดาหาร — Mukdahan Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Mukdahan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/mukdahan-meadow-camp-1-131/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เนินหญ้าชายทุ่งมุกดาหาร  
  Minimal flat vector logo for a campsite "Mukdahan Meadow Camp 1" (เนินหญ้าชายทุ่งมุกดาหาร), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/mukdahan-meadow-camp-1-131/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เนินหญ้าชายทุ่งมุกดาหาร  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at เนินหญ้าชายทุ่ง Mukdahan Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/mukdahan-meadow-camp-1-131/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เนินหญ้าชายทุ่งมุกดาหาร  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, เนินหญ้าชายทุ่ง Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/mukdahan-meadow-camp-1-131/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เนินหญ้าชายทุ่งมุกดาหาร  
  signature hero view of Mukdahan Meadow Camp 1: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9

#### ที่ราบเชิงเขามุกดาหาร — Mukdahan Meadow Camp 2  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Mukdahan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/mukdahan-meadow-camp-2-132/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ที่ราบเชิงเขามุกดาหาร  
  Minimal flat vector logo for a campsite "Mukdahan Meadow Camp 2" (ที่ราบเชิงเขามุกดาหาร), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/mukdahan-meadow-camp-2-132/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ที่ราบเชิงเขามุกดาหาร  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ที่ราบเชิงเขา Mukdahan Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/mukdahan-meadow-camp-2-132/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ที่ราบเชิงเขามุกดาหาร  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ที่ราบเชิงเขา Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/mukdahan-meadow-camp-2-132/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ที่ราบเชิงเขามุกดาหาร  
  signature hero view of Mukdahan Meadow Camp 2: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/mukdahan-meadow-camp-2-132/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ที่ราบเชิงเขามุกดาหาร  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ที่ราบเชิงเขา, warm evening glow, candid lifestyle photo, 16:9

#### แนวป่าเขตรักษาพันธุ์มุกดาหาร — Mukdahan Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Mukdahan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/mukdahan-forest-camp-3-133/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แนวป่าเขตรักษาพันธุ์มุกดาหาร  
  Minimal flat vector logo for a campsite "Mukdahan Forest Camp 3" (แนวป่าเขตรักษาพันธุ์มุกดาหาร), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/mukdahan-forest-camp-3-133/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แนวป่าเขตรักษาพันธุ์มุกดาหาร  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at แนวป่าเขตรักษาพันธุ์ Mukdahan Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/mukdahan-forest-camp-3-133/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แนวป่าเขตรักษาพันธุ์มุกดาหาร  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, แนวป่าเขตรักษาพันธุ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/mukdahan-forest-camp-3-133/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แนวป่าเขตรักษาพันธุ์มุกดาหาร  
  signature hero view of Mukdahan Forest Camp 3: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9

### โฮสต์ RGN — บริษัท ภาคเหนือแคมป์ปิ้ง เน็ตเวิร์ก จำกัด (COMPANY)

#### ยอดดอยเงียบสงบลำพูน — Lamphun Misty Highland Camp 1  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Lamphun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/lamphun-misty-highland-camp-1-134/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ยอดดอยเงียบสงบลำพูน  
  Minimal flat vector logo for a campsite "Lamphun Misty Highland Camp 1" (ยอดดอยเงียบสงบลำพูน), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/lamphun-misty-highland-camp-1-134/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ยอดดอยเงียบสงบลำพูน  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ยอดดอยเงียบสงบ Lamphun Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9

#### ต้นน้ำชานเมืองลำพูน — Lamphun Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Lamphun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/lamphun-riverside-camp-2-135/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองลำพูน  
  Minimal flat vector logo for a campsite "Lamphun Riverside Camp 2" (ต้นน้ำชานเมืองลำพูน), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/lamphun-riverside-camp-2-135/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองลำพูน  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Lamphun Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/lamphun-riverside-camp-2-135/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ต้นน้ำชานเมืองลำพูน  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ต้นน้ำชานเมือง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/lamphun-riverside-camp-2-135/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ต้นน้ำชานเมืองลำพูน  
  signature hero view of Lamphun Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/lamphun-riverside-camp-2-135/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ต้นน้ำชานเมืองลำพูน  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ต้นน้ำชานเมือง, warm evening glow, candid lifestyle photo, 16:9

#### ยอดดอยเงียบสงบลำปาง — Lampang Misty Highland Camp 1  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Lampang · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/lampang-misty-highland-camp-1-136/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ยอดดอยเงียบสงบลำปาง  
  Minimal flat vector logo for a campsite "Lampang Misty Highland Camp 1" (ยอดดอยเงียบสงบลำปาง), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/lampang-misty-highland-camp-1-136/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ยอดดอยเงียบสงบลำปาง  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ยอดดอยเงียบสงบ Lampang Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/lampang-misty-highland-camp-1-136/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ยอดดอยเงียบสงบลำปาง  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ยอดดอยเงียบสงบ Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/lampang-misty-highland-camp-1-136/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ยอดดอยเงียบสงบลำปาง  
  signature hero view of Lampang Misty Highland Camp 1: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/lampang-misty-highland-camp-1-136/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ยอดดอยเงียบสงบลำปาง  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in ยอดดอยเงียบสงบ, warm evening glow, candid lifestyle photo, 16:9

#### ริมแม่น้ำสายหลักลำปาง — Lampang Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Lampang · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/lampang-riverside-camp-2-137/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักลำปาง  
  Minimal flat vector logo for a campsite "Lampang Riverside Camp 2" (ริมแม่น้ำสายหลักลำปาง), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/lampang-riverside-camp-2-137/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักลำปาง  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Lampang Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/lampang-riverside-camp-2-137/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักลำปาง  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/lampang-riverside-camp-2-137/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมแม่น้ำสายหลักลำปาง  
  signature hero view of Lampang Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/lampang-riverside-camp-2-137/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมแม่น้ำสายหลักลำปาง  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมแม่น้ำสายหลัก, warm evening glow, candid lifestyle photo, 16:9

#### ชายป่าอนุรักษ์ลำปาง — Lampang Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Lampang · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/lampang-forest-camp-3-138/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์ลำปาง  
  Minimal flat vector logo for a campsite "Lampang Forest Camp 3" (ชายป่าอนุรักษ์ลำปาง), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/lampang-forest-camp-3-138/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์ลำปาง  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Lampang Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/lampang-forest-camp-3-138/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์ลำปาง  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9

#### ชายป่าอนุรักษ์อุตรดิตถ์ — Uttaradit Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Uttaradit · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/uttaradit-forest-camp-1-139/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์อุตรดิตถ์  
  Minimal flat vector logo for a campsite "Uttaradit Forest Camp 1" (ชายป่าอนุรักษ์อุตรดิตถ์), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/uttaradit-forest-camp-1-139/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์อุตรดิตถ์  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Uttaradit Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/uttaradit-forest-camp-1-139/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์อุตรดิตถ์  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/uttaradit-forest-camp-1-139/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์อุตรดิตถ์  
  signature hero view of Uttaradit Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/uttaradit-forest-camp-1-139/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์อุตรดิตถ์  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/uttaradit-forest-camp-1-139/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ชายป่าอนุรักษ์อุตรดิตถ์  
  close detail of the ป่าลึก/ผจญภัย surroundings at ชายป่าอนุรักษ์ Uttaradit (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/uttaradit-forest-camp-1-139/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ชายป่าอนุรักษ์อุตรดิตถ์  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ชายป่าอนุรักษ์, tents arranged on the ground, surrounding FORE and MTNS and WATF and SWMH and CAVE landscape, misty early morning, 16:9

#### เนินเขาแนวชายป่าอุตรดิตถ์ — Uttaradit Misty Highland Camp 2  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Uttaradit · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/uttaradit-misty-highland-camp-2-140/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เนินเขาแนวชายป่าอุตรดิตถ์  
  Minimal flat vector logo for a campsite "Uttaradit Misty Highland Camp 2" (เนินเขาแนวชายป่าอุตรดิตถ์), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/uttaradit-misty-highland-camp-2-140/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เนินเขาแนวชายป่าอุตรดิตถ์  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at เนินเขาแนวชายป่า Uttaradit Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/uttaradit-misty-highland-camp-2-140/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เนินเขาแนวชายป่าอุตรดิตถ์  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, เนินเขาแนวชายป่า Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/uttaradit-misty-highland-camp-2-140/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เนินเขาแนวชายป่าอุตรดิตถ์  
  signature hero view of Uttaradit Misty Highland Camp 2: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/uttaradit-misty-highland-camp-2-140/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ เนินเขาแนวชายป่าอุตรดิตถ์  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in เนินเขาแนวชายป่า, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/uttaradit-misty-highland-camp-2-140/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ เนินเขาแนวชายป่าอุตรดิตถ์  
  close detail of the ทะเลหมอกภูเขา surroundings at เนินเขาแนวชายป่า Uttaradit (MTNS+FORE+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/uttaradit-misty-highland-camp-2-140/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง เนินเขาแนวชายป่าอุตรดิตถ์  
  aerial drone top-down view of the ทะเลหมอกภูเขา campsite at เนินเขาแนวชายป่า, tents arranged on the ground, surrounding MTNS and FORE and WATF and SWMH and CAVE landscape, golden sunrise with low fog, 16:9

#### ชายป่าอนุรักษ์แพร่ — Phrae Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Phrae · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/phrae-forest-camp-1-141/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์แพร่  
  Minimal flat vector logo for a campsite "Phrae Forest Camp 1" (ชายป่าอนุรักษ์แพร่), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phrae-forest-camp-1-141/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์แพร่  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Phrae Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/phrae-forest-camp-1-141/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์แพร่  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phrae-forest-camp-1-141/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์แพร่  
  signature hero view of Phrae Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/phrae-forest-camp-1-141/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์แพร่  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phrae-forest-camp-1-141/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ชายป่าอนุรักษ์แพร่  
  close detail of the ป่าลึก/ผจญภัย surroundings at ชายป่าอนุรักษ์ Phrae (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9

#### ริมคลองร่มรื่นแพร่ — Phrae Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Phrae · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/phrae-riverside-camp-2-142/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นแพร่  
  Minimal flat vector logo for a campsite "Phrae Riverside Camp 2" (ริมคลองร่มรื่นแพร่), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phrae-riverside-camp-2-142/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นแพร่  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Phrae Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/phrae-riverside-camp-2-142/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นแพร่  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phrae-riverside-camp-2-142/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมคลองร่มรื่นแพร่  
  signature hero view of Phrae Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/phrae-riverside-camp-2-142/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมคลองร่มรื่นแพร่  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมคลองร่มรื่น, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phrae-riverside-camp-2-142/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมคลองร่มรื่นแพร่  
  close detail of the ริมน้ำ/ลำธาร surroundings at ริมคลองร่มรื่น Phrae (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phrae-riverside-camp-2-142/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ริมคลองร่มรื่นแพร่  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ริมคลองร่มรื่น, tents arranged on the ground, surrounding RIVE and FORE and WATF and SWMH landscape, soft morning light through trees, 16:9
- `/seed/camps/phrae-riverside-camp-2-142/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ริมคลองร่มรื่นแพร่  
  night scene of Phrae Riverside Camp 2, glowing tents and warm string lights at a ริมน้ำ/ลำธาร site in ริมคลองร่มรื่น, starry sky, long exposure, cozy mood, 16:9

#### ป่าเบญจพรรณชานเมืองแพร่ — Phrae Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Phrae · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/phrae-forest-camp-3-143/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองแพร่  
  Minimal flat vector logo for a campsite "Phrae Forest Camp 3" (ป่าเบญจพรรณชานเมืองแพร่), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phrae-forest-camp-3-143/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองแพร่  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Phrae Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/phrae-forest-camp-3-143/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองแพร่  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9

#### เนินเขาแนวชายป่าน่าน — Nan Misty Highland Camp 1  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Nan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/nan-misty-highland-camp-1-144/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เนินเขาแนวชายป่าน่าน  
  Minimal flat vector logo for a campsite "Nan Misty Highland Camp 1" (เนินเขาแนวชายป่าน่าน), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nan-misty-highland-camp-1-144/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เนินเขาแนวชายป่าน่าน  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at เนินเขาแนวชายป่า Nan Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/nan-misty-highland-camp-1-144/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เนินเขาแนวชายป่าน่าน  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, เนินเขาแนวชายป่า Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nan-misty-highland-camp-1-144/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เนินเขาแนวชายป่าน่าน  
  signature hero view of Nan Misty Highland Camp 1: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/nan-misty-highland-camp-1-144/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ เนินเขาแนวชายป่าน่าน  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in เนินเขาแนวชายป่า, warm evening glow, candid lifestyle photo, 16:9

#### ริมแม่น้ำสายหลักน่าน — Nan Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Nan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/nan-riverside-camp-2-145/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักน่าน  
  Minimal flat vector logo for a campsite "Nan Riverside Camp 2" (ริมแม่น้ำสายหลักน่าน), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nan-riverside-camp-2-145/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักน่าน  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Nan Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/nan-riverside-camp-2-145/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักน่าน  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nan-riverside-camp-2-145/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมแม่น้ำสายหลักน่าน  
  signature hero view of Nan Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/nan-riverside-camp-2-145/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมแม่น้ำสายหลักน่าน  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมแม่น้ำสายหลัก, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/nan-riverside-camp-2-145/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมแม่น้ำสายหลักน่าน  
  close detail of the ริมน้ำ/ลำธาร surroundings at ริมแม่น้ำสายหลัก Nan (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/nan-riverside-camp-2-145/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ริมแม่น้ำสายหลักน่าน  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ริมแม่น้ำสายหลัก, tents arranged on the ground, surrounding RIVE and FORE and WATF and SWMH landscape, soft morning light through trees, 16:9

#### ริมคลองร่มรื่นพะเยา — Phayao Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Phayao · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/phayao-riverside-camp-1-146/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นพะเยา  
  Minimal flat vector logo for a campsite "Phayao Riverside Camp 1" (ริมคลองร่มรื่นพะเยา), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phayao-riverside-camp-1-146/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นพะเยา  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Phayao Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/phayao-riverside-camp-1-146/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นพะเยา  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phayao-riverside-camp-1-146/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมคลองร่มรื่นพะเยา  
  signature hero view of Phayao Riverside Camp 1: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9

#### ต้นน้ำชานเมืองพะเยา — Phayao Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Phayao · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/phayao-riverside-camp-2-147/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองพะเยา  
  Minimal flat vector logo for a campsite "Phayao Riverside Camp 2" (ต้นน้ำชานเมืองพะเยา), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phayao-riverside-camp-2-147/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองพะเยา  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Phayao Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9

#### ดอยชายแดนพะเยา — Phayao Misty Highland Camp 3  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Phayao · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/phayao-misty-highland-camp-3-148/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ดอยชายแดนพะเยา  
  Minimal flat vector logo for a campsite "Phayao Misty Highland Camp 3" (ดอยชายแดนพะเยา), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phayao-misty-highland-camp-3-148/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ดอยชายแดนพะเยา  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ดอยชายแดน Phayao Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/phayao-misty-highland-camp-3-148/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ดอยชายแดนพะเยา  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ดอยชายแดน Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phayao-misty-highland-camp-3-148/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ดอยชายแดนพะเยา  
  signature hero view of Phayao Misty Highland Camp 3: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/phayao-misty-highland-camp-3-148/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ดอยชายแดนพะเยา  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in ดอยชายแดน, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phayao-misty-highland-camp-3-148/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ดอยชายแดนพะเยา  
  close detail of the ทะเลหมอกภูเขา surroundings at ดอยชายแดน Phayao (MTNS+FORE+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phayao-misty-highland-camp-3-148/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ดอยชายแดนพะเยา  
  aerial drone top-down view of the ทะเลหมอกภูเขา campsite at ดอยชายแดน, tents arranged on the ground, surrounding MTNS and FORE and WATF and SWMH and CAVE landscape, golden sunrise with low fog, 16:9
- `/seed/camps/phayao-misty-highland-camp-3-148/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ดอยชายแดนพะเยา  
  night scene of Phayao Misty Highland Camp 3, glowing tents and warm string lights at a ทะเลหมอกภูเขา site in ดอยชายแดน, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ RGC — อัครเดช ที่ราบกลาง (INDIVIDUAL)

#### อ่างเก็บน้ำชานเมืองนครสวรรค์ — Nakhon Sawan Lakeside Camp 1  
ธีม: ริมทะเลสาบ · จังหวัด: Nakhon Sawan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/nakhon-sawan-lakeside-camp-1-149/cover.jpg` (1:1, logo) — _alt:_ โลโก้ อ่างเก็บน้ำชานเมืองนครสวรรค์  
  Minimal flat vector logo for a campsite "Nakhon Sawan Lakeside Camp 1" (อ่างเก็บน้ำชานเมืองนครสวรรค์), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-sawan-lakeside-camp-1-149/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง อ่างเก็บน้ำชานเมืองนครสวรรค์  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at อ่างเก็บน้ำชานเมือง Nakhon Sawan Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-sawan-lakeside-camp-1-149/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ อ่างเก็บน้ำชานเมืองนครสวรรค์  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, อ่างเก็บน้ำชานเมือง Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-sawan-lakeside-camp-1-149/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น อ่างเก็บน้ำชานเมืองนครสวรรค์  
  signature hero view of Nakhon Sawan Lakeside Camp 1: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/nakhon-sawan-lakeside-camp-1-149/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ อ่างเก็บน้ำชานเมืองนครสวรรค์  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in อ่างเก็บน้ำชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/nakhon-sawan-lakeside-camp-1-149/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ อ่างเก็บน้ำชานเมืองนครสวรรค์  
  close detail of the ริมทะเลสาบ surroundings at อ่างเก็บน้ำชานเมือง Nakhon Sawan (RIVE+FORE+LAKE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/nakhon-sawan-lakeside-camp-1-149/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง อ่างเก็บน้ำชานเมืองนครสวรรค์  
  aerial drone top-down view of the ริมทะเลสาบ campsite at อ่างเก็บน้ำชานเมือง, tents arranged on the ground, surrounding RIVE and FORE and LAKE and WATF and SWMH landscape, still dawn with mist on the water, 16:9
- `/seed/camps/nakhon-sawan-lakeside-camp-1-149/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน อ่างเก็บน้ำชานเมืองนครสวรรค์  
  night scene of Nakhon Sawan Lakeside Camp 1, glowing tents and warm string lights at a ริมทะเลสาบ site in อ่างเก็บน้ำชานเมือง, starry sky, long exposure, cozy mood, 16:9

#### ทุ่งกว้างริมหมู่บ้านนครสวรรค์ — Nakhon Sawan Meadow Camp 2  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Nakhon Sawan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/nakhon-sawan-meadow-camp-2-150/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งกว้างริมหมู่บ้านนครสวรรค์  
  Minimal flat vector logo for a campsite "Nakhon Sawan Meadow Camp 2" (ทุ่งกว้างริมหมู่บ้านนครสวรรค์), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-sawan-meadow-camp-2-150/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งกว้างริมหมู่บ้านนครสวรรค์  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ทุ่งกว้างริมหมู่บ้าน Nakhon Sawan Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-sawan-meadow-camp-2-150/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งกว้างริมหมู่บ้านนครสวรรค์  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ทุ่งกว้างริมหมู่บ้าน Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-sawan-meadow-camp-2-150/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทุ่งกว้างริมหมู่บ้านนครสวรรค์  
  signature hero view of Nakhon Sawan Meadow Camp 2: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/nakhon-sawan-meadow-camp-2-150/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ทุ่งกว้างริมหมู่บ้านนครสวรรค์  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ทุ่งกว้างริมหมู่บ้าน, warm evening glow, candid lifestyle photo, 16:9

#### ทะเลสาบเขื่อนอุทัยธานี — Uthai Thani Lakeside Camp 1  
ธีม: ริมทะเลสาบ · จังหวัด: Uthai Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/uthai-thani-lakeside-camp-1-151/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทะเลสาบเขื่อนอุทัยธานี  
  Minimal flat vector logo for a campsite "Uthai Thani Lakeside Camp 1" (ทะเลสาบเขื่อนอุทัยธานี), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/uthai-thani-lakeside-camp-1-151/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทะเลสาบเขื่อนอุทัยธานี  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ทะเลสาบเขื่อน Uthai Thani Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/uthai-thani-lakeside-camp-1-151/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทะเลสาบเขื่อนอุทัยธานี  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ทะเลสาบเขื่อน Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9

#### ริมคลองร่มรื่นอุทัยธานี — Uthai Thani Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Uthai Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/uthai-thani-riverside-camp-2-152/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นอุทัยธานี  
  Minimal flat vector logo for a campsite "Uthai Thani Riverside Camp 2" (ริมคลองร่มรื่นอุทัยธานี), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/uthai-thani-riverside-camp-2-152/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นอุทัยธานี  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Uthai Thani Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/uthai-thani-riverside-camp-2-152/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นอุทัยธานี  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/uthai-thani-riverside-camp-2-152/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมคลองร่มรื่นอุทัยธานี  
  signature hero view of Uthai Thani Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/uthai-thani-riverside-camp-2-152/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมคลองร่มรื่นอุทัยธานี  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมคลองร่มรื่น, warm evening glow, candid lifestyle photo, 16:9

#### ป่าชุมชนใกล้เมืองกำแพงเพชร — Kamphaeng Phet Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Kamphaeng Phet · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/kamphaeng-phet-forest-camp-1-153/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองกำแพงเพชร  
  Minimal flat vector logo for a campsite "Kamphaeng Phet Forest Camp 1" (ป่าชุมชนใกล้เมืองกำแพงเพชร), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/kamphaeng-phet-forest-camp-1-153/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองกำแพงเพชร  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Kamphaeng Phet Thailand, misty early morning, photorealistic, highly detailed, 16:9

#### เนินหญ้าชายทุ่งกำแพงเพชร — Kamphaeng Phet Meadow Camp 2  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Kamphaeng Phet · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/kamphaeng-phet-meadow-camp-2-154/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เนินหญ้าชายทุ่งกำแพงเพชร  
  Minimal flat vector logo for a campsite "Kamphaeng Phet Meadow Camp 2" (เนินหญ้าชายทุ่งกำแพงเพชร), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/kamphaeng-phet-meadow-camp-2-154/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เนินหญ้าชายทุ่งกำแพงเพชร  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at เนินหญ้าชายทุ่ง Kamphaeng Phet Thailand, clear starry night, photorealistic, highly detailed, 16:9

#### อ่างเก็บน้ำชานเมืองกำแพงเพชร — Kamphaeng Phet Lakeside Camp 3  
ธีม: ริมทะเลสาบ · จังหวัด: Kamphaeng Phet · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/kamphaeng-phet-lakeside-camp-3-155/cover.jpg` (1:1, logo) — _alt:_ โลโก้ อ่างเก็บน้ำชานเมืองกำแพงเพชร  
  Minimal flat vector logo for a campsite "Kamphaeng Phet Lakeside Camp 3" (อ่างเก็บน้ำชานเมืองกำแพงเพชร), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/kamphaeng-phet-lakeside-camp-3-155/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง อ่างเก็บน้ำชานเมืองกำแพงเพชร  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at อ่างเก็บน้ำชานเมือง Kamphaeng Phet Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9

### โฮสต์ RGW — ห้างหุ้นส่วนจำกัด ตะวันตกไพรวัลย์ (PARTNERSHIP)

#### ทะเลสาบเขื่อนตาก — Tak Lakeside Camp 1  
ธีม: ริมทะเลสาบ · จังหวัด: Tak · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/tak-lakeside-camp-1-156/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทะเลสาบเขื่อนตาก  
  Minimal flat vector logo for a campsite "Tak Lakeside Camp 1" (ทะเลสาบเขื่อนตาก), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/tak-lakeside-camp-1-156/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทะเลสาบเขื่อนตาก  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ทะเลสาบเขื่อน Tak Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/tak-lakeside-camp-1-156/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทะเลสาบเขื่อนตาก  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ทะเลสาบเขื่อน Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/tak-lakeside-camp-1-156/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทะเลสาบเขื่อนตาก  
  signature hero view of Tak Lakeside Camp 1: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/tak-lakeside-camp-1-156/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ทะเลสาบเขื่อนตาก  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in ทะเลสาบเขื่อน, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/tak-lakeside-camp-1-156/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ทะเลสาบเขื่อนตาก  
  close detail of the ริมทะเลสาบ surroundings at ทะเลสาบเขื่อน Tak (RIVE+FORE+LAKE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/tak-lakeside-camp-1-156/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ทะเลสาบเขื่อนตาก  
  aerial drone top-down view of the ริมทะเลสาบ campsite at ทะเลสาบเขื่อน, tents arranged on the ground, surrounding RIVE and FORE and LAKE and WATF and SWMH landscape, still dawn with mist on the water, 16:9
- `/seed/camps/tak-lakeside-camp-1-156/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ทะเลสาบเขื่อนตาก  
  night scene of Tak Lakeside Camp 1, glowing tents and warm string lights at a ริมทะเลสาบ site in ทะเลสาบเขื่อน, starry sky, long exposure, cozy mood, 16:9

#### อ่างเก็บน้ำชานเมืองตาก — Tak Lakeside Camp 2  
ธีม: ริมทะเลสาบ · จังหวัด: Tak · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/tak-lakeside-camp-2-157/cover.jpg` (1:1, logo) — _alt:_ โลโก้ อ่างเก็บน้ำชานเมืองตาก  
  Minimal flat vector logo for a campsite "Tak Lakeside Camp 2" (อ่างเก็บน้ำชานเมืองตาก), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/tak-lakeside-camp-2-157/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง อ่างเก็บน้ำชานเมืองตาก  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at อ่างเก็บน้ำชานเมือง Tak Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/tak-lakeside-camp-2-157/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ อ่างเก็บน้ำชานเมืองตาก  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, อ่างเก็บน้ำชานเมือง Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/tak-lakeside-camp-2-157/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น อ่างเก็บน้ำชานเมืองตาก  
  signature hero view of Tak Lakeside Camp 2: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/tak-lakeside-camp-2-157/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ อ่างเก็บน้ำชานเมืองตาก  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in อ่างเก็บน้ำชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/tak-lakeside-camp-2-157/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ อ่างเก็บน้ำชานเมืองตาก  
  close detail of the ริมทะเลสาบ surroundings at อ่างเก็บน้ำชานเมือง Tak (RIVE+FORE+LAKE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/tak-lakeside-camp-2-157/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง อ่างเก็บน้ำชานเมืองตาก  
  aerial drone top-down view of the ริมทะเลสาบ campsite at อ่างเก็บน้ำชานเมือง, tents arranged on the ground, surrounding RIVE and FORE and LAKE and WATF and SWMH landscape, still dawn with mist on the water, 16:9
- `/seed/camps/tak-lakeside-camp-2-157/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน อ่างเก็บน้ำชานเมืองตาก  
  night scene of Tak Lakeside Camp 2, glowing tents and warm string lights at a ริมทะเลสาบ site in อ่างเก็บน้ำชานเมือง, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ RGC — อัครเดช ที่ราบกลาง (INDIVIDUAL)

#### ชายป่าอนุรักษ์สุโขทัย — Sukhothai Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Sukhothai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/sukhothai-forest-camp-1-158/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์สุโขทัย  
  Minimal flat vector logo for a campsite "Sukhothai Forest Camp 1" (ชายป่าอนุรักษ์สุโขทัย), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sukhothai-forest-camp-1-158/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์สุโขทัย  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Sukhothai Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/sukhothai-forest-camp-1-158/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์สุโขทัย  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9

#### ริมแม่น้ำสายหลักสุโขทัย — Sukhothai Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Sukhothai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/sukhothai-riverside-camp-2-159/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักสุโขทัย  
  Minimal flat vector logo for a campsite "Sukhothai Riverside Camp 2" (ริมแม่น้ำสายหลักสุโขทัย), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sukhothai-riverside-camp-2-159/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักสุโขทัย  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Sukhothai Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/sukhothai-riverside-camp-2-159/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักสุโขทัย  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/sukhothai-riverside-camp-2-159/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมแม่น้ำสายหลักสุโขทัย  
  signature hero view of Sukhothai Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/sukhothai-riverside-camp-2-159/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมแม่น้ำสายหลักสุโขทัย  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมแม่น้ำสายหลัก, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/sukhothai-riverside-camp-2-159/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมแม่น้ำสายหลักสุโขทัย  
  close detail of the ริมน้ำ/ลำธาร surroundings at ริมแม่น้ำสายหลัก Sukhothai (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/sukhothai-riverside-camp-2-159/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ริมแม่น้ำสายหลักสุโขทัย  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ริมแม่น้ำสายหลัก, tents arranged on the ground, surrounding RIVE and FORE and WATF and SWMH landscape, soft morning light through trees, 16:9

#### ทะเลสาบเขื่อนสุโขทัย — Sukhothai Lakeside Camp 3  
ธีม: ริมทะเลสาบ · จังหวัด: Sukhothai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/sukhothai-lakeside-camp-3-160/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทะเลสาบเขื่อนสุโขทัย  
  Minimal flat vector logo for a campsite "Sukhothai Lakeside Camp 3" (ทะเลสาบเขื่อนสุโขทัย), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sukhothai-lakeside-camp-3-160/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทะเลสาบเขื่อนสุโขทัย  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ทะเลสาบเขื่อน Sukhothai Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/sukhothai-lakeside-camp-3-160/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทะเลสาบเขื่อนสุโขทัย  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ทะเลสาบเขื่อน Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/sukhothai-lakeside-camp-3-160/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทะเลสาบเขื่อนสุโขทัย  
  signature hero view of Sukhothai Lakeside Camp 3: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/sukhothai-lakeside-camp-3-160/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ทะเลสาบเขื่อนสุโขทัย  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in ทะเลสาบเขื่อน, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/sukhothai-lakeside-camp-3-160/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ทะเลสาบเขื่อนสุโขทัย  
  close detail of the ริมทะเลสาบ surroundings at ทะเลสาบเขื่อน Sukhothai (RIVE+FORE+LAKE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9

#### ที่ราบเชิงเขาพิษณุโลก — Phitsanulok Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Phitsanulok · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/phitsanulok-meadow-camp-1-161/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ที่ราบเชิงเขาพิษณุโลก  
  Minimal flat vector logo for a campsite "Phitsanulok Meadow Camp 1" (ที่ราบเชิงเขาพิษณุโลก), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phitsanulok-meadow-camp-1-161/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ที่ราบเชิงเขาพิษณุโลก  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ที่ราบเชิงเขา Phitsanulok Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/phitsanulok-meadow-camp-1-161/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ที่ราบเชิงเขาพิษณุโลก  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ที่ราบเชิงเขา Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phitsanulok-meadow-camp-1-161/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ที่ราบเชิงเขาพิษณุโลก  
  signature hero view of Phitsanulok Meadow Camp 1: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/phitsanulok-meadow-camp-1-161/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ที่ราบเชิงเขาพิษณุโลก  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ที่ราบเชิงเขา, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phitsanulok-meadow-camp-1-161/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ที่ราบเชิงเขาพิษณุโลก  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at ที่ราบเชิงเขา Phitsanulok (MTNS+FORE+FILD+FARM terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phitsanulok-meadow-camp-1-161/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ที่ราบเชิงเขาพิษณุโลก  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at ที่ราบเชิงเขา, tents arranged on the ground, surrounding MTNS and FORE and FILD and FARM landscape, clear starry night, 16:9

#### ทุ่งกว้างริมหมู่บ้านพิษณุโลก — Phitsanulok Meadow Camp 2  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Phitsanulok · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/phitsanulok-meadow-camp-2-162/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งกว้างริมหมู่บ้านพิษณุโลก  
  Minimal flat vector logo for a campsite "Phitsanulok Meadow Camp 2" (ทุ่งกว้างริมหมู่บ้านพิษณุโลก), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phitsanulok-meadow-camp-2-162/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งกว้างริมหมู่บ้านพิษณุโลก  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ทุ่งกว้างริมหมู่บ้าน Phitsanulok Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/phitsanulok-meadow-camp-2-162/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งกว้างริมหมู่บ้านพิษณุโลก  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ทุ่งกว้างริมหมู่บ้าน Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phitsanulok-meadow-camp-2-162/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทุ่งกว้างริมหมู่บ้านพิษณุโลก  
  signature hero view of Phitsanulok Meadow Camp 2: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/phitsanulok-meadow-camp-2-162/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ทุ่งกว้างริมหมู่บ้านพิษณุโลก  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ทุ่งกว้างริมหมู่บ้าน, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phitsanulok-meadow-camp-2-162/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ทุ่งกว้างริมหมู่บ้านพิษณุโลก  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at ทุ่งกว้างริมหมู่บ้าน Phitsanulok (MTNS+FORE+FILD+FARM terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phitsanulok-meadow-camp-2-162/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ทุ่งกว้างริมหมู่บ้านพิษณุโลก  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at ทุ่งกว้างริมหมู่บ้าน, tents arranged on the ground, surrounding MTNS and FORE and FILD and FARM landscape, clear starry night, 16:9
- `/seed/camps/phitsanulok-meadow-camp-2-162/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ทุ่งกว้างริมหมู่บ้านพิษณุโลก  
  night scene of Phitsanulok Meadow Camp 2, glowing tents and warm string lights at a ทุ่งหญ้า/ชมดาว site in ทุ่งกว้างริมหมู่บ้าน, starry sky, long exposure, cozy mood, 16:9

#### ทะเลสาบเขื่อนพิจิตร — Phichit Lakeside Camp 1  
ธีม: ริมทะเลสาบ · จังหวัด: Phichit · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/phichit-lakeside-camp-1-163/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทะเลสาบเขื่อนพิจิตร  
  Minimal flat vector logo for a campsite "Phichit Lakeside Camp 1" (ทะเลสาบเขื่อนพิจิตร), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phichit-lakeside-camp-1-163/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทะเลสาบเขื่อนพิจิตร  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ทะเลสาบเขื่อน Phichit Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/phichit-lakeside-camp-1-163/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทะเลสาบเขื่อนพิจิตร  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ทะเลสาบเขื่อน Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phichit-lakeside-camp-1-163/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทะเลสาบเขื่อนพิจิตร  
  signature hero view of Phichit Lakeside Camp 1: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/phichit-lakeside-camp-1-163/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ทะเลสาบเขื่อนพิจิตร  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in ทะเลสาบเขื่อน, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phichit-lakeside-camp-1-163/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ทะเลสาบเขื่อนพิจิตร  
  close detail of the ริมทะเลสาบ surroundings at ทะเลสาบเขื่อน Phichit (RIVE+FORE+LAKE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9

#### อ่างเก็บน้ำชานเมืองพิจิตร — Phichit Lakeside Camp 2  
ธีม: ริมทะเลสาบ · จังหวัด: Phichit · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/phichit-lakeside-camp-2-164/cover.jpg` (1:1, logo) — _alt:_ โลโก้ อ่างเก็บน้ำชานเมืองพิจิตร  
  Minimal flat vector logo for a campsite "Phichit Lakeside Camp 2" (อ่างเก็บน้ำชานเมืองพิจิตร), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phichit-lakeside-camp-2-164/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง อ่างเก็บน้ำชานเมืองพิจิตร  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at อ่างเก็บน้ำชานเมือง Phichit Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/phichit-lakeside-camp-2-164/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ อ่างเก็บน้ำชานเมืองพิจิตร  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, อ่างเก็บน้ำชานเมือง Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phichit-lakeside-camp-2-164/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น อ่างเก็บน้ำชานเมืองพิจิตร  
  signature hero view of Phichit Lakeside Camp 2: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/phichit-lakeside-camp-2-164/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ อ่างเก็บน้ำชานเมืองพิจิตร  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in อ่างเก็บน้ำชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phichit-lakeside-camp-2-164/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ อ่างเก็บน้ำชานเมืองพิจิตร  
  close detail of the ริมทะเลสาบ surroundings at อ่างเก็บน้ำชานเมือง Phichit (RIVE+FORE+LAKE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9

#### ต้นน้ำชานเมืองพิจิตร — Phichit Riverside Camp 3  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Phichit · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/phichit-riverside-camp-3-165/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองพิจิตร  
  Minimal flat vector logo for a campsite "Phichit Riverside Camp 3" (ต้นน้ำชานเมืองพิจิตร), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phichit-riverside-camp-3-165/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองพิจิตร  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Phichit Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/phichit-riverside-camp-3-165/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ต้นน้ำชานเมืองพิจิตร  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ต้นน้ำชานเมือง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phichit-riverside-camp-3-165/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ต้นน้ำชานเมืองพิจิตร  
  signature hero view of Phichit Riverside Camp 3: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/phichit-riverside-camp-3-165/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ต้นน้ำชานเมืองพิจิตร  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ต้นน้ำชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phichit-riverside-camp-3-165/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ต้นน้ำชานเมืองพิจิตร  
  close detail of the ริมน้ำ/ลำธาร surroundings at ต้นน้ำชานเมือง Phichit (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phichit-riverside-camp-3-165/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ต้นน้ำชานเมืองพิจิตร  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ต้นน้ำชานเมือง, tents arranged on the ground, surrounding RIVE and FORE and WATF and SWMH landscape, soft morning light through trees, 16:9
- `/seed/camps/phichit-riverside-camp-3-165/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ต้นน้ำชานเมืองพิจิตร  
  night scene of Phichit Riverside Camp 3, glowing tents and warm string lights at a ริมน้ำ/ลำธาร site in ต้นน้ำชานเมือง, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ RGW — ห้างหุ้นส่วนจำกัด ตะวันตกไพรวัลย์ (PARTNERSHIP)

#### ยอดดอยเงียบสงบราชบุรี — Ratchaburi Misty Highland Camp 1  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Ratchaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/ratchaburi-misty-highland-camp-1-166/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ยอดดอยเงียบสงบราชบุรี  
  Minimal flat vector logo for a campsite "Ratchaburi Misty Highland Camp 1" (ยอดดอยเงียบสงบราชบุรี), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ratchaburi-misty-highland-camp-1-166/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ยอดดอยเงียบสงบราชบุรี  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ยอดดอยเงียบสงบ Ratchaburi Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/ratchaburi-misty-highland-camp-1-166/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ยอดดอยเงียบสงบราชบุรี  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ยอดดอยเงียบสงบ Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/ratchaburi-misty-highland-camp-1-166/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ยอดดอยเงียบสงบราชบุรี  
  signature hero view of Ratchaburi Misty Highland Camp 1: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9

#### ชายป่าอนุรักษ์ราชบุรี — Ratchaburi Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Ratchaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/ratchaburi-forest-camp-2-167/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์ราชบุรี  
  Minimal flat vector logo for a campsite "Ratchaburi Forest Camp 2" (ชายป่าอนุรักษ์ราชบุรี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ratchaburi-forest-camp-2-167/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์ราชบุรี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Ratchaburi Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/ratchaburi-forest-camp-2-167/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์ราชบุรี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/ratchaburi-forest-camp-2-167/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์ราชบุรี  
  signature hero view of Ratchaburi Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/ratchaburi-forest-camp-2-167/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์ราชบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/ratchaburi-forest-camp-2-167/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ชายป่าอนุรักษ์ราชบุรี  
  close detail of the ป่าลึก/ผจญภัย surroundings at ชายป่าอนุรักษ์ Ratchaburi (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9

#### ยอดดอยเงียบสงบราชบุรี — Ratchaburi Misty Highland Camp 3  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Ratchaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/ratchaburi-misty-highland-camp-3-168/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ยอดดอยเงียบสงบราชบุรี  
  Minimal flat vector logo for a campsite "Ratchaburi Misty Highland Camp 3" (ยอดดอยเงียบสงบราชบุรี), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ratchaburi-misty-highland-camp-3-168/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ยอดดอยเงียบสงบราชบุรี  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ยอดดอยเงียบสงบ Ratchaburi Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/ratchaburi-misty-highland-camp-3-168/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ยอดดอยเงียบสงบราชบุรี  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ยอดดอยเงียบสงบ Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/ratchaburi-misty-highland-camp-3-168/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ยอดดอยเงียบสงบราชบุรี  
  signature hero view of Ratchaburi Misty Highland Camp 3: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/ratchaburi-misty-highland-camp-3-168/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ยอดดอยเงียบสงบราชบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in ยอดดอยเงียบสงบ, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/ratchaburi-misty-highland-camp-3-168/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ยอดดอยเงียบสงบราชบุรี  
  close detail of the ทะเลหมอกภูเขา surroundings at ยอดดอยเงียบสงบ Ratchaburi (MTNS+FORE+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/ratchaburi-misty-highland-camp-3-168/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ยอดดอยเงียบสงบราชบุรี  
  aerial drone top-down view of the ทะเลหมอกภูเขา campsite at ยอดดอยเงียบสงบ, tents arranged on the ground, surrounding MTNS and FORE and WATF and SWMH and CAVE landscape, golden sunrise with low fog, 16:9
- `/seed/camps/ratchaburi-misty-highland-camp-3-168/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ยอดดอยเงียบสงบราชบุรี  
  night scene of Ratchaburi Misty Highland Camp 3, glowing tents and warm string lights at a ทะเลหมอกภูเขา site in ยอดดอยเงียบสงบ, starry sky, long exposure, cozy mood, 16:9

#### ป่าเบญจพรรณชานเมืองกาญจนบุรี — Kanchanaburi Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Kanchanaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/kanchanaburi-forest-camp-1-169/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองกาญจนบุรี  
  Minimal flat vector logo for a campsite "Kanchanaburi Forest Camp 1" (ป่าเบญจพรรณชานเมืองกาญจนบุรี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/kanchanaburi-forest-camp-1-169/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองกาญจนบุรี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Kanchanaburi Thailand, misty early morning, photorealistic, highly detailed, 16:9

#### ฝั่งลำธารชนบทกาญจนบุรี — Kanchanaburi Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Kanchanaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/kanchanaburi-riverside-camp-2-170/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ฝั่งลำธารชนบทกาญจนบุรี  
  Minimal flat vector logo for a campsite "Kanchanaburi Riverside Camp 2" (ฝั่งลำธารชนบทกาญจนบุรี), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/kanchanaburi-riverside-camp-2-170/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ฝั่งลำธารชนบทกาญจนบุรี  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ฝั่งลำธารชนบท Kanchanaburi Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9

### โฮสต์ RGC — อัครเดช ที่ราบกลาง (INDIVIDUAL)

#### เนินหญ้าชายทุ่งสุพรรณบุรี — Suphan Buri Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Suphan Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/suphan-buri-meadow-camp-1-171/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เนินหญ้าชายทุ่งสุพรรณบุรี  
  Minimal flat vector logo for a campsite "Suphan Buri Meadow Camp 1" (เนินหญ้าชายทุ่งสุพรรณบุรี), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/suphan-buri-meadow-camp-1-171/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เนินหญ้าชายทุ่งสุพรรณบุรี  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at เนินหญ้าชายทุ่ง Suphan Buri Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/suphan-buri-meadow-camp-1-171/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เนินหญ้าชายทุ่งสุพรรณบุรี  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, เนินหญ้าชายทุ่ง Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9

#### ที่ราบเชิงเขาสุพรรณบุรี — Suphan Buri Meadow Camp 2  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Suphan Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/suphan-buri-meadow-camp-2-172/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ที่ราบเชิงเขาสุพรรณบุรี  
  Minimal flat vector logo for a campsite "Suphan Buri Meadow Camp 2" (ที่ราบเชิงเขาสุพรรณบุรี), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/suphan-buri-meadow-camp-2-172/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ที่ราบเชิงเขาสุพรรณบุรี  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ที่ราบเชิงเขา Suphan Buri Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/suphan-buri-meadow-camp-2-172/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ที่ราบเชิงเขาสุพรรณบุรี  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ที่ราบเชิงเขา Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/suphan-buri-meadow-camp-2-172/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ที่ราบเชิงเขาสุพรรณบุรี  
  signature hero view of Suphan Buri Meadow Camp 2: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/suphan-buri-meadow-camp-2-172/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ที่ราบเชิงเขาสุพรรณบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ที่ราบเชิงเขา, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/suphan-buri-meadow-camp-2-172/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ที่ราบเชิงเขาสุพรรณบุรี  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at ที่ราบเชิงเขา Suphan Buri (MTNS+FORE+FILD+FARM terrain), natural textures and foliage, soft light, 16:9

#### ชายป่าอนุรักษ์นครปฐม — Nakhon Pathom Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Nakhon Pathom · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/nakhon-pathom-forest-camp-1-173/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์นครปฐม  
  Minimal flat vector logo for a campsite "Nakhon Pathom Forest Camp 1" (ชายป่าอนุรักษ์นครปฐม), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-pathom-forest-camp-1-173/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์นครปฐม  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Nakhon Pathom Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-pathom-forest-camp-1-173/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์นครปฐม  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-pathom-forest-camp-1-173/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์นครปฐม  
  signature hero view of Nakhon Pathom Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/nakhon-pathom-forest-camp-1-173/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์นครปฐม  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/nakhon-pathom-forest-camp-1-173/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ชายป่าอนุรักษ์นครปฐม  
  close detail of the ป่าลึก/ผจญภัย surroundings at ชายป่าอนุรักษ์ Nakhon Pathom (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/nakhon-pathom-forest-camp-1-173/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ชายป่าอนุรักษ์นครปฐม  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ชายป่าอนุรักษ์, tents arranged on the ground, surrounding FORE and MTNS and WATF and SWMH and CAVE landscape, misty early morning, 16:9

#### เนินหญ้าชายทุ่งนครปฐม — Nakhon Pathom Meadow Camp 2  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Nakhon Pathom · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/nakhon-pathom-meadow-camp-2-174/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เนินหญ้าชายทุ่งนครปฐม  
  Minimal flat vector logo for a campsite "Nakhon Pathom Meadow Camp 2" (เนินหญ้าชายทุ่งนครปฐม), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-pathom-meadow-camp-2-174/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เนินหญ้าชายทุ่งนครปฐม  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at เนินหญ้าชายทุ่ง Nakhon Pathom Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-pathom-meadow-camp-2-174/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เนินหญ้าชายทุ่งนครปฐม  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, เนินหญ้าชายทุ่ง Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-pathom-meadow-camp-2-174/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เนินหญ้าชายทุ่งนครปฐม  
  signature hero view of Nakhon Pathom Meadow Camp 2: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/nakhon-pathom-meadow-camp-2-174/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ เนินหญ้าชายทุ่งนครปฐม  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in เนินหญ้าชายทุ่ง, warm evening glow, candid lifestyle photo, 16:9

#### อ่าวเล็กปลายแหลมสมุทรสาคร — Samut Sakhon Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Samut Sakhon · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/samut-sakhon-beachside-camp-1-175/cover.jpg` (1:1, logo) — _alt:_ โลโก้ อ่าวเล็กปลายแหลมสมุทรสาคร  
  Minimal flat vector logo for a campsite "Samut Sakhon Beachside Camp 1" (อ่าวเล็กปลายแหลมสมุทรสาคร), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/samut-sakhon-beachside-camp-1-175/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง อ่าวเล็กปลายแหลมสมุทรสาคร  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at อ่าวเล็กปลายแหลม Samut Sakhon Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/samut-sakhon-beachside-camp-1-175/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ อ่าวเล็กปลายแหลมสมุทรสาคร  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, อ่าวเล็กปลายแหลม Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/samut-sakhon-beachside-camp-1-175/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น อ่าวเล็กปลายแหลมสมุทรสาคร  
  signature hero view of Samut Sakhon Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/samut-sakhon-beachside-camp-1-175/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ อ่าวเล็กปลายแหลมสมุทรสาคร  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in อ่าวเล็กปลายแหลม, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/samut-sakhon-beachside-camp-1-175/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ อ่าวเล็กปลายแหลมสมุทรสาคร  
  close detail of the ริมทะเล/ชายหาด surroundings at อ่าวเล็กปลายแหลม Samut Sakhon (BEAC+SEA+COAS terrain), natural textures and foliage, soft light, 16:9

#### หาดชายฝั่งเงียบสมุทรสาคร — Samut Sakhon Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Samut Sakhon · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/samut-sakhon-beachside-camp-2-176/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดชายฝั่งเงียบสมุทรสาคร  
  Minimal flat vector logo for a campsite "Samut Sakhon Beachside Camp 2" (หาดชายฝั่งเงียบสมุทรสาคร), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/samut-sakhon-beachside-camp-2-176/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดชายฝั่งเงียบสมุทรสาคร  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดชายฝั่งเงียบ Samut Sakhon Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/samut-sakhon-beachside-camp-2-176/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดชายฝั่งเงียบสมุทรสาคร  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดชายฝั่งเงียบ Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/samut-sakhon-beachside-camp-2-176/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น หาดชายฝั่งเงียบสมุทรสาคร  
  signature hero view of Samut Sakhon Beachside Camp 2: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/samut-sakhon-beachside-camp-2-176/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ หาดชายฝั่งเงียบสมุทรสาคร  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in หาดชายฝั่งเงียบ, warm evening glow, candid lifestyle photo, 16:9

#### แหลมหาดทรายสมุทรสงคราม — Samut Songkhram Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Samut Songkhram · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/samut-songkhram-beachside-camp-1-177/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายสมุทรสงคราม  
  Minimal flat vector logo for a campsite "Samut Songkhram Beachside Camp 1" (แหลมหาดทรายสมุทรสงคราม), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/samut-songkhram-beachside-camp-1-177/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายสมุทรสงคราม  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Samut Songkhram Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/samut-songkhram-beachside-camp-1-177/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหลมหาดทรายสมุทรสงคราม  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, แหลมหาดทราย Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/samut-songkhram-beachside-camp-1-177/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหลมหาดทรายสมุทรสงคราม  
  signature hero view of Samut Songkhram Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/samut-songkhram-beachside-camp-1-177/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แหลมหาดทรายสมุทรสงคราม  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in แหลมหาดทราย, warm evening glow, candid lifestyle photo, 16:9

#### ริมคลองร่มรื่นสมุทรสงคราม — Samut Songkhram Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Samut Songkhram · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/samut-songkhram-riverside-camp-2-178/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นสมุทรสงคราม  
  Minimal flat vector logo for a campsite "Samut Songkhram Riverside Camp 2" (ริมคลองร่มรื่นสมุทรสงคราม), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/samut-songkhram-riverside-camp-2-178/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นสมุทรสงคราม  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Samut Songkhram Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/samut-songkhram-riverside-camp-2-178/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นสมุทรสงคราม  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/samut-songkhram-riverside-camp-2-178/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมคลองร่มรื่นสมุทรสงคราม  
  signature hero view of Samut Songkhram Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/samut-songkhram-riverside-camp-2-178/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมคลองร่มรื่นสมุทรสงคราม  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมคลองร่มรื่น, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/samut-songkhram-riverside-camp-2-178/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมคลองร่มรื่นสมุทรสงคราม  
  close detail of the ริมน้ำ/ลำธาร surroundings at ริมคลองร่มรื่น Samut Songkhram (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/samut-songkhram-riverside-camp-2-178/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ริมคลองร่มรื่นสมุทรสงคราม  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ริมคลองร่มรื่น, tents arranged on the ground, surrounding RIVE and FORE and WATF and SWMH landscape, soft morning light through trees, 16:9

### โฮสต์ RGW — ห้างหุ้นส่วนจำกัด ตะวันตกไพรวัลย์ (PARTNERSHIP)

#### ริมทะเลนอกเมืองเพชรบุรี — Phetchaburi Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Phetchaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/phetchaburi-beachside-camp-1-179/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมทะเลนอกเมืองเพชรบุรี  
  Minimal flat vector logo for a campsite "Phetchaburi Beachside Camp 1" (ริมทะเลนอกเมืองเพชรบุรี), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phetchaburi-beachside-camp-1-179/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมทะเลนอกเมืองเพชรบุรี  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at ริมทะเลนอกเมือง Phetchaburi Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/phetchaburi-beachside-camp-1-179/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมทะเลนอกเมืองเพชรบุรี  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, ริมทะเลนอกเมือง Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phetchaburi-beachside-camp-1-179/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมทะเลนอกเมืองเพชรบุรี  
  signature hero view of Phetchaburi Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9

#### ป่าชุมชนใกล้เมืองเพชรบุรี — Phetchaburi Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Phetchaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/phetchaburi-forest-camp-2-180/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองเพชรบุรี  
  Minimal flat vector logo for a campsite "Phetchaburi Forest Camp 2" (ป่าชุมชนใกล้เมืองเพชรบุรี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phetchaburi-forest-camp-2-180/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองเพชรบุรี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Phetchaburi Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/phetchaburi-forest-camp-2-180/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าชุมชนใกล้เมืองเพชรบุรี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าชุมชนใกล้เมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phetchaburi-forest-camp-2-180/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าชุมชนใกล้เมืองเพชรบุรี  
  signature hero view of Phetchaburi Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/phetchaburi-forest-camp-2-180/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าชุมชนใกล้เมืองเพชรบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าชุมชนใกล้เมือง, warm evening glow, candid lifestyle photo, 16:9

#### ยอดดอยเงียบสงบเพชรบุรี — Phetchaburi Misty Highland Camp 3  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Phetchaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/phetchaburi-misty-highland-camp-3-181/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ยอดดอยเงียบสงบเพชรบุรี  
  Minimal flat vector logo for a campsite "Phetchaburi Misty Highland Camp 3" (ยอดดอยเงียบสงบเพชรบุรี), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phetchaburi-misty-highland-camp-3-181/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ยอดดอยเงียบสงบเพชรบุรี  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ยอดดอยเงียบสงบ Phetchaburi Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/phetchaburi-misty-highland-camp-3-181/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ยอดดอยเงียบสงบเพชรบุรี  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ยอดดอยเงียบสงบ Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phetchaburi-misty-highland-camp-3-181/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ยอดดอยเงียบสงบเพชรบุรี  
  signature hero view of Phetchaburi Misty Highland Camp 3: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/phetchaburi-misty-highland-camp-3-181/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ยอดดอยเงียบสงบเพชรบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in ยอดดอยเงียบสงบ, warm evening glow, candid lifestyle photo, 16:9

#### ริมทะเลนอกเมืองประจวบคีรีขันธ์ — Prachuap Khiri Khan Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Prachuap Khiri Khan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/prachuap-khiri-khan-beachside-camp-1-182/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมทะเลนอกเมืองประจวบคีรีขันธ์  
  Minimal flat vector logo for a campsite "Prachuap Khiri Khan Beachside Camp 1" (ริมทะเลนอกเมืองประจวบคีรีขันธ์), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/prachuap-khiri-khan-beachside-camp-1-182/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมทะเลนอกเมืองประจวบคีรีขันธ์  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at ริมทะเลนอกเมือง Prachuap Khiri Khan Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/prachuap-khiri-khan-beachside-camp-1-182/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมทะเลนอกเมืองประจวบคีรีขันธ์  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, ริมทะเลนอกเมือง Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/prachuap-khiri-khan-beachside-camp-1-182/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมทะเลนอกเมืองประจวบคีรีขันธ์  
  signature hero view of Prachuap Khiri Khan Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/prachuap-khiri-khan-beachside-camp-1-182/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมทะเลนอกเมืองประจวบคีรีขันธ์  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in ริมทะเลนอกเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/prachuap-khiri-khan-beachside-camp-1-182/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมทะเลนอกเมืองประจวบคีรีขันธ์  
  close detail of the ริมทะเล/ชายหาด surroundings at ริมทะเลนอกเมือง Prachuap Khiri Khan (BEAC+SEA+COAS terrain), natural textures and foliage, soft light, 16:9

#### ริมคลองร่มรื่นประจวบคีรีขันธ์ — Prachuap Khiri Khan Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Prachuap Khiri Khan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/prachuap-khiri-khan-riverside-camp-2-183/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นประจวบคีรีขันธ์  
  Minimal flat vector logo for a campsite "Prachuap Khiri Khan Riverside Camp 2" (ริมคลองร่มรื่นประจวบคีรีขันธ์), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/prachuap-khiri-khan-riverside-camp-2-183/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นประจวบคีรีขันธ์  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Prachuap Khiri Khan Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/prachuap-khiri-khan-riverside-camp-2-183/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นประจวบคีรีขันธ์  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/prachuap-khiri-khan-riverside-camp-2-183/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมคลองร่มรื่นประจวบคีรีขันธ์  
  signature hero view of Prachuap Khiri Khan Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/prachuap-khiri-khan-riverside-camp-2-183/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมคลองร่มรื่นประจวบคีรีขันธ์  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมคลองร่มรื่น, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/prachuap-khiri-khan-riverside-camp-2-183/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมคลองร่มรื่นประจวบคีรีขันธ์  
  close detail of the ริมน้ำ/ลำธาร surroundings at ริมคลองร่มรื่น Prachuap Khiri Khan (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/prachuap-khiri-khan-riverside-camp-2-183/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ริมคลองร่มรื่นประจวบคีรีขันธ์  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ริมคลองร่มรื่น, tents arranged on the ground, surrounding RIVE and FORE and WATF and SWMH landscape, soft morning light through trees, 16:9
- `/seed/camps/prachuap-khiri-khan-riverside-camp-2-183/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ริมคลองร่มรื่นประจวบคีรีขันธ์  
  night scene of Prachuap Khiri Khan Riverside Camp 2, glowing tents and warm string lights at a ริมน้ำ/ลำธาร site in ริมคลองร่มรื่น, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ RGS — สุนิสา ทะเลใต้ (INDIVIDUAL)

#### หาดชายฝั่งเงียบนครศรีธรรมราช — Nakhon Si Thammarat Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Nakhon Si Thammarat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/nakhon-si-thammarat-beachside-camp-1-184/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดชายฝั่งเงียบนครศรีธรรมราช  
  Minimal flat vector logo for a campsite "Nakhon Si Thammarat Beachside Camp 1" (หาดชายฝั่งเงียบนครศรีธรรมราช), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-si-thammarat-beachside-camp-1-184/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดชายฝั่งเงียบนครศรีธรรมราช  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดชายฝั่งเงียบ Nakhon Si Thammarat Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-si-thammarat-beachside-camp-1-184/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดชายฝั่งเงียบนครศรีธรรมราช  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดชายฝั่งเงียบ Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-si-thammarat-beachside-camp-1-184/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น หาดชายฝั่งเงียบนครศรีธรรมราช  
  signature hero view of Nakhon Si Thammarat Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/nakhon-si-thammarat-beachside-camp-1-184/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ หาดชายฝั่งเงียบนครศรีธรรมราช  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in หาดชายฝั่งเงียบ, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/nakhon-si-thammarat-beachside-camp-1-184/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ หาดชายฝั่งเงียบนครศรีธรรมราช  
  close detail of the ริมทะเล/ชายหาด surroundings at หาดชายฝั่งเงียบ Nakhon Si Thammarat (BEAC+SEA+COAS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/nakhon-si-thammarat-beachside-camp-1-184/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง หาดชายฝั่งเงียบนครศรีธรรมราช  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at หาดชายฝั่งเงียบ, tents arranged on the ground, surrounding BEAC and SEA and COAS landscape, warm sunset over the sea, 16:9

#### ฝั่งลำธารชนบทนครศรีธรรมราช — Nakhon Si Thammarat Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Nakhon Si Thammarat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/nakhon-si-thammarat-riverside-camp-2-185/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ฝั่งลำธารชนบทนครศรีธรรมราช  
  Minimal flat vector logo for a campsite "Nakhon Si Thammarat Riverside Camp 2" (ฝั่งลำธารชนบทนครศรีธรรมราช), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-si-thammarat-riverside-camp-2-185/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ฝั่งลำธารชนบทนครศรีธรรมราช  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ฝั่งลำธารชนบท Nakhon Si Thammarat Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9

#### ริมทะเลนอกเมืองนครศรีธรรมราช — Nakhon Si Thammarat Beachside Camp 3  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Nakhon Si Thammarat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/nakhon-si-thammarat-beachside-camp-3-186/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมทะเลนอกเมืองนครศรีธรรมราช  
  Minimal flat vector logo for a campsite "Nakhon Si Thammarat Beachside Camp 3" (ริมทะเลนอกเมืองนครศรีธรรมราช), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-si-thammarat-beachside-camp-3-186/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมทะเลนอกเมืองนครศรีธรรมราช  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at ริมทะเลนอกเมือง Nakhon Si Thammarat Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-si-thammarat-beachside-camp-3-186/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมทะเลนอกเมืองนครศรีธรรมราช  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, ริมทะเลนอกเมือง Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-si-thammarat-beachside-camp-3-186/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมทะเลนอกเมืองนครศรีธรรมราช  
  signature hero view of Nakhon Si Thammarat Beachside Camp 3: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9

#### หาดชายฝั่งเงียบพังงา — Phang Nga Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Phang Nga · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/phang-nga-beachside-camp-1-187/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดชายฝั่งเงียบพังงา  
  Minimal flat vector logo for a campsite "Phang Nga Beachside Camp 1" (หาดชายฝั่งเงียบพังงา), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phang-nga-beachside-camp-1-187/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดชายฝั่งเงียบพังงา  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดชายฝั่งเงียบ Phang Nga Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/phang-nga-beachside-camp-1-187/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดชายฝั่งเงียบพังงา  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดชายฝั่งเงียบ Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9

#### ป่าชุมชนใกล้เมืองพังงา — Phang Nga Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Phang Nga · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/phang-nga-forest-camp-2-188/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองพังงา  
  Minimal flat vector logo for a campsite "Phang Nga Forest Camp 2" (ป่าชุมชนใกล้เมืองพังงา), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phang-nga-forest-camp-2-188/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองพังงา  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Phang Nga Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/phang-nga-forest-camp-2-188/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าชุมชนใกล้เมืองพังงา  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าชุมชนใกล้เมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phang-nga-forest-camp-2-188/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าชุมชนใกล้เมืองพังงา  
  signature hero view of Phang Nga Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9

#### แหลมหาดทรายระนอง — Ranong Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Ranong · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/ranong-beachside-camp-1-189/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายระนอง  
  Minimal flat vector logo for a campsite "Ranong Beachside Camp 1" (แหลมหาดทรายระนอง), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ranong-beachside-camp-1-189/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายระนอง  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Ranong Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/ranong-beachside-camp-1-189/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหลมหาดทรายระนอง  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, แหลมหาดทราย Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/ranong-beachside-camp-1-189/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหลมหาดทรายระนอง  
  signature hero view of Ranong Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/ranong-beachside-camp-1-189/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แหลมหาดทรายระนอง  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in แหลมหาดทราย, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/ranong-beachside-camp-1-189/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ แหลมหาดทรายระนอง  
  close detail of the ริมทะเล/ชายหาด surroundings at แหลมหาดทราย Ranong (BEAC+SEA+COAS terrain), natural textures and foliage, soft light, 16:9

#### ทะเลสาบเขื่อนระนอง — Ranong Lakeside Camp 2  
ธีม: ริมทะเลสาบ · จังหวัด: Ranong · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/ranong-lakeside-camp-2-190/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทะเลสาบเขื่อนระนอง  
  Minimal flat vector logo for a campsite "Ranong Lakeside Camp 2" (ทะเลสาบเขื่อนระนอง), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ranong-lakeside-camp-2-190/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทะเลสาบเขื่อนระนอง  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ทะเลสาบเขื่อน Ranong Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/ranong-lakeside-camp-2-190/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทะเลสาบเขื่อนระนอง  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ทะเลสาบเขื่อน Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/ranong-lakeside-camp-2-190/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทะเลสาบเขื่อนระนอง  
  signature hero view of Ranong Lakeside Camp 2: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/ranong-lakeside-camp-2-190/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ทะเลสาบเขื่อนระนอง  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in ทะเลสาบเขื่อน, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/ranong-lakeside-camp-2-190/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ทะเลสาบเขื่อนระนอง  
  close detail of the ริมทะเลสาบ surroundings at ทะเลสาบเขื่อน Ranong (RIVE+FORE+LAKE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/ranong-lakeside-camp-2-190/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ทะเลสาบเขื่อนระนอง  
  aerial drone top-down view of the ริมทะเลสาบ campsite at ทะเลสาบเขื่อน, tents arranged on the ground, surrounding RIVE and FORE and LAKE and WATF and SWMH landscape, still dawn with mist on the water, 16:9
- `/seed/camps/ranong-lakeside-camp-2-190/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ทะเลสาบเขื่อนระนอง  
  night scene of Ranong Lakeside Camp 2, glowing tents and warm string lights at a ริมทะเลสาบ site in ทะเลสาบเขื่อน, starry sky, long exposure, cozy mood, 16:9

#### หาดชายฝั่งเงียบระนอง — Ranong Beachside Camp 3  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Ranong · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/ranong-beachside-camp-3-191/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดชายฝั่งเงียบระนอง  
  Minimal flat vector logo for a campsite "Ranong Beachside Camp 3" (หาดชายฝั่งเงียบระนอง), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ranong-beachside-camp-3-191/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดชายฝั่งเงียบระนอง  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดชายฝั่งเงียบ Ranong Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/ranong-beachside-camp-3-191/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดชายฝั่งเงียบระนอง  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดชายฝั่งเงียบ Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/ranong-beachside-camp-3-191/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น หาดชายฝั่งเงียบระนอง  
  signature hero view of Ranong Beachside Camp 3: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/ranong-beachside-camp-3-191/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ หาดชายฝั่งเงียบระนอง  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in หาดชายฝั่งเงียบ, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/ranong-beachside-camp-3-191/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ หาดชายฝั่งเงียบระนอง  
  close detail of the ริมทะเล/ชายหาด surroundings at หาดชายฝั่งเงียบ Ranong (BEAC+SEA+COAS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/ranong-beachside-camp-3-191/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง หาดชายฝั่งเงียบระนอง  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at หาดชายฝั่งเงียบ, tents arranged on the ground, surrounding BEAC and SEA and COAS landscape, warm sunset over the sea, 16:9
- `/seed/camps/ranong-beachside-camp-3-191/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน หาดชายฝั่งเงียบระนอง  
  night scene of Ranong Beachside Camp 3, glowing tents and warm string lights at a ริมทะเล/ชายหาด site in หาดชายฝั่งเงียบ, starry sky, long exposure, cozy mood, 16:9

#### ริมทะเลนอกเมืองชุมพร — Chumphon Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Chumphon · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/chumphon-beachside-camp-1-192/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมทะเลนอกเมืองชุมพร  
  Minimal flat vector logo for a campsite "Chumphon Beachside Camp 1" (ริมทะเลนอกเมืองชุมพร), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chumphon-beachside-camp-1-192/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมทะเลนอกเมืองชุมพร  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at ริมทะเลนอกเมือง Chumphon Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/chumphon-beachside-camp-1-192/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมทะเลนอกเมืองชุมพร  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, ริมทะเลนอกเมือง Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chumphon-beachside-camp-1-192/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมทะเลนอกเมืองชุมพร  
  signature hero view of Chumphon Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/chumphon-beachside-camp-1-192/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมทะเลนอกเมืองชุมพร  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in ริมทะเลนอกเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/chumphon-beachside-camp-1-192/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมทะเลนอกเมืองชุมพร  
  close detail of the ริมทะเล/ชายหาด surroundings at ริมทะเลนอกเมือง Chumphon (BEAC+SEA+COAS terrain), natural textures and foliage, soft light, 16:9

#### ชายป่าอนุรักษ์ชุมพร — Chumphon Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Chumphon · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/chumphon-forest-camp-2-193/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์ชุมพร  
  Minimal flat vector logo for a campsite "Chumphon Forest Camp 2" (ชายป่าอนุรักษ์ชุมพร), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chumphon-forest-camp-2-193/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์ชุมพร  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Chumphon Thailand, misty early morning, photorealistic, highly detailed, 16:9

#### แหลมหาดทรายสงขลา — Songkhla Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Songkhla · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/songkhla-beachside-camp-1-194/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายสงขลา  
  Minimal flat vector logo for a campsite "Songkhla Beachside Camp 1" (แหลมหาดทรายสงขลา), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/songkhla-beachside-camp-1-194/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายสงขลา  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Songkhla Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/songkhla-beachside-camp-1-194/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหลมหาดทรายสงขลา  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, แหลมหาดทราย Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/songkhla-beachside-camp-1-194/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหลมหาดทรายสงขลา  
  signature hero view of Songkhla Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9

#### ชายป่าอนุรักษ์สงขลา — Songkhla Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Songkhla · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/songkhla-forest-camp-2-195/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์สงขลา  
  Minimal flat vector logo for a campsite "Songkhla Forest Camp 2" (ชายป่าอนุรักษ์สงขลา), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/songkhla-forest-camp-2-195/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์สงขลา  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Songkhla Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/songkhla-forest-camp-2-195/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์สงขลา  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/songkhla-forest-camp-2-195/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์สงขลา  
  signature hero view of Songkhla Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9

#### แหลมหาดทรายสตูล — Satun Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Satun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/satun-beachside-camp-1-196/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายสตูล  
  Minimal flat vector logo for a campsite "Satun Beachside Camp 1" (แหลมหาดทรายสตูล), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/satun-beachside-camp-1-196/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายสตูล  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Satun Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/satun-beachside-camp-1-196/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหลมหาดทรายสตูล  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, แหลมหาดทราย Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/satun-beachside-camp-1-196/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหลมหาดทรายสตูล  
  signature hero view of Satun Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/satun-beachside-camp-1-196/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แหลมหาดทรายสตูล  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in แหลมหาดทราย, warm evening glow, candid lifestyle photo, 16:9

#### ทะเลสาบเขื่อนสตูล — Satun Lakeside Camp 2  
ธีม: ริมทะเลสาบ · จังหวัด: Satun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/satun-lakeside-camp-2-197/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทะเลสาบเขื่อนสตูล  
  Minimal flat vector logo for a campsite "Satun Lakeside Camp 2" (ทะเลสาบเขื่อนสตูล), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/satun-lakeside-camp-2-197/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทะเลสาบเขื่อนสตูล  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ทะเลสาบเขื่อน Satun Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/satun-lakeside-camp-2-197/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทะเลสาบเขื่อนสตูล  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ทะเลสาบเขื่อน Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/satun-lakeside-camp-2-197/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทะเลสาบเขื่อนสตูล  
  signature hero view of Satun Lakeside Camp 2: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/satun-lakeside-camp-2-197/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ทะเลสาบเขื่อนสตูล  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in ทะเลสาบเขื่อน, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/satun-lakeside-camp-2-197/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ทะเลสาบเขื่อนสตูล  
  close detail of the ริมทะเลสาบ surroundings at ทะเลสาบเขื่อน Satun (RIVE+FORE+LAKE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9

#### แหลมหาดทรายตรัง — Trang Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Trang · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/trang-beachside-camp-1-198/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายตรัง  
  Minimal flat vector logo for a campsite "Trang Beachside Camp 1" (แหลมหาดทรายตรัง), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/trang-beachside-camp-1-198/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายตรัง  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Trang Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/trang-beachside-camp-1-198/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหลมหาดทรายตรัง  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, แหลมหาดทราย Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/trang-beachside-camp-1-198/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหลมหาดทรายตรัง  
  signature hero view of Trang Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/trang-beachside-camp-1-198/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แหลมหาดทรายตรัง  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in แหลมหาดทราย, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/trang-beachside-camp-1-198/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ แหลมหาดทรายตรัง  
  close detail of the ริมทะเล/ชายหาด surroundings at แหลมหาดทราย Trang (BEAC+SEA+COAS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/trang-beachside-camp-1-198/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง แหลมหาดทรายตรัง  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at แหลมหาดทราย, tents arranged on the ground, surrounding BEAC and SEA and COAS landscape, warm sunset over the sea, 16:9
- `/seed/camps/trang-beachside-camp-1-198/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน แหลมหาดทรายตรัง  
  night scene of Trang Beachside Camp 1, glowing tents and warm string lights at a ริมทะเล/ชายหาด site in แหลมหาดทราย, starry sky, long exposure, cozy mood, 16:9

#### แหล่งน้ำใหญ่กลางหุบเขาตรัง — Trang Lakeside Camp 2  
ธีม: ริมทะเลสาบ · จังหวัด: Trang · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/trang-lakeside-camp-2-199/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหล่งน้ำใหญ่กลางหุบเขาตรัง  
  Minimal flat vector logo for a campsite "Trang Lakeside Camp 2" (แหล่งน้ำใหญ่กลางหุบเขาตรัง), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/trang-lakeside-camp-2-199/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหล่งน้ำใหญ่กลางหุบเขาตรัง  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at แหล่งน้ำใหญ่กลางหุบเขา Trang Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/trang-lakeside-camp-2-199/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหล่งน้ำใหญ่กลางหุบเขาตรัง  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, แหล่งน้ำใหญ่กลางหุบเขา Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/trang-lakeside-camp-2-199/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหล่งน้ำใหญ่กลางหุบเขาตรัง  
  signature hero view of Trang Lakeside Camp 2: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9

#### ต้นน้ำชานเมืองตรัง — Trang Riverside Camp 3  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Trang · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/trang-riverside-camp-3-200/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองตรัง  
  Minimal flat vector logo for a campsite "Trang Riverside Camp 3" (ต้นน้ำชานเมืองตรัง), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/trang-riverside-camp-3-200/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองตรัง  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Trang Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/trang-riverside-camp-3-200/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ต้นน้ำชานเมืองตรัง  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ต้นน้ำชานเมือง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/trang-riverside-camp-3-200/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ต้นน้ำชานเมืองตรัง  
  signature hero view of Trang Riverside Camp 3: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/trang-riverside-camp-3-200/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ต้นน้ำชานเมืองตรัง  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ต้นน้ำชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/trang-riverside-camp-3-200/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ต้นน้ำชานเมืองตรัง  
  close detail of the ริมน้ำ/ลำธาร surroundings at ต้นน้ำชานเมือง Trang (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/trang-riverside-camp-3-200/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ต้นน้ำชานเมืองตรัง  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ต้นน้ำชานเมือง, tents arranged on the ground, surrounding RIVE and FORE and WATF and SWMH landscape, soft morning light through trees, 16:9

#### แนวป่าเขตรักษาพันธุ์พัทลุง — Phatthalung Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Phatthalung · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/phatthalung-forest-camp-1-201/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แนวป่าเขตรักษาพันธุ์พัทลุง  
  Minimal flat vector logo for a campsite "Phatthalung Forest Camp 1" (แนวป่าเขตรักษาพันธุ์พัทลุง), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phatthalung-forest-camp-1-201/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แนวป่าเขตรักษาพันธุ์พัทลุง  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at แนวป่าเขตรักษาพันธุ์ Phatthalung Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/phatthalung-forest-camp-1-201/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แนวป่าเขตรักษาพันธุ์พัทลุง  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, แนวป่าเขตรักษาพันธุ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phatthalung-forest-camp-1-201/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แนวป่าเขตรักษาพันธุ์พัทลุง  
  signature hero view of Phatthalung Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/phatthalung-forest-camp-1-201/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แนวป่าเขตรักษาพันธุ์พัทลุง  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in แนวป่าเขตรักษาพันธุ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phatthalung-forest-camp-1-201/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ แนวป่าเขตรักษาพันธุ์พัทลุง  
  close detail of the ป่าลึก/ผจญภัย surroundings at แนวป่าเขตรักษาพันธุ์ Phatthalung (FORE+MTNS+WATF+SWMH+CAVE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phatthalung-forest-camp-1-201/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง แนวป่าเขตรักษาพันธุ์พัทลุง  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at แนวป่าเขตรักษาพันธุ์, tents arranged on the ground, surrounding FORE and MTNS and WATF and SWMH and CAVE landscape, misty early morning, 16:9

#### แหล่งน้ำใหญ่กลางหุบเขาพัทลุง — Phatthalung Lakeside Camp 2  
ธีม: ริมทะเลสาบ · จังหวัด: Phatthalung · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/phatthalung-lakeside-camp-2-202/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหล่งน้ำใหญ่กลางหุบเขาพัทลุง  
  Minimal flat vector logo for a campsite "Phatthalung Lakeside Camp 2" (แหล่งน้ำใหญ่กลางหุบเขาพัทลุง), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phatthalung-lakeside-camp-2-202/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหล่งน้ำใหญ่กลางหุบเขาพัทลุง  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at แหล่งน้ำใหญ่กลางหุบเขา Phatthalung Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/phatthalung-lakeside-camp-2-202/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหล่งน้ำใหญ่กลางหุบเขาพัทลุง  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, แหล่งน้ำใหญ่กลางหุบเขา Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9

#### แหลมหาดทรายปัตตานี — Pattani Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Pattani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/pattani-beachside-camp-1-203/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายปัตตานี  
  Minimal flat vector logo for a campsite "Pattani Beachside Camp 1" (แหลมหาดทรายปัตตานี), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pattani-beachside-camp-1-203/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายปัตตานี  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Pattani Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/pattani-beachside-camp-1-203/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหลมหาดทรายปัตตานี  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, แหลมหาดทราย Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/pattani-beachside-camp-1-203/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหลมหาดทรายปัตตานี  
  signature hero view of Pattani Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/pattani-beachside-camp-1-203/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แหลมหาดทรายปัตตานี  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in แหลมหาดทราย, warm evening glow, candid lifestyle photo, 16:9

#### ริมบึงธรรมชาติปัตตานี — Pattani Lakeside Camp 2  
ธีม: ริมทะเลสาบ · จังหวัด: Pattani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/pattani-lakeside-camp-2-204/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมบึงธรรมชาติปัตตานี  
  Minimal flat vector logo for a campsite "Pattani Lakeside Camp 2" (ริมบึงธรรมชาติปัตตานี), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pattani-lakeside-camp-2-204/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมบึงธรรมชาติปัตตานี  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ริมบึงธรรมชาติ Pattani Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9

#### ริมแม่น้ำสายหลักยะลา — Yala Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Yala · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/yala-riverside-camp-1-205/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักยะลา  
  Minimal flat vector logo for a campsite "Yala Riverside Camp 1" (ริมแม่น้ำสายหลักยะลา), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/yala-riverside-camp-1-205/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักยะลา  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Yala Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/yala-riverside-camp-1-205/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักยะลา  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/yala-riverside-camp-1-205/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมแม่น้ำสายหลักยะลา  
  signature hero view of Yala Riverside Camp 1: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/yala-riverside-camp-1-205/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมแม่น้ำสายหลักยะลา  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมแม่น้ำสายหลัก, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/yala-riverside-camp-1-205/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมแม่น้ำสายหลักยะลา  
  close detail of the ริมน้ำ/ลำธาร surroundings at ริมแม่น้ำสายหลัก Yala (RIVE+FORE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/yala-riverside-camp-1-205/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ริมแม่น้ำสายหลักยะลา  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ริมแม่น้ำสายหลัก, tents arranged on the ground, surrounding RIVE and FORE and WATF and SWMH landscape, soft morning light through trees, 16:9

#### แหล่งน้ำใหญ่กลางหุบเขายะลา — Yala Lakeside Camp 2  
ธีม: ริมทะเลสาบ · จังหวัด: Yala · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/yala-lakeside-camp-2-206/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหล่งน้ำใหญ่กลางหุบเขายะลา  
  Minimal flat vector logo for a campsite "Yala Lakeside Camp 2" (แหล่งน้ำใหญ่กลางหุบเขายะลา), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/yala-lakeside-camp-2-206/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหล่งน้ำใหญ่กลางหุบเขายะลา  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at แหล่งน้ำใหญ่กลางหุบเขา Yala Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/yala-lakeside-camp-2-206/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหล่งน้ำใหญ่กลางหุบเขายะลา  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, แหล่งน้ำใหญ่กลางหุบเขา Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/yala-lakeside-camp-2-206/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหล่งน้ำใหญ่กลางหุบเขายะลา  
  signature hero view of Yala Lakeside Camp 2: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/yala-lakeside-camp-2-206/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แหล่งน้ำใหญ่กลางหุบเขายะลา  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in แหล่งน้ำใหญ่กลางหุบเขา, warm evening glow, candid lifestyle photo, 16:9

#### ริมบึงธรรมชาติยะลา — Yala Lakeside Camp 3  
ธีม: ริมทะเลสาบ · จังหวัด: Yala · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/yala-lakeside-camp-3-207/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมบึงธรรมชาติยะลา  
  Minimal flat vector logo for a campsite "Yala Lakeside Camp 3" (ริมบึงธรรมชาติยะลา), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/yala-lakeside-camp-3-207/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมบึงธรรมชาติยะลา  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ริมบึงธรรมชาติ Yala Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/yala-lakeside-camp-3-207/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมบึงธรรมชาติยะลา  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ริมบึงธรรมชาติ Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/yala-lakeside-camp-3-207/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมบึงธรรมชาติยะลา  
  signature hero view of Yala Lakeside Camp 3: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/yala-lakeside-camp-3-207/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมบึงธรรมชาติยะลา  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in ริมบึงธรรมชาติ, warm evening glow, candid lifestyle photo, 16:9

#### อ่าวเล็กปลายแหลมนราธิวาส — Narathiwat Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Narathiwat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/narathiwat-beachside-camp-1-208/cover.jpg` (1:1, logo) — _alt:_ โลโก้ อ่าวเล็กปลายแหลมนราธิวาส  
  Minimal flat vector logo for a campsite "Narathiwat Beachside Camp 1" (อ่าวเล็กปลายแหลมนราธิวาส), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/narathiwat-beachside-camp-1-208/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง อ่าวเล็กปลายแหลมนราธิวาส  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at อ่าวเล็กปลายแหลม Narathiwat Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/narathiwat-beachside-camp-1-208/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ อ่าวเล็กปลายแหลมนราธิวาส  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, อ่าวเล็กปลายแหลม Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/narathiwat-beachside-camp-1-208/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น อ่าวเล็กปลายแหลมนราธิวาส  
  signature hero view of Narathiwat Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/narathiwat-beachside-camp-1-208/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ อ่าวเล็กปลายแหลมนราธิวาส  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in อ่าวเล็กปลายแหลม, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/narathiwat-beachside-camp-1-208/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ อ่าวเล็กปลายแหลมนราธิวาส  
  close detail of the ริมทะเล/ชายหาด surroundings at อ่าวเล็กปลายแหลม Narathiwat (BEAC+SEA+COAS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/narathiwat-beachside-camp-1-208/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง อ่าวเล็กปลายแหลมนราธิวาส  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at อ่าวเล็กปลายแหลม, tents arranged on the ground, surrounding BEAC and SEA and COAS landscape, warm sunset over the sea, 16:9

#### หาดชายฝั่งเงียบนราธิวาส — Narathiwat Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Narathiwat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/narathiwat-beachside-camp-2-209/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดชายฝั่งเงียบนราธิวาส  
  Minimal flat vector logo for a campsite "Narathiwat Beachside Camp 2" (หาดชายฝั่งเงียบนราธิวาส), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/narathiwat-beachside-camp-2-209/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดชายฝั่งเงียบนราธิวาส  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดชายฝั่งเงียบ Narathiwat Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/narathiwat-beachside-camp-2-209/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดชายฝั่งเงียบนราธิวาส  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดชายฝั่งเงียบ Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/narathiwat-beachside-camp-2-209/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น หาดชายฝั่งเงียบนราธิวาส  
  signature hero view of Narathiwat Beachside Camp 2: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/narathiwat-beachside-camp-2-209/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ หาดชายฝั่งเงียบนราธิวาส  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in หาดชายฝั่งเงียบ, warm evening glow, candid lifestyle photo, 16:9

#### ทะเลสาบเขื่อนนราธิวาส — Narathiwat Lakeside Camp 3  
ธีม: ริมทะเลสาบ · จังหวัด: Narathiwat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/narathiwat-lakeside-camp-3-210/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทะเลสาบเขื่อนนราธิวาส  
  Minimal flat vector logo for a campsite "Narathiwat Lakeside Camp 3" (ทะเลสาบเขื่อนนราธิวาส), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/narathiwat-lakeside-camp-3-210/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทะเลสาบเขื่อนนราธิวาส  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ทะเลสาบเขื่อน Narathiwat Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/narathiwat-lakeside-camp-3-210/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทะเลสาบเขื่อนนราธิวาส  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ทะเลสาบเขื่อน Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/narathiwat-lakeside-camp-3-210/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทะเลสาบเขื่อนนราธิวาส  
  signature hero view of Narathiwat Lakeside Camp 3: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/narathiwat-lakeside-camp-3-210/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ทะเลสาบเขื่อนนราธิวาส  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in ทะเลสาบเขื่อน, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/narathiwat-lakeside-camp-3-210/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ทะเลสาบเขื่อนนราธิวาส  
  close detail of the ริมทะเลสาบ surroundings at ทะเลสาบเขื่อน Narathiwat (RIVE+FORE+LAKE+WATF+SWMH terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/narathiwat-lakeside-camp-3-210/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ทะเลสาบเขื่อนนราธิวาส  
  aerial drone top-down view of the ริมทะเลสาบ campsite at ทะเลสาบเขื่อน, tents arranged on the ground, surrounding RIVE and FORE and LAKE and WATF and SWMH landscape, still dawn with mist on the water, 16:9
