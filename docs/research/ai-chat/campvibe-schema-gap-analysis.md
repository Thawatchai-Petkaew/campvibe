# CampVibe — Schema Gap Analysis: โครงสร้างข้อมูลจริง vs คำถามที่ AI ต้องตอบได้

> วิเคราะห์จาก `prisma/schema.prisma` (856 บรรทัด, branch staging), MasterData seed (7 กลุ่ม 52 codes), `lib/campsite-availability.ts`, `lib/campsite-filters.ts`, `lib/ai/tools/*` (2 tools) — เทียบกับ pattern P1–P16 + segment 11 กลุ่ม + corpus 310 ข้อ ใน `campvibe-conversation-to-booking-research.md` / `campvibe-utterance-corpus.md`
> ข้อเสนอทั้งหมดเขียนตาม house convention ของ repo เอง: Atomic Data Framework (Pixel·Set·Buffet), ADR-003 (closed set → Prisma enum / open taxonomy → MasterData), classification tags, crystallization

---

## 0. สิ่งที่มีแล้วและ "ดีเกินคาด" (จุดแข็งที่ AI ใช้ได้ทันที)

| มีแล้ว | ใช้ตอบ |
|---|---|
| `cancellationPolicy` enum 4 ระดับ (PREP-2 ✅) + copy ใน locales | P14 "ยกเลิกได้ถึงเมื่อไหร่" — ตอบจาก enum ได้เลย ห้าม infer |
| `extraFeeAmount/Label` + `computeBookingPrice()` single source (PREP-2 ✅) | P14 "รวมอะไรบ้าง มีชาร์จแอบแฝงไหม" — fee ↔ total ตรงกันโดยโครงสร้าง |
| `Review.bookingId @unique + verified` (PREP-3 ✅) | P13 "รีวิวเชื่อได้ไหม" — verified-stay gate มีแล้ว |
| Booking crystallized snapshot (ADR-005) | P14 "ราคาที่จองไว้" ไม่โดน host แก้ย้อนหลัง |
| `avgRating/reviewCount` พร้อม derivation trail (AGG-1) | P4 "รีวิวดีสุด" + provenance ตอบได้ |
| `BlockedDate` + `InternalHold` + `getRemainingCapacity` (สด, มี range guard 366 คืน) | A4 "วันนี้เหลือกี่ที่" — เช็คสดรายลานทำได้แล้ว |
| MasterData 7 กลุ่ม (facility/activity/terrain/access/equipment) + `Spot.viewType` + `Image.kind=PANORAMA` | วัตถุดิบชั้นดีของ facet layer — มีมากกว่าที่คิด |
| `AdminArea`/`Country` + lat/lon ทุกลาน | P3/A2 near-me มีพิกัดพร้อม (ขาดแค่ distance service) |

**สรุปภาพรวม: รากฐาน transactional แข็งแรงมาก (เงิน/นโยบาย/availability รายลาน) — ช่องว่างเกือบทั้งหมดอยู่ฝั่ง "คุณลักษณะเชิงประสบการณ์" (facets/policy พฤติกรรม/เวลา/กลุ่มคน) และ tool surface ที่มีแค่ 2 ตัว**

---

## 1. Scorecard: pattern × ระดับการรองรับของ schema ปัจจุบัน

✅ รองรับ · 🟡 รองรับบางส่วน (ตอบได้แบบหยาบ/อ้อม) · ❌ ไม่รองรับ (ไม่มีข้อมูลหรือ query ไม่ได้)

