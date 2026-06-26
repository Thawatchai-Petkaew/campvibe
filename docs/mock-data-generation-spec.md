# Mock Data Generation Spec — สำหรับ Gemini (staging seed)

> **วัตถุประสงค์:** ให้ Gemini generate **ข้อมูล mock + รูปภาพ** สำหรับเอาไปลงใน **Staging** (`campvibe-staging.vercel.app`)
> ครอบคลุม **โฮสต์ (เจ้าของลาน) ทั้ง 3 ประเภท** + **ลานกางเต็นท์ (ร้าน)** + จุดกางเต็นท์ (spot) + รูปภาพ
> โดย output ต้อง **ตรงกับ Prisma schema จริง** เพื่อให้โหลดเข้า DB ได้โดยไม่ error
>
> เอกสารนี้คือ **สัญญา (contract)** — ทำตามทุกข้อใน §2 (Hard Rules) เป๊ะ ไม่งั้นข้อมูลจะโหลดไม่ผ่าน
>
> SoT: `prisma/schema.prisma` · loader pattern อ้างอิง `prisma/seed.ts` (intermediate CSV format)

---

## 1. ขอบเขต (Scope) — เอาอะไร / ไม่เอาอะไร

generate **เฉพาะข้อมูลที่โฮสต์เป็นเจ้าของ/กรอกเอง** (catalog/listing ของลาน) เท่านั้น

### ✅ เอา (in scope)

- **Host** (เจ้าของลาน) — ข้อมูลธุรกิจ/ติดต่อที่โฮสต์ให้ (3 ประเภท: บุคคลธรรมดา / บริษัท / ห้างหุ้นส่วน)
- **CampSite** (ลานกางเต็นท์) — ข้อมูล listing ที่โฮสต์กรอก (ชื่อ คำบรรยาย ราคา สิ่งอำนวยฯ ที่ตั้ง ฯลฯ)
- **Spot** (จุดกางเต็นท์ในลาน) — ข้อมูลจุดที่โฮสต์ตั้ง
- **รูปภาพ** — gallery / logo ของลาน, avatar ของโฮสต์

### ❌ ไม่เอา (out of scope)

- **ค่าที่ระบบคำนวณ (computed / aggregate)** — เช่น **Rating เฉลี่ย**, จำนวนรีวิว, สถานะห้องว่าง (availability), response rate ของโฮสต์
  → ค่าพวกนี้ระบบ **คำนวณสด (compute-on-the-fly)** จากข้อมูลต้นทางตอน runtime ไม่ใช่ค่าที่ seed (ไม่มี field เก็บใน schema ด้วยซ้ำ)
- **ข้อมูล user-generated** — **รีวิว** + ผู้ใช้ที่เป็นนักแคมป์ (camper) → ตัดออก (เป็นต้นทางของ Rating)
- **ข้อมูล transaction / third party** — Booking, Payment, Payout, KYC ที่ตรวจผ่านผู้ให้บริการภายนอก → ไม่ seed
- **Location** ไม่ต้อง generate เป็น entity แยก — loader สร้างให้จาก `province` + lat/lon ที่ให้มา

> สรุป: ขอแค่ "ข้อมูลที่ถ้าเปิดหน้าจัดการลานแล้วโฮสต์เป็นคนพิมพ์/อัปโหลดเอง" — อะไรที่ระบบหรือผู้ใช้คนอื่นสร้างให้ทีหลัง ไม่ต้องทำ

---

## 2. Hard Rules — ห้ามฝ่าฝืน (ไม่งั้น load fail)

1. **ใช้ค่า enum / code ตาม "ตารางอ้างอิง" (§4, §5) เท่านั้น** — ห้ามคิด code ใหม่เอง
   (เช่น `GLAMP`, `CABI`, `KITC`, `FIRE`, `WATR` **ใช้ไม่ได้** — ไม่มีใน MasterData จริง → option จะหลุด)
