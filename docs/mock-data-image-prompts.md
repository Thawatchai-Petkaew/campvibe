# Image Generation Prompts — CampVibe staging mock (218 camps, 77 provinces)

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
ธีม: ทะเลหมอกภูเขา · จังหวัด: Phetchabun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

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

### โฮสต์ C1 — บริษัท นอร์ทเทิร์นแคมป์ จำกัด (COMPANY)

#### ดอยอ่างขางไฮแลนด์ — Doi Ang Khang Highland  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Mai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/doi-ang-khang-highland-3/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ดอยอ่างขางไฮแลนด์  
  Minimal flat vector logo for a campsite "Doi Ang Khang Highland" (ดอยอ่างขางไฮแลนด์), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/doi-ang-khang-highland-3/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ดอยอ่างขางไฮแลนด์  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ดอยอ่างขาง Chiang Mai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/doi-ang-khang-highland-3/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ดอยอ่างขางไฮแลนด์  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ดอยอ่างขาง Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9

#### ม่อนแจ่มวิวหมอก — Mon Jam Mist View  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Mai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

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

### โฮสต์ P3 — ห้างหุ้นส่วนจำกัด เชียงรายวิว (PARTNERSHIP)

#### ภูชี้ฟ้าอรุณรุ่ง — Phu Chi Fa Sunrise  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Rai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/phu-chi-fa-sunrise-5/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ภูชี้ฟ้าอรุณรุ่ง  
  Minimal flat vector logo for a campsite "Phu Chi Fa Sunrise" (ภูชี้ฟ้าอรุณรุ่ง), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phu-chi-fa-sunrise-5/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ภูชี้ฟ้าอรุณรุ่ง  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ภูชี้ฟ้า Chiang Rai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9