| Pattern | ระดับ | ติดที่อะไรใน schema/tool จริง |
|---|---|---|
| P1 อ้างอิงย้อน "อันที่ 1/2" | ❌ | ไม่ใช่ schema — ชั้น conversation state (D1) ยังไม่มี; `lib/ai/serialize-conversation.ts` มีโครงแต่ไม่มี last_results/ordinal map |
| P2 เทียบ "เหมาะกับครอบครัว" | ❌ | ไม่มี facet layer; วัตถุดิบดิบมีบ้าง (facilities/terrain/`minimumAge`/`petFriendly`) แต่ **ไม่มี**: สนามเด็กเล่น (ไม่มี code ใน Activity/Facility!), ระยะเดินจากรถ, ความชัน, โซนเงียบ/ครอบครัว, review aspect |
| P3 "วีคเอนด์เดือนนี้ว่างไหม" | ❌ | `checkAvailability` รับ **ลานเดียว+ช่วงเดียว**; ไม่มี bulk ข้ามลาน, ไม่มี date-set, ไม่มีตารางวันหยุด, ไม่มี resolver |
| P4 Superlative | 🟡 | ราคา/เรตติ้ง sort ได้ (index พร้อม PERF-2/5) แต่ "คนน้อยสุด/เสาร์ไหนโล่งสุด" ต้องวนคำนวณต่อลานต่อวัน — ไม่มี calendar ที่ materialize |
| P5 ปฏิเสธ/ยกเว้น | ❌ | `searchCampsites` ไม่มี `excludeIds` และ filter enum เป็น **ค่าเดียว** (`z.enum` เลือกได้ 1 code ต่อกลุ่ม) — "ไฟฟ้า+ห้องน้ำ+wifi" หรือ "ไม่เอา X" ทำไม่ได้ |
| P6 ต่อรอง/ผ่อนปรน | ❌ | ไม่มี soft/hard constraint ใน tool; ไม่มี count-by-relaxation ("คลายเงื่อนไขไหนแล้วเจอเพิ่ม") |
| P7 Mood/เป้าหมาย | ❌ | รอ facet layer เดียวกับ P2 |
| P8 กลุ่มผสม | ❌ | `Booking.guests` เป็น **int เดียว** — ไม่มี adults/children/pets/vehicles; ไม่มี vehicle class (Access type มีแค่ DRIV/HIKE/WALK/BOAT — เก๋งขึ้นได้ไหมตอบไม่ได้); ไม่มีราคาเด็ก; `Spot` ไม่มี adjacency |
| P9 จองมีเงื่อนไข/เฝ้า | ❌ | `Notification` มีแต่ปลายทาง — ไม่มี Watch/Waitlist entity; `InternalHold` เป็นของ host ฝั่งเดียว (camper hold ไม่มี) |
| P10 ความจำส่วนตัว | 🟡 | `Wishlist` + booking history ✅ แต่ไม่มี UserPreference/episodic + consent field |
| P11 แก้กลางทาง/เลื่อน | 🟡 | ยกเลิกได้ตาม policy แต่ **ไม่มี amendment/reschedule** — `BookingStatus` ไม่มี RESCHEDULED, snapshot ตรึงค่าแล้วแก้ party/วันไม่ได้ ต้อง cancel+rebook |
| P12 Aggregate | ❌ | ไม่มี price history (มีแค่ priceLow/High ปัจจุบัน), ไม่มี occupancy calendar, `groundType` เป็น **JSON string** query ไม่ได้ (ขัด Pixel rule ของตัวเอง) |
| P13 Provenance | 🟡 | rating มี derivation ✅; ส่วน facet/หมอก/ความเงียบ — ยังไม่มีของให้ trace |
| P14 นโยบาย/เงิน | 🟡 | cancellation+fee ✅ แต่ขาด: **มัดจำ** (deposit ไม่มีฟิลด์), **weather clause**, **ราคาเด็ก**, **ราคาเช่าอุปกรณ์** (MasterData `Equipment for rent` 11 รายการ **ไม่มีราคา!** — "เช่าเต็นท์เท่าไหร่" ตอบไม่ได้), วิธีจ่ายที่ลานรับ (PaymentMethod enum อยู่ที่ ledger ไม่ใช่ประกาศของลาน), ใบกำกับภาษี |
| P15 ทริปหลายจุด | ❌ | ไม่มี trip entity / distance matrix (ตามคาด — Phase 2) |
| P16 แทรกเรื่อง | ❌ | orchestrator-level (D1) ไม่ใช่ schema |

### Scorecard ราย segment (11 กลุ่มจาก §1.5)