2. **`nameThSlug` และ `nameEnSlug` ต้อง unique ทั้งไฟล์** (เป็น `@unique` ใน DB) — แนะนำต่อท้ายด้วยเลขรัน เช่น `-1`, `-2`
3. **`email` ของทุก host ต้อง unique** (เป็น `@unique`)
4. **field ที่ required (ไม่มี `?`) ต้องมีค่าเสมอ** — ดู "🔴 required" ในตารางแต่ละ entity
5. **`password` ให้ส่งเป็น plaintext** (เช่น `"password123"`) — loader จะ `bcrypt.hash` ให้เอง ห้าม hash มาเอง
6. **Decimal/ตัวเลขเงิน** ส่งเป็น number ปกติ (เช่น `350`, `1200.50`) — ห้ามมีสัญลักษณ์ `฿` หรือ comma
7. **lat/lon ต้องอยู่ในขอบเขตประเทศไทย** — lat `5.6`–`20.5`, lon `97.3`–`105.7` (decimal degrees) และตรงกับจังหวัดที่ระบุ
8. **เวลา** (`checkInTime`/`checkOutTime`) เป็น string รูปแบบ `"HH:mm"` 24 ชม. เช่น `"14:00"`
9. **multi-value (taxonomies)** ส่งเป็น **CSV string** code คั่นด้วย comma ไม่มีเว้นวรรค เช่น `"TOIL,SHOW,WIFI"` (loader แปลงเป็น relation ให้)
10. **รูปภาพ:** field `images` = CSV ของ URL/path คั่น comma · `logo` / `image` = URL/path เดี่ยว (ดู §9)
11. **copy ภาษาไทย** ใช้ภาษาไทยจริง เป็นธรรมชาติ ไม่มีศัพท์เทคนิค (API/endpoint) ไม่ใช้ em-dash (—) เป็นตัวคั่น
12. **ห้ามใส่ค่าที่ระบบคำนวณ** (rating, จำนวนรีวิว ฯลฯ ตาม §1) — ถ้าไม่มีใน field table ของ entity แปลว่าไม่ต้องทำ

---

## 3. ภาพรวมความสัมพันธ์ (ER)

```
Host (User, role=OPERATOR)  1 ──< CampSite ──< Spot
                                    │
                                    ├──< Image (gallery + logo)
                                    └── Location (1:1 ต่อ camp, loader สร้างให้จาก province+lat/lon)
```

- **โฮสต์ 1 คน เป็นเจ้าของได้หลายลาน** (`CampSite.operatorId → User.id`)
- **Location** ไม่ต้อง generate เอง: loader สร้างจาก `province` + `latitude/longitude` ที่ให้มา (จับคู่ `ThailandLocation` อัตโนมัติ)
- ไม่มี Review/Rating/Booking ในชุดนี้ (ดู §1 out of scope)

---

## 4. ตารางอ้างอิง ENUM (ค่าที่เกิดขึ้นได้ทั้งหมด)

ใช้ได้เฉพาะค่าในตารางนี้ (ค่าเป็นตัวพิมพ์ใหญ่ตรงตาม schema):

| Enum | ค่าที่ใช้ได้ | ความหมาย / ใช้ตอนไหน |
|---|---|---|
| **UserRole** | `OPERATOR` | โฮสต์ทุกคน = `OPERATOR` |
| **BusinessType** | `INDIVIDUAL` · `COMPANY` · `PARTNERSHIP` | บุคคลธรรมดา · บริษัทจำกัด · ห้างหุ้นส่วน (ดู §6 archetype) |
| **OwnershipType** | `PRIVATE` · `NATIONAL_PARK` | ลานเอกชน · ลานในอุทยานแห่งชาติ (mock ส่วนใหญ่ = `PRIVATE`) |
| **BookingMethod** | `ONLI` · `ONCA` · `ONST` | จองออนไลน์ · โทรจอง · จองหน้างาน |
| **ViewType** (Spot) | `GENERAL` · `RIVER` · `MOUNTAIN` · `LAKE` · `FOREST` · `BEACH` | วิวของจุดกางเต็นท์ |

> enum อื่น (`KycStatus`, `BookingStatus`, `PaymentStatus`, `PayoutStatus`, `TeamRole`, `Permission`, `NotificationType`, `AdminLevel`) เกี่ยวกับ workflow/ระบบ/transaction — **ไม่ต้อง generate** สำหรับชุด listing นี้

---

## 5. ตารางอ้างอิง MasterData code (vocabulary สำหรับ taxonomies)