#### ดอยแม่สลองหมอกเช้า — Doi Mae Salong Morning Mist  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Rai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

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
  close detail of the ทะเลหมอกภูเขา surroundings at ดอยแม่สลอง Chiang Rai (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/doi-mae-salong-morning-mist-6/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ดอยแม่สลองหมอกเช้า  
  aerial drone top-down view of the ทะเลหมอกภูเขา campsite at ดอยแม่สลอง, tents arranged on the ground, surrounding MTNS and FORE landscape, golden sunrise with low fog, 16:9

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
ธีม: ทะเลหมอกภูเขา · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/phu-pa-po-fuji-9/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ภูป่าเปาะฟูจิเมืองเลย  
  Minimal flat vector logo for a campsite "Phu Pa Po Fuji" (ภูป่าเปาะฟูจิเมืองเลย), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phu-pa-po-fuji-9/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ภูป่าเปาะฟูจิเมืองเลย  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ภูป่าเปาะ Loei Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/phu-pa-po-fuji-9/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ภูป่าเปาะฟูจิเมืองเลย  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ภูป่าเปาะ Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phu-pa-po-fuji-9/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ภูป่าเปาะฟูจิเมืองเลย  
  signature hero view of Phu Pa Po Fuji: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9

### โฮสต์ C1 — บริษัท นอร์ทเทิร์นแคมป์ จำกัด (COMPANY)

#### ดอยม่อนล้านทะเลหมอก — Doi Mon Lan Sea of Mist  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Mai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/doi-mon-lan-sea-of-mist-10/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ดอยม่อนล้านทะเลหมอก  
  Minimal flat vector logo for a campsite "Doi Mon Lan Sea of Mist" (ดอยม่อนล้านทะเลหมอก), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/doi-mon-lan-sea-of-mist-10/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ดอยม่อนล้านทะเลหมอก  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ม่อนล้าน Chiang Mai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/doi-mon-lan-sea-of-mist-10/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ดอยม่อนล้านทะเลหมอก  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ม่อนล้าน Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/doi-mon-lan-sea-of-mist-10/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ดอยม่อนล้านทะเลหมอก  
  signature hero view of Doi Mon Lan Sea of Mist: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/doi-mon-lan-sea-of-mist-10/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ดอยม่อนล้านทะเลหมอก  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in ม่อนล้าน, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/doi-mon-lan-sea-of-mist-10/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ดอยม่อนล้านทะเลหมอก  
  close detail of the ทะเลหมอกภูเขา surroundings at ม่อนล้าน Chiang Mai (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/doi-mon-lan-sea-of-mist-10/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ดอยม่อนล้านทะเลหมอก  
  aerial drone top-down view of the ทะเลหมอกภูเขา campsite at ม่อนล้าน, tents arranged on the ground, surrounding MTNS and FORE landscape, golden sunrise with low fog, 16:9
- `/seed/camps/doi-mon-lan-sea-of-mist-10/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ดอยม่อนล้านทะเลหมอก  
  night scene of Doi Mon Lan Sea of Mist, glowing tents and warm string lights at a ทะเลหมอกภูเขา site in ม่อนล้าน, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ C3 — บริษัท เขาค้อแคมป์ รีสอร์ท จำกัด (COMPANY)

#### ภูลมโลทุ่งหมอก — Phu Lom Lo Mist Field  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Phetchabun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

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
  close detail of the ทะเลหมอกภูเขา surroundings at ภูลมโล Phetchabun (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phu-lom-lo-mist-field-11/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ภูลมโลทุ่งหมอก  
  aerial drone top-down view of the ทะเลหมอกภูเขา campsite at ภูลมโล, tents arranged on the ground, surrounding MTNS and FORE landscape, golden sunrise with low fog, 16:9

### โฮสต์ P3 — ห้างหุ้นส่วนจำกัด เชียงรายวิว (PARTNERSHIP)

#### ยอดดอยผาตั้ง — Doi Pha Tang Peak  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Rai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/doi-pha-tang-peak-12/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ยอดดอยผาตั้ง  
  Minimal flat vector logo for a campsite "Doi Pha Tang Peak" (ยอดดอยผาตั้ง), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/doi-pha-tang-peak-12/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ยอดดอยผาตั้ง  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ผาตั้ง Chiang Rai Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/doi-pha-tang-peak-12/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ยอดดอยผาตั้ง  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ผาตั้ง Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9

### โฮสต์ C1 — บริษัท นอร์ทเทิร์นแคมป์ จำกัด (COMPANY)

#### ม่อนเงาะวิวเขา — Mon Ngo Hill View  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Mai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

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
- `/seed/camps/mon-ngo-hill-view-13/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ม่อนเงาะวิวเขา  
  aerial drone top-down view of the ทะเลหมอกภูเขา campsite at ม่อนเงาะ, tents arranged on the ground, surrounding MTNS and FORE landscape, golden sunrise with low fog, 16:9
- `/seed/camps/mon-ngo-hill-view-13/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ม่อนเงาะวิวเขา  
  night scene of Mon Ngo Hill View, glowing tents and warm string lights at a ทะเลหมอกภูเขา site in ม่อนเงาะ, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ I2 — พิมพ์ใจ ใจดี (INDIVIDUAL)

#### ดอยสุเทพระเบียงเมือง — Doi Suthep City Terrace  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Chiang Mai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

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
- `/seed/camps/doi-suthep-city-terrace-14/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ดอยสุเทพระเบียงเมือง  
  close detail of the ทะเลหมอกภูเขา surroundings at ดอยสุเทพ Chiang Mai (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ C3 — บริษัท เขาค้อแคมป์ รีสอร์ท จำกัด (COMPANY)

#### ทุ่งกังหันเขาค้อ — Khao Kho Windmill Meadow  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Phetchabun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/khao-kho-windmill-meadow-15/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งกังหันเขาค้อ  
  Minimal flat vector logo for a campsite "Khao Kho Windmill Meadow" (ทุ่งกังหันเขาค้อ), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/khao-kho-windmill-meadow-15/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งกังหันเขาค้อ  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at เขาค้อ Phetchabun Thailand, clear starry night, photorealistic, highly detailed, 16:9

### โฮสต์ C4 — บริษัท อีสานแอดเวนเจอร์ จำกัด (COMPANY)

#### ไร่ดาวลับฟ้าวังน้ำเขียว — Wang Nam Khiao Stargaze Farm  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Nakhon Ratchasima · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

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

### โฮสต์ P1 — ห้างหุ้นส่วนจำกัด เลยไฮแลนด์ (PARTNERSHIP)

#### ทุ่งหญ้าภูสวนทราย — Phu Suan Sai Meadow  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/phu-suan-sai-meadow-17/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งหญ้าภูสวนทราย  
  Minimal flat vector logo for a campsite "Phu Suan Sai Meadow" (ทุ่งหญ้าภูสวนทราย), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phu-suan-sai-meadow-17/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งหญ้าภูสวนทราย  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ภูสวนทราย Loei Thailand, clear starry night, photorealistic, highly detailed, 16:9

### โฮสต์ P3 — ห้างหุ้นส่วนจำกัด เชียงรายวิว (PARTNERSHIP)

#### ลานเล่นลมเชียงราย — Chiang Rai Windplay Field  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Chiang Rai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/chiang-rai-windplay-field-18/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ลานเล่นลมเชียงราย  
  Minimal flat vector logo for a campsite "Chiang Rai Windplay Field" (ลานเล่นลมเชียงราย), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chiang-rai-windplay-field-18/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ลานเล่นลมเชียงราย  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ดอยช้าง Chiang Rai Thailand, clear starry night, photorealistic, highly detailed, 16:9

### โฮสต์ I1 — ไร่ลุงนวลแคมป์ (INDIVIDUAL)

#### ทุ่งดอกไม้เขาค้อ — Khao Kho Flower Field  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Phetchabun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/khao-kho-flower-field-19/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งดอกไม้เขาค้อ  
  Minimal flat vector logo for a campsite "Khao Kho Flower Field" (ทุ่งดอกไม้เขาค้อ), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/khao-kho-flower-field-19/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งดอกไม้เขาค้อ  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at เขาค้อ Phetchabun Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/khao-kho-flower-field-19/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งดอกไม้เขาค้อ  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, เขาค้อ Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/khao-kho-flower-field-19/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทุ่งดอกไม้เขาค้อ  
  signature hero view of Khao Kho Flower Field: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9

### โฮสต์ C4 — บริษัท อีสานแอดเวนเจอร์ จำกัด (COMPANY)

#### วิวกว้างวังน้ำเขียว — Wang Nam Khiao Wide View  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Nakhon Ratchasima · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

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
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at วังน้ำเขียว Nakhon Ratchasima (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/wang-nam-khiao-wide-view-20/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง วิวกว้างวังน้ำเขียว  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at วังน้ำเขียว, tents arranged on the ground, surrounding MTNS and FORE landscape, clear starry night, 16:9

### โฮสต์ I5 — ลานริมโขงน้องแอน (INDIVIDUAL)

#### ลานตะวันรอนภูเรือ — Phu Ruea Sunset Lawn  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/phu-ruea-sunset-lawn-21/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ลานตะวันรอนภูเรือ  
  Minimal flat vector logo for a campsite "Phu Ruea Sunset Lawn" (ลานตะวันรอนภูเรือ), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phu-ruea-sunset-lawn-21/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ลานตะวันรอนภูเรือ  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ภูเรือ Loei Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/phu-ruea-sunset-lawn-21/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ลานตะวันรอนภูเรือ  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ภูเรือ Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9

### โฮสต์ P3 — ห้างหุ้นส่วนจำกัด เชียงรายวิว (PARTNERSHIP)

#### ทุ่งหญ้าเลี้ยงดาวเชียงราย — Chiang Rai Star Pasture  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Chiang Rai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

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

### โฮสต์ C2 — บริษัท ซีไซด์แคมป์ปิ้ง จำกัด (COMPANY)

#### หาดไร่เลย์แคมป์ — Railay Beach Camp  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Krabi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/railay-beach-camp-23/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดไร่เลย์แคมป์  
  Minimal flat vector logo for a campsite "Railay Beach Camp" (หาดไร่เลย์แคมป์), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/railay-beach-camp-23/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดไร่เลย์แคมป์  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดไร่เลย์ Krabi Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/railay-beach-camp-23/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดไร่เลย์แคมป์  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดไร่เลย์ Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/railay-beach-camp-23/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น หาดไร่เลย์แคมป์  
  signature hero view of Railay Beach Camp: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9

#### อ่าวนางริมเล — Ao Nang Seaside  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Krabi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

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
- `/seed/camps/ao-nang-seaside-24/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน อ่าวนางริมเล  
  night scene of Ao Nang Seaside, glowing tents and warm string lights at a ริมทะเล/ชายหาด site in อ่าวนาง, starry sky, long exposure, cozy mood, 16:9

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
ธีม: ริมทะเล/ชายหาด · จังหวัด: Phuket · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/nai-harn-beach-phuket-26/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดในหานภูเก็ต  
  Minimal flat vector logo for a campsite "Nai Harn Beach Phuket" (หาดในหานภูเก็ต), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nai-harn-beach-phuket-26/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดในหานภูเก็ต  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดในหาน Phuket Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/nai-harn-beach-phuket-26/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดในหานภูเก็ต  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดในหาน Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nai-harn-beach-phuket-26/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น หาดในหานภูเก็ต  
  signature hero view of Nai Harn Beach Phuket: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/nai-harn-beach-phuket-26/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ หาดในหานภูเก็ต  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in หาดในหาน, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/nai-harn-beach-phuket-26/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ หาดในหานภูเก็ต  
  close detail of the ริมทะเล/ชายหาด surroundings at หาดในหาน Phuket (BEAC terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/nai-harn-beach-phuket-26/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง หาดในหานภูเก็ต  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at หาดในหาน, tents arranged on the ground, surrounding BEAC landscape, warm sunset over the sea, 16:9

#### ไม้ขาวบีชแคมป์ — Mai Khao Beach Camp  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Phuket · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/mai-khao-beach-camp-27/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ไม้ขาวบีชแคมป์  
  Minimal flat vector logo for a campsite "Mai Khao Beach Camp" (ไม้ขาวบีชแคมป์), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/mai-khao-beach-camp-27/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ไม้ขาวบีชแคมป์  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดไม้ขาว Phuket Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/mai-khao-beach-camp-27/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ไม้ขาวบีชแคมป์  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดไม้ขาว Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/mai-khao-beach-camp-27/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ไม้ขาวบีชแคมป์  
  signature hero view of Mai Khao Beach Camp: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/mai-khao-beach-camp-27/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ไม้ขาวบีชแคมป์  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in หาดไม้ขาว, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/mai-khao-beach-camp-27/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ไม้ขาวบีชแคมป์  
  close detail of the ริมทะเล/ชายหาด surroundings at หาดไม้ขาว Phuket (BEAC terrain), natural textures and foliage, soft light, 16:9

#### เกาะกูดทะเลใส — Koh Kood Clearwater  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Trat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

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

### โฮสต์ I3 — บ้านเลริมหาด (INDIVIDUAL)

#### เกาะหมากเงียบสงบ — Koh Mak Serene  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Trat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

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

### โฮสต์ C2 — บริษัท ซีไซด์แคมป์ปิ้ง จำกัด (COMPANY)

#### หาดทรายเกาะช้าง — Koh Chang Sandy Bay  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Trat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

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
- `/seed/camps/koh-chang-sandy-bay-30/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ หาดทรายเกาะช้าง  
  close detail of the ริมทะเล/ชายหาด surroundings at เกาะช้าง Trat (BEAC terrain), natural textures and foliage, soft light, 16:9

#### เกาะเต่าใต้ดาว — Koh Tao Under Stars  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Surat Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/koh-tao-under-stars-31/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เกาะเต่าใต้ดาว  
  Minimal flat vector logo for a campsite "Koh Tao Under Stars" (เกาะเต่าใต้ดาว), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/koh-tao-under-stars-31/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เกาะเต่าใต้ดาว  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at เกาะเต่า Surat Thani Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/koh-tao-under-stars-31/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เกาะเต่าใต้ดาว  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, เกาะเต่า Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9

### โฮสต์ P2 — ห้างหุ้นส่วนจำกัด แม่ฮ่องสอนแคมป์ (PARTNERSHIP)

#### ปางอุ๋งริมทะเลสาบ — Pang Ung Lakeside  
ธีม: ริมทะเลสาบ · จังหวัด: Mae Hong Son · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/pang-ung-lakeside-32/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ปางอุ๋งริมทะเลสาบ  
  Minimal flat vector logo for a campsite "Pang Ung Lakeside" (ปางอุ๋งริมทะเลสาบ), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pang-ung-lakeside-32/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ปางอุ๋งริมทะเลสาบ  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ปางอุ๋ง Mae Hong Son Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/pang-ung-lakeside-32/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ปางอุ๋งริมทะเลสาบ  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ปางอุ๋ง Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9

### โฮสต์ C5 — บริษัท เลคแอนด์เลเชอร์ จำกัด (COMPANY)

#### เชี่ยวหลานกุ้ยหลินเมืองไทย — Cheow Lan Guilin  
ธีม: ริมทะเลสาบ · จังหวัด: Surat Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/cheow-lan-guilin-33/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เชี่ยวหลานกุ้ยหลินเมืองไทย  
  Minimal flat vector logo for a campsite "Cheow Lan Guilin" (เชี่ยวหลานกุ้ยหลินเมืองไทย), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/cheow-lan-guilin-33/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เชี่ยวหลานกุ้ยหลินเมืองไทย  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at เขื่อนเชี่ยวหลาน Surat Thani Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9

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
ธีม: ริมทะเลสาบ · จังหวัด: Mae Hong Son · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/pang-ung-misty-lake-35/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทะเลสาบสายหมอกปางอุ๋ง  
  Minimal flat vector logo for a campsite "Pang Ung Misty Lake" (ทะเลสาบสายหมอกปางอุ๋ง), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pang-ung-misty-lake-35/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทะเลสาบสายหมอกปางอุ๋ง  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ปางอุ๋ง Mae Hong Son Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/pang-ung-misty-lake-35/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทะเลสาบสายหมอกปางอุ๋ง  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ปางอุ๋ง Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/pang-ung-misty-lake-35/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทะเลสาบสายหมอกปางอุ๋ง  
  signature hero view of Pang Ung Misty Lake: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/pang-ung-misty-lake-35/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ทะเลสาบสายหมอกปางอุ๋ง  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in ปางอุ๋ง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/pang-ung-misty-lake-35/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ทะเลสาบสายหมอกปางอุ๋ง  
  close detail of the ริมทะเลสาบ surroundings at ปางอุ๋ง Mae Hong Son (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/pang-ung-misty-lake-35/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ทะเลสาบสายหมอกปางอุ๋ง  
  aerial drone top-down view of the ริมทะเลสาบ campsite at ปางอุ๋ง, tents arranged on the ground, surrounding RIVE and FORE landscape, still dawn with mist on the water, 16:9
- `/seed/camps/pang-ung-misty-lake-35/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ทะเลสาบสายหมอกปางอุ๋ง  
  night scene of Pang Ung Misty Lake, glowing tents and warm string lights at a ริมทะเลสาบ site in ปางอุ๋ง, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ P1 — ห้างหุ้นส่วนจำกัด เลยไฮแลนด์ (PARTNERSHIP)

#### อ่างเก็บน้ำภูสวรรค์ — Phu Sawan Reservoir  
ธีม: ริมทะเลสาบ · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

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
  close detail of the ริมทะเลสาบ surroundings at ภูสวรรค์ Loei (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ P2 — ห้างหุ้นส่วนจำกัด แม่ฮ่องสอนแคมป์ (PARTNERSHIP)

#### ปายริมธารแคมป์ — Pai Riverside Camp  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Mae Hong Son · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/pai-riverside-camp-37/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ปายริมธารแคมป์  
  Minimal flat vector logo for a campsite "Pai Riverside Camp" (ปายริมธารแคมป์), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
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
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/chiang-khan-mekong-bank-38/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เชียงคานริมโขง  
  Minimal flat vector logo for a campsite "Chiang Khan Mekong Bank" (เชียงคานริมโขง), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
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
- `/seed/camps/chiang-khan-mekong-bank-38/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง เชียงคานริมโขง  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at เชียงคาน, tents arranged on the ground, surrounding RIVE and FORE landscape, soft morning light through trees, 16:9

### โฮสต์ C4 — บริษัท อีสานแอดเวนเจอร์ จำกัด (COMPANY)

#### ลำธารใสวังน้ำเขียว — Wang Nam Khiao Clear Stream  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Nakhon Ratchasima · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/wang-nam-khiao-clear-stream-39/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ลำธารใสวังน้ำเขียว  
  Minimal flat vector logo for a campsite "Wang Nam Khiao Clear Stream" (ลำธารใสวังน้ำเขียว), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/wang-nam-khiao-clear-stream-39/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ลำธารใสวังน้ำเขียว  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at วังน้ำเขียว Nakhon Ratchasima Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/wang-nam-khiao-clear-stream-39/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ลำธารใสวังน้ำเขียว  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, วังน้ำเขียว Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/wang-nam-khiao-clear-stream-39/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ลำธารใสวังน้ำเขียว  
  signature hero view of Wang Nam Khiao Clear Stream: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/wang-nam-khiao-clear-stream-39/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ลำธารใสวังน้ำเขียว  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in วังน้ำเขียว, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/wang-nam-khiao-clear-stream-39/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ลำธารใสวังน้ำเขียว  
  close detail of the ริมน้ำ/ลำธาร surroundings at วังน้ำเขียว Nakhon Ratchasima (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/wang-nam-khiao-clear-stream-39/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ลำธารใสวังน้ำเขียว  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at วังน้ำเขียว, tents arranged on the ground, surrounding RIVE and FORE landscape, soft morning light through trees, 16:9

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
  close detail of the ริมน้ำ/ลำธาร surroundings at ห้วยน้ำดัง Mae Hong Son (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/huai-nam-dang-stream-40/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ห้วยน้ำดังสายหมอก  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ห้วยน้ำดัง, tents arranged on the ground, surrounding RIVE and FORE landscape, soft morning light through trees, 16:9

### โฮสต์ P1 — ห้างหุ้นส่วนจำกัด เลยไฮแลนด์ (PARTNERSHIP)

#### ริมธารภูกระดึงน้อย — Little Phu Kradueng Stream  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/little-phu-kradueng-stream-41/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมธารภูกระดึงน้อย  
  Minimal flat vector logo for a campsite "Little Phu Kradueng Stream" (ริมธารภูกระดึงน้อย), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/little-phu-kradueng-stream-41/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมธารภูกระดึงน้อย  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ภูกระดึง Loei Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9

### โฮสต์ C4 — บริษัท อีสานแอดเวนเจอร์ จำกัด (COMPANY)

#### แก่งน้ำใสปากช่อง — Pak Chong Clearwater Rapids  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Nakhon Ratchasima · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

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

#### ป่าใหญ่เขาใหญ่แคมป์ — Khao Yai Jungle Camp  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Nakhon Ratchasima · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/khao-yai-jungle-camp-43/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าใหญ่เขาใหญ่แคมป์  
  Minimal flat vector logo for a campsite "Khao Yai Jungle Camp" (ป่าใหญ่เขาใหญ่แคมป์), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/khao-yai-jungle-camp-43/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าใหญ่เขาใหญ่แคมป์  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at เขาใหญ่ Nakhon Ratchasima Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/khao-yai-jungle-camp-43/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าใหญ่เขาใหญ่แคมป์  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, เขาใหญ่ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9

### โฮสต์ C5 — บริษัท เลคแอนด์เลเชอร์ จำกัด (COMPANY)

#### เขาสกป่าฝนแคมป์ — Khao Sok Rainforest  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Surat Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

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
- `/seed/camps/khao-sok-rainforest-44/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ เขาสกป่าฝนแคมป์  
  close detail of the ป่าลึก/ผจญภัย surroundings at เขาสก Surat Thani (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ P1 — ห้างหุ้นส่วนจำกัด เลยไฮแลนด์ (PARTNERSHIP)

#### ภูกระดึงยอดป่า — Phu Kradueng Summit Forest  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Loei · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/phu-kradueng-summit-forest-45/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ภูกระดึงยอดป่า  
  Minimal flat vector logo for a campsite "Phu Kradueng Summit Forest" (ภูกระดึงยอดป่า), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phu-kradueng-summit-forest-45/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ภูกระดึงยอดป่า  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ภูกระดึง Loei Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/phu-kradueng-summit-forest-45/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ภูกระดึงยอดป่า  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ภูกระดึง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phu-kradueng-summit-forest-45/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ภูกระดึงยอดป่า  
  signature hero view of Phu Kradueng Summit Forest: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9

### โฮสต์ I4 — ประภาส ไพรวัลย์ (INDIVIDUAL)

#### ไพรพนาวังน้ำเขียว — Wang Nam Khiao Woodland  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Nakhon Ratchasima · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/wang-nam-khiao-woodland-46/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ไพรพนาวังน้ำเขียว  
  Minimal flat vector logo for a campsite "Wang Nam Khiao Woodland" (ไพรพนาวังน้ำเขียว), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/wang-nam-khiao-woodland-46/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ไพรพนาวังน้ำเขียว  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at วังน้ำเขียว Nakhon Ratchasima Thailand, misty early morning, photorealistic, highly detailed, 16:9

### โฮสต์ C5 — บริษัท เลคแอนด์เลเชอร์ จำกัด (COMPANY)

#### ป่าดิบชื้นเขาสก — Khao Sok Evergreen  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Surat Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

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
  close detail of the ป่าลึก/ผจญภัย surroundings at เขาสก Surat Thani (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/khao-sok-evergreen-47/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ป่าดิบชื้นเขาสก  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at เขาสก, tents arranged on the ground, surrounding FORE and MTNS landscape, misty early morning, 16:9
- `/seed/camps/khao-sok-evergreen-47/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ป่าดิบชื้นเขาสก  
  night scene of Khao Sok Evergreen, glowing tents and warm string lights at a ป่าลึก/ผจญภัย site in เขาสก, starry sky, long exposure, cozy mood, 16:9

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

### โฮสต์ RGC — อัครเดช ที่ราบกลาง (INDIVIDUAL)

#### ทุ่งกว้างริมหมู่บ้านกรุงเทพมหานคร — Bangkok Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Bangkok · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/bangkok-meadow-camp-1-49/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งกว้างริมหมู่บ้านกรุงเทพมหานคร  
  Minimal flat vector logo for a campsite "Bangkok Meadow Camp 1" (ทุ่งกว้างริมหมู่บ้านกรุงเทพมหานคร), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/bangkok-meadow-camp-1-49/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งกว้างริมหมู่บ้านกรุงเทพมหานคร  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ทุ่งกว้างริมหมู่บ้าน Bangkok Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/bangkok-meadow-camp-1-49/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งกว้างริมหมู่บ้านกรุงเทพมหานคร  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ทุ่งกว้างริมหมู่บ้าน Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/bangkok-meadow-camp-1-49/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทุ่งกว้างริมหมู่บ้านกรุงเทพมหานคร  
  signature hero view of Bangkok Meadow Camp 1: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9

#### ชายป่าอนุรักษ์กรุงเทพมหานคร — Bangkok Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Bangkok · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/bangkok-forest-camp-2-50/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์กรุงเทพมหานคร  
  Minimal flat vector logo for a campsite "Bangkok Forest Camp 2" (ชายป่าอนุรักษ์กรุงเทพมหานคร), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/bangkok-forest-camp-2-50/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์กรุงเทพมหานคร  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Bangkok Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/bangkok-forest-camp-2-50/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์กรุงเทพมหานคร  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/bangkok-forest-camp-2-50/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์กรุงเทพมหานคร  
  signature hero view of Bangkok Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/bangkok-forest-camp-2-50/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์กรุงเทพมหานคร  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9

#### ฝั่งลำธารชนบทสมุทรปราการ — Samut Prakan Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Samut Prakan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/samut-prakan-riverside-camp-1-51/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ฝั่งลำธารชนบทสมุทรปราการ  
  Minimal flat vector logo for a campsite "Samut Prakan Riverside Camp 1" (ฝั่งลำธารชนบทสมุทรปราการ), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/samut-prakan-riverside-camp-1-51/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ฝั่งลำธารชนบทสมุทรปราการ  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ฝั่งลำธารชนบท Samut Prakan Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/samut-prakan-riverside-camp-1-51/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ฝั่งลำธารชนบทสมุทรปราการ  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ฝั่งลำธารชนบท Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/samut-prakan-riverside-camp-1-51/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ฝั่งลำธารชนบทสมุทรปราการ  
  signature hero view of Samut Prakan Riverside Camp 1: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/samut-prakan-riverside-camp-1-51/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ฝั่งลำธารชนบทสมุทรปราการ  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ฝั่งลำธารชนบท, warm evening glow, candid lifestyle photo, 16:9

#### แหลมหาดทรายสมุทรปราการ — Samut Prakan Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Samut Prakan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/samut-prakan-beachside-camp-2-52/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายสมุทรปราการ  
  Minimal flat vector logo for a campsite "Samut Prakan Beachside Camp 2" (แหลมหาดทรายสมุทรปราการ), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/samut-prakan-beachside-camp-2-52/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายสมุทรปราการ  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Samut Prakan Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/samut-prakan-beachside-camp-2-52/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหลมหาดทรายสมุทรปราการ  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, แหลมหาดทราย Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9

#### ริมคลองร่มรื่นนนทบุรี — Nonthaburi Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Nonthaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/nonthaburi-riverside-camp-1-53/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นนนทบุรี  
  Minimal flat vector logo for a campsite "Nonthaburi Riverside Camp 1" (ริมคลองร่มรื่นนนทบุรี), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nonthaburi-riverside-camp-1-53/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นนนทบุรี  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Nonthaburi Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/nonthaburi-riverside-camp-1-53/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นนนทบุรี  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9

#### แหลมหาดทรายนนทบุรี — Nonthaburi Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Nonthaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/nonthaburi-beachside-camp-2-54/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายนนทบุรี  
  Minimal flat vector logo for a campsite "Nonthaburi Beachside Camp 2" (แหลมหาดทรายนนทบุรี), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nonthaburi-beachside-camp-2-54/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายนนทบุรี  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Nonthaburi Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/nonthaburi-beachside-camp-2-54/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหลมหาดทรายนนทบุรี  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, แหลมหาดทราย Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nonthaburi-beachside-camp-2-54/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหลมหาดทรายนนทบุรี  
  signature hero view of Nonthaburi Beachside Camp 2: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9

#### ชายป่าอนุรักษ์ปทุมธานี — Pathum Thani Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Pathum Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/pathum-thani-forest-camp-1-55/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์ปทุมธานี  
  Minimal flat vector logo for a campsite "Pathum Thani Forest Camp 1" (ชายป่าอนุรักษ์ปทุมธานี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pathum-thani-forest-camp-1-55/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์ปทุมธานี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Pathum Thani Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/pathum-thani-forest-camp-1-55/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์ปทุมธานี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/pathum-thani-forest-camp-1-55/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์ปทุมธานี  
  signature hero view of Pathum Thani Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/pathum-thani-forest-camp-1-55/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์ปทุมธานี  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/pathum-thani-forest-camp-1-55/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ชายป่าอนุรักษ์ปทุมธานี  
  close detail of the ป่าลึก/ผจญภัย surroundings at ชายป่าอนุรักษ์ Pathum Thani (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9

#### อ่าวเล็กปลายแหลมปทุมธานี — Pathum Thani Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Pathum Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/pathum-thani-beachside-camp-2-56/cover.jpg` (1:1, logo) — _alt:_ โลโก้ อ่าวเล็กปลายแหลมปทุมธานี  
  Minimal flat vector logo for a campsite "Pathum Thani Beachside Camp 2" (อ่าวเล็กปลายแหลมปทุมธานี), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pathum-thani-beachside-camp-2-56/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง อ่าวเล็กปลายแหลมปทุมธานี  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at อ่าวเล็กปลายแหลม Pathum Thani Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/pathum-thani-beachside-camp-2-56/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ อ่าวเล็กปลายแหลมปทุมธานี  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, อ่าวเล็กปลายแหลม Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/pathum-thani-beachside-camp-2-56/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น อ่าวเล็กปลายแหลมปทุมธานี  
  signature hero view of Pathum Thani Beachside Camp 2: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/pathum-thani-beachside-camp-2-56/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ อ่าวเล็กปลายแหลมปทุมธานี  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in อ่าวเล็กปลายแหลม, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/pathum-thani-beachside-camp-2-56/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ อ่าวเล็กปลายแหลมปทุมธานี  
  close detail of the ริมทะเล/ชายหาด surroundings at อ่าวเล็กปลายแหลม Pathum Thani (BEAC terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/pathum-thani-beachside-camp-2-56/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง อ่าวเล็กปลายแหลมปทุมธานี  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at อ่าวเล็กปลายแหลม, tents arranged on the ground, surrounding BEAC landscape, warm sunset over the sea, 16:9
- `/seed/camps/pathum-thani-beachside-camp-2-56/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน อ่าวเล็กปลายแหลมปทุมธานี  
  night scene of Pathum Thani Beachside Camp 2, glowing tents and warm string lights at a ริมทะเล/ชายหาด site in อ่าวเล็กปลายแหลม, starry sky, long exposure, cozy mood, 16:9

#### อ่าวเล็กปลายแหลมปทุมธานี — Pathum Thani Beachside Camp 3  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Pathum Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/pathum-thani-beachside-camp-3-57/cover.jpg` (1:1, logo) — _alt:_ โลโก้ อ่าวเล็กปลายแหลมปทุมธานี  
  Minimal flat vector logo for a campsite "Pathum Thani Beachside Camp 3" (อ่าวเล็กปลายแหลมปทุมธานี), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pathum-thani-beachside-camp-3-57/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง อ่าวเล็กปลายแหลมปทุมธานี  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at อ่าวเล็กปลายแหลม Pathum Thani Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/pathum-thani-beachside-camp-3-57/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ อ่าวเล็กปลายแหลมปทุมธานี  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, อ่าวเล็กปลายแหลม Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9

#### ริมแม่น้ำสายหลักพระนครศรีอยุธยา — Phra Nakhon Si Ayutthaya Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Phra Nakhon Si Ayutthaya · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/phra-nakhon-si-ayutthaya-riverside-camp-1-58/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักพระนครศรีอยุธยา  
  Minimal flat vector logo for a campsite "Phra Nakhon Si Ayutthaya Riverside Camp 1" (ริมแม่น้ำสายหลักพระนครศรีอยุธยา), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phra-nakhon-si-ayutthaya-riverside-camp-1-58/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักพระนครศรีอยุธยา  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Phra Nakhon Si Ayutthaya Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/phra-nakhon-si-ayutthaya-riverside-camp-1-58/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักพระนครศรีอยุธยา  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phra-nakhon-si-ayutthaya-riverside-camp-1-58/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมแม่น้ำสายหลักพระนครศรีอยุธยา  
  signature hero view of Phra Nakhon Si Ayutthaya Riverside Camp 1: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/phra-nakhon-si-ayutthaya-riverside-camp-1-58/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมแม่น้ำสายหลักพระนครศรีอยุธยา  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมแม่น้ำสายหลัก, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phra-nakhon-si-ayutthaya-riverside-camp-1-58/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมแม่น้ำสายหลักพระนครศรีอยุธยา  
  close detail of the ริมน้ำ/ลำธาร surroundings at ริมแม่น้ำสายหลัก Phra Nakhon Si Ayutthaya (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phra-nakhon-si-ayutthaya-riverside-camp-1-58/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ริมแม่น้ำสายหลักพระนครศรีอยุธยา  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ริมแม่น้ำสายหลัก, tents arranged on the ground, surrounding RIVE and FORE landscape, soft morning light through trees, 16:9

#### ป่าเบญจพรรณชานเมืองพระนครศรีอยุธยา — Phra Nakhon Si Ayutthaya Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Phra Nakhon Si Ayutthaya · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/phra-nakhon-si-ayutthaya-forest-camp-2-59/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองพระนครศรีอยุธยา  
  Minimal flat vector logo for a campsite "Phra Nakhon Si Ayutthaya Forest Camp 2" (ป่าเบญจพรรณชานเมืองพระนครศรีอยุธยา), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phra-nakhon-si-ayutthaya-forest-camp-2-59/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองพระนครศรีอยุธยา  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Phra Nakhon Si Ayutthaya Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/phra-nakhon-si-ayutthaya-forest-camp-2-59/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองพระนครศรีอยุธยา  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phra-nakhon-si-ayutthaya-forest-camp-2-59/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าเบญจพรรณชานเมืองพระนครศรีอยุธยา  
  signature hero view of Phra Nakhon Si Ayutthaya Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/phra-nakhon-si-ayutthaya-forest-camp-2-59/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าเบญจพรรณชานเมืองพระนครศรีอยุธยา  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าเบญจพรรณชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phra-nakhon-si-ayutthaya-forest-camp-2-59/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ป่าเบญจพรรณชานเมืองพระนครศรีอยุธยา  
  close detail of the ป่าลึก/ผจญภัย surroundings at ป่าเบญจพรรณชานเมือง Phra Nakhon Si Ayutthaya (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9

#### ริมแม่น้ำสายหลักอ่างทอง — Ang Thong Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Ang Thong · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/ang-thong-riverside-camp-1-60/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักอ่างทอง  
  Minimal flat vector logo for a campsite "Ang Thong Riverside Camp 1" (ริมแม่น้ำสายหลักอ่างทอง), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ang-thong-riverside-camp-1-60/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักอ่างทอง  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Ang Thong Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/ang-thong-riverside-camp-1-60/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักอ่างทอง  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9

#### ที่ราบเชิงเขาอ่างทอง — Ang Thong Meadow Camp 2  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Ang Thong · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/ang-thong-meadow-camp-2-61/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ที่ราบเชิงเขาอ่างทอง  
  Minimal flat vector logo for a campsite "Ang Thong Meadow Camp 2" (ที่ราบเชิงเขาอ่างทอง), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ang-thong-meadow-camp-2-61/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ที่ราบเชิงเขาอ่างทอง  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ที่ราบเชิงเขา Ang Thong Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/ang-thong-meadow-camp-2-61/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ที่ราบเชิงเขาอ่างทอง  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ที่ราบเชิงเขา Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/ang-thong-meadow-camp-2-61/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ที่ราบเชิงเขาอ่างทอง  
  signature hero view of Ang Thong Meadow Camp 2: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/ang-thong-meadow-camp-2-61/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ที่ราบเชิงเขาอ่างทอง  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ที่ราบเชิงเขา, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/ang-thong-meadow-camp-2-61/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ที่ราบเชิงเขาอ่างทอง  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at ที่ราบเชิงเขา Ang Thong (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/ang-thong-meadow-camp-2-61/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ที่ราบเชิงเขาอ่างทอง  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at ที่ราบเชิงเขา, tents arranged on the ground, surrounding MTNS and FORE landscape, clear starry night, 16:9

#### หาดชายฝั่งเงียบอ่างทอง — Ang Thong Beachside Camp 3  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Ang Thong · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/ang-thong-beachside-camp-3-62/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดชายฝั่งเงียบอ่างทอง  
  Minimal flat vector logo for a campsite "Ang Thong Beachside Camp 3" (หาดชายฝั่งเงียบอ่างทอง), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ang-thong-beachside-camp-3-62/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดชายฝั่งเงียบอ่างทอง  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดชายฝั่งเงียบ Ang Thong Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/ang-thong-beachside-camp-3-62/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดชายฝั่งเงียบอ่างทอง  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดชายฝั่งเงียบ Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/ang-thong-beachside-camp-3-62/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น หาดชายฝั่งเงียบอ่างทอง  
  signature hero view of Ang Thong Beachside Camp 3: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/ang-thong-beachside-camp-3-62/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ หาดชายฝั่งเงียบอ่างทอง  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in หาดชายฝั่งเงียบ, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/ang-thong-beachside-camp-3-62/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ หาดชายฝั่งเงียบอ่างทอง  
  close detail of the ริมทะเล/ชายหาด surroundings at หาดชายฝั่งเงียบ Ang Thong (BEAC terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/ang-thong-beachside-camp-3-62/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง หาดชายฝั่งเงียบอ่างทอง  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at หาดชายฝั่งเงียบ, tents arranged on the ground, surrounding BEAC landscape, warm sunset over the sea, 16:9

#### แนวป่าเขตรักษาพันธุ์ลพบุรี — Lop Buri Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Lop Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/lop-buri-forest-camp-1-63/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แนวป่าเขตรักษาพันธุ์ลพบุรี  
  Minimal flat vector logo for a campsite "Lop Buri Forest Camp 1" (แนวป่าเขตรักษาพันธุ์ลพบุรี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/lop-buri-forest-camp-1-63/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แนวป่าเขตรักษาพันธุ์ลพบุรี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at แนวป่าเขตรักษาพันธุ์ Lop Buri Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/lop-buri-forest-camp-1-63/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แนวป่าเขตรักษาพันธุ์ลพบุรี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, แนวป่าเขตรักษาพันธุ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/lop-buri-forest-camp-1-63/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แนวป่าเขตรักษาพันธุ์ลพบุรี  
  signature hero view of Lop Buri Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/lop-buri-forest-camp-1-63/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แนวป่าเขตรักษาพันธุ์ลพบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in แนวป่าเขตรักษาพันธุ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/lop-buri-forest-camp-1-63/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ แนวป่าเขตรักษาพันธุ์ลพบุรี  
  close detail of the ป่าลึก/ผจญภัย surroundings at แนวป่าเขตรักษาพันธุ์ Lop Buri (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/lop-buri-forest-camp-1-63/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง แนวป่าเขตรักษาพันธุ์ลพบุรี  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at แนวป่าเขตรักษาพันธุ์, tents arranged on the ground, surrounding FORE and MTNS landscape, misty early morning, 16:9

#### ฝั่งลำธารชนบทลพบุรี — Lop Buri Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Lop Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/lop-buri-riverside-camp-2-64/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ฝั่งลำธารชนบทลพบุรี  
  Minimal flat vector logo for a campsite "Lop Buri Riverside Camp 2" (ฝั่งลำธารชนบทลพบุรี), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/lop-buri-riverside-camp-2-64/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ฝั่งลำธารชนบทลพบุรี  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ฝั่งลำธารชนบท Lop Buri Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/lop-buri-riverside-camp-2-64/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ฝั่งลำธารชนบทลพบุรี  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ฝั่งลำธารชนบท Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9

#### อ่าวเล็กปลายแหลมลพบุรี — Lop Buri Beachside Camp 3  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Lop Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/lop-buri-beachside-camp-3-65/cover.jpg` (1:1, logo) — _alt:_ โลโก้ อ่าวเล็กปลายแหลมลพบุรี  
  Minimal flat vector logo for a campsite "Lop Buri Beachside Camp 3" (อ่าวเล็กปลายแหลมลพบุรี), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/lop-buri-beachside-camp-3-65/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง อ่าวเล็กปลายแหลมลพบุรี  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at อ่าวเล็กปลายแหลม Lop Buri Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/lop-buri-beachside-camp-3-65/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ อ่าวเล็กปลายแหลมลพบุรี  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, อ่าวเล็กปลายแหลม Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/lop-buri-beachside-camp-3-65/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น อ่าวเล็กปลายแหลมลพบุรี  
  signature hero view of Lop Buri Beachside Camp 3: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/lop-buri-beachside-camp-3-65/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ อ่าวเล็กปลายแหลมลพบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in อ่าวเล็กปลายแหลม, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/lop-buri-beachside-camp-3-65/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ อ่าวเล็กปลายแหลมลพบุรี  
  close detail of the ริมทะเล/ชายหาด surroundings at อ่าวเล็กปลายแหลม Lop Buri (BEAC terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/lop-buri-beachside-camp-3-65/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง อ่าวเล็กปลายแหลมลพบุรี  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at อ่าวเล็กปลายแหลม, tents arranged on the ground, surrounding BEAC landscape, warm sunset over the sea, 16:9

#### แนวป่าเขตรักษาพันธุ์สิงห์บุรี — Sing Buri Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Sing Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/sing-buri-forest-camp-1-66/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แนวป่าเขตรักษาพันธุ์สิงห์บุรี  
  Minimal flat vector logo for a campsite "Sing Buri Forest Camp 1" (แนวป่าเขตรักษาพันธุ์สิงห์บุรี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sing-buri-forest-camp-1-66/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แนวป่าเขตรักษาพันธุ์สิงห์บุรี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at แนวป่าเขตรักษาพันธุ์ Sing Buri Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/sing-buri-forest-camp-1-66/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แนวป่าเขตรักษาพันธุ์สิงห์บุรี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, แนวป่าเขตรักษาพันธุ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/sing-buri-forest-camp-1-66/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แนวป่าเขตรักษาพันธุ์สิงห์บุรี  
  signature hero view of Sing Buri Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/sing-buri-forest-camp-1-66/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แนวป่าเขตรักษาพันธุ์สิงห์บุรี  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in แนวป่าเขตรักษาพันธุ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/sing-buri-forest-camp-1-66/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ แนวป่าเขตรักษาพันธุ์สิงห์บุรี  
  close detail of the ป่าลึก/ผจญภัย surroundings at แนวป่าเขตรักษาพันธุ์ Sing Buri (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/sing-buri-forest-camp-1-66/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง แนวป่าเขตรักษาพันธุ์สิงห์บุรี  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at แนวป่าเขตรักษาพันธุ์, tents arranged on the ground, surrounding FORE and MTNS landscape, misty early morning, 16:9

#### ริมคลองร่มรื่นสิงห์บุรี — Sing Buri Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Sing Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/sing-buri-riverside-camp-2-67/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นสิงห์บุรี  
  Minimal flat vector logo for a campsite "Sing Buri Riverside Camp 2" (ริมคลองร่มรื่นสิงห์บุรี), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sing-buri-riverside-camp-2-67/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นสิงห์บุรี  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Sing Buri Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/sing-buri-riverside-camp-2-67/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นสิงห์บุรี  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9

#### ฝั่งลำธารชนบทสิงห์บุรี — Sing Buri Riverside Camp 3  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Sing Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/sing-buri-riverside-camp-3-68/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ฝั่งลำธารชนบทสิงห์บุรี  
  Minimal flat vector logo for a campsite "Sing Buri Riverside Camp 3" (ฝั่งลำธารชนบทสิงห์บุรี), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sing-buri-riverside-camp-3-68/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ฝั่งลำธารชนบทสิงห์บุรี  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ฝั่งลำธารชนบท Sing Buri Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9

#### ฝั่งลำธารชนบทชัยนาท — Chai Nat Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Chai Nat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/chai-nat-riverside-camp-1-69/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ฝั่งลำธารชนบทชัยนาท  
  Minimal flat vector logo for a campsite "Chai Nat Riverside Camp 1" (ฝั่งลำธารชนบทชัยนาท), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chai-nat-riverside-camp-1-69/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ฝั่งลำธารชนบทชัยนาท  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ฝั่งลำธารชนบท Chai Nat Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/chai-nat-riverside-camp-1-69/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ฝั่งลำธารชนบทชัยนาท  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ฝั่งลำธารชนบท Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chai-nat-riverside-camp-1-69/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ฝั่งลำธารชนบทชัยนาท  
  signature hero view of Chai Nat Riverside Camp 1: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9

#### หาดชายฝั่งเงียบชัยนาท — Chai Nat Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Chai Nat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/chai-nat-beachside-camp-2-70/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดชายฝั่งเงียบชัยนาท  
  Minimal flat vector logo for a campsite "Chai Nat Beachside Camp 2" (หาดชายฝั่งเงียบชัยนาท), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chai-nat-beachside-camp-2-70/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดชายฝั่งเงียบชัยนาท  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดชายฝั่งเงียบ Chai Nat Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/chai-nat-beachside-camp-2-70/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดชายฝั่งเงียบชัยนาท  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดชายฝั่งเงียบ Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chai-nat-beachside-camp-2-70/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น หาดชายฝั่งเงียบชัยนาท  
  signature hero view of Chai Nat Beachside Camp 2: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/chai-nat-beachside-camp-2-70/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ หาดชายฝั่งเงียบชัยนาท  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in หาดชายฝั่งเงียบ, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/chai-nat-beachside-camp-2-70/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ หาดชายฝั่งเงียบชัยนาท  
  close detail of the ริมทะเล/ชายหาด surroundings at หาดชายฝั่งเงียบ Chai Nat (BEAC terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/chai-nat-beachside-camp-2-70/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง หาดชายฝั่งเงียบชัยนาท  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at หาดชายฝั่งเงียบ, tents arranged on the ground, surrounding BEAC landscape, warm sunset over the sea, 16:9
- `/seed/camps/chai-nat-beachside-camp-2-70/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน หาดชายฝั่งเงียบชัยนาท  
  night scene of Chai Nat Beachside Camp 2, glowing tents and warm string lights at a ริมทะเล/ชายหาด site in หาดชายฝั่งเงียบ, starry sky, long exposure, cozy mood, 16:9

#### ทุ่งโล่งชานเมืองสระบุรี — Saraburi Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Saraburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/saraburi-meadow-camp-1-71/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งโล่งชานเมืองสระบุรี  
  Minimal flat vector logo for a campsite "Saraburi Meadow Camp 1" (ทุ่งโล่งชานเมืองสระบุรี), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/saraburi-meadow-camp-1-71/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งโล่งชานเมืองสระบุรี  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ทุ่งโล่งชานเมือง Saraburi Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/saraburi-meadow-camp-1-71/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งโล่งชานเมืองสระบุรี  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ทุ่งโล่งชานเมือง Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9

#### หาดชายฝั่งเงียบสระบุรี — Saraburi Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Saraburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/saraburi-beachside-camp-2-72/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดชายฝั่งเงียบสระบุรี  
  Minimal flat vector logo for a campsite "Saraburi Beachside Camp 2" (หาดชายฝั่งเงียบสระบุรี), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/saraburi-beachside-camp-2-72/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดชายฝั่งเงียบสระบุรี  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดชายฝั่งเงียบ Saraburi Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/saraburi-beachside-camp-2-72/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดชายฝั่งเงียบสระบุรี  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดชายฝั่งเงียบ Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/saraburi-beachside-camp-2-72/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น หาดชายฝั่งเงียบสระบุรี  
  signature hero view of Saraburi Beachside Camp 2: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9

### โฮสต์ RGE — บริษัท ตะวันออกแคมป์ กรุ๊ป จำกัด (COMPANY)

#### ฝั่งลำธารชนบทชลบุรี — Chon Buri Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Chon Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/chon-buri-riverside-camp-1-73/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ฝั่งลำธารชนบทชลบุรี  
  Minimal flat vector logo for a campsite "Chon Buri Riverside Camp 1" (ฝั่งลำธารชนบทชลบุรี), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chon-buri-riverside-camp-1-73/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ฝั่งลำธารชนบทชลบุรี  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ฝั่งลำธารชนบท Chon Buri Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9

#### แหลมหาดทรายชลบุรี — Chon Buri Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Chon Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/chon-buri-beachside-camp-2-74/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายชลบุรี  
  Minimal flat vector logo for a campsite "Chon Buri Beachside Camp 2" (แหลมหาดทรายชลบุรี), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chon-buri-beachside-camp-2-74/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายชลบุรี  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Chon Buri Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/chon-buri-beachside-camp-2-74/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหลมหาดทรายชลบุรี  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, แหลมหาดทราย Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chon-buri-beachside-camp-2-74/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหลมหาดทรายชลบุรี  
  signature hero view of Chon Buri Beachside Camp 2: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/chon-buri-beachside-camp-2-74/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แหลมหาดทรายชลบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in แหลมหาดทราย, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/chon-buri-beachside-camp-2-74/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ แหลมหาดทรายชลบุรี  
  close detail of the ริมทะเล/ชายหาด surroundings at แหลมหาดทราย Chon Buri (BEAC terrain), natural textures and foliage, soft light, 16:9

#### แหลมหาดทรายระยอง — Rayong Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Rayong · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/rayong-beachside-camp-1-75/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายระยอง  
  Minimal flat vector logo for a campsite "Rayong Beachside Camp 1" (แหลมหาดทรายระยอง), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/rayong-beachside-camp-1-75/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายระยอง  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Rayong Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9

#### หาดชายฝั่งเงียบระยอง — Rayong Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Rayong · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/rayong-beachside-camp-2-76/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดชายฝั่งเงียบระยอง  
  Minimal flat vector logo for a campsite "Rayong Beachside Camp 2" (หาดชายฝั่งเงียบระยอง), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/rayong-beachside-camp-2-76/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดชายฝั่งเงียบระยอง  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดชายฝั่งเงียบ Rayong Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/rayong-beachside-camp-2-76/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดชายฝั่งเงียบระยอง  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดชายฝั่งเงียบ Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9

#### ริมแม่น้ำสายหลักระยอง — Rayong Riverside Camp 3  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Rayong · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/rayong-riverside-camp-3-77/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักระยอง  
  Minimal flat vector logo for a campsite "Rayong Riverside Camp 3" (ริมแม่น้ำสายหลักระยอง), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/rayong-riverside-camp-3-77/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักระยอง  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Rayong Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/rayong-riverside-camp-3-77/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักระยอง  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9

#### แหลมหาดทรายจันทบุรี — Chanthaburi Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Chanthaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/chanthaburi-beachside-camp-1-78/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายจันทบุรี  
  Minimal flat vector logo for a campsite "Chanthaburi Beachside Camp 1" (แหลมหาดทรายจันทบุรี), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chanthaburi-beachside-camp-1-78/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายจันทบุรี  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Chanthaburi Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/chanthaburi-beachside-camp-1-78/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหลมหาดทรายจันทบุรี  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, แหลมหาดทราย Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chanthaburi-beachside-camp-1-78/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหลมหาดทรายจันทบุรี  
  signature hero view of Chanthaburi Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/chanthaburi-beachside-camp-1-78/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แหลมหาดทรายจันทบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in แหลมหาดทราย, warm evening glow, candid lifestyle photo, 16:9

#### หาดชายฝั่งเงียบจันทบุรี — Chanthaburi Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Chanthaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/chanthaburi-beachside-camp-2-79/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดชายฝั่งเงียบจันทบุรี  
  Minimal flat vector logo for a campsite "Chanthaburi Beachside Camp 2" (หาดชายฝั่งเงียบจันทบุรี), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chanthaburi-beachside-camp-2-79/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดชายฝั่งเงียบจันทบุรี  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดชายฝั่งเงียบ Chanthaburi Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/chanthaburi-beachside-camp-2-79/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดชายฝั่งเงียบจันทบุรี  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดชายฝั่งเงียบ Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9

#### ชายป่าอนุรักษ์ฉะเชิงเทรา — Chachoengsao Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Chachoengsao · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/chachoengsao-forest-camp-1-80/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์ฉะเชิงเทรา  
  Minimal flat vector logo for a campsite "Chachoengsao Forest Camp 1" (ชายป่าอนุรักษ์ฉะเชิงเทรา), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chachoengsao-forest-camp-1-80/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์ฉะเชิงเทรา  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Chachoengsao Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/chachoengsao-forest-camp-1-80/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์ฉะเชิงเทรา  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chachoengsao-forest-camp-1-80/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์ฉะเชิงเทรา  
  signature hero view of Chachoengsao Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9

#### ป่าชุมชนใกล้เมืองฉะเชิงเทรา — Chachoengsao Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Chachoengsao · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/chachoengsao-forest-camp-2-81/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองฉะเชิงเทรา  
  Minimal flat vector logo for a campsite "Chachoengsao Forest Camp 2" (ป่าชุมชนใกล้เมืองฉะเชิงเทรา), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chachoengsao-forest-camp-2-81/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองฉะเชิงเทรา  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Chachoengsao Thailand, misty early morning, photorealistic, highly detailed, 16:9

#### ต้นน้ำชานเมืองปราจีนบุรี — Prachin Buri Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Prachin Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/prachin-buri-riverside-camp-1-82/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองปราจีนบุรี  
  Minimal flat vector logo for a campsite "Prachin Buri Riverside Camp 1" (ต้นน้ำชานเมืองปราจีนบุรี), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/prachin-buri-riverside-camp-1-82/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองปราจีนบุรี  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Prachin Buri Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/prachin-buri-riverside-camp-1-82/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ต้นน้ำชานเมืองปราจีนบุรี  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ต้นน้ำชานเมือง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/prachin-buri-riverside-camp-1-82/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ต้นน้ำชานเมืองปราจีนบุรี  
  signature hero view of Prachin Buri Riverside Camp 1: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/prachin-buri-riverside-camp-1-82/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ต้นน้ำชานเมืองปราจีนบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ต้นน้ำชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/prachin-buri-riverside-camp-1-82/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ต้นน้ำชานเมืองปราจีนบุรี  
  close detail of the ริมน้ำ/ลำธาร surroundings at ต้นน้ำชานเมือง Prachin Buri (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/prachin-buri-riverside-camp-1-82/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ต้นน้ำชานเมืองปราจีนบุรี  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ต้นน้ำชานเมือง, tents arranged on the ground, surrounding RIVE and FORE landscape, soft morning light through trees, 16:9
- `/seed/camps/prachin-buri-riverside-camp-1-82/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ต้นน้ำชานเมืองปราจีนบุรี  
  night scene of Prachin Buri Riverside Camp 1, glowing tents and warm string lights at a ริมน้ำ/ลำธาร site in ต้นน้ำชานเมือง, starry sky, long exposure, cozy mood, 16:9

#### แหลมหาดทรายปราจีนบุรี — Prachin Buri Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Prachin Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/prachin-buri-beachside-camp-2-83/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายปราจีนบุรี  
  Minimal flat vector logo for a campsite "Prachin Buri Beachside Camp 2" (แหลมหาดทรายปราจีนบุรี), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/prachin-buri-beachside-camp-2-83/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายปราจีนบุรี  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Prachin Buri Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/prachin-buri-beachside-camp-2-83/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหลมหาดทรายปราจีนบุรี  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, แหลมหาดทราย Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/prachin-buri-beachside-camp-2-83/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหลมหาดทรายปราจีนบุรี  
  signature hero view of Prachin Buri Beachside Camp 2: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9

### โฮสต์ RGC — อัครเดช ที่ราบกลาง (INDIVIDUAL)

#### ทุ่งโล่งชานเมืองนครนายก — Nakhon Nayok Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Nakhon Nayok · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/nakhon-nayok-meadow-camp-1-84/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งโล่งชานเมืองนครนายก  
  Minimal flat vector logo for a campsite "Nakhon Nayok Meadow Camp 1" (ทุ่งโล่งชานเมืองนครนายก), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-nayok-meadow-camp-1-84/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งโล่งชานเมืองนครนายก  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ทุ่งโล่งชานเมือง Nakhon Nayok Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-nayok-meadow-camp-1-84/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งโล่งชานเมืองนครนายก  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ทุ่งโล่งชานเมือง Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9

#### ที่ราบเชิงเขานครนายก — Nakhon Nayok Meadow Camp 2  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Nakhon Nayok · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/nakhon-nayok-meadow-camp-2-85/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ที่ราบเชิงเขานครนายก  
  Minimal flat vector logo for a campsite "Nakhon Nayok Meadow Camp 2" (ที่ราบเชิงเขานครนายก), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-nayok-meadow-camp-2-85/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ที่ราบเชิงเขานครนายก  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ที่ราบเชิงเขา Nakhon Nayok Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-nayok-meadow-camp-2-85/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ที่ราบเชิงเขานครนายก  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ที่ราบเชิงเขา Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-nayok-meadow-camp-2-85/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ที่ราบเชิงเขานครนายก  
  signature hero view of Nakhon Nayok Meadow Camp 2: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/nakhon-nayok-meadow-camp-2-85/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ที่ราบเชิงเขานครนายก  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ที่ราบเชิงเขา, warm evening glow, candid lifestyle photo, 16:9

### โฮสต์ RGE — บริษัท ตะวันออกแคมป์ กรุ๊ป จำกัด (COMPANY)

#### แหลมหาดทรายสระแก้ว — Sa Kaeo Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Sa Kaeo · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/sa-kaeo-beachside-camp-1-86/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายสระแก้ว  
  Minimal flat vector logo for a campsite "Sa Kaeo Beachside Camp 1" (แหลมหาดทรายสระแก้ว), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sa-kaeo-beachside-camp-1-86/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายสระแก้ว  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Sa Kaeo Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/sa-kaeo-beachside-camp-1-86/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหลมหาดทรายสระแก้ว  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, แหลมหาดทราย Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/sa-kaeo-beachside-camp-1-86/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหลมหาดทรายสระแก้ว  
  signature hero view of Sa Kaeo Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/sa-kaeo-beachside-camp-1-86/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แหลมหาดทรายสระแก้ว  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in แหลมหาดทราย, warm evening glow, candid lifestyle photo, 16:9

#### ต้นน้ำชานเมืองสระแก้ว — Sa Kaeo Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Sa Kaeo · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/sa-kaeo-riverside-camp-2-87/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองสระแก้ว  
  Minimal flat vector logo for a campsite "Sa Kaeo Riverside Camp 2" (ต้นน้ำชานเมืองสระแก้ว), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sa-kaeo-riverside-camp-2-87/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองสระแก้ว  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Sa Kaeo Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/sa-kaeo-riverside-camp-2-87/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ต้นน้ำชานเมืองสระแก้ว  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ต้นน้ำชานเมือง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9

### โฮสต์ RGNE — ห้างหุ้นส่วนจำกัด อีสานฟาร์มสเตย์ (PARTNERSHIP)

#### ป่าเบญจพรรณชานเมืองบุรีรัมย์ — Buri Ram Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Buri Ram · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/buri-ram-forest-camp-1-88/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองบุรีรัมย์  
  Minimal flat vector logo for a campsite "Buri Ram Forest Camp 1" (ป่าเบญจพรรณชานเมืองบุรีรัมย์), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/buri-ram-forest-camp-1-88/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองบุรีรัมย์  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Buri Ram Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/buri-ram-forest-camp-1-88/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองบุรีรัมย์  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/buri-ram-forest-camp-1-88/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าเบญจพรรณชานเมืองบุรีรัมย์  
  signature hero view of Buri Ram Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/buri-ram-forest-camp-1-88/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าเบญจพรรณชานเมืองบุรีรัมย์  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าเบญจพรรณชานเมือง, warm evening glow, candid lifestyle photo, 16:9

#### ฝั่งลำธารชนบทบุรีรัมย์ — Buri Ram Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Buri Ram · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/buri-ram-riverside-camp-2-89/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ฝั่งลำธารชนบทบุรีรัมย์  
  Minimal flat vector logo for a campsite "Buri Ram Riverside Camp 2" (ฝั่งลำธารชนบทบุรีรัมย์), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/buri-ram-riverside-camp-2-89/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ฝั่งลำธารชนบทบุรีรัมย์  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ฝั่งลำธารชนบท Buri Ram Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/buri-ram-riverside-camp-2-89/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ฝั่งลำธารชนบทบุรีรัมย์  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ฝั่งลำธารชนบท Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/buri-ram-riverside-camp-2-89/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ฝั่งลำธารชนบทบุรีรัมย์  
  signature hero view of Buri Ram Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9

#### ต้นน้ำชานเมืองบุรีรัมย์ — Buri Ram Riverside Camp 3  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Buri Ram · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/buri-ram-riverside-camp-3-90/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองบุรีรัมย์  
  Minimal flat vector logo for a campsite "Buri Ram Riverside Camp 3" (ต้นน้ำชานเมืองบุรีรัมย์), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/buri-ram-riverside-camp-3-90/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองบุรีรัมย์  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Buri Ram Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/buri-ram-riverside-camp-3-90/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ต้นน้ำชานเมืองบุรีรัมย์  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ต้นน้ำชานเมือง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/buri-ram-riverside-camp-3-90/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ต้นน้ำชานเมืองบุรีรัมย์  
  signature hero view of Buri Ram Riverside Camp 3: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/buri-ram-riverside-camp-3-90/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ต้นน้ำชานเมืองบุรีรัมย์  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ต้นน้ำชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/buri-ram-riverside-camp-3-90/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ต้นน้ำชานเมืองบุรีรัมย์  
  close detail of the ริมน้ำ/ลำธาร surroundings at ต้นน้ำชานเมือง Buri Ram (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/buri-ram-riverside-camp-3-90/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ต้นน้ำชานเมืองบุรีรัมย์  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ต้นน้ำชานเมือง, tents arranged on the ground, surrounding RIVE and FORE landscape, soft morning light through trees, 16:9
- `/seed/camps/buri-ram-riverside-camp-3-90/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ต้นน้ำชานเมืองบุรีรัมย์  
  night scene of Buri Ram Riverside Camp 3, glowing tents and warm string lights at a ริมน้ำ/ลำธาร site in ต้นน้ำชานเมือง, starry sky, long exposure, cozy mood, 16:9

#### ทุ่งโล่งชานเมืองสุรินทร์ — Surin Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Surin · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/surin-meadow-camp-1-91/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งโล่งชานเมืองสุรินทร์  
  Minimal flat vector logo for a campsite "Surin Meadow Camp 1" (ทุ่งโล่งชานเมืองสุรินทร์), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/surin-meadow-camp-1-91/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งโล่งชานเมืองสุรินทร์  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ทุ่งโล่งชานเมือง Surin Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/surin-meadow-camp-1-91/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งโล่งชานเมืองสุรินทร์  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ทุ่งโล่งชานเมือง Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/surin-meadow-camp-1-91/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทุ่งโล่งชานเมืองสุรินทร์  
  signature hero view of Surin Meadow Camp 1: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/surin-meadow-camp-1-91/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ทุ่งโล่งชานเมืองสุรินทร์  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ทุ่งโล่งชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/surin-meadow-camp-1-91/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ทุ่งโล่งชานเมืองสุรินทร์  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at ทุ่งโล่งชานเมือง Surin (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/surin-meadow-camp-1-91/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ทุ่งโล่งชานเมืองสุรินทร์  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at ทุ่งโล่งชานเมือง, tents arranged on the ground, surrounding MTNS and FORE landscape, clear starry night, 16:9
- `/seed/camps/surin-meadow-camp-1-91/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ทุ่งโล่งชานเมืองสุรินทร์  
  night scene of Surin Meadow Camp 1, glowing tents and warm string lights at a ทุ่งหญ้า/ชมดาว site in ทุ่งโล่งชานเมือง, starry sky, long exposure, cozy mood, 16:9

#### ริมคลองร่มรื่นสุรินทร์ — Surin Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Surin · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/surin-riverside-camp-2-92/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นสุรินทร์  
  Minimal flat vector logo for a campsite "Surin Riverside Camp 2" (ริมคลองร่มรื่นสุรินทร์), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/surin-riverside-camp-2-92/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นสุรินทร์  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Surin Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9

#### ป่าเบญจพรรณชานเมืองสุรินทร์ — Surin Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Surin · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/surin-forest-camp-3-93/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองสุรินทร์  
  Minimal flat vector logo for a campsite "Surin Forest Camp 3" (ป่าเบญจพรรณชานเมืองสุรินทร์), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/surin-forest-camp-3-93/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองสุรินทร์  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Surin Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/surin-forest-camp-3-93/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองสุรินทร์  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/surin-forest-camp-3-93/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าเบญจพรรณชานเมืองสุรินทร์  
  signature hero view of Surin Forest Camp 3: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/surin-forest-camp-3-93/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าเบญจพรรณชานเมืองสุรินทร์  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าเบญจพรรณชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/surin-forest-camp-3-93/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ป่าเบญจพรรณชานเมืองสุรินทร์  
  close detail of the ป่าลึก/ผจญภัย surroundings at ป่าเบญจพรรณชานเมือง Surin (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9

#### ริมแม่น้ำสายหลักศรีสะเกษ — Si Sa Ket Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Si Sa Ket · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/si-sa-ket-riverside-camp-1-94/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักศรีสะเกษ  
  Minimal flat vector logo for a campsite "Si Sa Ket Riverside Camp 1" (ริมแม่น้ำสายหลักศรีสะเกษ), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/si-sa-ket-riverside-camp-1-94/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักศรีสะเกษ  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Si Sa Ket Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/si-sa-ket-riverside-camp-1-94/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักศรีสะเกษ  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/si-sa-ket-riverside-camp-1-94/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมแม่น้ำสายหลักศรีสะเกษ  
  signature hero view of Si Sa Ket Riverside Camp 1: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9

#### ริมแม่น้ำสายหลักศรีสะเกษ — Si Sa Ket Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Si Sa Ket · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/si-sa-ket-riverside-camp-2-95/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักศรีสะเกษ  
  Minimal flat vector logo for a campsite "Si Sa Ket Riverside Camp 2" (ริมแม่น้ำสายหลักศรีสะเกษ), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/si-sa-ket-riverside-camp-2-95/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักศรีสะเกษ  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Si Sa Ket Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/si-sa-ket-riverside-camp-2-95/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักศรีสะเกษ  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9

#### ที่ราบเชิงเขาศรีสะเกษ — Si Sa Ket Meadow Camp 3  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Si Sa Ket · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/si-sa-ket-meadow-camp-3-96/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ที่ราบเชิงเขาศรีสะเกษ  
  Minimal flat vector logo for a campsite "Si Sa Ket Meadow Camp 3" (ที่ราบเชิงเขาศรีสะเกษ), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/si-sa-ket-meadow-camp-3-96/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ที่ราบเชิงเขาศรีสะเกษ  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ที่ราบเชิงเขา Si Sa Ket Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/si-sa-ket-meadow-camp-3-96/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ที่ราบเชิงเขาศรีสะเกษ  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ที่ราบเชิงเขา Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/si-sa-ket-meadow-camp-3-96/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ที่ราบเชิงเขาศรีสะเกษ  
  signature hero view of Si Sa Ket Meadow Camp 3: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/si-sa-ket-meadow-camp-3-96/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ที่ราบเชิงเขาศรีสะเกษ  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ที่ราบเชิงเขา, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/si-sa-ket-meadow-camp-3-96/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ที่ราบเชิงเขาศรีสะเกษ  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at ที่ราบเชิงเขา Si Sa Ket (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/si-sa-ket-meadow-camp-3-96/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ที่ราบเชิงเขาศรีสะเกษ  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at ที่ราบเชิงเขา, tents arranged on the ground, surrounding MTNS and FORE landscape, clear starry night, 16:9

#### ชายป่าอนุรักษ์อุบลราชธานี — Ubon Ratchathani Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Ubon Ratchathani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/ubon-ratchathani-forest-camp-1-97/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์อุบลราชธานี  
  Minimal flat vector logo for a campsite "Ubon Ratchathani Forest Camp 1" (ชายป่าอนุรักษ์อุบลราชธานี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ubon-ratchathani-forest-camp-1-97/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์อุบลราชธานี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Ubon Ratchathani Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/ubon-ratchathani-forest-camp-1-97/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์อุบลราชธานี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/ubon-ratchathani-forest-camp-1-97/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์อุบลราชธานี  
  signature hero view of Ubon Ratchathani Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/ubon-ratchathani-forest-camp-1-97/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์อุบลราชธานี  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/ubon-ratchathani-forest-camp-1-97/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ชายป่าอนุรักษ์อุบลราชธานี  
  close detail of the ป่าลึก/ผจญภัย surroundings at ชายป่าอนุรักษ์ Ubon Ratchathani (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9

#### ป่าเบญจพรรณชานเมืองอุบลราชธานี — Ubon Ratchathani Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Ubon Ratchathani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/ubon-ratchathani-forest-camp-2-98/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองอุบลราชธานี  
  Minimal flat vector logo for a campsite "Ubon Ratchathani Forest Camp 2" (ป่าเบญจพรรณชานเมืองอุบลราชธานี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ubon-ratchathani-forest-camp-2-98/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองอุบลราชธานี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Ubon Ratchathani Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/ubon-ratchathani-forest-camp-2-98/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองอุบลราชธานี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/ubon-ratchathani-forest-camp-2-98/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าเบญจพรรณชานเมืองอุบลราชธานี  
  signature hero view of Ubon Ratchathani Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9

#### ป่าชุมชนใกล้เมืองยโสธร — Yasothon Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Yasothon · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/yasothon-forest-camp-1-99/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองยโสธร  
  Minimal flat vector logo for a campsite "Yasothon Forest Camp 1" (ป่าชุมชนใกล้เมืองยโสธร), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/yasothon-forest-camp-1-99/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองยโสธร  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Yasothon Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/yasothon-forest-camp-1-99/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าชุมชนใกล้เมืองยโสธร  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าชุมชนใกล้เมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9

#### ฝั่งลำธารชนบทยโสธร — Yasothon Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Yasothon · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/yasothon-riverside-camp-2-100/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ฝั่งลำธารชนบทยโสธร  
  Minimal flat vector logo for a campsite "Yasothon Riverside Camp 2" (ฝั่งลำธารชนบทยโสธร), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/yasothon-riverside-camp-2-100/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ฝั่งลำธารชนบทยโสธร  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ฝั่งลำธารชนบท Yasothon Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9

#### แนวป่าเขตรักษาพันธุ์ชัยภูมิ — Chaiyaphum Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Chaiyaphum · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/chaiyaphum-forest-camp-1-101/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แนวป่าเขตรักษาพันธุ์ชัยภูมิ  
  Minimal flat vector logo for a campsite "Chaiyaphum Forest Camp 1" (แนวป่าเขตรักษาพันธุ์ชัยภูมิ), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chaiyaphum-forest-camp-1-101/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แนวป่าเขตรักษาพันธุ์ชัยภูมิ  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at แนวป่าเขตรักษาพันธุ์ Chaiyaphum Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/chaiyaphum-forest-camp-1-101/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แนวป่าเขตรักษาพันธุ์ชัยภูมิ  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, แนวป่าเขตรักษาพันธุ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9

#### แนวป่าเขตรักษาพันธุ์ชัยภูมิ — Chaiyaphum Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Chaiyaphum · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/chaiyaphum-forest-camp-2-102/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แนวป่าเขตรักษาพันธุ์ชัยภูมิ  
  Minimal flat vector logo for a campsite "Chaiyaphum Forest Camp 2" (แนวป่าเขตรักษาพันธุ์ชัยภูมิ), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chaiyaphum-forest-camp-2-102/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แนวป่าเขตรักษาพันธุ์ชัยภูมิ  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at แนวป่าเขตรักษาพันธุ์ Chaiyaphum Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/chaiyaphum-forest-camp-2-102/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แนวป่าเขตรักษาพันธุ์ชัยภูมิ  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, แนวป่าเขตรักษาพันธุ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9

#### ฝั่งลำธารชนบทอำนาจเจริญ — Amnat Charoen Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Amnat Charoen · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/amnat-charoen-riverside-camp-1-103/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ฝั่งลำธารชนบทอำนาจเจริญ  
  Minimal flat vector logo for a campsite "Amnat Charoen Riverside Camp 1" (ฝั่งลำธารชนบทอำนาจเจริญ), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/amnat-charoen-riverside-camp-1-103/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ฝั่งลำธารชนบทอำนาจเจริญ  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ฝั่งลำธารชนบท Amnat Charoen Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9

#### ฝั่งลำธารชนบทอำนาจเจริญ — Amnat Charoen Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Amnat Charoen · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/amnat-charoen-riverside-camp-2-104/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ฝั่งลำธารชนบทอำนาจเจริญ  
  Minimal flat vector logo for a campsite "Amnat Charoen Riverside Camp 2" (ฝั่งลำธารชนบทอำนาจเจริญ), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/amnat-charoen-riverside-camp-2-104/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ฝั่งลำธารชนบทอำนาจเจริญ  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ฝั่งลำธารชนบท Amnat Charoen Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/amnat-charoen-riverside-camp-2-104/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ฝั่งลำธารชนบทอำนาจเจริญ  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ฝั่งลำธารชนบท Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/amnat-charoen-riverside-camp-2-104/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ฝั่งลำธารชนบทอำนาจเจริญ  
  signature hero view of Amnat Charoen Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/amnat-charoen-riverside-camp-2-104/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ฝั่งลำธารชนบทอำนาจเจริญ  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ฝั่งลำธารชนบท, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/amnat-charoen-riverside-camp-2-104/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ฝั่งลำธารชนบทอำนาจเจริญ  
  close detail of the ริมน้ำ/ลำธาร surroundings at ฝั่งลำธารชนบท Amnat Charoen (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/amnat-charoen-riverside-camp-2-104/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ฝั่งลำธารชนบทอำนาจเจริญ  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ฝั่งลำธารชนบท, tents arranged on the ground, surrounding RIVE and FORE landscape, soft morning light through trees, 16:9
- `/seed/camps/amnat-charoen-riverside-camp-2-104/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ฝั่งลำธารชนบทอำนาจเจริญ  
  night scene of Amnat Charoen Riverside Camp 2, glowing tents and warm string lights at a ริมน้ำ/ลำธาร site in ฝั่งลำธารชนบท, starry sky, long exposure, cozy mood, 16:9

#### แนวป่าเขตรักษาพันธุ์อำนาจเจริญ — Amnat Charoen Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Amnat Charoen · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/amnat-charoen-forest-camp-3-105/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แนวป่าเขตรักษาพันธุ์อำนาจเจริญ  
  Minimal flat vector logo for a campsite "Amnat Charoen Forest Camp 3" (แนวป่าเขตรักษาพันธุ์อำนาจเจริญ), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/amnat-charoen-forest-camp-3-105/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แนวป่าเขตรักษาพันธุ์อำนาจเจริญ  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at แนวป่าเขตรักษาพันธุ์ Amnat Charoen Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/amnat-charoen-forest-camp-3-105/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แนวป่าเขตรักษาพันธุ์อำนาจเจริญ  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, แนวป่าเขตรักษาพันธุ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/amnat-charoen-forest-camp-3-105/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แนวป่าเขตรักษาพันธุ์อำนาจเจริญ  
  signature hero view of Amnat Charoen Forest Camp 3: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/amnat-charoen-forest-camp-3-105/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แนวป่าเขตรักษาพันธุ์อำนาจเจริญ  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in แนวป่าเขตรักษาพันธุ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/amnat-charoen-forest-camp-3-105/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ แนวป่าเขตรักษาพันธุ์อำนาจเจริญ  
  close detail of the ป่าลึก/ผจญภัย surroundings at แนวป่าเขตรักษาพันธุ์ Amnat Charoen (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/amnat-charoen-forest-camp-3-105/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง แนวป่าเขตรักษาพันธุ์อำนาจเจริญ  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at แนวป่าเขตรักษาพันธุ์, tents arranged on the ground, surrounding FORE and MTNS landscape, misty early morning, 16:9

#### เนินหญ้าชายทุ่งบึงกาฬ — Bueng Kan Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Bueng Kan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/bueng-kan-meadow-camp-1-106/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เนินหญ้าชายทุ่งบึงกาฬ  
  Minimal flat vector logo for a campsite "Bueng Kan Meadow Camp 1" (เนินหญ้าชายทุ่งบึงกาฬ), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/bueng-kan-meadow-camp-1-106/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เนินหญ้าชายทุ่งบึงกาฬ  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at เนินหญ้าชายทุ่ง Bueng Kan Thailand, clear starry night, photorealistic, highly detailed, 16:9

#### ป่าเบญจพรรณชานเมืองบึงกาฬ — Bueng Kan Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Bueng Kan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/bueng-kan-forest-camp-2-107/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองบึงกาฬ  
  Minimal flat vector logo for a campsite "Bueng Kan Forest Camp 2" (ป่าเบญจพรรณชานเมืองบึงกาฬ), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/bueng-kan-forest-camp-2-107/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองบึงกาฬ  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Bueng Kan Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/bueng-kan-forest-camp-2-107/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองบึงกาฬ  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/bueng-kan-forest-camp-2-107/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าเบญจพรรณชานเมืองบึงกาฬ  
  signature hero view of Bueng Kan Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/bueng-kan-forest-camp-2-107/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าเบญจพรรณชานเมืองบึงกาฬ  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าเบญจพรรณชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/bueng-kan-forest-camp-2-107/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ป่าเบญจพรรณชานเมืองบึงกาฬ  
  close detail of the ป่าลึก/ผจญภัย surroundings at ป่าเบญจพรรณชานเมือง Bueng Kan (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/bueng-kan-forest-camp-2-107/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ป่าเบญจพรรณชานเมืองบึงกาฬ  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ป่าเบญจพรรณชานเมือง, tents arranged on the ground, surrounding FORE and MTNS landscape, misty early morning, 16:9
- `/seed/camps/bueng-kan-forest-camp-2-107/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ป่าเบญจพรรณชานเมืองบึงกาฬ  
  night scene of Bueng Kan Forest Camp 2, glowing tents and warm string lights at a ป่าลึก/ผจญภัย site in ป่าเบญจพรรณชานเมือง, starry sky, long exposure, cozy mood, 16:9

#### แนวป่าเขตรักษาพันธุ์หนองบัวลำภู — Nong Bua Lam Phu Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Nong Bua Lam Phu · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/nong-bua-lam-phu-forest-camp-1-108/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แนวป่าเขตรักษาพันธุ์หนองบัวลำภู  
  Minimal flat vector logo for a campsite "Nong Bua Lam Phu Forest Camp 1" (แนวป่าเขตรักษาพันธุ์หนองบัวลำภู), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nong-bua-lam-phu-forest-camp-1-108/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แนวป่าเขตรักษาพันธุ์หนองบัวลำภู  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at แนวป่าเขตรักษาพันธุ์ Nong Bua Lam Phu Thailand, misty early morning, photorealistic, highly detailed, 16:9

#### ป่าเบญจพรรณชานเมืองหนองบัวลำภู — Nong Bua Lam Phu Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Nong Bua Lam Phu · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/nong-bua-lam-phu-forest-camp-2-109/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองหนองบัวลำภู  
  Minimal flat vector logo for a campsite "Nong Bua Lam Phu Forest Camp 2" (ป่าเบญจพรรณชานเมืองหนองบัวลำภู), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nong-bua-lam-phu-forest-camp-2-109/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองหนองบัวลำภู  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Nong Bua Lam Phu Thailand, misty early morning, photorealistic, highly detailed, 16:9

#### ชายป่าอนุรักษ์ขอนแก่น — Khon Kaen Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Khon Kaen · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/khon-kaen-forest-camp-1-110/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์ขอนแก่น  
  Minimal flat vector logo for a campsite "Khon Kaen Forest Camp 1" (ชายป่าอนุรักษ์ขอนแก่น), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/khon-kaen-forest-camp-1-110/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์ขอนแก่น  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Khon Kaen Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/khon-kaen-forest-camp-1-110/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์ขอนแก่น  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/khon-kaen-forest-camp-1-110/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์ขอนแก่น  
  signature hero view of Khon Kaen Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/khon-kaen-forest-camp-1-110/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์ขอนแก่น  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/khon-kaen-forest-camp-1-110/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ชายป่าอนุรักษ์ขอนแก่น  
  close detail of the ป่าลึก/ผจญภัย surroundings at ชายป่าอนุรักษ์ Khon Kaen (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/khon-kaen-forest-camp-1-110/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ชายป่าอนุรักษ์ขอนแก่น  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ชายป่าอนุรักษ์, tents arranged on the ground, surrounding FORE and MTNS landscape, misty early morning, 16:9

#### ป่าเบญจพรรณชานเมืองขอนแก่น — Khon Kaen Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Khon Kaen · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/khon-kaen-forest-camp-2-111/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองขอนแก่น  
  Minimal flat vector logo for a campsite "Khon Kaen Forest Camp 2" (ป่าเบญจพรรณชานเมืองขอนแก่น), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/khon-kaen-forest-camp-2-111/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองขอนแก่น  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Khon Kaen Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/khon-kaen-forest-camp-2-111/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองขอนแก่น  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/khon-kaen-forest-camp-2-111/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าเบญจพรรณชานเมืองขอนแก่น  
  signature hero view of Khon Kaen Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/khon-kaen-forest-camp-2-111/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าเบญจพรรณชานเมืองขอนแก่น  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าเบญจพรรณชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/khon-kaen-forest-camp-2-111/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ป่าเบญจพรรณชานเมืองขอนแก่น  
  close detail of the ป่าลึก/ผจญภัย surroundings at ป่าเบญจพรรณชานเมือง Khon Kaen (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/khon-kaen-forest-camp-2-111/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ป่าเบญจพรรณชานเมืองขอนแก่น  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ป่าเบญจพรรณชานเมือง, tents arranged on the ground, surrounding FORE and MTNS landscape, misty early morning, 16:9
- `/seed/camps/khon-kaen-forest-camp-2-111/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ป่าเบญจพรรณชานเมืองขอนแก่น  
  night scene of Khon Kaen Forest Camp 2, glowing tents and warm string lights at a ป่าลึก/ผจญภัย site in ป่าเบญจพรรณชานเมือง, starry sky, long exposure, cozy mood, 16:9

#### แนวป่าเขตรักษาพันธุ์ขอนแก่น — Khon Kaen Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Khon Kaen · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/khon-kaen-forest-camp-3-112/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แนวป่าเขตรักษาพันธุ์ขอนแก่น  
  Minimal flat vector logo for a campsite "Khon Kaen Forest Camp 3" (แนวป่าเขตรักษาพันธุ์ขอนแก่น), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/khon-kaen-forest-camp-3-112/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แนวป่าเขตรักษาพันธุ์ขอนแก่น  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at แนวป่าเขตรักษาพันธุ์ Khon Kaen Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/khon-kaen-forest-camp-3-112/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แนวป่าเขตรักษาพันธุ์ขอนแก่น  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, แนวป่าเขตรักษาพันธุ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/khon-kaen-forest-camp-3-112/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แนวป่าเขตรักษาพันธุ์ขอนแก่น  
  signature hero view of Khon Kaen Forest Camp 3: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9

#### ต้นน้ำชานเมืองอุดรธานี — Udon Thani Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Udon Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/udon-thani-riverside-camp-1-113/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองอุดรธานี  
  Minimal flat vector logo for a campsite "Udon Thani Riverside Camp 1" (ต้นน้ำชานเมืองอุดรธานี), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/udon-thani-riverside-camp-1-113/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองอุดรธานี  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Udon Thani Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/udon-thani-riverside-camp-1-113/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ต้นน้ำชานเมืองอุดรธานี  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ต้นน้ำชานเมือง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/udon-thani-riverside-camp-1-113/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ต้นน้ำชานเมืองอุดรธานี  
  signature hero view of Udon Thani Riverside Camp 1: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/udon-thani-riverside-camp-1-113/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ต้นน้ำชานเมืองอุดรธานี  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ต้นน้ำชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/udon-thani-riverside-camp-1-113/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ต้นน้ำชานเมืองอุดรธานี  
  close detail of the ริมน้ำ/ลำธาร surroundings at ต้นน้ำชานเมือง Udon Thani (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/udon-thani-riverside-camp-1-113/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ต้นน้ำชานเมืองอุดรธานี  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ต้นน้ำชานเมือง, tents arranged on the ground, surrounding RIVE and FORE landscape, soft morning light through trees, 16:9

#### ริมแม่น้ำสายหลักอุดรธานี — Udon Thani Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Udon Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/udon-thani-riverside-camp-2-114/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักอุดรธานี  
  Minimal flat vector logo for a campsite "Udon Thani Riverside Camp 2" (ริมแม่น้ำสายหลักอุดรธานี), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/udon-thani-riverside-camp-2-114/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักอุดรธานี  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Udon Thani Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/udon-thani-riverside-camp-2-114/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักอุดรธานี  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/udon-thani-riverside-camp-2-114/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมแม่น้ำสายหลักอุดรธานี  
  signature hero view of Udon Thani Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/udon-thani-riverside-camp-2-114/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมแม่น้ำสายหลักอุดรธานี  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมแม่น้ำสายหลัก, warm evening glow, candid lifestyle photo, 16:9

#### ที่ราบเชิงเขาอุดรธานี — Udon Thani Meadow Camp 3  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Udon Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/udon-thani-meadow-camp-3-115/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ที่ราบเชิงเขาอุดรธานี  
  Minimal flat vector logo for a campsite "Udon Thani Meadow Camp 3" (ที่ราบเชิงเขาอุดรธานี), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/udon-thani-meadow-camp-3-115/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ที่ราบเชิงเขาอุดรธานี  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ที่ราบเชิงเขา Udon Thani Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/udon-thani-meadow-camp-3-115/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ที่ราบเชิงเขาอุดรธานี  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ที่ราบเชิงเขา Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/udon-thani-meadow-camp-3-115/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ที่ราบเชิงเขาอุดรธานี  
  signature hero view of Udon Thani Meadow Camp 3: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/udon-thani-meadow-camp-3-115/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ที่ราบเชิงเขาอุดรธานี  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ที่ราบเชิงเขา, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/udon-thani-meadow-camp-3-115/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ที่ราบเชิงเขาอุดรธานี  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at ที่ราบเชิงเขา Udon Thani (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/udon-thani-meadow-camp-3-115/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ที่ราบเชิงเขาอุดรธานี  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at ที่ราบเชิงเขา, tents arranged on the ground, surrounding MTNS and FORE landscape, clear starry night, 16:9

#### ต้นน้ำชานเมืองหนองคาย — Nong Khai Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Nong Khai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/nong-khai-riverside-camp-1-116/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองหนองคาย  
  Minimal flat vector logo for a campsite "Nong Khai Riverside Camp 1" (ต้นน้ำชานเมืองหนองคาย), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nong-khai-riverside-camp-1-116/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองหนองคาย  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Nong Khai Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/nong-khai-riverside-camp-1-116/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ต้นน้ำชานเมืองหนองคาย  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ต้นน้ำชานเมือง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nong-khai-riverside-camp-1-116/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ต้นน้ำชานเมืองหนองคาย  
  signature hero view of Nong Khai Riverside Camp 1: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9

#### ป่าชุมชนใกล้เมืองหนองคาย — Nong Khai Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Nong Khai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/nong-khai-forest-camp-2-117/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองหนองคาย  
  Minimal flat vector logo for a campsite "Nong Khai Forest Camp 2" (ป่าชุมชนใกล้เมืองหนองคาย), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nong-khai-forest-camp-2-117/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองหนองคาย  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Nong Khai Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/nong-khai-forest-camp-2-117/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าชุมชนใกล้เมืองหนองคาย  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าชุมชนใกล้เมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nong-khai-forest-camp-2-117/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าชุมชนใกล้เมืองหนองคาย  
  signature hero view of Nong Khai Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/nong-khai-forest-camp-2-117/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าชุมชนใกล้เมืองหนองคาย  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าชุมชนใกล้เมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/nong-khai-forest-camp-2-117/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ป่าชุมชนใกล้เมืองหนองคาย  
  close detail of the ป่าลึก/ผจญภัย surroundings at ป่าชุมชนใกล้เมือง Nong Khai (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9

#### ริมแม่น้ำสายหลักมหาสารคาม — Maha Sarakham Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Maha Sarakham · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/maha-sarakham-riverside-camp-1-118/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักมหาสารคาม  
  Minimal flat vector logo for a campsite "Maha Sarakham Riverside Camp 1" (ริมแม่น้ำสายหลักมหาสารคาม), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/maha-sarakham-riverside-camp-1-118/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักมหาสารคาม  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Maha Sarakham Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9

#### ริมแม่น้ำสายหลักมหาสารคาม — Maha Sarakham Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Maha Sarakham · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/maha-sarakham-riverside-camp-2-119/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักมหาสารคาม  
  Minimal flat vector logo for a campsite "Maha Sarakham Riverside Camp 2" (ริมแม่น้ำสายหลักมหาสารคาม), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/maha-sarakham-riverside-camp-2-119/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักมหาสารคาม  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Maha Sarakham Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/maha-sarakham-riverside-camp-2-119/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักมหาสารคาม  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/maha-sarakham-riverside-camp-2-119/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมแม่น้ำสายหลักมหาสารคาม  
  signature hero view of Maha Sarakham Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/maha-sarakham-riverside-camp-2-119/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมแม่น้ำสายหลักมหาสารคาม  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมแม่น้ำสายหลัก, warm evening glow, candid lifestyle photo, 16:9

#### ที่ราบเชิงเขามหาสารคาม — Maha Sarakham Meadow Camp 3  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Maha Sarakham · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/maha-sarakham-meadow-camp-3-120/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ที่ราบเชิงเขามหาสารคาม  
  Minimal flat vector logo for a campsite "Maha Sarakham Meadow Camp 3" (ที่ราบเชิงเขามหาสารคาม), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/maha-sarakham-meadow-camp-3-120/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ที่ราบเชิงเขามหาสารคาม  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ที่ราบเชิงเขา Maha Sarakham Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/maha-sarakham-meadow-camp-3-120/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ที่ราบเชิงเขามหาสารคาม  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ที่ราบเชิงเขา Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/maha-sarakham-meadow-camp-3-120/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ที่ราบเชิงเขามหาสารคาม  
  signature hero view of Maha Sarakham Meadow Camp 3: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/maha-sarakham-meadow-camp-3-120/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ที่ราบเชิงเขามหาสารคาม  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ที่ราบเชิงเขา, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/maha-sarakham-meadow-camp-3-120/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ที่ราบเชิงเขามหาสารคาม  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at ที่ราบเชิงเขา Maha Sarakham (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/maha-sarakham-meadow-camp-3-120/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ที่ราบเชิงเขามหาสารคาม  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at ที่ราบเชิงเขา, tents arranged on the ground, surrounding MTNS and FORE landscape, clear starry night, 16:9
- `/seed/camps/maha-sarakham-meadow-camp-3-120/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ที่ราบเชิงเขามหาสารคาม  
  night scene of Maha Sarakham Meadow Camp 3, glowing tents and warm string lights at a ทุ่งหญ้า/ชมดาว site in ที่ราบเชิงเขา, starry sky, long exposure, cozy mood, 16:9

#### ชายป่าอนุรักษ์ร้อยเอ็ด — Roi Et Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Roi Et · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/roi-et-forest-camp-1-121/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์ร้อยเอ็ด  
  Minimal flat vector logo for a campsite "Roi Et Forest Camp 1" (ชายป่าอนุรักษ์ร้อยเอ็ด), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/roi-et-forest-camp-1-121/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์ร้อยเอ็ด  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Roi Et Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/roi-et-forest-camp-1-121/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์ร้อยเอ็ด  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/roi-et-forest-camp-1-121/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์ร้อยเอ็ด  
  signature hero view of Roi Et Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/roi-et-forest-camp-1-121/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์ร้อยเอ็ด  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/roi-et-forest-camp-1-121/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ชายป่าอนุรักษ์ร้อยเอ็ด  
  close detail of the ป่าลึก/ผจญภัย surroundings at ชายป่าอนุรักษ์ Roi Et (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/roi-et-forest-camp-1-121/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ชายป่าอนุรักษ์ร้อยเอ็ด  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ชายป่าอนุรักษ์, tents arranged on the ground, surrounding FORE and MTNS landscape, misty early morning, 16:9

#### ที่ราบเชิงเขาร้อยเอ็ด — Roi Et Meadow Camp 2  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Roi Et · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/roi-et-meadow-camp-2-122/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ที่ราบเชิงเขาร้อยเอ็ด  
  Minimal flat vector logo for a campsite "Roi Et Meadow Camp 2" (ที่ราบเชิงเขาร้อยเอ็ด), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/roi-et-meadow-camp-2-122/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ที่ราบเชิงเขาร้อยเอ็ด  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ที่ราบเชิงเขา Roi Et Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/roi-et-meadow-camp-2-122/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ที่ราบเชิงเขาร้อยเอ็ด  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ที่ราบเชิงเขา Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/roi-et-meadow-camp-2-122/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ที่ราบเชิงเขาร้อยเอ็ด  
  signature hero view of Roi Et Meadow Camp 2: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/roi-et-meadow-camp-2-122/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ที่ราบเชิงเขาร้อยเอ็ด  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ที่ราบเชิงเขา, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/roi-et-meadow-camp-2-122/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ที่ราบเชิงเขาร้อยเอ็ด  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at ที่ราบเชิงเขา Roi Et (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/roi-et-meadow-camp-2-122/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ที่ราบเชิงเขาร้อยเอ็ด  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at ที่ราบเชิงเขา, tents arranged on the ground, surrounding MTNS and FORE landscape, clear starry night, 16:9

#### ที่ราบเชิงเขากาฬสินธุ์ — Kalasin Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Kalasin · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/kalasin-meadow-camp-1-123/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ที่ราบเชิงเขากาฬสินธุ์  
  Minimal flat vector logo for a campsite "Kalasin Meadow Camp 1" (ที่ราบเชิงเขากาฬสินธุ์), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/kalasin-meadow-camp-1-123/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ที่ราบเชิงเขากาฬสินธุ์  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ที่ราบเชิงเขา Kalasin Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/kalasin-meadow-camp-1-123/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ที่ราบเชิงเขากาฬสินธุ์  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ที่ราบเชิงเขา Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/kalasin-meadow-camp-1-123/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ที่ราบเชิงเขากาฬสินธุ์  
  signature hero view of Kalasin Meadow Camp 1: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9

#### ทุ่งกว้างริมหมู่บ้านกาฬสินธุ์ — Kalasin Meadow Camp 2  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Kalasin · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/kalasin-meadow-camp-2-124/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งกว้างริมหมู่บ้านกาฬสินธุ์  
  Minimal flat vector logo for a campsite "Kalasin Meadow Camp 2" (ทุ่งกว้างริมหมู่บ้านกาฬสินธุ์), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/kalasin-meadow-camp-2-124/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งกว้างริมหมู่บ้านกาฬสินธุ์  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ทุ่งกว้างริมหมู่บ้าน Kalasin Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/kalasin-meadow-camp-2-124/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งกว้างริมหมู่บ้านกาฬสินธุ์  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ทุ่งกว้างริมหมู่บ้าน Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/kalasin-meadow-camp-2-124/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทุ่งกว้างริมหมู่บ้านกาฬสินธุ์  
  signature hero view of Kalasin Meadow Camp 2: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9

#### เนินหญ้าชายทุ่งกาฬสินธุ์ — Kalasin Meadow Camp 3  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Kalasin · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/kalasin-meadow-camp-3-125/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เนินหญ้าชายทุ่งกาฬสินธุ์  
  Minimal flat vector logo for a campsite "Kalasin Meadow Camp 3" (เนินหญ้าชายทุ่งกาฬสินธุ์), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/kalasin-meadow-camp-3-125/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เนินหญ้าชายทุ่งกาฬสินธุ์  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at เนินหญ้าชายทุ่ง Kalasin Thailand, clear starry night, photorealistic, highly detailed, 16:9

#### ชายป่าอนุรักษ์สกลนคร — Sakon Nakhon Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Sakon Nakhon · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/sakon-nakhon-forest-camp-1-126/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์สกลนคร  
  Minimal flat vector logo for a campsite "Sakon Nakhon Forest Camp 1" (ชายป่าอนุรักษ์สกลนคร), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sakon-nakhon-forest-camp-1-126/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์สกลนคร  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Sakon Nakhon Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/sakon-nakhon-forest-camp-1-126/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์สกลนคร  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/sakon-nakhon-forest-camp-1-126/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์สกลนคร  
  signature hero view of Sakon Nakhon Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/sakon-nakhon-forest-camp-1-126/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์สกลนคร  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9

#### ป่าชุมชนใกล้เมืองสกลนคร — Sakon Nakhon Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Sakon Nakhon · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/sakon-nakhon-forest-camp-2-127/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองสกลนคร  
  Minimal flat vector logo for a campsite "Sakon Nakhon Forest Camp 2" (ป่าชุมชนใกล้เมืองสกลนคร), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sakon-nakhon-forest-camp-2-127/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองสกลนคร  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Sakon Nakhon Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/sakon-nakhon-forest-camp-2-127/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าชุมชนใกล้เมืองสกลนคร  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าชุมชนใกล้เมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/sakon-nakhon-forest-camp-2-127/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าชุมชนใกล้เมืองสกลนคร  
  signature hero view of Sakon Nakhon Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/sakon-nakhon-forest-camp-2-127/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าชุมชนใกล้เมืองสกลนคร  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าชุมชนใกล้เมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/sakon-nakhon-forest-camp-2-127/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ป่าชุมชนใกล้เมืองสกลนคร  
  close detail of the ป่าลึก/ผจญภัย surroundings at ป่าชุมชนใกล้เมือง Sakon Nakhon (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/sakon-nakhon-forest-camp-2-127/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ป่าชุมชนใกล้เมืองสกลนคร  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ป่าชุมชนใกล้เมือง, tents arranged on the ground, surrounding FORE and MTNS landscape, misty early morning, 16:9
- `/seed/camps/sakon-nakhon-forest-camp-2-127/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ป่าชุมชนใกล้เมืองสกลนคร  
  night scene of Sakon Nakhon Forest Camp 2, glowing tents and warm string lights at a ป่าลึก/ผจญภัย site in ป่าชุมชนใกล้เมือง, starry sky, long exposure, cozy mood, 16:9

#### ชายป่าอนุรักษ์นครพนม — Nakhon Phanom Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Nakhon Phanom · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/nakhon-phanom-forest-camp-1-128/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์นครพนม  
  Minimal flat vector logo for a campsite "Nakhon Phanom Forest Camp 1" (ชายป่าอนุรักษ์นครพนม), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-phanom-forest-camp-1-128/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์นครพนม  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Nakhon Phanom Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-phanom-forest-camp-1-128/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์นครพนม  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-phanom-forest-camp-1-128/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์นครพนม  
  signature hero view of Nakhon Phanom Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/nakhon-phanom-forest-camp-1-128/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์นครพนม  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/nakhon-phanom-forest-camp-1-128/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ชายป่าอนุรักษ์นครพนม  
  close detail of the ป่าลึก/ผจญภัย surroundings at ชายป่าอนุรักษ์ Nakhon Phanom (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9

#### ทุ่งกว้างริมหมู่บ้านนครพนม — Nakhon Phanom Meadow Camp 2  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Nakhon Phanom · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/nakhon-phanom-meadow-camp-2-129/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งกว้างริมหมู่บ้านนครพนม  
  Minimal flat vector logo for a campsite "Nakhon Phanom Meadow Camp 2" (ทุ่งกว้างริมหมู่บ้านนครพนม), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-phanom-meadow-camp-2-129/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งกว้างริมหมู่บ้านนครพนม  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ทุ่งกว้างริมหมู่บ้าน Nakhon Phanom Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-phanom-meadow-camp-2-129/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งกว้างริมหมู่บ้านนครพนม  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ทุ่งกว้างริมหมู่บ้าน Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-phanom-meadow-camp-2-129/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทุ่งกว้างริมหมู่บ้านนครพนม  
  signature hero view of Nakhon Phanom Meadow Camp 2: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9

#### ฝั่งลำธารชนบทนครพนม — Nakhon Phanom Riverside Camp 3  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Nakhon Phanom · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/nakhon-phanom-riverside-camp-3-130/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ฝั่งลำธารชนบทนครพนม  
  Minimal flat vector logo for a campsite "Nakhon Phanom Riverside Camp 3" (ฝั่งลำธารชนบทนครพนม), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-phanom-riverside-camp-3-130/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ฝั่งลำธารชนบทนครพนม  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ฝั่งลำธารชนบท Nakhon Phanom Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-phanom-riverside-camp-3-130/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ฝั่งลำธารชนบทนครพนม  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ฝั่งลำธารชนบท Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-phanom-riverside-camp-3-130/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ฝั่งลำธารชนบทนครพนม  
  signature hero view of Nakhon Phanom Riverside Camp 3: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/nakhon-phanom-riverside-camp-3-130/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ฝั่งลำธารชนบทนครพนม  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ฝั่งลำธารชนบท, warm evening glow, candid lifestyle photo, 16:9

#### ทุ่งโล่งชานเมืองมุกดาหาร — Mukdahan Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Mukdahan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/mukdahan-meadow-camp-1-131/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งโล่งชานเมืองมุกดาหาร  
  Minimal flat vector logo for a campsite "Mukdahan Meadow Camp 1" (ทุ่งโล่งชานเมืองมุกดาหาร), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/mukdahan-meadow-camp-1-131/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งโล่งชานเมืองมุกดาหาร  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ทุ่งโล่งชานเมือง Mukdahan Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/mukdahan-meadow-camp-1-131/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งโล่งชานเมืองมุกดาหาร  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ทุ่งโล่งชานเมือง Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/mukdahan-meadow-camp-1-131/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทุ่งโล่งชานเมืองมุกดาหาร  
  signature hero view of Mukdahan Meadow Camp 1: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/mukdahan-meadow-camp-1-131/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ทุ่งโล่งชานเมืองมุกดาหาร  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ทุ่งโล่งชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/mukdahan-meadow-camp-1-131/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ทุ่งโล่งชานเมืองมุกดาหาร  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at ทุ่งโล่งชานเมือง Mukdahan (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9

#### ป่าชุมชนใกล้เมืองมุกดาหาร — Mukdahan Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Mukdahan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/mukdahan-forest-camp-2-132/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองมุกดาหาร  
  Minimal flat vector logo for a campsite "Mukdahan Forest Camp 2" (ป่าชุมชนใกล้เมืองมุกดาหาร), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/mukdahan-forest-camp-2-132/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองมุกดาหาร  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Mukdahan Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/mukdahan-forest-camp-2-132/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าชุมชนใกล้เมืองมุกดาหาร  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าชุมชนใกล้เมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/mukdahan-forest-camp-2-132/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าชุมชนใกล้เมืองมุกดาหาร  
  signature hero view of Mukdahan Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/mukdahan-forest-camp-2-132/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าชุมชนใกล้เมืองมุกดาหาร  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าชุมชนใกล้เมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/mukdahan-forest-camp-2-132/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ป่าชุมชนใกล้เมืองมุกดาหาร  
  close detail of the ป่าลึก/ผจญภัย surroundings at ป่าชุมชนใกล้เมือง Mukdahan (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9

#### เนินหญ้าชายทุ่งมุกดาหาร — Mukdahan Meadow Camp 3  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Mukdahan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/mukdahan-meadow-camp-3-133/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เนินหญ้าชายทุ่งมุกดาหาร  
  Minimal flat vector logo for a campsite "Mukdahan Meadow Camp 3" (เนินหญ้าชายทุ่งมุกดาหาร), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/mukdahan-meadow-camp-3-133/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เนินหญ้าชายทุ่งมุกดาหาร  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at เนินหญ้าชายทุ่ง Mukdahan Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/mukdahan-meadow-camp-3-133/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ เนินหญ้าชายทุ่งมุกดาหาร  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, เนินหญ้าชายทุ่ง Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/mukdahan-meadow-camp-3-133/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น เนินหญ้าชายทุ่งมุกดาหาร  
  signature hero view of Mukdahan Meadow Camp 3: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/mukdahan-meadow-camp-3-133/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ เนินหญ้าชายทุ่งมุกดาหาร  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in เนินหญ้าชายทุ่ง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/mukdahan-meadow-camp-3-133/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ เนินหญ้าชายทุ่งมุกดาหาร  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at เนินหญ้าชายทุ่ง Mukdahan (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/mukdahan-meadow-camp-3-133/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง เนินหญ้าชายทุ่งมุกดาหาร  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at เนินหญ้าชายทุ่ง, tents arranged on the ground, surrounding MTNS and FORE landscape, clear starry night, 16:9
- `/seed/camps/mukdahan-meadow-camp-3-133/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน เนินหญ้าชายทุ่งมุกดาหาร  
  night scene of Mukdahan Meadow Camp 3, glowing tents and warm string lights at a ทุ่งหญ้า/ชมดาว site in เนินหญ้าชายทุ่ง, starry sky, long exposure, cozy mood, 16:9

### โฮสต์ RGN — บริษัท ภาคเหนือแคมป์ปิ้ง เน็ตเวิร์ก จำกัด (COMPANY)

#### ต้นน้ำชานเมืองลำพูน — Lamphun Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Lamphun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/lamphun-riverside-camp-1-134/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองลำพูน  
  Minimal flat vector logo for a campsite "Lamphun Riverside Camp 1" (ต้นน้ำชานเมืองลำพูน), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/lamphun-riverside-camp-1-134/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองลำพูน  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Lamphun Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9

#### ฝั่งลำธารชนบทลำพูน — Lamphun Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Lamphun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/lamphun-riverside-camp-2-135/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ฝั่งลำธารชนบทลำพูน  
  Minimal flat vector logo for a campsite "Lamphun Riverside Camp 2" (ฝั่งลำธารชนบทลำพูน), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/lamphun-riverside-camp-2-135/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ฝั่งลำธารชนบทลำพูน  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ฝั่งลำธารชนบท Lamphun Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/lamphun-riverside-camp-2-135/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ฝั่งลำธารชนบทลำพูน  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ฝั่งลำธารชนบท Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/lamphun-riverside-camp-2-135/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ฝั่งลำธารชนบทลำพูน  
  signature hero view of Lamphun Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/lamphun-riverside-camp-2-135/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ฝั่งลำธารชนบทลำพูน  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ฝั่งลำธารชนบท, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/lamphun-riverside-camp-2-135/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ฝั่งลำธารชนบทลำพูน  
  close detail of the ริมน้ำ/ลำธาร surroundings at ฝั่งลำธารชนบท Lamphun (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/lamphun-riverside-camp-2-135/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ฝั่งลำธารชนบทลำพูน  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ฝั่งลำธารชนบท, tents arranged on the ground, surrounding RIVE and FORE landscape, soft morning light through trees, 16:9

#### ป่าเบญจพรรณชานเมืองลำปาง — Lampang Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Lampang · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/lampang-forest-camp-1-136/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองลำปาง  
  Minimal flat vector logo for a campsite "Lampang Forest Camp 1" (ป่าเบญจพรรณชานเมืองลำปาง), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/lampang-forest-camp-1-136/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองลำปาง  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Lampang Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/lampang-forest-camp-1-136/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองลำปาง  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9

#### ดอยชายแดนลำปาง — Lampang Misty Highland Camp 2  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Lampang · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/lampang-misty-highland-camp-2-137/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ดอยชายแดนลำปาง  
  Minimal flat vector logo for a campsite "Lampang Misty Highland Camp 2" (ดอยชายแดนลำปาง), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/lampang-misty-highland-camp-2-137/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ดอยชายแดนลำปาง  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ดอยชายแดน Lampang Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9

#### ต้นน้ำชานเมืองอุตรดิตถ์ — Uttaradit Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Uttaradit · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/uttaradit-riverside-camp-1-138/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองอุตรดิตถ์  
  Minimal flat vector logo for a campsite "Uttaradit Riverside Camp 1" (ต้นน้ำชานเมืองอุตรดิตถ์), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/uttaradit-riverside-camp-1-138/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองอุตรดิตถ์  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Uttaradit Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/uttaradit-riverside-camp-1-138/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ต้นน้ำชานเมืองอุตรดิตถ์  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ต้นน้ำชานเมือง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/uttaradit-riverside-camp-1-138/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ต้นน้ำชานเมืองอุตรดิตถ์  
  signature hero view of Uttaradit Riverside Camp 1: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9

#### สันเขาเหนือหมู่บ้านอุตรดิตถ์ — Uttaradit Misty Highland Camp 2  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Uttaradit · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/uttaradit-misty-highland-camp-2-139/cover.jpg` (1:1, logo) — _alt:_ โลโก้ สันเขาเหนือหมู่บ้านอุตรดิตถ์  
  Minimal flat vector logo for a campsite "Uttaradit Misty Highland Camp 2" (สันเขาเหนือหมู่บ้านอุตรดิตถ์), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/uttaradit-misty-highland-camp-2-139/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง สันเขาเหนือหมู่บ้านอุตรดิตถ์  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at สันเขาเหนือหมู่บ้าน Uttaradit Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/uttaradit-misty-highland-camp-2-139/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ สันเขาเหนือหมู่บ้านอุตรดิตถ์  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, สันเขาเหนือหมู่บ้าน Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/uttaradit-misty-highland-camp-2-139/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น สันเขาเหนือหมู่บ้านอุตรดิตถ์  
  signature hero view of Uttaradit Misty Highland Camp 2: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9

#### สันเขาเหนือหมู่บ้านอุตรดิตถ์ — Uttaradit Misty Highland Camp 3  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Uttaradit · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/uttaradit-misty-highland-camp-3-140/cover.jpg` (1:1, logo) — _alt:_ โลโก้ สันเขาเหนือหมู่บ้านอุตรดิตถ์  
  Minimal flat vector logo for a campsite "Uttaradit Misty Highland Camp 3" (สันเขาเหนือหมู่บ้านอุตรดิตถ์), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/uttaradit-misty-highland-camp-3-140/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง สันเขาเหนือหมู่บ้านอุตรดิตถ์  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at สันเขาเหนือหมู่บ้าน Uttaradit Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/uttaradit-misty-highland-camp-3-140/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ สันเขาเหนือหมู่บ้านอุตรดิตถ์  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, สันเขาเหนือหมู่บ้าน Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/uttaradit-misty-highland-camp-3-140/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น สันเขาเหนือหมู่บ้านอุตรดิตถ์  
  signature hero view of Uttaradit Misty Highland Camp 3: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9

#### ชายป่าอนุรักษ์แพร่ — Phrae Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Phrae · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

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
  close detail of the ป่าลึก/ผจญภัย surroundings at ชายป่าอนุรักษ์ Phrae (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phrae-forest-camp-1-141/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ชายป่าอนุรักษ์แพร่  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ชายป่าอนุรักษ์, tents arranged on the ground, surrounding FORE and MTNS landscape, misty early morning, 16:9

#### ยอดดอยเงียบสงบแพร่ — Phrae Misty Highland Camp 2  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Phrae · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/phrae-misty-highland-camp-2-142/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ยอดดอยเงียบสงบแพร่  
  Minimal flat vector logo for a campsite "Phrae Misty Highland Camp 2" (ยอดดอยเงียบสงบแพร่), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phrae-misty-highland-camp-2-142/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ยอดดอยเงียบสงบแพร่  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ยอดดอยเงียบสงบ Phrae Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/phrae-misty-highland-camp-2-142/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ยอดดอยเงียบสงบแพร่  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ยอดดอยเงียบสงบ Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phrae-misty-highland-camp-2-142/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ยอดดอยเงียบสงบแพร่  
  signature hero view of Phrae Misty Highland Camp 2: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/phrae-misty-highland-camp-2-142/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ยอดดอยเงียบสงบแพร่  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in ยอดดอยเงียบสงบ, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phrae-misty-highland-camp-2-142/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ยอดดอยเงียบสงบแพร่  
  close detail of the ทะเลหมอกภูเขา surroundings at ยอดดอยเงียบสงบ Phrae (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9

#### สันเขาเหนือหมู่บ้านน่าน — Nan Misty Highland Camp 1  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Nan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/nan-misty-highland-camp-1-143/cover.jpg` (1:1, logo) — _alt:_ โลโก้ สันเขาเหนือหมู่บ้านน่าน  
  Minimal flat vector logo for a campsite "Nan Misty Highland Camp 1" (สันเขาเหนือหมู่บ้านน่าน), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nan-misty-highland-camp-1-143/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง สันเขาเหนือหมู่บ้านน่าน  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at สันเขาเหนือหมู่บ้าน Nan Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/nan-misty-highland-camp-1-143/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ สันเขาเหนือหมู่บ้านน่าน  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, สันเขาเหนือหมู่บ้าน Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9

#### ริมคลองร่มรื่นน่าน — Nan Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Nan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/nan-riverside-camp-2-144/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นน่าน  
  Minimal flat vector logo for a campsite "Nan Riverside Camp 2" (ริมคลองร่มรื่นน่าน), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nan-riverside-camp-2-144/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นน่าน  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Nan Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/nan-riverside-camp-2-144/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นน่าน  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nan-riverside-camp-2-144/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมคลองร่มรื่นน่าน  
  signature hero view of Nan Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/nan-riverside-camp-2-144/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมคลองร่มรื่นน่าน  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมคลองร่มรื่น, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/nan-riverside-camp-2-144/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมคลองร่มรื่นน่าน  
  close detail of the ริมน้ำ/ลำธาร surroundings at ริมคลองร่มรื่น Nan (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/nan-riverside-camp-2-144/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ริมคลองร่มรื่นน่าน  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ริมคลองร่มรื่น, tents arranged on the ground, surrounding RIVE and FORE landscape, soft morning light through trees, 16:9

#### ป่าเบญจพรรณชานเมืองน่าน — Nan Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Nan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/nan-forest-camp-3-145/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองน่าน  
  Minimal flat vector logo for a campsite "Nan Forest Camp 3" (ป่าเบญจพรรณชานเมืองน่าน), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nan-forest-camp-3-145/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองน่าน  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Nan Thailand, misty early morning, photorealistic, highly detailed, 16:9

#### ดอยชายแดนพะเยา — Phayao Misty Highland Camp 1  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Phayao · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/phayao-misty-highland-camp-1-146/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ดอยชายแดนพะเยา  
  Minimal flat vector logo for a campsite "Phayao Misty Highland Camp 1" (ดอยชายแดนพะเยา), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phayao-misty-highland-camp-1-146/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ดอยชายแดนพะเยา  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ดอยชายแดน Phayao Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/phayao-misty-highland-camp-1-146/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ดอยชายแดนพะเยา  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ดอยชายแดน Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phayao-misty-highland-camp-1-146/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ดอยชายแดนพะเยา  
  signature hero view of Phayao Misty Highland Camp 1: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9

#### ป่าเบญจพรรณชานเมืองพะเยา — Phayao Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Phayao · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/phayao-forest-camp-2-147/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองพะเยา  
  Minimal flat vector logo for a campsite "Phayao Forest Camp 2" (ป่าเบญจพรรณชานเมืองพะเยา), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phayao-forest-camp-2-147/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองพะเยา  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Phayao Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/phayao-forest-camp-2-147/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองพะเยา  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phayao-forest-camp-2-147/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าเบญจพรรณชานเมืองพะเยา  
  signature hero view of Phayao Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/phayao-forest-camp-2-147/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าเบญจพรรณชานเมืองพะเยา  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าเบญจพรรณชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phayao-forest-camp-2-147/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ป่าเบญจพรรณชานเมืองพะเยา  
  close detail of the ป่าลึก/ผจญภัย surroundings at ป่าเบญจพรรณชานเมือง Phayao (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phayao-forest-camp-2-147/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ป่าเบญจพรรณชานเมืองพะเยา  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ป่าเบญจพรรณชานเมือง, tents arranged on the ground, surrounding FORE and MTNS landscape, misty early morning, 16:9
- `/seed/camps/phayao-forest-camp-2-147/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ป่าเบญจพรรณชานเมืองพะเยา  
  night scene of Phayao Forest Camp 2, glowing tents and warm string lights at a ป่าลึก/ผจญภัย site in ป่าเบญจพรรณชานเมือง, starry sky, long exposure, cozy mood, 16:9

#### ต้นน้ำชานเมืองพะเยา — Phayao Riverside Camp 3  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Phayao · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/phayao-riverside-camp-3-148/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองพะเยา  
  Minimal flat vector logo for a campsite "Phayao Riverside Camp 3" (ต้นน้ำชานเมืองพะเยา), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phayao-riverside-camp-3-148/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองพะเยา  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Phayao Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/phayao-riverside-camp-3-148/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ต้นน้ำชานเมืองพะเยา  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ต้นน้ำชานเมือง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phayao-riverside-camp-3-148/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ต้นน้ำชานเมืองพะเยา  
  signature hero view of Phayao Riverside Camp 3: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/phayao-riverside-camp-3-148/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ต้นน้ำชานเมืองพะเยา  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ต้นน้ำชานเมือง, warm evening glow, candid lifestyle photo, 16:9

### โฮสต์ RGC — อัครเดช ที่ราบกลาง (INDIVIDUAL)

#### ฝั่งลำธารชนบทนครสวรรค์ — Nakhon Sawan Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Nakhon Sawan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/nakhon-sawan-riverside-camp-1-149/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ฝั่งลำธารชนบทนครสวรรค์  
  Minimal flat vector logo for a campsite "Nakhon Sawan Riverside Camp 1" (ฝั่งลำธารชนบทนครสวรรค์), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-sawan-riverside-camp-1-149/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ฝั่งลำธารชนบทนครสวรรค์  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ฝั่งลำธารชนบท Nakhon Sawan Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-sawan-riverside-camp-1-149/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ฝั่งลำธารชนบทนครสวรรค์  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ฝั่งลำธารชนบท Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-sawan-riverside-camp-1-149/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ฝั่งลำธารชนบทนครสวรรค์  
  signature hero view of Nakhon Sawan Riverside Camp 1: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/nakhon-sawan-riverside-camp-1-149/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ฝั่งลำธารชนบทนครสวรรค์  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ฝั่งลำธารชนบท, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/nakhon-sawan-riverside-camp-1-149/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ฝั่งลำธารชนบทนครสวรรค์  
  close detail of the ริมน้ำ/ลำธาร surroundings at ฝั่งลำธารชนบท Nakhon Sawan (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/nakhon-sawan-riverside-camp-1-149/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ฝั่งลำธารชนบทนครสวรรค์  
  aerial drone top-down view of the ริมน้ำ/ลำธาร campsite at ฝั่งลำธารชนบท, tents arranged on the ground, surrounding RIVE and FORE landscape, soft morning light through trees, 16:9
- `/seed/camps/nakhon-sawan-riverside-camp-1-149/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ฝั่งลำธารชนบทนครสวรรค์  
  night scene of Nakhon Sawan Riverside Camp 1, glowing tents and warm string lights at a ริมน้ำ/ลำธาร site in ฝั่งลำธารชนบท, starry sky, long exposure, cozy mood, 16:9

#### ป่าชุมชนใกล้เมืองนครสวรรค์ — Nakhon Sawan Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Nakhon Sawan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/nakhon-sawan-forest-camp-2-150/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองนครสวรรค์  
  Minimal flat vector logo for a campsite "Nakhon Sawan Forest Camp 2" (ป่าชุมชนใกล้เมืองนครสวรรค์), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-sawan-forest-camp-2-150/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองนครสวรรค์  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Nakhon Sawan Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-sawan-forest-camp-2-150/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าชุมชนใกล้เมืองนครสวรรค์  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าชุมชนใกล้เมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-sawan-forest-camp-2-150/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าชุมชนใกล้เมืองนครสวรรค์  
  signature hero view of Nakhon Sawan Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/nakhon-sawan-forest-camp-2-150/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าชุมชนใกล้เมืองนครสวรรค์  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าชุมชนใกล้เมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/nakhon-sawan-forest-camp-2-150/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ป่าชุมชนใกล้เมืองนครสวรรค์  
  close detail of the ป่าลึก/ผจญภัย surroundings at ป่าชุมชนใกล้เมือง Nakhon Sawan (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/nakhon-sawan-forest-camp-2-150/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ป่าชุมชนใกล้เมืองนครสวรรค์  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ป่าชุมชนใกล้เมือง, tents arranged on the ground, surrounding FORE and MTNS landscape, misty early morning, 16:9
- `/seed/camps/nakhon-sawan-forest-camp-2-150/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ป่าชุมชนใกล้เมืองนครสวรรค์  
  night scene of Nakhon Sawan Forest Camp 2, glowing tents and warm string lights at a ป่าลึก/ผจญภัย site in ป่าชุมชนใกล้เมือง, starry sky, long exposure, cozy mood, 16:9

#### อ่าวเล็กปลายแหลมอุทัยธานี — Uthai Thani Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Uthai Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/uthai-thani-beachside-camp-1-151/cover.jpg` (1:1, logo) — _alt:_ โลโก้ อ่าวเล็กปลายแหลมอุทัยธานี  
  Minimal flat vector logo for a campsite "Uthai Thani Beachside Camp 1" (อ่าวเล็กปลายแหลมอุทัยธานี), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/uthai-thani-beachside-camp-1-151/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง อ่าวเล็กปลายแหลมอุทัยธานี  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at อ่าวเล็กปลายแหลม Uthai Thani Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/uthai-thani-beachside-camp-1-151/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ อ่าวเล็กปลายแหลมอุทัยธานี  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, อ่าวเล็กปลายแหลม Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/uthai-thani-beachside-camp-1-151/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น อ่าวเล็กปลายแหลมอุทัยธานี  
  signature hero view of Uthai Thani Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/uthai-thani-beachside-camp-1-151/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ อ่าวเล็กปลายแหลมอุทัยธานี  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in อ่าวเล็กปลายแหลม, warm evening glow, candid lifestyle photo, 16:9

#### แหลมหาดทรายอุทัยธานี — Uthai Thani Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Uthai Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/uthai-thani-beachside-camp-2-152/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายอุทัยธานี  
  Minimal flat vector logo for a campsite "Uthai Thani Beachside Camp 2" (แหลมหาดทรายอุทัยธานี), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/uthai-thani-beachside-camp-2-152/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายอุทัยธานี  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Uthai Thani Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9

#### ต้นน้ำชานเมืองอุทัยธานี — Uthai Thani Riverside Camp 3  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Uthai Thani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/uthai-thani-riverside-camp-3-153/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองอุทัยธานี  
  Minimal flat vector logo for a campsite "Uthai Thani Riverside Camp 3" (ต้นน้ำชานเมืองอุทัยธานี), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/uthai-thani-riverside-camp-3-153/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองอุทัยธานี  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Uthai Thani Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/uthai-thani-riverside-camp-3-153/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ต้นน้ำชานเมืองอุทัยธานี  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ต้นน้ำชานเมือง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/uthai-thani-riverside-camp-3-153/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ต้นน้ำชานเมืองอุทัยธานี  
  signature hero view of Uthai Thani Riverside Camp 3: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/uthai-thani-riverside-camp-3-153/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ต้นน้ำชานเมืองอุทัยธานี  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ต้นน้ำชานเมือง, warm evening glow, candid lifestyle photo, 16:9

#### ทุ่งกว้างริมหมู่บ้านกำแพงเพชร — Kamphaeng Phet Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Kamphaeng Phet · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/kamphaeng-phet-meadow-camp-1-154/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งกว้างริมหมู่บ้านกำแพงเพชร  
  Minimal flat vector logo for a campsite "Kamphaeng Phet Meadow Camp 1" (ทุ่งกว้างริมหมู่บ้านกำแพงเพชร), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/kamphaeng-phet-meadow-camp-1-154/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งกว้างริมหมู่บ้านกำแพงเพชร  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ทุ่งกว้างริมหมู่บ้าน Kamphaeng Phet Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/kamphaeng-phet-meadow-camp-1-154/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งกว้างริมหมู่บ้านกำแพงเพชร  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ทุ่งกว้างริมหมู่บ้าน Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/kamphaeng-phet-meadow-camp-1-154/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทุ่งกว้างริมหมู่บ้านกำแพงเพชร  
  signature hero view of Kamphaeng Phet Meadow Camp 1: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/kamphaeng-phet-meadow-camp-1-154/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ทุ่งกว้างริมหมู่บ้านกำแพงเพชร  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ทุ่งกว้างริมหมู่บ้าน, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/kamphaeng-phet-meadow-camp-1-154/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ทุ่งกว้างริมหมู่บ้านกำแพงเพชร  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at ทุ่งกว้างริมหมู่บ้าน Kamphaeng Phet (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/kamphaeng-phet-meadow-camp-1-154/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ทุ่งกว้างริมหมู่บ้านกำแพงเพชร  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at ทุ่งกว้างริมหมู่บ้าน, tents arranged on the ground, surrounding MTNS and FORE landscape, clear starry night, 16:9

#### ริมคลองร่มรื่นกำแพงเพชร — Kamphaeng Phet Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Kamphaeng Phet · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/kamphaeng-phet-riverside-camp-2-155/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นกำแพงเพชร  
  Minimal flat vector logo for a campsite "Kamphaeng Phet Riverside Camp 2" (ริมคลองร่มรื่นกำแพงเพชร), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/kamphaeng-phet-riverside-camp-2-155/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นกำแพงเพชร  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Kamphaeng Phet Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/kamphaeng-phet-riverside-camp-2-155/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นกำแพงเพชร  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/kamphaeng-phet-riverside-camp-2-155/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมคลองร่มรื่นกำแพงเพชร  
  signature hero view of Kamphaeng Phet Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9

### โฮสต์ RGW — ห้างหุ้นส่วนจำกัด ตะวันตกไพรวัลย์ (PARTNERSHIP)

#### ริมคลองร่มรื่นตาก — Tak Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Tak · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/tak-riverside-camp-1-156/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นตาก  
  Minimal flat vector logo for a campsite "Tak Riverside Camp 1" (ริมคลองร่มรื่นตาก), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/tak-riverside-camp-1-156/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นตาก  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Tak Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9

#### ริมแม่น้ำสายหลักตาก — Tak Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Tak · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/tak-riverside-camp-2-157/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักตาก  
  Minimal flat vector logo for a campsite "Tak Riverside Camp 2" (ริมแม่น้ำสายหลักตาก), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/tak-riverside-camp-2-157/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักตาก  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Tak Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/tak-riverside-camp-2-157/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักตาก  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/tak-riverside-camp-2-157/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมแม่น้ำสายหลักตาก  
  signature hero view of Tak Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/tak-riverside-camp-2-157/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมแม่น้ำสายหลักตาก  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมแม่น้ำสายหลัก, warm evening glow, candid lifestyle photo, 16:9

#### ริมแม่น้ำสายหลักตาก — Tak Riverside Camp 3  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Tak · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/tak-riverside-camp-3-158/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักตาก  
  Minimal flat vector logo for a campsite "Tak Riverside Camp 3" (ริมแม่น้ำสายหลักตาก), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/tak-riverside-camp-3-158/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักตาก  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Tak Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/tak-riverside-camp-3-158/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักตาก  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/tak-riverside-camp-3-158/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมแม่น้ำสายหลักตาก  
  signature hero view of Tak Riverside Camp 3: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/tak-riverside-camp-3-158/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมแม่น้ำสายหลักตาก  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมแม่น้ำสายหลัก, warm evening glow, candid lifestyle photo, 16:9

### โฮสต์ RGC — อัครเดช ที่ราบกลาง (INDIVIDUAL)

#### หาดชายฝั่งเงียบสุโขทัย — Sukhothai Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Sukhothai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/sukhothai-beachside-camp-1-159/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดชายฝั่งเงียบสุโขทัย  
  Minimal flat vector logo for a campsite "Sukhothai Beachside Camp 1" (หาดชายฝั่งเงียบสุโขทัย), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sukhothai-beachside-camp-1-159/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดชายฝั่งเงียบสุโขทัย  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดชายฝั่งเงียบ Sukhothai Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/sukhothai-beachside-camp-1-159/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดชายฝั่งเงียบสุโขทัย  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดชายฝั่งเงียบ Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/sukhothai-beachside-camp-1-159/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น หาดชายฝั่งเงียบสุโขทัย  
  signature hero view of Sukhothai Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9

#### อ่าวเล็กปลายแหลมสุโขทัย — Sukhothai Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Sukhothai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/sukhothai-beachside-camp-2-160/cover.jpg` (1:1, logo) — _alt:_ โลโก้ อ่าวเล็กปลายแหลมสุโขทัย  
  Minimal flat vector logo for a campsite "Sukhothai Beachside Camp 2" (อ่าวเล็กปลายแหลมสุโขทัย), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sukhothai-beachside-camp-2-160/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง อ่าวเล็กปลายแหลมสุโขทัย  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at อ่าวเล็กปลายแหลม Sukhothai Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/sukhothai-beachside-camp-2-160/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ อ่าวเล็กปลายแหลมสุโขทัย  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, อ่าวเล็กปลายแหลม Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/sukhothai-beachside-camp-2-160/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น อ่าวเล็กปลายแหลมสุโขทัย  
  signature hero view of Sukhothai Beachside Camp 2: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9

#### ต้นน้ำชานเมืองสุโขทัย — Sukhothai Riverside Camp 3  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Sukhothai · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/sukhothai-riverside-camp-3-161/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองสุโขทัย  
  Minimal flat vector logo for a campsite "Sukhothai Riverside Camp 3" (ต้นน้ำชานเมืองสุโขทัย), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/sukhothai-riverside-camp-3-161/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองสุโขทัย  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Sukhothai Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/sukhothai-riverside-camp-3-161/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ต้นน้ำชานเมืองสุโขทัย  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ต้นน้ำชานเมือง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/sukhothai-riverside-camp-3-161/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ต้นน้ำชานเมืองสุโขทัย  
  signature hero view of Sukhothai Riverside Camp 3: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/sukhothai-riverside-camp-3-161/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ต้นน้ำชานเมืองสุโขทัย  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ต้นน้ำชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/sukhothai-riverside-camp-3-161/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ต้นน้ำชานเมืองสุโขทัย  
  close detail of the ริมน้ำ/ลำธาร surroundings at ต้นน้ำชานเมือง Sukhothai (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9

#### ทุ่งกว้างริมหมู่บ้านพิษณุโลก — Phitsanulok Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Phitsanulok · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/phitsanulok-meadow-camp-1-162/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งกว้างริมหมู่บ้านพิษณุโลก  
  Minimal flat vector logo for a campsite "Phitsanulok Meadow Camp 1" (ทุ่งกว้างริมหมู่บ้านพิษณุโลก), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phitsanulok-meadow-camp-1-162/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งกว้างริมหมู่บ้านพิษณุโลก  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ทุ่งกว้างริมหมู่บ้าน Phitsanulok Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/phitsanulok-meadow-camp-1-162/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งกว้างริมหมู่บ้านพิษณุโลก  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ทุ่งกว้างริมหมู่บ้าน Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9

#### หาดชายฝั่งเงียบพิษณุโลก — Phitsanulok Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Phitsanulok · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/phitsanulok-beachside-camp-2-163/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดชายฝั่งเงียบพิษณุโลก  
  Minimal flat vector logo for a campsite "Phitsanulok Beachside Camp 2" (หาดชายฝั่งเงียบพิษณุโลก), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phitsanulok-beachside-camp-2-163/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดชายฝั่งเงียบพิษณุโลก  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดชายฝั่งเงียบ Phitsanulok Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/phitsanulok-beachside-camp-2-163/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดชายฝั่งเงียบพิษณุโลก  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดชายฝั่งเงียบ Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phitsanulok-beachside-camp-2-163/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น หาดชายฝั่งเงียบพิษณุโลก  
  signature hero view of Phitsanulok Beachside Camp 2: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/phitsanulok-beachside-camp-2-163/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ หาดชายฝั่งเงียบพิษณุโลก  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in หาดชายฝั่งเงียบ, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phitsanulok-beachside-camp-2-163/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ หาดชายฝั่งเงียบพิษณุโลก  
  close detail of the ริมทะเล/ชายหาด surroundings at หาดชายฝั่งเงียบ Phitsanulok (BEAC terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phitsanulok-beachside-camp-2-163/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง หาดชายฝั่งเงียบพิษณุโลก  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at หาดชายฝั่งเงียบ, tents arranged on the ground, surrounding BEAC landscape, warm sunset over the sea, 16:9
- `/seed/camps/phitsanulok-beachside-camp-2-163/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน หาดชายฝั่งเงียบพิษณุโลก  
  night scene of Phitsanulok Beachside Camp 2, glowing tents and warm string lights at a ริมทะเล/ชายหาด site in หาดชายฝั่งเงียบ, starry sky, long exposure, cozy mood, 16:9

#### อ่าวเล็กปลายแหลมพิจิตร — Phichit Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Phichit · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/phichit-beachside-camp-1-164/cover.jpg` (1:1, logo) — _alt:_ โลโก้ อ่าวเล็กปลายแหลมพิจิตร  
  Minimal flat vector logo for a campsite "Phichit Beachside Camp 1" (อ่าวเล็กปลายแหลมพิจิตร), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phichit-beachside-camp-1-164/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง อ่าวเล็กปลายแหลมพิจิตร  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at อ่าวเล็กปลายแหลม Phichit Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9

#### ทุ่งโล่งชานเมืองพิจิตร — Phichit Meadow Camp 2  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Phichit · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/phichit-meadow-camp-2-165/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งโล่งชานเมืองพิจิตร  
  Minimal flat vector logo for a campsite "Phichit Meadow Camp 2" (ทุ่งโล่งชานเมืองพิจิตร), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phichit-meadow-camp-2-165/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งโล่งชานเมืองพิจิตร  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ทุ่งโล่งชานเมือง Phichit Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/phichit-meadow-camp-2-165/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทุ่งโล่งชานเมืองพิจิตร  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ทุ่งโล่งชานเมือง Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phichit-meadow-camp-2-165/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทุ่งโล่งชานเมืองพิจิตร  
  signature hero view of Phichit Meadow Camp 2: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/phichit-meadow-camp-2-165/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ทุ่งโล่งชานเมืองพิจิตร  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ทุ่งโล่งชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phichit-meadow-camp-2-165/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ทุ่งโล่งชานเมืองพิจิตร  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at ทุ่งโล่งชานเมือง Phichit (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phichit-meadow-camp-2-165/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ทุ่งโล่งชานเมืองพิจิตร  
  aerial drone top-down view of the ทุ่งหญ้า/ชมดาว campsite at ทุ่งโล่งชานเมือง, tents arranged on the ground, surrounding MTNS and FORE landscape, clear starry night, 16:9

### โฮสต์ RGW — ห้างหุ้นส่วนจำกัด ตะวันตกไพรวัลย์ (PARTNERSHIP)

#### แนวป่าเขตรักษาพันธุ์ราชบุรี — Ratchaburi Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Ratchaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/ratchaburi-forest-camp-1-166/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แนวป่าเขตรักษาพันธุ์ราชบุรี  
  Minimal flat vector logo for a campsite "Ratchaburi Forest Camp 1" (แนวป่าเขตรักษาพันธุ์ราชบุรี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ratchaburi-forest-camp-1-166/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แนวป่าเขตรักษาพันธุ์ราชบุรี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at แนวป่าเขตรักษาพันธุ์ Ratchaburi Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/ratchaburi-forest-camp-1-166/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แนวป่าเขตรักษาพันธุ์ราชบุรี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, แนวป่าเขตรักษาพันธุ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/ratchaburi-forest-camp-1-166/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แนวป่าเขตรักษาพันธุ์ราชบุรี  
  signature hero view of Ratchaburi Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/ratchaburi-forest-camp-1-166/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แนวป่าเขตรักษาพันธุ์ราชบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in แนวป่าเขตรักษาพันธุ์, warm evening glow, candid lifestyle photo, 16:9

#### ริมคลองร่มรื่นราชบุรี — Ratchaburi Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Ratchaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/ratchaburi-riverside-camp-2-167/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นราชบุรี  
  Minimal flat vector logo for a campsite "Ratchaburi Riverside Camp 2" (ริมคลองร่มรื่นราชบุรี), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ratchaburi-riverside-camp-2-167/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นราชบุรี  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Ratchaburi Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/ratchaburi-riverside-camp-2-167/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นราชบุรี  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/ratchaburi-riverside-camp-2-167/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมคลองร่มรื่นราชบุรี  
  signature hero view of Ratchaburi Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/ratchaburi-riverside-camp-2-167/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมคลองร่มรื่นราชบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมคลองร่มรื่น, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/ratchaburi-riverside-camp-2-167/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมคลองร่มรื่นราชบุรี  
  close detail of the ริมน้ำ/ลำธาร surroundings at ริมคลองร่มรื่น Ratchaburi (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9

#### ชายป่าอนุรักษ์ราชบุรี — Ratchaburi Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Ratchaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/ratchaburi-forest-camp-3-168/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์ราชบุรี  
  Minimal flat vector logo for a campsite "Ratchaburi Forest Camp 3" (ชายป่าอนุรักษ์ราชบุรี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ratchaburi-forest-camp-3-168/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์ราชบุรี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Ratchaburi Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/ratchaburi-forest-camp-3-168/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์ราชบุรี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9

#### ป่าเบญจพรรณชานเมืองกาญจนบุรี — Kanchanaburi Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Kanchanaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/kanchanaburi-forest-camp-1-169/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองกาญจนบุรี  
  Minimal flat vector logo for a campsite "Kanchanaburi Forest Camp 1" (ป่าเบญจพรรณชานเมืองกาญจนบุรี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/kanchanaburi-forest-camp-1-169/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองกาญจนบุรี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Kanchanaburi Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/kanchanaburi-forest-camp-1-169/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองกาญจนบุรี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/kanchanaburi-forest-camp-1-169/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าเบญจพรรณชานเมืองกาญจนบุรี  
  signature hero view of Kanchanaburi Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9

#### ยอดดอยเงียบสงบกาญจนบุรี — Kanchanaburi Misty Highland Camp 2  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Kanchanaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/kanchanaburi-misty-highland-camp-2-170/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ยอดดอยเงียบสงบกาญจนบุรี  
  Minimal flat vector logo for a campsite "Kanchanaburi Misty Highland Camp 2" (ยอดดอยเงียบสงบกาญจนบุรี), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/kanchanaburi-misty-highland-camp-2-170/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ยอดดอยเงียบสงบกาญจนบุรี  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at ยอดดอยเงียบสงบ Kanchanaburi Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/kanchanaburi-misty-highland-camp-2-170/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ยอดดอยเงียบสงบกาญจนบุรี  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, ยอดดอยเงียบสงบ Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/kanchanaburi-misty-highland-camp-2-170/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ยอดดอยเงียบสงบกาญจนบุรี  
  signature hero view of Kanchanaburi Misty Highland Camp 2: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/kanchanaburi-misty-highland-camp-2-170/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ยอดดอยเงียบสงบกาญจนบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in ยอดดอยเงียบสงบ, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/kanchanaburi-misty-highland-camp-2-170/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ยอดดอยเงียบสงบกาญจนบุรี  
  close detail of the ทะเลหมอกภูเขา surroundings at ยอดดอยเงียบสงบ Kanchanaburi (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9

#### แนวป่าเขตรักษาพันธุ์กาญจนบุรี — Kanchanaburi Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Kanchanaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/kanchanaburi-forest-camp-3-171/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แนวป่าเขตรักษาพันธุ์กาญจนบุรี  
  Minimal flat vector logo for a campsite "Kanchanaburi Forest Camp 3" (แนวป่าเขตรักษาพันธุ์กาญจนบุรี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/kanchanaburi-forest-camp-3-171/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แนวป่าเขตรักษาพันธุ์กาญจนบุรี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at แนวป่าเขตรักษาพันธุ์ Kanchanaburi Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/kanchanaburi-forest-camp-3-171/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แนวป่าเขตรักษาพันธุ์กาญจนบุรี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, แนวป่าเขตรักษาพันธุ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/kanchanaburi-forest-camp-3-171/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แนวป่าเขตรักษาพันธุ์กาญจนบุรี  
  signature hero view of Kanchanaburi Forest Camp 3: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/kanchanaburi-forest-camp-3-171/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แนวป่าเขตรักษาพันธุ์กาญจนบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in แนวป่าเขตรักษาพันธุ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/kanchanaburi-forest-camp-3-171/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ แนวป่าเขตรักษาพันธุ์กาญจนบุรี  
  close detail of the ป่าลึก/ผจญภัย surroundings at แนวป่าเขตรักษาพันธุ์ Kanchanaburi (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ RGC — อัครเดช ที่ราบกลาง (INDIVIDUAL)

#### เนินหญ้าชายทุ่งสุพรรณบุรี — Suphan Buri Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Suphan Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/suphan-buri-meadow-camp-1-172/cover.jpg` (1:1, logo) — _alt:_ โลโก้ เนินหญ้าชายทุ่งสุพรรณบุรี  
  Minimal flat vector logo for a campsite "Suphan Buri Meadow Camp 1" (เนินหญ้าชายทุ่งสุพรรณบุรี), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/suphan-buri-meadow-camp-1-172/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง เนินหญ้าชายทุ่งสุพรรณบุรี  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at เนินหญ้าชายทุ่ง Suphan Buri Thailand, clear starry night, photorealistic, highly detailed, 16:9

#### ป่าชุมชนใกล้เมืองสุพรรณบุรี — Suphan Buri Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Suphan Buri · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/suphan-buri-forest-camp-2-173/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองสุพรรณบุรี  
  Minimal flat vector logo for a campsite "Suphan Buri Forest Camp 2" (ป่าชุมชนใกล้เมืองสุพรรณบุรี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/suphan-buri-forest-camp-2-173/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองสุพรรณบุรี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Suphan Buri Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/suphan-buri-forest-camp-2-173/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าชุมชนใกล้เมืองสุพรรณบุรี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าชุมชนใกล้เมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/suphan-buri-forest-camp-2-173/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าชุมชนใกล้เมืองสุพรรณบุรี  
  signature hero view of Suphan Buri Forest Camp 2: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/suphan-buri-forest-camp-2-173/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าชุมชนใกล้เมืองสุพรรณบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าชุมชนใกล้เมือง, warm evening glow, candid lifestyle photo, 16:9

#### ที่ราบเชิงเขานครปฐม — Nakhon Pathom Meadow Camp 1  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Nakhon Pathom · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/nakhon-pathom-meadow-camp-1-174/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ที่ราบเชิงเขานครปฐม  
  Minimal flat vector logo for a campsite "Nakhon Pathom Meadow Camp 1" (ที่ราบเชิงเขานครปฐม), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-pathom-meadow-camp-1-174/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ที่ราบเชิงเขานครปฐม  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ที่ราบเชิงเขา Nakhon Pathom Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-pathom-meadow-camp-1-174/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ที่ราบเชิงเขานครปฐม  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ที่ราบเชิงเขา Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-pathom-meadow-camp-1-174/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ที่ราบเชิงเขานครปฐม  
  signature hero view of Nakhon Pathom Meadow Camp 1: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/nakhon-pathom-meadow-camp-1-174/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ที่ราบเชิงเขานครปฐม  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ที่ราบเชิงเขา, warm evening glow, candid lifestyle photo, 16:9

#### อ่าวเล็กปลายแหลมนครปฐม — Nakhon Pathom Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Nakhon Pathom · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/nakhon-pathom-beachside-camp-2-175/cover.jpg` (1:1, logo) — _alt:_ โลโก้ อ่าวเล็กปลายแหลมนครปฐม  
  Minimal flat vector logo for a campsite "Nakhon Pathom Beachside Camp 2" (อ่าวเล็กปลายแหลมนครปฐม), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-pathom-beachside-camp-2-175/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง อ่าวเล็กปลายแหลมนครปฐม  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at อ่าวเล็กปลายแหลม Nakhon Pathom Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-pathom-beachside-camp-2-175/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ อ่าวเล็กปลายแหลมนครปฐม  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, อ่าวเล็กปลายแหลม Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-pathom-beachside-camp-2-175/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น อ่าวเล็กปลายแหลมนครปฐม  
  signature hero view of Nakhon Pathom Beachside Camp 2: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9

#### ชายป่าอนุรักษ์นครปฐม — Nakhon Pathom Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Nakhon Pathom · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/nakhon-pathom-forest-camp-3-176/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์นครปฐม  
  Minimal flat vector logo for a campsite "Nakhon Pathom Forest Camp 3" (ชายป่าอนุรักษ์นครปฐม), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-pathom-forest-camp-3-176/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์นครปฐม  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Nakhon Pathom Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-pathom-forest-camp-3-176/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์นครปฐม  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-pathom-forest-camp-3-176/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์นครปฐม  
  signature hero view of Nakhon Pathom Forest Camp 3: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/nakhon-pathom-forest-camp-3-176/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์นครปฐม  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/nakhon-pathom-forest-camp-3-176/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ชายป่าอนุรักษ์นครปฐม  
  close detail of the ป่าลึก/ผจญภัย surroundings at ชายป่าอนุรักษ์ Nakhon Pathom (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/nakhon-pathom-forest-camp-3-176/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ชายป่าอนุรักษ์นครปฐม  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ชายป่าอนุรักษ์, tents arranged on the ground, surrounding FORE and MTNS landscape, misty early morning, 16:9
- `/seed/camps/nakhon-pathom-forest-camp-3-176/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ชายป่าอนุรักษ์นครปฐม  
  night scene of Nakhon Pathom Forest Camp 3, glowing tents and warm string lights at a ป่าลึก/ผจญภัย site in ชายป่าอนุรักษ์, starry sky, long exposure, cozy mood, 16:9

#### ริมแม่น้ำสายหลักสมุทรสาคร — Samut Sakhon Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Samut Sakhon · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/samut-sakhon-riverside-camp-1-177/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักสมุทรสาคร  
  Minimal flat vector logo for a campsite "Samut Sakhon Riverside Camp 1" (ริมแม่น้ำสายหลักสมุทรสาคร), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/samut-sakhon-riverside-camp-1-177/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักสมุทรสาคร  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Samut Sakhon Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/samut-sakhon-riverside-camp-1-177/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักสมุทรสาคร  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/samut-sakhon-riverside-camp-1-177/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมแม่น้ำสายหลักสมุทรสาคร  
  signature hero view of Samut Sakhon Riverside Camp 1: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/samut-sakhon-riverside-camp-1-177/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมแม่น้ำสายหลักสมุทรสาคร  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมแม่น้ำสายหลัก, warm evening glow, candid lifestyle photo, 16:9

#### หาดชายฝั่งเงียบสมุทรสาคร — Samut Sakhon Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Samut Sakhon · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/samut-sakhon-beachside-camp-2-178/cover.jpg` (1:1, logo) — _alt:_ โลโก้ หาดชายฝั่งเงียบสมุทรสาคร  
  Minimal flat vector logo for a campsite "Samut Sakhon Beachside Camp 2" (หาดชายฝั่งเงียบสมุทรสาคร), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/samut-sakhon-beachside-camp-2-178/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง หาดชายฝั่งเงียบสมุทรสาคร  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at หาดชายฝั่งเงียบ Samut Sakhon Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/samut-sakhon-beachside-camp-2-178/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ หาดชายฝั่งเงียบสมุทรสาคร  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, หาดชายฝั่งเงียบ Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/samut-sakhon-beachside-camp-2-178/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น หาดชายฝั่งเงียบสมุทรสาคร  
  signature hero view of Samut Sakhon Beachside Camp 2: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/samut-sakhon-beachside-camp-2-178/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ หาดชายฝั่งเงียบสมุทรสาคร  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in หาดชายฝั่งเงียบ, warm evening glow, candid lifestyle photo, 16:9

#### ต้นน้ำชานเมืองสมุทรสาคร — Samut Sakhon Riverside Camp 3  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Samut Sakhon · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/samut-sakhon-riverside-camp-3-179/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ต้นน้ำชานเมืองสมุทรสาคร  
  Minimal flat vector logo for a campsite "Samut Sakhon Riverside Camp 3" (ต้นน้ำชานเมืองสมุทรสาคร), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/samut-sakhon-riverside-camp-3-179/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ต้นน้ำชานเมืองสมุทรสาคร  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ต้นน้ำชานเมือง Samut Sakhon Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/samut-sakhon-riverside-camp-3-179/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ต้นน้ำชานเมืองสมุทรสาคร  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ต้นน้ำชานเมือง Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9

#### ริมคลองร่มรื่นสมุทรสงคราม — Samut Songkhram Riverside Camp 1  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Samut Songkhram · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/samut-songkhram-riverside-camp-1-180/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมคลองร่มรื่นสมุทรสงคราม  
  Minimal flat vector logo for a campsite "Samut Songkhram Riverside Camp 1" (ริมคลองร่มรื่นสมุทรสงคราม), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/samut-songkhram-riverside-camp-1-180/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมคลองร่มรื่นสมุทรสงคราม  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมคลองร่มรื่น Samut Songkhram Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/samut-songkhram-riverside-camp-1-180/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมคลองร่มรื่นสมุทรสงคราม  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมคลองร่มรื่น Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9

#### ทุ่งกว้างริมหมู่บ้านสมุทรสงคราม — Samut Songkhram Meadow Camp 2  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Samut Songkhram · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/samut-songkhram-meadow-camp-2-181/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทุ่งกว้างริมหมู่บ้านสมุทรสงคราม  
  Minimal flat vector logo for a campsite "Samut Songkhram Meadow Camp 2" (ทุ่งกว้างริมหมู่บ้านสมุทรสงคราม), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/samut-songkhram-meadow-camp-2-181/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทุ่งกว้างริมหมู่บ้านสมุทรสงคราม  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ทุ่งกว้างริมหมู่บ้าน Samut Songkhram Thailand, clear starry night, photorealistic, highly detailed, 16:9

#### ที่ราบเชิงเขาสมุทรสงคราม — Samut Songkhram Meadow Camp 3  
ธีม: ทุ่งหญ้า/ชมดาว · จังหวัด: Samut Songkhram · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/samut-songkhram-meadow-camp-3-182/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ที่ราบเชิงเขาสมุทรสงคราม  
  Minimal flat vector logo for a campsite "Samut Songkhram Meadow Camp 3" (ที่ราบเชิงเขาสมุทรสงคราม), ทุ่งหญ้า/ชมดาว motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/samut-songkhram-meadow-camp-3-182/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ที่ราบเชิงเขาสมุทรสงคราม  
  wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, wide establishing shot at ที่ราบเชิงเขา Samut Songkhram Thailand, clear starry night, photorealistic, highly detailed, 16:9
- `/seed/camps/samut-songkhram-meadow-camp-3-182/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ที่ราบเชิงเขาสมุทรสงคราม  
  cozy dome camping tents pitched at a ทุ่งหญ้า/ชมดาว site, ที่ราบเชิงเขา Thailand, clear starry night, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/samut-songkhram-meadow-camp-3-182/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ที่ราบเชิงเขาสมุทรสงคราม  
  signature hero view of Samut Songkhram Meadow Camp 3: wide open grassy meadow campground in a mountain valley, rows of glowing tents under a starry milky-way sky, dramatic clear starry night, no people, travel photography, 16:9
- `/seed/camps/samut-songkhram-meadow-camp-3-182/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ที่ราบเชิงเขาสมุทรสงคราม  
  Thai campers relaxing around a campfire and camp chairs at a ทุ่งหญ้า/ชมดาว campsite in ที่ราบเชิงเขา, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/samut-songkhram-meadow-camp-3-182/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ที่ราบเชิงเขาสมุทรสงคราม  
  close detail of the ทุ่งหญ้า/ชมดาว surroundings at ที่ราบเชิงเขา Samut Songkhram (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9

### โฮสต์ RGW — ห้างหุ้นส่วนจำกัด ตะวันตกไพรวัลย์ (PARTNERSHIP)

#### ป่าชุมชนใกล้เมืองเพชรบุรี — Phetchaburi Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Phetchaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/phetchaburi-forest-camp-1-183/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองเพชรบุรี  
  Minimal flat vector logo for a campsite "Phetchaburi Forest Camp 1" (ป่าชุมชนใกล้เมืองเพชรบุรี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phetchaburi-forest-camp-1-183/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองเพชรบุรี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Phetchaburi Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/phetchaburi-forest-camp-1-183/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าชุมชนใกล้เมืองเพชรบุรี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าชุมชนใกล้เมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phetchaburi-forest-camp-1-183/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าชุมชนใกล้เมืองเพชรบุรี  
  signature hero view of Phetchaburi Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/phetchaburi-forest-camp-1-183/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าชุมชนใกล้เมืองเพชรบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าชุมชนใกล้เมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phetchaburi-forest-camp-1-183/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ป่าชุมชนใกล้เมืองเพชรบุรี  
  close detail of the ป่าลึก/ผจญภัย surroundings at ป่าชุมชนใกล้เมือง Phetchaburi (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9

#### สันเขาเหนือหมู่บ้านเพชรบุรี — Phetchaburi Misty Highland Camp 2  
ธีม: ทะเลหมอกภูเขา · จังหวัด: Phetchaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/phetchaburi-misty-highland-camp-2-184/cover.jpg` (1:1, logo) — _alt:_ โลโก้ สันเขาเหนือหมู่บ้านเพชรบุรี  
  Minimal flat vector logo for a campsite "Phetchaburi Misty Highland Camp 2" (สันเขาเหนือหมู่บ้านเพชรบุรี), ทะเลหมอกภูเขา motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phetchaburi-misty-highland-camp-2-184/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง สันเขาเหนือหมู่บ้านเพชรบุรี  
  misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, wide establishing shot at สันเขาเหนือหมู่บ้าน Phetchaburi Thailand, golden sunrise with low fog, photorealistic, highly detailed, 16:9
- `/seed/camps/phetchaburi-misty-highland-camp-2-184/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ สันเขาเหนือหมู่บ้านเพชรบุรี  
  cozy dome camping tents pitched at a ทะเลหมอกภูเขา site, สันเขาเหนือหมู่บ้าน Thailand, golden sunrise with low fog, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phetchaburi-misty-highland-camp-2-184/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น สันเขาเหนือหมู่บ้านเพชรบุรี  
  signature hero view of Phetchaburi Misty Highland Camp 2: misty mountain ridge campsite at dawn, a sea of clouds filling the valley below, pine trees, dramatic golden sunrise with low fog, no people, travel photography, 16:9
- `/seed/camps/phetchaburi-misty-highland-camp-2-184/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ สันเขาเหนือหมู่บ้านเพชรบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ทะเลหมอกภูเขา campsite in สันเขาเหนือหมู่บ้าน, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phetchaburi-misty-highland-camp-2-184/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ สันเขาเหนือหมู่บ้านเพชรบุรี  
  close detail of the ทะเลหมอกภูเขา surroundings at สันเขาเหนือหมู่บ้าน Phetchaburi (MTNS+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phetchaburi-misty-highland-camp-2-184/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง สันเขาเหนือหมู่บ้านเพชรบุรี  
  aerial drone top-down view of the ทะเลหมอกภูเขา campsite at สันเขาเหนือหมู่บ้าน, tents arranged on the ground, surrounding MTNS and FORE landscape, golden sunrise with low fog, 16:9

#### ป่าเบญจพรรณชานเมืองเพชรบุรี — Phetchaburi Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Phetchaburi · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/phetchaburi-forest-camp-3-185/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองเพชรบุรี  
  Minimal flat vector logo for a campsite "Phetchaburi Forest Camp 3" (ป่าเบญจพรรณชานเมืองเพชรบุรี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phetchaburi-forest-camp-3-185/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองเพชรบุรี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Phetchaburi Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/phetchaburi-forest-camp-3-185/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองเพชรบุรี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phetchaburi-forest-camp-3-185/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าเบญจพรรณชานเมืองเพชรบุรี  
  signature hero view of Phetchaburi Forest Camp 3: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/phetchaburi-forest-camp-3-185/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าเบญจพรรณชานเมืองเพชรบุรี  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าเบญจพรรณชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/phetchaburi-forest-camp-3-185/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ป่าเบญจพรรณชานเมืองเพชรบุรี  
  close detail of the ป่าลึก/ผจญภัย surroundings at ป่าเบญจพรรณชานเมือง Phetchaburi (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/phetchaburi-forest-camp-3-185/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ป่าเบญจพรรณชานเมืองเพชรบุรี  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ป่าเบญจพรรณชานเมือง, tents arranged on the ground, surrounding FORE and MTNS landscape, misty early morning, 16:9
- `/seed/camps/phetchaburi-forest-camp-3-185/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ป่าเบญจพรรณชานเมืองเพชรบุรี  
  night scene of Phetchaburi Forest Camp 3, glowing tents and warm string lights at a ป่าลึก/ผจญภัย site in ป่าเบญจพรรณชานเมือง, starry sky, long exposure, cozy mood, 16:9

#### ชายป่าอนุรักษ์ประจวบคีรีขันธ์ — Prachuap Khiri Khan Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Prachuap Khiri Khan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/prachuap-khiri-khan-forest-camp-1-186/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์ประจวบคีรีขันธ์  
  Minimal flat vector logo for a campsite "Prachuap Khiri Khan Forest Camp 1" (ชายป่าอนุรักษ์ประจวบคีรีขันธ์), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/prachuap-khiri-khan-forest-camp-1-186/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์ประจวบคีรีขันธ์  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Prachuap Khiri Khan Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/prachuap-khiri-khan-forest-camp-1-186/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์ประจวบคีรีขันธ์  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9

#### ริมแม่น้ำสายหลักประจวบคีรีขันธ์ — Prachuap Khiri Khan Riverside Camp 2  
ธีม: ริมน้ำ/ลำธาร · จังหวัด: Prachuap Khiri Khan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/prachuap-khiri-khan-riverside-camp-2-187/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมแม่น้ำสายหลักประจวบคีรีขันธ์  
  Minimal flat vector logo for a campsite "Prachuap Khiri Khan Riverside Camp 2" (ริมแม่น้ำสายหลักประจวบคีรีขันธ์), ริมน้ำ/ลำธาร motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/prachuap-khiri-khan-riverside-camp-2-187/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมแม่น้ำสายหลักประจวบคีรีขันธ์  
  campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, wide establishing shot at ริมแม่น้ำสายหลัก Prachuap Khiri Khan Thailand, soft morning light through trees, photorealistic, highly detailed, 16:9
- `/seed/camps/prachuap-khiri-khan-riverside-camp-2-187/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมแม่น้ำสายหลักประจวบคีรีขันธ์  
  cozy dome camping tents pitched at a ริมน้ำ/ลำธาร site, ริมแม่น้ำสายหลัก Thailand, soft morning light through trees, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/prachuap-khiri-khan-riverside-camp-2-187/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมแม่น้ำสายหลักประจวบคีรีขันธ์  
  signature hero view of Prachuap Khiri Khan Riverside Camp 2: campsite beside a clear shallow stream over smooth rocks, shady riverbank forest, dramatic soft morning light through trees, no people, travel photography, 16:9
- `/seed/camps/prachuap-khiri-khan-riverside-camp-2-187/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมแม่น้ำสายหลักประจวบคีรีขันธ์  
  Thai campers relaxing around a campfire and camp chairs at a ริมน้ำ/ลำธาร campsite in ริมแม่น้ำสายหลัก, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/prachuap-khiri-khan-riverside-camp-2-187/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมแม่น้ำสายหลักประจวบคีรีขันธ์  
  close detail of the ริมน้ำ/ลำธาร surroundings at ริมแม่น้ำสายหลัก Prachuap Khiri Khan (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9

#### แนวป่าเขตรักษาพันธุ์ประจวบคีรีขันธ์ — Prachuap Khiri Khan Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Prachuap Khiri Khan · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/prachuap-khiri-khan-forest-camp-3-188/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แนวป่าเขตรักษาพันธุ์ประจวบคีรีขันธ์  
  Minimal flat vector logo for a campsite "Prachuap Khiri Khan Forest Camp 3" (แนวป่าเขตรักษาพันธุ์ประจวบคีรีขันธ์), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/prachuap-khiri-khan-forest-camp-3-188/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แนวป่าเขตรักษาพันธุ์ประจวบคีรีขันธ์  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at แนวป่าเขตรักษาพันธุ์ Prachuap Khiri Khan Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/prachuap-khiri-khan-forest-camp-3-188/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แนวป่าเขตรักษาพันธุ์ประจวบคีรีขันธ์  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, แนวป่าเขตรักษาพันธุ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/prachuap-khiri-khan-forest-camp-3-188/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แนวป่าเขตรักษาพันธุ์ประจวบคีรีขันธ์  
  signature hero view of Prachuap Khiri Khan Forest Camp 3: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9

### โฮสต์ RGS — สุนิสา ทะเลใต้ (INDIVIDUAL)

#### ชายป่าอนุรักษ์นครศรีธรรมราช — Nakhon Si Thammarat Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Nakhon Si Thammarat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/nakhon-si-thammarat-forest-camp-1-189/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์นครศรีธรรมราช  
  Minimal flat vector logo for a campsite "Nakhon Si Thammarat Forest Camp 1" (ชายป่าอนุรักษ์นครศรีธรรมราช), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-si-thammarat-forest-camp-1-189/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์นครศรีธรรมราช  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Nakhon Si Thammarat Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-si-thammarat-forest-camp-1-189/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์นครศรีธรรมราช  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-si-thammarat-forest-camp-1-189/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์นครศรีธรรมราช  
  signature hero view of Nakhon Si Thammarat Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/nakhon-si-thammarat-forest-camp-1-189/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์นครศรีธรรมราช  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9

#### แหลมหาดทรายนครศรีธรรมราช — Nakhon Si Thammarat Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Nakhon Si Thammarat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/nakhon-si-thammarat-beachside-camp-2-190/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายนครศรีธรรมราช  
  Minimal flat vector logo for a campsite "Nakhon Si Thammarat Beachside Camp 2" (แหลมหาดทรายนครศรีธรรมราช), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/nakhon-si-thammarat-beachside-camp-2-190/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายนครศรีธรรมราช  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Nakhon Si Thammarat Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/nakhon-si-thammarat-beachside-camp-2-190/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหลมหาดทรายนครศรีธรรมราช  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, แหลมหาดทราย Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/nakhon-si-thammarat-beachside-camp-2-190/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหลมหาดทรายนครศรีธรรมราช  
  signature hero view of Nakhon Si Thammarat Beachside Camp 2: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/nakhon-si-thammarat-beachside-camp-2-190/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แหลมหาดทรายนครศรีธรรมราช  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in แหลมหาดทราย, warm evening glow, candid lifestyle photo, 16:9

#### ชายป่าอนุรักษ์พังงา — Phang Nga Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Phang Nga · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/phang-nga-forest-camp-1-191/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์พังงา  
  Minimal flat vector logo for a campsite "Phang Nga Forest Camp 1" (ชายป่าอนุรักษ์พังงา), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phang-nga-forest-camp-1-191/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์พังงา  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Phang Nga Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/phang-nga-forest-camp-1-191/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์พังงา  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phang-nga-forest-camp-1-191/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์พังงา  
  signature hero view of Phang Nga Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/phang-nga-forest-camp-1-191/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์พังงา  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9

#### อ่าวเล็กปลายแหลมพังงา — Phang Nga Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Phang Nga · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/phang-nga-beachside-camp-2-192/cover.jpg` (1:1, logo) — _alt:_ โลโก้ อ่าวเล็กปลายแหลมพังงา  
  Minimal flat vector logo for a campsite "Phang Nga Beachside Camp 2" (อ่าวเล็กปลายแหลมพังงา), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phang-nga-beachside-camp-2-192/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง อ่าวเล็กปลายแหลมพังงา  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at อ่าวเล็กปลายแหลม Phang Nga Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9

#### ชายป่าอนุรักษ์พังงา — Phang Nga Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Phang Nga · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/phang-nga-forest-camp-3-193/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์พังงา  
  Minimal flat vector logo for a campsite "Phang Nga Forest Camp 3" (ชายป่าอนุรักษ์พังงา), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phang-nga-forest-camp-3-193/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์พังงา  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Phang Nga Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/phang-nga-forest-camp-3-193/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์พังงา  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phang-nga-forest-camp-3-193/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์พังงา  
  signature hero view of Phang Nga Forest Camp 3: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/phang-nga-forest-camp-3-193/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์พังงา  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9

#### แหลมหาดทรายระนอง — Ranong Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Ranong · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/ranong-beachside-camp-1-194/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายระนอง  
  Minimal flat vector logo for a campsite "Ranong Beachside Camp 1" (แหลมหาดทรายระนอง), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ranong-beachside-camp-1-194/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายระนอง  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Ranong Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/ranong-beachside-camp-1-194/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหลมหาดทรายระนอง  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, แหลมหาดทราย Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/ranong-beachside-camp-1-194/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหลมหาดทรายระนอง  
  signature hero view of Ranong Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9

#### ริมทะเลนอกเมืองระนอง — Ranong Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Ranong · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/ranong-beachside-camp-2-195/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมทะเลนอกเมืองระนอง  
  Minimal flat vector logo for a campsite "Ranong Beachside Camp 2" (ริมทะเลนอกเมืองระนอง), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ranong-beachside-camp-2-195/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมทะเลนอกเมืองระนอง  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at ริมทะเลนอกเมือง Ranong Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9

#### ชายป่าอนุรักษ์ระนอง — Ranong Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Ranong · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/ranong-forest-camp-3-196/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์ระนอง  
  Minimal flat vector logo for a campsite "Ranong Forest Camp 3" (ชายป่าอนุรักษ์ระนอง), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/ranong-forest-camp-3-196/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์ระนอง  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Ranong Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/ranong-forest-camp-3-196/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์ระนอง  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/ranong-forest-camp-3-196/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์ระนอง  
  signature hero view of Ranong Forest Camp 3: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/ranong-forest-camp-3-196/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์ระนอง  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/ranong-forest-camp-3-196/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ชายป่าอนุรักษ์ระนอง  
  close detail of the ป่าลึก/ผจญภัย surroundings at ชายป่าอนุรักษ์ Ranong (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/ranong-forest-camp-3-196/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ชายป่าอนุรักษ์ระนอง  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ชายป่าอนุรักษ์, tents arranged on the ground, surrounding FORE and MTNS landscape, misty early morning, 16:9
- `/seed/camps/ranong-forest-camp-3-196/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน ชายป่าอนุรักษ์ระนอง  
  night scene of Ranong Forest Camp 3, glowing tents and warm string lights at a ป่าลึก/ผจญภัย site in ชายป่าอนุรักษ์, starry sky, long exposure, cozy mood, 16:9

#### ชายป่าอนุรักษ์ชุมพร — Chumphon Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Chumphon · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/chumphon-forest-camp-1-197/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์ชุมพร  
  Minimal flat vector logo for a campsite "Chumphon Forest Camp 1" (ชายป่าอนุรักษ์ชุมพร), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chumphon-forest-camp-1-197/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์ชุมพร  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Chumphon Thailand, misty early morning, photorealistic, highly detailed, 16:9

#### ริมทะเลนอกเมืองชุมพร — Chumphon Beachside Camp 2  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Chumphon · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/chumphon-beachside-camp-2-198/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมทะเลนอกเมืองชุมพร  
  Minimal flat vector logo for a campsite "Chumphon Beachside Camp 2" (ริมทะเลนอกเมืองชุมพร), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chumphon-beachside-camp-2-198/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมทะเลนอกเมืองชุมพร  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at ริมทะเลนอกเมือง Chumphon Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/chumphon-beachside-camp-2-198/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมทะเลนอกเมืองชุมพร  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, ริมทะเลนอกเมือง Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chumphon-beachside-camp-2-198/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมทะเลนอกเมืองชุมพร  
  signature hero view of Chumphon Beachside Camp 2: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/chumphon-beachside-camp-2-198/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมทะเลนอกเมืองชุมพร  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in ริมทะเลนอกเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/chumphon-beachside-camp-2-198/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ริมทะเลนอกเมืองชุมพร  
  close detail of the ริมทะเล/ชายหาด surroundings at ริมทะเลนอกเมือง Chumphon (BEAC terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/chumphon-beachside-camp-2-198/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ริมทะเลนอกเมืองชุมพร  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at ริมทะเลนอกเมือง, tents arranged on the ground, surrounding BEAC landscape, warm sunset over the sea, 16:9

#### ป่าเบญจพรรณชานเมืองชุมพร — Chumphon Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Chumphon · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/chumphon-forest-camp-3-199/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองชุมพร  
  Minimal flat vector logo for a campsite "Chumphon Forest Camp 3" (ป่าเบญจพรรณชานเมืองชุมพร), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/chumphon-forest-camp-3-199/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองชุมพร  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Chumphon Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/chumphon-forest-camp-3-199/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองชุมพร  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/chumphon-forest-camp-3-199/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าเบญจพรรณชานเมืองชุมพร  
  signature hero view of Chumphon Forest Camp 3: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/chumphon-forest-camp-3-199/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าเบญจพรรณชานเมืองชุมพร  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าเบญจพรรณชานเมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/chumphon-forest-camp-3-199/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ป่าเบญจพรรณชานเมืองชุมพร  
  close detail of the ป่าลึก/ผจญภัย surroundings at ป่าเบญจพรรณชานเมือง Chumphon (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9

#### แหลมหาดทรายสงขลา — Songkhla Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Songkhla · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/songkhla-beachside-camp-1-200/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายสงขลา  
  Minimal flat vector logo for a campsite "Songkhla Beachside Camp 1" (แหลมหาดทรายสงขลา), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/songkhla-beachside-camp-1-200/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายสงขลา  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Songkhla Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/songkhla-beachside-camp-1-200/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหลมหาดทรายสงขลา  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, แหลมหาดทราย Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/songkhla-beachside-camp-1-200/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหลมหาดทรายสงขลา  
  signature hero view of Songkhla Beachside Camp 1: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/songkhla-beachside-camp-1-200/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แหลมหาดทรายสงขลา  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in แหลมหาดทราย, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/songkhla-beachside-camp-1-200/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ แหลมหาดทรายสงขลา  
  close detail of the ริมทะเล/ชายหาด surroundings at แหลมหาดทราย Songkhla (BEAC terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/songkhla-beachside-camp-1-200/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง แหลมหาดทรายสงขลา  
  aerial drone top-down view of the ริมทะเล/ชายหาด campsite at แหลมหาดทราย, tents arranged on the ground, surrounding BEAC landscape, warm sunset over the sea, 16:9

#### แหล่งน้ำใหญ่กลางหุบเขาสงขลา — Songkhla Lakeside Camp 2  
ธีม: ริมทะเลสาบ · จังหวัด: Songkhla · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/songkhla-lakeside-camp-2-201/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหล่งน้ำใหญ่กลางหุบเขาสงขลา  
  Minimal flat vector logo for a campsite "Songkhla Lakeside Camp 2" (แหล่งน้ำใหญ่กลางหุบเขาสงขลา), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/songkhla-lakeside-camp-2-201/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหล่งน้ำใหญ่กลางหุบเขาสงขลา  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at แหล่งน้ำใหญ่กลางหุบเขา Songkhla Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/songkhla-lakeside-camp-2-201/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหล่งน้ำใหญ่กลางหุบเขาสงขลา  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, แหล่งน้ำใหญ่กลางหุบเขา Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/songkhla-lakeside-camp-2-201/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหล่งน้ำใหญ่กลางหุบเขาสงขลา  
  signature hero view of Songkhla Lakeside Camp 2: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/songkhla-lakeside-camp-2-201/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แหล่งน้ำใหญ่กลางหุบเขาสงขลา  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in แหล่งน้ำใหญ่กลางหุบเขา, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/songkhla-lakeside-camp-2-201/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ แหล่งน้ำใหญ่กลางหุบเขาสงขลา  
  close detail of the ริมทะเลสาบ surroundings at แหล่งน้ำใหญ่กลางหุบเขา Songkhla (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/songkhla-lakeside-camp-2-201/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง แหล่งน้ำใหญ่กลางหุบเขาสงขลา  
  aerial drone top-down view of the ริมทะเลสาบ campsite at แหล่งน้ำใหญ่กลางหุบเขา, tents arranged on the ground, surrounding RIVE and FORE landscape, still dawn with mist on the water, 16:9

#### แหลมหาดทรายสงขลา — Songkhla Beachside Camp 3  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Songkhla · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/songkhla-beachside-camp-3-202/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายสงขลา  
  Minimal flat vector logo for a campsite "Songkhla Beachside Camp 3" (แหลมหาดทรายสงขลา), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/songkhla-beachside-camp-3-202/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายสงขลา  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Songkhla Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/songkhla-beachside-camp-3-202/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหลมหาดทรายสงขลา  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, แหลมหาดทราย Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/songkhla-beachside-camp-3-202/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหลมหาดทรายสงขลา  
  signature hero view of Songkhla Beachside Camp 3: beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, dramatic warm sunset over the sea, no people, travel photography, 16:9
- `/seed/camps/songkhla-beachside-camp-3-202/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แหลมหาดทรายสงขลา  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเล/ชายหาด campsite in แหลมหาดทราย, warm evening glow, candid lifestyle photo, 16:9

#### ป่าชุมชนใกล้เมืองสตูล — Satun Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Satun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/satun-forest-camp-1-203/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองสตูล  
  Minimal flat vector logo for a campsite "Satun Forest Camp 1" (ป่าชุมชนใกล้เมืองสตูล), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/satun-forest-camp-1-203/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองสตูล  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Satun Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/satun-forest-camp-1-203/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าชุมชนใกล้เมืองสตูล  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าชุมชนใกล้เมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/satun-forest-camp-1-203/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าชุมชนใกล้เมืองสตูล  
  signature hero view of Satun Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/satun-forest-camp-1-203/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าชุมชนใกล้เมืองสตูล  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าชุมชนใกล้เมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/satun-forest-camp-1-203/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ป่าชุมชนใกล้เมืองสตูล  
  close detail of the ป่าลึก/ผจญภัย surroundings at ป่าชุมชนใกล้เมือง Satun (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/satun-forest-camp-1-203/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ป่าชุมชนใกล้เมืองสตูล  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ป่าชุมชนใกล้เมือง, tents arranged on the ground, surrounding FORE and MTNS landscape, misty early morning, 16:9

#### แหล่งน้ำใหญ่กลางหุบเขาสตูล — Satun Lakeside Camp 2  
ธีม: ริมทะเลสาบ · จังหวัด: Satun · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 7**

- `/seed/camps/satun-lakeside-camp-2-204/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหล่งน้ำใหญ่กลางหุบเขาสตูล  
  Minimal flat vector logo for a campsite "Satun Lakeside Camp 2" (แหล่งน้ำใหญ่กลางหุบเขาสตูล), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/satun-lakeside-camp-2-204/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหล่งน้ำใหญ่กลางหุบเขาสตูล  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at แหล่งน้ำใหญ่กลางหุบเขา Satun Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/satun-lakeside-camp-2-204/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหล่งน้ำใหญ่กลางหุบเขาสตูล  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, แหล่งน้ำใหญ่กลางหุบเขา Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/satun-lakeside-camp-2-204/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหล่งน้ำใหญ่กลางหุบเขาสตูล  
  signature hero view of Satun Lakeside Camp 2: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/satun-lakeside-camp-2-204/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แหล่งน้ำใหญ่กลางหุบเขาสตูล  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in แหล่งน้ำใหญ่กลางหุบเขา, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/satun-lakeside-camp-2-204/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ แหล่งน้ำใหญ่กลางหุบเขาสตูล  
  close detail of the ริมทะเลสาบ surroundings at แหล่งน้ำใหญ่กลางหุบเขา Satun (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/satun-lakeside-camp-2-204/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง แหล่งน้ำใหญ่กลางหุบเขาสตูล  
  aerial drone top-down view of the ริมทะเลสาบ campsite at แหล่งน้ำใหญ่กลางหุบเขา, tents arranged on the ground, surrounding RIVE and FORE landscape, still dawn with mist on the water, 16:9
- `/seed/camps/satun-lakeside-camp-2-204/07.jpg` (16:9, gallery/night) — _alt:_ ยามค่ำคืน แหล่งน้ำใหญ่กลางหุบเขาสตูล  
  night scene of Satun Lakeside Camp 2, glowing tents and warm string lights at a ริมทะเลสาบ site in แหล่งน้ำใหญ่กลางหุบเขา, starry sky, long exposure, cozy mood, 16:9

#### แหลมหาดทรายตรัง — Trang Beachside Camp 1  
ธีม: ริมทะเล/ชายหาด · จังหวัด: Trang · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/trang-beachside-camp-1-205/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหลมหาดทรายตรัง  
  Minimal flat vector logo for a campsite "Trang Beachside Camp 1" (แหลมหาดทรายตรัง), ริมทะเล/ชายหาด motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/trang-beachside-camp-1-205/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหลมหาดทรายตรัง  
  beachfront campsite on white sand, turquoise sea, palm trees, tents facing the water, wide establishing shot at แหลมหาดทราย Trang Thailand, warm sunset over the sea, photorealistic, highly detailed, 16:9
- `/seed/camps/trang-beachside-camp-1-205/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหลมหาดทรายตรัง  
  cozy dome camping tents pitched at a ริมทะเล/ชายหาด site, แหลมหาดทราย Thailand, warm sunset over the sea, lifestyle photo, shallow depth of field, 16:9

#### ทะเลสาบเขื่อนตรัง — Trang Lakeside Camp 2  
ธีม: ริมทะเลสาบ · จังหวัด: Trang · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/trang-lakeside-camp-2-206/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทะเลสาบเขื่อนตรัง  
  Minimal flat vector logo for a campsite "Trang Lakeside Camp 2" (ทะเลสาบเขื่อนตรัง), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/trang-lakeside-camp-2-206/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทะเลสาบเขื่อนตรัง  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ทะเลสาบเขื่อน Trang Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/trang-lakeside-camp-2-206/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทะเลสาบเขื่อนตรัง  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ทะเลสาบเขื่อน Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/trang-lakeside-camp-2-206/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทะเลสาบเขื่อนตรัง  
  signature hero view of Trang Lakeside Camp 2: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/trang-lakeside-camp-2-206/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ทะเลสาบเขื่อนตรัง  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in ทะเลสาบเขื่อน, warm evening glow, candid lifestyle photo, 16:9

#### ป่าเบญจพรรณชานเมืองตรัง — Trang Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Trang · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/trang-forest-camp-3-207/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองตรัง  
  Minimal flat vector logo for a campsite "Trang Forest Camp 3" (ป่าเบญจพรรณชานเมืองตรัง), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/trang-forest-camp-3-207/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองตรัง  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Trang Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/trang-forest-camp-3-207/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองตรัง  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/trang-forest-camp-3-207/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าเบญจพรรณชานเมืองตรัง  
  signature hero view of Trang Forest Camp 3: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/trang-forest-camp-3-207/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าเบญจพรรณชานเมืองตรัง  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าเบญจพรรณชานเมือง, warm evening glow, candid lifestyle photo, 16:9

#### ริมบึงธรรมชาติพัทลุง — Phatthalung Lakeside Camp 1  
ธีม: ริมทะเลสาบ · จังหวัด: Phatthalung · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/phatthalung-lakeside-camp-1-208/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมบึงธรรมชาติพัทลุง  
  Minimal flat vector logo for a campsite "Phatthalung Lakeside Camp 1" (ริมบึงธรรมชาติพัทลุง), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phatthalung-lakeside-camp-1-208/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมบึงธรรมชาติพัทลุง  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ริมบึงธรรมชาติ Phatthalung Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/phatthalung-lakeside-camp-1-208/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมบึงธรรมชาติพัทลุง  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ริมบึงธรรมชาติ Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9

#### แนวป่าเขตรักษาพันธุ์พัทลุง — Phatthalung Forest Camp 2  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Phatthalung · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 2**

- `/seed/camps/phatthalung-forest-camp-2-209/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แนวป่าเขตรักษาพันธุ์พัทลุง  
  Minimal flat vector logo for a campsite "Phatthalung Forest Camp 2" (แนวป่าเขตรักษาพันธุ์พัทลุง), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phatthalung-forest-camp-2-209/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แนวป่าเขตรักษาพันธุ์พัทลุง  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at แนวป่าเขตรักษาพันธุ์ Phatthalung Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/phatthalung-forest-camp-2-209/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แนวป่าเขตรักษาพันธุ์พัทลุง  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, แนวป่าเขตรักษาพันธุ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9

#### ป่าชุมชนใกล้เมืองพัทลุง — Phatthalung Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Phatthalung · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 3**

- `/seed/camps/phatthalung-forest-camp-3-210/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองพัทลุง  
  Minimal flat vector logo for a campsite "Phatthalung Forest Camp 3" (ป่าชุมชนใกล้เมืองพัทลุง), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/phatthalung-forest-camp-3-210/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองพัทลุง  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Phatthalung Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/phatthalung-forest-camp-3-210/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าชุมชนใกล้เมืองพัทลุง  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าชุมชนใกล้เมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/phatthalung-forest-camp-3-210/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าชุมชนใกล้เมืองพัทลุง  
  signature hero view of Phatthalung Forest Camp 3: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9

#### ป่าเบญจพรรณชานเมืองปัตตานี — Pattani Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Pattani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/pattani-forest-camp-1-211/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าเบญจพรรณชานเมืองปัตตานี  
  Minimal flat vector logo for a campsite "Pattani Forest Camp 1" (ป่าเบญจพรรณชานเมืองปัตตานี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pattani-forest-camp-1-211/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าเบญจพรรณชานเมืองปัตตานี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าเบญจพรรณชานเมือง Pattani Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/pattani-forest-camp-1-211/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าเบญจพรรณชานเมืองปัตตานี  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าเบญจพรรณชานเมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/pattani-forest-camp-1-211/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าเบญจพรรณชานเมืองปัตตานี  
  signature hero view of Pattani Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/pattani-forest-camp-1-211/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าเบญจพรรณชานเมืองปัตตานี  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าเบญจพรรณชานเมือง, warm evening glow, candid lifestyle photo, 16:9

#### ทะเลสาบเขื่อนปัตตานี — Pattani Lakeside Camp 2  
ธีม: ริมทะเลสาบ · จังหวัด: Pattani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 5**

- `/seed/camps/pattani-lakeside-camp-2-212/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ทะเลสาบเขื่อนปัตตานี  
  Minimal flat vector logo for a campsite "Pattani Lakeside Camp 2" (ทะเลสาบเขื่อนปัตตานี), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pattani-lakeside-camp-2-212/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ทะเลสาบเขื่อนปัตตานี  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ทะเลสาบเขื่อน Pattani Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/pattani-lakeside-camp-2-212/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ทะเลสาบเขื่อนปัตตานี  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ทะเลสาบเขื่อน Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/pattani-lakeside-camp-2-212/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ทะเลสาบเขื่อนปัตตานี  
  signature hero view of Pattani Lakeside Camp 2: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/pattani-lakeside-camp-2-212/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ทะเลสาบเขื่อนปัตตานี  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in ทะเลสาบเขื่อน, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/pattani-lakeside-camp-2-212/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ทะเลสาบเขื่อนปัตตานี  
  close detail of the ริมทะเลสาบ surroundings at ทะเลสาบเขื่อน Pattani (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9

#### ชายป่าอนุรักษ์ปัตตานี — Pattani Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Pattani · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/pattani-forest-camp-3-213/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์ปัตตานี  
  Minimal flat vector logo for a campsite "Pattani Forest Camp 3" (ชายป่าอนุรักษ์ปัตตานี), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/pattani-forest-camp-3-213/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์ปัตตานี  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Pattani Thailand, misty early morning, photorealistic, highly detailed, 16:9

#### ริมบึงธรรมชาติยะลา — Yala Lakeside Camp 1  
ธีม: ริมทะเลสาบ · จังหวัด: Yala · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 4**

- `/seed/camps/yala-lakeside-camp-1-214/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ริมบึงธรรมชาติยะลา  
  Minimal flat vector logo for a campsite "Yala Lakeside Camp 1" (ริมบึงธรรมชาติยะลา), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/yala-lakeside-camp-1-214/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ริมบึงธรรมชาติยะลา  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at ริมบึงธรรมชาติ Yala Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/yala-lakeside-camp-1-214/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ริมบึงธรรมชาติยะลา  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, ริมบึงธรรมชาติ Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/yala-lakeside-camp-1-214/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ริมบึงธรรมชาติยะลา  
  signature hero view of Yala Lakeside Camp 1: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/yala-lakeside-camp-1-214/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ริมบึงธรรมชาติยะลา  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in ริมบึงธรรมชาติ, warm evening glow, candid lifestyle photo, 16:9

#### แหล่งน้ำใหญ่กลางหุบเขายะลา — Yala Lakeside Camp 2  
ธีม: ริมทะเลสาบ · จังหวัด: Yala · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/yala-lakeside-camp-2-215/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหล่งน้ำใหญ่กลางหุบเขายะลา  
  Minimal flat vector logo for a campsite "Yala Lakeside Camp 2" (แหล่งน้ำใหญ่กลางหุบเขายะลา), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/yala-lakeside-camp-2-215/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหล่งน้ำใหญ่กลางหุบเขายะลา  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at แหล่งน้ำใหญ่กลางหุบเขา Yala Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
- `/seed/camps/yala-lakeside-camp-2-215/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ แหล่งน้ำใหญ่กลางหุบเขายะลา  
  cozy dome camping tents pitched at a ริมทะเลสาบ site, แหล่งน้ำใหญ่กลางหุบเขา Thailand, still dawn with mist on the water, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/yala-lakeside-camp-2-215/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น แหล่งน้ำใหญ่กลางหุบเขายะลา  
  signature hero view of Yala Lakeside Camp 2: lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, dramatic still dawn with mist on the water, no people, travel photography, 16:9
- `/seed/camps/yala-lakeside-camp-2-215/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ แหล่งน้ำใหญ่กลางหุบเขายะลา  
  Thai campers relaxing around a campfire and camp chairs at a ริมทะเลสาบ campsite in แหล่งน้ำใหญ่กลางหุบเขา, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/yala-lakeside-camp-2-215/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ แหล่งน้ำใหญ่กลางหุบเขายะลา  
  close detail of the ริมทะเลสาบ surroundings at แหล่งน้ำใหญ่กลางหุบเขา Yala (RIVE+FORE terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/yala-lakeside-camp-2-215/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง แหล่งน้ำใหญ่กลางหุบเขายะลา  
  aerial drone top-down view of the ริมทะเลสาบ campsite at แหล่งน้ำใหญ่กลางหุบเขา, tents arranged on the ground, surrounding RIVE and FORE landscape, still dawn with mist on the water, 16:9

#### ชายป่าอนุรักษ์ยะลา — Yala Forest Camp 3  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Yala · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/yala-forest-camp-3-216/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ชายป่าอนุรักษ์ยะลา  
  Minimal flat vector logo for a campsite "Yala Forest Camp 3" (ชายป่าอนุรักษ์ยะลา), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/yala-forest-camp-3-216/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ชายป่าอนุรักษ์ยะลา  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ชายป่าอนุรักษ์ Yala Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/yala-forest-camp-3-216/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ชายป่าอนุรักษ์ยะลา  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ชายป่าอนุรักษ์ Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/yala-forest-camp-3-216/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ชายป่าอนุรักษ์ยะลา  
  signature hero view of Yala Forest Camp 3: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/yala-forest-camp-3-216/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ชายป่าอนุรักษ์ยะลา  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ชายป่าอนุรักษ์, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/yala-forest-camp-3-216/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ชายป่าอนุรักษ์ยะลา  
  close detail of the ป่าลึก/ผจญภัย surroundings at ชายป่าอนุรักษ์ Yala (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/yala-forest-camp-3-216/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ชายป่าอนุรักษ์ยะลา  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ชายป่าอนุรักษ์, tents arranged on the ground, surrounding FORE and MTNS landscape, misty early morning, 16:9

#### ป่าชุมชนใกล้เมืองนราธิวาส — Narathiwat Forest Camp 1  
ธีม: ป่าลึก/ผจญภัย · จังหวัด: Narathiwat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 6**

- `/seed/camps/narathiwat-forest-camp-1-217/cover.jpg` (1:1, logo) — _alt:_ โลโก้ ป่าชุมชนใกล้เมืองนราธิวาส  
  Minimal flat vector logo for a campsite "Narathiwat Forest Camp 1" (ป่าชุมชนใกล้เมืองนราธิวาส), ป่าลึก/ผจญภัย motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/narathiwat-forest-camp-1-217/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง ป่าชุมชนใกล้เมืองนราธิวาส  
  deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, wide establishing shot at ป่าชุมชนใกล้เมือง Narathiwat Thailand, misty early morning, photorealistic, highly detailed, 16:9
- `/seed/camps/narathiwat-forest-camp-1-217/02.jpg` (16:9, gallery/tent) — _alt:_ เต็นท์ที่ ป่าชุมชนใกล้เมืองนราธิวาส  
  cozy dome camping tents pitched at a ป่าลึก/ผจญภัย site, ป่าชุมชนใกล้เมือง Thailand, misty early morning, lifestyle photo, shallow depth of field, 16:9
- `/seed/camps/narathiwat-forest-camp-1-217/03.jpg` (16:9, gallery/signature) — _alt:_ วิวเด่น ป่าชุมชนใกล้เมืองนราธิวาส  
  signature hero view of Narathiwat Forest Camp 1: deep jungle clearing campsite, towering rainforest canopy, morning mist between trees, dramatic misty early morning, no people, travel photography, 16:9
- `/seed/camps/narathiwat-forest-camp-1-217/04.jpg` (16:9, gallery/life) — _alt:_ บรรยากาศ ป่าชุมชนใกล้เมืองนราธิวาส  
  Thai campers relaxing around a campfire and camp chairs at a ป่าลึก/ผจญภัย campsite in ป่าชุมชนใกล้เมือง, warm evening glow, candid lifestyle photo, 16:9
- `/seed/camps/narathiwat-forest-camp-1-217/05.jpg` (16:9, gallery/detail) — _alt:_ รายละเอียดธรรมชาติ ป่าชุมชนใกล้เมืองนราธิวาส  
  close detail of the ป่าลึก/ผจญภัย surroundings at ป่าชุมชนใกล้เมือง Narathiwat (FORE+MTNS terrain), natural textures and foliage, soft light, 16:9
- `/seed/camps/narathiwat-forest-camp-1-217/06.jpg` (16:9, gallery/aerial) — _alt:_ มุมสูง ป่าชุมชนใกล้เมืองนราธิวาส  
  aerial drone top-down view of the ป่าลึก/ผจญภัย campsite at ป่าชุมชนใกล้เมือง, tents arranged on the ground, surrounding FORE and MTNS landscape, misty early morning, 16:9

#### แหล่งน้ำใหญ่กลางหุบเขานราธิวาส — Narathiwat Lakeside Camp 2  
ธีม: ริมทะเลสาบ · จังหวัด: Narathiwat · รูปที่ต้อง gen: **โลโก้ 1 + แกลเลอรี 1**

- `/seed/camps/narathiwat-lakeside-camp-2-218/cover.jpg` (1:1, logo) — _alt:_ โลโก้ แหล่งน้ำใหญ่กลางหุบเขานราธิวาส  
  Minimal flat vector logo for a campsite "Narathiwat Lakeside Camp 2" (แหล่งน้ำใหญ่กลางหุบเขานราธิวาส), ริมทะเลสาบ motif with a tent silhouette, 2-3 tone earthy palette, simple emblem badge, white background, no photorealism
- `/seed/camps/narathiwat-lakeside-camp-2-218/01.jpg` (16:9, gallery/wide) — _alt:_ ภาพมุมกว้าง แหล่งน้ำใหญ่กลางหุบเขานราธิวาส  
  lakeside campsite, calm mirror-like water reflecting limestone karst hills, floating raft houses, wide establishing shot at แหล่งน้ำใหญ่กลางหุบเขา Narathiwat Thailand, still dawn with mist on the water, photorealistic, highly detailed, 16:9