| Segment | ระดับ | ขาดฟิลด์อะไรจริงๆ |
|---|---|---|
| มือใหม่ | 🟡 | มี Equipment for rent + facility แต่ขาด: ระยะเดินจากที่จอด→จุดกาง, staff ช่วยกาง, ราคาเช่าอุปกรณ์ |
| ครอบครัว+กิจกรรม | ❌ | Activity 10 codes ไม่มีของเด็กเลย (ไม่มี playground/farm/bike); ไม่มีโซนครอบครัว; ไม่มีราคาเด็ก |
| คาเฟ่/Workation | 🟡 | CAFE/WIFI/ELEC codes มี ✅ แต่ไม่มีคุณภาพเน็ต (ความเร็ว/ความเสถียร), ที่นั่งทำงาน, ปลั๊กถึงจุดกางหรือแค่ส่วนกลาง |
| สายลุย/เดินป่า | 🟡 | Access=HIKE, Activity=HIKI/CLIM, Terrain ✅ แต่ไม่มี trail (ระยะ/ความยาก/ปลายทาง) |
| สายวิว/ถ่ายรูป | 🟡 | `Spot.viewType` + PANORAMA ✅; ขาดทิศพระอาทิตย์/จุดถ่ายรูป/ระดับแสงรบกวน (ดูดาว) |
| สายหมา | 🟡 | `petFriendly` เป็น bool เดียว — "หมาใหญ่ 30 โลได้ไหม ค่าธรรมเนียม? ต้องจูงไหม?" ตอบไม่ได้ |
| คู่รัก / โซโล | ❌ | ไม่มี privacy ของจุดกาง, ไม่มีข้อมูลความปลอดภัย (ไฟทาง/เจ้าของอยู่ในลาน) |
| แก๊ง/ปาร์ตี้ และ **วัยรุ่น 1.9** | ❌ | **ไม่มี noise/quiet-hours field เลยทั้ง schema** (มีแค่ Activity=LIVE บอกว่ามีดนตรีสด) — "เปิดเพลงดังได้ถึงกี่โมง" ตอบไม่ได้ทุกลาน; ไม่มี alcohol policy, เหมาโซน (Zone มีแต่ไม่มี bookable-as-whole flag) |
| รถบ้าน/Car camp | 🟡 | ELEC/WATE hookup codes มี ✅ แต่ไม่มี vehicle class ทางเข้า/ขนาดจุดจอด |

---

## 2. ข้อเสนอเชิง schema — เรียงเป็นชุด PREP ต่อจากของเดิม (PREP-4 … PREP-9)

> ทุกข้อตาม convention ของ repo: closed set → enum (ADR-003), open taxonomy → MasterData group ใหม่, ทุก Pixel มี classification, aggregate ต้องมี derivation trail, ห้าม UI-shaped column

### PREP-4 · Policy Pixels บน CampSite (ปลดล็อก P14 เต็ม + segment ปาร์ตี้/หมา/ครอบครัว)
```prisma
// ── เสียง (ปลดล็อก "วัยรุ่น 1.9") ──
quietHoursStart   String?   // "22:00" — null = ไม่มีเคอร์ฟิว (ลานปาร์ตี้) [Public]
quietHoursEnd     String?
amplifiedSound    SoundPolicy?  // enum FORBIDDEN | DAYTIME_ONLY | UNTIL_QUIET_HOURS | UNRESTRICTED
// ── แอลกอฮอล์/ไฟ ──
alcoholPolicy     AlcoholPolicy?  // FORBIDDEN | ALLOWED | SOLD_ONSITE
campfirePolicy    CampfirePolicy? // FORBIDDEN | PIT_ONLY | ALLOWED
// ── มัดจำ + สภาพอากาศ ──
depositAmount     Decimal?  @db.Decimal(12,2) // [Financial] null = ไม่เก็บมัดจำ
depositType       DepositType? // FIXED | PER_GUEST | PERCENT
weatherRefund     WeatherRefundPolicy? // NONE | RESCHEDULE_ONLY | FULL_REFUND_ON_PARK_CLOSURE
// ── เด็ก ──
childFreeUnderAge Int?      // เด็กต่ำกว่า N ขวบฟรี
childPriceAmount  Decimal?  @db.Decimal(12,2) // [Financial]
// ── สัตว์เลี้ยง (แตก petFriendly bool → policy จริง) ──
petFeeAmount      Decimal?  @db.Decimal(12,2) // [Financial]
petMaxSizeKg      Int?
petLeashRequired  Boolean?
petZoneOnly       Boolean?
```
เหตุผลตาม Resolution Boundary: ทุกตัว query/filter แยก ("ลานไม่มีเคอร์ฟิว", "มัดจำ ≤ 500", "หมาใหญ่ได้") — ผ่านทั้ง 4 ข้อ