ใช้ได้ **เฉพาะ code เหล่านี้** ในฟิลด์ taxonomies ของ CampSite (§7) เท่านั้น:

### 5.1 `campSiteType` (เลือก 1 code)
| code | ไทย | อังกฤษ |
|---|---|---|
| `CAGD` | ลานกางกับพื้น | Campground |
| `CACP` | รถเต็นท์ / car camp | Car camp |

### 5.2 `accommodationTypes` (เลือก 1 code — single string)
ใช้ code จากกลุ่ม Equipment ที่เป็นที่พักได้ โดยทั่วไป = `TENT` (เต็นท์)

### 5.3 `accessTypes` (CSV — วิธีเข้าถึง)
| code | ไทย | | code | ไทย |
|---|---|---|---|---|
| `DRIV` | ขับรถ | | `HIKE` | ไต่เขา |
| `WALK` | เดิน | | `BAOT` | เรือ |

### 5.4 `facilities` (CSV — สิ่งอำนวยความสะดวกภายใน · group "Internal facility")
| code | ไทย | code | ไทย | code | ไทย |
|---|---|---|---|---|---|
| `SHOW` | ห้องอาบน้ำ | `TOIL` | ห้องน้ำ | `PICN` | โต๊ะปิคนิค |
| `WIFI` | ไวไฟ | `TRAS` | ถังขยะ | `SANI` | จุดทิ้งสิ่งปฏิกูล |
| `POTA` | ก๊อกน้ำ | `ELEC` | จุดจ่ายไฟฟ้า | `WATE` | จุดจ่ายน้ำ |
| `SINK` | อ่างล้างจาน | `CART` | รถเข็น | `MIMT` | ร้านขายของชำ |
| `GRIL` | หมูกระทะ | `CAFE` | คาเฟ่ | `REST` | ร้านอาหาร |
| `FEIC` | น้ำแข็งฟรี | `FEDW` | น้ำดื่มฟรี | | |

### 5.5 `externalFacilities` (CSV — สิ่งอำนวยความสะดวกภายนอก)
| code | ไทย | code | ไทย |
|---|---|---|---|
| `SVEL` | เซเว่น | `LOTS` | โลตัส |
| `MAKT` | ตลาดนัด | `MIBC` | บิ๊กซี |

### 5.6 `equipment` (CSV — อุปกรณ์ให้เช่า · group "Equipment for rent")
| code | ไทย | code | ไทย | code | ไทย |
|---|---|---|---|---|---|
| `TENT` | เต็นท์ | `POWE` | ปลั๊กสนาม | `TFAN` | พัดลม |
| `BLKT` | ผ้าห่ม | `LEDL` | หลอดไฟ LED | `GDST` | ผ้าปูรองเต็นท์ |
| `SSTV` | เตาถ่านเล็ก | `LSTV` | เตาถ่านใหญ่ | `CHAI` | เก้าอี้ |
| `FYST` | ผ้าฟลายชีท | `ICBK` | กระติกน้ำแข็ง | | |

### 5.7 `activities` (CSV — กิจกรรม)
| code | ไทย | code | ไทย | code | ไทย |
|---|---|---|---|---|---|
| `SWIM` | ว่ายน้ำ | `HIKI` | เดินเล่น | `SURF` | เล่นเซิร์ฟ |
| `FISH` | ตกปลา | `WILD` | ส่องสัตว์ป่า | `BOAT` | พายเรือ |
| `HORS` | ขี่ม้า | `OFFR` | ออฟโรด | `LIVE` | ดนตรีสด |
| `CLIM` | ปีนเขา | | | | |

### 5.8 `terrain` (CSV — ภูมิประเทศ)
| code | ไทย | code | ไทย |
|---|---|---|---|
| `BEAC` | ชายหาด | `FORE` | ป่า |
| `RIVE` | แม่น้ำ ลำธาร | `MTNS` | ภูเขา |

### 5.9 `nearFacilities` (Spot, CSV) — ใช้ code จาก §5.4 (Internal facility) ที่อยู่ใกล้จุดนั้น

### 5.10 `groundType` (CampSite, JSON string) — key พื้นที่ : จำนวน pitch
ใช้ key ได้เฉพาะ: `GRASS` (หญ้า) · `STONE` (หิน) · `CONCRETE` (ปูน) · `WOOD` (ไม้)
ตัวอย่าง: `"{\"GRASS\":10,\"STONE\":5,\"CONCRETE\":3}"`

---

## 6. Entity 1 — Host (เจ้าของลาน) | model `User`, role `OPERATOR`

### 6.1 ฟิลด์ที่ต้อง generate (เฉพาะข้อมูลที่โฮสต์กรอกเอง)

| field | type | req | หมายเหตุ / รูปแบบ | class |
|---|---|---|---|---|
| `email` | string | 🔴 | unique, lowercase เช่น `siri.camp@example.com` | [PII] |
| `password` | string | 🔴 | plaintext เช่น `"password123"` (loader hash ให้) | [PII] |
| `name` | string | 🔴 | ชื่อ-สกุลไทย หรือชื่อผู้ติดต่อ เช่น `สิริ ทองคำ` | [PII] |
| `phone` | string | ✓ | `^0[689]\d{8}$` เช่น `0812345678` (เลขล้วน) | [PII] |
| `image` | string | ✓ | URL/path รูป avatar/โลโก้กิจการ (ดู §9) | |
| `role` | enum | 🔴 | `OPERATOR` เสมอ | |
| `isHostRegistered` | bool | 🔴 | `true` | |
| `hostRegisteredAt` | datetime | ✓ | ISO เช่น `"2025-09-12T08:30:00Z"` | |
| `businessName` | string | ✓ | ดู archetype §6.2 | |
| `businessType` | enum | ✓ | `INDIVIDUAL`/`COMPANY`/`PARTNERSHIP` | |
| `taxId` | string | ✓ | 13 หลัก ปลอมแต่รูปแบบถูก เช่น `1234567890123` (ห้ามใช้เลขจริง) | [PII] |
| `businessAddress` | string | ✓ | ที่อยู่จดทะเบียน (ไทย) | [PII] |

> **ไม่ต้องทำ:** ฟิลด์ KYC (`kycStatus`, `kycSubmittedAt`, `kycDocuments` ฯลฯ) — เป็นสถานะตรวจสอบของระบบ/ผู้ให้บริการภายนอก ไม่ใช่ข้อมูลที่โฮสต์กรอกเป็น listing (out of scope §1)

### 6.2 Archetypes — สร้างให้ครบทั้ง 3 ประเภท

| ประเภท (โจทย์) | `businessType` | `businessName` | `taxId` | สเกล/ลักษณะ |
|---|---|---|---|---|
| **ลานบุคคลธรรมดา** | `INDIVIDUAL` | ว่าง หรือชื่อแบรนด์ส่วนตัว เช่น `ไร่ลุงนวล แคมป์` | 13 หลัก (เลขบัตร ปชช.ปลอม) | เจ้าของคนเดียว ลาน 1–2 แห่ง ราคาย่อมเยา สิ่งอำนวยฯ เรียบง่าย |
| **นิติบุคคล – บริษัท** | `COMPANY` | `บริษัท แคมป์วิบส์ จำกัด` | 13 หลัก (เลขนิติบุคคลปลอม) | มืออาชีพ ลาน 3–5 แห่ง สิ่งอำนวยฯ ครบ ราคาสูงกว่า |
| **นิติบุคคล – ห้างหุ้นส่วน** | `PARTNERSHIP` | `ห้างหุ้นส่วนจำกัด ภูเขาเขียว` | 13 หลัก (ปลอม) | กลาง ลาน 2–3 แห่ง |

---

## 7. Entity 2 — CampSite (ลานกางเต็นท์ / "ร้าน")

ใช้รูปแบบ **intermediate (CSV)** เหมือน `prisma/seed.ts` — loader แปลง taxonomies + images ให้เป็น relation อัตโนมัติ