### PREP-5 · ราคาเช่าอุปกรณ์ (Set ใหม่ — ปิดคำถาม "เช่าเต็นท์เท่าไหร่")
MasterData `Equipment for rent` มี 11 codes แต่บอกได้แค่ "มีให้เช่า" — เพิ่ม Set เชื่อมราคา:
```prisma
model EquipmentRental {
  id         String   @id @default(uuid())
  campSiteId String
  code       String   // FK → MasterData (TENT, BLKT, …)
  priceAmount Decimal @db.Decimal(12,2) // [Financial]
  priceUnit  RentalUnit // PER_NIGHT | PER_STAY | PER_ITEM
  capacityNote String? // "นอนได้ 4 คน"
  @@unique([campSiteId, code])
}
```

### PREP-6 · AvailabilityCalendar (materialized) + Holiday (ปลดล็อก P3/P4/P12 — เคส ข. ของคุณ)
- ตาราง `campSiteId × date → capacityGuests, bookedGuests, blocked, priceAmount` เขียนผ่าน event จาก booking/blocked/hold (derivation trail ชัดตามกฎ compute-on-the-fly: cache ที่ reproducible จาก `getCampSiteDailyAvailability` เสมอ)
- `Holiday(date, nameTh, isLongWeekend)` — ให้ `resolveDates` ตอบ "วันหยุดยาวรอบหน้า"
- เปิดทาง tool `bulkAvailability(filters|campIds, dateSet)` — เคส "ลานไหนว่างวีคเอนด์เดือนนี้" จบที่ query เดียว ไม่ใช่ N ลาน × M ช่วง ผ่าน guard 366 คืนทีละครั้ง

### PREP-7 · Party Pixels บน Booking (ปลดล็อก P8)
```prisma
adultsCount   Int  @default(1)
childrenCount Int  @default(0)
infantsCount  Int  @default(0)
petsCount     Int  @default(0)
vehicleType   VehicleType? // SEDAN | PICKUP | FOURWD | MOTORCYCLE | CAMPER_VAN
// guests เดิมคง sync = adults+children (backward compat, มี derivation)
```
คู่กับฝั่งลาน: `roadAccess VehicleType[]` หรือ MasterData group ใหม่ "Road access" (เก๋งถึง/ต้องกระบะ/4WD) — Access type ปัจจุบัน (DRIV) หยาบไป

### PREP-8 · FacetScore layer (ปลดล็อก P2/P7/P13 + ทุก segment — เคส ก. ของคุณ)
```prisma
model CampFacetScore {
  id         String @id @default(uuid())
  campSiteId String
  facet      String   // FK → MasterData group "Facet" (เปิดเพิ่มได้: FAMILY, BEGINNER, QUIET, PARTY, WORKATION, TREK, PHOTO, SENIOR, SOLO_SAFE, RAIN_OK)
  score      Decimal  @db.Decimal(3,2) // 0.00–1.00
  confidence Decimal  @db.Decimal(3,2)
  evidence   Json     // [{type:"field",ref:"petFeeAmount"},{type:"review",id,quote}] — provenance บังคับ (P13)
  computedAt DateTime
  @@unique([campSiteId, facet])
}
```
แหล่งคำนวณ 3 ทาง: (1) rules จาก Pixels ที่มี/เพิ่มใน PREP-4/7 (2) review aspect mining (batch LLM บน verified reviews) (3) host input — เข้ากับกฎ "cache ต้องมี derivation" ของ repo พอดี
เสริม MasterData Activity ให้ครบ segment ครอบครัว: `PLAYGROUND`, `FARM`, `BIKE`, `KIDS_ACTIVITY`