| field | type | req | หมายเหตุ / รูปแบบ |
|---|---|---|---|
| `nameTh` | string | 🔴 | ชื่อไทย เช่น `ลานกางเต็นท์ภูทับเบิก` |
| `nameEn` | string | ✓ | ชื่ออังกฤษ |
| `nameThSlug` | string | 🔴 | unique, kebab เช่น `phu-thap-boek-1` |
| `nameEnSlug` | string | 🔴 | unique, kebab เช่น `phu-thap-boek-en-1` |
| `description` | string | ✓ | คำบรรยายไทย 1–3 ประโยค |
| `campSiteType` | code | 🔴 | §5.1 (`CAGD`/`CACP`) |
| `accommodationTypes` | code | 🔴 | §5.2 (เช่น `TENT`) |
| `accessTypes` | CSV | ✓ | §5.3 |
| `facilities` | CSV | ✓ | §5.4 |
| `externalFacilities` | CSV | ✓ | §5.5 |
| `equipment` | CSV | ✓ | §5.6 |
| `activities` | CSV | ✓ | §5.7 |
| `terrain` | CSV | ✓ | §5.8 |
| `province` | string | 🔴* | ชื่อจังหวัดอังกฤษ เช่น `Phetchabun` (loader ใช้จับคู่ Location) |
| `address` | string | ✓ | ที่อยู่ |
| `directions` | string | ✓ | วิธีเดินทาง (ไทยหรืออังกฤษ) |
| `latitude` | float | 🔴 | §2 ข้อ 7 (ตรงกับจังหวัด) |
| `longitude` | float | 🔴 | เช่นเดียวกัน |
| `checkInTime` | string | 🔴 | `"14:00"` |
| `checkOutTime` | string | 🔴 | `"11:00"` |
| `bookingMethod` | enum | 🔴 | §4 (`ONLI`/`ONCA`/`ONST`) |
| `priceLow` | number | ✓ | บาท/คืน ต่ำสุด เช่น `300` |
| `priceHigh` | number | ✓ | บาท/คืน สูงสุด เช่น `1200` |
| `priceCurrency` | string | ✓ | `"THB"` |
| `ownershipType` | enum | ✓ | §4 (ส่วนใหญ่ `PRIVATE`, ใส่ `NATIONAL_PARK` บ้าง) |
| `isFree` | bool | ✓ | `true` สำหรับลานฟรี (1–2 แห่ง) |
| `petFriendly` | bool | ✓ | `true`/`false` |
| `minimumAge` | int | ✓ | เช่น `0`, `7`, `12` |
| `maxGuestsPerDay` | int | ✓ | เช่น `40` |
| `maxTentsPerDay` | int | ✓ | เช่น `20` |
| `groundType` | JSON string | ✓ | §5.10 |
| `feeInfo` | string | ✓ | ไทย เช่น `ค่าเข้า 20 บาท ค่าพื้นที่กางเต็นท์ 100 บาทต่อคน` |
| `toiletInfo` | string | ✓ | ไทย |
| `phone` | string | ✓ | `^0[689]\d{8}$` (เบอร์ลาน) [PII] |
| `lineId` | string | ✓ | เช่น `@phuthapboek` |
| `facebookUrl` | string | ✓ | URL (ลิงก์เพจของลานเอง) |
| `tiktokUrl` | string | ✓ | URL (บางลาน) |
| `videoUrl` | string | ✓ | URL YouTube ของลาน (บางลาน) |
| `tags` | CSV | ✓ | คำค้นไทย เช่น `ทะเลหมอก,วิวภูเขา,อากาศเย็น` |
| `isActive` | bool | ✓ | `true` |
| `isPublished` | bool | ✓ | `true` (เพื่อให้แสดงบนเว็บ) |
| `images` | CSV(URL) | ✓ | รูป gallery คั่น comma (ดู §9) |
| `logo` | string(URL) | ✓ | โลโก้เดี่ยว (ดู §9) |

\* `province` ไม่ใช่คอลัมน์ตรงใน `CampSite` แต่ loader ใช้เพื่อสร้าง/จับคู่ `Location` — **จำเป็นต้องมี** เพื่อให้ location ถูก

> **ไม่ต้องทำ:** `isVerified` / `verifiedDate` (สถานะตรวจของแพลตฟอร์ม, ระบบ/แอดมินเป็นคนตั้ง) · rating / จำนวนรีวิว / สถานะห้องว่าง (ระบบคำนวณสด) — ทั้งหมดอยู่นอก scope §1
>
> **ความสมจริง:** ลานของ **บริษัท (COMPANY)** ควรมีสิ่งอำนวยฯ ครบกว่า (WIFI/REST/CAFE/ELEC) + ราคาสูงกว่า · ลาน **บุคคลธรรมดา** เรียบง่ายกว่า (TOIL/POTA) ราคาถูกกว่า · ลาน **ฟรี/อุทยาน** อาจไม่มี equipment ให้เช่า

---

## 8. Entity 3 — Spot (จุดกางเต็นท์ในลาน)

ลาน 1 แห่งมี **2–6 spot** (ลานใหญ่/บริษัทมีมากกว่า)

| field | type | req | หมายเหตุ |
|---|---|---|---|
| `zone` | string | ✓ | เช่น `โซน A`, `ริมน้ำ` |
| `name` | string | 🔴 | เช่น `จุด A1` |
| `viewType` | enum | ✓ | §4 ViewType |
| `maxCampers` | int | ✓ | เช่น `4` |
| `maxTents` | int | ✓ | เช่น `2` |
| `environment` | string | ✓ | ไทยสั้น ๆ เช่น `ใต้ร่มไม้ ริมธาร` |
| `pricePerNight` | number | 🔴 | บาท/คืน เช่น `350` |
| `pricePerSite` | number | ✓ | ราคาเหมาทั้งจุด (ถ้ามี) |
| `priceCurrency` | string | ✓ | `"THB"` |
| `nearFacilities` | CSV | ✓ | §5.9 |

---

## 9. Image Generation Guide (รูปที่ให้ Gemini สร้าง)

| ใช้กับ | ฟิลด์ | จำนวน/หน่วย | สัดส่วน | เนื้อหา |
|---|---|---|---|---|
| CampSite gallery | `images` (CSV) | 3–6 รูป/ลาน | 16:9 (เช่น 1200×675) | บรรยากาศลาน เต็นท์ วิว ภูมิประเทศตาม `terrain` |
| CampSite logo | `logo` (เดี่ยว) | 1 รูป/ลาน | 1:1 (512×512) | โลโก้/ตราลาน เรียบ |
| Host avatar | `User.image` (เดี่ยว) | 1 รูป/โฮสต์ | 1:1 (256×256) | รูปโปรไฟล์/โลโก้กิจการ |
| Spot (optional) | `Spot.images` | 0–2 รูป/จุด | 16:9 | จุดกางเต็นท์เฉพาะจุด |

> **Prompt guidance สำหรับการ generate:** อย่าใช้คำขึ้นต้นหรือโครงประโยคเดียวกันซ้ำทุกลาน ให้เขียน prompt แบบ terrain-first และ mood-first
>
> - `MTNS / mist` ลานภูเขาและทะเลหมอก: สลับ dawn, blue hour, overcast, sunrise และเปลี่ยน composition ระหว่าง wide, medium tent, detail, aerial
> - `FORE` ลานป่า: ใช้ canopy, wet trail, filtered light, moss, mist between trees, deep shade
> - `RIVE / stream` ลานริมน้ำ: ใช้ rock textures, shallow water, reflections, bank vegetation, soft morning light
> - `BEAC` ลานทะเล: ใช้ shoreline, wet sand, waterline, sunset, calm sea, breeze
> - `LAKE` ลานทะเลสาบ: ใช้ still water, mirror reflections, mist on water, quiet dawn
> - `MTNS + open field` ทุ่งหญ้า/ชมดาว: ใช้ open meadow, horizon, stars, wind, long-exposure mood
>
> **ข้อห้าม:** หลีกเลี่ยง edge fade, vignette, dark corners และเลี่ยงการใช้คำซ้ำแบบ “misty mountain ridge campsite at dawn” กับ “cozy dome camping tents” ทุกภาพ
>
> **โลโก้:** อย่าใช้โลโก้เป็นวงกลมกับเต็นท์แบบเดิมทุกลาน ให้ terrain หรือ keyword หลักเป็นตัวกำหนด silhouette และ icon แทน เช่น ridge, forest, wave, horizon, lake, sun, leaf, cliff, terrace