### PREP-9 · Watch/Waitlist + UserPreference + BookingAmendment (ปลดล็อก P9/P10/P11)
- `Watch(userId, kind: RAIN|FOG|CANCEL_SLOT|PRICE_DROP, campSiteId?, dateStart/End, threshold, status)` → ยิงเข้า `Notification` เดิม; ทุก action จบที่ถามผู้ใช้ (guardrail)
- `UserPreference(userId, key, value, source, consentAt)` — [PII] + PDPA ตาม `.claude/rules/ux.md`
- `BookingAmendment` append-only ledger (RESCHEDULE | PARTY_CHANGE | SPOT_CHANGE, old/new snapshot, feeApplied) — เข้า pattern ledger เดียวกับ Payment; เพิ่ม `BookingStatus.RESCHEDULED` ไม่ต้อง

### PREP-10 · Gear layer (ปลดล็อก P17 + segment มือใหม่ — "เตรียมตัวยังไง / เช่าก่อนซื้อ / ที่นี่ต้องเอาอะไรไป")
คำถาม gear มี 3 ระดับ และแต่ละระดับใช้ข้อมูลคนละที่:

1. **ความรู้ทั่วไป** ("มือใหม่ต้องมีอะไรบ้าง / งบ 3,000 ซื้ออะไรก่อน") → `GearItem` knowledge base (global ไม่ผูกลาน):
```prisma
model GearItem {
  id            String  @id @default(uuid())
  code          String  @unique // TENT, SLEEPING_BAG, HEADLAMP, REPELLENT, FAN, …
  nameTh        String
  category      GearCategory // SHELTER | SLEEP | LIGHT | COOK | COMFORT | SAFETY
  necessity     GearNecessity // MUST | SHOULD | NICE
  approxPriceLow  Decimal? @db.Decimal(12,2) // [Financial] ราคาซื้อโดยประมาณ
  approxPriceHigh Decimal? @db.Decimal(12,2)
  ownVsRentAdvice RentAdvice // RENT_FIRST | BUY_FIRST | EITHER — หัวใจของคำแนะนำ "เช่าก่อนซื้อ"
  conditionRules  Json // [{when:"nightTempC<15", add:true, note:"ถุงนอนหนา"}, {when:"mosquito>=HIGH"}]
  beginnerNote  String? // "เต็นท์ pop-up กางง่ายสุดสำหรับมือใหม่"
}
```
2. **เฉพาะลาน+ฤดู** ("ไปที่นี่ต้องเอายากันยุง/พัดลมไหม") → **condition pixels ตามฤดูบน CampSite** (host กรอก + สอบทานจาก review mining):
```prisma
model CampSeasonCondition {
  id         String @id @default(uuid())
  campSiteId String
  monthFrom  Int    // 1-12
  monthTo    Int
  mosquitoLevel  Level? // NONE | LOW | MED | HIGH  [Public]
  leechLevel     Level?
  nightHeat      Level? // ร้อนอบอ้าวกลางคืน → แนะนำพัดลม (โยง ELEC/เช่า TFAN)
  windExposure   Level? // ลมแรง → สมอบก/เชือกเสริม
  avgNightTempC  Int?   // derive จากความสูง+เดือนได้ ถ้า host ไม่กรอก (มี derivation trail)
  @@unique([campSiteId, monthFrom, monthTo])
}
```
3. **เช่าก่อนซื้อ** ("ลานนี้มีเต็นท์ให้เช่าไหม เท่าไหร่") → ใช้ `EquipmentRental` จาก PREP-5 ตรงๆ — checklist generator ตัดรายการที่ลานมีเช่าออก แล้วแนะนำ "มือใหม่เช่าที่ลาน X บาท ลอง 2-3 ทริปก่อนค่อยซื้อ (ประหยัดกว่าซื้อผิด)"

> จุดขายเชิง product: คำแนะนำ "เช่าก่อนซื้อ" สร้าง trust สูงสุดเพราะแนะนำให้จ่ายน้อยลง และ gear ที่ลานมีเช่า = add-on ที่แนบเข้า booking ได้ทันที (revenue ให้ host) · **ห้าม**เก็บ checklist เป็น text ก้อนเดียวต่อลาน — ประกอบจาก rules เสมอ (ตาม atomic principle)
> Tool เพิ่ม: `getGearChecklist(campSiteId, dateRange, party)` — ประกอบจาก GearItem × CampSeasonCondition × EquipmentRental × party (เด็ก/หมา/รถ)