**Naming convention** (ให้ path ใน JSON ตรงกับไฟล์ที่ generate):
```
/seed/camps/<nameThSlug>/cover.jpg          ← logo
/seed/camps/<nameThSlug>/01.jpg ... 06.jpg  ← gallery (ตามลำดับ sortOrder)
/seed/hosts/<host-key>/avatar.jpg           ← host avatar
```
- ค่าในฟิลด์ `images`/`logo`/`image` = **path เหล่านี้** (relative) — ตอนนำลง staging ค่อยอัปโหลดไป `/public/seed/...` หรือ blob storage แล้วใช้ path เดิม
- ถ้าจะใช้ภาพจริงชั่วคราว: ใช้ URL Unsplash ได้ (เหมือน seed เดิม) แต่ path-convention ข้างบนคุมง่ายกว่าเวลาโหลดเข้าจริง
- ทุกรูปแนะนำใส่ `alt` ไทยสั้น ๆ บรรยายภาพ (เก็บคู่กับ path ใน manifest §10)

---

## 10. Output Format (โครงสร้างไฟล์ที่ขอให้ Gemini ส่งกลับ)

ขอเป็น **ไฟล์ JSON เดียว** โครงสร้าง nested ตามความเป็นเจ้าของ (โหลดง่าย map ตรง):

```json
{
  "meta": { "generatedFor": "campvibe-staging", "version": 1 },
  "hosts": [
    {
      "key": "h-company-01",
      "email": "contact@campvibes.co.th",
      "password": "password123",
      "name": "ธนา ภูผา",
      "phone": "0891112222",
      "image": "/seed/hosts/h-company-01/avatar.jpg",
      "role": "OPERATOR",
      "isHostRegistered": true,
      "hostRegisteredAt": "2025-08-01T03:00:00Z",
      "businessType": "COMPANY",
      "businessName": "บริษัท แคมป์วิบส์ จำกัด",
      "taxId": "0105500000001",
      "businessAddress": "99/9 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110",
      "campsites": [
        {
          "nameTh": "ลานกางเต็นท์เขาค้อวิวหมอก",
          "nameEn": "Khao Kho Mist View Camp",
          "nameThSlug": "khao-kho-mist-view-1",
          "nameEnSlug": "khao-kho-mist-view-en-1",
          "description": "ลานกางเต็นท์บนเขาค้อ วิวทะเลหมอกยามเช้า อากาศเย็นตลอดปี",
          "campSiteType": "CACP",
          "accommodationTypes": "TENT",
          "accessTypes": "DRIV",
          "facilities": "TOIL,SHOW,WIFI,CAFE,ELEC",
          "externalFacilities": "SVEL,MAKT",
          "equipment": "TENT,BLKT,TFAN,POWE",
          "activities": "HIKI,WILD",
          "terrain": "MTNS",
          "province": "Phetchabun",
          "address": "ทุ่งสมอ เขาค้อ เพชรบูรณ์ 67270",
          "directions": "เส้นทางหลวง 12 ใกล้กังหันลม",
          "latitude": 16.6333,
          "longitude": 101.0667,
          "checkInTime": "14:00",
          "checkOutTime": "11:00",
          "bookingMethod": "ONLI",
          "priceLow": 500,
          "priceHigh": 1500,
          "priceCurrency": "THB",
          "ownershipType": "PRIVATE",
          "isFree": false,
          "petFriendly": true,
          "minimumAge": 0,
          "maxGuestsPerDay": 60,
          "maxTentsPerDay": 30,
          "groundType": "{\"GRASS\":20,\"CONCRETE\":10}",
          "feeInfo": "ค่าพื้นที่กางเต็นท์ 500 บาทต่อหลัง เช่าเต็นท์ 1500 บาท",
          "toiletInfo": "ห้องน้ำส่วนตัวโซน VIP ห้องน้ำรวมโซนทั่วไป",
          "phone": "0891112222",
          "lineId": "@khaokho",
          "facebookUrl": "https://facebook.com/khaokhocamp",
          "tags": "ทะเลหมอก,วิวภูเขา,อากาศเย็น",
          "isActive": true,
          "isPublished": true,
          "logo": "/seed/camps/khao-kho-mist-view-1/cover.jpg",
          "images": "/seed/camps/khao-kho-mist-view-1/01.jpg,/seed/camps/khao-kho-mist-view-1/02.jpg,/seed/camps/khao-kho-mist-view-1/03.jpg",
          "spots": [
            {
              "zone": "โซน VIP", "name": "จุด V1", "viewType": "MOUNTAIN",
              "maxCampers": 4, "maxTents": 2, "environment": "ริมหน้าผา วิวหมอก",
              "pricePerNight": 800, "priceCurrency": "THB", "nearFacilities": "TOIL,SHOW"
            }
          ]
        }
      ]
    }
  ]
}
```

แยกไฟล์รูปเป็นชุดต่างหากตาม path ใน §9 + (ถ้าทำได้) แนบ **image manifest** `{ path, alt }` มาด้วย

---

## 11. ปริมาณที่แนะนำ (ปรับได้ตามต้องการ)

| สิ่งที่สร้าง | จำนวนแนะนำ | การกระจาย |
|---|---|---|
| Hosts (OPERATOR) | **8** | INDIVIDUAL ×3 · COMPANY ×3 · PARTNERSHIP ×2 |
| CampSites | **20–25** | INDIVIDUAL 1–2/คน · PARTNERSHIP 2–3/คน · COMPANY 3–5/คน |
| ownershipType | — | PRIVATE ~80% · NATIONAL_PARK ~20% |
| isFree | — | 1–2 ลาน |
| Spots | 2–6 / ลาน | ลานบริษัทมากกว่า |
| รูปต่อลาน | 3–6 gallery + 1 logo | ตาม §9 |

ครอบคลุมจังหวัดยอดนิยม: Phetchabun, Chiang Mai, Chiang Rai, Mae Hong Son, Krabi, Loei, Nakhon Ratchasima, Kanchanaburi, Surat Thani, Trat, Nan, Prachuap Khiri Khan

---

## 12. Checklist ก่อนส่งกลับ (ให้ Gemini self-verify)

- [ ] enum / code ทุกตัวอยู่ใน §4, §5 (ไม่มี code ที่คิดเอง)
- [ ] `nameThSlug`, `nameEnSlug`, `email` ทุกค่า unique
- [ ] field 🔴 required ครบทุก record
- [ ] lat/lon อยู่ในไทย และตรงกับ `province`
- [ ] host ครบ 3 ประเภท (INDIVIDUAL/COMPANY/PARTNERSHIP)
- [ ] taxId 13 หลัก ปลอม (ไม่ใช่เลขจริง)
- [ ] taxonomies เป็น CSV code ไม่มีเว้นวรรค · `groundType` เป็น JSON string ที่ parse ได้
- [ ] ราคา/ตัวเลขเป็น number ล้วน ไม่มี ฿ หรือ comma
- [ ] **ไม่มี** ฟิลด์ rating / จำนวนรีวิว / review / booking / KYC / isVerified (out of scope §1)
- [ ] copy ไทยเป็นธรรมชาติ ไม่มีศัพท์เทคนิค ไม่มี em-dash เป็นตัวคั่น
- [ ] path รูปใน JSON ตรงกับไฟล์รูปที่ generate (§9 naming)

---

## 13. หมายเหตุการนำเข้า (สำหรับทีมตอนโหลดจริง — ไม่ใช่ของ Gemini)

- โหลดผ่าน path ที่มี **seed guard** (`assertSeedAllowed`) — staging/admin เท่านั้น ไม่เปิดบน prod
- loader transform เหมือน `prisma/seed.ts`: CSV taxonomies → `options: { connect: [{code}] }` · `images` CSV → `Image[]` (sortOrder ตามลำดับ) · สร้าง `Location` จาก `province`+lat/lon แล้ว set `operatorId` = host
- `password` → `bcrypt.hash(…, 10)` · host `key` → resolve เป็น id ตอน create
- ต้อง seed `MasterData` + `ThailandLocation` ก่อน (มีใน `prisma/seed.ts` แล้ว) เพื่อให้ option/location จับคู่ได้
- rating / จำนวนรีวิว / ความว่าง = ระบบคำนวณสดจากข้อมูลต้นทางตอน runtime ไม่ได้มาจาก seed ชุดนี้