### เก็บตกที่ขัดกฎตัวเองอยู่ (หยิบไปทำตอน touch ไฟล์นั้น)
- `CampSite.groundType` = JSON string → ขัด Pixel rule (query ไม่ได้) — ควรเป็น relation/columns
- `CampSite.tags` = CSV → open taxonomy ควรเข้า MasterData ตาม S4a ที่ทำกับ 6 กลุ่มอื่นไปแล้ว
- `Spot.nearFacilities` = CSV — เช่นเดียวกัน
- `toiletInfo`/`feeInfo` free text — โอเคเป็น context แต่ AI ห้ามใช้เป็น source of truth (ใส่ไว้ใน tool description ให้ชัด)

---

## 3. Tool surface: มี 2 → ต้องมี ~10

| Tool | สถานะ | Gap เจาะจง |
|---|---|---|
| `searchCampsites` | มี | filter enum รับ **ค่าเดียวต่อกลุ่ม** → เปลี่ยนเป็น array (`facilities: FacilityCode[]`), เพิ่ม `excludeIds`, `excludeFacilities`, `sort` (price/rating/distance), คืน `availabilityHint` |
| `checkAvailability` | มี (ดีแล้ว) | คงไว้เป็นตัว re-check ก่อน confirm |
| `bulkAvailability` | ❌ | ต้องมี PREP-6 ก่อน — ตัวปลดล็อกเคส ข. |
| `getCampDetails(ids[])` | ❌ | batch สำหรับ compare — ตัวปลดล็อกเคส ก. ร่วมกับ state |
| `compareCamps(ids, criteria)` | ❌ | ต่อยอดจาก getCampDetails + FacetScore |
| `resolveDates(text)` | ❌ | deterministic + Holiday table |
| `getFacetEvidence` / `getReviewSummary` | ❌ | รอ PREP-8 + aspect mining |
| `getPolicies(campId)` | ❌ | ประกอบจาก PREP-4 + cancellationPolicy + EquipmentRental — โซน no-hallucination |
| `getUserContext` | ❌ | Wishlist+history มีแล้ว แค่ยังไม่ expose (ระวัง authz: อ่านจาก session เท่านั้นตาม security.md) |
| `setWatch` | ❌ | รอ PREP-9 |

**และชั้นที่ไม่ใช่ tool แต่ขาดที่สุด: conversation state (D1)** — `last_results` พร้อม ordinal + `focus_entity` + `active_flow` serialize เข้า system context ทุก turn (เคส "อันที่ 1 และ 2" ตกที่ตรงนี้ก่อนถึง schema ด้วยซ้ำ)

## 4. ลำดับลงมือที่คุ้มสุด (impact ÷ effort)

1. **D1 conversation state + `getCampDetails(batch)` + search แบบ array/exclude** — ไม่แตะ schema เลย แก้เคส ก. ได้ ~70% ภายใน sprint เดียว
2. **PREP-6 calendar + Holiday + `bulkAvailability` + `resolveDates`** — แก้เคส ข. และเปิด P3/P4/P12 ทั้งแผง
3. **PREP-4 policy pixels** — ตอบโซนเงิน/กติกาแบบไม่มโน + เปิด segment ปาร์ตี้/หมา (ฟิลด์ host กรอกได้เลย ไม่ต้องรอ ML)
4. **PREP-5 ราคาเช่าอุปกรณ์** — คำถามถี่มาก effort ต่ำมาก
5. **PREP-8 FacetScore (เริ่มจาก rules-based ก่อน mining)** — เปิด P2/P7 + segment ครบ
6. **PREP-7 party / PREP-9 watch+amendment** — ตาม demand จริง
7. **PREP-10 gear layer** — GearItem KB ทำได้ทันทีไม่พึ่ง host (content ทีมเขียนเอง), CampSeasonCondition ค่อยให้ host เติม — ตอบคำถามมือใหม่ได้ตั้งแต่ระดับ 1 แล้วค่อยแม่นขึ้นเป็นระดับ 2-3

---
*วิเคราะห์ 18 ก.ค. 2026 จาก branch `staging` · ใช้คู่กับ research + corpus + handoff ชุดเดิม*
